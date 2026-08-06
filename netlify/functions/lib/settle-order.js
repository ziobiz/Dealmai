// ============================================================
// lib/settle-order.js — shared "a payment succeeded" pipeline
// ============================================================
// Everything that must happen once an order is confirmed paid, in one place:
//   1. compute the expiry date (with same-bucket extension semantics)
//   2. update the order document
//   3. provision the Firebase Auth user (create, or reissue an unused initial
//      password) and write the users/{uid} profile
//   4. queue the invoice / receipt / credentials emails
//   5. provision the DM Champ sub-account (best effort)
//
// This is called from TWO places, which is why it lives here:
//   • payment-callback.js — the gateway's server-to-server notification
//   • check-payment-status.js — when we poll the gateway because the callback
//     never arrived (dropped webhook, provider outage, misconfigured URL)
//
// It is idempotent at the caller's discretion: callers should skip it when the
// order is already 'paid'. Everything here is gateway-neutral — the provider
// specifics have already been translated by the adapter.
// ============================================================

const pkgLogic = require('./packages');

// ------------------------------------------------------------
// Strong random initial password for newly-provisioned customers
// ------------------------------------------------------------
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$%^&*';
  let pwd = '';
  for (let i = 0; i < length - 2; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  pwd += chars[Math.floor(Math.random() * chars.length)].toUpperCase();
  pwd += special[Math.floor(Math.random() * special.length)];
  return pwd;
}

// ------------------------------------------------------------
// Email language: explicit receiptLang wins, else infer from country
// ------------------------------------------------------------
function emailLangFor(order) {
  const map = { TH: 'th', KR: 'ko', JP: 'ja' };
  return order.receiptLang
      || map[(order.customer?.country || '').toUpperCase()]
      || 'en';
}

/**
 * Compute the expiry date for a newly-paid order.
 *
 * Credit-only orders never expire (null). For onetime/sub packages we look up
 * the customer's other still-active paid orders so a same-bucket repurchase
 * EXTENDS the remaining time instead of replacing it.
 */
async function computeExpiry(db, order) {
  try {
    const paidAtDate = new Date();
    const email = order.customer?.email;
    let existingActive = [];
    if (email) {
      const activeSnap = await db.collection('orders')
        .where('customer.email', '==', email)
        .where('status', '==', 'paid')
        .get();
      existingActive = activeSnap.docs
        .map(d => d.data())
        .filter(o => o.ref !== order.ref)
        .filter(o => {
          if (!o.expiresAt) return false;
          const exp = o.expiresAt.toDate ? o.expiresAt.toDate() : new Date(o.expiresAt);
          return !isNaN(exp.getTime()) && exp.getTime() > paidAtDate.getTime();
        })
        .map(o => ({
          items: o.items || [],
          expiresAt: o.expiresAt.toDate ? o.expiresAt.toDate() : new Date(o.expiresAt)
        }));
    }
    return pkgLogic.computeOrderExpiryWithExtension(order.items || [], paidAtDate, existingActive);
  } catch (e) {
    console.warn('[settle-order] expiry computation failed:', e.message || e);
    return null;
  }
}

/**
 * Run the full "order is paid" pipeline.
 *
 * @param {object}   deps.db          Firestore instance (Admin SDK)
 * @param {object}   deps.admin       firebase-admin
 * @param {object}   deps.order       the order data
 * @param {object}   deps.orderRef    Firestore DocumentReference for the order
 * @param {object}   deps.updateData  provider-specific fields to merge into the
 *                                    order alongside status/paidAt/expiresAt
 * @param {string}   deps.source      'callback' | 'status-check' (for logs/audit)
 * @param {function} deps.provisionDmChamp  provisionForOrder from provision-dmchamp
 * @returns {object} notes to fold into the audit entry
 */
async function settlePaidOrder({ db, admin, order, orderRef, updateData = {}, source = 'callback', provisionDmChamp }) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const notes = {};
  const tag = `[settle-order:${source}]`;

  // ---- 1 + 2. Expiry + order update ----
  const expiresAt = await computeExpiry(db, order);
  await orderRef.update({
    ...updateData,
    status:    'paid',
    paidAt:    now,
    expiresAt,
    updatedAt: now
  });
  console.log(`${tag} order ${order.ref} → paid (expiresAt=${expiresAt ? expiresAt.toISOString() : 'null'})`);

  // ---- 3. Provision the customer ----
  const email = order.customer?.email;
  let initialPassword = null;

  if (email) {
    try {
      let userRecord = null;
      let isNewUser = false;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
        console.log(`${tag} user ${email} exists (uid=${userRecord.uid})`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          initialPassword = generatePassword();
          userRecord = await admin.auth().createUser({
            email,
            password: initialPassword,
            displayName: order.customer?.name || ''
          });
          isNewUser = true;
          console.log(`${tag} created user ${email} (uid=${userRecord.uid})`);

          await db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            name: order.customer?.name || '',
            role: 'customer',
            source: 'direct',
            gateway: order.gateway || null,
            mustChangePassword: true,
            createdAt: now
          }, { merge: true });
        } else {
          throw err;
        }
      }

      // Existing user who never set their own password (repeat purchase before
      // first login): issue fresh credentials so the email is usable. We never
      // overwrite a password the customer chose themselves.
      if (!isNewUser && userRecord) {
        const profileSnap = await db.collection('users').doc(userRecord.uid).get();
        const profile = profileSnap.exists ? profileSnap.data() : {};
        if (profile.mustChangePassword === true || !profileSnap.exists) {
          initialPassword = generatePassword();
          await admin.auth().updateUser(userRecord.uid, { password: initialPassword });
          await db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            name: order.customer?.name || profile.name || '',
            role: profile.role || 'customer',
            source: profile.source || 'direct',
            mustChangePassword: true,
            createdAt: profile.createdAt || now
          }, { merge: true });
          console.log(`${tag} reset initial password for pending user ${email}`);
        } else {
          console.log(`${tag} ${email} has set their own password — credentials email omits it`);
        }
      }
    } catch (e) {
      console.error(`${tag} user provisioning error:`, e);
      notes.userProvisionError = String(e.message || e);
    }
  }

  // ---- 4. Queue emails ----
  const emailLang = emailLangFor(order);
  const emailPayloadBase = {
    ref: order.ref,
    customer: order.customer,
    items: order.items,
    subtotal: order.subtotal,
    vat: order.vat,
    total: order.total,
    currency: order.currency || 'USD',
    createdAt: order.createdAt,
    receiptLang: emailLang,
    initialPassword
  };

  const emailKinds = ['invoice', 'receipt', 'credentials'];
  for (const kind of emailKinds) {
    await db.collection('email_queue').add({
      to: email,
      kind,
      orderRef: order.ref,
      lang: emailLang,
      status: 'pending',
      payload: emailPayloadBase,
      createdAt: now
    });
  }
  console.log(`${tag} queued ${emailKinds.length} emails for ${email} (lang=${emailLang})`);
  notes.emailsQueued = emailKinds.length;

  // ---- 5. DM Champ (best effort) ----
  // If DM Champ is down or misconfigured the order still counts as settled;
  // an admin can retry from the Orders page.
  try {
    const freshSnap = await orderRef.get();
    const dmResult = await provisionDmChamp(db, admin, freshSnap.data(), orderRef, { source: 'auto' });
    if (dmResult.ok) {
      notes.dmchampProvisioned = true;
      notes.dmchampUid = dmResult.data?.uid || null;
      console.log(`${tag} DM Champ provisioned for ${order.ref}`);
    } else if (dmResult.disabled) {
      notes.dmchampProvisioned = false;
      notes.dmchampSkipped = 'integration disabled';
    } else {
      notes.dmchampProvisioned = false;
      notes.dmchampError = dmResult.error;
      console.warn(`${tag} DM Champ provisioning failed (retry via admin): ${dmResult.error}`);
    }
  } catch (e) {
    notes.dmchampProvisioned = false;
    notes.dmchampError = String(e.message || e);
    console.error(`${tag} DM Champ provisioning threw:`, e);
  }

  return notes;
}

module.exports = { settlePaidOrder, computeExpiry, generatePassword, emailLangFor };
