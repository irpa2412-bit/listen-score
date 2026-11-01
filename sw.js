const C='ls-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith('http'))return;
e.respondWith(caches.open(C).then(async c=>{const m=await c.match(e.request);if(m)return m;
try{const r=await fetch(e.request);if(r.ok||r.type==='opaque')c.put(e.request,r.clone());return r}catch(x){return Response.error()}}))});