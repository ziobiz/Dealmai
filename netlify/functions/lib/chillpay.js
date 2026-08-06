// ============================================================
// ChillPay shared library
// ============================================================
// Encapsulates MD5 checksum calculation, channel/currency constants,
// and URL building. Used by both create-chillpay-payment.js (outbound API call)
// and chillpay-callback.js (inbound webhook handling).
//
// Reference: ChillPay Merchant Integration Manual v1.2.3
// https://chillpay-uploads.s3.ap-southeast-1.amazonaws.com/documents/
//   ChillPay-Merchant-Integration-Manual-Document-EN_v1.2.3.pdf
// ============================================================

const crypto = require('crypto');

// ------------------------------------------------------------
// API endpoints (per ChillPay docs section 2.3)
// ------------------------------------------------------------
const ENDPOINTS = {
  sandbox: {
    api:    'https://sandbox-appsrv2.chillpay.co/api/v2/Payment/',
    cdn:    'https://sandbox-cdnv3.chillpay.co/Payment/'
  },
  production: {
    api:    'https://appsrv.chillpay.co/api/v2/Payment/',
    cdn:    'https://cdn.chillpay.co/Payment/'
  }
};

// ------------------------------------------------------------
// Currency codes (per ISO 4217 — ChillPay Appendix F)
// ------------------------------------------------------------
const CURRENCY_CODES = {
  THB: '764',  // Thai Baht
  USD: '840',  // US Dollar
  EUR: '978',  // Euro
  JPY: '392',  // Japanese Yen (no decimals)
  KRW: '410',  // Korean Won (no decimals)
  SGD: '702',  // Singapore Dollar
  GBP: '826',  // British Pound
  HKD: '344',  // Hong Kong Dollar
  CNY: '156',  // Chinese Yuan
  AUD: '036'   // Australian Dollar
};

// Currencies WITHOUT decimal units (per ChillPay docs)
const NO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW']);

// ------------------------------------------------------------
// Payment channels (per ChillPay Appendix E)
// Empty ChannelCode → ChillPay shows the channel selection page
// ------------------------------------------------------------
const CHANNELS = {
  // Special: let user choose at ChillPay
  ALL: '',

  // Credit card
  CREDIT_CARD:       'creditcard',
  INSTALLMENT_KBANK: 'installment_kbank',
  INSTALLMENT_KTC:   'installment_ktc',

  // QR / PromptPay
  QR_PAYMENT:        'bank_qrcode',

  // Internet banking
  INTERNETBANK_BAY:  'internetbank_bay',
  INTERNETBANK_BBL:  'internetbank_bbl',
  INTERNETBANK_KBANK:'internetbank_kbank',
  INTERNETBANK_SCB:  'internetbank_scb',
  INTERNETBANK_KTB:  'internetbank_ktb',

  // Mobile banking
  KPLUS:             'mobilebank_kplus',
  SCB_EASY:          'mobilebank_scbeasy',
  KMA:               'mobilebank_kma',
  BUALUANG:          'mobilebank_bualuang',
  KRUNGTHAI_NEXT:    'mobilebank_ktbnext',

  // E-wallets
  TRUE_MONEY:        'truemoney_wallet',
  SHOPEEPAY:         'shopeepay',
  PAOTANG:           'paotang',
  RABBIT_LINEPAY:    'rabbit_linepay',

  // International
  ALIPAY:            'alipay',
  WECHAT:            'wechat',

  // Counter / bill payment
  BILL_PAYMENT:      'bill_payment',
  BOONTERM:          'boonterm'
};

// ------------------------------------------------------------
// Convert decimal amount to ChillPay's integer format
// Per docs: "2 Last digits must be decimal value" → e.g. 550.25 = 55025
// JPY/KRW exception: no decimals → 550 = 550 (not 55000)
// ------------------------------------------------------------
function toChillPayAmount(amount, currency = 'THB') {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${amount}`);
  if (NO_DECIMAL_CURRENCIES.has(currency)) {
    // JPY/KRW: 1500 yen → "1500"
    return String(Math.round(n));
  }
  // THB/USD/etc: 50.00 → "5000", 1500.55 → "150055"
  return String(Math.round(n * 100));
}

// Inverse — converts ChillPay's integer back to decimal
function fromChillPayAmount(intAmount, currency = 'THB') {
  const n = Number(intAmount);
  if (!Number.isFinite(n)) return 0;
  if (NO_DECIMAL_CURRENCIES.has(currency)) return n;
  return n / 100;
}

// ------------------------------------------------------------
// Generate ChillPay-compliant OrderNo
// Per docs: max 20 chars, alphanumeric only (no special chars except letters/digits)
// Format: DPCP + YYMMDDHHmm + 4 random alphanumeric chars (20 chars total)
// Example: "DPCP260520143012ABCD"
// ------------------------------------------------------------
function generateOrderNo(prefix = 'DPCP') {
  const now = new Date();
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  // 4 random alphanumeric chars (uppercase A-Z + digits)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude confusables (I,O,1,0)
  let rand = '';
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  const candidate = `${prefix}${yy}${mm}${dd}${hh}${mi}${rand}`;
  // Truncate to 20 chars max (per ChillPay limit)
  return candidate.substring(0, 20);
}

// ------------------------------------------------------------
// Sanitize a string field for ChillPay
// Per docs: "Do not contain special characters such as + - * / - # $ _ or others"
// Customer ID can have inner spaces only (not leading/trailing)
// ------------------------------------------------------------
function sanitizeField(str, maxLen = 100) {
  if (!str) return '';
  // Remove special characters listed in docs and other unsafe ones
  // Keep: letters, digits, spaces, common punctuation safe for URL-encoded forms
  const cleaned = String(str)
    .replace(/[+\-*/#$_\\|<>{}[\]^`~]/g, '')  // strip ChillPay-forbidden chars
    .replace(/\s+/g, ' ')                      // collapse multiple spaces
    .trim()                                    // remove leading/trailing whitespace
    .substring(0, maxLen);
  return cleaned;
}

// ------------------------------------------------------------
// MD5 Checksum for OUTBOUND request (per Table 2.2)
// Per ChillPay docs v1.2.5 Section 2.3 Remarks:
//   "The CheckSum value is to take values from various parameters
//    according to Table 2.2 (item 1 - 20) And append with MD5 Secret Key"
//
//   MerchantCode + OrderNo + CustomerId + Amount + PhoneNumber +
//   Description + ChannelCode + Currency + LangCode + RouteNo +
//   IPAddress + ApiKey + TokenFlag + CreditToken + CreditMonth +
//   ShopID + ProductImageUrl + CustEmail + CardType + CustName +
//   MD5 Secret Key
//
// (20 fields concatenated in this exact order, then MD5SecretKey, then MD5 hash)
//
// NOTE: Older docs (v1.1.x) showed only 19 fields without CustName.
// v1.2.5 adds CustName as field 20 - always use the 20-field version.
// ------------------------------------------------------------
function calculateRequestChecksum(params, md5SecretKey) {
  // Fields MUST be concatenated in this exact order per docs v1.2.5 Table 2.2
  // Empty/missing fields contribute empty strings
  const ordered = [
    params.MerchantCode    || '',
    params.OrderNo         || '',
    params.CustomerId      || '',
    params.Amount          || '',
    params.PhoneNumber     || '',
    params.Description     || '',
    params.ChannelCode     || '',
    params.Currency        || '',
    params.LangCode        || '',
    params.RouteNo         || '',
    params.IPAddress       || '',
    params.ApiKey          || '',
    params.TokenFlag       || '',
    params.CreditToken     || '',
    params.CreditMonth     || '',
    params.ShopID          || '',
    params.ProductImageUrl || '',
    params.CustEmail       || '',
    params.CardType        || '',
    params.CustName        || ''
  ];
  const concat = ordered.join('') + md5SecretKey;
  return crypto.createHash('md5').update(concat, 'utf8').digest('hex');
}

// ------------------------------------------------------------
// MD5 Checksum for INBOUND callback verification (per Table 3.1)
//
// The ChillPay docs v1.2.5 Section 3.1 define the callback POST that
// ChillPay sends to URL Background. The CheckSum field order is:
//
//   TransactionId + Amount + OrderNo + CustomerId + BankCode +
//   PaymentDate + PaymentStatus + BankRefCode + CurrentDate + CurrentTime +
//   PaymentDescription + CreditCardToken + Currency + CustomerName +
//   MerchantCode + RouteNo + MD5 Secret Key
//
// (16 fields concatenated in this exact order, then appended with the
// MD5 Secret Key, then hashed with MD5.)
//
// NOTE: Older versions of ChillPay docs (v1.1.18) showed only 14 fields
// (without MerchantCode + RouteNo at the end). v1.2.5 adds these two,
// which the latest ChillPay system uses. Always use the 16-field version.
//
// Reference: ChillPay Merchant Integration Manual v1.2.5 Section 3.1
// ------------------------------------------------------------
function calculateCallbackChecksum(params, md5SecretKey) {
  const ordered = [
    params.TransactionId      || '',
    params.Amount             || '',
    params.OrderNo            || '',
    params.CustomerId         || '',
    params.BankCode           || '',
    params.PaymentDate        || '',
    params.PaymentStatus      || '',
    params.BankRefCode        || '',
    params.CurrentDate        || '',
    params.CurrentTime        || '',
    params.PaymentDescription || '',
    params.CreditCardToken    || '',
    params.Currency           || '',
    params.CustomerName       || '',
    params.MerchantCode       || '',
    params.RouteNo            || ''
  ];
  const concat = ordered.join('') + md5SecretKey;
  return crypto.createHash('md5').update(concat, 'utf8').digest('hex');
}

// ------------------------------------------------------------
// Build form-urlencoded body from params object
// (ChillPay expects application/x-www-form-urlencoded)
// ------------------------------------------------------------
function toFormBody(params) {
  return Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

// ------------------------------------------------------------
// Get configured API endpoint (sandbox or production)
// Driven by CHILLPAY_MODE env var: "sandbox" (default) or "production"
// ------------------------------------------------------------
function getEndpoint() {
  const mode = (process.env.CHILLPAY_MODE || 'sandbox').toLowerCase();
  return mode === 'production' ? ENDPOINTS.production.api : ENDPOINTS.sandbox.api;
}

function getMode() {
  return (process.env.CHILLPAY_MODE || 'sandbox').toLowerCase();
}

// ------------------------------------------------------------
// Validate that all required ENV vars are set
// Returns an array of missing var names (empty = all present)
// ------------------------------------------------------------
function validateEnv() {
  const required = [
    'CHILLPAY_MERCHANT_CODE',
    'CHILLPAY_API_KEY',
    'CHILLPAY_MD5_SECRET'
  ];
  return required.filter(k => !process.env[k]);
}

module.exports = {
  ENDPOINTS,
  CURRENCY_CODES,
  CHANNELS,
  NO_DECIMAL_CURRENCIES,
  toChillPayAmount,
  fromChillPayAmount,
  generateOrderNo,
  sanitizeField,
  calculateRequestChecksum,
  calculateCallbackChecksum,
  toFormBody,
  getEndpoint,
  getMode,
  validateEnv
};
