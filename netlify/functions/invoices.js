// ============================================================
// Netlify Function: invoices
// ============================================================
// Admin proxy to Invoice Service (invoice.icopay.net) — same pattern as
// TINPASS/Crypto /api/invoices. API key stays server-side.
//
// GET  /api/invoices              → list (query: from, to, limit, kind)
// GET  /api/invoices/:id/pdf     → PDF download
//
// Headers: Authorization: Bearer <firebase-id-token-of-admin>
// Env: INVOICE_BASE_URL, INVOICE_API_KEY
// ============================================================

const { admin, db } = require('./lib/firebase-admin-app');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function invoiceEnv() {
  const baseUrl = String(process.env.INVOICE_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const apiKey = String(process.env.INVOICE_API_KEY || '').trim();
  if (!baseUrl || !apiKey) {
    return null;
  }
  return { baseUrl, apiKey };
}

async function requireAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    const err = new Error('Missing Authorization header');
    err.status = 401;
    throw err;
  }
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    const err = new Error('Invalid or expired ID token');
    err.status = 401;
    throw err;
  }
  const snap = await db.collection('users').doc(decoded.uid).get();
  const profile = snap.exists ? snap.data() : null;
  if (!profile || profile.role !== 'admin') {
    const err = new Error('Only admins can view invoices');
    err.status = 403;
    throw err;
  }
  return decoded;
}

/** Extract /:id/pdf from path variants (redirect splat or direct function URL) */
function parsePdfId(path) {
  const p = String(path || '');
  // /.netlify/functions/invoices/<id>/pdf  OR  /api/invoices/<id>/pdf
  // after splat redirect path may be /.netlify/functions/invoices/<id>/pdf
  // or just /<id>/pdf depending on platform
  let m = p.match(/\/invoices\/([^/]+)\/pdf\/?$/i);
  if (m) return decodeURIComponent(m[1]);
  m = p.match(/\/functions\/invoices\/([^/]+)\/pdf\/?$/i);
  if (m) return decodeURIComponent(m[1]);
  // splat-only: /uuid/pdf
  m = p.match(/\/([0-9a-f-]{36})\/pdf\/?$/i);
  if (m) return m[1];
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return jsonResp(405, { error: 'Method not allowed' });
  }

  try {
    await requireAdmin(event);
  } catch (e) {
    return jsonResp(e.status || 401, { error: e.message || 'Unauthorized' });
  }

  const env = invoiceEnv();
  if (!env) {
    return jsonResp(503, {
      error: 'Invoice service is not configured',
      code: 'INVOICE_NOT_CONFIGURED',
      hint: 'Set INVOICE_BASE_URL and INVOICE_API_KEY in Netlify env',
    });
  }

  const pdfId = parsePdfId(event.path);
  if (pdfId) {
    try {
      const upstream = await fetch(
        `${env.baseUrl}/v1/invoices/${encodeURIComponent(pdfId)}/pdf`,
        { headers: { 'X-Api-Key': env.apiKey } },
      );
      if (!upstream.ok) {
        const data = await upstream.json().catch(() => ({}));
        return jsonResp(upstream.status, {
          error: data.error || 'PDF download failed',
          code: 'INVOICE_PDF_FAILED',
        });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const headers = {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          upstream.headers.get('content-disposition') ||
          `attachment; filename="invoice-${pdfId}.pdf"`,
      };
      return {
        statusCode: 200,
        headers,
        isBase64Encoded: true,
        body: buf.toString('base64'),
      };
    } catch (e) {
      console.error('[invoices] pdf failed:', e);
      return jsonResp(502, { error: String(e.message || e) });
    }
  }

  // List
  try {
    const qs = event.queryStringParameters || {};
    const url = new URL(`${env.baseUrl}/v1/invoices`);
    url.searchParams.set('limit', String(Math.min(Number(qs.limit) || 100, 200)));
    if (qs.kind) url.searchParams.set('kind', String(qs.kind));
    if (qs.from) url.searchParams.set('from', String(qs.from));
    if (qs.to) url.searchParams.set('to', String(qs.to));
    if (qs.offset) url.searchParams.set('offset', String(qs.offset));

    const upstream = await fetch(url, {
      headers: { 'X-Api-Key': env.apiKey, Accept: 'application/json' },
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return jsonResp(upstream.status, {
        error: data.error || 'Invoice list failed',
        code: 'INVOICE_LIST_FAILED',
      });
    }
    return jsonResp(200, data);
  } catch (e) {
    console.error('[invoices] list failed:', e);
    return jsonResp(502, { error: String(e.message || e) });
  }
};
