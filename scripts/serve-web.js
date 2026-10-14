#!/usr/bin/env node
/**
 * Проверка PWA на компьютере (docs/pwa-ios.md, «Проверка в Chrome на компьютере»).
 *
 * Раздаёт веб-сборку из dist/ и пересылает /api на стенд — как Caddy на сервере, только локально.
 * Адрес localhost браузер считает защищённым, поэтому WebAuthn (Face ID) и service worker работают
 * без HTTPS.
 *
 *   npm run build:web
 *   npm run serve:web            # http://localhost:8099, API — стенд
 *   API_TARGET=http://localhost:8080 PORT=3000 npm run serve:web
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 8099);
// Бэкенд без префикса /api: на стенде его снимает Caddy, здесь — этот скрипт
const apiTarget = new URL(process.env.API_TARGET || 'http://93.77.168.178/api');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('Нет сборки в dist/. Сначала: npm run build:web');
  process.exit(1);
}

function proxyApi(req, res, pathname, search) {
  const targetPath = `${apiTarget.pathname.replace(/\/$/, '')}${pathname.replace(/^\/api/, '')}${search}`;
  const upstream = http.request(
    {
      hostname: apiTarget.hostname,
      port: apiTarget.port || 80,
      path: targetPath,
      method: req.method,
      headers: { ...req.headers, host: apiTarget.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`API недоступно: ${error.message}`);
  });
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      proxyApi(req, res, url.pathname, url.search);
      return;
    }
    let file = path.join(root, decodeURIComponent(url.pathname));
    // Любой адрес экрана — index.html, как try_files в Caddy
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(root, 'index.html');
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => {
    console.log(`PWA: http://localhost:${port}  (API → ${apiTarget.href})`);
  });
