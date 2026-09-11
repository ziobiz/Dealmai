'use strict';

/**
 * Admin-only Google OTP (TOTP) — Crypto-style flow for DealMai.
 *
 * Customers never hit this path. Admins must:
 *   1) Sign in with email/password (Firebase Auth)
 *   2) If totpEnabled → verify 6-digit authenticator code
 *   3) If not enrolled → email code → scan QR → activate TOTP
 *
 * POST /.netlify/functions/admin-otp
 * Body: { action, code?, ... }
 * Header: Authorization: Bearer <Firebase ID token>
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const { admin, db, ensureApp, firebaseUnavailableResponse } = require('./lib/firebase-admin-app');
const { loadSmtpSettings } = require('./lib/smtp-settings');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResp(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return email || '';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

function verifyTotp(secret, code) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: String(code || '').replace(/\s/g, ''),
    window: 1
  });
}

async function requireAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: jsonResp(401, { error: 'Missing Authorization header' }) };

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    return { error: jsonResp(401, { error: 'Invalid or expired ID token' }) };
  }

  const snap = await db.collection('users').doc(decoded.uid).get();
  if (!snap.exists) return { error: jsonResp(403, { error: 'Profile not found' }) };
  const profile = snap.data() || {};
  if (profile.role !== 'admin') {
    return { error: jsonResp(403, { error: 'OTP is required for admin accounts only', customer: true }) };
  }
  if (profile.disabled) return { error: jsonResp(403, { error: 'Account disabled' }) };

  return { uid: decoded.uid, email: decoded.email || profile.email, profile, ref: snap.ref };
}

async function sendEnrollEmail(toEmail, code, name) {
  const cfg = await loadSmtpSettings(db, null);
  const subject = `[DealMai] Admin OTP enrollment code: ${code}`;
  const text =
    `Hello ${name || 'Admin'},\n\n` +
    `Your DealMai admin OTP enrollment code is: ${code}\n` +
    `Valid for 10 minutes.\n\n` +
    `If you did not request this, ignore this email.\n`;

  if (!cfg || !cfg.host || !cfg.user) {
    console.warn('[admin-otp] SMTP not configured — enroll code for', toEmail, '=', code);
    return { sent: false, logged: true };
  }

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port || 587),
    secure: !!cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass || cfg.password }
  });

  await transport.sendMail({
    from: cfg.from || cfg.user,
    to: toEmail,
    subject,
    text
  });
  return { sent: true };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Method not allowed' });
  }

  if (!ensureApp()) {
    return firebaseUnavailableResponse(new Error('Firebase not configured'));
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResp(400, { error: 'Invalid JSON' });
  }

  const action = String(body.action || '').trim();
  const gate = await requireAdmin(event);
  if (gate.error) return gate.error;
  const { uid, email, profile, ref } = gate;

  try {
    if (action === 'status') {
      return jsonResp(200, {
        ok: true,
        role: 'admin',
        totpEnabled: !!profile.totpEnabled,
        mustSetupOtp: !profile.totpEnabled,
        maskedEmail: maskEmail(email)
      });
    }

    if (action === 'enroll-send') {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = Date.now() + 10 * 60 * 1000;
      await ref.set(
        {
          otpEnrollHash: hashCode(code),
          otpEnrollExpires: expires,
          otpEnrollUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      const mail = await sendEnrollEmail(email, code, profile.name);
      return jsonResp(200, {
        ok: true,
        maskedEmail: maskEmail(email),
        emailSent: !!mail.sent,
        // When SMTP missing, still return ok so admin can read server logs
        hint: mail.sent ? null : 'SMTP not configured — check server logs for the code'
      });
    }

    if (action === 'enroll-verify-email') {
      const code = String(body.code || '').replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) return jsonResp(400, { error: 'Invalid code' });
      const snap = await ref.get();
      const data = snap.data() || {};
      if (!data.otpEnrollHash || !data.otpEnrollExpires || Date.now() > Number(data.otpEnrollExpires)) {
        return jsonResp(400, { error: 'Code expired — resend' });
      }
      if (hashCode(code) !== data.otpEnrollHash) {
        return jsonResp(400, { error: 'Invalid code' });
      }

      const generated = speakeasy.generateSecret({
        name: `DealMai (${email})`,
        length: 20
      });
      await ref.set(
        {
          totpSecret: generated.base32,
          totpEnabled: false,
          otpEnrollHash: admin.firestore.FieldValue.delete(),
          otpEnrollExpires: admin.firestore.FieldValue.delete()
        },
        { merge: true }
      );
      return jsonResp(200, {
        ok: true,
        otpauthUrl: generated.otpauth_url || '',
        secret: generated.base32
      });
    }

    if (action === 'enroll-activate') {
      const code = String(body.code || '').replace(/\s/g, '');
      const snap = await ref.get();
      const data = snap.data() || {};
      if (!data.totpSecret) return jsonResp(400, { error: 'No pending OTP secret' });
      if (!verifyTotp(data.totpSecret, code)) return jsonResp(400, { error: 'Invalid authenticator code' });
      await ref.set(
        {
          totpEnabled: true,
          totpActivatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return jsonResp(200, { ok: true, totpEnabled: true });
    }

    if (action === 'verify-login') {
      const code = String(body.code || '').replace(/\s/g, '');
      if (!profile.totpEnabled || !profile.totpSecret) {
        return jsonResp(400, { error: 'OTP not enrolled' });
      }
      if (!verifyTotp(profile.totpSecret, code)) {
        return jsonResp(400, { error: 'Invalid authenticator code' });
      }
      await ref.set(
        { totpLastVerifiedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      return jsonResp(200, { ok: true, verified: true });
    }

    return jsonResp(400, { error: 'Unknown action' });
  } catch (e) {
    console.error('[admin-otp]', action, e);
    return jsonResp(500, { error: e.message || 'OTP failed' });
  }
};
