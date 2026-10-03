// Service worker: shows session alerts pushed from the server even when the app is closed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'أستاذ أونلاين', {
    body: d.body || '',
    tag: d.tag,
    renotify: !!d.tag,
    requireInteraction: !!d.requireInteraction,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [400, 150, 400, 150, 800],
    dir: 'rtl',
    lang: 'ar',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    if (!url.startsWith(self.registration.scope)) return self.clients.openWindow(url); // لينك الحصة (زوم / ميت)
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(url); } catch (_) {} }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
