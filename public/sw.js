// OpenMaps Service Worker for PWA functionality
const CACHE_NAME = 'openmaps-v1.0.0';
const STATIC_CACHE_NAME = 'openmaps-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'openmaps-dynamic-v1.0.0';
const TILE_CACHE_NAME = 'openmaps-tiles-v1.0.0';

// Static resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME && 
              cacheName !== TILE_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests with appropriate caching strategies
  
  // 1. Map tiles - Cache first with long expiration
  if (url.hostname.includes('tile.openstreetmap.org') || 
      url.hostname.includes('tile') && url.pathname.includes('.png')) {
    event.respondWith(handleTileRequest(request));
    return;
  }

  // 2. API requests - Network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // 3. Static assets - Cache first
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // 4. Navigation requests - Network first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: Network first
  event.respondWith(handleDefaultRequest(request));
});

// Handle map tile requests with aggressive caching
async function handleTileRequest(request) {
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Return cached tile immediately
      return cachedResponse;
    }
    
    // Fetch and cache new tile
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Service Worker: Tile request failed', error);
    // Return a placeholder tile or error response
    return new Response('Tile unavailable', { status: 404 });
  }
}

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful responses for offline fallback
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'This feature is unavailable offline'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle static assets with cache-first strategy
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Service Worker: Static asset request failed', error);
    throw error;
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Return cached index.html for offline navigation
    const cache = await caches.open(STATIC_CACHE_NAME);
    return await cache.match('/index.html');
  }
}

// Default request handler
async function handleDefaultRequest(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful GET requests
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Helper function to identify static assets
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2|ttf|eot)$/);
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'route-sync') {
    event.waitUntil(syncPendingRoutes());
  }
});

// Sync pending routes when online
async function syncPendingRoutes() {
  // Implementation would sync any pending route requests
  // that were queued while offline
  console.log('Service Worker: Syncing pending routes');
}

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from OpenMaps',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Map',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close notification',
        icon: '/icons/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('OpenMaps', options)
  );
});