const OFFLINE_CACHE='job-radar-offline-v1';
const OFFLINE_ASSETS=['/offline.html','/icons/icon-192.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(OFFLINE_CACHE);await cache.addAll(OFFLINE_ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('job-radar-offline-')&&name!==OFFLINE_CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 // Private pages and API responses are never placed in Cache Storage.
 if(request.mode==='navigate')event.respondWith((async()=>{try{return await fetch(request);}catch{const cache=await caches.open(OFFLINE_CACHE);return await cache.match('/offline.html')||new Response('You are offline. Reconnect to open Job Radar.',{status:503,headers:{'Content-Type':'text/plain'}});}})());
 else if(OFFLINE_ASSETS.includes(url.pathname))event.respondWith((async()=>{const cache=await caches.open(OFFLINE_CACHE);return await cache.match(url.pathname)||fetch(request);})());
});
self.addEventListener('push',event=>{event.waitUntil((async()=>{let data={title:'New opportunities on Job Radar',body:'Open your inbox to see your latest matches.'};try{const r=await fetch('/api/notification',{credentials:'include',signal:AbortSignal.timeout(5000)});if(r.ok)data=await r.json();}catch{}await self.registration.showNotification(data.title,{body:data.body,tag:'job-radar-new',icon:'/icons/icon-192.png',data:{url:'/'}});})());});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if(new URL(client.url).origin===self.location.origin)return client.focus();}return clients.openWindow('/');}));});
