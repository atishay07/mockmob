// Cache public fallback assets only. Never cache account HTML, RSC, APIs or answers.
// v2: the icons are now logo B; a new cache name makes installed workers fetch them again.
const CACHE='mockmob-public-fallback-v2';
const ASSETS=['/offline.html','/pwa/icon-192.png','/pwa/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mockmob-public-fallback-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate')event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));
  else if(ASSETS.includes(url.pathname))event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
