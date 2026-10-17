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
    actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : undefined,
    data: { url: d.url || './', ack: d.ack || null },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const url = new URL(d.url || './', self.registration.scope).href;
  // أي ضغطة على الإشعار (أو زر «تم») = تأكيد إن الشخص شاف التذكير
  const ack = d.ack && d.ack.url ? fetch(d.ack.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d.ack.body) }).catch(() => {}) : Promise.resolve();
  if (e.action === 'ack') return e.waitUntil(ack);
  e.waitUntil((async () => {
    await ack;
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
