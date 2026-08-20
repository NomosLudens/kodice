#!/usr/bin/env node
/**
 * download-camara.mjs
 *
 * Downloader determinístico para leis federais a partir do snapshot
 * oficial da Câmara dos Deputados (texto atualizado).
 *
 * A Câmara migrou de `www.camara.leg.br` para `www2.camara.leg.br` nos
 * URLs `legin/fed/lei/...`. Ambos os hosts estão na whitelist de
 * fontes oficiais (legal-corpus-lib.mjs OFFICIAL_SOURCE_HOSTS).
 *
 * Uso:
 *   node scripts/download-camara.mjs acp1985
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const TARGETS = {
  // L7347 (Ação Civil Pública) — texto atualizado da Câmara.
  // A primeira tentativa na onda 3 usou a data incorreta "20 de julho";
  // a URL correta é "24 de julho de 1985" (Câmara 356939).
  acp1985: {
    url: 'https://www2.camara.leg.br/legin/fed/lei/1980-1987/lei-7347-24-julho-1985-356939-normaatualizada-pl.html',
    file: 'lei7347-24julho1985-normaatualizada.htm',
  },
  // L10826 (Estatuto do Desarmamento) — texto consolidado oficial
  // hospedado pela Câmara dos Deputados como PDF (Câmara ID 490580).
  // NOTA: A Câmara removeu este PDF do acesso público (URL retorna
  // 404 em 2026-08-20). O snapshot local foi preservado a partir do
  // Internet Archive / Wayback Machine. O arquivo `download-camara.mjs`
  // tentará a URL oficial; se a Câmara ainda retornar 404, a
  // aquisição fica bloqueada e o snapshot local é usado como
  // fonte canônica. A aquisição é IDEMPOTENTE — após a primeira
  // materialização, snapshots subsequentes caem no caminho
  // "alreadyInstalled" sem necessidade de rede.
  desarm2003: {
    url: 'https://www2.camara.leg.br/legin/fed/lei/2003/lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf',
    file: 'lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf',
  },
  // L8036/1990 (FGTS) — texto consolidado oficial hospedado pela Câmara.
  // O Planalto não serve a URL (404 em todas as variações). A Câmara
  // hospeda como HTML texto-atualizado. Reutiliza o padrão Câmara.
  fgts1990: {
    url: 'https://www2.camara.leg.br/legin/fed/lei/1990/lei-8036-11-maio-1990-365155-normaatualizada-pl.html',
    file: 'lei-8036-11-maio-1990-365155-normaatualizada-pl.html',
  },
};

function fail(m) { console.error(m); process.exit(1); }

const normId = process.argv[2];
if (!normId || !TARGETS[normId]) {
  fail(`uso: node scripts/download-camara.mjs <${Object.keys(TARGETS).join('|')}>`);
}

const t = TARGETS[normId];
const u = new URL(t.url);
if (u.protocol !== 'https:') fail(`${normId}: source URL must be HTTPS`);

const outDir = path.resolve(`legal/sources/${normId}`);
const outFile = path.join(outDir, t.file);

console.log(`[download-camara] fetching ${t.url} ...`);
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 120_000);
let res;
try {
  res = await fetch(t.url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    signal: ctrl.signal,
    redirect: 'follow',
  });
} catch (e) {
  clearTimeout(timer);
  fail(`fetch failed: ${e?.message || e}`);
}
clearTimeout(timer);
if (!res.ok) fail(`HTTP ${res.status} for ${t.url}`);
const buf = Buffer.from(await res.arrayBuffer());
if (buf.length < 5_000) fail(`snapshot too small: ${buf.length} bytes`);

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(outFile, buf);
const sha = createHash('sha256').update(buf).digest('hex');
console.log(`[download-camara] ${normId}: wrote ${outFile} (${buf.length} bytes) sha256=${sha}`);
