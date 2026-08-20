#!/usr/bin/env node
/**
 * test-core-corpus-wave-2.mjs
 *
 * Validação REAL da PR "Federal Corpus Wave 2 / Catalog Closure" — as
 * 11 normas que completam o catálogo existente (CATALOG_NORMS=21).
 *
 * Garante:
 *   - catálogo conhece as 11 normas com officialSourceUrl oficial
 *   - cada snapshot foi baixado e o SHA-256 do arquivo bate com o declarado
 *   - cada corpus passa no validateNorm
 *   - API /api/legal/catalog retorna as 11 com installed=true
 *   - API /api/legal/norms/:id/units/<art> retorna o artigo-alvo real
 *   - download endpoint é idempotente
 *   - busca textual dentro de cada norma encontra termos reais
 *   - todas as 21 normas estão instaladas (CATALOG_PENDING=0)
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
  { id: 'cf88-adct',  article: 'art1',     textMarker: 'O Presidente da Rep' },
  { id: 'lindb',      article: 'art4',     textMarker: 'juiz decidir' },
  { id: 'lep1984',    article: 'art1',     textMarker: 'execu' },
  { id: 'ctb1997',    article: 'art165',   textMarker: 'Dirigir sob a influ' },
  { id: 'lai2011',    article: 'art3',     textMarker: 'procedimentos previstos' },
  { id: 'lia1992',    article: 'art9',     textMarker: 'improbidade administrativa' },
  { id: 'lbi2015',    article: 'art2',     textMarker: 'instituído o cordão' },
  { id: 'lmp2006',    article: 'art7',     textMarker: 'viol' },
  { id: 'eaoab1994',  article: 'art7',     textMarker: 'advogado' },
  { id: 'cpm1969',    article: 'art9',     textMarker: 'crimes militares' },
  { id: 'cppm1969',   article: 'art3',     textMarker: 'casos omissos' },
];

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`ok - ${msg}`); }
  else { failed++; console.error(`not ok - ${msg}`); }
}

const root = process.cwd();
const catalog = JSON.parse(await fs.readFile(path.resolve(root, 'legal/catalog.json'), 'utf8'));

// 1. Catálogo conhece as 11 normas com sourceUrl whitelisted
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

// 2. Cada corpus existe, valida, e bate o sourceHash
for (const t of TARGETS) {
  const corpusFile = path.resolve(root, `legal/corpus/${t.id}.json`);
  let corpus;
  try { corpus = JSON.parse(await fs.readFile(corpusFile, 'utf8')); }
  catch (e) { check(false, `${t.id} corpus readable`); continue; }
  check(corpus.id === t.id, `${t.id} corpus has correct id`);
  check(typeof corpus.units === 'object' && Array.isArray(corpus.units), `${t.id} units is array`);
  const sourceFile = path.resolve(root, corpus.sourceFile);
  const buf = await fs.readFile(sourceFile);
  const sha = createHash('sha256').update(buf).digest('hex');
  check(sha === corpus.sourceHash, `${t.id} sourceHash matches snapshot`);
  try { validateNorm(corpus); check(true, `${t.id} validateNorm OK`); }
  catch (e) { check(false, `${t.id} validateNorm OK: ${e.message}`); }
}

// 3. Build DB, start API
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-wave2-'));
const testDbPath = path.join(tmpDir, 'wave2.db');
await buildLegalDatabase(testDbPath);
const { server, db } = await startLegalApiServer(testDbPath, 0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;

try {
  // 4. /api/legal/catalog: 21 (ou mais, conforme waves subsequentes) normas com installed=true
  const r1 = await fetch(`${base}/api/legal/catalog`);
  check(r1.status === 200, `GET /api/legal/catalog status`);
  const catData = await r1.json();
  // A onda 2 fixou 21. Ondas subsequentes (wave 3+) adicionam mais.
  // O test passa enquanto a onda 2 não regredir (= 21 instaladas mínimas).
  check(catData.norms.length >= 21, `catalog tem pelo menos 21 normas (got ${catData.norms.length})`);
  // Wave 4 e 5 adicionaram mais. A onda 2 continua íntegra.
  // Wave 4 não deve regredir wave 2 (corpus da onda 2 continua presente).
  // Já que o build só adiciona e nunca deleta, >= 21 é suficiente.
  const allInstalled = catData.norms.every(n => n.installed === true);
  check(allInstalled, `CATALOG_PENDING=0: todas as ${catData.norms.length} normas instaladas`);

  // 5. Cada artigo-alvo retorna o texto correto via API
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

  // 6. Busca textual dentro de cada norma
  const searchTerms = {
    'cf88-adct': 'disposições',
    'lindb':     'analogia',
    'lep1984':   'execução',
    'ctb1997':   'trânsito',
    'lai2011':   'informação',
    'lia1992':   'improbidade',
    'lbi2015':   'deficiência',
    'lmp2006':   'mulher',
    'eaoab1994': 'advogado',
    'cpm1969':   'crime',
    'cppm1969':  'inquérito',
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

  // 7. Download endpoint: idempotência
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

  // 8. URL inválida: catálogo rejeita
  const r8 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'invalido-xyz' }),
  });
  check(r8.status === 404 || r8.status === 400, `unknown norm id rejected (${r8.status})`);

  // 9. CF88 e CPC2015 ainda funcionam (regressão)
  const cf88art5 = await fetch(`${base}/api/legal/norms/cf88/units/art5`);
  check(cf88art5.status === 200, `CF88/art5 ainda funciona (regressão)`);
  const cpc300 = await fetch(`${base}/api/legal/norms/cpc2015/units/art300`);
  check(cpc300.status === 200, `CPC2015/art300 ainda funciona (regressão)`);

} finally {
  server.close();
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
