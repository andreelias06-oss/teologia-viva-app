/* eslint-disable no-restricted-globals */
// Service Worker — Teologia Viva
// Trata Web Push notifications e clique de notificação para abrir o app.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Teologia Viva', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Teologia Viva';
  const options = {
    body: payload.body || 'Seu devocional do dia já está disponível.',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || 'devocional-diario',
    data: { url: payload.url || '/', ...(payload.data || {}) },
    vibrate: [120, 60, 120],
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const c of clientsArr) {
        if ('focus' in c) {
          if (c.url.includes(targetUrl)) return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    }),
  );
});
