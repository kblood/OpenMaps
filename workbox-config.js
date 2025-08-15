module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{html,js,css,png,svg,jpg,jpeg,gif,webp,woff,woff2,ttf,eot,ico}'
  ],
  swDest: 'dist/sw.js',
  
  // Runtime caching configuration
  runtimeCaching: [
    // Map tiles - Cache first with long expiration
    {
      urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles-osm',
        expiration: {
          maxEntries: 2000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          purgeOnQuotaError: true
        },
        cacheKeyWillBeUsed: async ({request}) => {
          // Create a consistent cache key for tiles
          const url = new URL(request.url);
          return `${url.pathname}${url.search}`;
        }
      }
    },
    
    // Other tile providers
    {
      urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles-esri',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          purgeOnQuotaError: true
        }
      }
    },
    
    {
      urlPattern: /^https:\/\/.*\.basemaps\.cartocdn\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles-carto',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          purgeOnQuotaError: true
        }
      }
    },

    {
      urlPattern: /^https:\/\/.*\.opentopomap\.org/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles-topo',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          purgeOnQuotaError: true
        }
      }
    },

    {
      urlPattern: /^https:\/\/tile-.*\.openstreetmap\.fr/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles-humanitarian',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          purgeOnQuotaError: true
        }
      }
    },

    {
      urlPattern: /^https:\/\/.*\.tile-cyclosm\.openstreetmap\.fr/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles-cycling',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          purgeOnQuotaError: true
        }
      }
    },
    
    // API requests - Network first with cache fallback
    {
      urlPattern: /^https:\/\/nominatim\.openstreetmap\.org/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'geocoding-api',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
          purgeOnQuotaError: true
        },
        networkTimeoutSeconds: 10
      }
    },
    
    {
      urlPattern: /^https:\/\/router\.project-osrm\.org/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'routing-api-osrm',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60, // 1 hour
          purgeOnQuotaError: true
        },
        networkTimeoutSeconds: 15
      }
    },
    
    {
      urlPattern: /^https:\/\/valhalla.*\.openstreetmap\.de/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'routing-api-valhalla',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60, // 1 hour
          purgeOnQuotaError: true
        },
        networkTimeoutSeconds: 15
      }
    },
    
    // Local API requests
    {
      urlPattern: /^http:\/\/localhost:3001\/api/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'local-api',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 5, // 5 minutes
          purgeOnQuotaError: true
        },
        networkTimeoutSeconds: 5
      }
    },
    
    // Fonts and other assets - Stale while revalidate
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets'
      }
    },
    
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          purgeOnQuotaError: true
        }
      }
    }
  ],
  
  // Skip waiting for service worker updates
  skipWaiting: true,
  clientsClaim: true,
  
  // Maximum file size to precache (2MB)
  maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
  
  // Ignore specific file patterns
  dontCacheBustURLsMatching: /\.\w{8}\./,
  
  // Clean up outdated caches
  cleanupOutdatedCaches: true,
  
  // Offline fallbacks
  offlineFallback: {
    pageFallback: '/offline.html'
  }
};