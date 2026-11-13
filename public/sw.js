/* CUEVA push service worker. Notification content is plain text only. */
self.addEventListener("push", event => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.trim().slice(0, 120)
    : "CUEVA";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 500) : "";
  const tag = typeof payload.tag === "string" ? payload.tag.slice(0, 128) : "cueva-notification";

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: "/brand/cueva-symbol.svg",
    badge: "/brand/cueva-symbol.svg",
    data: { destination: "/mi-membresia" },
    renotify: false,
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = new URL("/mi-membresia", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      if ("focus" in client) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination);
  }));
});
