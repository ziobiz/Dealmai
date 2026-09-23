// ============================================================
// admin-fix-order-currencies — backfill mislabeled ontheline currencies
// ============================================================
// POST /.netlify/functions/admin-fix-order-currencies
// Header: Authorization: Bearer <Firebase admin ID token>
// Body (optional): { dryRun: true, limit: 500 }
//
// Fixes orders where amount looks like THB settlement but currency is JPY/KRW
// (fractional amount on a zero-decimal currency). Recalculates amountUsd via FX.
// ============================================================

const { admin, db } = require('./lib/firebase-admin-app');
const { needsCurrencyCorrection, correctionPatch, resolveInvoiceMoney } = require('./lib/invoice-money');
const { convertToUsd } = require('./lib/currency-convert');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function requireAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    const err = new Error('Missing Authorization header');
    err.status = 401;
    throw err;
  }
  const decoded = await admin.auth().verifyIdToken(m[1]);
  const profile = await db.collection('users').doc(decoded.uid).get();
  const role = profile.exists ? profile.data()?.role : null;
  if (role !== 'admin') {
    const err = new Error('Admin only');
    err.status = 403;
    throw err;
  }
  return decoded;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Method Not Allowed' });
  }

  try {
    await requireAdmin(event);
  } catch (e) {
    return jsonResp(e.status || 401, { error: e.message || 'Unauthorized' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    body = {};
  }
  const dryRun = !!body.dryRun;
  const limit = Math.min(Math.max(Number(body.limit) || 2000, 1), 5000);

  const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(limit).get();
  const fixed = [];
  const skipped = [];
  let scanned = 0;

  for (const docSnap of snap.docs) {
    scanned += 1;
    const o = docSnap.data() || {};
    if (o.source !== 'ontheline') continue;
    if (!needsCurrencyCorrection(o)) continue;

    const patch = correctionPatch(o);
    if (!patch) continue;

    const money = resolveInvoiceMoney(o, {});
    let amountUsd = Number(o.amountUsd);
    let fxRate = Number(o.fxRate);
    let fxSource = o.fxSource || null;
    try {
      const conv = await convertToUsd(money.amount, money.currency);
      amountUsd = conv.usd;
      fxRate = conv.rate;
      fxSource = conv.source;
    } catch (e) {
      console.warn('[admin-fix-order-currencies] FX failed', docSnap.id, e.message || e);
    }

    const update = {
      ...patch,
      amountUsd,
      fxRate,
      fxSource,
    };

    if (!dryRun) {
      await docSnap.ref.update(update);
    }

    fixed.push({
      id: docSnap.id,
      ref: o.ref || null,
      from: patch.currencyCorrectedFrom,
      to: patch.currency,
      amount: money.amount,
      amountUsd,
      dryRun,
    });
  }

  return jsonResp(200, {
    ok: true,
    dryRun,
    scanned,
    fixedCount: fixed.length,
    fixed,
    skippedCount: skipped.length,
  });
};
