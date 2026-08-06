// ============================================================
// Netlify Function: payment-result
// ============================================================
// Purpose
//   ChillPay's "URL Result" redirects the customer's browser back to our
//   site via HTTP POST (with form-urlencoded body containing OrderNo,
//   TransactionId, PaymentStatus, etc per docs Table 3.2). Static Netlify
//   hosting cannot serve static HTML via POST — those requests get a 404.
//
//   This function accepts the POST from ChillPay, parses the form body,
//   and issues a 303 See Other redirect to /payment-result?... so the
//   browser then issues a GET that the SPA can render normally.
//
// Wiring
//   In _redirects:
//     /payment-result   /.netlify/functions/payment-result   200!
//
//   The force flag (!) is required so POST hits the function BEFORE any
//   static-file lookup or SPA catch-all rule. (The catch-all is GET-only
//   and would 404 the POST.)
//
//   The function detects method:
//     - POST  → parse body, redirect to GET with same params as query string
//     - GET   → just redirect to /index.html (so SPA can render)
//
// The 303 See Other status is required (not 302) per HTTP spec:
//   "the response to the request can be found under another URI using a GET method"
// This guarantees the browser switches POST → GET on redirect.
// ============================================================

exports.handler = async (event) => {
  const method = (event.httpMethod || 'GET').toUpperCase();
  console.log(`[payment-result] method=${method} path=${event.path}`);

  let queryString = '';

  if (method === 'POST') {
    // ChillPay sends application/x-www-form-urlencoded body
    const raw = event.body || '';
    const isBase64 = event.isBase64Encoded;
    const bodyStr = isBase64 ? Buffer.from(raw, 'base64').toString('utf8') : raw;

    console.log(`[payment-result] POST body: ${bodyStr}`);

    // Parse form body into URLSearchParams (handles URL encoding correctly)
    try {
      const params = new URLSearchParams(bodyStr);
      // Strip empty values for cleaner URL (but keep all keys present)
      queryString = params.toString();
    } catch (e) {
      console.warn(`[payment-result] Failed to parse POST body: ${e.message}`);
      queryString = '';
    }

    // Also merge any existing query string (rare, but safe)
    if (event.queryStringParameters) {
      const existing = new URLSearchParams(event.queryStringParameters).toString();
      if (existing) {
        queryString = queryString ? `${queryString}&${existing}` : existing;
      }
    }
  } else {
    // GET — preserve any existing query string
    if (event.queryStringParameters) {
      queryString = new URLSearchParams(event.queryStringParameters).toString();
    }
  }

  // Redirect to /index.html with query string. Using 303 forces GET on the
  // follow-up request, which is required when redirecting from POST to a
  // resource that should be fetched.
  const target = queryString
    ? `/index.html?${queryString}#payment-result`
    : `/index.html#payment-result`;

  return {
    statusCode: 303,
    headers: {
      Location: target,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
    body: '',
  };
};
