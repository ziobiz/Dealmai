// ============================================================
// Payment Gateway Registry
// ============================================================
// Central place that knows which payment providers exist. The generic payment
// functions (create-payment.js / payment-callback.js) resolve an adapter from
// here and then speak only the shared contract below — they contain no
// provider-specific code.
//
// ── Adding a new gateway ──────────────────────────────────────
//   1. Create ./<name>.js implementing the contract (see chillpay.js).
//   2. Register it in ADAPTERS below.
//   3. Set its env vars in Netlify.
//   4. Select it in Admin → Payment Gateway (writes config/payment).
//   5. Register the callback URL with the provider:
//        https://<site>/.netlify/functions/payment-callback?gw=<id>
//   No business logic changes are required.
//
// ── The contract ──────────────────────────────────────────────
//   id, displayName, currency, minAmount, refPrefix, channels[]
//   validateConfig()                → { ok, missing[] }
//   describe()                      → non-secret diagnostics
//   async convertAmount(totalUsd)   → { amount, rate, source }
//   async createPayment({ customer, items, amount, channel, headers })
//                                   → { ok, paymentUrl, gatewayOrderNo, ... }
//   parseBody(rawBody, headers)     → params object
//   verifyCallback({ params, headers, rawBody })  → { ok, reason? }
//   parseCallback(params)           → { gatewayOrderNo, status, rawStatus,
//                                       gatewayRef, currency, fields }
//
// NOTE: credentials live in environment variables ONLY, never in Firestore —
// the frontend can read Firestore, so secrets must stay server-side. Firestore
// holds just the *selection* of which gateway is active.
// ============================================================

const chillpayAdapter = require('./chillpay');
const icopayAdapter = require('./icopay');

const ADAPTERS = {
  chillpay: chillpayAdapter,
  icopay: icopayAdapter
};

// Used when config/payment is missing (e.g. before an admin ever saved it).
const DEFAULT_GATEWAY_ID = 'chillpay';

/** Default selectable checkout channels when config has none saved. */
const DEFAULT_ENABLED_CHANNELS = ['creditcard'];

/**
 * Look up an adapter by id. Returns null for unknown ids so callers can
 * produce a clear error rather than crashing.
 */
function getAdapter(id) {
  if (!id) return null;
  return ADAPTERS[String(id).toLowerCase()] || null;
}

/** All registered gateway ids. */
function listGatewayIds() {
  return Object.keys(ADAPTERS);
}

/** Non-secret summary of every registered gateway (for the admin panel). */
function describeAll() {
  return listGatewayIds().map(id => {
    const a = ADAPTERS[id];
    const cfg = a.validateConfig();
    return {
      ...a.describe(),
      configured: cfg.ok,
      missingEnv: cfg.missing,
      channels: a.channels
    };
  });
}

/**
 * Which gateway should NEW payments use?
 * Reads config/payment.activeGateway, falling back to the default if the doc
 * is missing or names a gateway that isn't registered.
 *
 * Kept as a function (rather than a constant) so switching providers in the
 * admin UI takes effect without a redeploy.
 */
async function getPaymentConfig(db) {
  try {
    const snap = await db.collection('config').doc('payment').get();
    return snap.exists ? snap.data() || {} : {};
  } catch (e) {
    console.warn('[gateways] could not read config/payment:', e.message || e);
    return {};
  }
}

async function getActiveGatewayId(db) {
  const data = await getPaymentConfig(db);
  const id = data.activeGateway || null;
  if (id && ADAPTERS[String(id).toLowerCase()]) return String(id).toLowerCase();
  if (id) {
    console.warn(
      `[gateways] config/payment.activeGateway="${id}" is not registered — falling back to ${DEFAULT_GATEWAY_ID}`
    );
  }
  return DEFAULT_GATEWAY_ID;
}

/**
 * Channels shoppers may select on checkout.
 * Intersection of admin-enabled codes and the active gateway catalog.
 * Always returns at least one code when the gateway has channels (falls back
 * to creditcard / first catalog entry).
 */
async function getEnabledChannels(db, gatewayId) {
  const gwId = gatewayId || (await getActiveGatewayId(db));
  const adapter = getAdapter(gwId);
  const catalog = (adapter && adapter.channels) || [];
  const catalogCodes = catalog.map((c) => c.code);

  const data = await getPaymentConfig(db);
  let enabled = Array.isArray(data.enabledChannels)
    ? data.enabledChannels.map((c) => String(c || '').trim()).filter(Boolean)
    : DEFAULT_ENABLED_CHANNELS.slice();

  enabled = enabled.filter((c) => catalogCodes.includes(c));
  if (!enabled.length) {
    if (catalogCodes.includes('creditcard')) enabled = ['creditcard'];
    else if (catalogCodes.length) enabled = [catalogCodes[0]];
  }
  return enabled;
}

/**
 * Which gateway settles a given order?
 *
 * CRITICAL: always resolve from the order itself, never from the currently
 * active gateway. A payment started under gateway A must be completed by
 * gateway A even if an admin switched to B while the buyer was on the payment
 * page — otherwise the callback would be verified with the wrong credentials
 * and a real payment would be dropped.
 *
 * Falls back to legacy orders written before the `gateway` field existed
 * (those were all ChillPay, marked source:'chillpay').
 */
function gatewayIdForOrder(order) {
  if (!order) return null;
  if (order.gateway) return String(order.gateway).toLowerCase();
  if (order.paymentMethod && ADAPTERS[String(order.paymentMethod).toLowerCase()]) {
    return String(order.paymentMethod).toLowerCase();
  }
  if (order.source === 'chillpay' || order.chillpayOrderNo) return 'chillpay';
  return null;
}

module.exports = {
  ADAPTERS,
  DEFAULT_GATEWAY_ID,
  DEFAULT_ENABLED_CHANNELS,
  getAdapter,
  listGatewayIds,
  describeAll,
  getPaymentConfig,
  getActiveGatewayId,
  getEnabledChannels,
  gatewayIdForOrder
};
