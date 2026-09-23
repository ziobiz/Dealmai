// ============================================================
// lib/invoice-money.js — settle currency/amount for Invoice Service
// ============================================================
// ICOPAY DP (display FX) can expose shopper JPY alongside settlement THB.
// Formal invoices must use the settlement pair only — never mix THB amount
// with a JPY label (or the reverse).
// ============================================================

const ZERO_DECIMAL = new Set(['JPY', 'KRW']);

function pickStr(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function pickNum(...vals) {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Resolve invoice amount + currency as one coherent settlement pair.
 * @param {object} order
 * @param {object} [extra]
 * @returns {{ amount: number, currency: string, source: string, displayCurrency?: string, displayAmount?: number|null }}
 */
function resolveInvoiceMoney(order = {}, extra = {}) {
  const displayCurrency = pickStr(
    order.displayCurrency,
    order.shopperDisplayCurrency,
    order.displayCurType,
    extra.displayCurrency,
    extra.shopperDisplayCurrency,
  ).toUpperCase();
  const displayAmount = pickNum(
    order.displayAmount,
    order.shopperDisplayAmount,
    order.displayAmt,
    extra.displayAmount,
    extra.shopperDisplayAmount,
  );

  // Explicit settlement fields (preferred when sender provides DP split)
  let currency = pickStr(
    order.settlementCurrency,
    order.chargeCurrency,
    order.gatewayCurrency,
    order.chillpayCurrency,
    extra.settlementCurrency,
    extra.chargeCurrency,
    extra.gatewayCurrency,
    order.currency,
    extra.currency,
    'USD',
  ).toUpperCase();

  let amount = pickNum(
    order.settlementAmount,
    order.chargeAmount,
    order.gatewayAmount,
    order.chillpayAmount,
    extra.settlementAmount,
    extra.chargeAmount,
    extra.gatewayAmount,
    extra.amount,
    order.amountOriginal,
    order.total,
    order.amountUsd,
    0,
  );
  if (amount == null) amount = 0;

  let source = 'settlement';

  // If currency looks like shopper-display but amount is the settlement figure,
  // prefer an explicit settlement currency when both differ.
  if (
    displayCurrency &&
    currency === displayCurrency &&
    pickStr(order.settlementCurrency, extra.settlementCurrency, order.gatewayCurrency, order.chillpayCurrency)
  ) {
    const settleCur = pickStr(
      order.settlementCurrency,
      extra.settlementCurrency,
      order.gatewayCurrency,
      order.chillpayCurrency,
    ).toUpperCase();
    if (settleCur && settleCur !== displayCurrency) {
      currency = settleCur;
      source = 'settlement-over-display-label';
    }
  }

  // Safety: zero-decimal currencies must not carry fractional settlement amounts.
  // Seen in production: amount 1857.97 (THB) labeled JPY.
  if (ZERO_DECIMAL.has(currency) && Number.isFinite(amount) && !Number.isInteger(amount)) {
    const fallback = pickStr(
      order.settlementCurrency,
      extra.settlementCurrency,
      order.gatewayCurrency,
      order.chillpayCurrency,
      'THB',
    ).toUpperCase();
    if (fallback && fallback !== currency) {
      console.warn(
        `[invoice-money] ${currency} with fractional amount ${amount} — coercing currency to ${fallback}`,
      );
      currency = fallback;
      source = 'coerced-fractional-zero-decimal';
    }
  }

  // If we still have display currency equal to invoice currency but a different
  // settlement amount field exists and matches `amount`, keep currency as-is.
  // (no-op; documented for clarity)

  const out = {
    amount,
    currency: currency || 'USD',
    source,
  };
  if (displayCurrency) out.displayCurrency = displayCurrency;
  if (displayAmount != null) out.displayAmount = displayAmount;
  return out;
}

module.exports = {
  resolveInvoiceMoney,
  ZERO_DECIMAL,
};
