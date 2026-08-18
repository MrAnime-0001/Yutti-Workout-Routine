/* Service worker: hosts the rest-timer notification (vibrate + sound at the
   system level while backgrounded) AND caches the app + alarm sounds so the
   alarm still plays offline (load once with data, then it works with data off).
   Sounds are cache-first (static); the page is network-first so edits still show. */
const CACHE = "vtaper-v2";
const ASSETS = [
  "./", "index.html",
  "sounds/default.mp3", "sounds/alarm.mp3", "sounds/buzzer.mp3",
  "sounds/chime.mp3", "sounds/funny.mp3"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // let cross-origin (e.g. YouTube) pass through

  if (url.pathname.includes("/sounds/")) {
    // Cache-first: the alarm must play even with no connection.
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    })));
  } else {
    // Network-first for the page: fresh when online, cached fallback when offline.
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("index.html"))));
  }
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
      for (const c of cs) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
