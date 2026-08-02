const CACHE = 'bf-v19';
const STATIC = [
  '/', '/manifest.json',
  '/icons/icon-192.svg', '/icons/icon-512.svg', '/icons/apple-touch-icon.svg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(netFirst(e.request));
  } else {
    e.respondWith(netFirst(e.request));
  }
});

async function netFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ─── Push notifications ───
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch (err) {
    data = { title: 'Bear Fighter Trading', body: e.data ? e.data.text() : 'New update' };
  }
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    data: data.data || {},
    tag: data.tag || 'bf-notification',
    vibrate: [100, 50, 100]
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Bear Fighter Trading', options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
    for (const c of clientList) {
      if ('focus' in c) { c.focus(); return; }
    }
    if (clients.openWindow) return clients.openWindow(target);
  }));
});