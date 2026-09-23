// =========================================================================
// Lutra Album Cserebere - Service Worker (sw.js v3.9)
// =========================================================================

const CACHE_NAME = 'lutra-csere-v2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// 1. Telepítés és statikus fájlok gyorsítótárazása
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Aktiválás és régi gyorsítótárak kitakarítása
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. Hálózati kérések kezelése: Network-first a dinamikus adatokhoz, Cache fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A Firestore és külső API hívásokat nem gyorsítótárazzuk, hagyjuk közvetlenül átmenni
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('workers.dev') ||
    url.origin.includes('firebaseio.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Ha sikeres a hálózati letöltés, frissítjük a gyorsítótárat
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline állapot esetén a gyorsítótárból szolgáljuk ki
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});