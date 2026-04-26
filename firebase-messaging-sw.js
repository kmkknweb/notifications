importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCySnhzMxxZXgzlhFoV8MgT6j4FFBR-ki8",
  authDomain: "notifications-9dc4b.firebaseapp.com",
  projectId: "notifications-9dc4b",
  storageBucket: "notifications-9dc4b.firebasestorage.app",
  messagingSenderId: "63559557301",
  appId: "1:63559557301:web:b819d756eed0a23b481efc"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title || 'แจ้งเตือน', {
    body: body || '',
    icon: '/icon-192.png',
    vibrate: [100, 50, 100],
  });
});
