// ============================================================
// USD → THB Exchange Rate Module
// ============================================================
// Fetches USD to THB exchange rate from a free public API,
// caches it in memory for 1 hour, falls back to FALLBACK_USD_THB_RATE
// or the FX_RATE_USD_THB env var if the API is down.
//
// Free API used: https://open.er-api.com (no key required, ~CC0 license)
//   Spec: https://www.exchangerate-api.com/docs/open-source-rates
// ============================================================

// In-memory cache (persists across function invocations on the SAME Lambda
// instance — cold starts reset it, which is acceptable for our use case)
let _cache = {
  rate: null,
  fetchedAt: 0,
  source: null
};

const CACHE_TTL_MS = 60 * 60 * 1000;  // 1 hour
const FALLBACK_RATE = 35.5;             // sensible default (≈USD/THB May 2026)

// ------------------------------------------------------------
// Fetch USD → THB rate
// Returns { rate, source, cached, fetchedAt }
// ------------------------------------------------------------
async function getUsdToThbRate() {
  const now = Date.now();

  // 1. Manual override via env var (highest priority for sandbox testing)
  const envRate = parseFloat(process.env.FX_RATE_USD_THB);
  if (Number.isFinite(envRate) && envRate > 0) {
    return {
      rate: envRate,
      source: 'env:FX_RATE_USD_THB',
      cached: false,
      fetchedAt: now
    };
  }

  // 2. In-memory cache (still fresh)
  if (_cache.rate && (now - _cache.fetchedAt) < CACHE_TTL_MS) {
    return {
      rate: _cache.rate,
      source: _cache.source,
      cached: true,
      fetchedAt: _cache.fetchedAt
    };
  }

  // 3. Fetch from public API (1-second timeout to avoid blocking the function)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Rate API returned ${res.status}`);
    const data = await res.json();
    const thb = data?.rates?.THB;
    if (!Number.isFinite(thb) || thb <= 0) throw new Error('Invalid THB rate in response');

    _cache = { rate: thb, fetchedAt: now, source: 'open.er-api.com' };
    return { rate: thb, source: 'open.er-api.com', cached: false, fetchedAt: now };
  } catch (e) {
    console.warn(`FX rate fetch failed, using fallback ${FALLBACK_RATE}: ${e.message}`);
    return {
      rate: FALLBACK_RATE,
      source: `fallback (${e.message})`,
      cached: false,
      fetchedAt: now
    };
  }
}

// ------------------------------------------------------------
// Convert USD amount to THB (rounds to 2 decimals)
// Returns { amount, rate, source }
// ------------------------------------------------------------
async function convertUsdToThb(usdAmount) {
  const n = Number(usdAmount);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid USD amount: ${usdAmount}`);
  const { rate, source, cached } = await getUsdToThbRate();
  const thb = Math.round(n * rate * 100) / 100;  // 2 decimal precision
  return { amount: thb, rate, source, cached };
}

module.exports = { getUsdToThbRate, convertUsdToThb, FALLBACK_RATE };
