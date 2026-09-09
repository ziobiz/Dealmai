// ============================================================
// Netlify Function: delete-customer
// ============================================================
// Hard-deletes a user from BOTH Firebase Authentication and Firestore.
// Required because the Web SDK can only delete the currently-signed-in
// user, never an arbitrary one — and leaving an Auth account behind after
// deleting the Firestore profile causes "auth/email-already-exists" the
// next time someone tries to purchase with that email.
//
// Security model:
//   1. Caller must provide a Firebase ID token in Authorization header.
//   2. The token's uid is looked up in Firestore users/{uid}.
//   3. We only proceed if that profile has role='admin'.
//   4. We never let an admin delete themselves (prevents lockout).
//
// Endpoint:  POST /api/delete-customer
// Body:      { "uid": "<firebase-uid-to-delete>" }
// Headers:   Authorization: Bearer <firebase-id-token-of-admin>
// ============================================================

const { admin, db } = require('./lib/firebase-admin-app');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResp(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Method not allowed' });
  }

  // ---- Verify admin caller via Firebase ID token ----
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return jsonResp(401, { error: 'Missing Authorization header' });
  }
  const idToken = m[1];

  let callerUid, callerEmail;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    callerUid = decoded.uid;
    callerEmail = decoded.email;
  } catch (e) {
    console.warn('[delete-customer] Invalid ID token:', e.message);
    return jsonResp(401, { error: 'Invalid or expired ID token' });
  }

  // ---- Check caller is admin in our Firestore profile collection ----
  let callerProfile = null;
  try {
    const snap = await db.collection('users').doc(callerUid).get();
    callerProfile = snap.exists ? snap.data() : null;
  } catch (e) {
    console.error('[delete-customer] Failed to read caller profile:', e);
    return jsonResp(500, { error: 'Could not verify caller permissions' });
  }
  if (!callerProfile || callerProfile.role !== 'admin') {
    console.warn(`[delete-customer] Non-admin caller blocked: uid=${callerUid} email=${callerEmail}`);
    return jsonResp(403, { error: 'Only admins can delete users' });
  }

  // ---- Parse target uid ----
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return jsonResp(400, { error: 'Invalid JSON' }); }

  const targetUid = (body.uid || '').trim();
  if (!targetUid) {
    return jsonResp(400, { error: 'uid is required' });
  }
  if (targetUid === callerUid) {
    return jsonResp(400, { error: 'You cannot delete yourself' });
  }

  // ---- Look up target Firestore profile (for logging + email lookup) ----
  let targetEmail = null;
  let targetRole = null;
  try {
    const snap = await db.collection('users').doc(targetUid).get();
    if (snap.exists) {
      const data = snap.data();
      targetEmail = data.email || null;
      targetRole = data.role || null;
    }
  } catch (e) {
    console.warn('[delete-customer] Failed to read target profile (continuing):', e.message);
  }

  // ---- Delete Firebase Auth account ----
  // Tolerate "user-not-found" — the Auth account may already have been
  // removed manually; we still want to clean up the Firestore profile.
  let authDeleted = false;
  try {
    await admin.auth().deleteUser(targetUid);
    authDeleted = true;
    console.log(`[delete-customer] Deleted Firebase Auth user uid=${targetUid} (${targetEmail || '?'})`);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.warn(`[delete-customer] Auth user ${targetUid} already gone — continuing`);
    } else {
      console.error('[delete-customer] Auth delete failed:', e);
      return jsonResp(500, { error: 'Failed to delete Firebase Auth account', detail: e.message });
    }
  }

  // ---- Delete Firestore profile ----
  let profileDeleted = false;
  try {
    await db.collection('users').doc(targetUid).delete();
    profileDeleted = true;
    console.log(`[delete-customer] Deleted Firestore profile users/${targetUid}`);
  } catch (e) {
    console.error('[delete-customer] Firestore profile delete failed:', e);
    // Don't fail the whole request — the Auth side is already gone, which
    // is the more important half for unblocking future signups.
  }

  // ---- Audit log ----
  try {
    await db.collection('audit_log').add({
      action: 'delete_customer',
      targetUid,
      targetEmail,
      targetRole,
      authDeleted,
      profileDeleted,
      callerUid,
      callerEmail,
      at: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn('[delete-customer] Audit log write failed (non-fatal):', e.message);
  }

  return jsonResp(200, {
    ok: true,
    targetUid,
    targetEmail,
    authDeleted,
    profileDeleted
  });
};
