/**
 * Service worker PWA (docs/pwa-ios.md).
 *
 * - Страницы (index.html): сначала сеть, без сети — сохранённая копия. Поэтому новая версия приложения
 *   приходит сама при следующем запуске с сетью: index.html ссылается на новые файлы сборки.
 * - Файлы сборки (/_expo/static, /assets): в имени хэш, содержимое не меняется — сначала кэш.
 * - API (/api) не кэшируется и не перехватывается: там персональные данные, и важна актуальность.
 */
const SHELL_CACHE = 'visit-control-shell-v1';
const STATIC_CACHE = 'visit-control-static-v1';
const KNOWN_CACHES = [SHELL_CACHE, STATIC_CACHE];
/** Файлы сборки копятся от версии к версии; старые вытесняются, когда их больше этого числа */
const MAX_STATIC_ENTRIES = 80;
const SHELL_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([SHELL_URL, '/manifest.webmanifest', '/icons/apple-touch-icon.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => !KNOWN_CACHES.includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/');
}

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_STATIC_ENTRIES;
  for (let i = 0; i < excess; i += 1) {
    await cache.delete(keys[i]);
  }
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(SHELL_URL);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trimStaticCache(cache);
  }
  return response;
}

async function networkFirstFile(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(networkFirstFile(request));
  }
});
