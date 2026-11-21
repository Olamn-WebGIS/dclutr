self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { body: event.data?.text() };
  }
  let url = "/market";
  if (typeof notification.url === "string" && notification.url.startsWith("/") && !notification.url.startsWith("//")
    && !notification.url.includes("\\") && !/[\u0000-\u001f]/.test(notification.url)) {
    url = new URL(notification.url, self.location.origin).href;
  }
  event.waitUntil(self.registration.showNotification(notification.title || "D_clutr update", {
    body: notification.body || "You have a new update.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: notification.tag || "dclutr-update",
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl = event.notification.data?.url;
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const target = new URL(targetUrl || "/market", self.location.origin);
      const existing = clients.find((client) => new URL(client.url).origin === target.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing && new URL(existing.url).pathname !== target.pathname) return existing.navigate(target.href);
        return;
      }
      return self.clients.openWindow(target.href);
    })
  );
});
