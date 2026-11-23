const scope = new URL(self.registration.scope);
const prefix = 'research-phd:' + scope.href + ':';
const cacheName = prefix + '87c5c09448a90695';
const files = ["index.html", "calendar.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "assets/index-BwGwwjt1.js", "assets/index-oXA-mCjr.css"].map(file => new URL(file, scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  const home = url.pathname === scope.pathname || url.pathname === new URL('index.html', scope).pathname;
  const calendar = url.pathname === new URL('calendar.html', scope).pathname;
  if (request.mode === 'navigate' && (home || calendar)) {
    const fallback = new URL(calendar ? 'calendar.html' : 'index.html', scope);
    event.respondWith(fetch(request).catch(async () =>
      await (await caches.open(cacheName)).match(fallback) || Response.error()));
  } else if (files.includes(url.href)) {
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match(request) || fetch(request)));
  }
});
