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
  // Wave 2 — complemento do acervo federal.
  lindb:    { url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm',          file: 'del4657compilado.htm' },
  lep1984:  { url: 'https://www.planalto.gov.br/ccivil_03/leis/l7210compilado.htm',                   file: 'l7210compilado.htm' },
  ctb1997:  { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9503.htm',                            file: 'l9503.htm' },
  lai2011:  { url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm',          file: 'l12527.htm' },
  lia1992:  { url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',                            file: 'l8429.htm' },
  lbi2015:  { url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm',          file: 'l13146.htm' },
  lmp2006:  { url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm',          file: 'l11340.htm' },
  eaoab1994:{ url: 'https://www.planalto.gov.br/ccivil_03/leis/l8906.htm',                            file: 'l8906.htm' },
  cpm1969:  { url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm',                  file: 'del1001.htm' },
  cppm1969: { url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm',                  file: 'del1002.htm' },
  // ADCT não tem URL dedicada em planalto.gov.br — vive dentro do snapshot
  // do CF/88 (constituicao.htm). Capturado por import-cf88-adct.mjs usando
  // startMarker + noPreamble. Veja scripts/import-cf88-adct.mjs.
  // Wave 3 — Federal academic expansion.
  // L7347 (Ação Civil Pública) está oficialmente indisponível: 404 em todas
  // as variações Planalto (ccivil_03/leis/l7347.htm, _Ato1985-1988/lei/L7347.htm,
  // leis_ant/lei7347.htm); 404 em Câmara (todas variações); 403 em Senado
  // sileg; 404 também em Wayback Machine (Planalto nunca serviu a URL).
  // A Lei 7.347/85 foi removida do repositório público do Planalto sem
  // redirecionamento oficial. NORM=acp1985 STATUS=BLOCKED. Nenhuma
  // substituição por JusBrasil/blogs/IA foi feita.
  adiadc1999: { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9868.htm',                          file: 'l9868.htm' },
  adpf1999:   { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9882.htm',                          file: 'l9882.htm' },
  ms2009:     { url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm',         file: 'l12016.htm' },
  hd1997:     { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9507.htm',                           file: 'l9507.htm' },
  ap1965:     { url: 'https://www.planalto.gov.br/ccivil_03/leis/l4717.htm',                           file: 'l4717.htm' },
  bf1990:     { url: 'https://www.planalto.gov.br/ccivil_03/leis/l8009.htm',                           file: 'l8009.htm' },
  loc1991:    { url: 'https://www.planalto.gov.br/ccivil_03/leis/l8245compilado.htm',                 file: 'l8245compilado.htm' },
  arb1996:    { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9307.htm',                           file: 'l9307.htm' },
  med2015:    { url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13140.htm',         file: 'l13140.htm' },
  // Wave 4 — Procedural & Public Law core.
  // L10259 (JEF) tem URL com pasta leis_2001 (legado).
  jec1995:        { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9099.htm',                       file: 'l9099.htm' },
  jef2001:        { url: 'https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10259.htm',              file: 'l10259.htm' },
  jefp2009:       { url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12153.htm',      file: 'l12153.htm' },
  mi2016:         { url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13300.htm',      file: 'l13300.htm' },
  paf1999:        { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm',                        file: 'l9784.htm' },
  nllc2021:       { url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',      file: 'l14133.htm' },
  lef1980:        { url: 'https://www.planalto.gov.br/ccivil_03/leis/l6830.htm',                        file: 'l6830.htm' },
  lrf2000:        { url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm',                   file: 'lcp101.htm' },
  anticorrup2013: { url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12846.htm',      file: 'l12846.htm' },
  rju1990:        { url: 'https://www.planalto.gov.br/ccivil_03/leis/l8112compilado.htm',              file: 'l8112compilado.htm' },
  // Wave 5 — Special Criminal Law core.
  // desarm2003 (L10826 — Estatuto do Desarmamento) está oficialmente
  // indisponível em fontes primárias: 301→404 em todas as variações
  // Planalto (ccivil_03/_Ato2003-2003/2003/Lei/l10826.htm,
  // leis/LEIS_2003/l10826.htm, leis_2003/l10826.htm); 404 em todas as
  // variações Câmara (Câmara ID 490580 e 538377); Senado SPA sem
  // texto extraível; normas.leg.br JS-only; LexML URN resolve mas
  // aponta para Câmara 404. NORM=desarm2003 STATUS=BLOCKED.
  // Nenhuma substituição por JusBrasil, blogs ou IA foi feita.
  drogas2006:    { url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm',    file: 'l11343.htm' },
  hediondos1990: { url: 'https://www.planalto.gov.br/ccivil_03/leis/l8072.htm',                     file: 'l8072.htm' },
  orcrim2013:     { url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12850.htm',     file: 'l12850.htm' },
  lavagem1998:   { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9613.htm',                      file: 'l9613.htm' },
  intercept1996:  { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9296.htm',                      file: 'l9296.htm' },
  abuso2019:     { url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm',    file: 'l13869.htm' },
  pt1989:         { url: 'https://www.planalto.gov.br/ccivil_03/leis/l7960.htm',                     file: 'l7960.htm' },
  tortura1997:   { url: 'https://www.planalto.gov.br/ccivil_03/leis/l9455.htm',                      file: 'l9455.htm' },
  idcriminal2009: { url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12037.htm',   file: 'l12037.htm' },
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
