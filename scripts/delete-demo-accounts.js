'use strict';

/**
 * Delete PG demo accounts per current policy:
 *   - DealMai: remove admin@vipdemo.com only (keep customer demo@vipdemo.com)
 *   - app.dealmai.com (DM Champ): remove demo@ and admin@
 *
 *   node scripts/delete-demo-accounts.js
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
const { admin, db, ensureApp } = require('../netlify/functions/lib/firebase-admin-app');
const dmchamp = require('../netlify/functions/lib/dmchamp');

async function deleteDealMaiUserByEmail(email) {
  const out = { email, authDeleted: false, firestoreDeleted: false, uid: null, error: null };
  try {
    const user = await admin.auth().getUserByEmail(email);
    out.uid = user.uid;
    await db.collection('users').doc(user.uid).delete().catch(async () => {
      await db.collection('users').doc(user.uid).set(
        {
          disabled: true,
          demoPgAccount: false,
          demoDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
          demoDisableReason: 'manual_delete'
        },
        { merge: true }
      );
    });
    out.firestoreDeleted = true;
    await admin.auth().deleteUser(user.uid);
    out.authDeleted = true;
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      out.error = 'not_found';
    } else {
      out.error = e.message || String(e);
    }
  }
  return out;
}

async function deleteDmChamp(cfg, email) {
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

  const dealmai = [
    await deleteDealMaiUserByEmail(DEMO_PG_ADMIN_EMAIL)
  ];

  let dmchampResults = [];
  const cfg = await dmchamp.loadConfig(db);
  if (!cfg.apiKey) {
    dmchampResults = [{ error: 'DM Champ API key missing' }];
  } else {
    dmchampResults = [
      await deleteDmChamp(cfg, DEMO_PG_CUSTOMER_EMAIL),
      await deleteDmChamp(cfg, DEMO_PG_ADMIN_EMAIL)
    ];
  }

  console.log(JSON.stringify({
    ok: true,
    dealmaiDeleted: dealmai,
    dmchampDeleted: dmchampResults,
    kept: {
      dealmaiCustomer: DEMO_PG_CUSTOMER_EMAIL
    }
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
