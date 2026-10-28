'use strict';

/**
 * PG reviewer demo **customer** — 14-day auto-disable.
 * Allowlisted email only. Not an admin; no fixed OTP path in normal use.
 */

const DEMO_PG_EMAIL = 'demo@vipdemo.com';
/** @deprecated kept for any leftover admin-OTP path; demo user is a customer. */
const DEMO_PG_OTP = '012340';
const DEMO_PG_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isDemoPgEmail(email) {
  return normalizeEmail(email) === DEMO_PG_EMAIL;
}

function isDemoPgProfile(profile, email) {
  if (profile && profile.demoPgAccount === true) return true;
  return isDemoPgEmail(email) || isDemoPgEmail(profile && profile.email);
}

function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function demoExpiresAtMs(profile) {
  return toMillis(profile && profile.demoExpiresAt);
}

function isDemoPgActive(profile, email) {
  if (!isDemoPgProfile(profile, email)) return false;
  if (profile && profile.disabled) return false;
  const exp = demoExpiresAtMs(profile);
  return exp > Date.now();
}

function verifyDemoPgOtp(code) {
  return String(code || '').replace(/\s/g, '').toLowerCase() === DEMO_PG_OTP.toLowerCase();
}

/**
 * If the demo window has ended, disable Auth + Firestore profile.
 * Returns { expired: boolean }.
 */
async function expireDemoPgIfNeeded(admin, db, uid, profile, email) {
  if (!isDemoPgProfile(profile, email)) return { expired: false };
  const exp = demoExpiresAtMs(profile);
  const past = !exp || exp <= Date.now();
  if (!past) return { expired: false };
  if (profile && profile.disabled) return { expired: true };

  await db.collection('users').doc(uid).set(
    {
      disabled: true,
      demoDisabledAt: admin.firestore.FieldValue.serverTimestamp(),
      demoDisableReason: 'expired'
    },
    { merge: true }
  );
  try {
    await admin.auth().updateUser(uid, { disabled: true });
  } catch (e) {
    console.warn('[demo-pg] auth disable failed', uid, e.message || e);
  }
  return { expired: true };
}

module.exports = {
  DEMO_PG_EMAIL,
  DEMO_PG_OTP,
  DEMO_PG_TTL_MS,
  isDemoPgEmail,
  isDemoPgProfile,
  isDemoPgActive,
  verifyDemoPgOtp,
  demoExpiresAtMs,
  expireDemoPgIfNeeded
};
