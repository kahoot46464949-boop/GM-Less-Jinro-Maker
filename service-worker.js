const CACHE_NAME="jinro-maker-v4.0";
const APP_SHELL=["./","./index.html","./css/style.css","./js/app.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));}
   return response;
 }).catch(()=>caches.match("./index.html"))));
});
