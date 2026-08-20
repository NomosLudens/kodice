#!/usr/bin/env node
/**
 * test-core-corpus-wave-1.mjs
 *
 * Validação REAL da PR "Corpus Federal Essencial · Wave 1" — os 8 códigos
 * federais adicionados nesta onda (CC, CP, CPP, CDC, CLT, CTN, ECA, LGPD).
 *
 * Garante:
 *   - catálogo conhece as 8 normas
 *   - cada norma tem officialSourceUrl canônico do Planalto (HTTPS)
 *   - cada snapshot foi baixado e o SHA-256 do arquivo bate com o declarado
 *     no corpus/<id>.json
 *   - cada corpus passa no validateNorm
 *   - API /api/legal/catalog retorna as 8 com installed=true
 *   - API /api/legal/norms/:id/units/<art> retorna o artigo-alvo real
 *   - download endpoint é idempotente (alreadyInstalled)
 *   - busca textual dentro de cada norma encontra termos reais
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
  { id: 'cc2002',   number: '10406', article: 'art1',     textMarker: 'Toda pessoa é capaz' },
  { id: 'cp1940',   number: '2848',  article: 'art121',   textMarker: 'Matar alguem' },
  { id: 'cpp1941',  number: '3689',  article: 'art312',   textMarker: 'pris\u00e3o preventiva poder\u00e1 ser decretada' },
  { id: 'cdc1990',  number: '8078',  article: 'art6',     textMarker: 'S\u00e3o direitos b\u00e1sicos do consumidor' },
  { id: 'clt1943',  number: '5452',  article: 'art3',     textMarker: 'Considera-se empregado' },
  { id: 'ctn1966',  number: '5172',  article: 'art3',     textMarker: 'Tributo \u00e9 toda presta\u00e7\u00e3o pecuni\u00e1ria' },
  { id: 'eca1990',  number: '8069',  article: 'art4',     textMarker: 'dever da fam\u00edlia' },
  { id: 'lgpd2018', number: '13709', article: 'art6',     textMarker: 'boa-f\u00e9' },
];

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`ok - ${msg}`); }
  else { failed++; console.error(`not ok - ${msg}`); }
}

const root = process.cwd();
const catalog = JSON.parse(await fs.readFile(path.resolve(root, 'legal/catalog.json'), 'utf8'));

// 1. Catálogo conhece as 8 normas
for (const t of TARGETS) {
  const n = catalog.norms.find(x => x.id === t.id);
  check(!!n, `catalog has ${t.id}`);
  if (n) {
    check(typeof n.officialSourceUrl === 'string' && n.officialSourceUrl.startsWith('https://'), `${t.id} has https sourceUrl`);
    const u = new URL(n.officialSourceUrl);
    check(OFFICIAL_SOURCE_HOSTS.has(u.hostname.toLowerCase()), `${t.id} source host is whitelisted: ${u.hostname}`);
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
  // Source file SHA-256
  const sourceFile = path.resolve(root, corpus.sourceFile);
  const buf = await fs.readFile(sourceFile);
  const sha = createHash('sha256').update(buf).digest('hex');
  check(sha === corpus.sourceHash, `${t.id} sourceHash matches snapshot`);
  // validateNorm passes
  try { validateNorm(corpus); check(true, `${t.id} validateNorm OK`); }
  catch (e) { check(false, `${t.id} validateNorm OK: ${e.message}`); }
}

// 3. Build DB, start API, query
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-wave1-'));
const testDbPath = path.join(tmpDir, 'wave1.db');
await buildLegalDatabase(testDbPath);
const { server, db } = await startLegalApiServer(testDbPath, 0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;

try {
  // 4. /api/legal/catalog retorna as 8 com installed=true
  const r1 = await fetch(`${base}/api/legal/catalog`);
  check(r1.status === 200, `GET /api/legal/catalog status`);
  const catData = await r1.json();
  for (const t of TARGETS) {
    const n = catData.norms.find(x => x.id === t.id);
    check(n && n.installed === true, `${t.id} reported as installed in catalog`);
  }

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
    cc2002:   'personalidade',
    cp1940:   'homic\u00eddio',
    cpp1941:  'prisão preventiva',
    cdc1990:  'consumidor',
    clt1943:  'empregado',
    ctn1966:  'tributo',
    eca1990:  'crian\u00e7a',
    lgpd2018: 'dados pessoais',
  };
  for (const t of TARGETS) {
    const term = searchTerms[t.id];
    const r = await fetch(`${base}/api/legal/norms/${t.id}/search?q=${encodeURIComponent(term)}&limit=5`);
    check(r.status === 200, `${t.id} search status`);
    if (r.status === 200) {
      const results = await r.json();
      check(Array.isArray(results) && results.length >= 1, `${t.id} search "${term}" returns >=1 result (got ${results.length})`);
    }
  }

  // 7. Download endpoint: idempotência
  const r7 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'cc2002' }),
  });
  check(r7.status === 200, `POST /api/legal/norms/download status`);
  if (r7.status === 200) {
    const d = await r7.json();
    check(d.ok === true, `download ok=true`);
    check(d.alreadyInstalled === true, `download reports alreadyInstalled=true (idempotency)`);
  }

  // 8. URL inválida: catálogo rejeita
  const r8 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'invalido-xyz' }),
  });
  check(r8.status === 404 || r8.status === 400, `unknown norm id rejected (${r8.status})`);

} finally {
  server.close();
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
