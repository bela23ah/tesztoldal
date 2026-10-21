// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - Service Worker (v4.3 STABIL)
// =========================================================================

const CACHE_NAME = 'cserelj-okosan-v4.3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './og-image.png'
];

// 1. Telepítés és friss fájlok letöltése
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 2. Aktiválás és a régi gyorsítótárak azonnali kényszerített törlése
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

// 3. Hálózati kérések kezelése: Network-first a friss adatokhoz
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A Firestore, Brevo és Cloudflare Worker API hívásokat sosem cache-eljük!
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('workers.dev') ||
    url.origin.includes('firebaseio.com') ||
    url.origin.includes('identitytoolkit') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});