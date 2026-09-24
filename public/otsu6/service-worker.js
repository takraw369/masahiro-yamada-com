const CACHE = "otsu6-pass-sprint-v7";
const ASSETS = ["./", "./questions.js", "./adaptive-overrides.js", "./pass-sprint-shell.js", "./pass-sprint-bank.js", "./pass-sprint-v2.js", "./pass-sprint-v2.css", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((k)=>k.startsWith("otsu6-")&&k!==CACHE).map((k)=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url); if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response)=>{const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put("./",copy));return response;}).catch(()=>caches.match("./")));
    return;
  }
  if (/pass-sprint|questions\.js|adaptive-overrides/.test(url.pathname)) {
    event.respondWith(fetch(event.request).then((response)=>{const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached)=>cached||fetch(event.request).then((response)=>{const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(event.request,copy));return response;})));
});
