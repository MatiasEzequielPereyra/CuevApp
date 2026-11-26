/* CUEVA push service worker. Notification content is plain text only. */
self.addEventListener("push", event => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" && payload.title.trim()
    ? Array.from(payload.title.trim()).slice(0, 120).join("")
    : "CUEVA";
  const body = typeof payload.body === "string" ? Array.from(payload.body).slice(0, 500).join("") : "";
  const tag = typeof payload.tag === "string" ? payload.tag.slice(0, 128) : "cueva-notification";

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: "/brand/cueva-symbol.svg",
    badge: "/brand/cueva-symbol.svg",
    data: { destination: safeDestination(payload.destination) },
    renotify: false,
  }));
});

function safeDestination(path) {
  return path === "/mi-rutina" || path === "/notificaciones" ? path : "/mi-membresia";
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = new URL(safeDestination(event.notification.data?.destination), self.location.origin).href;
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
