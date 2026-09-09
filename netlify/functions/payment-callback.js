// ============================================================
// Netlify Function: payment-callback  (gateway-agnostic)
// ============================================================
// Receives the server-to-server callback that a payment gateway sends when a
// payment's status changes. This is the SOURCE OF TRUTH for payment status —
// the browser redirect back to /payment-result is only for showing the buyer
// a confirmation page.
//
// Flow:
//   1. Pick the adapter (?gw=<id>, else the active gateway)
//   2. adapter.parseBody()      → params
//   3. adapter.verifyCallback() → reject forgeries
//   4. Find the order by gatewayOrderNo
//   5. RE-RESOLVE the adapter from the ORDER's own `gateway` field and, if it
//      differs, re-verify with that gateway's credentials (see note below)
//   6. adapter.parseCallback()  → neutral { status, fields }
//   7. Update the order, compute expiry, provision the user + DM Champ,
//      queue emails — all provider-independent
//
// Everything except steps 2/3/6 is shared by every gateway.
//
// Endpoint:    POST /.netlify/functions/payment-callback?gw=<id>
// Diagnostic:  GET  /.netlify/functions/payment-callback
//
// Register that URL (with the ?gw= for the provider) in the gateway's
// merchant dashboard as the background / webhook URL.
// ============================================================

const { admin, db } = require('./lib/firebase-admin-app');
const gateways = require('./lib/gateways');
const { settlePaidOrder } = require('./lib/settle-order');
const { provisionForOrder: provisionDmChamp } = require('./provision-dmchamp');

// ------------------------------------------------------------
// Diagnostic (GET)
// ------------------------------------------------------------
async function handleDiagnostic(event) {
  let firestoreStatus = 'not-tested';
  try {
    await db.collection('orders').limit(1).get();
    firestoreStatus = 'OK';
  } catch (e) {
    firestoreStatus = `FAILED: ${e.message}`;
  }
  const activeId = await gateways.getActiveGatewayId(db);
  const base = process.env.PUBLIC_SITE_URL || `https://${event.headers?.host || 'your-site'}`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnostic: true,
      message: 'This endpoint receives POST callbacks from the payment gateway. Register the URL below in the provider dashboard.',
      activeGateway: activeId,
      // Path form (no query string) — some providers refuse webhook URLs
      // containing '?', so this is the form to register.
      callbackUrls: gateways.listGatewayIds().reduce((acc, id) => {
        acc[id] = `${base}/.netlify/functions/payment-callback/${id}`;
        return acc;
      }, {}),
      gateways: gateways.describeAll(),
      firestore: firestoreStatus
    }, null, 2)
  };
}

// ------------------------------------------------------------
// Main handler
// ------------------------------------------------------------
exports.handler = async (event) => {
  if (event.httpMethod === 'GET') return handleDiagnostic(event);
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const now = admin.firestore.FieldValue.serverTimestamp();

  // ---- Which gateway is this callback from? ----
  // The ?gw= query param is authoritative (it's baked into the URL registered
  // with each provider). Without it we assume the active gateway, which keeps
  // legacy URLs working.
  // ---- Which gateway is this callback from? ----
  // Resolved in priority order:
  //   1. A trailing path segment — /.netlify/functions/payment-callback/chillpay
  //   2. The ?gw= query parameter
  //   3. The currently active gateway (legacy URLs with neither)
  //
  // The PATH form exists because several payment providers (ChillPay among
  // them) will not call a webhook URL that contains a query string — they
  // silently never deliver, leaving the transaction marked "Pending" on their
  // side with no request ever reaching us. A path segment carries the same
  // information without a '?', so it is the form we advertise in the admin UI.
  const pathGw = (() => {
    const p = event.path || event.rawUrl || "";
    const m = String(p).match(/\/payment-callback\/([A-Za-z0-9_-]+)\/?$/);
    return m ? m[1].toLowerCase() : null;
  })();
  const qsGw = (event.queryStringParameters && event.queryStringParameters.gw) || null;
  let gatewayId = pathGw || qsGw || await gateways.getActiveGatewayId(db);
  let gw = gateways.getAdapter(gatewayId);
  if (!gw) {
    console.error(`[payment-callback] unknown gateway "${gatewayId}"`);
    return { statusCode: 400, body: 'Unknown gateway' };
  }

  const params = gw.parseBody(event.body || '', event.headers || {});

  console.log(`[payment-callback] gateway=${gw.id} params: ${Object.keys(params).join(', ')}`);

  // Log every callback — even unverified ones — so forged/failed attempts
  // leave evidence.
  const auditEntry = {
    kind: 'callback',
    gateway: gw.id,
    receivedAt: now,
    rawParams: params,
    headers: {
      'user-agent':      event.headers['user-agent'] || null,
      'x-forwarded-for': event.headers['x-forwarded-for'] || null,
      'content-type':    event.headers['content-type'] || null
    },
    verified: false,
    matched:  false
  };

  try {
    // ---- Verify authenticity ----
    let verdict = gw.verifyCallback({ params, headers: event.headers || {}, rawBody: event.body || '' });
    if (!verdict.ok) {
      console.warn(`[payment-callback] ${gw.id} verification failed: ${verdict.reason}`);
      auditEntry.error = verdict.reason || 'verification failed';
      if (verdict.received) auditEntry.receivedChecksum = verdict.received;
      if (verdict.computed) auditEntry.computedChecksum = verdict.computed;
      await db.collection('payment_events').add(auditEntry);
      return { statusCode: 401, body: 'Invalid signature' };
    }
    auditEntry.verified = true;

    // ---- Find the order ----
    const parsed = gw.parseCallback(params);
    const orderNo = parsed.gatewayOrderNo;
    if (!orderNo) {
      auditEntry.error = 'No gateway order number in callback';
      await db.collection('payment_events').add(auditEntry);
      return { statusCode: 400, body: 'Order number required' };
    }

    // Look up by the neutral field first, then the legacy ChillPay field so
    // orders created before this refactor still resolve.
    let orderSnap = await db.collection('orders')
      .where('gatewayOrderNo', '==', orderNo).limit(1).get();
    if (orderSnap.empty) {
      orderSnap = await db.collection('orders')
        .where('chillpayOrderNo', '==', orderNo).limit(1).get();
    }

    if (orderSnap.empty) {
      auditEntry.error = `No order found for orderNo=${orderNo}`;
      await db.collection('payment_events').add(auditEntry);
      console.warn(`[payment-callback] no order for orderNo=${orderNo}`);
      // 200 so the provider doesn't retry forever on an unknown order
      return { statusCode: 200, body: 'OK (no matching order)' };
    }

    const orderRef = orderSnap.docs[0].ref;
    const order = orderSnap.docs[0].data();
    auditEntry.matched = true;
    auditEntry.dealProRef = order.ref;

    // ---- Settle with the gateway the ORDER was created under ----
    // If an admin switched providers while this buyer was on the payment page,
    // the callback still belongs to the original gateway. Re-resolve from the
    // order and re-verify with THAT gateway's credentials, otherwise a real
    // payment would be rejected as a bad signature.
    const orderGatewayId = gateways.gatewayIdForOrder(order);
    if (orderGatewayId && orderGatewayId !== gw.id) {
      const orderGw = gateways.getAdapter(orderGatewayId);
      if (orderGw) {
        console.log(`[payment-callback] order ${order.ref} belongs to "${orderGatewayId}" (callback arrived as "${gw.id}") — re-verifying`);
        const reParams = orderGw.parseBody(event.body || '', event.headers || {});
        const reVerdict = orderGw.verifyCallback({ params: reParams, headers: event.headers || {}, rawBody: event.body || '' });
        if (!reVerdict.ok) {
          auditEntry.error = `verification failed under order gateway ${orderGatewayId}: ${reVerdict.reason}`;
          await db.collection('payment_events').add(auditEntry);
          return { statusCode: 401, body: 'Invalid signature' };
        }
        gw = orderGw;
        gatewayId = orderGatewayId;
        auditEntry.gateway = orderGatewayId;
        auditEntry.note = `re-resolved from order (callback said ${pathGw || qsGw || 'active'})`;
      }
    }

    const info = gw.parseCallback(gw.parseBody(event.body || '', event.headers || {}));
    const isPaid = info.status === 'paid';
    const newStatus = isPaid ? 'paid' : 'failed';
    console.log(`[payment-callback] ${gw.id} rawStatus="${info.rawStatus}" → "${newStatus}"`);

    // ---- Idempotency ----
    if (order.status === 'paid') {
      console.log(`[payment-callback] order ${order.ref} already paid — skipping`);
      auditEntry.note = 'already-paid (idempotent)';
      auditEntry.finalStatus = 'paid';
      await db.collection('payment_events').add(auditEntry);
      return { statusCode: 200, body: 'OK (already processed)' };
    }

    // ---- Apply the outcome ----
    // Provider-specific values go under gatewayData verbatim — this layer
    // never interprets them, it just preserves them for auditing.
    const updateData = {
      gateway:         gw.id,
      gatewayRef:      info.gatewayRef || order.gatewayRef || null,
      gatewayStatus:   info.rawStatus,
      gatewayCurrency: info.currency || order.gatewayCurrency || null,
      gatewayData:     info.fields || {},
      gatewayRawCallback: params
    };

    // Legacy mirror so existing admin views keep rendering during the
    // transition. Safe to delete once nothing reads chillpay* names.
    if (gw.id === 'chillpay') {
      const f = info.fields || {};
      Object.assign(updateData, {
        chillpayTransactionId:      f.transactionId || order.chillpayTransactionId || null,
        chillpayBankRefCode:        f.bankRefCode || null,
        chillpayBankCode:           f.bankCode || null,
        chillpayPaymentDate:        f.paymentDate || null,
        chillpayPaymentStatus:      info.rawStatus,
        chillpayCurrentDate:        f.currentDate || null,
        chillpayCurrentTime:        f.currentTime || null,
        chillpayPaymentDescription: f.paymentDescription || null,
        chillpayCreditCardToken:    f.creditCardToken || null,
        chillpayCurrency:           info.currency || order.chillpayCurrency || null,
        chillpayCustomerName:       f.customerName || null,
        chillpayChannelCode:        f.channelCode || order.paymentChannel || null,
        chillpayRawCallback:        params
      });
    }

    if (isPaid) {
      // Everything that must happen for a successful payment — expiry, order
      // update, Auth provisioning, emails, DM Champ — lives in one shared
      // module so the status-check path (check-payment-status.js) settles an
      // order identically when a callback never arrives.
      const notes = await settlePaidOrder({
        db, admin, order, orderRef, updateData,
        source: 'callback',
        provisionDmChamp
      });
      Object.assign(auditEntry, notes);
    } else {
      await orderRef.update({ ...updateData, status: newStatus, paidAt: null, updatedAt: now });
      console.log(`[payment-callback] order ${order.ref} → ${newStatus}`);
    }

    auditEntry.finalStatus = newStatus;
    await db.collection('payment_events').add(auditEntry);

    // Providers expect a quick 200
    return { statusCode: 200, body: 'OK' };

  } catch (e) {
    console.error('[payment-callback] processing error:', e);
    auditEntry.error = String(e.message || e);
    try { await db.collection('payment_events').add(auditEntry); } catch {}
    // 500 → provider retries within its retry policy
    return { statusCode: 500, body: 'Internal error' };
  }
};
