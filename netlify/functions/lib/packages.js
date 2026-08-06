// ============================================================
// Package logic shared helpers
// ============================================================
// Encapsulates rules for:
//   - calculating order expiry based on the package(s) bought
//   - bucket-aware expiry semantics
//
// Used by both chillpay-callback.js (when a ChillPay payment flips
// to "paid") and ontheline-webhook.js (when an external webhook
// records an already-paid purchase).
//
// Design (per product decisions agreed with the user):
//
//   * credit buckets       → no expiry (used externally; we don't
//                             track usage, just record purchase)
//   * onetime buckets      → expiresAt = paidAt + durationDays
//   * subscription buckets → treated like onetime (one-shot N-month
//                             access; no auto-renew in this phase)
//
// If a customer purchases ON TOP of an existing not-yet-expired
// subscription/onetime package (same bucket as the existing active
// package), the new expiry is computed by adding the new duration
// onto the existing expiry — i.e. their access is "extended", not
// reset (Option B from the product decision discussion).
//
// Cross-bucket purchases stack: each retains its own expiry.
// ============================================================

/**
 * Compute the date at which a single package's access ends.
 *
 * @param {object} item - One item from order.items[]; must have at
 *   least { bucket?, id?, durationDays? } known. durationDays takes
 *   precedence; if absent, we infer from the id ("onetime.7d" → 7,
 *   "sub.3m" → 90, etc).
 * @param {Date} paidAt - The moment of payment (anchor for the
 *   expiry calculation).
 * @returns {Date|null} - Expiry timestamp, or null for credit-bucket
 *   purchases (which have no time component).
 */
function computeItemExpiry(item, paidAt) {
  if (!item) return null;
  const bucket = (item.bucket || inferBucket(item.id || '')).toLowerCase();

  // Credit packages don't expire
  if (bucket === 'credit') return null;

  // Determine duration in days
  let days = Number(item.durationDays);
  if (!Number.isFinite(days) || days <= 0) {
    days = inferDurationDays(item.id || '');
  }
  if (!days) return null;  // no inferred duration → can't compute

  const base = paidAt instanceof Date ? paidAt : new Date(paidAt);
  if (isNaN(base.getTime())) return null;

  const result = new Date(base.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Compute the *latest* expiry across all items in an order. Returns
 * null if no item has an expiry (e.g. all credit purchases). The
 * latest is used so the order record carries the most-future date.
 *
 * @param {Array} items - order.items[]
 * @param {Date} paidAt
 * @returns {Date|null}
 */
function computeOrderExpiry(items, paidAt) {
  if (!Array.isArray(items) || items.length === 0) return null;
  let latest = null;
  for (const it of items) {
    const e = computeItemExpiry(it, paidAt);
    if (e && (!latest || e.getTime() > latest.getTime())) latest = e;
  }
  return latest;
}

/**
 * Given a customer's existing active orders and a new order's expiry,
 * compute the effective expiry to record for the *new* order so that
 * "extend" semantics work for same-bucket purchases.
 *
 * Approach:
 *   * If the new order's items overlap (by bucket) with an existing
 *     active order whose expiry is still in the future, anchor the
 *     new expiry calculation to the existing expiry instead of paidAt.
 *   * Otherwise, return the natural expiry computed from paidAt.
 *
 * @param {Array} newItems - items being purchased
 * @param {Date} paidAt
 * @param {Array} existingActiveOrders - customer's prior orders that
 *   are status="paid" and expiresAt > now. Each must include items[]
 *   and expiresAt (Date).
 * @returns {Date|null}
 */
function computeOrderExpiryWithExtension(newItems, paidAt, existingActiveOrders = []) {
  if (!Array.isArray(newItems) || newItems.length === 0) return null;

  // Find any existing order whose bucket overlaps with the new items
  const newBuckets = new Set(newItems.map(it => (it.bucket || inferBucket(it.id || '')).toLowerCase()));
  let anchorDate = paidAt instanceof Date ? paidAt : new Date(paidAt);

  for (const prev of existingActiveOrders) {
    if (!prev.expiresAt) continue;
    const prevExpiry = prev.expiresAt instanceof Date ? prev.expiresAt : new Date(prev.expiresAt);
    if (isNaN(prevExpiry.getTime()) || prevExpiry.getTime() <= Date.now()) continue;

    const prevBuckets = new Set((prev.items || []).map(it => (it.bucket || inferBucket(it.id || '')).toLowerCase()));
    // If any bucket overlaps AND it's not just 'credit'
    const overlap = [...newBuckets].some(b => b !== 'credit' && prevBuckets.has(b));
    if (overlap && prevExpiry.getTime() > anchorDate.getTime()) {
      anchorDate = prevExpiry;
    }
  }

  return computeOrderExpiry(newItems, anchorDate);
}

// ----------------------------------------------------------------
// ID-based duration inference (used as fallback when durationDays
// isn't present on the item — typically because the package was
// seeded before we added the field).
// ----------------------------------------------------------------
function inferBucket(id) {
  if (!id) return '';
  if (id.startsWith('credit.')) return 'credit';
  if (id.startsWith('onetime.')) return 'onetime';
  if (id.startsWith('sub.')) return 'sub';
  return '';
}

function inferDurationDays(id) {
  if (!id) return 0;
  // Strip bucket prefix: "onetime.7d" → "7d", "sub.1m" → "1m"
  const suffix = id.split('.').slice(1).join('.');
  return parseSuffix(suffix);
}

function parseSuffix(suffix) {
  const m = String(suffix || '').match(/^(\d+)\s*([dmy])$/i);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (unit === 'd') return n;
  if (unit === 'm') return n * 30;   // approximate
  if (unit === 'y') return n * 365;
  return 0;
}

module.exports = {
  computeItemExpiry,
  computeOrderExpiry,
  computeOrderExpiryWithExtension,
  inferBucket,
  inferDurationDays
};
