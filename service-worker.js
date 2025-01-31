// Cache names with emojis for fun and clarity! 🎯
const CACHE_NAME = 'bunny-tracker-v1'; // Update version when needed
const DYNAMIC_CACHE = 'bunny-dynamic-v1';

// Resources to cache immediately 📦
const STATIC_RESOURCES = [
  '/bunny-journey-tracking/', // Main page
  '/bunny-journey-tracking/index.html',
  '/bunny-journey-tracking/manifest.json',

  // Icons 🎨
  '/bunny-journey-tracking/icon.png',
  '/bunny-journey-tracking/icon-128.png',
  '/bunny-journey-tracking/icon-512.png',

  // Material Icons & Fonts 🎨
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/icon?family=Material+Symbols+Rounded',
  'https://fonts.googleapis.com/css2?family=Fredoka&display=swap',
  'https://fonts.googleapis.com/css?family=Google+Sans:100,300,400,500,700,900,100i,300i,400i,500i,700i,900i',

  // Leaflet CSS 🎨
  'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',

  // Essential Scripts 📜
  'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.33/moment-timezone-with-data.min.js',
  'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',

  // Tracker Data 🗺️
  'https://api.npoint.io/6412ce8ae90f2330f538', // Pre-tracking data
  'https://api.npoint.io/adf585d984bb6a571cb7', // Route data

  // Flaticon URLs 🎨
  'https://cdn-icons-png.flaticon.com/512/7226/7226220.png',
  'https://cdn-icons-png.flaticon.com/512/7226/7226674.png',
  'https://cdn-icons-png.flaticon.com/512/7226/7226114.png',
  'https://cdn-icons-png.flaticon.com/512/16116/16116385.png'
];

// Install event - Cache essential resources 🎁
self.addEventListener('install', event => {
  console.log('🎯 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static resources...');
        return cache.addAll(STATIC_RESOURCES);
      })
  );
});

// Activate event - Clean up old caches 🧹
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
            console.log('🧹 Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch event - Handle requests with offline support 🌐
self.addEventListener('fetch', event => {
  // Special handling for API requests 📡
  if (event.request.url.includes('api.npoint.io')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request)
            .then(response => {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache));
              return response;
            });
        })
    );
    return;
  }

  // Special handling for map tiles 🗺️
  if (event.request.url.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request)
            .then(response => {
              const responseToCache = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(event.request, responseToCache));
              return response;
            });
        })
    );
    return;
  }

  // Default strategy for other resources
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
