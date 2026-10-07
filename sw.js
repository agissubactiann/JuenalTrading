/* Service worker: bikin app bisa dibuka offline. Naikkan angka V kalau mau paksa refresh cache. */
const V = "jt-v2";
const CORE = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "fonts/inter-latin-400-normal.woff2", "fonts/inter-latin-500-normal.woff2", "fonts/inter-latin-600-normal.woff2", "fonts/inter-latin-700-normal.woff2"];
const keep = (res) => res && (res.ok || res.type === "opaque");

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url), font = /fonts\.(googleapis|gstatic)\.com$/.test(u.host);
  if (u.origin !== location.origin && !font) return;
  if (font) {   // font: pakai cache dulu
    e.respondWith(caches.match(r).then((h) => h || fetch(r).then((res) => { if (keep(res)) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })));
    return;
  }
  // file app: online dulu (biar update langsung masuk), offline pakai cache
  e.respondWith(fetch(r).then((res) => { if (keep(res)) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r).then((h) => h || caches.match("index.html"))));
});
