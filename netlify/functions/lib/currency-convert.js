// ============================================================
// Currency → USD conversion
// ============================================================
// Converts an arbitrary ISO-4217 amount to USD for the ontheline
// webhook, so we can compute DM Champ credits (credits-per-USD) and
// show a USD figure alongside the original currency in the admin.
//
// Primary API: Free Currency API (https://freecurrencyapi.com/)
//   - 5,000 requests/month free
//   - Requires an API key in env var FREECURRENCY_API_KEY
//   - Endpoint: https://api.freecurrencyapi.com/v1/latest?apikey=KEY&base_currency=USD
//     Returns { data: { THB: 35.5, JPY: 150.2, ... } } — rates are per 1 USD.
//
// Fallback API: open.er-api.com (no key, used if the key is missing or the
//   primary call fails) — same shape under data.rates.
//
// In-memory cache keyed by base USD, 1-hour TTL (per warm Lambda instance).
// ============================================================

let _cache = { rates: null, fetchedAt: 0, source: null };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Hardcoded fallback rates (per 1 USD) — only used if BOTH APIs fail. These are
// rough and only prevent a hard crash; real rates come from the APIs above.
const FALLBACK_RATES = {
  USD: 1, THB: 35.5, JPY: 150, KRW: 1350, EUR: 0.92,
  GBP: 0.79, CNY: 7.2, SGD: 1.34, AUD: 1.52, HKD: 7.8
};

// ------------------------------------------------------------
// Fetch the full USD-based rate table. Returns { rates, source, cached }.
// `rates[X]` = how many X per 1 USD.
// ------------------------------------------------------------
async function getUsdRates() {
  const now = Date.now();
  if (_cache.rates && (now - _cache.fetchedAt) < CACHE_TTL_MS) {
    return { rates: _cache.rates, source: _cache.source, cached: true };
  }

  const apiKey = (process.env.FREECURRENCY_API_KEY || '').trim();

  // 1. Primary: Free Currency API (if a key is configured)
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      // Per freecurrencyapi docs, sending the key via the `apikey` HTTP header
      // is preferred over the query parameter (the query param can leak into
      // access logs). base_currency defaults to USD; we set it explicitly.
      const res = await fetch(
        'https://api.freecurrencyapi.com/v1/latest?base_currency=USD',
        { signal: controller.signal, headers: { 'Accept': 'application/json', 'apikey': apiKey } }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        const rates = json && json.data;
        // Valid if we got a rates object with at least a few finite numeric
        // entries (don't hard-code specific currencies — a response that
        // happens to omit THB/EUR is still perfectly usable).
        const numericCount = rates && typeof rates === 'object'
          ? Object.values(rates).filter(v => Number.isFinite(Number(v)) && Number(v) > 0).length
          : 0;
        if (numericCount >= 2) {
          rates.USD = 1;
          _cache = { rates, fetchedAt: now, source: 'freecurrencyapi.com' };
          return { rates, source: 'freecurrencyapi.com', cached: false };
        }
        console.warn(`[currency-convert] freecurrencyapi response had no usable rates (count=${numericCount}), falling back`);
      } else if (res.status === 429) {
        // Monthly (5,000) or per-minute quota exceeded — doc says wait it out.
        let detail = '';
        try { detail = (await res.text()).slice(0, 200); } catch (_) {}
        console.warn(`[currency-convert] freecurrencyapi quota/rate-limit hit (429) ${detail}, falling back`);
      } else if (res.status === 401 || res.status === 403) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 200); } catch (_) {}
        console.warn(`[currency-convert] freecurrencyapi auth error (${res.status}) — check FREECURRENCY_API_KEY. ${detail}. Falling back`);
      } else {
        // Surface the body on other non-2xx so problems are visible in logs.
        let detail = '';
        try { detail = (await res.text()).slice(0, 200); } catch (_) {}
        console.warn(`[currency-convert] freecurrencyapi returned ${res.status} ${detail}, falling back`);
      }
    } catch (e) {
      console.warn(`[currency-convert] freecurrencyapi failed: ${e.message}, falling back`);
    }
  }

  // 2. Fallback: open.er-api.com (no key)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal, headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);
    if (res.ok) {
      const json = await res.json();
      const rates = json && json.rates;
      if (rates && typeof rates === 'object' && Number.isFinite(rates.THB)) {
        rates.USD = 1;
        _cache = { rates, fetchedAt: now, source: 'open.er-api.com' };
        return { rates, source: 'open.er-api.com', cached: false };
      }
    }
    console.warn(`[currency-convert] open.er-api returned ${res.status}, using hardcoded fallback`);
  } catch (e) {
    console.warn(`[currency-convert] open.er-api failed: ${e.message}, using hardcoded fallback`);
  }

  // 3. Hardcoded fallback
  return { rates: { ...FALLBACK_RATES }, source: 'hardcoded-fallback', cached: false };
}

// ------------------------------------------------------------
// Convert `amount` in `fromCurrency` to USD.
// Returns { usd, rate, source } where rate = units of fromCurrency per 1 USD.
// usd is rounded to 2 decimals. USD input passes through unchanged.
// ------------------------------------------------------------
async function convertToUsd(amount, fromCurrency) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${amount}`);
  const code = (fromCurrency || 'USD').toString().trim().toUpperCase();
  if (code === 'USD') return { usd: Math.round(n * 100) / 100, rate: 1, source: 'identity' };

  const { rates, source } = await getUsdRates();
  const rate = Number(rates[code]);
  if (!Number.isFinite(rate) || rate <= 0) {
    // Unknown currency in the rate table — fall back to treating as USD so we
    // never crash, but flag the source so the caller can tell.
    console.warn(`[currency-convert] no rate for ${code}, treating amount as USD`);
    return { usd: Math.round(n * 100) / 100, rate: 1, source: `no-rate-for-${code}` };
  }
  const usd = Math.round((n / rate) * 100) / 100; // amount / (units per USD) = USD
  return { usd, rate, source };
}

module.exports = { getUsdRates, convertToUsd, FALLBACK_RATES };
