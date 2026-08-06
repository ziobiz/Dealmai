// ============================================================
// convert-currency — public helper endpoint
// ============================================================
// Lets the frontend (Admin → Simulate ontheline webhook) convert an amount
// to USD using the SAME conversion logic + Free Currency API key as the real
// webhook, without exposing FREECURRENCY_API_KEY to the browser.
//
//   GET /api/convert-currency?amount=3550&currency=THB
//   → { ok:true, amount:3550, currency:"THB", usd:100.00, rate:35.5, source:"freecurrencyapi.com" }
//
// The heavy lifting lives in ./lib/currency-convert (shared with the webhook),
// so the rate source, caching, and fallbacks all behave identically.
// ============================================================

const { convertToUsd } = require('./lib/currency-convert');

exports.handler = async (event) => {
  // CORS / preflight (same-origin in practice, but harmless to allow)
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  const params = event.queryStringParameters || {};
  const amount = Number(params.amount);
  const currency = (params.currency || 'USD').toString().trim().toUpperCase();

  if (!Number.isFinite(amount) || amount < 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid amount' }) };
  }

  try {
    const { usd, rate, source } = await convertToUsd(amount, currency);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, amount, currency, usd, rate, source })
    };
  } catch (e) {
    console.error('[convert-currency] failed:', e.message || e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message || 'Conversion failed' })
    };
  }
};
