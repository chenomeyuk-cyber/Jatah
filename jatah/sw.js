const C='jatah-v6',A=['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'core/index.js', 'core/money.js', 'core/fx.js', 'core/ledger.js', 'core/period.js', 'core/budget.js', 'core/advisor.js', 'data/adapters.js', 'data/store.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const own=new URL(r.url).origin===location.origin;
 const save=res=>{if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res};
 e.respondWith(own?fetch(r).then(save).catch(()=>caches.match(r)):caches.match(r).then(h=>h||fetch(r).then(save)))});
