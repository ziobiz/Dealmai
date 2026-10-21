'use strict';

/**
 * Admin-only preview of a queued email.
 * Renders with the same renderEmail() used at send time. Does not send.
 *
 * POST /api/admin-email-preview
 * Body: { id }
 * Header: Authorization: Bearer <Firebase ID token>
 */

const { admin, db, ensureApp, firebaseUnavailableResponse } = require('./lib/firebase-admin-app');
const { renderEmail } = require('./lib/email-templates');
const { htmlToPdf } = require('./lib/email-pdf');
const { buildEmailPdfName } = require('./lib/email-pdf-name');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResp(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
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
  const id = String(body.id || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return jsonResp(400, { error: 'Missing email id' });
  }

  const snap = await db.collection('email_queue').doc(id).get();
  if (!snap.exists) return jsonResp(404, { error: 'Email not found' });
  const data = snap.data() || {};

  const order = { ...(data.payload || {}) };
  if (!order.customer) order.customer = { email: data.to };
  if (!order.customer.email) order.customer.email = data.to;
  if (order.createdAt) order.createdAt = asDate(order.createdAt);

  try {
    const rendered = await renderEmail(data.kind, data.lang || 'en', order, db);
    if (String(body.format || '') === 'pdf') {
      const pdf = await htmlToPdf(rendered.html);
      const filename = buildEmailPdfName({
        kind: data.kind,
        when: new Date(),
        ref: order.ref || data.orderRef || '',
        to: data.to || ''
      });
      return jsonResp(200, {
        ok: true,
        filename,
        pdfBase64: pdf.toString('base64'),
        subject: rendered.subject
      });
    }
    return jsonResp(200, {
      ok: true,
      subject: rendered.subject,
      html: rendered.html,
      kind: data.kind || '',
      lang: data.lang || 'en',
      status: data.status || '',
      to: data.to || ''
    });
  } catch (err) {
    console.warn('[admin-email-preview]', id, err.message || err);
    return jsonResp(400, { error: 'Could not render this email' });
  }
};
