// ============================================================
// Netlify Scheduled Function: send-queued-emails
// ============================================================
// Runs every 5 minutes. Reads email_queue from Firestore for documents
// with status="pending", renders the appropriate template, sends mail,
// then updates the document with status="sent" or "failed".
//
// Required environment variables:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//
// Mail transport preference:
//   1) Firestore smtp_accounts (+ config/smtp) — managed in Admin → Email SMTP
//   2) Env SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM
//   3) Legacy Resend RESEND_API_KEY
//
// Optional per-queue override: email_queue.smtpAccountId
// ============================================================

const nodemailer = require('nodemailer');
const { admin, db } = require('./lib/firebase-admin-app');
const { renderEmail } = require('./lib/email-templates');
const { loadSmtpSettings } = require('./lib/smtp-settings');

const DEFAULT_SUPPORT_BCC = 'support@dealmai.com';

function envSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createSmtpTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass
    }
  });
}

async function sendViaSmtp(cfg, { to, subject, html, text, fromOntheline }) {
  if (!cfg) throw new Error('No SMTP account configured (Admin → Email SMTP or env SMTP_*)');

  const from = cfg.from;
  const supportBcc = cfg.supportBcc || DEFAULT_SUPPORT_BCC;
  const rewriteTo = (cfg.testRewriteTo || '').trim();
  let actualTo = to;
  let actualSubject = subject;
  if (rewriteTo && rewriteTo.toLowerCase() !== String(to).toLowerCase()) {
    actualTo = rewriteTo;
    actualSubject = `[TEST → ${to}] ${subject}`;
    console.log(`[send-queued-emails] Rewriting recipient: ${to} → ${rewriteTo}`);
  }

  let mail;
  if (fromOntheline) {
    const label = String(to || '').replace(/"/g, '');
    mail = {
      from,
      to: `"${label}" <${supportBcc}>`,
      subject: `[ontheline → ${to}] ${actualSubject}`,
      html,
      text
    };
    console.log(`[send-queued-emails] ontheline mail for ${to} redirected to support only`);
  } else {
    mail = {
      from,
      to: actualTo,
      bcc: supportBcc,
      subject: actualSubject,
      html,
      text
    };
  }
  if (cfg.replyTo) mail.replyTo = cfg.replyTo;

  const transport = createSmtpTransport(cfg);
  const info = await transport.sendMail(mail);
  return {
    id: info.messageId || null,
    status: 'sent',
    provider: 'smtp',
    smtpAccountId: cfg.accountId || null,
    smtpSource: cfg.source
  };
}

async function sendViaResend({ to, subject, html, text, replyTo, fromOntheline }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const from = process.env.EMAIL_FROM || 'Deal Pro <onboarding@resend.dev>';
  const supportBcc = process.env.EMAIL_SUPPORT_BCC || DEFAULT_SUPPORT_BCC;
  const rewriteTo = (process.env.EMAIL_TEST_REWRITE_TO || '').trim();
  let actualTo = to;
  let actualSubject = subject;
  if (rewriteTo && rewriteTo.toLowerCase() !== to.toLowerCase()) {
    actualTo = rewriteTo;
    actualSubject = `[TEST → ${to}] ${subject}`;
    console.log(`[send-queued-emails] Rewriting recipient: ${to} → ${rewriteTo}`);
  }

  let body;
  if (fromOntheline) {
    const label = String(to || '').replace(/"/g, '');
    body = {
      from,
      to: [`"${label}" <${supportBcc}>`],
      subject: `[ontheline → ${to}] ${actualSubject}`,
      html,
      text
    };
  } else {
    body = {
      from,
      to: [actualTo],
      bcc: [supportBcc],
      subject: actualSubject,
      html,
      text
    };
  }
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Resend API ${res.status}`);
    err.code = data.name || `http_${res.status}`;
    err.statusCode = res.status;
    err.fullResponse = data;
    throw err;
  }
  return { id: data.id, status: 'sent', provider: 'resend' };
}

async function sendEmail(opts) {
  const cfg = await loadSmtpSettings(db, opts.smtpAccountId || null);
  if (cfg) return sendViaSmtp(cfg, opts);
  if (envSmtpConfigured()) {
    // loadSmtpSettings already covers env; if it returned null, fall through
  }
  return sendViaResend({
    ...opts,
    replyTo: process.env.EMAIL_REPLY_TO
  });
}

async function processEmailDoc(docSnap) {
  const data = docSnap.data();
  const docId = docSnap.id;

  const order = data.payload || {};
  if (!order.customer) order.customer = { email: data.to };
  if (!order.customer.email) order.customer.email = data.to;
  if (order.createdAt?.toDate) order.createdAt = order.createdAt.toDate();
  else if (typeof order.createdAt === 'string' || typeof order.createdAt === 'number') {
    order.createdAt = new Date(order.createdAt);
  }

  const { subject, html, text } = await renderEmail(data.kind, data.lang || 'en', order, db);

  try {
    const fromOntheline = data.source === 'ontheline';
    const result = await sendEmail({
      to: data.to,
      subject,
      html,
      text,
      fromOntheline,
      smtpAccountId: data.smtpAccountId || null
    });

    const supportBcc = result.provider === 'smtp'
      ? ((await loadSmtpSettings(db, data.smtpAccountId || null)) || {}).supportBcc || DEFAULT_SUPPORT_BCC
      : (process.env.EMAIL_SUPPORT_BCC || DEFAULT_SUPPORT_BCC);

    await docSnap.ref.update({
      status: fromOntheline ? 'sent_support_only' : 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      providerMessageId: result.id || null,
      emailProvider: result.provider || null,
      smtpAccountId: result.smtpAccountId || data.smtpAccountId || null,
      deliveredTo: fromOntheline ? supportBcc : data.to,
      customerDelivered: fromOntheline ? false : true,
      lastError: admin.firestore.FieldValue.delete()
    });
    return { id: docId, status: fromOntheline ? 'sent_support_only' : 'sent', providerId: result.id };
  } catch (err) {
    console.error(`Failed to send ${docId}:`, err.message);
    const attempts = (data.sendAttempts || 0) + 1;
    const update = {
      sendAttempts: attempts,
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: String(err.message || err)
    };
    if (attempts >= 5) {
      update.status = 'failed';
      update.failedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await docSnap.ref.update(update);
    return { id: docId, status: attempts >= 5 ? 'failed' : 'retry', error: err.message };
  }
}

exports.handler = async (event) => {
  const isHttpInvocation = event.httpMethod === 'GET' || event.httpMethod === 'POST';
  const invocationType = isHttpInvocation ? `manual (${event.httpMethod})` : 'scheduled';

  let nextRun = null;
  if (!isHttpInvocation && event.body) {
    try {
      nextRun = JSON.parse(event.body).next_run;
    } catch {}
  }

  const smtpCfg = await loadSmtpSettings(db, null);
  const transport = smtpCfg ? `smtp(${smtpCfg.source})` : (process.env.RESEND_API_KEY ? 'resend' : 'none');

  console.log(
    `send-queued-emails: invoked (${invocationType})${nextRun ? `, next_run=${nextRun}` : ''} transport=${transport}`
  );

  try {
    const snap = await db.collection('email_queue').where('status', '==', 'pending').limit(25).get();

    if (snap.empty) {
      const msg = 'No pending emails in queue';
      console.log(msg);
      return isHttpInvocation
        ? { statusCode: 200, body: JSON.stringify({ ok: true, processed: 0, message: msg, invocation: invocationType, transport }) }
        : { statusCode: 200 };
    }

    console.log(`Processing ${snap.size} pending email(s)`);
    const results = [];
    for (const docSnap of snap.docs) {
      results.push(await processEmailDoc(docSnap));
    }

    const summary = {
      sent: results.filter((r) => r.status === 'sent').length,
      retry: results.filter((r) => r.status === 'retry').length,
      failed: results.filter((r) => r.status === 'failed').length
    };
    console.log('Batch complete:', summary);

    return isHttpInvocation
      ? {
          statusCode: 200,
          body: JSON.stringify({ ok: true, processed: results.length, summary, results, invocation: invocationType, transport })
        }
      : { statusCode: 200 };
  } catch (e) {
    console.error('Scheduled function failed:', e);
    return isHttpInvocation
      ? { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) }
      : { statusCode: 500 };
  }
};
