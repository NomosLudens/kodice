#!/usr/bin/env node
/**
 * test-core-corpus-wave-5.mjs
 *
 * Validação REAL da PR "Special Criminal Law Core · Wave 5" — as
 * 10 normas penais especiais (Lei de Drogas, Estatuto do
 * Desarmamento, Crimes Hediondos, Organizações Criminosas, Lavagem
 * de Dinheiro, Interceptação Telefônica, Abuso de Autoridade,
 * Prisão Temporária, Tortura, Identificação Criminal).
 *
 * Garante:
 *   - 9 norms adicionadas (1 BLOCKED: desarm2003 / L10826)
 *   - cada snapshot tem SHA-256 verificado
 *   - cada corpus passa no validateNorm
 *   - API /api/legal/catalog retorna as 9 com installed=true
 *   - API /api/legal/norms/:id/units/<art> retorna o artigo-alvo real
 *   - download endpoint é idempotente
 *   - busca global encontra os termos canônicos
 *   - as 41 normas anteriores continuam funcionando
 *
 * Sem mock. Sem LLM. Texto jurídico provém do snapshot oficial.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { buildLegalDatabase } from './build-legal-db.mjs';
import { startLegalApiServer } from './legal-api-server.mjs';
import { validateNorm, OFFICIAL_SOURCE_HOSTS } from './legal-corpus-lib.mjs';

const TARGETS = [
  { id: 'drogas2006',    article: 'art1',  textMarker: 'SISNAD' },
  { id: 'drogas2006',    article: 'art28', textMarker: 'consumo pessoal' },
  { id: 'drogas2006',    article: 'art33', textMarker: 'Importar, exportar' },
  { id: 'hediondos1990', article: 'art1',  textMarker: 'hediondos' },
  { id: 'hediondos1990', article: 'art2',  textMarker: 'tráfico' },
  { id: 'orcrim2013',     article: 'art1',  textMarker: 'organização criminosa' },
  { id: 'orcrim2013',     article: 'art2',  textMarker: 'Promover' },
  { id: 'lavagem1998',   article: 'art1',  textMarker: 'Ocultar' },
  { id: 'intercept1996',  article: 'art1',  textMarker: 'interceptação' },
  { id: 'intercept1996',  article: 'art2',  textMarker: 'N\u00e3o ser\u00e1 admitida' },
  { id: 'abuso2019',     article: 'art1',  textMarker: 'abuso de autoridade' },
  { id: 'pt1989',         article: 'art1',  textMarker: 'prisão temporária' },
  { id: 'tortura1997',   article: 'art1',  textMarker: 'tortura' },
  { id: 'idcriminal2009', article: 'art3',  textMarker: 'identificação criminal' },
];

const INSTALLED_NORMS = [
  'drogas2006', 'hediondos1990', 'orcrim2013', 'lavagem1998', 'intercept1996',
  'abuso2019', 'pt1989', 'tortura1997', 'idcriminal2009',
];

const BLOCKED_NORMS = [
  { id: 'desarm2003', reason: 'L10826 indisponível: 301→404 em todas as variações Planalto' },
];

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`ok - ${msg}`); }
  else { failed++; console.error(`not ok - ${msg}`); }
}

const root = process.cwd();
const catalog = JSON.parse(await fs.readFile(path.resolve(root, 'legal/catalog.json'), 'utf8'));

// 1. Catálogo conhece as 9 norms com sourceUrl whitelisted
for (const id of INSTALLED_NORMS) {
  const n = catalog.norms.find(x => x.id === id);
  check(!!n, `catalog has ${id}`);
  if (n) {
    check(typeof n.officialSourceUrl === 'string' && n.officialSourceUrl.startsWith('https://'),
      `${id} has https sourceUrl`);
    const u = new URL(n.officialSourceUrl);
    check(OFFICIAL_SOURCE_HOSTS.has(u.hostname.toLowerCase()),
      `${id} source host is whitelisted: ${u.hostname}`);
  }
}

// 2. desarm2003 NÃO está no catálogo (BLOCKED)
const desarm = catalog.norms.find(x => x.id === 'desarm2003');
check(!desarm, `desarm2003 NOT in catalog (BLOCKED, sem fonte oficial determinística)`);

// 3. Cada corpus existe, valida, e bate o sourceHash
for (const id of INSTALLED_NORMS) {
  const corpusFile = path.resolve(root, `legal/corpus/${id}.json`);
  let corpus;
  try { corpus = JSON.parse(await fs.readFile(corpusFile, 'utf8')); }
  catch (e) { check(false, `${id} corpus readable`); continue; }
  check(corpus.id === id, `${id} corpus has correct id`);
  check(typeof corpus.units === 'object' && Array.isArray(corpus.units), `${id} units is array`);
  const sourceFile = path.resolve(root, corpus.sourceFile);
  const buf = await fs.readFile(sourceFile);
  const sha = createHash('sha256').update(buf).digest('hex');
  check(sha === corpus.sourceHash, `${id} sourceHash matches snapshot`);
  try { validateNorm(corpus); check(true, `${id} validateNorm OK`); }
  catch (e) { check(false, `${id} validateNorm OK: ${e.message}`); }
}

// 4. Build DB, start API
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-wave5-'));
const testDbPath = path.join(tmpDir, 'wave5.db');
await buildLegalDatabase(testDbPath);
const { server, db } = await startLegalApiServer(testDbPath, 0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;

try {
  // 5. /api/legal/catalog: 50/50 com installed=true (41 + 9 da onda 5)
  const r1 = await fetch(`${base}/api/legal/catalog`);
  check(r1.status === 200, `GET /api/legal/catalog status`);
  const catData = await r1.json();
  check(catData.norms.length === 50, `catalog tem 50 normas (got ${catData.norms.length})`);
  const allInstalled = catData.norms.every(n => n.installed === true);
  check(allInstalled, `CATALOG_PENDING=0: todas as 50 normas instaladas`);

  // 6. Cada artigo-alvo retorna o texto correto via API
  for (const t of TARGETS) {
    const r = await fetch(`${base}/api/legal/norms/${t.id}/units/${t.article}`);
    check(r.status === 200, `${t.id}/${t.article} API status 200`);
    if (r.status === 200) {
      const u = await r.json();
      check(u.kind === 'artigo', `${t.id}/${t.article} kind is artigo`);
      check(u.text && u.text.toLowerCase().includes(t.textMarker.toLowerCase()),
        `${t.id}/${t.article} text contains marker "${t.textMarker}"`);
    }
  }

  // 7. Busca textual dentro de cada norma
  const searchTerms = {
    'drogas2006':    'tráfico',
    'hediondos1990': 'hediondo',
    'orcrim2013':    'organização criminosa',
    'lavagem1998':   'ocultar',
    'intercept1996': 'interceptação',
    'abuso2019':     'abuso de autoridade',
    'pt1989':        'prisão temporária',
    'tortura1997':   'tortura',
    'idcriminal2009':'identificação criminal',
  };
  for (const id of INSTALLED_NORMS) {
    const term = searchTerms[id];
    const r = await fetch(`${base}/api/legal/norms/${id}/search?q=${encodeURIComponent(term)}&limit=5`);
    check(r.status === 200, `${id} search status`);
    if (r.status === 200) {
      const results = await r.json();
      check(Array.isArray(results) && results.length >= 1, `${id} search "${term}" returns >=1 (got ${results.length})`);
    }
  }

  // 8. Global search canônica
  for (const q of ['tráfico de drogas', 'organização criminosa', 'lavagem de dinheiro', 'interceptação', 'abuso de autoridade', 'prisão temporária', 'tortura', 'identificação criminal']) {
    const r = await fetch(`${base}/search?q=${encodeURIComponent(q)}`);
    check(r.status === 200, `global search "${q}" status`);
    if (r.status === 200) {
      const results = await r.json();
      const matched = results.some(x => INSTALLED_NORMS.includes(x.normId));
      check(matched, `global search "${q}" finds new norms`);
    }
  }

  // 9. Download endpoint: idempotência
  for (const id of INSTALLED_NORMS.slice(0, 3)) {
    const r = await fetch(`${base}/api/legal/norms/download`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    check(r.status === 200, `POST /api/legal/norms/download ${id} status`);
    if (r.status === 200) {
      const d = await r.json();
      check(d.ok === true && d.alreadyInstalled === true, `${id} alreadyInstalled=true (idempotency)`);
    }
  }

  // 10. desarm2003 (BLOCKED) deve ser rejeitado
  const r10 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'desarm2003' }),
  });
  check(r10.status === 404 || r10.status === 400, `desarm2003 (BLOCKED) rejected (${r10.status})`);

  // 11. URL inválida: catálogo rejeita
  const r11 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'invalido-xyz' }),
  });
  check(r11.status === 404 || r11.status === 400, `unknown norm id rejected (${r11.status})`);

  // 12. Regressão: 41 normas anteriores continuam funcionando
  const cf88art5 = await fetch(`${base}/api/legal/norms/cf88/units/art5`);
  check(cf88art5.status === 200, `CF88/art5 ainda funciona (regressão)`);
  const cpc300 = await fetch(`${base}/api/legal/norms/cpc2015/units/art300`);
  check(cpc300.status === 200, `CPC2015/art300 ainda funciona (regressão)`);
  const cc2002art1 = await fetch(`${base}/api/legal/norms/cc2002/units/art1`);
  check(cc2002art1.status === 200, `CC2002/art1 ainda funciona (regressão)`);
  const acpArt1 = await fetch(`${base}/api/legal/norms/acp1985/units/art1`);
  check(acpArt1.status === 200, `acp1985/art1 ainda funciona (regressão)`);
  const drogasArt33 = await fetch(`${base}/api/legal/norms/drogas2006/units/art33`);
  check(drogasArt33.status === 200, `drogas2006/art33 (Busca por "art 33 lei de drogas")`);

} finally {
  server.close();
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
