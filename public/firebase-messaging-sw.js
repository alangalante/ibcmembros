self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

let activeUserId = null;
self.addEventListener("message", (event) => {
  if (event.data?.type === "SET_ACTIVE_USER") activeUserId = event.data.uid;
});

self.addEventListener("fetch", (event) => {
  if (!activeUserId || event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const optimizedSource = url.pathname === "/_next/image" ? url.searchParams.get("url") : null;
  const isCloudinary = url.hostname === "res.cloudinary.com" || optimizedSource?.startsWith("https://res.cloudinary.com/");
  if (!isCloudinary) return;

  event.respondWith(caches.open(`ibc-${activeUserId}-images-v1`).then(async (cache) => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(event.request, response.clone());
    return response;
  }));
});

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
