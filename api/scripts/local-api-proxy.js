/**
 * Local-only CORS proxy: Live Server (localhost:5500) → production API.
 *
 * - Auth / most GETs forward to https://api.sekarconstructions.com
 * - CMS writes (POST/PUT /api/admin/*) are saved locally so IIS PUT blocks
 *   and missing remote DB access do not break local Super Admin testing
 * - Matching public GETs prefer the local overlay when present
 *
 *   node scripts/local-api-proxy.js
 *
 * If DNS for api.sekarconstructions.com is missing (ENOTFOUND) but the API
 * still runs on the server IP:
 *   set PROXY_CONNECT_HOST=162.222.225.78
 *   node scripts/local-api-proxy.js
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const LISTEN_PORT = Number(process.env.PROXY_PORT || 3001);
const UPSTREAM = String(process.env.PROXY_UPSTREAM || 'https://api.sekarconstructions.com').replace(/\/$/, '');
/**
 * Optional TCP connect host (IP). Use when DNS for api.sekarconstructions.com is missing
 * but the API still answers on the server IP with Host/SNI = api.sekarconstructions.com.
 * Example: PROXY_CONNECT_HOST=162.222.225.78
 */
const CONNECT_HOST = String(process.env.PROXY_CONNECT_HOST || '').trim();
const STORE_PATH = path.join(__dirname, '..', '.local-cms-store.json');
const ALLOWED_ORIGINS = String(
  process.env.PROXY_CORS_ORIGINS ||
    'http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8080,http://localhost:8080'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Map admin write paths → public read keys used by the site/admin hydrate. */
const ADMIN_WRITE_MAP = {
  '/api/admin/fleet': { key: 'fleet', publicPath: '/api/public/fleet' },
  '/api/admin/financials': { key: 'financials', publicPath: '/api/public/financials' },
  '/api/admin/team-photos': { key: 'team', publicPath: '/api/public/team-photos' },
  '/api/admin/infrastructure': { key: 'infrastructure', publicPath: '/api/public/infrastructure' },
  '/api/admin/ongoing-projects': { key: 'ongoing', publicPath: '/api/public/ongoing-projects' },
  '/api/admin/completed-projects': { key: 'completed', publicPath: '/api/public/completed-projects' },
  '/api/admin/gallery': { key: 'gallery', publicPath: '/api/public/gallery' },
};

function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] ||
        'Content-Type, Authorization, X-CSRF-Token'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
}

function sendJson(req, res, status, body) {
  setCors(req, res);
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function normalizePathname(urlPath) {
  try {
    return new URL(urlPath, 'http://127.0.0.1').pathname.replace(/\/$/, '') || '/';
  } catch {
    return String(urlPath || '').split('?')[0].replace(/\/$/, '') || '/';
  }
}

function findAdminWrite(pathname) {
  if (ADMIN_WRITE_MAP[pathname]) return { ...ADMIN_WRITE_MAP[pathname], pathname };
  const media = pathname.match(/^\/api\/admin\/gallery-media\/([^/]+)$/);
  if (media) {
    const section = media[1].replace(/-/g, '_');
    return {
      key: 'galleryMedia:' + section,
      publicPath: '/api/public/gallery-media/' + section,
      pathname,
      section,
    };
  }
  return null;
}

function findPublicOverlay(pathname) {
  for (const meta of Object.values(ADMIN_WRITE_MAP)) {
    if (meta.publicPath === pathname) return meta.key;
  }
  const media = pathname.match(/^\/api\/public\/gallery-media\/([^/]+)$/);
  if (media) return 'galleryMedia:' + media[1].replace(/-/g, '_');
  if (pathname === '/api/admin/financials') return 'financials';
  return null;
}

async function handleLocalCmsWrite(req, res, meta) {
  const raw = await readBody(req);
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return sendJson(req, res, 400, {
      error: { code: 'INVALID_JSON', message: 'Request body must be JSON.' },
    });
  }

  const store = loadStore();
  store[meta.key] = parsed;
  store.updatedAt = new Date().toISOString();
  saveStore(store);
  console.log(`[local-api-proxy] saved local overlay: ${meta.key}`);
  return sendJson(req, res, 200, parsed);
}

function forward(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = normalizePathname(req.url);
  const method = (req.method || 'GET').toUpperCase();

  // Local CMS publish overlay — avoids IIS PUT 405 / remote DB issues while testing.
  if ((method === 'PUT' || method === 'POST') && pathname.startsWith('/api/admin/')) {
    const meta = findAdminWrite(pathname);
    if (meta && meta.key !== undefined && pathname !== '/api/admin/inquiries') {
      handleLocalCmsWrite(req, res, meta).catch((err) => {
        sendJson(req, res, 500, {
          error: { code: 'LOCAL_STORE_ERROR', message: err.message || 'Local save failed.' },
        });
      });
      return;
    }
  }

  // Prefer local overlay for public/admin reads when a local edit exists.
  if (method === 'GET') {
    const overlayKey = findPublicOverlay(pathname);
    if (overlayKey) {
      const store = loadStore();
      if (Object.prototype.hasOwnProperty.call(store, overlayKey)) {
        console.log(`[local-api-proxy] serving local overlay: ${overlayKey}`);
        sendJson(req, res, 200, store[overlayKey]);
        return;
      }
    }
  }

  const target = new URL(req.url, UPSTREAM);
  const lib = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  delete headers.Origin;
  delete headers['content-length'];
  delete headers['accept-encoding'];

  const requestOpts = {
    protocol: target.protocol,
    hostname: CONNECT_HOST || target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    method,
    headers,
    servername: target.hostname, // TLS SNI must match IIS binding / cert
  };

  const upstreamReq = lib.request(requestOpts, (upstreamRes) => {
    const outHeaders = { ...upstreamRes.headers };
    delete outHeaders['access-control-allow-origin'];
    delete outHeaders['access-control-allow-credentials'];
    delete outHeaders['access-control-allow-headers'];
    delete outHeaders['access-control-allow-methods'];
    setCors(req, res);
    res.writeHead(upstreamRes.statusCode || 502, outHeaders);
    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    sendJson(req, res, 502, {
      error: {
        code: 'PROXY_UPSTREAM_ERROR',
        message: 'Upstream API unreachable: ' + err.message,
      },
    });
  });

  req.pipe(upstreamReq);
}

const server = http.createServer(forward);
server.listen(LISTEN_PORT, '127.0.0.1', () => {
  const via = CONNECT_HOST ? `${UPSTREAM} (via ${CONNECT_HOST})` : UPSTREAM;
  console.log(`[local-api-proxy] http://127.0.0.1:${LISTEN_PORT} → ${via}`);
  console.log(`[local-api-proxy] local CMS store: ${STORE_PATH}`);
  console.log(`[local-api-proxy] CORS: ${ALLOWED_ORIGINS.join(', ')}`);
});
