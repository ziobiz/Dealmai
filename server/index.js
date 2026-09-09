/**
 * Express adapter that runs Netlify-style functions on a normal Node host.
 * Preserves /.netlify/functions/* and /api/* paths the SPA already calls.
 *
 * Handlers are lazy-loaded on first request so missing Firebase env does not
 * prevent the API process (and routes like payment-result) from starting.
 */
'use strict';

const path = require('path');
const express = require('express');
const cron = require('node-cron');

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
  'server-manage',
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
  '/api/server-manage': 'server-manage',
  '/payment-result': 'payment-result'
};

const handlerCache = Object.create(null);
const handlerErrors = Object.create(null);

function loadHandler(name) {
  if (handlerCache[name]) return handlerCache[name];
  // Allow retry after env is filled and service restarted; also retry once if
  // a previous load failed before Firebase helper existed.
  if (handlerErrors[name]) {
    delete handlerErrors[name];
  }
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(path.join(FUNCTIONS_DIR, name));
    if (typeof mod.handler !== 'function') {
      throw new Error(`Function ${name} has no exports.handler`);
    }
    handlerCache[name] = mod.handler;
    handlerCache[name].__name = name;
    console.log(`[api] loaded ${name}`);
    return handlerCache[name];
  } catch (err) {
    handlerErrors[name] = err;
    console.error(`[api] FAILED to load ${name}:`, err.message);
    throw err;
  }
}

function getHandler(name) {
  return loadHandler(name);
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
    pathParameters: pathMatch ? { gateway: pathMatch[1] } : null,
    requestContext: { functionName }
  };
}

async function invoke(name, req, res) {
  let handler;
  try {
    handler = getHandler(name);
  } catch (err) {
    const firebaseMissing = !process.env.FIREBASE_PROJECT_ID;
    res.status(503).json({
      error: 'Service Unavailable',
      function: name,
      message: String(err.message || err),
      hint: firebaseMissing
        ? 'Set FIREBASE_* (and payment/SMTP) keys in /etc/dealmai/env then restart dealmai-api'
        : 'Check server logs: journalctl -u dealmai-api -n 50'
    });
    return;
  }

  try {
    const event = toNetlifyEvent(req, name);
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
    console.error('[api]', name, err);
    res.status(500).json({ error: 'Internal Server Error', message: String(err.message || err) });
  }
}

function mount(app, route, name) {
  app.all(route, (req, res) => invoke(name, req, res));
  if (!route.endsWith('/')) {
    app.all(`${route}/`, (req, res) => invoke(name, req, res));
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

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
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    loadedFunctions: Object.keys(handlerCache),
    time: new Date().toISOString()
  });
});

for (const name of FUNCTION_NAMES) {
  mount(app, `/.netlify/functions/${name}`, name);
  if (name === 'payment-callback') {
    mount(app, `/.netlify/functions/${name}/:gw`, name);
  }
}

for (const [route, name] of Object.entries(API_ALIASES)) {
  mount(app, route, name);
  if (name === 'payment-callback') {
    mount(app, `${route}/:gw`, name);
  }
}

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] listening on 127.0.0.1:${PORT} (lazy function load)`);
});

try {
  loadHandler('payment-result');
} catch (_) {
  /* ignore */
}

cron.schedule('*/5 * * * *', async () => {
  console.log('[cron] send-queued-emails');
  try {
    const handler = getHandler('send-queued-emails');
    await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {}, body: '' }, {});
  } catch (e) {
    console.error('[cron] send-queued-emails failed', e.message || e);
  }
});

cron.schedule('*/10 * * * *', async () => {
  console.log('[cron] settle-pending-payments');
  try {
    const handler = getHandler('settle-pending-payments');
    await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {}, body: '' }, {});
  } catch (e) {
    console.error('[cron] settle-pending-payments failed', e.message || e);
  }
});
