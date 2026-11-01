const C='ls-v4';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||!r.url.startsWith('http'))return;
const same=new URL(r.url).origin===location.origin;
e.respondWith(caches.open(C).then(async c=>{
if(same){try{const n=await fetch(r);if(n.ok)c.put(r,n.clone());return n}catch(x){return(await c.match(r))||Response.error()}}
const m=await c.match(r);if(m)return m;
try{const n=await fetch(r);if(n.ok||n.type==='opaque')c.put(r,n.clone());return n}catch(x){return Response.error()}}))});
