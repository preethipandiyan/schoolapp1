// Minimal service worker to allow PWA installation in Chrome
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Do nothing, just pass through.
  // A fetch event listener is required by Chrome to trigger the install prompt.
});
