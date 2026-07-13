import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dist = path.resolve('dist');
const manifestPath = path.join(dist, '.vite/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const urls = new Set(['/', '/index.html', '/manifest.webmanifest', '/192x192.png', '/icon-maskable-192.png']);
function add(file){ if(file) urls.add('/'+file.replace(/^\//,'')); }
function walk(key, seen=new Set()){
 const e=manifest[key]; if(!e || seen.has(key)) return; seen.add(key);
 add(e.file); (e.css||[]).forEach(add); (e.assets||[]).forEach(add);
 (e.imports||[]).forEach(k=>walk(k,seen)); (e.dynamicImports||[]).forEach(k=>walk(k,seen));
}
const entryKey = Object.keys(manifest).find(k => manifest[k].isEntry) || 'index.html';
walk(entryKey);
for (const [k,e] of Object.entries(manifest)) if (/pdf\.worker|epub|pdfjs|pdf/i.test(k+JSON.stringify(e))) walk(k);
const list=[...urls].filter(u=>fs.existsSync(path.join(dist, u==='/'?'index.html':u)) || u==='/');
const hash=crypto.createHash('sha256').update(JSON.stringify(list)+JSON.stringify(manifest)).digest('hex').slice(0,16);
const sw=`const CACHE_NAME = 'codice-app-${hash}';\nconst APP_SHELL = ${JSON.stringify(list,null,2)};\nself.addEventListener('install', event => {\n  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));\n});\nself.addEventListener('activate', event => {\n  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('codice-app-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));\n});\nself.addEventListener('message', event => {\n  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();\n});\nfunction isSafeGet(request){ return request.method === 'GET' && !request.headers.has('Authorization'); }\nfunction isLocal(url){ return url.origin === self.location.origin; }\nfunction isApi(url){ return /\\/auth\\/|\\/rest\\/|\\/storage\\/|\\/functions\\//.test(url.pathname); }\nfunction isBookRequest(url){ return /\\.(epub|pdf|txt)$/i.test(url.pathname) || url.pathname.startsWith('/books/') || url.pathname.startsWith('/library/'); }\nself.addEventListener('fetch', event => {\n  const request = event.request;\n  const url = new URL(request.url);\n  if (!isSafeGet(request) || !isLocal(url) || isApi(url) || isBookRequest(url)) return;\n  if (request.mode === 'navigate') {\n    event.respondWith(caches.match('/index.html').then(cached => cached || fetch(request)));\n    return;\n  }\n  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));\n});\n`;
fs.writeFileSync(path.join(dist,'sw.js'), sw);
console.log(`Generated dist/sw.js with ${list.length} precached URLs (${hash})`);
