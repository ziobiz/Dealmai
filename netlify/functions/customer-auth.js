'use strict';

/**
 * Customer signup + profile completion (DealMai).
 *
 * Public (no auth):
 *   send-register-code  { email }
 *   register            { email, password, code }
 *
 * Authenticated customer:
 *   complete-profile    { name, nationality, phoneCountryCode, phone }
 *
 * Admins are never created here — only via Admin Console.
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { admin, db, ensureApp, firebaseUnavailableResponse } = require('./lib/firebase-admin-app');
const { loadSmtpSettings } = require('./lib/smtp-settings');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PURPOSE = 'REGISTER';
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function jsonResp(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
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

function verificationDocId(email) {
  return crypto.createHash('sha256').update(`${PURPOSE}:${email}`).digest('hex').slice(0, 40);
}

async function sendRegisterEmail(toEmail, code) {
  const cfg = await loadSmtpSettings(db, null);
  const subject = `[DealMai] Email verification code: ${code}`;
  const text =
    `Your DealMai signup verification code is: ${code}\n` +
    `Valid for 10 minutes.\n\n` +
    `If you did not request this, ignore this email.\n`;

  if (!cfg || !cfg.host || !cfg.user) {
    console.warn('[customer-auth] SMTP not configured — register code for', toEmail, '=', code);
    return { sent: false };
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

async function emailAlreadyRegistered(email) {
  try {
    await admin.auth().getUserByEmail(email);
    return true;
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') {
      // also check Firestore in case of ghost auth gaps
      const q = await db.collection('users').where('email', '==', email).limit(1).get();
      return !q.empty;
    }
    throw e;
  }
}

async function requireCustomer(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: jsonResp(401, { error: 'Missing Authorization header' }) };

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch {
    return { error: jsonResp(401, { error: 'Invalid or expired ID token' }) };
  }

  const ref = db.collection('users').doc(decoded.uid);
  const snap = await ref.get();
  if (!snap.exists) return { error: jsonResp(403, { error: 'Profile not found' }) };
  const profile = snap.data() || {};
  if (profile.role !== 'customer') {
    return { error: jsonResp(403, { error: 'Customer accounts only' }) };
  }
  if (profile.disabled) return { error: jsonResp(403, { error: 'Account disabled' }) };

  return { uid: decoded.uid, email: decoded.email || profile.email, profile, ref };
}

function isComplete(profile) {
  return !!(
    profile &&
    String(profile.name || '').trim() &&
    String(profile.nationality || '').trim() &&
    String(profile.phoneCountryCode || '').trim() &&
    String(profile.phone || '').trim()
  );
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

  try {
    if (action === 'send-register-code') {
      const email = normalizeEmail(body.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResp(400, { error: 'Invalid email' });
      }
      if (await emailAlreadyRegistered(email)) {
        return jsonResp(409, { error: 'Email already registered' });
      }

      const docId = verificationDocId(email);
      const ref = db.collection('email_verifications').doc(docId);
      const prev = await ref.get();
      if (prev.exists) {
        const last = Number(prev.data().updatedAtMs || 0);
        if (last && Date.now() - last < RESEND_COOLDOWN_MS) {
          return jsonResp(429, { error: 'Please wait before requesting another code' });
        }
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      await ref.set({
        email,
        purpose: PURPOSE,
        codeHash: hashCode(code),
        expiresAtMs: Date.now() + CODE_TTL_MS,
        updatedAtMs: Date.now(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const mail = await sendRegisterEmail(email, code);
      return jsonResp(200, {
        ok: true,
        maskedEmail: maskEmail(email),
        emailSent: !!mail.sent,
        hint: mail.sent ? null : 'SMTP not configured — check server logs for the code'
      });
    }

    if (action === 'register') {
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const code = String(body.code || '').replace(/\s/g, '');

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResp(400, { error: 'Invalid email' });
      }
      if (password.length < 6) {
        return jsonResp(400, { error: 'Password must be at least 6 characters' });
      }
      if (!/^\d{6}$/.test(code)) {
        return jsonResp(400, { error: 'Invalid verification code' });
      }
      if (await emailAlreadyRegistered(email)) {
        return jsonResp(409, { error: 'Email already registered' });
      }

      const docId = verificationDocId(email);
      const ref = db.collection('email_verifications').doc(docId);
      const snap = await ref.get();
      if (!snap.exists) return jsonResp(400, { error: 'Code expired — request a new one' });
      const data = snap.data() || {};
      if (!data.codeHash || !data.expiresAtMs || Date.now() > Number(data.expiresAtMs)) {
        return jsonResp(400, { error: 'Code expired — request a new one' });
      }
      if (hashCode(code) !== data.codeHash) {
        return jsonResp(400, { error: 'Invalid verification code' });
      }

      let userRecord;
      try {
        userRecord = await admin.auth().createUser({
          email,
          password,
          emailVerified: true,
          disabled: false
        });
      } catch (e) {
        if (e.code === 'auth/email-already-exists') {
          return jsonResp(409, { error: 'Email already registered' });
        }
        if (e.code === 'auth/invalid-password' || e.code === 'auth/weak-password') {
          return jsonResp(400, { error: 'Password too weak (min 6 characters)' });
        }
        throw e;
      }

      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        name: '',
        role: 'customer',
        emailVerified: true,
        profileComplete: false,
        mustChangePassword: false,
        nationality: '',
        phoneCountryCode: '',
        phone: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await ref.delete().catch(() => {});

      return jsonResp(200, {
        ok: true,
        email,
        message: 'Registration complete — please sign in'
      });
    }

    if (action === 'complete-profile') {
      const gate = await requireCustomer(event);
      if (gate.error) return gate.error;
      const { ref, profile } = gate;

      const name = String(body.name || '').trim();
      const nationality = String(body.nationality || '').trim().toUpperCase();
      const phoneCountryCode = String(body.phoneCountryCode || '').trim();
      const phone = String(body.phone || '').replace(/[^\d]/g, '');

      if (!name || name.length < 2) return jsonResp(400, { error: 'Name is required' });
      if (!nationality) return jsonResp(400, { error: 'Nationality / country is required' });
      if (!phoneCountryCode) return jsonResp(400, { error: 'Country calling code is required' });
      if (!phone || phone.length < 6) return jsonResp(400, { error: 'Phone number is required' });

      const patch = {
        name,
        nationality,
        phoneCountryCode,
        phone,
        profileComplete: true,
        profileCompletedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await ref.set(patch, { merge: true });

      return jsonResp(200, {
        ok: true,
        profile: { ...profile, ...patch, profileComplete: true }
      });
    }

    if (action === 'profile-status') {
      const gate = await requireCustomer(event);
      if (gate.error) return gate.error;
      const { profile } = gate;
      const complete = profile.profileComplete === true || isComplete(profile);
      return jsonResp(200, {
        ok: true,
        profileComplete: complete,
        name: profile.name || '',
        nationality: profile.nationality || '',
        phoneCountryCode: profile.phoneCountryCode || '',
        phone: profile.phone || ''
      });
    }

    return jsonResp(400, { error: 'Unknown action' });
  } catch (e) {
    console.error('[customer-auth]', e);
    return jsonResp(500, { error: e.message || 'Server error' });
  }
};
