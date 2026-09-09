// ============================================================
// Netlify Function: ontheline-webhook
// ============================================================
// Receives POST requests from ontheline's payment system,
// matches the paid amount against Deal Pro packages,
// creates an order + queues credentials email in Firestore.
//
// Deployed automatically by Netlify when you push to your repo.
// Endpoint URL: https://<your-netlify-site>.netlify.app/.netlify/functions/ontheline-webhook
//
// Security:
//   - Validates HMAC-SHA256 signature using ONTHELINE_WEBHOOK_SECRET env var
//     (set in Netlify dashboard → Site → Site settings → Environment variables)
//   - Falls back to a simple shared-secret query token if HMAC is not configured
//   - Optionally restricts source IPs via ONTHELINE_ALLOWED_IPS (comma-separated)
//
// Required environment variables (set in Netlify):
//   FIREBASE_PROJECT_ID          - "deal-pro-ai-web-app"
//   FIREBASE_CLIENT_EMAIL        - from Firebase service account JSON
//   FIREBASE_PRIVATE_KEY         - from Firebase service account JSON (keep \n as \n)
//   ONTHELINE_WEBHOOK_SECRET     - shared secret with ontheline for HMAC
// ============================================================

const crypto = require('crypto');
const { admin, db } = require('./lib/firebase-admin-app');
const pkgLogic = require('./lib/packages');
const dmchamp = require('./lib/dmchamp');
const { convertToUsd } = require('./lib/currency-convert');

// ------------------------------------------------------------
// Package catalog — must mirror what the web app uses
// (eventually we should fetch this from Firestore "packages")
// ------------------------------------------------------------
async function fetchPackages() {
  const snap = await db.collection('packages').get();
  const all = [];
  snap.forEach(d => all.push({ id: d.id, ...d.data() }));
  return all;
}

// Largest-fits-first matching: pick the biggest single package <= amount,
// route the remainder to a "credit.manual" line.
function matchPackagesForAmount(amount, packages) {
  amount = Number(amount) || 0;
  if (amount <= 0) return { items: [], remainder: 0 };

  // Consider only credit + onetime as candidates (subscription excluded — needs explicit selection)
  const candidates = packages
    .filter(p => p.bucket === 'credit' || p.bucket === 'onetime')
    .sort((a, b) => b.price - a.price);

  let primary = null;
  for (const p of candidates) {
    if (p.price <= amount) { primary = p; break; }
  }

  const items = [];
  let remainder = amount;
  if (primary) {
    items.push({
      bucket: primary.bucket,
      id: primary.id,
      title: primary.title || primary.id,
      price: primary.price
    });
    remainder = amount - primary.price;
  }

  if (remainder > 0) {
    items.push({
      bucket: 'credit',
      id: 'credit.manual',
      title: 'Manual Input',
      price: remainder,
      manual: true
    });
  }

  return { items, remainder: primary ? remainder : amount };
}

// ------------------------------------------------------------
// Signature verification — HMAC-SHA256 over the raw request body
// ontheline should send header: X-OnTheLine-Signature: sha256=<hex>
// ------------------------------------------------------------
function verifySignature(rawBody, headerSig, secret) {
  if (!secret) return { ok: false, reason: 'no-secret-configured' };
  if (!headerSig) return { ok: false, reason: 'missing-signature-header' };

  const signature = headerSig.replace(/^sha256=/, '').trim();
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  try {
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return { ok: false, reason: 'length-mismatch' };
    return { ok: crypto.timingSafeEqual(a, b), reason: 'verified' };
  } catch (e) {
    return { ok: false, reason: 'compare-error' };
  }
}

// ------------------------------------------------------------
// Main handler
// ------------------------------------------------------------
exports.handler = async (event) => {
  // GET → diagnostic endpoint (safe: never returns secret values, only their presence)
  if (event.httpMethod === 'GET') {
    const envVars = {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '(NOT SET)',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL
        ? process.env.FIREBASE_CLIENT_EMAIL.substring(0, 30) + '...'
        : '(NOT SET)',
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
        ? `set (length: ${process.env.FIREBASE_PRIVATE_KEY.length} chars, starts: "${process.env.FIREBASE_PRIVATE_KEY.substring(0, 30).replace(/\n/g, '\\n')}")`
        : '(NOT SET)',
      ONTHELINE_WEBHOOK_SECRET: process.env.ONTHELINE_WEBHOOK_SECRET ? 'set' : '(NOT SET)',
      WEBHOOK_TEST_MODE: process.env.WEBHOOK_TEST_MODE || '(not set)'
    };

    // Try a Firestore ping
    let firestoreStatus = 'not-tested';
    let firestoreError = null;
    try {
      await db.collection('packages').limit(1).get();
      firestoreStatus = 'OK — service account can read Firestore';
    } catch (e) {
      firestoreStatus = 'FAILED';
      firestoreError = {
        code: e.code,
        message: e.message,
        hint: e.code === 7
          ? 'PERMISSION_DENIED — verify service account JSON belongs to the correct Firebase project (deal-pro-ai-web-app)'
          : null
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diagnostic: true,
        message: 'Webhook function is reachable. Send POST to actually process a webhook.',
        environment: envVars,
        firestore: { status: firestoreStatus, error: firestoreError }
      }, null, 2)
    };
  }

  // Only accept POST after diagnostic
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Allow': 'POST, GET' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Optional IP allowlist
  const allowedIps = (process.env.ONTHELINE_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowedIps.length) {
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || event.headers['client-ip']
      || 'unknown';
    if (!allowedIps.includes(clientIp)) {
      console.warn('Blocked IP:', clientIp);
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden — IP not allowed' }) };
    }
  }

  // Verify signature
  // BYPASS: when WEBHOOK_TEST_MODE=true, accept any request (for dev/debug only).
  // Never enable this in production — anyone could fabricate orders.
  const testMode = (process.env.WEBHOOK_TEST_MODE || '').toLowerCase() === 'true';
  if (!testMode) {
    // Resolve the shared secret. Preference order:
    //   1. Firestore config/webhook.secret  (admin can edit via UI)
    //   2. ONTHELINE_WEBHOOK_SECRET env var  (initial/fallback configuration)
    // This lets admins rotate the secret from the UI without redeploying.
    let secret = null;
    try {
      const cfgSnap = await db.collection('config').doc('webhook').get();
      if (cfgSnap.exists) {
        const cfg = cfgSnap.data() || {};
        if (cfg.secret && typeof cfg.secret === 'string' && cfg.secret.trim()) {
          secret = cfg.secret.trim();
        }
      }
    } catch (e) {
      console.warn('Could not load config/webhook from Firestore:', e.message || e);
    }
    if (!secret) {
      secret = process.env.ONTHELINE_WEBHOOK_SECRET || null;
    }
    const sigHeader = event.headers['x-ontheline-signature'] || event.headers['X-OnTheLine-Signature'];
    const sigResult = verifySignature(event.body || '', sigHeader, secret);
    if (!sigResult.ok) {
      console.warn('Signature check failed:', sigResult.reason);
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature', reason: sigResult.reason })
      };
    }
  } else {
    console.warn('⚠️ WEBHOOK_TEST_MODE is ON — signature check bypassed. Disable for production.');
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Expected payload shape from ontheline:
  // {
  //   "event": "purchase.completed",
  //   "transaction_id": "ot_xxx",
  //   "customer": { "name": "...", "email": "...", "country": "TH" },
  //   "amount": 5020.00,
  //   "currency": "USD"
  // }
  const customer = payload.customer || {};
  const amount = Number(payload.amount || 0);
  const currency = (payload.currency || 'USD').toString().trim().toUpperCase();
  const txId = payload.transaction_id || `ot_${Date.now()}`;
  // partner / paygw codes sent by ontheline. Both are validated against the
  // admin-managed reference lists (ontheline_partners / ontheline_paygw).
  const partnerCode = (payload.partner || '').toString().trim();
  const paygwCode   = (payload.paygw   || '').toString().trim();

  // ontheline now sends an `event` describing the transaction state. We accept
  // a small set and normalise to a canonical form. Legacy "purchase.completed"
  // maps to "Paid" for backwards compatibility.
  //   Paid, Unpaid, Refund, Partial Refund, Fail
  // Only "Paid" and "Partial Refund" trigger user provisioning + emails +
  // credit recording; the others are recorded (order + webhook_event) only.
  const EVENT_ALIASES = {
    'paid': 'Paid',
    'purchase.completed': 'Paid',
    'unpaid': 'Unpaid',
    'refund': 'Refund',
    'partial refund': 'Partial Refund',
    'partial_refund': 'Partial Refund',
    'partialrefund': 'Partial Refund',
    'fail': 'Fail',
    'failed': 'Fail'
  };
  const rawEvent = (payload.event || 'purchase.completed').toString().trim();
  const eventStatus = EVENT_ALIASES[rawEvent.toLowerCase()] || null;
  // Only "Paid" provisions (creates user / sends purchase emails / records
  // credits). Partial Refund is always a reversal of a prior Paid (the state
  // machine guarantees it can't open a new transaction), handled separately.
  const PROVISION_EVENTS = ['Paid'];

  if (!customer.email || !amount) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: customer.email and amount' })
    };
  }

  // Reject unknown event types so the caller knows to fix their payload.
  if (!eventStatus) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Unknown event: ${rawEvent}. Accepted: Paid, Unpaid, Refund, Partial Refund, Fail`, field: 'event' })
    };
  }

  // Validate partner + paygw codes against Firestore reference lists.
  // Matching is case-insensitive. A missing or unknown code is rejected with
  // 400 so the caller knows to fix it. (If either field is absent entirely we
  // also reject, since ontheline is expected to always send both now.)
  // Also validate the currency against the admin-managed ontheline_currencies.
  try {
    const [partnerSnap, paygwSnap, currencySnap] = await Promise.all([
      db.collection('ontheline_partners').get(),
      db.collection('ontheline_paygw').get(),
      db.collection('ontheline_currencies').get()
    ]);
    const partnerCodes  = partnerSnap.docs.map(d => (d.data().code || '').toLowerCase());
    const paygwCodes    = paygwSnap.docs.map(d => (d.data().code || '').toLowerCase());
    const currencyCodes = currencySnap.docs.map(d => (d.data().code || '').toLowerCase());

    if (!partnerCode) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field: partner' }) };
    }
    if (partnerCodes.indexOf(partnerCode.toLowerCase()) === -1) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown partner code: ${partnerCode}`, field: 'partner' }) };
    }
    if (!paygwCode) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field: paygw' }) };
    }
    if (paygwCodes.indexOf(paygwCode.toLowerCase()) === -1) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown paygw code: ${paygwCode}`, field: 'paygw' }) };
    }
    if (currencyCodes.indexOf(currency.toLowerCase()) === -1) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown currency code: ${currency}`, field: 'currency' }) };
    }
  } catch (e) {
    console.error('[ontheline-webhook] partner/paygw/currency validation failed:', e.message || e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Validation lookup failed' }) };
  }

  // Idempotency: an exact (transactionId + event) repeat is a duplicate replay.
  // We return 200 so ontheline stops retrying, without re-processing.
  if (txId) {
    const dupe = await db.collection('webhook_events')
      .where('transactionId', '==', txId)
      .where('event', '==', eventStatus)
      .limit(1).get();
    if (!dupe.empty) {
      const existingDoc = dupe.docs[0].data();
      console.info('Idempotent replay for txId', txId, 'event', eventStatus);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, idempotent: true, event: eventStatus, orderRef: existingDoc.orderRef })
      };
    }
  }

  // ---- State machine -------------------------------------------------------
  // Determine the CURRENT state of this transaction_id (the latest event we've
  // already recorded), then validate that the incoming event is a legal
  // transition. Rules (per spec):
  //   • New transaction_id (no prior event): only Paid or Fail may start it.
  //       Unpaid / Refund / Partial Refund require a prior Paid  → else 400.
  //   • Paid       → Unpaid | Refund | Partial Refund   (anything else 400)
  //   • Unpaid / Refund / Partial Refund → FINAL          (any event 400)
  //   • Fail       → Paid                                 (anything else 400)
  let currentState = null;     // null = transaction_id brand new
  let paidOrderData = null;    // the Paid order, needed for credit reversal math
  if (txId) {
    const prior = await db.collection('webhook_events')
      .where('transactionId', '==', txId)
      .get();
    if (!prior.empty) {
      // Latest event by createdAt = current state.
      const sorted = prior.docs
        .map(d => d.data())
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
      currentState = sorted[0].event || null;
    }
  }

  function transitionError(reason) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: reason,
        field: 'event',
        currentState: currentState,
        attemptedEvent: eventStatus,
        transactionId: txId
      })
    };
  }

  if (currentState === null) {
    // Brand-new transaction. Only Paid or Fail may open it.
    if (eventStatus !== 'Paid' && eventStatus !== 'Fail') {
      return transitionError(`Event "${eventStatus}" requires an existing Paid transaction, but transaction_id "${txId}" was not found`);
    }
  } else if (currentState === 'Paid') {
    // Paid → Unpaid / Refund / Partial Refund only.
    if (!['Unpaid', 'Refund', 'Partial Refund'].includes(eventStatus)) {
      return transitionError(`From "Paid", only Unpaid, Refund, or Partial Refund are allowed (received "${eventStatus}")`);
    }
  } else if (['Unpaid', 'Refund', 'Partial Refund'].includes(currentState)) {
    // Final states — no further change allowed.
    return transitionError(`Transaction "${txId}" is in final state "${currentState}" and cannot change (received "${eventStatus}")`);
  } else if (currentState === 'Fail') {
    // Fail → Paid only.
    if (eventStatus !== 'Paid') {
      return transitionError(`From "Fail", only Paid is allowed (received "${eventStatus}")`);
    }
  }

  // For events that reverse a prior Paid (Unpaid / Refund / Partial Refund),
  // fetch the original Paid order so we can reverse the right number of credits.
  if (['Unpaid', 'Refund', 'Partial Refund'].includes(eventStatus) && currentState === 'Paid') {
    const paidSnap = await db.collection('orders')
      .where('transactionId', '==', txId)
      .where('event', '==', 'Paid')
      .limit(1).get();
    if (!paidSnap.empty) {
      paidOrderData = { id: paidSnap.docs[0].id, ...paidSnap.docs[0].data() };
    }
  }

  // Whether this event should provision (create user / send purchase emails /
  // record credits). Paid + Partial Refund per spec. Reversal events handle
  // their own credit-deduction + email below.
  const shouldProvision = PROVISION_EVENTS.indexOf(eventStatus) !== -1;
  // Reversal events deduct credits + send a refund/cancel email.
  const isReversal = ['Unpaid', 'Refund', 'Partial Refund'].includes(eventStatus) && currentState === 'Paid';

  try {
    // Convert the incoming amount to USD. ontheline sends the amount in the
    // order's own currency; everything downstream (package matching, VAT,
    // credit calculation) works in USD. We store BOTH the original currency
    // amount and the USD value on the order so the admin can show both.
    //
    // IMPORTANT: ontheline sends a VAT-INCLUSIVE amount (the exact sum the
    // customer paid). So the converted USD figure IS the grand total. We work
    // backwards to recover the pre-VAT subtotal (total ÷ 1.07), which is what
    // package matching + DM Champ credit calculation use. We never add VAT on
    // top of an ontheline amount.
    let convUsd = amount, fxRate = 1, fxSource = 'identity';
    try {
      const conv = await convertToUsd(amount, currency);
      convUsd = conv.usd; fxRate = conv.rate; fxSource = conv.source;
    } catch (e) {
      console.warn('[ontheline-webhook] currency conversion failed, using amount as USD:', e.message || e);
    }

    const total = +Number(convUsd).toFixed(2);             // VAT-inclusive (what the customer paid)
    const usdAmount = +(total / 1.07).toFixed(2);           // pre-VAT subtotal (credit + matching)
    const vat = +(total - usdAmount).toFixed(2);

    // Fetch current packages from Firestore and match (on the pre-VAT subtotal)
    const packages = await fetchPackages();
    const matched = matchPackagesForAmount(usdAmount, packages);

    const ref = 'DP-OT-' + Date.now().toString(36).toUpperCase().slice(-6);
    const now = admin.firestore.FieldValue.serverTimestamp();

    // 1. Record webhook event for audit trail. The `event` field carries the
    //    normalised event (Paid/Unpaid/Refund/Partial Refund/Fail) — the admin
    //    "Recent webhook events" STATUS column shows this. `status:'success'`
    //    just means the webhook was processed OK (HTTP-level), kept for compat.
    await db.collection('webhook_events').add({
      event: eventStatus,
      transactionId: txId,
      customer: {
        name: customer.name || '(unknown)',
        email: customer.email,
        country: customer.country || ''
      },
      amount, currency,              // original currency amount
      amountUsd: usdAmount,          // converted USD
      fxRate, fxSource,
      partner: partnerCode,
      paygw: paygwCode,
      items: matched.items,
      orderRef: ref,
      status: 'success',
      provisioned: shouldProvision,
      rawPayload: payload,
      createdAt: now
    });

    // ---- Reversal events (Unpaid / Refund / Partial Refund after a Paid) ----
    // These reverse credits granted by the original Paid order and notify the
    // customer. Per the ontheline design we do NOT call the DM Champ API — we
    // record the deduction on the order + audit log, and queue a refund email.
    if (isReversal) {
      // Credits originally granted by the Paid order. Prefer the stored value;
      // fall back to recomputing from the paid USD × rate if it wasn't stored.
      const paidUsd = Number(paidOrderData?.amountUsd) || Number(paidOrderData?.subtotal) || 0;
      const creditsPerUsd = Number(paidOrderData?.dmchampSubAccount?.creditsPerUsd) || 100;
      let grantedCredits = Number(paidOrderData?.dmchampSubAccount?.creditsGranted) || 0;
      if (grantedCredits <= 0 && paidUsd > 0) {
        grantedCredits = Math.max(1, Math.round(paidUsd * creditsPerUsd));
      }

      let creditsDeducted, creditsRemaining, refundUsd, refundUsdTotal, refundOriginal;
      if (eventStatus === 'Partial Refund') {
        // amount = the portion being refunded (VAT-inclusive, in the order
        // currency). usdAmount is its pre-VAT subtotal, total is VAT-inclusive.
        // It MUST be less than the original paid amount (rule 2.9).
        refundOriginal = amount;
        refundUsd = usdAmount;        // pre-VAT subtotal of the refund
        refundUsdTotal = total;       // VAT-inclusive refund (what's returned)
        if (refundUsd >= paidUsd) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: `Partial Refund amount (${amount} ${currency} ≈ $${refundUsd} pre-VAT) must be LESS than the original paid subtotal ($${paidUsd})`,
              field: 'amount',
              transactionId: txId
            })
          };
        }
        creditsDeducted = Math.round(refundUsd * creditsPerUsd);
        creditsRemaining = Math.max(0, grantedCredits - creditsDeducted);
      } else {
        // Unpaid / Refund = full reversal: refund the full amount the customer
        // paid (use the Paid order's stored figures) and remove all credits.
        refundOriginal = Number(paidOrderData?.amountOriginal) || amount;
        refundUsd = paidUsd;                                       // pre-VAT subtotal
        refundUsdTotal = Number(paidOrderData?.total) || total;    // VAT-inclusive total paid
        creditsDeducted = grantedCredits;
        creditsRemaining = 0;
      }

      // Record the reversal order (shown in the Orders table as this event).
      const reversalOrder = {
        ref,
        source: 'ontheline',
        status: eventStatus,
        event: eventStatus,
        transactionId: txId,
        customer: {
          name: customer.name || paidOrderData?.customer?.name || '(unknown)',
          email: customer.email,
          country: customer.country || paidOrderData?.customer?.country || ''
        },
        items: paidOrderData?.items || matched.items,
        subtotal: refundUsd,                 // pre-VAT subtotal of the refund
        vat: +(refundUsdTotal - refundUsd).toFixed(2),
        total: refundUsdTotal,               // VAT-inclusive refund (what's returned to the customer)
        currency,
        amountOriginal: refundOriginal,
        amountUsd: refundUsd,                // pre-VAT (kept for parity with paid orders)
        fxRate, fxSource,
        partner: partnerCode,
        paygw: paygwCode,
        receiptLang: paidOrderData?.receiptLang || 'en',
        // Credit reversal bookkeeping (display only — no DM Champ API call):
        reversalOf: paidOrderData?.ref || null,
        creditsDeducted,                 // how many credits were removed
        creditsRemaining,                // net credits left for the customer
        refundAmountUsd: refundUsdTotal, // VAT-inclusive USD refunded (matches display/revenue)
        refundAmountOriginal: refundOriginal,
        createdAt: now,
        updatedAt: now
      };
      await db.collection('orders').add(reversalOrder);

      // Audit log
      await db.collection('audit_log').add({
        action: eventStatus === 'Partial Refund' ? 'ontheline_partial_refund' : 'ontheline_refund_cancel',
        orderRef: ref,
        reversalOf: paidOrderData?.ref || null,
        customerEmail: customer.email,
        creditsDeducted,
        creditsRemaining,
        refundAmountUsd: refundUsd,
        note: `ontheline ${eventStatus}: deducted ${creditsDeducted} credits (display only, no DM Champ API call). Customer notified.`,
        source: 'ontheline',
        at: now
      });

      // Queue the refund/cancel email.
      const refundLang = paidOrderData?.receiptLang
        || ({ TH: 'th', KR: 'ko', JP: 'ja' }[(customer.country || '').toUpperCase()])
        || 'en';
      await db.collection('email_queue').add({
        to: customer.email,
        kind: eventStatus === 'Partial Refund' ? 'partial_refund' : 'refund_cancel',
        orderRef: ref,
        lang: refundLang,
        status: 'pending',
        source: 'ontheline',
        payload: {
          ref,
          event: eventStatus,
          customer: reversalOrder.customer,
          currency,
          refundAmountOriginal: refundOriginal,
          refundAmountUsd: refundUsd,
          creditsDeducted,
          creditsRemaining,
          originalPaidRef: paidOrderData?.ref || null,
          receiptLang: refundLang
        },
        createdAt: now
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          event: eventStatus,
          reversal: true,
          creditsDeducted,
          creditsRemaining,
          orderRef: ref
        })
      };
    }

    // Non-provisioning events that AREN'T reversals (a Fail opening a new
    // transaction): record a lean order for the audit trail and stop.
    if (!shouldProvision) {
      const leanOrder = {
        ref,
        source: 'ontheline',
        status: eventStatus,           // raw event as the order status
        event: eventStatus,
        transactionId: txId,
        customer: {
          name: customer.name || '(unknown)',
          email: customer.email,
          country: customer.country || ''
        },
        items: matched.items,
        subtotal: usdAmount,
        vat,
        total,
        currency,                      // original currency code
        amountOriginal: amount,        // amount in original currency
        amountUsd: usdAmount,          // converted USD (for credit math / display)
        fxRate, fxSource,
        partner: partnerCode,
        paygw: paygwCode,
        receiptLang: 'en',
        createdAt: now,
        updatedAt: now
      };
      await db.collection('orders').add(leanOrder);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, event: eventStatus, provisioned: false, orderRef: ref })
      };
    }

    // Compute order expiry from items (null for credit-only orders).
    // Also look up any existing active orders for this customer so we can
    // apply "extend" semantics for same-bucket repurchases.
    let expiresAt = null;
    try {
      const paidAtDate = new Date();
      const activeSnap = await db.collection('orders')
        .where('customer.email', '==', customer.email)
        .where('status', '==', 'paid')
        .get();
      const existingActive = activeSnap.docs
        .map(d => d.data())
        .filter(o => {
          if (!o.expiresAt) return false;
          const exp = o.expiresAt.toDate ? o.expiresAt.toDate() : new Date(o.expiresAt);
          return !isNaN(exp.getTime()) && exp.getTime() > paidAtDate.getTime();
        })
        .map(o => ({
          items: o.items || [],
          expiresAt: o.expiresAt.toDate ? o.expiresAt.toDate() : new Date(o.expiresAt)
        }));
      expiresAt = pkgLogic.computeOrderExpiryWithExtension(matched.items, paidAtDate, existingActive);
    } catch (e) {
      console.warn('[ontheline-webhook] expiry computation failed:', e.message || e);
    }

    // 2. Create order document
    const orderData = {
      ref,
      source: 'ontheline',
      status: 'paid',
      event: eventStatus,
      customer: {
        name: customer.name || '(unknown)',
        email: customer.email,
        country: customer.country || ''
      },
      items: matched.items,
      subtotal: usdAmount,
      vat,
      total,
      currency,                      // original currency code
      amountOriginal: amount,        // amount in the original currency
      amountUsd: usdAmount,          // converted USD (credit math + display)
      fxRate, fxSource,
      partner: partnerCode,
      paygw: paygwCode,
      receiptLang: 'en',
      transactionId: txId,
      paidAt: now,
      expiresAt,
      createdAt: now,
      updatedAt: now
    };
    await db.collection('orders').add(orderData);

    // 3. Provision customer account (best-effort)
    //    Use Firebase Auth Admin SDK to create the user; if email already exists, skip silently.
    let initialPassword = null;
    try {
      initialPassword = `dp_${ref.toLowerCase()}_${crypto.randomBytes(3).toString('hex')}`;
      const newUser = await admin.auth().createUser({
        email: customer.email,
        password: initialPassword,
        displayName: customer.name || customer.email
      });
      await db.collection('users').doc(newUser.uid).set({
        uid: newUser.uid,
        email: customer.email,
        name: customer.name || customer.email,
        role: 'customer',
        mustChangePassword: true,
        plan: matched.items.map(i => i.title).join(' + '),
        source: 'ontheline',
        createdAt: now
      });
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-exists') {
        // User already exists — that's fine, don't include initialPassword in email
        initialPassword = null;
      } else {
        console.warn('User provisioning skipped:', authErr.code || authErr.message);
      }
    }

    // 4. Queue invoice/receipt/credentials emails
    const emailPayloadBase = {
      ...orderData,
      initialPassword // included for credentials kind
    };
    // Determine the language to use for emails based on the customer's country
    // (falls back to English for any country we don't have a translation for)
    const countryToLang = {
      TH: 'th',  // Thailand
      KR: 'ko',  // South Korea
      JP: 'ja'   // Japan
      // anything else → 'en'
    };
    const emailLang = countryToLang[(customer.country || '').toUpperCase()] || 'en';

    const emailsToQueue = [
      { kind: 'invoice' },
      { kind: 'receipt' },
      { kind: 'credentials' }
    ];
    for (const e of emailsToQueue) {
      await db.collection('email_queue').add({
        to: customer.email,
        kind: e.kind,
        // subject is now generated dynamically by the email template at send time,
        // so we store the kind here. Admin UI can compute the subject on demand.
        orderRef: ref,
        lang: emailLang,
        status: 'pending',
        // Marks this recipient as ontheline-origin so the sender injects a
        // Zero-Width Space before the "@" when handing it to Resend (the stored
        // `to` value here stays clean for display/CSV).
        source: 'ontheline',
        payload: emailPayloadBase,
        createdAt: now
      });
    }

    // 5. Record DM Champ credits WITHOUT calling the DM Champ API.
    //    ontheline already handles DM Champ provisioning + crediting on its
    //    own side, so Deal Pro must NOT create, look up, or top-up anything
    //    via the DM Champ API for ontheline orders. We only need to:
    //      (a) compute how many credits this purchase is worth (subtotal ×
    //          creditsPerUsd) so the figure shows up in Users / Orders /
    //          Customer Portal, and
    //      (b) write a synthetic dmchampSubAccount record with status
    //          'topped_up' so the Order View modal renders
    //          "✓ Topped up by N credits", and
    //      (c) queue the DM Champ email using the 'dmchamp_linked' template
    //          (subject "Your DM Champ workspace is linked to this purchase")
    //          for EVERY ontheline order, new or returning.
    //    No network call to DM Champ happens here.
    try {
      // creditsPerUsd comes from config/dmchamp (Firestore read only — no API)
      const dmCfg = await dmchamp.loadConfig(db);
      const creditsPerUsd = Number(dmCfg.creditsPerUsd) || 100;
      const creditsEarned = dmchamp.computeMonthlyCredits(usdAmount, creditsPerUsd)
        || dmCfg.defaultMonthlyCredits || 0;

      // (b) synthetic topped_up record on the order. uid/tempPassword are null
      //     because Deal Pro never owns an ontheline customer's DM Champ login —
      //     ontheline manages that. creditsPerUsd is snapshotted so the UI shows
      //     the same number even if the admin later changes the rate.
      const orderSnap = await db.collection('orders').where('ref', '==', ref).limit(1).get();
      if (!orderSnap.empty) {
        await orderSnap.docs[0].ref.update({
          dmchampSubAccount: {
            status:         'topped_up',
            uid:            null,
            email:          customer.email,
            tempPassword:   null,
            monthlyCredits: creditsEarned,
            creditsGranted: creditsEarned,   // drives "Topped up by N credits"
            newBalance:     null,            // unknown — ontheline owns the balance
            creditsPerUsd:  creditsPerUsd,   // snapshot for UI consistency
            usdAmount:      usdAmount,        // pre-VAT subtotal (ontheline amount is VAT-inclusive; subtotal = total ÷ 1.07)
            source:         'ontheline',     // marks this as a no-API ontheline record
            actorEmail:     null,
            httpStatus:     0,               // 0 = no API call was made
            attempts:       0,
            error:          null,
            createdAt:      now,
            lastAttemptAt:  now,
            raw:            null
          }
        });
      }

      // (c) queue the DM Champ "linked to this purchase" email. Always the
      //     dmchamp_linked template regardless of whether the Deal Pro user
      //     was new or existing. toppedUp:true so the copy reads as a credit
      //     top-up tied to this purchase.
      await db.collection('email_queue').add({
        to:       customer.email,
        kind:     'dmchamp_linked',
        orderRef: ref,
        lang:     emailLang,
        status:   'pending',
        source:   'ontheline',   // ZWSP-before-@ at Resend send-time (stored value stays clean)
        payload: {
          ref:       ref,
          customer:  orderData.customer,
          dmchamp: {
            email:          customer.email,
            monthlyCredits: creditsEarned,
            creditsGranted: creditsEarned,
            toppedUp:       true
          },
          receiptLang: emailLang
        },
        createdAt: now
      });

      // Audit log — note that NO DM Champ API call was made
      await db.collection('audit_log').add({
        action:         'dmchamp_ontheline_credit',
        orderRef:       ref,
        customerEmail:  customer.email,
        creditsGranted: creditsEarned,
        note:           'ontheline order — credits recorded for display only, no DM Champ API call (ontheline manages DM Champ)',
        source:         'ontheline',
        at:             now
      });

      console.log(`[ontheline-webhook] Recorded ${creditsEarned} DM Champ credits for order ${ref} (display only, no API call)`);
    } catch (e) {
      // Non-fatal — the order, emails, and user are already committed.
      console.error('[ontheline-webhook] DM Champ credit recording failed (non-fatal):', e);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        orderRef: ref,
        matched: matched.items.map(i => ({ id: i.id, title: i.title, price: i.price })),
        message: 'Webhook processed — order created, user provisioned, emails queued.'
      })
    };

  } catch (e) {
    console.error('Webhook processing failed:', e);
    // Record the failure for admin review
    try {
      await db.collection('webhook_events').add({
        event: payload?.event || 'purchase.completed',
        transactionId: txId,
        customer: payload?.customer || {},
        amount: payload?.amount || 0,
        currency: payload?.currency || 'USD',
        status: 'failed',
        error: String(e.message || e),
        rawPayload: payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch {}

    // Provide a helpful hint if it's a permission error
    let hint = null;
    if (e.code === 7 || /PERMISSION_DENIED/i.test(e.message || '')) {
      hint = 'Firestore permission denied. Verify: (1) FIREBASE_PROJECT_ID matches your Firebase project, (2) the service account JSON was generated from THE SAME project, (3) FIREBASE_PRIVATE_KEY in Netlify still has \\n separators intact (not collapsed). Send GET to this URL to diagnose.';
    } else if (/invalid_grant|invalid signature|JWT/i.test(e.message || '')) {
      hint = 'Service account credentials invalid. The JSON file may have been deleted/rotated in Firebase Console, or FIREBASE_PRIVATE_KEY in Netlify has wrong newlines. Regenerate a fresh service account key.';
    } else if (/UNAUTHENTICATED|unauthenticated/i.test(e.message || '')) {
      hint = 'Firebase Admin SDK could not authenticate. Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are set correctly.';
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal error processing webhook',
        detail: String(e.message || e),
        code: e.code,
        hint
      })
    };
  }
};
