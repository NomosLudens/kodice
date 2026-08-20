#!/usr/bin/env node
/**
 * test-core-corpus-wave-3.mjs
 *
 * Validação REAL da PR "Federal Academic Expansion · Wave 3" — as 9
 * normas federais novas que ampliam o Vade Mecum para a área acadêmica
 * (constitucional, processual civil e mediação).
 *
 * Garante:
 *   - 9 normas adicionadas com sourceUrl oficial (Planalto HTTPS)
 *   - cada snapshot tem SHA-256 verificado
 *   - cada corpus passa no validateNorm
 *   - API /api/legal/catalog retorna as 9 com installed=true
 *   - CATALOG_PENDING=0 (apenas a blocked acp1985 fica fora)
 *   - API /api/legal/norms/:id/units/<art> retorna o artigo-alvo real
 *   - download endpoint é idempotente
 *   - busca textual dentro de cada norma encontra termos reais
 *   - busca global encontra os aliases canônicos ("adi", "adc", "adpf", etc.)
 *   - as 21 normas anteriores continuam funcionando
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
  { id: 'adiadc1999', article: 'art1',  textMarker: 'inconstitucionalidade' },
  { id: 'adpf1999',   article: 'art1',  textMarker: 'preceito fundamental' },
  { id: 'ms2009',     article: 'art1',  textMarker: 'mandado de seguran' },
  { id: 'hd1997',     article: 'art1',  textMarker: 'VETADO' },
  { id: 'ap1965',     article: 'art1',  textMarker: 'patrim' },
  { id: 'bf1990',     article: 'art1',  textMarker: 'impenhor' },
  { id: 'loc1991',    article: 'art1',  textMarker: 'loca' },
  { id: 'arb1996',    article: 'art1',  textMarker: 'arbitragem' },
  { id: 'med2015',    article: 'art1',  textMarker: 'media' },
];

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`ok - ${msg}`); }
  else { failed++; console.error(`not ok - ${msg}`); }
}

const root = process.cwd();
const catalog = JSON.parse(await fs.readFile(path.resolve(root, 'legal/catalog.json'), 'utf8'));

// 1. Catálogo conhece as 9 normas com sourceUrl whitelisted
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
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-wave3-'));
const testDbPath = path.join(tmpDir, 'wave3.db');
await buildLegalDatabase(testDbPath);
const { server, db } = await startLegalApiServer(testDbPath, 0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;

try {
  // 4. /api/legal/catalog: 30 normas (21+9) com installed=true
  const r1 = await fetch(`${base}/api/legal/catalog`);
  check(r1.status === 200, `GET /api/legal/catalog status`);
  const catData = await r1.json();
  check(catData.norms.length >= 31, `catalog tem pelo menos 31 normas (got ${catData.norms.length})`);
  // Wave 4 e 5 adicionaram mais. A onda 3 continua íntegra.
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
    'adiadc1999': 'inconstitucionalidade',
    'adpf1999':   'preceito',
    'ms2009':     'seguran\u00e7a',
    'hd1997':     'habeas',
    'ap1965':     'anula\u00e7\u00e3o',
    'bf1990':     'impenhor\u00e1vel',
    'loc1991':    'loca\u00e7\u00e3o',
    'arb1996':    'arbitragem',
    'med2015':    'media\u00e7\u00e3o',
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

  // 7. Global search (user-required aliases)
  for (const q of ['mandado de segurança', 'ação popular', 'locações', 'arbitragem', 'mediação', 'adpf', 'habeas data']) {
    const r = await fetch(`${base}/search?q=${encodeURIComponent(q)}`);
    check(r.status === 200, `global search "${q}" status`);
    if (r.status === 200) {
      const results = await r.json();
      check(results.some(x => x.normId && ['ms2009','ap1965','loc1991','arb1996','med2015','adpf1999','hd1997'].includes(x.normId)),
        `global search "${q}" finds new norms`);
    }
  }

  // 8. Download endpoint: idempotência
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

  // 9. URL inválida: catálogo rejeita
  const r9 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'invalido-xyz' }),
  });
  check(r9.status === 404 || r9.status === 400, `unknown norm id rejected (${r9.status})`);

  // 10. acp1985 ESTÁ no catálogo (com snapshot oficial da Câmara)
  const acp = catalog.norms.find(x => x.id === 'acp1985');
  check(!!acp, `acp1985 IS in catalog (não é mais BLOCKED)`);
  if (acp) {
    check(acp.aliases && acp.aliases.includes('ACP'), 'acp1985 has ACP alias');
    check(acp.aliases && acp.aliases.includes('Lei 7347'), 'acp1985 has "Lei 7347" alias');
  }

  // 11. Prova real do acp1985
  const acpArt1 = await fetch(`${base}/api/legal/norms/acp1985/units/art1`);
  check(acpArt1.status === 200, `acp1985/art1 funciona (prova real)`);
  if (acpArt1.status === 200) {
    const u = await acpArt1.json();
    check(u.kind === 'artigo', `acp1985/art1 kind is artigo`);
    check(u.text && /Regem-se pelas disposições desta Lei/.test(u.text),
      `acp1985/art1 text matches snapshot (Regem-se...)`);
  }

  // 12. Regressão: as 30 normas anteriores continuam funcionando
  const cf88art5 = await fetch(`${base}/api/legal/norms/cf88/units/art5`);
  check(cf88art5.status === 200, `CF88/art5 ainda funciona (regressão)`);
  const cpc300 = await fetch(`${base}/api/legal/norms/cpc2015/units/art300`);
  check(cpc300.status === 200, `CPC2015/art300 ainda funciona (regressão)`);
  const cc2002art1 = await fetch(`${base}/api/legal/norms/cc2002/units/art1`);
  check(cc2002art1.status === 200, `CC2002/art1 ainda funciona (regressão)`);
  const lgpdArt6 = await fetch(`${base}/api/legal/norms/lgpd2018/units/art6`);
  check(lgpdArt6.status === 200, `LGPD2018/art6 ainda funciona (regressão)`);

} finally {
  server.close();
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
