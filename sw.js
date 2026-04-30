const CACHE = 'mb-v8';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
];

// Install: cache new files AND skip waiting immediately — no delay
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting(); // activate immediately, don't wait for old SW to die
});

// Activate: delete ALL old caches, then take control of all pages NOW
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      })))
      .then(() => self.clients.claim()) // take over all open tabs immediately
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('firebasedatabase') || url.includes('firebaseio') ||
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('openfoodfacts') || url.includes('firebaseapp.com') ||
      url.includes('api.anthropic.com') ||
      url.includes('generativelanguage.googleapis.com')) {
    return; // never intercept API calls
  }
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => {
          if (e.request.mode === 'navigate') return caches.match('./index.html');
        });
      })
    );
  }
});

let scheduledTimers = [];
function clearAllTimers() { scheduledTimers.forEach(t => clearTimeout(t)); scheduledTimers = []; }

function scheduleReminders(reminders) {
  clearAllTimers();
  reminders.forEach(r => {
    const now = new Date(), fire = new Date();
    fire.setHours(r.h, r.m, 0, 0);
    if (fire <= now) fire.setDate(fire.getDate() + 1);
    const t = setTimeout(() => {
      self.registration.showNotification('Muscle & Burn 🔥', {
        body: r.label + ' — ' + r.desc,
        icon: 'https://via.placeholder.com/192x192/FF6B35/000000?text=M%26B',
        badge: 'https://via.placeholder.com/96x96/FF6B35/000000?text=M%26B',
        tag: 'mb-' + r.id, renotify: true, vibrate: [200, 100, 200], data: { url: './' }
      });
      scheduleReminders([r]);
    }, fire.getTime() - now.getTime());
    scheduledTimers.push(t);
  });
}

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SCHEDULE_REMINDERS') scheduleReminders(e.data.reminders);
  if (e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) { if ('focus' in client) return client.focus(); }
      return clients.openWindow('./');
    })
  );
});
