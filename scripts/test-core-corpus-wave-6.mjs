#!/usr/bin/env node
/**
 * test-core-corpus-wave-6.mjs
 *
 * Validação REAL da PR 7 "Previdenciário & Trabalho Complementar" — as
 * 10 normas adicionadas nesta onda (Lei 8.212, 8.213, 8.742, 8.036,
 * 7.998, 7.783, 5.889, LC 150, 6.019, 7.418).
 *
 * Garante:
 *   - 10 normas adicionadas com sourceUrl oficial (Planalto HTTPS ou Câmara)
 *   - cada snapshot tem SHA-256 verificado
 *   - cada corpus passa no validateNorm
 *   - API /api/legal/catalog retorna as 10 com installed=true
 *   - CATALOG_PENDING=0 (61/61)
 *   - API /api/legal/norms/:id/units/<art> retorna o artigo-alvo real
 *   - download endpoint é idempotente
 *   - busca global encontra os aliases canônicos
 *   - as 51 normas anteriores continuam funcionando
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { buildLegalDatabase } from './build-legal-db.mjs';
import { startLegalApiServer } from './legal-api-server.mjs';
import { validateNorm, OFFICIAL_SOURCE_HOSTS } from './legal-corpus-lib.mjs';

const TARGETS = [
  { id: 'prev-custeio1991', article: 'art1', textMarker: 'Seguridade Social' },
  { id: 'prev-benef1991',   article: 'art1', textMarker: 'Previd' },
  { id: 'loas1993',         article: 'art1', textMarker: 'assist' },
  { id: 'fgts1990',         article: 'art1', textMarker: 'Fundo de Garantia' },
  { id: 'seguro-desemp1990', article: 'art1', textMarker: 'Programa do Seguro' },
  { id: 'greve1989',        article: 'art1', textMarker: 'greve' },
  { id: 'trab-rural1973',   article: 'art2', textMarker: 'Empregado rural' },
  { id: 'domestica2015',     article: 'art1', textMarker: 'dom' },
  { id: 'trab-temp1974',  article: 'art2', textMarker: 'Trabalho tempor' },
  { id: 'vt1985',           article: 'art1', textMarker: 'vale-transporte' },
];

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`ok - ${msg}`); }
  else { failed++; console.error(`not ok - ${msg}`); }
}

const root = process.cwd();
const catalog = JSON.parse(await fs.readFile(path.resolve(root, 'legal/catalog.json'), 'utf8'));

// 1. Catálogo conhece as 10 normas com sourceUrl whitelisted
for (const t of TARGETS) {
  const n = catalog.norms.find(x => x.id === t.id);
  check(!!n, `catalog has ${t.id}`);
  if (n) {
    check(typeof n.officialSourceUrl === 'string' && n.officialSourceUrl.startsWith('https://'),
      `${t.id} has https sourceUrl`);
    const u = new URL(n.officialSourceUrl);
    check(OFFICIAL_SOURCE_HOSTS.has(u.hostname.toLowerCase()),
      `${t.id} source host is whitelisted: ${u.hostname}`);
  }
}

// 2. LC 150 type=lei.complementar
const lc150 = catalog.norms.find(x => x.id === 'domestica2015');
check(lc150 && lc150.type === 'lei.complementar',
  'domestica2015 (LC 150) type=lei.complementar');

// 3. Cada corpus existe, valida, e bate o sourceHash
for (const t of TARGETS) {
  const corpusFile = path.resolve(root, `legal/corpus/${t.id}.json`);
  let corpus;
  try { corpus = JSON.parse(await fs.readFile(corpusFile, 'utf8')); }
  catch (e) { check(false, `${t.id} corpus readable`); continue; }
  check(corpus.id === t.id, `${t.id} corpus has correct id`);
  check(Array.isArray(corpus.units), `${t.id} units is array`);
  const sourceFile = path.resolve(root, corpus.sourceFile);
  const buf = await fs.readFile(sourceFile);
  const sha = createHash('sha256').update(buf).digest('hex');
  check(sha === corpus.sourceHash, `${t.id} sourceHash matches snapshot`);
  try { validateNorm(corpus); check(true, `${t.id} validateNorm OK`); }
  catch (e) { check(false, `${t.id} validateNorm OK: ${e.message}`); }
}

// 4. Build DB, start API
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-wave6-'));
const testDbPath = path.join(tmpDir, 'wave6.db');
await buildLegalDatabase(testDbPath);
const { server, db } = await startLegalApiServer(testDbPath, 0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;

try {
  // 5. /api/legal/catalog: 61/61
  const r1 = await fetch(`${base}/api/legal/catalog`);
  check(r1.status === 200, 'GET /api/legal/catalog status');
  const catData = await r1.json();
  check(catData.norms.length === 61, `catalog tem 61 normas (got ${catData.norms.length})`);
  const allInstalled = catData.norms.every(n => n.installed === true);
  check(allInstalled, `CATALOG_PENDING=0: todas as 61 normas instaladas`);

  // 6. Cada artigo-alvo retorna o texto correto
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
    'prev-custeio1991': 'contribuição',
    'prev-benef1991':   'aposentadoria',
    'loas1993':         'assistência',
    'fgts1990':         'FGTS',
    'seguro-desemp1990': 'seguro',
    'greve1989':        'greve',
    'trab-rural1973':   'rural',
    'domestica2015':     'doméstico',
    'trab-temp1974':  'temporário',
    'vt1985':           'vale-transporte',
  };
  for (const t of TARGETS) {
    const term = searchTerms[t.id];
    const r = await fetch(`${base}/api/legal/norms/${t.id}/search?q=${encodeURIComponent(term)}&limit=5`);
    check(r.status === 200, `${t.id} search status`);
    if (r.status === 200) {
      const results = await r.json();
      check(Array.isArray(results) && results.length >= 1, `${t.id} search "${term}" returns >=1 (got ${results.length})`);
    }
  }

  // 8. Global search canônica
  for (const q of ['FGTS', 'LOAS', 'Seguro-Desemprego', 'Vale-Transporte', 'Empregado Doméstico']) {
    const r = await fetch(`${base}/search?q=${encodeURIComponent(q)}`);
    check(r.status === 200, `global search "${q}" status`);
    if (r.status === 200) {
      const results = await r.json();
      const matched = results.some(x => ['fgts1990','loas1993','seguro-desemp1990','vt1985','domestica2015'].includes(x.normId));
      check(matched, `global search "${q}" finds new norms`);
    }
  }

  // 9. Download endpoint: idempotência
  for (const t of TARGETS.slice(0, 3)) {
    const r = await fetch(`${base}/api/legal/norms/download`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id }),
    });
    check(r.status === 200, `POST /api/legal/norms/download ${t.id} status`);
    if (r.status === 200) {
      const d = await r.json();
      check(d.ok === true && d.alreadyInstalled === true, `${t.id} alreadyInstalled=true (idempotency)`);
    }
  }

  // 10. URL inválida: catálogo rejeita
  const r10 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'invalido-xyz' }),
  });
  check(r10.status === 404 || r10.status === 400, `unknown norm id rejected (${r10.status})`);

  // 11. Regressão: 51 normas anteriores continuam funcionando
  const cf88art5 = await fetch(`${base}/api/legal/norms/cf88/units/art5`);
  check(cf88art5.status === 200, 'CF88/art5 ainda funciona (regressão)');
  const cpc300 = await fetch(`${base}/api/legal/norms/cpc2015/units/art300`);
  check(cpc300.status === 200, 'CPC2015/art300 ainda funciona (regressão)');
  const acpArt1 = await fetch(`${base}/api/legal/norms/acp1985/units/art1`);
  check(acpArt1.status === 200, 'acp1985/art1 ainda funciona (regressão)');
  const desarmArt12 = await fetch(`${base}/api/legal/norms/desarm2003/units/art12`);
  check(desarmArt12.status === 200, 'desarm2003/art12 ainda funciona (regressão wave 5 fix)');

} finally {
  server.close();
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
