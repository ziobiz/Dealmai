'use strict';

/**
 * Provision PG demo accounts on app.dealmai.com (DM Champ white-label).
 *
 *   node scripts/provision-demo-dmchamp.js
 *
 * Deletes existing sub-accounts if present, recreates them, prints temporary_password.
 * DM Champ does not allow choosing the password via API.
 */

const path = require('path');
const fs = require('fs');

try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch (_) { /* ignore */ }

const {
  DEMO_PG_CUSTOMER_EMAIL,
  DEMO_PG_ADMIN_EMAIL,
  DEMO_PG_CUSTOMER_NAME,
  DEMO_PG_ADMIN_NAME
} = require('../netlify/functions/lib/demo-pg-account');
const { db, ensureApp } = require('../netlify/functions/lib/firebase-admin-app');
const dmchamp = require('../netlify/functions/lib/dmchamp');

async function deleteSub(cfg, email) {
  const url =
    'https://api.dmchamp.com/v1/subaccounts?apiKey=' +
    encodeURIComponent(cfg.apiKey) +
    '&email=' +
    encodeURIComponent(email);
  const resp = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } });
  const text = await resp.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: resp.status, body };
}

async function waitGone(cfg, email, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const f = await dmchamp.findSubAccount(cfg, email);
    if (!(f.ok && f.found)) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function main() {
  if (!ensureApp()) {
    console.error('Firebase not configured');
    process.exit(1);
  }
  const cfg = await dmchamp.loadConfig(db);
  if (!cfg.apiKey) {
    console.error('DM Champ API key missing (config/dmchamp)');
    process.exit(1);
  }

  const accounts = [
    { email: DEMO_PG_CUSTOMER_EMAIL, fullName: DEMO_PG_CUSTOMER_NAME || 'Demo Customer' },
    { email: DEMO_PG_ADMIN_EMAIL, fullName: DEMO_PG_ADMIN_NAME || 'Demo Admin' }
  ];

  const results = [];
  for (const a of accounts) {
    await deleteSub(cfg, a.email);
    await waitGone(cfg, a.email);
    const created = await dmchamp.createSubAccount(cfg, {
      email: a.email,
      fullName: a.fullName,
      country: 'KR',
      language: 'en',
      monthly_credits: 1000,
      description: 'PG demo for app.dealmai.com'
    });
    results.push({
      email: a.email,
      ok: created.ok,
      status: created.status,
      error: created.error || null,
      password: (created.data && created.data.temporary_password) || null,
      uid: (created.data && created.data.uid) || null,
      portal: cfg.portalUrl || 'https://app.dealmai.com'
    });
  }

  console.log(JSON.stringify({ ok: results.every((r) => r.ok), accounts: results }, null, 2));
  if (!results.every((r) => r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
