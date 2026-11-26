// 讓網站沒網路也打得開：帶版本號的程式和樣式直接用快取秒開，網頁本體優先拿新版、超過 1 秒改用快取
const CACHE = "love-base-v158";
const VER = CACHE.split("-").pop().slice(1);
const BADGE_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAC90lEQVR42u2d4W30IAyGOwIjZISMkBEyQkbICNmgIzBCRsgIGSEjMILbU/lxul5ajrMNJq8lS590Uj/yPgQMBPuDiD7g5RwiAAAAaHhHROP3vxciWoloe+K33yYi6gXb0cf/Yzlpwxp/G2ObTQNwRDQT0U6v20FEnogGhnYM8W8dGe3Y4zM4SwBc7EWBeOyIvfbVdkyZoj+zEJ/J1Q5gZBQ+FwSn8M9AjLUC8KRj20lPdPE3DfM1AdB88Pue2D9MrkG5DRvHkMQBQFv8RwglxL+HUBSAp7K2Z0ZZ1QxH7064sB8btQG4gq99jRZy5wOrQ0+N5rUAdND61DoNAOj9jG9BDgCM/X/PBaIAEPkwR0QYfgoPQ68COKBv0qahCAAHbZPNSQAYoGuyDRIAJuiabJMEgAW6JtsCAAAAAAAAAAAAAA0BmKFrss1YiDW4EMNBTLp1UptxsDQT2w3doO2/tkkCQCTEGAHlAMBEzDgB40yY34LGofwKnU9t1QCAc4Fzm7S+jMMwxDD84NNEXvOaALAqfmP1y/V5OhZlmYsvLgBYE2TG/pw3ZPAWvHlNieMSNHp/4Ut6V46IfA23JLuLrgsCRz4JrkvaV9wlXaiym/L7hcTfa0xV0F8IQF8jgKt8OTFzaiaRrqbl7eqVWy+pfEEt3qQ5LOQLKpm9RDrkFEmlJpmyrKUblaOUTtJJ6Vo4PZskNdLImGg5Mpql9dFKW2lxv8hraKOZpNRD/PKZcy3sGS2ampRI1ztddcKtKXf0VNk6IZQQv3Ty7loWa0E4X3XV2dNd4W3sXTIvtKX09b7lSMdK/QCteaHYeG+hgEMnPCTtWnUBrFfQWKzH9y2UMBmYzhUOpkIQl6whc4tQPt8Q/7N0lNNKEZ9X34aqe73VKkouMVz1tfd662WszsqkBMmTKwD4vY2xP4SXvcVnsVwEzd0VcHBWn8N6Jbreas9HKUMAgAMAAMAhAgAAABwAAAAOAAAABwAAgAMAAMABAADgAAAAcAX/AvfzHzAnP3JsAAAAAElFTkSuQmCC";
const SHELL = [
  "./",
  `./style.css?v=${VER}`,
  `./app.js?v=${VER}`,
  "./questions.json",
  `./manifest.webmanifest?v=${VER}`,
  `./icon-192.png?v=${VER}`,
  `./icon-512.png?v=${VER}`,
  `./apple-touch-icon.png?v=${VER}`
];
const LIBS = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
];

self.addEventListener("install", ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache:"reload"：不要拿瀏覽器 HTTP 快取裡的舊首頁（GitHub 會快取 10 分鐘），不然新版會裝到舊畫面
    await c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })));
    await Promise.allSettled(LIBS.map(u => c.add(new Request(u, { mode: "no-cors" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", ev => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", ev => {
  if (ev.request.method !== "GET") return;
  const url = new URL(ev.request.url);
  if (url.origin === self.location.origin) {
    // 帶 ?v= 版本號的檔案內容不會變，直接命中快取秒開，免等網路
    if (url.searchParams.has("v")) {
      ev.respondWith((async () => {
        const c = await caches.open(CACHE);
        const hit = await c.match(ev.request);
        if (hit) return hit;
        try {
          const res = await fetch(ev.request);
          if (res.ok) c.put(ev.request, res.clone());
          return res;
        } catch (e) {
          return (await c.match(ev.request, { ignoreSearch: true })) || Response.error();
        }
      })());
      return;
    }
    ev.respondWith((async () => {
      const c = await caches.open(CACHE);
      // no-cache：每次都跟伺服器確認有沒有新版（沒變只回 304，很快），不會卡在舊首頁
      const net = fetch(new Request(ev.request.url, { cache: "no-cache", credentials: "same-origin" })).then((res) => {
        if (res.ok) c.put(ev.request, res.clone());
        return res;
      });
      ev.waitUntil(net.catch(() => {}));
      // 網路超過 1 秒沒回應就先用手機快取打開，背景照樣抓最新版存起來
      const slow = new Promise((r) => setTimeout(r, 1000)).then(() => c.match(ev.request));
      try {
        const res = await Promise.race([net, slow.then((hit) => hit || net)]);
        if (res) return res;
      } catch (e) {}
      try {
        return await net;
      } catch (e) {
        return (await c.match(ev.request, { ignoreSearch: true })) || (await c.match("./")) || Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith("/firebasejs/") || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    ev.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(ev.request);
      if (hit) return hit;
      try {
        const res = await fetch(ev.request);
        if (res.ok || res.type === "opaque") c.put(ev.request, res.clone());
        return res;
      } catch (e) {
        return Response.error();
      }
    })());
  }
});

self.addEventListener("push", ev => {
  let d = {};
  try {
    d = ev.data ? ev.data.json() : {};
  } catch (e) {
    d = { body: ev.data ? ev.data.text() : "" };
  }
  const title = d.title || "我們的戀愛遊戲基地";
  const body = d.body || "對方有新動態，點開看看吧 💞";
  const url = d.url || "./#today";
  const tag = d.tag || "love-base-push";
  // App 沒開時也在主畫面圖示上亮紅點，打開後網站會換成正確的數字
  let dot = Promise.resolve();
  try {
    if (self.navigator.setAppBadge) dot = self.navigator.setAppBadge().catch(() => {});
  } catch (e) {}
  ev.waitUntil(
    Promise.all([
      dot,
      self.registration.showNotification(title, {
        body,
        icon: "./icon-192.png",
        badge: BADGE_ICON,
        tag,
        renotify: true,
        data: { url }
      })
    ])
  );
});

self.addEventListener("notificationclick", ev => {
  ev.notification.close();
  const target = (ev.notification.data && ev.notification.data.url) || "./#today";
  ev.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if ("focus" in c) {
        await c.focus();
        c.postMessage({ type: "nav", url: target });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
