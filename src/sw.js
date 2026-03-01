// Service Worker for PWA - handles push notifications for iOS
// This service worker is used by vite-plugin-pwa with injectManifest strategy
import { precacheAndRoute } from "workbox-precaching";

// Injection point for vite-plugin-pwa: manifest is injected at build time
precacheAndRoute(self.__WB_MANIFEST);

// Install event - cache assets
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push event handler - required for iOS PWA notifications
self.addEventListener("push", (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Meeps", body: event.data.text() || "New notification" };
    }
  }

  const title = data.title || "Meeps";
  const options = {
    body: data.body || "New notification",
    icon: data.icon || "/apple-touch-icon.png",
    badge: "/icon-192.png",
    tag: data.tag || "meeps-notification",
    data: data.data || {},
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";
  const channel = event.notification.data?.channel;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Prefer focusing an existing window and telling it to switch channel
        if (clientList.length > 0 && channel) {
          const client = clientList[0];
          if (client.focus) client.focus();
          client.postMessage({ type: "NOTIFICATION_CHANNEL", channel });
          return;
        }
        // If no channel or no clients, check for existing window with exact URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window/tab (e.g. app was closed)
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});

// Message handler for showing notifications from the main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    self.registration.showNotification(title, options || {});
  }
});
