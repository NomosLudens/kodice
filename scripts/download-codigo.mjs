#!/usr/bin/env node
/**
 * download-codigo.mjs
 *
 * Downloader determinístico para os 8 códigos federais desta onda (CC, CP,
 * CPP, CDC, CLT, CTN, ECA, LGPD) a partir do Planalto (fonte oficial
 * primária). Reutiliza o pipeline do CF/88:
 *   1. Faz HTTP GET em uma URL canônica oficial (Planalto).
 *   2. Verifica que o host está na whitelist de fontes oficiais
 *      (OFFICIAL_SOURCE_HOSTS em legal-corpus-lib.mjs).
 *   3. Salva o snapshot bruto em legal/sources/<id>/<filename>.
 *   4. Calcula SHA-256.
 *   5. Imprime caminho + hash para uso determinístico pelo importador.
 *
 * Sem fallback para fontes secundárias. Se Planalto falhar, falhamos.
 *
 * Uso:
 *   node scripts/download-codigo.mjs cc2002
 *   node scripts/download-codigo.mjs cp1940
 *   ...
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { OFFICIAL_SOURCE_HOSTS } from './legal-corpus-lib.mjs';

const TARGETS = {
  cc2002:   { url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406.htm',                      file: 'l10406.htm' },
  cp1940:   { url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',          file: 'del2848compilado.htm' },
  cpp1941:  { url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm',          file: 'del3689compilado.htm' },
  cdc1990:  { url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',                   file: 'l8078compilado.htm' },
  clt1943:  { url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm',          file: 'del5452compilado.htm' },
  ctn1966:  { url: 'https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm',                   file: 'l5172compilado.htm' },
  eca1990:  { url: 'https://www.planalto.gov.br/ccivil_03/leis/l8069compilado.htm',                   file: 'l8069compilado.htm' },
  lgpd2018: { url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',          file: 'l13709.htm' },
};

function fail(m){ console.error(m); process.exit(1); }
const normId = process.argv[2];
if (!normId || !TARGETS[normId]) {
  fail(`uso: node scripts/download-codigo.mjs <${Object.keys(TARGETS).join('|')}>`);
}
const t = TARGETS[normId];
const u = new URL(t.url);
if (u.protocol !== 'https:') fail(`${normId}: source URL must be HTTPS`);
if (!OFFICIAL_SOURCE_HOSTS.has(u.hostname.toLowerCase())) fail(`${normId}: source host ${u.hostname} is not in OFFICIAL_SOURCE_HOSTS`);

const outDir = path.resolve(`legal/sources/${normId}`);
const outFile = path.join(outDir, t.file);

console.log(`[download-codigo] fetching ${t.url} ...`);
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
if (!res.ok) {
  fail(`HTTP ${res.status} for ${t.url}`);
}
const buf = Buffer.from(await res.arrayBuffer());
if (buf.length < 10_000) fail(`snapshot too small: ${buf.length} bytes`);

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(outFile, buf);
const sha = createHash('sha256').update(buf).digest('hex');
console.log(`[download-codigo] ${normId}: wrote ${outFile} (${buf.length} bytes) sha256=${sha}`);
