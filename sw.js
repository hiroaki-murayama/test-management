
const prefix = 'research-phd:' + self.registration.scope + ':';
const cacheName = prefix + '298bbff84fb1947e';
const scope = new URL(self.registration.scope);
const files = ["index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "assets/index-CiDJQAwb.css", "assets/index-xAs5CMtU.js"].map(file => new URL(file, scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cacheName)
    .map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const entry = url.origin === scope.origin && url.pathname === scope.pathname;
  if (entry && request.mode === 'navigate') {
    event.respondWith(caches.open(cacheName).then(cache =>
      cache.match(new URL('index.html', scope)).then(response => response ?? fetch(request))));
  } else if (files.includes(url.href)) {
    event.respondWith(caches.open(cacheName).then(cache =>
      cache.match(request).then(response => response ?? fetch(request))));
  }
});
