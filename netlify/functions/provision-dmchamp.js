// ============================================================
// Netlify Function: provision-dmchamp
// ============================================================
// Provisions a DM Champ sub-account for a paid Deal Pro order, and
// optionally queues a follow-up "DM Champ access" email so the
// customer receives their new credentials.
//
// Two ways to invoke this file:
//
//   1) As a Netlify Function (HTTP POST) — admin-only manual retry:
//        POST /api/provision-dmchamp
//        Headers: Authorization: Bearer <admin firebase ID token>
//        Body:    { "orderRef": "DP-..." }   OR   { "orderId": "<docId>" }
//
//   2) As a require()-able module from other functions
//      (e.g. chillpay-callback.js) — direct in-process call:
//        const { provisionForOrder } = require('./provision-dmchamp');
//        const result = await provisionForOrder(db, admin, order, orderRef, { source: 'auto' });
//
// Behaviour:
//   - Idempotent: if order.dmchampSubAccount.status === 'created', the
//     function returns the existing record without re-calling DM Champ.
//   - On success: writes order.dmchampSubAccount = { uid, email,
//     tempPassword, monthlyCredits, status:'created', createdAt, source }
//     and queues a 'dmchamp_access' email via email_queue.
//   - On failure: writes order.dmchampSubAccount = { status:'failed',
//     error, lastAttemptAt, attempts++ } so admin can retry.
//
// Endpoint:    POST /api/provision-dmchamp
// Diagnostic:  GET  /api/provision-dmchamp
// ============================================================

const admin = require('firebase-admin');
const dmchamp = require('./lib/dmchamp');

// Firebase Admin singleton (same pattern as the other functions)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
      })
    });
  } catch (e) {
    console.error('[provision-dmchamp] Firebase init failed:', e);
  }
}
const db = admin.firestore();

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResp(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

// ------------------------------------------------------------
// Determine which language to use for the DM Champ access email.
// Mirrors the same heuristic used in chillpay-callback.js.
// ------------------------------------------------------------
function emailLangFor(order) {
  const map = { TH: 'th', KR: 'ko', JP: 'ja' };
  return order.receiptLang
      || map[(order.customer?.country || '').toUpperCase()]
      || 'en';
}

// ------------------------------------------------------------
// CORE: Provision DM Champ sub-account for a paid order.
// Exported so chillpay-callback can invoke it directly.
//
// @param {Firestore}       db
// @param {firebase-admin}  adminLib  (passed in for FieldValue access)
// @param {object}          order     order doc data (must include customer, total, ref)
// @param {DocumentReference} orderRef  Firestore ref to the order doc
// @param {object}          opts
//   - source: 'auto' | 'manual'
//   - actorEmail: string (admin email if manual)
//   - forceLinkedEmail: bool — when true, even a brand-new sub-account
//       (status='created') queues the 'dmchamp_linked' email template
//       instead of 'dmchamp_access'. Used by the ontheline flow, where
//       every DM Champ email must use the "linked to this purchase"
//       subject regardless of whether the customer is new or returning.
//       Does NOT change the sub-account creation logic or the temp
//       password — only which email template is queued.
//
// Returns: { ok: boolean, alreadyProvisioned?: bool, data?, error?, status? }
// ------------------------------------------------------------
async function provisionForOrder(db, adminLib, order, orderRef, opts = {}) {
  const source           = opts.source     || 'auto';
  const actorEmail       = opts.actorEmail || null;
  const forceLinkedEmail = opts.forceLinkedEmail === true;
  const now        = adminLib.firestore.FieldValue.serverTimestamp();

  // ---- Validate order is paid ----
  if (order.status !== 'paid') {
    return { ok: false, error: `Order is not paid (status=${order.status})`, status: 0 };
  }

  // ---- Idempotency: don't re-provision if already created ----
  const existing = order.dmchampSubAccount || null;
  if (existing && existing.status === 'created' && existing.uid) {
    console.log(`[provision-dmchamp] Order ${order.ref} already provisioned (uid=${existing.uid}) — skipping`);
    return { ok: true, alreadyProvisioned: true, data: existing };
  }

  const email = order.customer?.email;
  if (!email) {
    await orderRef.update({
      'dmchampSubAccount.status': 'failed',
      'dmchampSubAccount.error': 'Order has no customer email',
      'dmchampSubAccount.lastAttemptAt': now,
      'dmchampSubAccount.attempts': adminLib.firestore.FieldValue.increment(1)
    });
    return { ok: false, error: 'Order has no customer email', status: 0 };
  }

  // ---- Load config ----
  const cfg = await dmchamp.loadConfig(db);
  if (!cfg.apiKey) {
    await orderRef.update({
      'dmchampSubAccount.status': 'failed',
      'dmchampSubAccount.error': 'DM Champ API key not configured',
      'dmchampSubAccount.lastAttemptAt': now,
      'dmchampSubAccount.attempts': adminLib.firestore.FieldValue.increment(1)
    });
    return { ok: false, error: 'DM Champ API key not configured', status: 0 };
  }
  if (!cfg.enabled) {
    // Don't mark as failed; integration is intentionally off.
    return { ok: false, error: 'DM Champ integration is disabled', status: 0, disabled: true };
  }

  // ---- Compute monthly_credits from order USD SUBTOTAL ----
  // Credits are calculated from the SUBTOTAL (price before VAT), not the
  // VAT-inclusive total. Rationale: VAT is collected on behalf of the tax
  // authority and isn't part of what the customer is paying for the AI
  // service. Two customers buying the same package shouldn't get different
  // credit amounts depending on their tax jurisdiction.
  //
  // Falls back to `order.total` only if `subtotal` is missing on the order
  // (which can happen for legacy orders created before this rule existed
  // or for manually-edited orders).
  const subtotalUsd = Number(order.subtotal);
  const fallbackUsd = Number(order.total);
  const usdAmount = Number.isFinite(subtotalUsd) && subtotalUsd > 0
    ? subtotalUsd
    : fallbackUsd;
  const monthlyCredits = dmchamp.computeMonthlyCredits(usdAmount, cfg.creditsPerUsd)
    || cfg.defaultMonthlyCredits;

  // ---- Call DM Champ API ----
  const result = await dmchamp.createSubAccount(cfg, {
    email,
    fullName: order.customer?.name || '',
    country:  order.customer?.country || cfg.country,
    language: emailLangFor(order),
    monthly_credits: monthlyCredits,
    description: `Deal Pro order ${order.ref}`
  });

  if (!result.ok) {
    // Special case: DM Champ rejects the create because the email is already
    // registered as a user/sub-account in their system. This isn't really a
    // "failure" — the customer already has a DM Champ workspace and just
    // needs to sign in with their existing credentials. We mark the order
    // as `linked` so admin/customer UI can show the right message, and
    // queue a separate email template that does NOT include a temp password.
    const errLower = String(result.error || '').toLowerCase();
    const isEmailInUse =
         errLower.includes('email address is already in use') ||
         errLower.includes('email is already in use') ||
         errLower.includes('already exists') ||
         errLower.includes('user already exists') ||
         result.status === 409;

    if (isEmailInUse) {
      // ----------------------------------------------------------------
      // Email already exists in DM Champ. This is the REPEAT-PURCHASE
      // path: the customer bought before, has a sub-account, and is now
      // buying more. We must NOT create a new sub-account (rejected by
      // DM Champ anyway). Instead, grant additional credits to the
      // existing sub-account so the customer's new purchase translates
      // into more usable capacity.
      //
      // Steps:
      //   1. Look up the existing sub-account by email → get its uid
      //   2. Call grant_credits with the computed creditsToAdd
      //   3. On success: write status='topped_up' on the order with the
      //      grant amount and new total credits if reported.
      //   4. On failure: fall back to the old 'linked' status so the
      //      admin can intervene manually.
      // ----------------------------------------------------------------
      console.log(`[provision-dmchamp] Order ${order.ref}: email already in DM Champ — attempting credit top-up`);

      const lookup = await dmchamp.findSubAccount(cfg, email);
      const existingUid = lookup.ok && lookup.found ? (lookup.data?.uid || null) : null;

      // Call Grant Credits API. The endpoint identifies sub-accounts by email
      // only (per docs at help.dmchamp.com/agency/sub-account-auto-recharge),
      // so the existingUid from lookup is informational only — it's recorded
      // in our DB but not sent in the request body.
      const grantResult = await dmchamp.grantCredits(cfg, {
        email,
        credits: monthlyCredits,
        description: `Deal Pro order ${order.ref}`
      });

      if (grantResult.ok) {
        // Authoritative numbers from DM Champ's response. `credits_added`
        // should equal monthlyCredits but we store what the server actually
        // applied (in case it clamps or adjusts). `new_balance` is the
        // post-grant total — saved for audit and for surfacing in the admin
        // order detail modal. `sub_account_id` from the response is the
        // canonical uid; prefer it over the lookup result.
        const grantedAmount = grantResult.data?.credits_added ?? monthlyCredits;
        const newBalance    = grantResult.data?.new_balance ?? null;
        const grantedUid    = grantResult.data?.sub_account_id || existingUid;

        console.log(`[provision-dmchamp] Order ${order.ref}: granted ${grantedAmount} credits to ${email} (new balance: ${newBalance ?? '?'})`);

        const toppedUpRecord = {
          status:           'topped_up',
          uid:              grantedUid,
          email:            email,
          tempPassword:     null,                   // we never reset existing user's pwd
          monthlyCredits:   monthlyCredits,         // intended amount from credits/USD calc
          creditsGranted:   grantedAmount,          // actually applied by DM Champ
          newBalance:       newBalance,             // post-grant total (null if not reported)
          creditsPerUsd:    cfg.creditsPerUsd,
          usdAmount:        Number.isFinite(usdAmount) ? usdAmount : null,
          createdAt:        now,
          source,
          actorEmail,
          raw:              grantResult.raw || null,
          attempts:         adminLib.firestore.FieldValue.increment(1),
          error:            null,
          httpStatus:       grantResult.status || 200,
          lastAttemptAt:    now
        };
        await orderRef.update({ dmchampSubAccount: toppedUpRecord });

        // Queue a "credits added" email so the customer knows their new
        // purchase added to their existing balance. Reuses the linked
        // template (no temp password to share) and includes the grant amount.
        const emailLang = emailLangFor(order);
        try {
          await db.collection('email_queue').add({
            to:       email,
            kind:     'dmchamp_linked',
            orderRef: order.ref,
            lang:     emailLang,
            status:   'pending',
            payload: {
              ref:       order.ref,
              customer:  order.customer,
              dmchamp: {
                email:           email,
                monthlyCredits:  monthlyCredits,
                creditsGranted:  grantedAmount,
                newBalance:      newBalance,
                toppedUp:        true               // template flag — shows "added N credits" copy
              },
              receiptLang: emailLang
            },
            createdAt: now
          });
          console.log(`[provision-dmchamp] Queued dmchamp_linked (top-up) email for ${email}`);
        } catch (e) {
          console.warn('[provision-dmchamp] Failed to queue top-up email (non-fatal):', e.message);
        }

        // Audit log — success
        try {
          await db.collection('audit_log').add({
            action:         'dmchamp_top_up',
            orderRef:       order.ref,
            customerEmail:  email,
            subAccountUid:  grantedUid,
            creditsGranted: grantedAmount,
            newBalance:     newBalance,
            source,
            actorEmail,
            at:             now
          });
        } catch (e) { /* non-fatal */ }

        return { ok: true, toppedUp: true, data: toppedUpRecord };
      }

      // ---- Top-up failed: fall back to old 'linked' behaviour ----
      // Admin will see the failure reason and can grant credits manually
      // via the DM Champ dashboard, or retry via the Orders detail view.
      console.warn(`[provision-dmchamp] Order ${order.ref}: top-up failed (${grantResult.error}) — recording as linked for manual follow-up`);

      const linkedRecord = {
        status:          'linked',
        uid:             existingUid,
        email:           email,
        tempPassword:    null,
        monthlyCredits:  monthlyCredits,       // intended amount (NOT applied — manual top-up needed)
        creditsGranted:  0,                    // explicit: zero added because grant failed
        creditsPerUsd:   cfg.creditsPerUsd,
        usdAmount:       Number.isFinite(usdAmount) ? usdAmount : null,
        createdAt:       now,
        source,
        actorEmail,
        raw:             grantResult.raw || result.raw || null,
        attempts:        adminLib.firestore.FieldValue.increment(1),
        error:           `Top-up failed: ${grantResult.error}`,
        httpStatus:      grantResult.status || result.status || 0,
        lastAttemptAt:   now
      };
      await orderRef.update({ dmchampSubAccount: linkedRecord });

      // Queue a "linked" email so the customer knows their existing DM Champ
      // account is associated with this purchase. This email does not contain
      // a password (we don't know it and can't reset it remotely).
      const emailLang = emailLangFor(order);
      try {
        await db.collection('email_queue').add({
          to:       email,
          kind:     'dmchamp_linked',
          orderRef: order.ref,
          lang:     emailLang,
          status:   'pending',
          payload: {
            ref:       order.ref,
            customer:  order.customer,
            dmchamp: {
              email:          email,
              monthlyCredits: monthlyCredits,
              toppedUp:       false
            },
            receiptLang: emailLang
          },
          createdAt: now
        });
        console.log(`[provision-dmchamp] Queued dmchamp_linked email for ${email}`);
      } catch (e) {
        console.warn('[provision-dmchamp] Failed to queue linked email (non-fatal):', e.message);
      }

      // Audit log — top-up failure
      try {
        await db.collection('audit_log').add({
          action:        'dmchamp_linked',
          orderRef:      order.ref,
          customerEmail: email,
          source,
          actorEmail,
          at:            now
        });
      } catch (e) { /* non-fatal */ }

      return { ok: true, linked: true, data: linkedRecord };
    }

    // Other errors: real failure path
    console.warn(`[provision-dmchamp] DM Champ create failed for order ${order.ref}: ${result.error}`);
    await orderRef.update({
      'dmchampSubAccount.status':        'failed',
      'dmchampSubAccount.error':         result.error,
      'dmchampSubAccount.httpStatus':    result.status || 0,
      'dmchampSubAccount.lastAttemptAt': now,
      'dmchampSubAccount.attempts':      adminLib.firestore.FieldValue.increment(1),
      'dmchampSubAccount.source':        source,
      'dmchampSubAccount.actorEmail':    actorEmail
    });
    return { ok: false, error: result.error, status: result.status };
  }

  // ---- Success: persist sub-account record on the order ----
  const data = result.data || {};
  const subAccount = {
    status:          'created',
    uid:             data.uid             || null,
    email:           data.email           || email,
    tempPassword:    data.temporary_password || null,
    monthlyCredits:  monthlyCredits,
    creditsPerUsd:   cfg.creditsPerUsd,
    usdAmount:       Number.isFinite(usdAmount) ? usdAmount : null,
    createdAt:       now,
    source,
    actorEmail,
    raw:             data,
    attempts:        adminLib.firestore.FieldValue.increment(1),
    error:           null,
    httpStatus:      result.status || 200,
    lastAttemptAt:   now
  };

  await orderRef.update({ dmchampSubAccount: subAccount });
  console.log(`[provision-dmchamp] Order ${order.ref} provisioned: uid=${subAccount.uid}, credits=${monthlyCredits}`);

  // ---- Queue the DM Champ email ----
  // Normally a brand-new sub-account gets the 'dmchamp_access' template
  // ("your workspace is ready" + temp password). But when the caller sets
  // forceLinkedEmail (the ontheline flow), we instead use the 'dmchamp_linked'
  // template ("linked to this purchase") for EVERY DM Champ email, regardless
  // of whether the customer is new or returning. The sub-account is still
  // created normally and the temp password is still stored on the order — we
  // only swap which email template is queued.
  const emailLang = emailLangFor(order);
  try {
    if (forceLinkedEmail) {
      await db.collection('email_queue').add({
        to:       email,
        kind:     'dmchamp_linked',
        orderRef: order.ref,
        lang:     emailLang,
        status:   'pending',
        payload: {
          ref:       order.ref,
          customer:  order.customer,
          dmchamp: {
            email:          subAccount.email,
            monthlyCredits: subAccount.monthlyCredits,
            creditsGranted: subAccount.monthlyCredits,
            // toppedUp:false → template shows the "linked to this purchase"
            // wording rather than "we added N credits to your balance"
            toppedUp:       false
          },
          receiptLang: emailLang
        },
        createdAt: now
      });
      console.log(`[provision-dmchamp] Queued dmchamp_linked email for ${email} (forceLinkedEmail — new sub-account, ontheline flow)`);
    } else {
      // Standard path (chillpay / direct web): new sub-account gets the
      // dedicated "your DM Champ workspace is ready" email with credentials.
      await db.collection('email_queue').add({
        to:       email,
        kind:     'dmchamp_access',
        orderRef: order.ref,
        lang:     emailLang,
        status:   'pending',
        payload: {
          ref:       order.ref,
          customer:  order.customer,
          dmchamp: {
            uid:           subAccount.uid,
            email:         subAccount.email,
            tempPassword:  subAccount.tempPassword,
            monthlyCredits: subAccount.monthlyCredits
          },
          receiptLang: emailLang
        },
        createdAt: now
      });
      console.log(`[provision-dmchamp] Queued dmchamp_access email for ${email}`);
    }
  } catch (e) {
    console.warn('[provision-dmchamp] Failed to queue DM Champ email (non-fatal):', e.message);
  }

  // ---- Audit log ----
  try {
    await db.collection('audit_log').add({
      action:        'dmchamp_provision',
      orderRef:      order.ref,
      customerEmail: email,
      subAccountUid: subAccount.uid,
      source,
      actorEmail,
      monthlyCredits,
      at:            now
    });
  } catch (e) { /* non-fatal */ }

  return { ok: true, data: subAccount };
}

// ------------------------------------------------------------
// Diagnostic handler (GET) — shows whether DM Champ is configured
// without ever exposing the API key.
// ------------------------------------------------------------
async function handleDiagnostic() {
  let firestoreStatus = 'not-tested';
  try {
    await db.collection('orders').limit(1).get();
    firestoreStatus = 'OK';
  } catch (e) {
    firestoreStatus = `FAILED: ${e.message}`;
  }

  let cfgDescription = null;
  try {
    const cfg = await dmchamp.loadConfig(db);
    cfgDescription = dmchamp.describeConfig(cfg);
  } catch (e) {
    cfgDescription = { error: e.message };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnostic: true,
      message: 'This endpoint creates DM Champ sub-accounts for paid orders. POST with admin Bearer token + { orderRef } or { orderId }.',
      firestore: firestoreStatus,
      dmchamp: cfgDescription,
      endpoint: 'https://deal-pro-ai.netlify.app/.netlify/functions/provision-dmchamp'
    }, null, 2)
  };
}

// ------------------------------------------------------------
// HTTP handler
// ------------------------------------------------------------
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod === 'GET') {
    return handleDiagnostic();
  }
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Method not allowed' });
  }

  // ---- Verify admin caller via Firebase ID token ----
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return jsonResp(401, { error: 'Missing Authorization header' });
  const idToken = m[1];

  let callerUid, callerEmail;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    callerUid   = decoded.uid;
    callerEmail = decoded.email;
  } catch (e) {
    return jsonResp(401, { error: 'Invalid or expired ID token' });
  }

  // ---- Check caller is admin ----
  try {
    const snap = await db.collection('users').doc(callerUid).get();
    const profile = snap.exists ? snap.data() : null;
    if (!profile || profile.role !== 'admin') {
      return jsonResp(403, { error: 'Only admins can trigger DM Champ provisioning' });
    }
  } catch (e) {
    return jsonResp(500, { error: 'Could not verify caller permissions' });
  }

  // ---- Parse body ----
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return jsonResp(400, { error: 'Invalid JSON' }); }

  const orderRefStr = (body.orderRef || '').trim();
  const orderId     = (body.orderId  || '').trim();
  if (!orderRefStr && !orderId) {
    return jsonResp(400, { error: 'orderRef or orderId is required' });
  }

  // ---- Look up the order ----
  let orderDoc = null;
  try {
    if (orderId) {
      const snap = await db.collection('orders').doc(orderId).get();
      if (snap.exists) orderDoc = snap;
    } else {
      const snap = await db.collection('orders')
        .where('ref', '==', orderRefStr)
        .limit(1)
        .get();
      if (!snap.empty) orderDoc = snap.docs[0];
    }
  } catch (e) {
    return jsonResp(500, { error: 'Order lookup failed', detail: e.message });
  }

  if (!orderDoc) {
    return jsonResp(404, { error: 'Order not found' });
  }

  // ---- Provision ----
  const result = await provisionForOrder(
    db,
    admin,
    orderDoc.data(),
    orderDoc.ref,
    { source: 'manual', actorEmail: callerEmail }
  );

  if (!result.ok) {
    return jsonResp(result.disabled ? 409 : 502, {
      ok: false,
      error: result.error,
      httpStatus: result.status || 0
    });
  }

  return jsonResp(200, {
    ok: true,
    alreadyProvisioned: !!result.alreadyProvisioned,
    linked: !!result.linked,
    toppedUp: !!result.toppedUp,
    data: {
      uid:            result.data.uid,
      email:          result.data.email,
      monthlyCredits: result.data.monthlyCredits,
      creditsGranted: result.data.creditsGranted,
      status:         result.data.status
    }
  });
};

// Export the core function so other Netlify Functions can invoke it directly
// (without the HTTP / admin-auth layer).
exports.provisionForOrder = provisionForOrder;
