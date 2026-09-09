/**
 * Express adapter that runs Netlify-style functions on a normal Node host.
 * Preserves /.netlify/functions/* and /api/* paths the SPA already calls.
 */
'use strict';

const path = require('path');
const express = require('express');
const cron = require('node-cron');

// Load secrets from /etc/dealmai/env (preferred) or local .env
require('dotenv').config({ path: '/etc/dealmai/env' });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const FUNCTIONS_DIR = path.join(__dirname, '..', 'netlify', 'functions');

const FUNCTION_NAMES = [
  'check-payment-status',
  'chillpay-callback',
  'convert-currency',
  'create-chillpay-payment',
  'create-payment',
  'delete-customer',
  'ontheline-webhook',
  'payment-callback',
  'payment-result',
  'provision-dmchamp',
  'send-queued-emails',
  'settle-pending-payments'
];

const API_ALIASES = {
  '/api/ontheline-webhook': 'ontheline-webhook',
  '/api/send-emails-now': 'send-queued-emails',
  '/api/create-payment': 'create-payment',
  '/api/check-payment-status': 'check-payment-status',
  '/api/payment-callback': 'payment-callback',
  '/api/create-chillpay-payment': 'create-chillpay-payment',
  '/api/chillpay-callback': 'chillpay-callback',
  '/api/delete-customer': 'delete-customer',
  '/api/provision-dmchamp': 'provision-dmchamp',
  '/api/convert-currency': 'convert-currency',
  '/payment-result': 'payment-result'
};

function loadHandler(name) {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const mod = require(path.join(FUNCTIONS_DIR, name));
  if (typeof mod.handler !== 'function') {
    throw new Error(`Function ${name} has no exports.handler`);
  }
  return mod.handler;
}

function toNetlifyEvent(req, functionName) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    headers[k] = Array.isArray(v) ? v.join(',') : String(v);
  }

  let body = req.body;
  let isBase64Encoded = false;
  if (Buffer.isBuffer(body)) {
    body = body.toString('base64');
    isBase64Encoded = true;
  } else if (body && typeof body === 'object') {
    // express.json / urlencoded already parsed — re-serialize for handlers
    // that expect a raw string (most of ours do).
    const ct = (headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
      body = JSON.stringify(body);
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      body = new URLSearchParams(body).toString();
    } else {
      body = JSON.stringify(body);
    }
  } else if (body == null) {
    body = '';
  } else {
    body = String(body);
  }

  const queryStringParameters = { ...req.query };
  // Path form: /.netlify/functions/payment-callback/chillpay
  const pathMatch = (req.path || '').match(
    /\/(?:\.netlify\/functions|api)\/payment-callback\/([^/?#]+)/i
  );
  if (pathMatch && !queryStringParameters.gw) {
    queryStringParameters.gw = pathMatch[1];
  }

  return {
    httpMethod: req.method,
    path: req.originalUrl.split('?')[0],
    rawUrl: req.originalUrl,
    headers,
    queryStringParameters,
    multiValueQueryStringParameters: null,
    body,
    isBase64Encoded,
    // Handy for handlers that inspect path segments
    pathParameters: pathMatch ? { gateway: pathMatch[1] } : null,
    requestContext: { functionName }
  };
}

async function invoke(handler, req, res) {
  try {
    const event = toNetlifyEvent(req, handler.__name || 'unknown');
    const result = await handler(event, {});
    if (!result || typeof result !== 'object') {
      res.status(500).type('text').send('Empty function response');
      return;
    }
    const status = result.statusCode || 200;
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        if (v != null) res.setHeader(k, v);
      }
    }
    if (result.isBase64Encoded && result.body) {
      res.status(status).send(Buffer.from(result.body, 'base64'));
      return;
    }
    res.status(status).send(result.body == null ? '' : result.body);
  } catch (err) {
    console.error('[api]', err);
    res.status(500).json({ error: 'Internal Server Error', message: String(err.message || err) });
  }
}

function mount(app, route, name, handler) {
  handler.__name = name;
  app.all(route, (req, res) => invoke(handler, req, res));
  // Also accept trailing slash
  if (!route.endsWith('/')) {
    app.all(`${route}/`, (req, res) => invoke(handler, req, res));
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Raw-ish body: keep both JSON and form; handlers re-serialize as needed.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.text({ type: ['text/*', 'application/xml'], limit: '2mb' }));

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    service: 'dealmai-api',
    firebaseConfigured: Boolean(
      process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    ),
    time: new Date().toISOString()
  });
});

const handlers = {};
for (const name of FUNCTION_NAMES) {
  try {
    handlers[name] = loadHandler(name);
    console.log(`[api] loaded ${name}`);
  } catch (err) {
    console.error(`[api] FAILED to load ${name}:`, err.message);
  }
}

// Primary Netlify paths (what app.js calls)
for (const name of FUNCTION_NAMES) {
  if (!handlers[name]) continue;
  mount(app, `/.netlify/functions/${name}`, name, handlers[name]);
  // Path-style gateway id for payment-callback
  if (name === 'payment-callback') {
    mount(app, `/.netlify/functions/${name}/:gw`, name, handlers[name]);
  }
}

// Clean aliases from netlify.toml
for (const [route, name] of Object.entries(API_ALIASES)) {
  if (!handlers[name]) continue;
  mount(app, route, name, handlers[name]);
  if (name === 'payment-callback') {
    mount(app, `${route}/:gw`, name, handlers[name]);
  }
}

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] listening on 127.0.0.1:${PORT}`);
});

// ---- Cron (replaces Netlify scheduled functions) ----
if (handlers['send-queued-emails']) {
  cron.schedule('*/5 * * * *', async () => {
    console.log('[cron] send-queued-emails');
    try {
      await handlers['send-queued-emails'](
        { httpMethod: 'GET', headers: {}, queryStringParameters: {}, body: '' },
        {}
      );
    } catch (e) {
      console.error('[cron] send-queued-emails failed', e);
    }
  });
}

if (handlers['settle-pending-payments']) {
  cron.schedule('*/10 * * * *', async () => {
    console.log('[cron] settle-pending-payments');
    try {
      await handlers['settle-pending-payments'](
        { httpMethod: 'GET', headers: {}, queryStringParameters: {}, body: '' },
        {}
      );
    } catch (e) {
      console.error('[cron] settle-pending-payments failed', e);
    }
  });
}
