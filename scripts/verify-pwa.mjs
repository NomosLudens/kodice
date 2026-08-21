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
function expectPngExact(p, w, h){
  if(!exists(p)){ fail(`${p} ausente`); return; }
  const { width, height } = pngSize(p);
  if(width !== w || height !== h) fail(`${p} deve ter dimensões reais ${w}×${h}; encontrado ${width}×${height}`);
}

let manifest;
try{ manifest=JSON.parse(read('public/manifest.webmanifest')); }catch(e){ fail('manifest inválido ou ausente'); manifest={}; }

if(manifest.name !== 'Kódice — Vade Mecum') fail('manifest name deve ser "Kódice — Vade Mecum"');
if(manifest.short_name !== 'Kódice') fail('manifest short_name deve ser "Kódice"');
if(manifest.description !== 'Vade Mecum brasileiro. Constituição, códigos e legislação especial verificados em fonte oficial.') fail('manifest description incorreta');
if(manifest.start_url !== '/') fail('start_url deve ser /');
if(manifest.scope !== '/') fail('scope deve ser /');
if(manifest.display !== 'standalone') fail('display deve ser standalone');
if(!/pt-BR/.test(manifest.lang)) fail('manifest lang deve ser pt-BR');

// Ícones oficiais do cristal Kódice
expectPngExact('public/icon-192.png', 192, 192);
expectPngExact('public/icon-512.png', 512, 512);
expectPngExact('public/icon-maskable-192.png', 192, 192);
expectPngExact('public/icon-maskable-512.png', 512, 512);
expectPngExact('public/favicon.png', 180, 180);

const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
const hasAny192 = icons.find(i => i.src === '/icon-192.png' && i.sizes === '192x192' && i.type === 'image/png' && i.purpose === 'any');
const hasAny512 = icons.find(i => i.src === '/icon-512.png' && i.sizes === '512x512' && i.type === 'image/png' && i.purpose === 'any');
const hasMaskable192 = icons.find(i => i.src === '/icon-maskable-192.png' && i.sizes === '192x192' && i.type === 'image/png' && i.purpose === 'maskable');
const hasMaskable512 = icons.find(i => i.src === '/icon-maskable-512.png' && i.sizes === '512x512' && i.type === 'image/png' && i.purpose === 'maskable');
if(!hasAny192) fail('manifest deve referenciar /icon-192.png como ícone any 192×192 image/png');
if(!hasAny512) fail('manifest deve referenciar /icon-512.png como ícone any 512×512 image/png');
if(!hasMaskable192) fail('manifest deve referenciar /icon-maskable-192.png como ícone maskable 192×192 image/png');
if(!hasMaskable512) fail('manifest deve referenciar /icon-maskable-512.png como ícone maskable 512×512 image/png');

const index=read('index.html');
if(!index.includes('<title>Kódice — Vade Mecum</title>')) fail('index deve usar o título público Kódice — Vade Mecum');
if(!index.includes('<meta name="apple-mobile-web-app-title" content="Kódice" />')) fail('index deve usar apple-mobile-web-app-title Kódice');
if(!index.includes('<link rel="manifest" href="/manifest.webmanifest" />')) fail('index não referencia manifest corretamente');
if(!index.includes('href="/icon-192.png"')) fail('index deve referenciar /icon-192.png como apple-touch-icon e/ou favicon');
if(!index.includes('<link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />')) fail('index deve usar /icon-192.png como apple-touch-icon 192x192');
if(!/<link rel="icon"[^>]*href="\/icon-(192|512)\.png"/.test(index)) fail('index deve usar /icon-192.png ou /icon-512.png como favicon');
if(!index.includes('Kódice')) fail('index deve conter o nome público Kódice');
if(index.includes('Códice') || /KÓDICE/.test(index)) fail('index não deve conter Códice/KÓDICE nos textos públicos principais');
if(read('README.md').includes('Códice') || read('docs/PWA_MOBILE.md').includes('Códice')) fail('README/docs PWA não devem conter Códice em textos públicos');
if(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh/.test(index)) fail('CDN antiga no index.html');
if(/pdf\.worker.*https?:\/\//.test(index)) fail('pdf.worker externo no index');
if(!exists('dist/sw.js')) fail('dist/sw.js ausente; rode bun run build antes');
else {
  const sw=read('dist/sw.js');
  if(!sw.includes('/icon-192.png') || !sw.includes('/icon-512.png') || !sw.includes('/icon-maskable-192.png') || !sw.includes('/icon-maskable-512.png')) fail('sw.js deve precachear todos os ícones oficiais (192/512, any+maskable)');
  if(/supabase/i.test(sw)) fail('sw.js menciona Supabase');
  if(/\.ts\.net/i.test(sw)) fail('sw.js menciona .ts.net');
  if(/method\s*!==\s*['"]GET['"]/.test(sw)===false && /request\.method/.test(sw)===false) fail('sw.js não valida método GET');
}
if(process.exitCode) process.exit(process.exitCode);
console.log('PWA verification passed.');
