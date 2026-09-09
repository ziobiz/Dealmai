'use strict';

/**
 * Shared Firebase Admin bootstrap for Netlify functions / VPS Express adapter.
 * Safe to require even when FIREBASE_* env vars are missing — getDb() throws
 * only when a handler actually needs Firestore.
 */
const admin = require('firebase-admin');

function ensureApp() {
  if (admin.apps.length) return true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
    return true;
  } catch (e) {
    console.error('Firebase init failed:', e.message || e);
    return false;
  }
}

function getDb() {
  if (!ensureApp()) {
    const err = new Error(
      'Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in /etc/dealmai/env'
    );
    err.code = 'firebase_not_configured';
    err.statusCode = 503;
    throw err;
  }
  return admin.firestore();
}

/** Lazy Firestore accessor — property access calls getDb() once needed. */
const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = getDb();
      const value = real[prop];
      return typeof value === 'function' ? value.bind(real) : value;
    }
  }
);

function firebaseUnavailableResponse(err) {
  return {
    statusCode: err.statusCode || 503,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      error: 'Service Unavailable',
      code: err.code || 'firebase_not_configured',
      message: String(err.message || err)
    })
  };
}

module.exports = {
  admin,
  db,
  getDb,
  ensureApp,
  firebaseUnavailableResponse
};
