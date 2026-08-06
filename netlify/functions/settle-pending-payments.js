// ============================================================
// Netlify Scheduled Function: settle-pending-payments
// ============================================================
// Runs every 10 minutes (schedule set in netlify.toml) and asks the payment
// gateway about every order still stuck on 'pending'.
//
// Why this exists: payment gateways drop webhooks. A misconfigured URL, a
// provider outage, or exhausted retries all end the same way — the customer
// paid, but our order never left 'pending', so they got no account, no credits
// and no receipt. Waiting for someone to notice is not an acceptable recovery
// plan for money that has already changed hands.
//
// This is a thin wrapper: all the work lives in check-payment-status.js, which
// the admin "Check Status" button also calls, so a swept order is settled by
// exactly the same code path as a manual check or a callback.
//
// Only orders older than MIN_AGE_MINUTES are considered, so we never race a
// callback that is simply a few seconds behind.
// ============================================================

const { handler: checkHandler } = require('./check-payment-status');

const MIN_AGE_MINUTES = 10;   // don't touch very fresh orders — the callback may still be in flight
const BATCH_LIMIT     = 25;   // cap per run so one sweep can't run long or hammer the provider

exports.handler = async () => {
  console.log(`[settle-pending-payments] sweep start (older than ${MIN_AGE_MINUTES}m, max ${BATCH_LIMIT})`);

  const res = await checkHandler({
    httpMethod: 'POST',
    body: JSON.stringify({ sweep: true, minAgeMinutes: MIN_AGE_MINUTES, limit: BATCH_LIMIT })
  });

  let summary = {};
  try { summary = JSON.parse(res.body || '{}'); } catch {}
  console.log(`[settle-pending-payments] checked=${summary.checked ?? '?'} settled=${summary.settled ?? '?'}`);

  if (Array.isArray(summary.results)) {
    for (const r of summary.results) {
      if (r.settled)      console.log(`[settle-pending-payments] SETTLED ${r.ref} (was ${r.previousStatus})`);
      else if (r.error)   console.warn(`[settle-pending-payments] ${r.ref}: ${r.error}`);
    }
  }

  return { statusCode: 200, body: JSON.stringify(summary) };
};
