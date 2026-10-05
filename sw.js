const CACHE = 'fittrack-v3.0.0';
const ASSETS = ['./', './index.html', './manifest.json', './water.js', './extras.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);
  if(url.hostname.includes('firebase') ||
     url.hostname.includes('googleapis') ||
     url.hostname.includes('gstatic') ||
     url.hostname.includes('openai') ||
     url.hostname.includes('groq') ||
     url.hostname.includes('openrouter') ||
     url.hostname.includes('deepseek')){
    return;
  }
  if(request.mode === 'navigate'){
    e.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(request).then(cached => {
      const fetching = fetch(request).then(resp => {
        if(resp && resp.status === 200 && resp.type === 'basic'){
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type:'window'}).then(cs =>
      cs.length ? cs[0].focus() : self.clients.openWindow('./index.html')
    )
  );
});