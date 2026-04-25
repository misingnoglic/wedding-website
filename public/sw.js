self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    // Optional: Get a list of all the current open windows/tabs under
    // our service worker's control
});

self.addEventListener('fetch', (event) => {
    // A dummy fetch event listener is required by some browsers to pass PWA installation requirements
});
