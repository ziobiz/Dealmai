'use strict';

const { GoogleAuth } = require('google-auth-library');

const LIMITS = {
  reads: 50000,
  writes: 20000,
  deletes: 20000
};

const METRICS = {
  reads: 'firestore.googleapis.com/document/read_count',
  writes: 'firestore.googleapis.com/document/write_count',
  deletes: 'firestore.googleapis.com/document/delete_count'
};

function tzParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  return map;
}

/** Current Firestore free-quota day: midnight to midnight in America/Los_Angeles. */
function pacificQuotaWindow(now = new Date()) {
  const zone = 'America/Los_Angeles';
  const wall = tzParts(now, zone);
  const wallAsUtc = Date.UTC(+wall.year, +wall.month - 1, +wall.day, +wall.hour, +wall.minute, +wall.second);
  const offsetMs = wallAsUtc - now.getTime();
  const start = new Date(Date.UTC(+wall.year, +wall.month - 1, +wall.day, 0, 0, 0) - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function formatKst(date) {
  const p = tzParts(date, 'Asia/Seoul');
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

function pointValue(point) {
  const v = (point && point.value) || {};
  const n = Number(v.int64Value != null ? v.int64Value : v.doubleValue);
  return Number.isFinite(n) ? n : 0;
}

function sumSeries(series) {
  let total = 0;
  for (const row of series || []) {
    for (const point of row.points || []) total += pointValue(point);
  }
  return total;
}

async function sumMetric(client, projectId, metric, start, end) {
  const params = new URLSearchParams({
    filter: `metric.type="${metric}"`,
    'interval.startTime': start.toISOString(),
    'interval.endTime': end.toISOString(),
    'aggregation.alignmentPeriod': '86400s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM'
  });
  const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params}`;
  const res = await client.request({ url });
  return sumSeries(res.data && res.data.timeSeries);
}

async function fetchFirestoreQuota(now = new Date()) {
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const window = pacificQuotaWindow(now);
  const queryEnd = now < window.end ? now : window.end;
  const base = {
    ok: true,
    limits: LIMITS,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    windowStartKst: formatKst(window.start),
    windowEndKst: formatKst(window.end)
  };
  if (!projectId || !clientEmail || !privateKey) {
    return { ...base, ok: false, code: 'config', error: 'Firebase service account is not configured' };
  }
  if (queryEnd.getTime() <= window.start.getTime()) {
    return {
      ...base,
      used: { reads: 0, writes: 0, deletes: 0 }
    };
  }
  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/monitoring.read']
  });
  try {
    const client = await auth.getClient();
    const used = {};
    for (const key of Object.keys(METRICS)) {
      used[key] = await sumMetric(client, projectId, METRICS[key], window.start, queryEnd);
    }
    return { ...base, used };
  } catch (err) {
    const status = err.response && err.response.status;
    const message = (err.response && err.response.data && err.response.data.error && err.response.data.error.message)
      || err.message
      || String(err);
    const permission = status === 403 || /permission|monitoring\.timeSeries/i.test(message);
    return {
      ...base,
      ok: false,
      code: permission ? 'permission' : 'monitoring',
      error: message
    };
  }
}

module.exports = {
  LIMITS,
  pacificQuotaWindow,
  formatKst,
  sumSeries,
  fetchFirestoreQuota
};
