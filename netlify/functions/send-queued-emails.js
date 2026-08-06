// ============================================================
// Netlify Scheduled Function: send-queued-emails
// ============================================================
// Runs every 5 minutes. Reads email_queue from Firestore for documents
// with status="pending", renders the appropriate template, sends via Resend,
// then updates the document with status="sent" or "failed".
//
// Required environment variables:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//   RESEND_API_KEY              — get from https://resend.com/api-keys
//   EMAIL_FROM                  — e.g. "Deal Pro <onboarding@resend.dev>"
//   EMAIL_REPLY_TO              — optional, e.g. "support@deal-pro-ai.example"
// ============================================================

const admin = require('firebase-admin');
const { renderEmail } = require('./lib/email-templates');

// Firebase Admin singleton
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
      })
    });
  } catch (e) {
    console.error('Firebase init failed:', e);
  }
}
const db = admin.firestore();

// ------------------------------------------------------------
// Resend HTTP API client (no SDK — keeps function lightweight)
//
// Always BCC the support inbox so the team has a copy of every outbound mail.
const SUPPORT_BCC = 'support@dealmai.com';

// ------------------------------------------------------------
// sendViaResend
//
// fromOntheline: when true, the email originated from the ontheline webhook.
//   For these we intentionally DO NOT deliver to the customer — ontheline
//   already owns the customer relationship and sends its own mail. Instead we
//   redirect the message so ONLY the support inbox receives it (the support
//   address becomes the sole "To"). The customer's real address is never put
//   on the envelope, so they never receive anything. The stored / displayed /
//   exported address is unaffected (it stays the clean customer email).
// ------------------------------------------------------------
async function sendViaResend({ to, subject, html, text, replyTo, fromOntheline }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const from = process.env.EMAIL_FROM || 'Deal Pro <onboarding@resend.dev>';

  // Test-mode recipient rewriting (only if explicitly enabled)
  const rewriteTo = (process.env.EMAIL_TEST_REWRITE_TO || '').trim();
  let actualTo = to;
  let actualSubject = subject;
  if (rewriteTo && rewriteTo.toLowerCase() !== to.toLowerCase()) {
    actualTo = rewriteTo;
    actualSubject = `[TEST → ${to}] ${subject}`;
    console.log(`[send-queued-emails] Rewriting recipient: ${to} → ${rewriteTo} (EMAIL_TEST_REWRITE_TO active)`);
  }

  // Build the envelope.
  //   - Normal mail: To = recipient, Bcc = support (support gets a copy).
  //   - ontheline mail: the message goes ONLY to the support inbox, but we set
  //     the To display-name to the customer's email so support can see at a
  //     glance who it was for — e.g.  "agency4eg@gmail.com" <support@dealmai.com>.
  //     The actual mailbox is still support@dealmai.com, so the customer never
  //     receives anything (their address is only a label, not a real recipient).
  let body;
  if (fromOntheline) {
    // Quote the customer email for the display-name part. Strip any double
    // quotes from it first so we don't break the "name" <addr> syntax.
    const label = String(to || '').replace(/"/g, '');
    body = {
      from,
      to: [`"${label}" <${SUPPORT_BCC}>`],
      subject: `[ontheline → ${to}] ${actualSubject}`,
      html,
      text
    };
    console.log(`[send-queued-emails] ontheline mail for ${to} redirected to support only (customer not delivered)`);
  } else {
    body = {
      from,
      to: [actualTo],
      bcc: [SUPPORT_BCC],
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
      'Authorization': `Bearer ${apiKey}`
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
  return { id: data.id, status: 'sent' };
}

// ------------------------------------------------------------
// Process a single queue document
// ------------------------------------------------------------
async function processEmailDoc(docSnap) {
  const data = docSnap.data();
  const docId = docSnap.id;

  // Render the email content from template
  const order = data.payload || {};
  // Inject document-level fields the template needs
  if (!order.customer) order.customer = { email: data.to };
  if (!order.customer.email) order.customer.email = data.to;
  // createdAt should be a JS Date for the template
  if (order.createdAt?.toDate) order.createdAt = order.createdAt.toDate();
  else if (typeof order.createdAt === 'string' || typeof order.createdAt === 'number') {
    order.createdAt = new Date(order.createdAt);
  }

  const { subject, html, text } = await renderEmail(data.kind, data.lang || 'en', order, db);

  // Send via Resend
  try {
    const fromOntheline = data.source === 'ontheline';
    const result = await sendViaResend({
      to: data.to,
      subject,
      html,
      text,
      replyTo: process.env.EMAIL_REPLY_TO,
      // ontheline-origin emails are redirected to the support inbox only — the
      // customer (data.to) is intentionally NOT delivered to. data.to stays the
      // clean customer address for display/CSV.
      fromOntheline
    });

    // Mark as sent. For ontheline mail we record a distinct status so the admin
    // Email Queue makes it obvious the customer was NOT emailed (support only).
    await docSnap.ref.update({
      status: fromOntheline ? 'sent_support_only' : 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      providerMessageId: result.id || null,
      deliveredTo: fromOntheline ? SUPPORT_BCC : data.to,
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
    // After 5 attempts, mark as failed permanently
    if (attempts >= 5) {
      update.status = 'failed';
      update.failedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    // (Else stays "pending" — will be retried next run)
    await docSnap.ref.update(update);
    return { id: docId, status: attempts >= 5 ? 'failed' : 'retry', error: err.message };
  }
}

// ------------------------------------------------------------
// Scheduled handler
//
// Schedule is configured in netlify.toml under [functions."send-queued-emails"]
// — every 5 minutes (*/5 * * * *)
//
// When invoked by the scheduler, the request body contains:
//   { "next_run": "2026-05-20T14:35:00.000Z" }  (next scheduled invocation)
//
// When invoked manually (via /api/send-emails-now or direct URL), event.httpMethod is set.
// ------------------------------------------------------------
exports.handler = async (event) => {
  // Determine invocation type
  const isHttpInvocation = event.httpMethod === 'GET' || event.httpMethod === 'POST';
  const invocationType = isHttpInvocation ? `manual (${event.httpMethod})` : 'scheduled';

  // Parse next_run if this is a scheduled invocation
  let nextRun = null;
  if (!isHttpInvocation && event.body) {
    try { nextRun = JSON.parse(event.body).next_run; } catch {}
  }

  console.log(`send-queued-emails: invoked (${invocationType})${nextRun ? `, next_run=${nextRun}` : ''}`);

  try {
    // Pull up to 25 pending emails per run (Resend free tier rate-limits to ~10/sec, so we're safe)
    const snap = await db.collection('email_queue')
      .where('status', '==', 'pending')
      .limit(25)
      .get();

    if (snap.empty) {
      const msg = 'No pending emails in queue';
      console.log(msg);
      return isHttpInvocation
        ? { statusCode: 200, body: JSON.stringify({ ok: true, processed: 0, message: msg, invocation: invocationType }) }
        : { statusCode: 200 };
    }

    console.log(`Processing ${snap.size} pending email(s)`);
    const results = [];
    for (const docSnap of snap.docs) {
      const result = await processEmailDoc(docSnap);
      results.push(result);
    }

    const summary = {
      sent: results.filter(r => r.status === 'sent').length,
      retry: results.filter(r => r.status === 'retry').length,
      failed: results.filter(r => r.status === 'failed').length
    };
    console.log('Batch complete:', summary);

    return isHttpInvocation
      ? { statusCode: 200, body: JSON.stringify({ ok: true, processed: results.length, summary, results, invocation: invocationType }) }
      : { statusCode: 200 };

  } catch (e) {
    console.error('Scheduled function failed:', e);
    return isHttpInvocation
      ? { statusCode: 500, body: JSON.stringify({ error: String(e.message || e) }) }
      : { statusCode: 500 };
  }
};

