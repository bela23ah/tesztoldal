// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - sw.js (v4.6 ÉLES KIADÁS)
// Network-First frissülésvédelem + PWA Offline működés
// =========================================================================

const CACHE_NAME = 'csereljokosan-v4.6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './favicon.png',
  './logo-mark.png',
  './logo-emblem.png',
  './gyik.html',
  './facebook-matrica-csere.html',
  './lutra-album-matrica-csere.html',
  './csere-tervezo-szimulator.html',
  './fotos-matrica-szkenner.html',
  './korcsere-kalkulator.html',
  './kozos-kalap.html'
];

// Telepítés: Statikus fájlok előzetes gyorsítótárazása
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Cache előtöltés figyelmeztetés:', err);
      });
    })
  );
  self.skipWaiting();
});

// Aktiválás: Régi cache verziók azonnali megsemmisítése
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

// Lekérés: Network-First stratégia a HTML/JS/CSS fájlokra
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Firestore és Worker hívások mindig hálózaton menjenek
  if (url.origin.includes('firestore') || url.origin.includes('workers.dev') || url.origin.includes('googleapis')) {
    return;
  }

  // Nem GET kérések átengedése
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      })
      .catch(() => {
        // Offline tartalék a cache-ből
        return caches.match(req).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          if (req.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});