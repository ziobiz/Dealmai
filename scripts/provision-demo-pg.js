'use strict';

/**
 * One-shot: create / refresh PG demo **customer** only (demo@vipdemo.com).
 * Loads Firebase creds from env (same as /etc/dealmai/env on VPS).
 *
 *   node scripts/provision-demo-pg.js
 *
 * Customer: demo@vipdemo.com — password + fixed OTP 334455 (no Google Authenticator)
 * Admin demo (admin@vipdemo.com) is intentionally NOT provisioned; leftover Auth
 * users are deleted if still present.
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
  DEMO_PG_TTL_MS,
  DEMO_PG_PASSWORD,
  DEMO_PG_CUSTOMER_NAME,
  DEMO_PG_CUSTOMER_OTP
} = require('../netlify/functions/lib/demo-pg-account');
const { admin, db, ensureApp } = require('../netlify/functions/lib/firebase-admin-app');

async function upsertAuthUser(email, displayName) {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, {
      password: DEMO_PG_PASSWORD,
      displayName,
      disabled: false,
      emailVerified: true
    });
    console.log('Updated Auth user', email, user.uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await admin.auth().createUser({
      email,
      password: DEMO_PG_PASSWORD,
      displayName,
      disabled: false,
      emailVerified: true
    });
    console.log('Created Auth user', email, user.uid);
  }
  return user;
}

async function deleteAuthUserIfExists(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await db.collection('users').doc(user.uid).delete().catch(() => {});
    await admin.auth().deleteUser(user.uid);
    console.log('Deleted leftover Auth user', email, user.uid);
    return user.uid;
  } catch (e) {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  }
}

async function writeCustomerProfile(uid, expiresAt) {
  const del = admin.firestore.FieldValue.delete();
  await db.collection('users').doc(uid).set(
    {
      email: DEMO_PG_CUSTOMER_EMAIL,
      name: DEMO_PG_CUSTOMER_NAME,
      role: 'customer',
      mustChangePassword: false,
      disabled: false,
      profileComplete: true,
      nationality: 'KR',
      phoneCountryCode: '+82',
      phone: '1012345678',
      demoPgAccount: true,
      demoExpiresAt: expiresAt,
      demoProvisionedAt: admin.firestore.FieldValue.serverTimestamp(),
      demoDisableReason: del,
      demoDisabledAt: del,
      demoFixedOtp: true,
      totpEnabled: del,
      totpSecret: del,
      totpActivatedAt: del,
      totpLastVerifiedAt: del,
      otpEnrollHash: del,
      otpEnrollExpires: del
    },
    { merge: true }
  );
}

async function main() {
  if (!ensureApp()) {
    console.error('Firebase not configured (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY)');
    process.exit(1);
  }

  const deletedAdminUid = await deleteAuthUserIfExists(DEMO_PG_ADMIN_EMAIL);
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + DEMO_PG_TTL_MS);

  const customer = await upsertAuthUser(DEMO_PG_CUSTOMER_EMAIL, DEMO_PG_CUSTOMER_NAME);
  await writeCustomerProfile(customer.uid, expiresAt);

  console.log(JSON.stringify({
    ok: true,
    expiresAt: expiresAt.toDate().toISOString(),
    deletedAdmin: deletedAdminUid
      ? { email: DEMO_PG_ADMIN_EMAIL, uid: deletedAdminUid }
      : null,
    accounts: [
      {
        role: 'customer',
        email: DEMO_PG_CUSTOMER_EMAIL,
        password: DEMO_PG_PASSWORD,
        otp: DEMO_PG_CUSTOMER_OTP,
        otpMode: 'fixed (no Google Authenticator)',
        uid: customer.uid
      }
    ]
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
