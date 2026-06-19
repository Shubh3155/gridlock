importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

// Initialize the Firebase app in the service worker
// NOTE: Fill these in with your Firebase Web App credentials or let the build script populate them.
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message:", payload);

  const notificationTitle = payload.notification?.title || "🚨 Gridlock Priority Alert";
  const notificationOptions = {
    body: payload.notification?.body || "A new high-risk traffic violation zone was detected.",
    icon: "/favicon.ico",
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click action to redirect to zone detail in dashboard
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const zoneId = event.notification.data?.zone_id;
  const targetUrl = zoneId ? `/?zone=${zoneId}` : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus().then((focusedClient) => {
            return focusedClient.navigate(targetUrl);
          });
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
