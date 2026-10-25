self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "小田急線 運行情報", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "小田急線 運行情報";
  const options = {
    body: data.body || "",
    icon: "/icons/icon.svg",
    badge: "/icons/badge.svg",
    // Web Push はOS標準の通知音・長さしか鳴らせないため、注意を引くための
    // 振動パターンを付与している（実際の「3秒チャイム」はアプリを開いた時に再生する）。
    vibrate: [300, 150, 300, 150, 300],
    tag: "train-watch-status",
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
