const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const PRESENTER_PASSWORD = process.env.PRESENTER_PASSWORD || 'uniandes2026';
const PAGES = new Map([
  ['/', path.join(__dirname, 'upload', 'home.html')],
  ['/index.html', path.join(__dirname, 'upload', 'home.html')],
  ['/zonas', path.join(__dirname, 'upload', 'rappi-zone-simulator.html')],
  ['/zonas/', path.join(__dirname, 'upload', 'rappi-zone-simulator.html')],
  ['/segmentacion', path.join(__dirname, 'upload', 'segmentation-game.html')],
  ['/segmentacion/', path.join(__dirname, 'upload', 'segmentation-game.html')],
]);
const store = new Map();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && PAGES.has(url.pathname)) {
    fs.readFile(PAGES.get(url.pathname), (error, html) => {
      if (error) return sendJson(res, 500, { error: 'Unable to load the simulator' });
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
      });
      res.end(html);
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  if (req.method === 'POST' && url.pathname === '/api/presenter/verify') {
    try {
      const { password } = await readJson(req);
      return sendJson(res, password === PRESENTER_PASSWORD ? 200 : 401, {
        ok: password === PRESENTER_PASSWORD,
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/storage') {
    const key = url.searchParams.get('key');
    const prefix = url.searchParams.get('prefix');
    if (key !== null) {
      return sendJson(res, 200, store.has(key) ? { value: store.get(key) } : { value: null });
    }
    if (prefix !== null) {
      const keys = [...store.keys()].filter(item => item.startsWith(prefix));
      return sendJson(res, 200, { keys });
    }
    return sendJson(res, 400, { error: 'A key or prefix is required' });
  }

  if (req.method === 'PUT' && url.pathname === '/api/storage') {
    try {
      const { key, value } = await readJson(req);
      if (typeof key !== 'string' || typeof value !== 'string') {
        return sendJson(res, 400, { error: 'key and value must be strings' });
      }
      store.set(key, value);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === 'DELETE' && url.pathname === '/api/storage') {
    const key = url.searchParams.get('key');
    if (key === null) return sendJson(res, 400, { error: 'A key is required' });
    store.delete(key);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Rappi Zone Simulator listening on port ${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
