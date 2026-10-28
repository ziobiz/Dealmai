'use strict';

/**
 * One-shot: create / refresh the PG demo admin (demo@vipdemo.com).
 * Loads Firebase creds from env (same as /etc/dealmai/env on VPS).
 *
 *   node scripts/provision-demo-pg.js
 */

const path = require('path');
const fs = require('fs');

// Optional local .env (never commit secrets). VPS uses process env from systemd.
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
  DEMO_PG_EMAIL,
  DEMO_PG_OTP,
  DEMO_PG_TTL_MS
} = require('../netlify/functions/lib/demo-pg-account');
const { admin, db, ensureApp } = require('../netlify/functions/lib/firebase-admin-app');

const NAME = 'demo pg';
const PASSWORD = 'dm0011@';

async function main() {
  if (!ensureApp()) {
    console.error('Firebase not configured (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY)');
    process.exit(1);
  }

  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + DEMO_PG_TTL_MS);
  let user;
  try {
    user = await admin.auth().getUserByEmail(DEMO_PG_EMAIL);
    await admin.auth().updateUser(user.uid, {
      password: PASSWORD,
      displayName: NAME,
      disabled: false,
      emailVerified: true
    });
    console.log('Updated Auth user', user.uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await admin.auth().createUser({
      email: DEMO_PG_EMAIL,
      password: PASSWORD,
      displayName: NAME,
      disabled: false,
      emailVerified: true
    });
    console.log('Created Auth user', user.uid);
  }

  await db.collection('users').doc(user.uid).set(
    {
      email: DEMO_PG_EMAIL,
      name: NAME,
      role: 'admin',
      mustChangePassword: false,
      disabled: false,
      demoPgAccount: true,
      demoFixedOtp: true,
      totpEnabled: true, // skip enroll; verify-login uses fixed OTP
      totpSecret: null,
      demoExpiresAt: expiresAt,
      demoProvisionedAt: admin.firestore.FieldValue.serverTimestamp(),
      demoDisableReason: admin.firestore.FieldValue.delete(),
      demoDisabledAt: admin.firestore.FieldValue.delete()
    },
    { merge: true }
  );

  console.log(JSON.stringify({
    ok: true,
    uid: user.uid,
    email: DEMO_PG_EMAIL,
    name: NAME,
    otp: DEMO_PG_OTP,
    expiresAt: expiresAt.toDate().toISOString()
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
