// sw_v1.js – Cserélj Okosan service worker. Telepítéskor másold sw.js néven a gyökérbe.
// Stratégia: kód/HTML/CSS = hálózat-első (mindig a friss verzió, offline a cache), képek = cache-első.
// Idegen eredetű kéréseket (Firebase, Firestore, Worker, térkép, betűtípus) NEM érint és nem tárol.
// Új kiadásnál növeld a CACHE értékét (v1 -> v2), a régi cache törlődik.
try { importScripts("/push-sw.js"); } catch (e) { /* a push-sw.js még nincs feltöltve: nem baj */ }

const CACHE = "cs-shell-v4";
const SHELL = ["/", "/index.html", "/style.css", "/app.js","/read-layer_v4.js", "/manifest.json", "/favicon.png", "/icon-192.png", "/logo-mark.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("cs-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  const isImage = /\.(png|jpe?g|webp|svg|ico|gif)$/i.test(url.pathname);
  if (isImage) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/index.html") : Response.error())))
  );
});
