/* One-time retirement for the former root-scoped `/sw.js` worker. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.unregister(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('rust-path-shell-'))
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  )
})
