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

self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.url || '/admin',
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data.url
  const path = new URL(url, self.location.origin).pathname
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Reuse an open tab on the same page, navigating it to the exact target (e.g. a conversation)
      const existing = windowClients.find((client) => new URL(client.url).pathname === path)
      if (existing) {
        return existing
          .navigate(url)
          .then((client) => (client || existing).focus())
          .catch(() => existing.focus()) // navigate() fails for tabs this worker doesn't control
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
