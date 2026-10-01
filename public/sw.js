// Omni service worker: makes Omni installable (Android app / Add to Home screen) and shows a friendly
// offline page. It never caches API responses or private data.
const CACHE = 'omni-shell-v1'
const OFFLINE = '/offline.html'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/icons/icon-192.png'])).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin || req.url.includes('/api/')) return
  if (req.mode === 'navigate') e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)))
})
