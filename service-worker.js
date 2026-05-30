const CACHE_NAME = 'baile-v2.0.0';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@phosphor-icons/web',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('✓ Service Worker: Cache criado');
      return cache.addAll(URLS_TO_CACHE).catch(err => {
        console.warn('⚠ Alguns recursos não puderam ser cacheados:', err);
        return cache.addAll(URLS_TO_CACHE.filter(url => !url.includes('cdn')));
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('✓ Service Worker: Cache antigo removido');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  if (request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || new Response(
              JSON.stringify({ status: 'offline', message: 'Offline mode' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
  } else {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          return response;
        }

        return fetch(request)
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }

            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, clonedResponse);
            });

            return response;
          })
          .catch(() => {
            return new Response('Página não disponível offline', { status: 503 });
          });
      })
    );
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-tables') {
    event.waitUntil(syncTables());
  }
});

async function syncTables() {
  try {
    console.log('✓ Service Worker: Sincronização em background');
  } catch (error) {
    console.error('✗ Erro ao sincronizar:', error);
  }
}

self.addEventListener('push', event => {
  if (!event.data) return;

  const options = {
    body: event.data.text(),
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag: 'baile-notification',
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification('Baile 2026', options));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('✓ Cache limpo');
    });
  }
});
