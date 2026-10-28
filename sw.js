// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - Service Worker (v4.4 ÉLES KIADÁS)
// =========================================================================

const CACHE_NAME = 'csereljokosan-v4.4';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './favicon.png',
  './logo-mark.png',
  './logo-emblem.png',
  './mascot.png',
  './icon-192.png',
  './icon-512.png'
];

// Telepítés és előtöltés
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Régi gyorsítótárak törlése verzióváltáskor
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Hálózati kérések kezelése
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // A Firebase adatbázis és a Cloudflare Worker API hívásokat NEM gyorsítótárazzuk!
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('workers.dev') ||
    url.includes('gstatic.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Statikus fájlok kiszolgálása hálózat-első vagy gyorsítótár-első módon
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Frissítés a háttérben
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});