#!/usr/bin/env node
/**
 * download-cf88.mjs
 *
 * Downloader determinístico da Constituição Federal de 1988 a partir do
 * Planalto (fonte oficial primária). Reutiliza o pipeline do CPC:
 *   1. Faz HTTP GET em uma URL canônica oficial (Planalto).
 *   2. Verifica que o host está na whitelist de fontes oficiais
 *      (OFFICIAL_SOURCE_HOSTS em legal-corpus-lib.mjs).
 *   3. Salva o snapshot bruto em legal/sources/cf88/constituicao.htm.
 *   4. Calcula SHA-256.
 *   5. Imprime caminho + hash para uso determinístico pelo importador.
 *
 * Sem fallback para fontes secundárias. Se Planalto falhar, falhamos.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const SOURCE_URL = 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm';
const OUT_DIR = path.resolve('legal/sources/cf88');
const OUT_FILE = path.join(OUT_DIR, 'constituicao.htm');

const OFFICIAL_HOSTS = new Set([
  'normas.leg.br',
  'www.normas.leg.br',
  'camara.leg.br',
  'www.camara.leg.br',
  'www2.camara.leg.br',
  'senado.leg.br',
  'www.senado.leg.br',
  'www25.senado.leg.br',
  'planalto.gov.br',
  'www.planalto.gov.br',
  'lexml.gov.br',
  'www.lexml.gov.br'
]);

function assert(cond, msg) { if (!cond) { console.error(`download-cf88: ${msg}`); process.exit(1); } }

const url = new URL(SOURCE_URL);
assert(url.protocol === 'https:', 'source URL must be HTTPS');
assert(OFFICIAL_HOSTS.has(url.hostname.toLowerCase()), `source host ${url.hostname} is not in OFFICIAL_HOSTS`);

console.log(`[download-cf88] fetching ${SOURCE_URL} ...`);
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 60_000);
let res;
try {
  res = await fetch(SOURCE_URL, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    },
    signal: ctrl.signal,
    redirect: 'follow'
  });
} catch (e) {
  console.error(`[download-cf88] fetch failed: ${e?.message || e}`);
  process.exit(1);
}
clearTimeout(timer);

assert(res.ok, `HTTP ${res.status}`);
const ct = res.headers.get('content-type') || '';
assert(ct.includes('text/html') || ct.includes('application/xhtml'), `unexpected content-type: ${ct}`);

// Verifica se o redirect final continua em host oficial
const finalUrl = new URL(res.url);
assert(OFFICIAL_HOSTS.has(finalUrl.hostname.toLowerCase()), `redirect target ${finalUrl.hostname} is not in OFFICIAL_HOSTS`);

const buf = Buffer.from(await res.arrayBuffer());
assert(buf.length > 100_000, `snapshot too small (${buf.length} bytes)`);

// Verifica conteúdo mínimo: deve conter marcadores conhecidos da CF
const text = buf.toString('latin1');
assert(/Art\.\s*1[ºo°]?/.test(text), 'snapshot missing Art. 1 marker');
assert(/Art\.\s*5[ºo°]?/.test(text), 'snapshot missing Art. 5 marker');
assert(/Ato das Disposi[çc][õo]es Constitucionais Transit[óo]rias/i.test(text),
  'snapshot missing ADCT marker');

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(OUT_FILE, buf);

const sha256 = createHash('sha256').update(buf).digest('hex');
const stats = { bytes: buf.length, sha256, sourceUrl: SOURCE_URL, finalUrl: res.url, contentType: ct, outFile: OUT_FILE };
console.log(`[download-cf88] saved ${stats.bytes} bytes -> ${OUT_FILE}`);
console.log(`[download-cf88] sha256=${stats.sha256}`);
console.log(`[download-cf88] source=${stats.finalUrl}`);
console.log(JSON.stringify(stats, null, 2));
