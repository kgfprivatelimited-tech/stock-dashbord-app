const CACHE_NAME = 'bearfighter-v1';
const ASSETS = [
    '/',
    '/index.html'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    if (e.request.url.includes('/api/')) return;
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request))
    );
});

self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : { title: 'BearFighter', body: 'New update!' };
    e.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%230a0a0a" width="100" height="100" rx="20"/><text x="50" y="68" font-size="55" text-anchor="middle">🐻</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ff6b35" width="100" height="100" rx="50"/></svg>',
            vibrate: [100, 50, 100],
            tag: 'bearfighter-notification',
            renotify: true
        })
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(clients.openWindow('/'));
});
