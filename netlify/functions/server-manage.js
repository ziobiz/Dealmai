'use strict';

/**
 * Admin API: Domain & SSL + Server management (PG HQ Policy port).
 *
 * GET  /api/server-manage?view=summary|domain
 * POST /api/server-manage  body: { action: 'saveServer'|'saveDomain', ... }
 *
 * Auth: Authorization Bearer <Firebase ID token> + users/{uid}.role == admin
 */

const { admin, db } = require('./lib/firebase-admin-app');
const {
  buildSummary,
  buildSslDomainLinkage,
  parseServerManageBody,
  parseDomainBody
} = require('./lib/server-manage');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function jsonResp(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

async function requireAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    const err = new Error('Missing Authorization header');
    err.statusCode = 401;
    throw err;
  }
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    const err = new Error('Invalid or expired ID token');
    err.statusCode = 401;
    throw err;
  }
  const snap = await db.collection('users').doc(decoded.uid).get();
  const profile = snap.exists ? snap.data() : null;
  if (!profile || profile.role !== 'admin') {
    const err = new Error('Only admins can access server management');
    err.statusCode = 403;
    throw err;
  }
  return { uid: decoded.uid, email: decoded.email || profile.email || '' };
}

async function loadServerCfg() {
  const snap = await db.collection('config').doc('serverManage').get();
  return snap.exists ? snap.data() : {};
}

async function loadDomainCfg() {
  const snap = await db.collection('config').doc('domain').get();
  return snap.exists ? snap.data() : {};
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const caller = await requireAdmin(event);

    if (event.httpMethod === 'GET') {
      const view = String(
        (event.queryStringParameters && event.queryStringParameters.view) || 'summary'
      ).toLowerCase();
      const serverCfg = await loadServerCfg();
      if (view === 'domain') {
        const domainCfg = await loadDomainCfg();
        const linkage = buildSslDomainLinkage(domainCfg, serverCfg);
        return jsonResp(200, {
          ok: true,
          domain: {
            publicSiteUrl: linkage.publicSiteUrl,
            publicWwwUrl: linkage.publicWwwUrl,
            publicApiBaseUrl: linkage.publicApiBaseUrl,
            updatedAt: domainCfg.updatedAt || null,
            updatedBy: domainCfg.updatedBy || null
          },
          sslDomainLinkage: linkage,
          serverManage: {
            sslCertPath: serverCfg.sslCertPath || '',
            sslLeDomain: serverCfg.sslLeDomain || ''
          }
        });
      }

      const summary = await buildSummary(serverCfg);
      return jsonResp(200, { ok: true, ...summary });
    }

    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return jsonResp(400, { error: 'Invalid JSON' });
      }
      const action = String(body.action || '').trim();

      if (action === 'saveServer') {
        const patch = parseServerManageBody(body);
        const payload = {
          ...patch,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: caller.email || caller.uid
        };
        await db.collection('config').doc('serverManage').set(payload, { merge: true });
        const serverCfg = await loadServerCfg();
        const summary = await buildSummary(serverCfg);
        return jsonResp(200, {
          ok: true,
          message: 'Server management settings saved.',
          ...summary
        });
      }

      if (action === 'saveDomain') {
        const patch = parseDomainBody(body);
        const payload = {
          ...patch,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: caller.email || caller.uid
        };
        await db.collection('config').doc('domain').set(payload, { merge: true });
        const [domainCfg, serverCfg] = await Promise.all([loadDomainCfg(), loadServerCfg()]);
        const linkage = buildSslDomainLinkage(domainCfg, serverCfg);
        return jsonResp(200, {
          ok: true,
          message: 'Domain settings saved.',
          domain: {
            publicSiteUrl: linkage.publicSiteUrl,
            publicWwwUrl: linkage.publicWwwUrl,
            publicApiBaseUrl: linkage.publicApiBaseUrl,
            updatedBy: payload.updatedBy
          },
          sslDomainLinkage: linkage
        });
      }

      return jsonResp(400, { error: 'Unknown action. Use saveServer or saveDomain.' });
    }

    return jsonResp(405, { error: 'Method not allowed' });
  } catch (e) {
    const code = e.statusCode || (e.code === 'firebase_not_configured' ? 503 : 500);
    console.error('[server-manage]', e.message || e);
    return jsonResp(code, { error: e.message || String(e) });
  }
};
