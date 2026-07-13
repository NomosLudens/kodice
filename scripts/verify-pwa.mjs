import fs from 'node:fs';
import path from 'node:path';
function fail(m){ console.error(m); process.exitCode=1; }
function exists(p){ return fs.existsSync(p); }
let manifest;
try{ manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8')); }catch(e){ fail('manifest inválido ou ausente'); manifest={}; }
for (const k of ['name','short_name']) if(!manifest[k]) fail(`${k} ausente`);
if(manifest.start_url !== '/') fail('start_url deve ser /');
if(manifest.scope !== '/') fail('scope deve ser /');
if(manifest.display !== 'standalone') fail('display deve ser standalone');
['public/icon.png','public/favicon.png'].forEach(p=>{ if(!exists(p)) fail(`${p} ausente`); });
if(exists('public/icons')) fail('public/icons não deve existir; este PR reutiliza os ícones já existentes');
const index=fs.readFileSync('index.html','utf8');
if(!index.includes('manifest.webmanifest')) fail('index não referencia manifest');
if(!index.includes('apple-touch-icon')) fail('index não referencia apple-touch-icon');
if(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh/.test(index)) fail('CDN antiga no index.html');
if(/pdf\.worker.*https?:\/\//.test(index)) fail('pdf.worker externo no index');
if(!exists('dist/sw.js')) fail('dist/sw.js ausente; rode bun run build antes');
else {
 const sw=fs.readFileSync('dist/sw.js','utf8');
 if(/supabase/i.test(sw)) fail('sw.js menciona Supabase');
 if(/\.ts\.net/i.test(sw)) fail('sw.js menciona .ts.net');
 if(/method\s*!==\s*['"]GET['"]/.test(sw)===false && /request\.method/.test(sw)===false) fail('sw.js não valida método GET');
}
if(process.exitCode) process.exit(process.exitCode);
console.log('PWA verification passed.');
