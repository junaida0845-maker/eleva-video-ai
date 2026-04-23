// Service Worker — auto-update, network-first
// Build marker: 2026-04-24-blackbox-tech-names
const CACHE_VERSION = 'v' + Date.now();
const CACHE_NAME = 'app-cache-' + CACHE_VERSION;

// Install: activate immediately
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate: purge every old cache, take control of open tabs
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first; HTML must always be fresh.
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Skip SW for API/Supabase/external requests — let them go direct
  if (
    url.includes('supabase.co') ||
    url.includes('supabase.in') ||
    url.includes('/functions/v1/') ||
    url.includes('/rest/v1/') ||
    url.includes('/auth/v1/') ||
    url.includes('/storage/v1/') ||
    url.includes('stripe.com') ||
    url.includes('api.anthropic.com') ||
    event.request.method !== 'GET'
  ) {
    return; // Don't intercept — browser handles directly
  }

  // Navigation requests (HTML) — always network, fall back to cache offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets — network preferred, cache the fresh response.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Apply update immediately when a new SW signals skipWaiting.
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
