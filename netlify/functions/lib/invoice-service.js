// ============================================================
// lib/invoice-service.js — notify Invoice Service (icopay) on paid orders
// ============================================================
// Best-effort: failures never block DealMai settlement.
// Env (Netlify / VPS):
//   INVOICE_BASE_URL     e.g. https://invoice.icopay.net
//   INVOICE_API_KEY      site API key for code "dealmai"
//   INVOICE_HMAC_SECRET  matching HMAC secret
//   INVOICE_SITE_CODE    default "dealmai"
// ============================================================

const crypto = require('node:crypto');
const { resolveInvoiceMoney } = require('./invoice-money');

function configured() {
  return Boolean(
    process.env.INVOICE_BASE_URL &&
      process.env.INVOICE_API_KEY &&
      process.env.INVOICE_HMAC_SECRET,
  );
}

/**
 * Build webhook payload from a DealMai order (direct ChillPay or ontheline).
 * Amount + currency are always the settlement pair (never display JPY + THB amount).
 * @param {object} order
 * @param {object} [extra]
 */
function buildPayload(order, extra = {}) {
  const site = process.env.INVOICE_SITE_CODE || 'dealmai';
  const money = resolveInvoiceMoney(order, extra);
  const amount = money.amount;
  const currency = money.currency;
  const transactionId = String(
    order.gatewayOrderNo || order.gatewayRef || order.ref || extra.transactionId || '',
  );
  const ticketNo = String(order.ref || extra.ticketNo || transactionId);
  const occurredAt =
    extra.occurredAt ||
    (order.paidAt?.toDate ? order.paidAt.toDate().toISOString() : null) ||
    new Date().toISOString();

  const itemTitles = Array.isArray(order.items)
    ? order.items.map((i) => i.title || i.name || i.code).filter(Boolean).join(', ')
    : '';

  const payload = {
    site,
    event: 'transaction.completed',
    occurredAt,
    transactionId: transactionId || ticketNo,
    ticketNo,
    amount: Number.isFinite(amount) ? amount.toFixed(2) : String(amount),
    currency,
    buyerRef: order.customer?.email || extra.buyerRef || undefined,
    memo: itemTitles || extra.memo || undefined,
  };
  if (money.source && money.source !== 'settlement') {
    console.log(`[invoice-service] money source=${money.source} ${payload.amount} ${payload.currency}`);
  }
  return payload;
}

/**
 * POST completed transaction to Invoice Service.
 * @returns {Promise<{ ok:boolean, skipped?:boolean, invoiceNo?:string, error?:string, status?:number }>}
 */
async function notifyInvoiceService(order, extra = {}) {
  if (!configured()) {
    console.log('[invoice-service] skipped — INVOICE_* env not set');
    return { ok: false, skipped: true, error: 'not_configured' };
  }

  const base = String(process.env.INVOICE_BASE_URL).replace(/\/$/, '');
  const apiKey = process.env.INVOICE_API_KEY;
  const hmacSecret = process.env.INVOICE_HMAC_SECRET;
  const payload = buildPayload(order, extra);
  if (!payload.transactionId || !payload.amount || !payload.currency) {
    return { ok: false, error: 'missing_fields', payload };
  }

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', hmacSecret).update(body, 'utf8').digest('hex');
  const idempotencyKey = `dealmai:${payload.transactionId}:completed`;
  const ts = Math.floor(Date.now() / 1000).toString();

  try {
    const res = await fetch(`${base}/v1/webhooks/transactions/completed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Signature': signature,
        'X-Idempotency-Key': idempotencyKey,
        'X-Timestamp': ts,
      },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[invoice-service] webhook failed', res.status, data.error || data);
      return { ok: false, status: res.status, error: data.error || `http_${res.status}`, data };
    }
    const invoiceNo = data.invoice?.invoiceNo || data.invoice?.invoice_no || null;
    console.log(
      `[invoice-service] ok ref=${order.ref || payload.ticketNo} invoiceNo=${invoiceNo} replay=${!!data.idempotentReplay}`,
    );
    return {
      ok: true,
      invoiceNo,
      invoiceId: data.invoice?.id || null,
      idempotentReplay: !!data.idempotentReplay,
      data,
    };
  } catch (e) {
    console.error('[invoice-service] threw:', e.message || e);
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * Fire webhook and optionally persist result on the Firestore order.
 */
async function notifyAndPersist(orderRef, order, extra = {}) {
  const result = await notifyInvoiceService(order, extra);
  if (orderRef && result && !result.skipped) {
    try {
      await orderRef.update({
        invoiceService: {
          ok: !!result.ok,
          invoiceNo: result.invoiceNo || null,
          invoiceId: result.invoiceId || null,
          error: result.error || null,
          at: new Date().toISOString(),
          idempotentReplay: !!result.idempotentReplay,
        },
      });
    } catch (e) {
      console.warn('[invoice-service] persist failed:', e.message || e);
    }
  }
  return result;
}

module.exports = {
  configured,
  buildPayload,
  notifyInvoiceService,
  notifyAndPersist,
};
