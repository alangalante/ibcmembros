self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  const notification = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(self.registration.showNotification(notification.title || "IBC Membros", {
    body: notification.body,
    icon: notification.icon || "/icons/icon-192.svg",
    badge: notification.badge || "/icons/icon-192.svg",
    image: notification.image,
    data: { link: data.link || "/" },
    actions: [{ action: "open", title: data.kind === "birthday" ? "Abrir WhatsApp" : "Ver evento" }],
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.link || "/"));
});
