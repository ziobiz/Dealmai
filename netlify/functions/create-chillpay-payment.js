// ============================================================
// Netlify Function: create-chillpay-payment  (COMPATIBILITY WRAPPER)
// ============================================================
// Payment creation is now gateway-agnostic and lives in create-payment.js,
// with ChillPay implemented as one adapter under lib/gateways/.
//
// This file remains only so that:
//   • any cached/older frontend still calling /api/create-chillpay-payment
//     keeps working,
//   • bookmarked diagnostic URLs keep resolving.
//
// It simply delegates to the generic handler. New code should call
// /.netlify/functions/create-payment instead.
// ============================================================

const { handler } = require('./create-payment');

exports.handler = handler;
