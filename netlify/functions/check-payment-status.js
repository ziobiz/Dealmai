// ============================================================
// Netlify Function: check-payment-status
// ============================================================
// Asks the payment gateway what actually happened to an order, instead of
// waiting for a callback that may never arrive.
//
// Payment gateways drop webhooks — a misconfigured URL, a provider outage, or
// exhausted retries all leave a customer who genuinely paid stuck on a
// 'pending' order with no account, no credits and no receipt. This endpoint
// closes that gap: it polls the gateway and, if the payment did succeed, runs
// the exact same settlement pipeline the callback would have
// (lib/settle-order.js) — so the customer ends up in the same state either way.
//
// Two modes:
//   POST { orderId }  — check one order (the admin "Check Status" button)
//   POST { sweep:true, minAgeMinutes?, limit? }
//                     — check every pending gateway order older than
//                       minAgeMinutes (default 10). Intended for a scheduled
//                       run so dropped callbacks self-heal without anyone
//                       noticing.
//
// Endpoint:    POST /.netlify/functions/check-payment-status
// Diagnostic:  GET  /.netlify/functions/check-payment-status
// ============================================================

const admin = require('firebase-admin');
const gateways = require('./lib/gateways');
const { settlePaidOrder } = require('./lib/settle-order');
const { provisionForOrder: provisionDmChamp } = require('./provision-dmchamp');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
      })
    });
  } catch (e) {
    console.error('Firebase init failed:', e);
  }
}
const db = admin.firestore();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

/**
 * Check one order against its gateway and settle it if it turns out to be paid.
 * Returns a plain result object (never throws) so the sweep can continue.
 */
async function checkOne(orderRef, order) {
  const result = {
    ref: order.ref,
    orderId: orderRef.id,
    previousStatus: order.status,
    settled: false
  };

  const gatewayId = gateways.gatewayIdForOrder(order);
  const gw = gatewayId ? gateways.getAdapter(gatewayId) : null;
  if (!gw) {
    result.error = `Order has no known payment gateway (gateway=${order.gateway || '-'}, source=${order.source || '-'})`;
    return result;
  }
  result.gateway = gw.id;

  if (typeof gw.checkStatus !== 'function') {
    result.error = `${gw.displayName} does not support status checks`;
    return result;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  let check;
  try {
    check = await gw.checkStatus({
      gatewayRef:     order.gatewayRef || order.chillpayTransactionId || null,
      gatewayOrderNo: order.gatewayOrderNo || order.chillpayOrderNo || null
    });
  } catch (e) {
    result.error = `Status check threw: ${e.message || e}`;
    return result;
  }

  // Always record the attempt — if the checksum formula needs correcting, the
  // request and the provider's reply are both here rather than only in logs.
  await db.collection('payment_events').add({
    kind: 'status-check',
    gateway: gw.id,
    dealProRef: order.ref,
    gatewayOrderNo: order.gatewayOrderNo || order.chillpayOrderNo || null,
    requestParams: check.request || null,
    responseBody: check.raw || null,
    ok: !!check.ok,
    resolvedStatus: check.status || null,
    rawStatus: check.rawStatus || null,
    // Which checksum variants were tried and what the provider said to each —
    // this is how an undocumented signature format gets pinned down.
    checksumAttempts: check.attempts || null,
    // Which identifier + checksum combination the provider finally accepted.
    acceptedCombination: check.winner || null,
    error: check.ok ? null : (check.error || null),
    createdAt: now
  });

  if (!check.ok) {
    result.error = check.error || 'Status check failed';
    result.raw = check.raw || null;
    return result;
  }

  result.gatewayStatus = check.status;
  result.rawStatus = check.rawStatus;

  // Provider-specific values we mirror onto the order, mirroring what the
  // callback would have written.
  const updateData = {
    gateway:         gw.id,
    gatewayRef:      check.gatewayRef || order.gatewayRef || null,
    gatewayStatus:   check.rawStatus,
    gatewayCurrency: check.currency || order.gatewayCurrency || null,
    gatewayData:     check.fields || {},
    gatewayStatusCheckedAt: now
  };

  if (check.status === 'paid') {
    // Guard against a callback landing between the poll and this write.
    const fresh = await orderRef.get();
    if (fresh.data()?.status === 'paid') {
      result.note = 'already settled by callback';
      return result;
    }
    const notes = await settlePaidOrder({
      db, admin,
      order: fresh.data() || order,
      orderRef,
      updateData,
      source: 'status-check',
      provisionDmChamp
    });
    result.settled = true;
    result.newStatus = 'paid';
    Object.assign(result, notes);
    return result;
  }

  if (check.status === 'failed') {
    await orderRef.update({ ...updateData, status: 'failed', updatedAt: now });
    result.newStatus = 'failed';
    return result;
  }

  // Still pending at the gateway — record what we learned and leave it alone.
  await orderRef.update({ ...updateData, updatedAt: now });
  result.newStatus = order.status;
  result.note = 'still pending at the gateway';
  return result;
}

// ------------------------------------------------------------
// Diagnostic (GET)
// ------------------------------------------------------------
async function handleDiagnostic() {
  let pendingCount = null;
  try {
    const snap = await db.collection('orders').where('status', '==', 'pending').get();
    pendingCount = snap.size;
  } catch (e) {
    pendingCount = `error: ${e.message}`;
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnostic: true,
      message: 'POST { orderId } to check one order, { transactionId } for a read-only probe against the gateway, or { sweep: true } to check all stale pending orders.',
      pendingOrders: pendingCount,
      gatewaysSupportingStatusCheck: gateways.listGatewayIds()
        .filter(id => typeof gateways.getAdapter(id).checkStatus === 'function')
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

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch {}

  try {
    // ---- Raw probe: check a transaction id directly, no order involved ----
    // Diagnostic tool. When the status API answers with a rejection shell it is
    // impossible to tell "our request is malformed" from "that transaction was
    // never paid" — this lets you point the exact same call at a transaction
    // you KNOW succeeded and compare. Read-only: nothing is written or settled.
    if (payload.transactionId) {
      const gwId = payload.gateway || await gateways.getActiveGatewayId(db);
      const gw = gateways.getAdapter(gwId);
      if (!gw || typeof gw.checkStatus !== 'function') {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Gateway "${gwId}" cannot check status` }) };
      }
      const check = await gw.checkStatus({ gatewayRef: String(payload.transactionId), gatewayOrderNo: null });
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: !!check.ok,
          probe: true,
          gateway: gwId,
          transactionId: String(payload.transactionId),
          resolvedStatus: check.status || null,
          rawStatus: check.rawStatus ?? null,
          error: check.error || null,
          attempts: check.attempts || null,
          request: check.request || null,
          response: check.raw || null
        }, null, 2)
      };
    }

    // ---- Single order ----
    if (payload.orderId) {
      const orderRef = db.collection('orders').doc(payload.orderId);
      const snap = await orderRef.get();
      if (!snap.exists) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Order not found' }) };
      }
      const result = await checkOne(orderRef, snap.data());
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: !result.error, result }) };
    }

    // ---- Sweep ----
    if (payload.sweep) {
      const minAge = Number.isFinite(Number(payload.minAgeMinutes)) ? Number(payload.minAgeMinutes) : 10;
      const limit  = Number.isFinite(Number(payload.limit)) ? Number(payload.limit) : 25;
      const cutoff = Date.now() - minAge * 60 * 1000;

      const snap = await db.collection('orders').where('status', '==', 'pending').get();
      const candidates = snap.docs.filter(d => {
        const o = d.data();
        // Only gateway-settled orders can be polled.
        if (!gateways.gatewayIdForOrder(o)) return false;
        const c = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return c && !isNaN(c.getTime()) && c.getTime() < cutoff;
      }).slice(0, limit);

      console.log(`[check-payment-status] sweep: ${candidates.length} pending order(s) older than ${minAge}m`);

      const results = [];
      for (const d of candidates) {
        results.push(await checkOne(d.ref, d.data()));
      }
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          checked: results.length,
          settled: results.filter(r => r.settled).length,
          results
        })
      };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Provide { orderId }, { transactionId } for a read-only probe, or { sweep: true }' }) };

  } catch (e) {
    console.error('[check-payment-status] error:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Internal error', detail: String(e.message || e) }) };
  }
};
