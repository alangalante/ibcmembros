const APP_SHELL_CACHE = "ibc-app-shell-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return cache.addAll([
        "/",
        "/manifest.webmanifest",
        "/icons/icon-192.svg",
        "/icons/icon-512.svg",
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== APP_SHELL_CACHE && !key.includes("-images-")) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

let activeUserId = null;
self.addEventListener("message", (event) => {
  if (event.data?.type === "SET_ACTIVE_USER") activeUserId = event.data.uid;
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // 1. CacheFirst para imagens do Cloudinary (isoladas por UID do usuário ativo)
  const optimizedSource = url.pathname === "/_next/image" ? url.searchParams.get("url") : null;
  const isCloudinary = url.hostname === "res.cloudinary.com" || optimizedSource?.startsWith("https://res.cloudinary.com/");
  if (isCloudinary && activeUserId) {
    event.respondWith(
      caches.open(`ibc-${activeUserId}-images-v1`).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) await cache.put(event.request, response.clone());
          return response;
        } catch {
          return cached || new Response("Imagem indisponível offline", { status: 503 });
        }
      })
    );
    return;
  }

  // 2. StaleWhileRevalidate para arquivos estáticos do App Shell e Next.js
  const isStaticAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest";
  if (isStaticAsset) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});


self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  const notification = payload.notification || {};
  const data = payload.data || {};
  const actions = [];
  if (data.whatsappLink) actions.push({ action: "whatsapp", title: "Enviar WhatsApp" });
  if (data.kind === "agenda") actions.push({ action: "open", title: "Ver agenda" });
  event.waitUntil(self.registration.showNotification(data.title || notification.title || "IBC Membros", {
    body: data.body || notification.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    image: data.image || notification.image,
    data: {
      appLink: data.link || "/",
      whatsappLink: data.whatsappLink || "",
      whatsappFallback: data.whatsappFallback || "",
    },
    actions,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const isWhatsAppAction = event.action === "whatsapp";
  let rawLink = isWhatsAppAction ? notificationData.whatsappLink : notificationData.appLink;
  rawLink = rawLink || "/";

  if (isWhatsAppAction) {
    event.waitUntil(
      clients.openWindow(rawLink).catch(() => {
        if (notificationData.whatsappFallback) return clients.openWindow(notificationData.whatsappFallback);
      })
    );
    return;
  }

  let targetUrl = self.location.origin;

  try {
    const urlObj = new URL(rawLink, self.location.origin);
    targetUrl = urlObj.href;
  } catch {
    targetUrl = self.location.origin;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (targetUrl.startsWith(self.location.origin) && client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
