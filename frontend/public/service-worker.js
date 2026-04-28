/**
 * WellTrack Service Worker
 * Provides offline caching and PWA functionality
 */

const CACHE_NAME = 'welltrack-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-192.png',
  '/favicon-512.png'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch - cache first strategy for static assets, network first for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests (let them go to network)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cache first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Return cached version and fetch update in background
        fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {
          // Network failed, cached version is already returned
        });
        return cached;
      }

      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    }).catch(() => {
      // Both cache and network failed
      // Return offline fallback if available
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/favicon-192.png',
    badge: '/favicon-192.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'WellTrack',
      options
    )
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => {
            if (focused && 'postMessage' in focused) {
              focused.postMessage({
                type: 'notification-click',
                action,
                data
              });
            }
          });
        }
      }

      // Otherwise open new window
      if (self.clients.openWindow) {
        const url = data.url || '/dashboard';
        return self.clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline form submissions (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-screenings') {
    event.waitUntil(syncScreenings());
  } else if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendance());
  }
});

async function syncScreenings() {
  // Future: sync pending screenings from IndexedDB
  console.log('Syncing screenings...');
}

async function syncAttendance() {
  // Future: sync pending attendance from IndexedDB
  console.log('Syncing attendance...');
}

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
