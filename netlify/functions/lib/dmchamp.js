// ============================================================
// DM Champ API wrapper
// ============================================================
// Thin client for DM Champ's SubAccounts API. Endpoints used:
//   - POST /v1/subaccounts          → create a new sub-account
//   - GET  /v1/subaccounts?email=…  → look up an existing sub-account
//   - POST /v1/subaccounts/credits  → grant additional credits to an
//                                     existing sub-account (top-up flow
//                                     used on repeat purchases)
//
// Authentication: DM Champ uses an API key passed as the `apiKey`
// query parameter (per the GHL/custom-channel integration pattern
// in their docs). Endpoint base is https://api.dmchamp.com/v1.
//
// SubAccounts is an agency-tier feature; non-agency keys will
// receive 403 from the API. We surface that error verbatim so
// admins can see what's wrong.
//
// Configuration source order (highest precedence first):
//   1. Firestore doc `config/dmchamp` (admin-editable at runtime)
//   2. Environment variable DMCHAMP_API_KEY (Netlify dashboard)
//
// Usage:
//   const dmchamp = require('./lib/dmchamp');
//   const cfg = await dmchamp.loadConfig(db);
//   const result = await dmchamp.createSubAccount(cfg, {
//     email, fullName, country, language,
//     monthly_credits  // optional override; otherwise cfg.defaultMonthlyCredits
//   });
// ============================================================

const API_BASE = 'https://api.dmchamp.com/v1';

const DEFAULTS = {
  creditsPerUsd: 100,           // $1 → 100 credits (admin-configurable)
  defaultMonthlyCredits: 1000,  // fallback when amount is unknown
  rollOverToNextMonth: false,
  timeZoneId: 'Asia/Bangkok',
  country: 'TH',
  language: 'en',
  enabled: true,
  // Portal URL is the customer-facing sign-in URL for DM Champ — included
  // in email templates and on the "Open DM Champ" buttons in the customer
  // portal. Default is DM Champ's public app, but agency customers with
  // a White-Label domain (e.g. https://app.dealmai.com) override this
  // through Admin → DM Champ → Portal URL so customers see the branded
  // domain everywhere.
  portalUrl: 'https://app.dmchamp.com'
};

// ------------------------------------------------------------
// Load DM Champ config from Firestore (with env-var fallbacks)
// ------------------------------------------------------------
async function loadConfig(db) {
  let docData = {};
  let brandingDoc = {};
  try {
    const snap = await db.collection('config').doc('dmchamp').get();
    if (snap.exists) docData = snap.data() || {};
  } catch (e) {
    console.warn('[dmchamp] config/dmchamp read failed:', e.message);
  }
  // portalUrl lives in config/branding (public read) so the customer portal
  // can read it without admin privileges. config/dmchamp itself is admin-only
  // because it holds the API key.
  try {
    const bsnap = await db.collection('config').doc('branding').get();
    if (bsnap.exists) brandingDoc = bsnap.data() || {};
  } catch (e) {
    console.warn('[dmchamp] config/branding read failed:', e.message);
  }
  return {
    apiKey:                docData.apiKey                || process.env.DMCHAMP_API_KEY || '',
    creditsPerUsd:         toFiniteNumber(docData.creditsPerUsd, DEFAULTS.creditsPerUsd),
    defaultMonthlyCredits: toFiniteNumber(docData.defaultMonthlyCredits, DEFAULTS.defaultMonthlyCredits),
    rollOverToNextMonth:   typeof docData.rollOverToNextMonth === 'boolean'
                             ? docData.rollOverToNextMonth
                             : DEFAULTS.rollOverToNextMonth,
    timeZoneId:            docData.timeZoneId    || DEFAULTS.timeZoneId,
    country:               docData.country       || DEFAULTS.country,
    language:              docData.language      || DEFAULTS.language,
    enabled:               docData.enabled !== false,  // default true unless explicitly disabled
    // Read portalUrl from config/branding first (public read), then fall back to
    // config/dmchamp.portalUrl for backwards compatibility with any earlier saves.
    portalUrl:             sanitizePortalUrl(brandingDoc.dmchampPortalUrl)
                             || sanitizePortalUrl(docData.portalUrl)
                             || DEFAULTS.portalUrl
  };
}

function sanitizePortalUrl(u) {
  if (typeof u !== 'string') return null;
  const trimmed = u.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function toFiniteNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ------------------------------------------------------------
// Compute credits from a USD amount (rounded to nearest integer).
// Returns null if amount/rate is invalid — caller decides fallback.
// ------------------------------------------------------------
function computeMonthlyCredits(usdAmount, creditsPerUsd) {
  const amt = Number(usdAmount);
  const rate = Number(creditsPerUsd);
  if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return Math.max(1, Math.round(amt * rate));
}

// ------------------------------------------------------------
// Split "First Last Middle" into first_name + last_name halves.
// DM Champ requires both fields. If the customer provided a single
// word, last_name receives an em-dash as a placeholder so the API
// doesn't reject the request.
// ------------------------------------------------------------
function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: 'Customer', last: '—' };
  if (parts.length === 1) return { first: parts[0], last: '—' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// ------------------------------------------------------------
// Map Deal Pro language code (en/th/ko/ja) → DM Champ language.
// DM Champ docs only show 'en' explicitly; we pass our code through
// and let DM Champ ignore unsupported values (it defaults to en).
// ------------------------------------------------------------
function mapLanguage(dealProLang) {
  const l = String(dealProLang || '').toLowerCase();
  return ['en', 'th', 'ko', 'ja'].includes(l) ? l : 'en';
}

// ------------------------------------------------------------
// Map country code from Deal Pro customer.country to ISO-2.
// Deal Pro stores ISO-2 already (TH/KR/JP/US/etc); fall back when
// missing.
// ------------------------------------------------------------
function mapCountry(dealProCountry, fallback) {
  const c = String(dealProCountry || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : (fallback || DEFAULTS.country);
}

// ------------------------------------------------------------
// Create a sub-account in DM Champ. Returns:
//   { ok: true,  data: <response.data>, raw: <response> }
//   { ok: false, error: <message>, status: <httpStatus>, raw: <response> }
// Never throws — callers can record `error` directly into Firestore.
// ------------------------------------------------------------
async function createSubAccount(cfg, input) {
  if (!cfg || !cfg.apiKey) {
    return { ok: false, error: 'DM Champ API key not configured (Admin → Integrations → DM Champ)', status: 0 };
  }
  if (!cfg.enabled) {
    return { ok: false, error: 'DM Champ integration is disabled', status: 0 };
  }
  if (!input || !input.email) {
    return { ok: false, error: 'email is required', status: 0 };
  }

  const { first, last } = splitName(input.fullName);
  const monthlyCredits = Number.isFinite(input.monthly_credits) && input.monthly_credits > 0
    ? Math.round(input.monthly_credits)
    : cfg.defaultMonthlyCredits;

  const body = {
    email:         String(input.email).trim().toLowerCase(),
    first_name:    input.first_name || first,
    last_name:     input.last_name  || last,
    business_name: input.business_name || (input.fullName || 'Customer'),
    description:   input.description   || 'Provisioned by Deal Pro',
    country:       mapCountry(input.country, cfg.country),
    time_zone_id:  input.time_zone_id || cfg.timeZoneId,
    language:      mapLanguage(input.language || cfg.language),
    usage_limits: {
      monthly_credits:         monthlyCredits,
      credits:                 monthlyCredits,
      roll_over_to_next_month: !!cfg.rollOverToNextMonth
    }
  };

  // Optional address fields — only include if caller supplied them
  // (DM Champ accepts them but doesn't require them).
  for (const k of ['address_line', 'city', 'state', 'postal_code']) {
    if (input[k]) body[k] = String(input[k]);
  }

  const url = `${API_BASE}/subaccounts?apiKey=${encodeURIComponent(cfg.apiKey)}`;

  let httpStatus = 0;
  let respText = '';
  let respJson = null;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });
    httpStatus = resp.status;
    respText = await resp.text();
    try { respJson = JSON.parse(respText); } catch { respJson = null; }
  } catch (e) {
    return {
      ok: false,
      error: `Network error calling DM Champ: ${e.message || e}`,
      status: 0,
      raw: null
    };
  }

  if (httpStatus >= 200 && httpStatus < 300 && respJson && respJson.success) {
    return { ok: true, data: respJson.data || respJson, status: httpStatus, raw: respJson };
  }

  // Pull an error message from common shapes
  const errMsg =
       (respJson && (respJson.error || respJson.message)) ||
       (respText && respText.slice(0, 300)) ||
       `HTTP ${httpStatus}`;

  return {
    ok: false,
    error: errMsg,
    status: httpStatus,
    raw: respJson || respText
  };
}

// ------------------------------------------------------------
// Look up an existing sub-account by email.
// Returns { ok: true, found: bool, data?: { uid, email, ... }, status }
// or { ok: false, error, status }.
// Used as the first step of a top-up flow — we need the sub-account's
// uid before we can grant credits to it.
// ------------------------------------------------------------
async function findSubAccount(cfg, email) {
  if (!cfg || !cfg.apiKey) {
    return { ok: false, error: 'DM Champ API key not configured', status: 0 };
  }
  if (!email) {
    return { ok: false, error: 'email is required', status: 0 };
  }

  const url = `${API_BASE}/subaccounts?apiKey=${encodeURIComponent(cfg.apiKey)}&email=${encodeURIComponent(String(email).trim().toLowerCase())}`;

  let httpStatus = 0;
  let respText = '';
  let respJson = null;
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    httpStatus = resp.status;
    respText = await resp.text();
    try { respJson = JSON.parse(respText); } catch { respJson = null; }
  } catch (e) {
    return { ok: false, error: `Network error: ${e.message || e}`, status: 0 };
  }

  // DM Champ returns 200 + { success: true, data: {...} } when found,
  // and 404 (or 200 + { success: false }) when not found. Treat both as
  // non-errors and just signal `found: false`.
  if (httpStatus === 404) {
    return { ok: true, found: false, status: 404 };
  }
  if (httpStatus >= 200 && httpStatus < 300 && respJson && respJson.success === true) {
    const data = respJson.data || {};
    if (!data.email && !data.uid) {
      return { ok: true, found: false, status: httpStatus };
    }
    return { ok: true, found: true, data, status: httpStatus, raw: respJson };
  }
  if (httpStatus >= 200 && httpStatus < 300 && respJson && respJson.success === false) {
    return { ok: true, found: false, status: httpStatus };
  }

  const errMsg = (respJson && (respJson.error || respJson.message)) ||
                 (respText && respText.slice(0, 300)) ||
                 `HTTP ${httpStatus}`;
  return { ok: false, error: errMsg, status: httpStatus, raw: respJson || respText };
}

// ------------------------------------------------------------
// Grant additional credits to an existing sub-account (top-up).
//
// Per DM Champ docs (help.dmchamp.com/agency/sub-account-auto-recharge):
//   POST https://api.dmchamp.com/v1/subaccounts/credits?apiKey=...
//   Content-Type: application/json
//   Body: { email, amount, description? }
//
// Response on success (HTTP 2xx):
//   {
//     "success": true,
//     "sub_account_id": "abc123xyz",
//     "credits_added": 500,
//     "new_balance": 542
//   }
//
// Returns:
//   { ok: true,  data: { sub_account_id, credits_added, new_balance },
//                status, raw }
//   { ok: false, error: <message>, status, raw }
// ------------------------------------------------------------
async function grantCredits(cfg, input) {
  if (!cfg || !cfg.apiKey) {
    return { ok: false, error: 'DM Champ API key not configured', status: 0 };
  }
  if (!cfg.enabled) {
    return { ok: false, error: 'DM Champ integration is disabled', status: 0 };
  }
  const credits = Number(input && input.credits);
  if (!Number.isFinite(credits) || credits <= 0) {
    return { ok: false, error: 'credits must be a positive number', status: 0 };
  }
  if (!input.email) {
    return { ok: false, error: 'email is required (Grant Credits API identifies sub-account by email only)', status: 0 };
  }

  const url = `${API_BASE}/subaccounts/credits?apiKey=${encodeURIComponent(cfg.apiKey)}`;
  const body = {
    email:       String(input.email).trim().toLowerCase(),
    amount:      Math.round(credits),
    description: input.description || 'Top-up via Deal Pro'
  };

  let httpStatus = 0;
  let respText = '';
  let respJson = null;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    httpStatus = resp.status;
    respText = await resp.text();
    try { respJson = JSON.parse(respText); } catch { respJson = null; }
  } catch (e) {
    return {
      ok: false,
      error: `Network error calling DM Champ grant credits: ${e.message || e}`,
      status: 0,
      raw: null
    };
  }

  if (httpStatus >= 200 && httpStatus < 300 && respJson && respJson.success === true) {
    return {
      ok: true,
      data: {
        sub_account_id: respJson.sub_account_id || null,
        credits_added:  respJson.credits_added  || body.amount,
        new_balance:    respJson.new_balance    ?? null
      },
      status: httpStatus,
      raw: respJson
    };
  }

  const errMsg = (respJson && (respJson.error || respJson.message)) ||
                 (respText && respText.slice(0, 300)) ||
                 `HTTP ${httpStatus}`;
  return { ok: false, error: errMsg, status: httpStatus, raw: respJson || respText };
}

// ------------------------------------------------------------
// Health check / config probe — used by Admin → Integrations.
// Returns booleans + non-secret config so the UI can render status
// without ever exposing the API key.
// ------------------------------------------------------------
function describeConfig(cfg) {
  return {
    configured: !!(cfg && cfg.apiKey),
    enabled:    !!(cfg && cfg.enabled),
    creditsPerUsd:         cfg ? cfg.creditsPerUsd         : DEFAULTS.creditsPerUsd,
    defaultMonthlyCredits: cfg ? cfg.defaultMonthlyCredits : DEFAULTS.defaultMonthlyCredits,
    rollOverToNextMonth:   cfg ? cfg.rollOverToNextMonth   : DEFAULTS.rollOverToNextMonth,
    timeZoneId:            cfg ? cfg.timeZoneId            : DEFAULTS.timeZoneId,
    country:               cfg ? cfg.country               : DEFAULTS.country
  };
}

module.exports = {
  API_BASE,
  DEFAULTS,
  loadConfig,
  describeConfig,
  computeMonthlyCredits,
  splitName,
  mapLanguage,
  mapCountry,
  createSubAccount,
  findSubAccount,
  grantCredits
};
