// ============================================================
// Payment Gateway Adapter — ChillPay
// ============================================================
// Implements the Deal Pro payment-gateway contract (see ./index.js) on top of
// the low-level ChillPay helpers in ../chillpay.js.
//
// Everything ChillPay-specific lives here: credentials, endpoint, request
// shape, MD5 checksum, response parsing, callback verification and status
// mapping. The generic functions (create-payment.js / payment-callback.js)
// never reference ChillPay directly — they only speak this contract, so
// swapping in another provider means adding a sibling file, not touching the
// business logic.
//
// Required ENV vars:
//   CHILLPAY_MERCHANT_CODE, CHILLPAY_API_KEY, CHILLPAY_MD5_SECRET
//   CHILLPAY_ROUTE_NO (default "1")
//   CHILLPAY_MODE ("sandbox" | "production", default "sandbox")
// ============================================================

const crypto = require('crypto');
const chillpay = require('../chillpay');
const { convertUsdToThb } = require('../exchange-rate');

// ------------------------------------------------------------
// Map an app country code → ChillPay LangCode (they support TH/EN only)
// ------------------------------------------------------------
function countryToChillPayLang(country) {
  if (!country) return 'EN';
  return String(country).toUpperCase() === 'TH' ? 'TH' : 'EN';
}

// ------------------------------------------------------------
// ChillPay accepts IPv4 ONLY (max 20 chars). Netlify's x-forwarded-for may
// contain IPv6, which fails their validation with Code 1018 "Invalid IP
// Address". Pick the first IPv4 in the chain, unwrapping IPv4-mapped IPv6
// ("::ffff:1.2.3.4" → "1.2.3.4"), else fall back to a value they accept.
// ------------------------------------------------------------
function resolveIpv4(headers = {}) {
  const xff = headers['x-forwarded-for'] || headers['x-nf-client-connection-ip'] || '';
  const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}$/;
  for (const raw of String(xff).split(',')) {
    let candidate = raw.trim();
    const m = candidate.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
    if (m) candidate = m[1];
    if (ipv4Re.test(candidate)) return candidate;
  }
  return '127.0.0.1';
}

module.exports = {
  id: 'chillpay',
  displayName: 'ChillPay',
  // Settlement currency. The generic layer converts the USD order total into
  // this currency before calling createPayment().
  currency: 'THB',
  // Minimum chargeable amount in the settlement currency.
  minAmount: 1,
  // Reference prefix used for orders created through this gateway (DP-CP-XXXXXX)
  refPrefix: 'CP',
  // Channels offered on the checkout page. labelKey maps to an i18n string in
  // app.js so the pills stay translated; a gateway with different channels
  // simply lists its own.
  channels: [
    { code: 'creditcard',       labelKey: 'checkout.channel.card' },
    { code: 'bank_qrcode',      labelKey: 'checkout.channel.qr' },
    { code: 'mobilebank_kplus', labelKey: 'checkout.channel.mobile' },
    { code: 'truemoney_wallet', labelKey: 'checkout.channel.ewallet' }
  ],

  // ----------------------------------------------------------
  // Config check — which env vars are missing?
  // ----------------------------------------------------------
  validateConfig() {
    const missing = chillpay.validateEnv();
    return { ok: missing.length === 0, missing };
  },

  // ----------------------------------------------------------
  // Non-secret info for the admin diagnostics panel
  // ----------------------------------------------------------
  describe() {
    return {
      id: 'chillpay',
      displayName: 'ChillPay',
      mode: chillpay.getMode(),
      endpoint: chillpay.getEndpoint(),
      currency: 'THB',
      env: {
        CHILLPAY_MERCHANT_CODE: process.env.CHILLPAY_MERCHANT_CODE || '(NOT SET)',
        CHILLPAY_API_KEY:       process.env.CHILLPAY_API_KEY ? `set (${process.env.CHILLPAY_API_KEY.length} chars)` : '(NOT SET)',
        CHILLPAY_MD5_SECRET:    process.env.CHILLPAY_MD5_SECRET ? 'set' : '(NOT SET)',
        CHILLPAY_ROUTE_NO:      process.env.CHILLPAY_ROUTE_NO || '1 (default)',
        CHILLPAY_MODE:          process.env.CHILLPAY_MODE || 'sandbox (default)'
      }
    };
  },

  // ----------------------------------------------------------
  // Convert the order's USD total into the settlement currency.
  // Returns { amount, rate, source } — the generic layer stores all three.
  // ----------------------------------------------------------
  async convertAmount(totalUsd) {
    const fx = await convertUsdToThb(totalUsd);
    return { amount: fx.amount, rate: fx.rate, source: fx.source };
  },

  // ----------------------------------------------------------
  // Create a hosted payment and return the URL to redirect the buyer to.
  //
  //   → { ok:true,  paymentUrl, gatewayOrderNo, gatewayRef, expiresAt, request, raw }
  //   → { ok:false, error, code, raw, gatewayOrderNo }
  //
  // `request` is returned (with secrets redacted) so the caller can write it
  // to the audit log without knowing the provider's payload shape.
  // ----------------------------------------------------------
  async createPayment({ customer, items, amount, channel, headers }) {
    const merchantCode = process.env.CHILLPAY_MERCHANT_CODE;
    const apiKey       = process.env.CHILLPAY_API_KEY;
    const md5Secret    = process.env.CHILLPAY_MD5_SECRET;
    const routeNo      = process.env.CHILLPAY_ROUTE_NO || '1';

    const orderNo  = chillpay.generateOrderNo();     // DPCP-yymmddhhmm-XXXX
    const clientIp = resolveIpv4(headers);

    const description = chillpay.sanitizeField(
      items[0]?.title
        ? `${items[0].title}${items.length > 1 ? ` +${items.length - 1}` : ''}`
        : 'Deal Pro Purchase',
      100
    );

    const params = {
      MerchantCode:    merchantCode,
      OrderNo:         orderNo,
      CustomerId:      chillpay.sanitizeField(customer.name, 100),
      Amount:          chillpay.toChillPayAmount(amount, 'THB'),
      PhoneNumber:     (customer.phone || '').replace(/\D/g, '').substring(0, 10),
      Description:     description,
      ChannelCode:     typeof channel === 'string' ? channel : '',   // empty → show all
      Currency:        chillpay.CURRENCY_CODES.THB,
      LangCode:        countryToChillPayLang(customer.country),
      RouteNo:         routeNo,
      IPAddress:       clientIp,
      ApiKey:          apiKey,
      TokenFlag:       'N',
      CreditToken:     '',
      CreditMonth:     '',
      ShopID:          '',
      ProductImageUrl: '',
      // ChillPay's validator rejects Gmail "+tag" addresses. Strip the tag for
      // THEIR copy only — the full address is still used for Firestore,
      // Firebase Auth and Resend.
      CustEmail:       customer.email.replace(/\+[^@]*(?=@)/, ''),
      CardType:        '',
      CustName:        chillpay.sanitizeField(customer.name, 100)
    };
    params.CheckSum = chillpay.calculateRequestChecksum(params, md5Secret);

    const redactedRequest = { ...params, ApiKey: '[redacted]', CheckSum: '[redacted]' };
    const endpoint = chillpay.getEndpoint();

    console.log(`[gateway:chillpay] POST ${endpoint} OrderNo=${orderNo} amount=${amount} THB`);

    let res, data;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        },
        body: chillpay.toFormBody(params)
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      return {
        ok: false,
        error: `ChillPay request failed: ${e.message || e}`,
        gatewayOrderNo: orderNo,
        request: redactedRequest,
        raw: null,
        httpStatus: 0
      };
    }

    console.log(`[gateway:chillpay] response status=${res.status} body=${JSON.stringify(data).substring(0, 500)}`);

    const success = res.ok && (data.Status === 0 || data.Code === 200) && data.PaymentUrl;
    if (!success) {
      return {
        ok: false,
        error: data.Message || 'ChillPay rejected the payment request',
        code: data.Code,
        status: data.Status,
        gatewayOrderNo: orderNo,
        request: redactedRequest,
        raw: data,
        httpStatus: res.status
      };
    }

    return {
      ok: true,
      paymentUrl:     data.PaymentUrl,
      gatewayOrderNo: orderNo,                 // our lookup key on the order doc
      gatewayRef:     data.TransactionId || null,
      token:          data.Token || null,
      createdDate:    data.CreatedDate || null,
      expiresAt:      data.ExpiredDate || null,
      request:        redactedRequest,
      raw:            data,
      httpStatus:     res.status
    };
  },

  // ----------------------------------------------------------
  // Poll ChillPay for a transaction's current status.
  //
  // Used when the background callback never arrived (dropped webhook, provider
  // outage, misconfigured URL Background) so we can settle the order anyway
  // instead of leaving the customer stuck on "pending".
  //
  //   → { ok:true,  status:'paid'|'failed'|'pending', rawStatus, gatewayRef,
  //       fields, raw, request }
  //   → { ok:false, error, raw, request }
  //
  // ⚠️ CHECKSUM FORMULA IS UNVERIFIED. ChillPay's manual documents the
  // PaymentStatus endpoint and its parameters (MerchantCode, TransactionId,
  // RouteNo, CheckSum) but not the exact hash input. We follow the same
  // convention their other endpoints use — concatenate the values in parameter
  // order, append the MD5 secret, hash with MD5 — which is how the request and
  // callback checksums were ultimately resolved for this integration.
  //
  // If ChillPay rejects the checksum, the full request (with the secret
  // redacted) and their response are returned and logged, so the field order
  // can be corrected empirically without guessing blind. Alternative orderings
  // to try, in likely order:
  //   1. MerchantCode + TransactionId + RouteNo            ← current
  //   2. MerchantCode + TransactionId
  //   3. TransactionId + MerchantCode + RouteNo
  // ----------------------------------------------------------
  async checkStatus({ gatewayRef, gatewayOrderNo }) {
    const merchantCode = process.env.CHILLPAY_MERCHANT_CODE;
    const apiKey       = process.env.CHILLPAY_API_KEY;
    const md5Secret    = process.env.CHILLPAY_MD5_SECRET;

    // Per the manual (Table 4.1 note), TransactionId here is ChillPay's own
    // numeric reference — "See data from Table 3.1, Field 1", i.e. the
    // TransactionId they send us on the callback and return from create.
    // It is NOT our order number, so we don't fall back to gatewayOrderNo.
    const txId = gatewayRef;
    if (!txId) {
      return {
        ok: false,
        error: "This order has no ChillPay TransactionId stored, so its status can't be looked up. " +
               "(TransactionId is returned when the payment is created; orders created before it was recorded must be settled manually.)"
      };
    }

    const endpoint = chillpay.getMode() === 'production'
      ? 'https://appsrv.chillpay.co/api/v2/PaymentStatus/'
      : 'https://sandbox-appsrv2.chillpay.co/api/v2/PaymentStatus/';

    // Manual, Table 4.1: MerchantCode, TransactionId, ApiKey, CheckSum.
    // NOTE: RouteNo is NOT part of this request (unlike the payment request) —
    // sending it, or including it in the checksum, makes ChillPay reject the
    // call and reply with an empty shell (PaymentStatus 9, all fields null).
    const params = {
      MerchantCode:  merchantCode,
      TransactionId: String(txId),
      ApiKey:        apiKey
    };

    // CheckSum = MD5(MerchantCode + TransactionId + ApiKey + MD5SecretKey).
    //
    // The manual says to URL-encode ApiKey and the secret first, but the
    // payment-request checksum in this integration was proven empirically to
    // use the RAW secret, so raw is tried first and the encoded form is kept
    // as a fallback for keys that actually contain reserved characters.
    const variants = [
      { name: 'raw',        value: `${merchantCode}${txId}${apiKey}${md5Secret}` },
      { name: 'urlencoded', value: `${merchantCode}${txId}${encodeURIComponent(apiKey)}${encodeURIComponent(md5Secret)}` }
    ];

    // A rejected request comes back fully shaped but empty: PaymentStatus 9,
    // TransactionId 0, MerchantCode null, no ReturnCode. That is not a status —
    // treat it as "try the next variant" so an empty shell is never mistaken
    // for a real answer (and never read as a failed payment).
    const isRealAnswer = (data) => {
      const rc = data.ReturnCode ?? data.Code;
      if (rc != null && Number(rc) !== 0 && Number(rc) !== 200) return false;
      const hasTx    = data.TransactionId != null && Number(data.TransactionId) !== 0;
      const hasOrder = !!data.OrderNo;
      if (String(data.PaymentStatus ?? '') === '9' && !hasTx && !hasOrder) return false;
      return true;
    };

    const attempts = [];
    let lastData = null, lastRes = null, winner = null;

    for (const v of variants) {
      const body = { ...params, CheckSum: crypto.createHash('md5').update(v.value, 'utf8').digest('hex') };

      let res, data;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
          body: chillpay.toFormBody(body)
        });
        data = await res.json().catch(() => ({}));
      } catch (e) {
        return {
          ok: false,
          error: `Status check request failed: ${e.message || e}`,
          request: { ...params, ApiKey: '[redacted]', CheckSum: '[redacted]' },
          attempts,
          raw: null
        };
      }

      lastRes = res; lastData = data;
      const attempt = {
        secretForm: v.name,
        returnCode: data.ReturnCode ?? data.Code ?? null,
        returnMessage: data.ReturnMessage || data.Message || null,
        paymentStatus: data.PaymentStatus ?? null,
        echoedTransactionId: data.TransactionId ?? null
      };
      attempts.push(attempt);
      console.log(`[gateway:chillpay] status check (${v.name}) → PaymentStatus=${attempt.paymentStatus} ReturnCode=${attempt.returnCode ?? '-'} ${attempt.returnMessage || ''}`);

      if (isRealAnswer(data)) { winner = attempt; break; }
    }

    const redactedRequest = { ...params, ApiKey: '[redacted]', CheckSum: '[redacted]' };
    const data = lastData || {};

    if (!winner) {
      return {
        ok: false,
        error: `ChillPay returned no usable status (PaymentStatus=${data.PaymentStatus ?? '-'}, ReturnCode=${data.ReturnCode ?? '-'}${data.ReturnMessage ? ` "${data.ReturnMessage}"` : ''}). Check that the TransactionId belongs to this merchant account and the sandbox/production mode matches.`,
        code: data.ReturnCode ?? data.Code ?? null,
        request: redactedRequest,
        attempts,
        raw: data
      };
    }

    if (!lastRes.ok) {
      return {
        ok: false,
        error: data.ReturnMessage || data.Message || `ChillPay status check returned HTTP ${lastRes.status}`,
        code: data.ReturnCode ?? data.Code ?? null,
        request: redactedRequest,
        attempts,
        raw: data
      };
    }

    // PaymentStatus uses the same encoding as the callback ("0" = success).
    // 9 only shows up on rejected requests, which isRealAnswer already filtered.
    const rawStatus = String(data.PaymentStatus ?? '');
    let status;
    if (rawStatus === '0' || /^paid$/i.test(rawStatus)) status = 'paid';
    else if (rawStatus === '' || /^pending$/i.test(rawStatus)) status = 'pending';
    else status = 'failed';

    return {
      ok: true,
      status,
      rawStatus,
      winner,
      gatewayRef: data.TransactionId ? String(data.TransactionId) : String(txId),
      currency: data.Currency || null,
      fields: {
        transactionId:   data.TransactionId ? String(data.TransactionId) : null,
        bankRefCode:     data.BankRefCode || null,
        bankCode:        data.BankCode || null,
        paymentDate:     data.PaymentDate || null,
        orderNo:         data.OrderNo || null,
        amount:          data.Amount ?? null,
        refundedAmount:  data.RefundedAmount ?? null,
        remarks:         data.Remarks || null,
        customerName:    data.CustomerName || null
      },
      request: redactedRequest,
      attempts,
      raw: data
    };
  },

  // ----------------------------------------------------------
  // Parse the raw callback body into a plain object.
  // ChillPay posts application/x-www-form-urlencoded.
  // ----------------------------------------------------------
  parseBody(rawBody /*, headers */) {
    const out = {};
    if (!rawBody) return out;
    for (const pair of String(rawBody).split('&')) {
      if (!pair) continue;
      const idx = pair.indexOf('=');
      const key = decodeURIComponent(idx >= 0 ? pair.substring(0, idx) : pair).replace(/\+/g, ' ');
      const val = idx >= 0 ? decodeURIComponent(pair.substring(idx + 1)).replace(/\+/g, ' ') : '';
      out[key] = val;
    }
    return out;
  },

  // ----------------------------------------------------------
  // Verify the callback really came from ChillPay (MD5 checksum).
  //   → { ok, reason?, received?, computed? }
  // ----------------------------------------------------------
  verifyCallback({ params }) {
    const md5Secret = process.env.CHILLPAY_MD5_SECRET;
    if (!md5Secret) return { ok: false, reason: 'CHILLPAY_MD5_SECRET not set' };

    const received = params.CheckSum || params.Checksum || '';
    const computed = chillpay.calculateCallbackChecksum(params, md5Secret);
    if (computed.toLowerCase() !== received.toLowerCase()) {
      return { ok: false, reason: 'CheckSum mismatch', received, computed };
    }
    return { ok: true };
  },

  // ----------------------------------------------------------
  // Translate a verified callback into the system's neutral vocabulary.
  //
  //   → { gatewayOrderNo, status:'paid'|'failed', rawStatus, gatewayRef,
  //       currency, fields }
  //
  // `fields` are provider-specific values the generic layer stores verbatim
  // under order.gatewayData for auditing — it never interprets them.
  //
  // Status mapping (ChillPay Appendix B + observed callbacks):
  //   PaymentStatus "0" or "Paid"        → paid
  //   "1" / "2" / "Fail" / "Expired" / … → failed
  // Callbacks carry no separate `Status` field, so PaymentStatus alone decides.
  // ----------------------------------------------------------
  parseCallback(params) {
    const rawStatus = params.PaymentStatus || params.paymentStatus || '';
    const isPaid = rawStatus === '0' || /^paid$/i.test(rawStatus);
    return {
      gatewayOrderNo: params.OrderNo || null,
      status:         isPaid ? 'paid' : 'failed',
      rawStatus,
      gatewayRef:     params.TransactionId || null,
      currency:       params.Currency || null,
      fields: {
        transactionId:      params.TransactionId || null,
        bankRefCode:        params.BankRefCode || null,
        bankCode:           params.BankCode || null,
        paymentDate:        params.PaymentDate || null,
        currentDate:        params.CurrentDate || null,
        currentTime:        params.CurrentTime || null,
        paymentDescription: params.PaymentDescription || null,
        creditCardToken:    params.CreditCardToken || null,
        customerName:       params.CustomerName || null,
        channelCode:        params.ChannelCode || null
      }
    };
  }
};
