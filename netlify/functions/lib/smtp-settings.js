// Resolve SMTP account for outbound mail.
// Preference order:
 //   1) Explicit accountId (email_queue.smtpAccountId)
//   2) config/smtp.defaultAccountId
//   3) First enabled smtp_accounts doc
//   4) process.env SMTP_* fallback
// ============================================================

async function loadSmtpSettings(db, accountId) {
  let settings = {};
  try {
    const snap = await db.collection('config').doc('smtp').get();
    if (snap.exists) settings = snap.data() || {};
  } catch (e) {
    console.warn('[smtp] config/smtp read failed:', e.message || e);
  }

  const wantedId = accountId || settings.defaultAccountId || null;
  let account = null;

  if (wantedId) {
    try {
      const snap = await db.collection('smtp_accounts').doc(wantedId).get();
      if (snap.exists) account = { id: snap.id, ...snap.data() };
    } catch (e) {
      console.warn('[smtp] account read failed:', e.message || e);
    }
  }

  if (!account) {
    try {
      const snap = await db
        .collection('smtp_accounts')
        .where('enabled', '==', true)
        .limit(5)
        .get();
      if (!snap.empty) {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        account = docs.find((a) => a.id === settings.defaultAccountId) || docs[0];
      }
    } catch (e) {
      // enabled index may be missing — fall through to list
      try {
        const snap = await db.collection('smtp_accounts').limit(20).get();
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => a.enabled !== false);
        account = docs.find((a) => a.id === settings.defaultAccountId) || docs[0] || null;
      } catch (e2) {
        console.warn('[smtp] smtp_accounts list failed:', e2.message || e2);
      }
    }
  }

  if (account && account.host && account.user && account.pass) {
    const port = Number(account.port || 465);
    const secure =
      account.secure === true ||
      account.secure === 'true' ||
      (!('secure' in account) && port === 465);
    return {
      source: 'firestore',
      accountId: account.id,
      host: String(account.host).trim(),
      port,
      secure,
      user: String(account.user).trim(),
      pass: String(account.pass),
      from: String(account.from || '').trim() || `DealMai <${account.user}>`,
      replyTo: String(settings.replyTo || process.env.EMAIL_REPLY_TO || '').trim() || undefined,
      supportBcc: String(settings.supportBcc || process.env.EMAIL_SUPPORT_BCC || 'support@dealmai.com').trim(),
      testRewriteTo: String(settings.testRewriteTo || process.env.EMAIL_TEST_REWRITE_TO || '').trim()
    };
  }

  // Env fallback
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 465);
    const secureEnv = (process.env.SMTP_SECURE || '').toLowerCase();
    const secure = secureEnv ? secureEnv === 'true' || secureEnv === '1' : port === 465;
    return {
      source: 'env',
      accountId: null,
      host: process.env.SMTP_HOST,
      port,
      secure,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.EMAIL_FROM || `DealMai <${process.env.SMTP_USER}>`,
      replyTo: (process.env.EMAIL_REPLY_TO || '').trim() || undefined,
      supportBcc: (process.env.EMAIL_SUPPORT_BCC || 'support@dealmai.com').trim(),
      testRewriteTo: (process.env.EMAIL_TEST_REWRITE_TO || '').trim()
    };
  }

  return null;
}

module.exports = { loadSmtpSettings };
