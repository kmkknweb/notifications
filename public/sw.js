// sw.js - Service Worker สำหรับรับ Push Notification

self.addEventListener('install', (event) => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(clients.claim());
});

// รับ Push จาก server
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'แจ้งเตือน',
    body: 'มีข้อความใหม่',
    icon: '/icon-192.png',
    badge: '/badge.png',
    url: '/',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      data: { url: data.url },
      vibrate: [100, 50, 100],
    })
  );
});

// เมื่อ user กด notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // ถ้าแอปเปิดอยู่แล้ว → focus
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // ถ้าแอปปิดอยู่ → เปิดใหม่
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
