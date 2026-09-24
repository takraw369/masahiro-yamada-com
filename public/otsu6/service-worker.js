const CACHE = "otsu6-pass-sprint-v8";
const ASSETS = ["./", "./styles.css", "./questions.js", "./question-overrides-20260924.js", "./app.js", "./pass-sprint-shell.js", "./pass-sprint-bank.js", "./pass-sprint-v2.js", "./pass-sprint-v2.css", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install",(event)=>event.waitUntil(caches.open(CACHE).then((c)=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",(event)=>event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((k)=>k.startsWith("otsu6-")&&k!==CACHE).map((k)=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",(event)=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
  const networkFirst=event.request.mode==="navigate"||/question-overrides|pass-sprint|questions\.js|app\.js/.test(url.pathname);
  if(networkFirst){event.respondWith(fetch(event.request).then((r)=>{const copy=r.clone();caches.open(CACHE).then((c)=>c.put(event.request.mode==="navigate"?"./":event.request,copy));return r}).catch(()=>caches.match(event.request.mode==="navigate"?"./":event.request)));return;}
  event.respondWith(caches.match(event.request).then((cached)=>cached||fetch(event.request).then((r)=>{const copy=r.clone();caches.open(CACHE).then((c)=>c.put(event.request,copy));return r})));
});
