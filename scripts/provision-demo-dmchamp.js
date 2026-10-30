'use strict';

/**
 * PG demo accounts on app.dealmai.com (DM Champ) are disabled.
 * This script only deletes leftover sub-accounts — it does not create new ones.
 *
 *   node scripts/provision-demo-dmchamp.js
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
  DEMO_PG_ADMIN_EMAIL
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
  return { email, status: resp.status, body };
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

  const results = [
    await deleteSub(cfg, DEMO_PG_CUSTOMER_EMAIL),
    await deleteSub(cfg, DEMO_PG_ADMIN_EMAIL)
  ];

  console.log(JSON.stringify({
    ok: true,
    action: 'delete-only (no create)',
    portal: cfg.portalUrl || 'https://app.dealmai.com',
    deleted: results
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
