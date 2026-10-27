'use strict';

// ============================================================
// Payment Gateway Adapter — ICOPay (→ EPS via HQ bindings)
// ============================================================
// DealMai talks only to ICOPay unified checkout. Card acquiring (EPS /
// ElementPay, etc.) is selected in ICOPay HQ merchantPgBindings.
//
// Env:
//   ICOPAY_API_BASE              e.g. https://api.icopay.co.kr
//   ICOPAY_COMP_ID               merchant company code
//   ICOPAY_BROKER_SECRET         live X-Icopay-Merchant-Broker-Secret
//   ICOPAY_BROKER_SECRET_SANDBOX sandbox secret (used when MODE=sandbox)
//   ICOPAY_MODE                  sandbox | production (default sandbox)
//   ICOPAY_CURRENCY              settlement currency (default THB)
//   ICOPAY_NOTIFY_SIGN_SECRET    optional HMAC for X-Icopay-Signature
// ============================================================

const crypto = require('crypto');
const { convertUsdToThb } = require('../exchange-rate');

function getMode() {
  const m = String(process.env.ICOPAY_MODE || 'sandbox').toLowerCase();
  return m === 'production' || m === 'live' ? 'production' : 'sandbox';
}

function apiBase() {
  return String(process.env.ICOPAY_API_BASE || '').replace(/\/+$/, '');
}

function compId() {
  return String(process.env.ICOPAY_COMP_ID || '').trim();
}

function brokerSecret() {
  if (getMode() === 'sandbox') {
    return String(
      process.env.ICOPAY_BROKER_SECRET_SANDBOX || process.env.ICOPAY_BROKER_SECRET || ''
    ).trim();
  }
  return String(process.env.ICOPAY_BROKER_SECRET || '').trim();
}

function settlementCurrency() {
  return String(process.env.ICOPAY_CURRENCY || 'THB').trim().toUpperCase() || 'THB';
}

function publicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://dealmai.com').replace(/\/+$/, '');
}

function generateOrderNo() {
  const now = new Date();
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `DMICO${yy}${mm}${dd}${hh}${mi}${rand}`.substring(0, 32);
}

function countryIso2(customer) {
  const raw = String(customer && (customer.country || customer.nationality) || 'TH')
    .trim()
    .toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  const map = {
    THAILAND: 'TH',
    KOREA: 'KR',
    'SOUTH KOREA': 'KR',
    JAPAN: 'JP',
    CHINA: 'CN',
    SINGAPORE: 'SG',
    USA: 'US',
    'UNITED STATES': 'US'
  };
  return map[raw] || 'TH';
}

/** Local national number only — strip +country / leading zeros carefully. */
function localPhone(customer) {
  const combined = String((customer && customer.phone) || '').trim();
  let digits = combined.replace(/\D/g, '');
  const cc = String((customer && customer.phoneCountryCode) || '').replace(/\D/g, '');
  if (cc && digits.startsWith(cc) && digits.length > cc.length + 4) {
    digits = digits.slice(cc.length);
  }
  // Common trunk zero after country strip
  if (digits.length >= 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 15) || '0000000000';
}

function productName(items) {
  const first = items && items[0] && items[0].title;
  if (!first) return 'DealMai Purchase';
  const extra = items.length > 1 ? ` +${items.length - 1}` : '';
  return String(first + extra).slice(0, 120);
}

function buyerLang(customer) {
  const country = countryIso2(customer);
  if (country === 'TH') return 'THA';
  if (country === 'KR') return 'KOR';
  if (country === 'JP') return 'JPN';
  if (country === 'CN') return 'CHN';
  return 'ENG';
}

function unwrapData(json) {
  if (!json || typeof json !== 'object') return {};
  if (json.data && typeof json.data === 'object') return json.data;
  return json;
}

async function icopayFetch(path, { method = 'GET', body } = {}) {
  const base = apiBase();
  const secret = brokerSecret();
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const headers = {
    Accept: 'application/json',
    'X-Icopay-Merchant-Broker-Secret': secret
  };
  const init = { method, headers };
  if (body != null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    json = { raw: text.slice(0, 500) };
  }
  return { res, json, text };
}

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

module.exports = {
  id: 'icopay',
  displayName: 'ICOPay',
  get currency() {
    return settlementCurrency();
  },
  minAmount: 1,
  refPrefix: 'IC',
  channels: [
    { code: 'icopay', labelKey: 'checkout.channel.any' }
  ],

  validateConfig() {
    const missing = [];
    if (!apiBase()) missing.push('ICOPAY_API_BASE');
    if (!compId()) missing.push('ICOPAY_COMP_ID');
    if (!brokerSecret()) {
      missing.push(
        getMode() === 'sandbox'
          ? 'ICOPAY_BROKER_SECRET_SANDBOX (or ICOPAY_BROKER_SECRET)'
          : 'ICOPAY_BROKER_SECRET'
      );
    }
    return { ok: missing.length === 0, missing };
  },

  describe() {
    return {
      id: 'icopay',
      displayName: 'ICOPay',
      mode: getMode(),
      endpoint: apiBase()
        ? `${apiBase()}/api/middleware/v1/merchant/checkout/prepare`
        : '(ICOPAY_API_BASE not set)',
      currency: settlementCurrency(),
      callbackHint: `${publicSiteUrl()}/.netlify/functions/payment-callback/icopay`,
      env: {
        ICOPAY_API_BASE: apiBase() || '(NOT SET)',
        ICOPAY_COMP_ID: compId() || '(NOT SET)',
        ICOPAY_BROKER_SECRET: process.env.ICOPAY_BROKER_SECRET ? 'set' : '(NOT SET)',
        ICOPAY_BROKER_SECRET_SANDBOX: process.env.ICOPAY_BROKER_SECRET_SANDBOX
          ? 'set'
          : '(NOT SET)',
        ICOPAY_MODE: process.env.ICOPAY_MODE || 'sandbox (default)',
        ICOPAY_CURRENCY: settlementCurrency(),
        ICOPAY_NOTIFY_SIGN_SECRET: process.env.ICOPAY_NOTIFY_SIGN_SECRET ? 'set' : '(optional)'
      }
    };
  },

  async convertAmount(totalUsd) {
    const currency = settlementCurrency();
    if (currency === 'USD') {
      const amount = Math.round(Number(totalUsd) * 100) / 100;
      return { amount, rate: 1, source: 'usd' };
    }
    if (currency === 'THB') {
      const fx = await convertUsdToThb(totalUsd);
      return { amount: fx.amount, rate: fx.rate, source: fx.source };
    }
    // Other currencies: convert via THB intermediate is not available —
    // require FX_RATE_USD_<CUR> or fall back to USD amount labeled wrong.
    const envKey = `FX_RATE_USD_${currency}`;
    const envRate = parseFloat(process.env[envKey]);
    if (Number.isFinite(envRate) && envRate > 0) {
      const amount = Math.round(Number(totalUsd) * envRate * 100) / 100;
      return { amount, rate: envRate, source: `env:${envKey}` };
    }
    const fx = await convertUsdToThb(totalUsd);
    return { amount: fx.amount, rate: fx.rate, source: `${fx.source}+fallbackTHB` };
  },

  async createPayment({ customer, items, amount, headers, ref }) {
    const orderNo = generateOrderNo();
    const body = {
      compId: compId(),
      orderNo,
      amount: Number(amount),
      currency: settlementCurrency(),
      productName: productName(items),
      lang: buyerLang(customer),
      buyer: {
        email: String(customer.email || '').replace(/\+[^@]*(?=@)/, ''),
        phone: localPhone(customer),
        countryIso2: countryIso2(customer)
      }
    };
    const redactedRequest = {
      ...body,
      buyer: { ...body.buyer },
      _mode: getMode()
    };

    console.log(
      `[gateway:icopay] prepare orderNo=${orderNo} amount=${body.amount} ${body.currency}`
    );

    let prepared;
    try {
      prepared = await icopayFetch('/api/middleware/v1/merchant/checkout/prepare', {
        method: 'POST',
        body
      });
    } catch (e) {
      return {
        ok: false,
        error: `ICOPay prepare failed: ${e.message || e}`,
        gatewayOrderNo: orderNo,
        request: redactedRequest,
        raw: null,
        httpStatus: 0
      };
    }

    const data = unwrapData(prepared.json);
    const okHttp = prepared.res.ok;
    const sessionToken = data.sessionToken || data.session_token || null;
    const payUrl = data.payUrl || data.pay_url || null;
    const sandbox = data.sandbox === true || getMode() === 'sandbox';

    if (!okHttp || (!sessionToken && !payUrl)) {
      const errMsg =
        (prepared.json && (prepared.json.message || prepared.json.error)) ||
        (data && (data.message || data.errorCode)) ||
        `ICOPay prepare rejected (HTTP ${prepared.res.status})`;
      return {
        ok: false,
        error: String(errMsg),
        code: data.errorCode || prepared.json.errorCode || null,
        gatewayOrderNo: orderNo,
        request: redactedRequest,
        raw: prepared.json,
        httpStatus: prepared.res.status
      };
    }

    // Sandbox: no card UI — complete immediately, then send buyer to result page.
    if (sandbox || !payUrl) {
      if (!sessionToken) {
        return {
          ok: false,
          error: 'ICOPay sandbox prepare returned no sessionToken',
          gatewayOrderNo: orderNo,
          request: redactedRequest,
          raw: prepared.json,
          httpStatus: prepared.res.status
        };
      }
      let completed;
      try {
        completed = await icopayFetch('/api/middleware/v1/merchant/checkout/complete', {
          method: 'POST',
          body: { compId: compId(), orderNo, sessionToken }
        });
      } catch (e) {
        return {
          ok: false,
          error: `ICOPay sandbox complete failed: ${e.message || e}`,
          gatewayOrderNo: orderNo,
          request: redactedRequest,
          raw: prepared.json,
          httpStatus: 0
        };
      }
      if (!completed.res.ok) {
        const cdata = unwrapData(completed.json);
        return {
          ok: false,
          error:
            completed.json.message ||
            cdata.message ||
            `ICOPay sandbox complete rejected (HTTP ${completed.res.status})`,
          code: cdata.errorCode || null,
          gatewayOrderNo: orderNo,
          request: redactedRequest,
          raw: { prepare: prepared.json, complete: completed.json },
          httpStatus: completed.res.status
        };
      }
      const dealRef = ref || orderNo;
      return {
        ok: true,
        paymentUrl: `${publicSiteUrl()}/payment-result?ref=${encodeURIComponent(dealRef)}`,
        gatewayOrderNo: orderNo,
        gatewayRef: (unwrapData(completed.json).trnId || unwrapData(completed.json).pgTxnId || null),
        expiresAt: null,
        request: redactedRequest,
        raw: { prepare: prepared.json, complete: completed.json, sandbox: true },
        httpStatus: completed.res.status
      };
    }

    return {
      ok: true,
      paymentUrl: payUrl,
      gatewayOrderNo: orderNo,
      gatewayRef: data.trnId || data.pgTxnId || null,
      expiresAt: data.expiresAt || data.expireAt || null,
      request: redactedRequest,
      raw: prepared.json,
      httpStatus: prepared.res.status
    };
  },

  async checkStatus({ gatewayOrderNo }) {
    if (!gatewayOrderNo) {
      return { ok: false, error: 'gatewayOrderNo is required for ICOPay status check' };
    }
    const q = new URLSearchParams({
      compId: compId(),
      orderNo: String(gatewayOrderNo)
    });
    let result;
    try {
      result = await icopayFetch(
        `/api/middleware/v1/merchant/checkout/status?${q.toString()}`,
        { method: 'GET' }
      );
    } catch (e) {
      return { ok: false, error: `ICOPay status failed: ${e.message || e}` };
    }
    const data = unwrapData(result.json);
    const paymentStatus = String(data.paymentStatus || data.status || '').toUpperCase();
    let status = 'pending';
    if (paymentStatus === 'PAID' || paymentStatus === '10' || paymentStatus === '00') {
      status = 'paid';
    } else if (
      /FAIL|CANCEL|EXPIRE|REFUND|CHARGEBACK|REJECT|UNPAID/i.test(paymentStatus) ||
      ['20', '30', '99', '08'].includes(paymentStatus)
    ) {
      status = 'failed';
    }

    return {
      ok: true,
      status,
      rawStatus: paymentStatus,
      gatewayRef: data.trnId || data.pgTxnId || null,
      currency: data.currency || settlementCurrency(),
      fields: {
        paymentStatus,
        trnId: data.trnId || null,
        pgTxnId: data.pgTxnId || null,
        orderNo: data.orderNo || gatewayOrderNo,
        amount: data.amount ?? null
      },
      request: { compId: compId(), orderNo: gatewayOrderNo },
      raw: result.json
    };
  },

  parseBody(rawBody, headers) {
    const ct = String((headers && (headers['content-type'] || headers['Content-Type'])) || '');
    const text = String(rawBody || '');
    if (!text) return {};
    if (ct.includes('application/json') || text.trim().startsWith('{')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        return { _parseError: 'invalid_json', _raw: text.slice(0, 300) };
      }
    }
    const out = {};
    for (const pair of text.split('&')) {
      if (!pair) continue;
      const idx = pair.indexOf('=');
      const key = decodeURIComponent(idx >= 0 ? pair.slice(0, idx) : pair).replace(/\+/g, ' ');
      const val = idx >= 0 ? decodeURIComponent(pair.slice(idx + 1)).replace(/\+/g, ' ') : '';
      out[key] = val;
    }
    return out;
  },

  verifyCallback({ params, headers, rawBody }) {
    const secret = String(process.env.ICOPAY_NOTIFY_SIGN_SECRET || '').trim();
    if (!secret) {
      // Signature optional until HQ configures sign_secret on the notify URL.
      return { ok: true, reason: 'signature_not_configured' };
    }
    const hdr =
      (headers && (headers['x-icopay-signature'] || headers['X-Icopay-Signature'])) || '';
    const m = String(hdr).match(/^v1=([a-fA-F0-9]+)$/);
    if (!m) return { ok: false, reason: 'missing X-Icopay-Signature' };
    const received = m[1].toLowerCase();
    const payload =
      rawBody != null && String(rawBody).length
        ? String(rawBody)
        : JSON.stringify(params || {});
    const computed = hmacSha256Hex(secret, payload);
    if (computed !== received) {
      return { ok: false, reason: 'signature mismatch', received, computed };
    }
    return { ok: true };
  },

  parseCallback(params) {
    const eventName = String(params.event || '');
    const orderNo = params.orderNo || params.OrderNo || null;
    const rawStatus = String(params.status || params.paymentStatus || '');
    const sandbox = params.sandbox === true || eventName === 'pg.payment.sandbox';
    const isPaid =
      rawStatus === '10' ||
      rawStatus === '00' ||
      /^paid$/i.test(rawStatus) ||
      (sandbox && /^paid$/i.test(String(params.paymentStatus || rawStatus)));

    return {
      gatewayOrderNo: orderNo,
      status: isPaid ? 'paid' : 'failed',
      rawStatus,
      gatewayRef: params.trnId || params.pgTxnId || params.TransactionId || null,
      currency: params.currency || null,
      fields: {
        event: eventName || null,
        compId: params.compId || null,
        trnId: params.trnId || null,
        pgTxnId: params.pgTxnId || null,
        amount: params.amount ?? null,
        van: params.van || null,
        paidAt: params.paidAt || null,
        notifyChannel: params.notifyChannel || null,
        merchantNotifyTarget: params.merchantNotifyTarget || null,
        sandbox: sandbox || null
      }
    };
  }
};
