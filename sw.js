const CACHE='jse-dashboard-shell-v5';
const BASE='/daily-jse-market-dashboard/';
const SHELL=[
  BASE,
  BASE+'index.html',
  BASE+'manifest.webmanifest',
  BASE+'icon-192-rgba.png',
  BASE+'icon-512-maskable.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>
      Promise.allSettled(SHELL.map(url=>cache.add(new Request(url,{cache:'reload'}))))
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

function isLiveDashboardAsset(url){
  return url.pathname===BASE+'data.js' ||
    url.pathname===BASE+'app.js' ||
    url.pathname===BASE+'index.html' ||
    url.pathname===BASE;
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin===self.location.origin&&isLiveDashboardAsset(url)){
    event.respondWith(
      fetch(new Request(event.request,{cache:'no-store'})).then(response=>{
        if(response&&response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        }
        return response;
      }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match(BASE)))
    );
    return;
  }
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      }
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match(BASE)))
  );
});
