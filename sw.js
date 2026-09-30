const CACHE='jse-dashboard-shell-v3';
const BASE='/daily-jse-market-dashboard/';
const SHELL=[
  BASE,
  BASE+'index.html',
  BASE+'manifest.webmanifest',
  BASE+'icon-192.png',
  BASE+'icon-512.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>
      Promise.allSettled(SHELL.map(url=>cache.add(url)))
    )
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    ])
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response && response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      }
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match(BASE)))
  );
});
