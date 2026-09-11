'use strict';

/**
 * Password reset emails via DealMai SMTP (not Firebase's default mailer).
 *
 * Firebase Auth still owns the reset token; we generate the link with Admin SDK
 * and deliver it through Admin → Email SMTP / env SMTP_*.
 *
 * POST /api/password-reset
 *   { action: "request", email }
 *   { action: "admin-request", email } + Authorization Bearer (admin)
 */

const nodemailer = require('nodemailer');
const { admin, db, ensureApp, firebaseUnavailableResponse } = require('./lib/firebase-admin-app');
const { loadSmtpSettings } = require('./lib/smtp-settings');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const COOLDOWN_MS = 60 * 1000;
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://dealmai.com').replace(/\/$/, '');

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

async function requireAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: jsonResp(401, { error: 'Missing Authorization header' }) };
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch {
    return { error: jsonResp(401, { error: 'Invalid or expired ID token' }) };
  }
  const snap = await db.collection('users').doc(decoded.uid).get();
  if (!snap.exists || (snap.data() || {}).role !== 'admin') {
    return { error: jsonResp(403, { error: 'Admin only' }) };
  }
  return { uid: decoded.uid, email: decoded.email };
}

async function sendResetMail(toEmail, { resetLink, tempPassword, mode }, requester) {
  const cfg = await loadSmtpSettings(db, null);
  if (!cfg || !cfg.host || !cfg.user) {
    const err = new Error('SMTP is not configured. Set Admin → Email SMTP (or SMTP_* env).');
    err.code = 'smtp_not_configured';
    throw err;
  }

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port || 587),
    secure: !!cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass || cfg.password }
  });

  const subject = '[DealMai] Password reset';
  let text;
  let html;
  if (mode === 'temp_password' && tempPassword) {
    text =
      `Hello,\n\n` +
      `A password reset was processed for your DealMai account (${toEmail}).\n\n` +
      `Temporary password: ${tempPassword}\n` +
      `Sign in at: ${APP_URL}/\n\n` +
      `You will be asked to change this password after signing in.\n` +
      (requester ? `\nRequested by admin: ${requester}\n` : '');
    html =
      `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#1a1a1a">` +
      `<p>A password reset was processed for your DealMai account (<strong>${toEmail}</strong>).</p>` +
      `<p>Temporary password:</p>` +
      `<p style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;font-weight:700;letter-spacing:.06em;background:#f4f7f8;padding:12px 14px;border-radius:8px;display:inline-block">${tempPassword}</p>` +
      `<p><a href="${APP_URL}/" style="display:inline-block;padding:12px 18px;background:#0bb6c4;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Sign in</a></p>` +
      `<p style="font-size:12px;color:#888">Please change this password after signing in.</p>` +
      `</div>`;
  } else {
    text =
      `Hello,\n\n` +
      `A password reset was requested for your DealMai account (${toEmail}).\n\n` +
      `Open this link to set a new password (valid for about 1 hour):\n${resetLink}\n\n` +
      `If you did not request this, you can ignore this email.\n` +
      (requester ? `\nRequested by admin: ${requester}\n` : '');
    html =
      `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#1a1a1a">` +
      `<p>A password reset was requested for your DealMai account (<strong>${toEmail}</strong>).</p>` +
      `<p><a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#0bb6c4;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Reset password</a></p>` +
      `<p style="font-size:13px;color:#666">Or copy this link:<br><span style="word-break:break-all">${resetLink}</span></p>` +
      `<p style="font-size:12px;color:#888">This link expires in about 1 hour. If you did not request this, ignore this email.</p>` +
      `</div>`;
  }

  let actualTo = toEmail;
  let actualSubject = subject;
  if (cfg.testRewriteTo && cfg.testRewriteTo.toLowerCase() !== toEmail.toLowerCase()) {
    actualTo = cfg.testRewriteTo;
    actualSubject = `[TEST → ${toEmail}] ${subject}`;
  }

  const info = await transport.sendMail({
    from: cfg.from || cfg.user,
    to: actualTo,
    subject: actualSubject,
    text,
    html,
    replyTo: cfg.replyTo
  });

  return {
    sent: true,
    messageId: info.messageId || null,
    rewrittenTo: actualTo !== toEmail ? actualTo : null
  };
}

async function cooldownOk(email) {
  const id = Buffer.from(email).toString('base64url').slice(0, 48);
  const ref = db.collection('password_reset_requests').doc(id);
  const snap = await ref.get();
  const last = snap.exists ? Number((snap.data() || {}).updatedAtMs || 0) : 0;
  if (last && Date.now() - last < COOLDOWN_MS) return { ok: false, ref };
  await ref.set(
    {
      email,
      updatedAtMs: Date.now(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  return { ok: true, ref };
}

async function issueReset(email, { adminEmail } = {}) {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') {
      return { exists: false };
    }
    throw e;
  }

  if (user.disabled) {
    const err = new Error('Account is disabled');
    err.code = 'account_disabled';
    throw err;
  }

  // Prefer Firebase reset link (no custom continue URL → avoids allowlist errors).
  // If link generation fails, fall back to a temporary password emailed via SMTP.
  let resetLink = null;
  let tempPassword = null;
  let mode = 'link';
  try {
    const continueUrl = (process.env.PASSWORD_RESET_CONTINUE_URL || '').trim() || `${APP_URL}/`;
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email, {
        url: continueUrl,
        handleCodeInApp: false
      });
    } catch (linkErr) {
      // Common on self-hosted domains not yet added under Firebase Auth authorized domains
      console.warn('[password-reset] link with continue URL failed:', linkErr.message || linkErr);
      resetLink = await admin.auth().generatePasswordResetLink(email);
    }
  } catch (e) {
    console.warn('[password-reset] generatePasswordResetLink failed, using temp password:', e.message || e);
    mode = 'temp_password';
    tempPassword =
      'Dm' +
      Math.random().toString(36).slice(2, 8) +
      '!' +
      String(Math.floor(10 + Math.random() * 89));
    await admin.auth().updateUser(user.uid, { password: tempPassword });
  }

  const mail = await sendResetMail(email, { resetLink, tempPassword, mode }, adminEmail || null);

  try {
    await db.collection('users').doc(user.uid).set(
      {
        passwordResetRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
        mustChangePassword: true
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('[password-reset] profile flag update failed:', e.message || e);
  }

  return {
    exists: true,
    uid: user.uid,
    mode,
    emailSent: !!mail.sent,
    rewrittenTo: mail.rewrittenTo || null,
    messageId: mail.messageId || null
  };
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

  const action = String(body.action || 'request').trim();
  const email = normalizeEmail(body.email);

  try {
    if (action === 'request' || action === 'admin-request') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResp(400, { error: 'Invalid email' });
      }

      let adminEmail = null;
      if (action === 'admin-request') {
        const gate = await requireAdmin(event);
        if (gate.error) return gate.error;
        adminEmail = gate.email || null;
      }

      const cool = await cooldownOk(email);
      if (!cool.ok) {
        return jsonResp(429, { error: 'Please wait about a minute before requesting another reset email' });
      }

      const result = await issueReset(email, { adminEmail });

      // Public request: do not reveal whether the account exists
      if (action === 'request' && !result.exists) {
        return jsonResp(200, {
          ok: true,
          maskedEmail: maskEmail(email),
          message: 'If an account exists for that email, a reset link has been sent.'
        });
      }
      if (!result.exists) {
        return jsonResp(404, { error: 'No account exists with that email' });
      }

      return jsonResp(200, {
        ok: true,
        maskedEmail: maskEmail(email),
        emailSent: result.emailSent,
        rewrittenTo: result.rewrittenTo,
        message: 'Password reset email sent'
      });
    }

    return jsonResp(400, { error: 'Unknown action' });
  } catch (e) {
    console.error('[password-reset]', e);
    if (e.code === 'smtp_not_configured') {
      return jsonResp(503, { error: e.message, code: e.code });
    }
    if (e.code === 'account_disabled') {
      return jsonResp(403, { error: e.message });
    }
    return jsonResp(500, { error: e.message || 'Server error' });
  }
};
