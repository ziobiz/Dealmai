'use strict';

const { JWT } = require('google-auth-library');
const { admin } = require('./firebase-admin-app');
const { htmlToPdf } = require('./email-pdf');
const { kindLabel, buildEmailPdfName } = require('./email-pdf-name');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
let authCache = null;

function normalizeKey(key) {
  return String(key || '').replace(/\\n/g, '\n');
}

function jwtFor(email, key) {
  const privateKey = normalizeKey(key);
  if (authCache && authCache.email === email && authCache.key === privateKey) return authCache.jwt;
  const jwt = new JWT({ email, key: privateKey, scopes: [DRIVE_SCOPE] });
  authCache = { email, key: privateKey, jwt };
  return jwt;
}

async function accessToken(email, key) {
  const jwt = jwtFor(email, key);
  const token = await jwt.getAccessToken();
  return typeof token === 'string' ? token : token && token.token;
}

async function driveJson(token, method, path, params, body) {
  const url = new URL('https://www.googleapis.com' + path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  const headers = { Authorization: 'Bearer ' + token };
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const msg = (data.error && (data.error.message || data.error)) || data.raw || res.statusText;
    throw new Error('Drive ' + res.status + ': ' + msg);
  }
  return data;
}

async function ensureKindFolder(token, parentId, kind) {
  const name = kindLabel(kind);
  const q = [
    `'${parentId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${name.replace(/'/g, "\\'")}'`,
    'trashed = false'
  ].join(' and ');
  const listed = await driveJson(token, 'GET', '/drive/v3/files', {
    q,
    fields: 'files(id,name)',
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  if (listed.files && listed.files[0]) return listed.files[0].id;
  const created = await driveJson(token, 'POST', '/drive/v3/files', { supportsAllDrives: true }, {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  });
  return created.id;
}

async function uploadPdf(token, folderId, filename, pdf) {
  const boundary = 'dealmai' + Date.now();
  const meta = JSON.stringify({ name: filename, parents: [folderId], mimeType: 'application/pdf' });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    pdf,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
  if (!res.ok || !data.id) {
    const msg = (data.error && data.error.message) || text.slice(0, 300) || res.statusText;
    throw new Error('Drive upload ' + res.status + ': ' + msg);
  }
  return data.id;
}

/**
 * Save the customer template as a PDF in the kind folder.
 * Never throws — a Drive failure must not block the customer email.
 */
async function archiveSentEmail({ db, queueRef, kind, html, order, to }) {
  const stamp = admin.firestore.FieldValue.serverTimestamp();
  try {
    const cfgSnap = await db.collection('config').doc('driveAutomation').get();
    const cfg = cfgSnap.exists ? (cfgSnap.data() || {}) : {};
    const kinds = cfg.kinds || {};
    if (!kinds[kind]) return;

    const parentId = String(cfg.parentFolderId || '').trim();
    const clientEmail = String(cfg.clientEmail || '').trim();
    const privateKey = cfg.privateKey;
    if (!parentId || !clientEmail || !privateKey) {
      await queueRef.update({
        driveUploadError: 'Drive automation is missing a folder or service account',
        driveUploadFailedAt: stamp
      });
      return;
    }

    const when = new Date();
    const filename = buildEmailPdfName({
      kind,
      when,
      ref: (order && order.ref) || '',
      to
    });
    const pdf = await htmlToPdf(html);
    const token = await accessToken(clientEmail, privateKey);
    const folderId = await ensureKindFolder(token, parentId, kind);
    const fileId = await uploadPdf(token, folderId, filename, pdf);
    await queueRef.update({
      driveFileId: fileId,
      driveFileName: filename,
      driveFolderId: folderId,
      driveUploadedAt: stamp,
      driveUploadError: admin.firestore.FieldValue.delete()
    });
  } catch (err) {
    console.warn('[drive] archive failed:', err.message || err);
    try {
      await queueRef.update({
        driveUploadError: String(err.message || err).slice(0, 500),
        driveUploadFailedAt: stamp
      });
    } catch (writeErr) {
      console.warn('[drive] could not record upload error:', writeErr.message || writeErr);
    }
  }
}

module.exports = { archiveSentEmail };
