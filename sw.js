// 讓網站沒網路也打得開：網頁永遠先拿最新版，拿不到才用存下來的
const CACHE = "love-base-v10";
const SHELL = ["./", "./style.css", "./app.js", "./questions.json", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const LIBS = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
];

self.addEventListener("install", ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
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
    ev.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await fetch(ev.request);
        if (res.ok) c.put(ev.request, res.clone());
        return res;
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
      const res = await fetch(ev.request);
      c.put(ev.request, res.clone());
      return res;
    })());
  }
});
