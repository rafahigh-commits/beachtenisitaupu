/* Firebase Cloud Messaging service worker.
 * Substitua os valores abaixo pelas credenciais do seu projeto Firebase
 * (mesmas usadas em VITE_FIREBASE_*). Veja docs/PUSH_NOTIFICATIONS.md.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_API_KEY",
  authDomain: "REPLACE_AUTH_DOMAIN",
  projectId: "REPLACE_PROJECT_ID",
  messagingSenderId: "REPLACE_MESSAGING_SENDER_ID",
  appId: "REPLACE_APP_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Nova notificação";
  const options = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: "/placeholder.svg",
    badge: "/placeholder.svg",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});
