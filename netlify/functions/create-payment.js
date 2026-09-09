// ============================================================
// Netlify Function: create-payment  (gateway-agnostic)
// ============================================================
// Called by the checkout page when the buyer clicks "Confirm & Pay".
//   1. Validates the payload
//   2. Resolves the ACTIVE payment gateway (config/payment.activeGateway)
//   3. Converts USD → the gateway's settlement currency
//   4. Writes a pending order to Firestore BEFORE calling the provider
//   5. Asks the gateway adapter to create a hosted payment
//   6. Returns { paymentUrl } for the frontend to redirect to
//
// Steps 1–4 and 6 are identical for every provider; only step 5 is delegated.
// Adding a gateway therefore means adding lib/gateways/<id>.js — this file
// does not change.
//
// Endpoint:    POST /.netlify/functions/create-payment
// Diagnostic:  GET  /.netlify/functions/create-payment
//              (env + config status for every registered gateway)
//
// Required ENV: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//               plus whatever the active gateway needs (e.g. CHILLPAY_*).
// ============================================================

const { admin, db } = require('./lib/firebase-admin-app');
const gateways = require('./lib/gateways');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

// ------------------------------------------------------------
// Internal Deal Pro order reference: DP-<prefix>-XXXXXX
// (matches the existing DP-DR-* / DP-OT-* convention)
// ------------------------------------------------------------
function generateRef(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return `DP-${prefix || 'PG'}-${r}`;
}

// ------------------------------------------------------------
// Diagnostic (GET) — shows the active gateway and the config state of every
// registered one, without leaking any secret values.
// ------------------------------------------------------------
async function handleDiagnostic() {
  let firestoreStatus = 'not-tested';
  try {
    await db.collection('packages').limit(1).get();
    firestoreStatus = 'OK';
  } catch (e) {
    firestoreStatus = `FAILED: ${e.message}`;
  }

  const activeId = await gateways.getActiveGatewayId(db);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnostic: true,
      message: 'Send POST with payment details to actually create a payment.',
      activeGateway: activeId,
      registeredGateways: gateways.listGatewayIds(),
      gateways: gateways.describeAll(),
      firebase: {
        FIREBASE_PROJECT_ID:   process.env.FIREBASE_PROJECT_ID || '(NOT SET)',
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'set' : '(NOT SET)',
        FIREBASE_PRIVATE_KEY:  process.env.FIREBASE_PRIVATE_KEY ? `set (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : '(NOT SET)'
      },
      firestore: firestoreStatus,
      publicSiteUrl: process.env.PUBLIC_SITE_URL || '(NOT SET — using request origin)'
    }, null, 2)
  };
}

// ------------------------------------------------------------
// Main handler
// ------------------------------------------------------------
exports.handler = async (event) => {
  if (event.httpMethod === 'GET') return handleDiagnostic();

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // ---- Parse payload ----
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const {
    customer,        // { name, email, country, company?, taxId?, phone? }
    items,           // [{ id, title, price, manual? }, ...]  prices in USD
    subtotalUsd,
    vatUsd,
    totalUsd,
    receiptLang,     // "en" | "th" | "ko" | "ja"
    channel,         // optional gateway channel code; empty = show all
    termsAcceptedAt  // ISO timestamp captured at the consent checkbox
  } = payload;

  // ---- Validate required fields ----
  if (!customer?.email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'customer.email is required' }) };
  if (!customer?.name)  return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'customer.name is required' }) };
  if (!Array.isArray(items) || items.length === 0)
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'items array is required' }) };
  if (!Number.isFinite(totalUsd) || totalUsd <= 0)
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'totalUsd must be > 0' }) };

  try {
    // ---- Resolve the active gateway ----
    const gatewayId = await gateways.getActiveGatewayId(db);
    const gw = gateways.getAdapter(gatewayId);
    if (!gw) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: `Unknown payment gateway "${gatewayId}"` }) };
    }

    const cfg = gw.validateConfig();
    if (!cfg.ok) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: `Payment gateway "${gw.displayName}" is not configured. Missing: ${cfg.missing.join(', ')}` })
      };
    }

    // ---- Convert USD → the gateway's settlement currency ----
    const fx = await gw.convertAmount(totalUsd);
    if (fx.amount < (gw.minAmount || 0)) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: `Total is below the ${gw.displayName} minimum (≥ ${gw.minAmount} ${gw.currency})` })
      };
    }

    const ref = generateRef(gw.refPrefix);
    const now = admin.firestore.FieldValue.serverTimestamp();

    // ---- Ask the gateway to create the payment ----
    const result = await gw.createPayment({
      customer,
      items,
      amount:   fx.amount,
      currency: gw.currency,
      channel,
      ref,
      headers:  event.headers || {}
    });

    // ---- Write the pending order ----
    // Written after createPayment so we can store the gateway's order number in
    // one go, but the audit event below records the attempt either way.
    //
    // `gateway` is what payment-callback.js uses to pick the right adapter —
    // it must never be re-derived from the currently active gateway.
    const orderDoc = {
      ref,
      source:  'direct',                 // direct web sale (vs 'ontheline')
      gateway: gw.id,                    // ← settles this order, even after a switch
      status:  'pending',                // pending → paid | failed | cancelled
      paymentMethod:  gw.id,             // kept for backwards compatibility
      paymentChannel: channel || 'select-on-page',
      customer: {
        name:    customer.name,
        email:   customer.email,
        country: customer.country || '',
        company: customer.company || '',
        taxId:   customer.taxId   || '',
        phone:   customer.phone   || ''
      },
      items,
      subtotal: Number(subtotalUsd) || 0,
      vat:      Number(vatUsd) || 0,
      total:    Number(totalUsd),
      currency: 'USD',
      // Gateway-neutral settlement fields
      gatewayOrderNo:  result.gatewayOrderNo || null,
      gatewayAmount:   fx.amount,
      gatewayCurrency: gw.currency,
      gatewayRef:      result.gatewayRef || null,
      gatewayPaymentUrl: result.ok ? result.paymentUrl : null,
      gatewayExpiresAt:  result.expiresAt || null,
      fxRate:      fx.rate,
      fxSource:    fx.source,
      receiptLang: receiptLang || 'en',
      termsAcceptedAt: termsAcceptedAt || null,
      createdAt: now
    };

    // Legacy mirror: older admin views + any historical query still look for
    // chillpay* fields. Harmless duplication that keeps the UI working during
    // the transition; drop it once nothing reads those names.
    if (gw.id === 'chillpay') {
      orderDoc.chillpayOrderNo  = result.gatewayOrderNo || null;
      orderDoc.chillpayAmount   = fx.amount;
      orderDoc.chillpayCurrency = gw.currency;
      if (result.ok) {
        orderDoc.chillpayTransactionId = result.gatewayRef || null;
        orderDoc.chillpayToken         = result.token || null;
        orderDoc.chillpayPaymentUrl    = result.paymentUrl;
        orderDoc.chillpayCreatedDate   = result.createdDate || null;
        orderDoc.chillpayExpiredDate   = result.expiresAt || null;
      }
    }

    await db.collection('orders').add(orderDoc);

    // ---- Audit the attempt ----
    await db.collection('payment_events').add({
      kind: 'create-payment',
      gateway: gw.id,
      dealProRef: ref,
      gatewayOrderNo: result.gatewayOrderNo || null,
      requestParams: result.request || null,
      responseStatus: result.httpStatus ?? null,
      responseBody: result.raw || null,
      ok: !!result.ok,
      createdAt: now
    });

    if (!result.ok) {
      console.error(`[create-payment] ${gw.id} rejected:`, result.error);
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({
          error: result.error || 'Payment gateway rejected the request',
          gateway: gw.id,
          gatewayCode: result.code ?? null,
          gatewayStatus: result.status ?? null,
          orderRef: ref
        })
      };
    }

    console.log(`[create-payment] ${gw.id} ok — ref=${ref} orderNo=${result.gatewayOrderNo} ${fx.amount} ${gw.currency} (rate=${fx.rate})`);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        gateway:       gw.id,
        orderRef:      ref,
        paymentUrl:    result.paymentUrl,
        transactionId: result.gatewayRef,
        expiredDate:   result.expiresAt
      })
    };

  } catch (e) {
    console.error('[create-payment] error:', e);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Internal error', detail: String(e.message || e) })
    };
  }
};
