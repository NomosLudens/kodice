import fs from 'node:fs';

function fail(m){ console.error(m); process.exitCode=1; }
function exists(p){ return fs.existsSync(p); }
function read(p){ return fs.readFileSync(p, 'utf8'); }
function pngSize(p){
  const b = fs.readFileSync(p);
  const sig = '89504e470d0a1a0a';
  if (b.subarray(0, 8).toString('hex') !== sig) fail(`${p} não é PNG válido`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
function expectPng192(p){
  if(!exists(p)){ fail(`${p} ausente`); return; }
  const { width, height } = pngSize(p);
  if(width !== 192 || height !== 192) fail(`${p} deve ter dimensões reais 192×192; encontrado ${width}×${height}`);
}

let manifest;
try{ manifest=JSON.parse(read('public/manifest.webmanifest')); }catch(e){ fail('manifest inválido ou ausente'); manifest={}; }

if(manifest.name !== 'Kódice — Leitura local') fail('manifest name deve ser "Kódice — Leitura local"');
if(manifest.short_name !== 'Kódice') fail('manifest short_name deve ser "Kódice"');
if(manifest.description !== 'Leitor local de EPUB, PDF e TXT.') fail('manifest description incorreta');
if(manifest.start_url !== '/') fail('start_url deve ser /');
if(manifest.scope !== '/') fail('scope deve ser /');
if(manifest.display !== 'standalone') fail('display deve ser standalone');

expectPng192('public/192x192.png');
expectPng192('public/icon-maskable-192.png');

const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
const anyIcon = icons.find(i => i.src === '/192x192.png');
const maskableIcon = icons.find(i => i.src === '/icon-maskable-192.png');
if(!anyIcon || anyIcon.sizes !== '192x192' || anyIcon.type !== 'image/png' || anyIcon.purpose !== 'any') fail('manifest deve referenciar /192x192.png como ícone any 192x192 image/png');
if(!maskableIcon || maskableIcon.sizes !== '192x192' || maskableIcon.type !== 'image/png' || maskableIcon.purpose !== 'maskable') fail('manifest deve referenciar /icon-maskable-192.png como ícone maskable 192x192 image/png');

const index=read('index.html');
if(!index.includes('<title>KÓDICE — Leitura local</title>')) fail('index deve usar o título público KÓDICE — Leitura local');
if(!index.includes('<meta name="apple-mobile-web-app-title" content="Kódice" />')) fail('index deve usar apple-mobile-web-app-title Kódice');
if(!index.includes('<link rel="manifest" href="/manifest.webmanifest" />')) fail('index não referencia manifest corretamente');
if(!index.includes('<link rel="apple-touch-icon" sizes="192x192" href="/icon-maskable-192.png" />')) fail('index deve usar /icon-maskable-192.png como apple-touch-icon');
if(!index.includes('<link rel="icon" href="/192x192.png" type="image/png" />')) fail('index deve usar /192x192.png como favicon');
if(!index.includes('Kódice')) fail('index deve conter o nome público Kódice');
if(index.includes('Códice') || index.includes('CÓDICE')) fail('index não deve conter Códice/CÓDICE nos textos públicos principais');
if(read('README.md').includes('Códice') || read('docs/PWA_MOBILE.md').includes('Códice')) fail('README/docs PWA não devem conter Códice em textos públicos');
if(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh/.test(index)) fail('CDN antiga no index.html');
if(/pdf\.worker.*https?:\/\//.test(index)) fail('pdf.worker externo no index');
if(!exists('dist/sw.js')) fail('dist/sw.js ausente; rode bun run build antes');
else {
 const sw=read('dist/sw.js');
 if(!sw.includes('/192x192.png') || !sw.includes('/icon-maskable-192.png')) fail('sw.js deve precachear os ícones 192x192 da marca');
 if(/supabase/i.test(sw)) fail('sw.js menciona Supabase');
 if(/\.ts\.net/i.test(sw)) fail('sw.js menciona .ts.net');
 if(/method\s*!==\s*['"]GET['"]/.test(sw)===false && /request\.method/.test(sw)===false) fail('sw.js não valida método GET');
}
if(process.exitCode) process.exit(process.exitCode);
console.log('PWA verification passed.');
