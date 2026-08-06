// ============================================================
// Netlify Function: chillpay-callback  (COMPATIBILITY WRAPPER)
// ============================================================
// Callback handling is now gateway-agnostic and lives in payment-callback.js,
// with ChillPay implemented as one adapter under lib/gateways/.
//
// This URL is already registered in the ChillPay merchant dashboard as the
// "URL Background", so it must keep working. We force gw=chillpay and delegate
// — that way ChillPay callbacks are always verified with ChillPay credentials
// even after an admin switches the ACTIVE gateway to another provider.
//
// New providers should be pointed at:
//   /.netlify/functions/payment-callback?gw=<id>
// ============================================================

const { handler: genericHandler } = require('./payment-callback');

exports.handler = async (event) => {
  return genericHandler({
    ...event,
    queryStringParameters: { ...(event.queryStringParameters || {}), gw: 'chillpay' }
  });
};
