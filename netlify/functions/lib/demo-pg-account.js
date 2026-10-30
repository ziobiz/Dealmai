'use strict';

/**
 * PG reviewer demo account — allowlisted email only, 14-day auto-disable.
 *
 * Customer (DealMai only): demo@vipdemo.com — password + fixed OTP 334455
 *   (no Google Authenticator). sessionStorage clears so a new browser session
 *   asks for OTP again.
 *
 * Admin demo (admin@vipdemo.com) and app.dealmai.com (DM Champ) demos are
 * retired — constants remain only for cleanup / allowlist checks.
 */

const DEMO_PG_CUSTOMER_EMAIL = 'demo@vipdemo.com';
const DEMO_PG_ADMIN_EMAIL = 'admin@vipdemo.com';
/** @deprecated use DEMO_PG_CUSTOMER_EMAIL */
const DEMO_PG_EMAIL = DEMO_PG_CUSTOMER_EMAIL;

const DEMO_PG_CUSTOMER_OTP = '334455';
const DEMO_PG_ADMIN_OTP = '001122';
/** @deprecated use DEMO_PG_ADMIN_OTP */
const DEMO_PG_OTP = DEMO_PG_ADMIN_OTP;

const DEMO_PG_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DEMO_PG_PASSWORD = 'dm0011@';
const DEMO_PG_CUSTOMER_NAME = 'demo pg';
const DEMO_PG_ADMIN_NAME = 'demo admin';
/** @deprecated use DEMO_PG_CUSTOMER_NAME / DEMO_PG_ADMIN_NAME */
const DEMO_PG_NAME = DEMO_PG_CUSTOMER_NAME;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isDemoPgCustomerEmail(email) {
  return normalizeEmail(email) === DEMO_PG_CUSTOMER_EMAIL;
}

function isDemoPgAdminEmail(email) {
  return normalizeEmail(email) === DEMO_PG_ADMIN_EMAIL;
}

function isDemoPgEmail(email) {
  return isDemoPgCustomerEmail(email) || isDemoPgAdminEmail(email);
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

/** Admin demo: fixed OTP instead of Google Authenticator. */
function isDemoPgFixedOtp(profile, email) {
  return isDemoPgAdminEmail(email) || isDemoPgAdminEmail(profile && profile.email);
}

function isDemoPgAdminActive(profile, email) {
  return isDemoPgActive(profile, email) && isDemoPgFixedOtp(profile, email);
}

/** Customer demo: fixed OTP (no Google Authenticator). */
function isDemoPgCustomerActive(profile, email) {
  if (!isDemoPgActive(profile, email)) return false;
  if (profile && profile.role && profile.role !== 'customer') return false;
  return isDemoPgCustomerEmail(email) || isDemoPgCustomerEmail(profile && profile.email);
}

function verifyDemoPgOtp(code) {
  return String(code || '').replace(/\s/g, '') === DEMO_PG_ADMIN_OTP;
}

function verifyDemoPgCustomerOtp(code) {
  return String(code || '').replace(/\s/g, '') === DEMO_PG_CUSTOMER_OTP;
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
  DEMO_PG_CUSTOMER_EMAIL,
  DEMO_PG_ADMIN_EMAIL,
  DEMO_PG_OTP,
  DEMO_PG_ADMIN_OTP,
  DEMO_PG_CUSTOMER_OTP,
  DEMO_PG_TTL_MS,
  DEMO_PG_PASSWORD,
  DEMO_PG_NAME,
  DEMO_PG_CUSTOMER_NAME,
  DEMO_PG_ADMIN_NAME,
  isDemoPgEmail,
  isDemoPgCustomerEmail,
  isDemoPgAdminEmail,
  isDemoPgProfile,
  isDemoPgFixedOtp,
  isDemoPgActive,
  isDemoPgAdminActive,
  isDemoPgCustomerActive,
  verifyDemoPgOtp,
  verifyDemoPgCustomerOtp,
  demoExpiresAtMs,
  expireDemoPgIfNeeded
};
