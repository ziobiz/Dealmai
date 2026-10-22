'use strict';

/**
 * Admin-only zip of selected queue emails as PDFs.
 * Same renderEmail() + htmlToPdf() as the single PDF download. Does not send.
 *
 * POST /api/admin-email-zip
 * Body: { ids: string[] }  (max 50)
 */

const { admin, db, ensureApp, firebaseUnavailableResponse } = require('./lib/firebase-admin-app');
const { renderEmail } = require('./lib/email-templates');
const { htmlToPdf } = require('./lib/email-pdf');
const { buildEmailPdfName, seoulStamp } = require('./lib/email-pdf-name');
const { EMAIL_ZIP_MAX, packEmailPdfs } = require('./lib/email-pdf-zip');

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Disposition, X-Zip-Ok, X-Zip-Failed'
};

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function asDate(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  if (typeof value === 'object') {
    const sec = value.seconds != null ? value.seconds : value._seconds;
    if (sec != null) return new Date(Number(sec) * 1000);
  }
  return value;
}

async function requireAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: jsonResp(401, { error: 'Missing Authorization header' }) };
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    return { error: jsonResp(401, { error: 'Invalid or expired ID token' }) };
  }
  const snap = await db.collection('users').doc(decoded.uid).get();
  const profile = snap.exists ? snap.data() : null;
  if (!profile || profile.role !== 'admin') {
    return { error: jsonResp(403, { error: 'Admin only' }) };
  }
  if (profile.disabled) return { error: jsonResp(403, { error: 'Account disabled' }) };
  return { uid: decoded.uid };
}

async function renderQueuePdf(id) {
  const snap = await db.collection('email_queue').doc(id).get();
  if (!snap.exists) {
    const err = new Error('Email not found');
    err.code = 'missing';
    throw err;
  }
  const data = snap.data() || {};
  const order = { ...(data.payload || {}) };
  if (!order.customer) order.customer = { email: data.to };
  if (!order.customer.email) order.customer.email = data.to;
  if (order.createdAt) order.createdAt = asDate(order.createdAt);
  const rendered = await renderEmail(data.kind, data.lang || 'en', order, db);
  const pdf = await htmlToPdf(rendered.html);
  const filename = buildEmailPdfName({
    kind: data.kind,
    when: new Date(),
    ref: order.ref || data.orderRef || '',
    to: data.to || ''
  });
  return { filename, pdf };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Method not allowed' });
  }
  if (!ensureApp()) {
    return firebaseUnavailableResponse(new Error('Firebase not configured'));
  }

  const gate = await requireAdmin(event);
  if (gate.error) return gate.error;

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResp(400, { error: 'Invalid JSON' });
  }

  const raw = Array.isArray(body.ids) ? body.ids : [];
  const ids = [];
  const seen = new Set();
  for (const item of raw) {
    const id = String(item || '').trim();
    if (!ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (!ids.length) return jsonResp(400, { error: 'Select at least one email' });
  if (ids.length > EMAIL_ZIP_MAX) {
    return jsonResp(400, { error: 'Too many emails', max: EMAIL_ZIP_MAX });
  }

  const files = [];
  const failed = [];
  for (const id of ids) {
    try {
      files.push(await renderQueuePdf(id));
    } catch (err) {
      console.warn('[admin-email-zip]', id, err.message || err);
      failed.push(id);
    }
  }
  if (!files.length) {
    return jsonResp(400, { error: 'Could not create the PDFs', failed });
  }

  if (failed.length) {
    files.push({
      filename: 'failed.txt',
      pdf: Buffer.from(
        'These emails could not be turned into a PDF:\n' + failed.join('\n') + '\n',
        'utf8'
      )
    });
  }

  try {
    const zip = await packEmailPdfs(files);
    const stamp = seoulStamp(new Date());
    const filename = `Emails_${stamp.date}_${stamp.time}.zip`;
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Zip-Ok': String(files.length - (failed.length ? 1 : 0)),
        'X-Zip-Failed': String(failed.length)
      },
      body: zip.toString('base64')
    };
  } catch (err) {
    console.warn('[admin-email-zip] pack', err.message || err);
    return jsonResp(500, { error: 'Could not create the zip' });
  }
};
