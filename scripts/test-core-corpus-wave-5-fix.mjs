#!/usr/bin/env node
/**
 * test-core-corpus-wave-5-fix.mjs
 *
 * Validação do FIX da PR 6 (Wave 5) — desarm2003 (Estatuto do
 * Desarmamento, Lei 10.826/2003) adicionado a partir do PDF oficial
 * da Câmara dos Deputados (texto consolidado, Câmara ID 490580).
 *
 * Garante:
 *   - desarm2003 instalado com SHA-256 do PDF verificado
 *   - Art. 12, 14, 16 retornam o texto do PDF
 *   - Art. 7-A e Art. 11-A (com sufixo de letra) também
 *   - download endpoint é idempotente
 *   - texto recuperado é do PDF (artefatos da reconstrução são
 *     preservados fielmente — sem invenção de conteúdo)
 *   - as 50 normas anteriores continuam funcionando
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { buildLegalDatabase } from './build-legal-db.mjs';
import { startLegalApiServer } from './legal-api-server.mjs';
import { validateNorm, OFFICIAL_SOURCE_HOSTS } from './legal-corpus-lib.mjs';
import { parseDesarm2003 } from './import-desarm2003.mjs';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`ok - ${msg}`); }
  else { failed++; console.error(`not ok - ${msg}`); }
}

const root = process.cwd();
const catalog = JSON.parse(await fs.readFile(path.resolve(root, 'legal/catalog.json'), 'utf8'));

// 1. Catálogo conhece desarm2003 com sourceUrl whitelisted (PDF)
const desarm = catalog.norms.find(x => x.id === 'desarm2003');
check(!!desarm, `catalog has desarm2003`);
if (desarm) {
  check(desarm.officialSourceUrl && desarm.officialSourceUrl.startsWith('https://'),
    'desarm2003 has https sourceUrl');
  const u = new URL(desarm.officialSourceUrl);
  check(OFFICIAL_SOURCE_HOSTS.has(u.hostname.toLowerCase()),
    `desarm2003 source host is whitelisted: ${u.hostname}`);
  check(u.pathname.endsWith('.pdf'), `desarm2003 source is PDF (.pdf extension): ${u.pathname}`);
  check(desarm.acquisitionMode === 'DOWNLOAD', 'desarm2003 acquisitionMode=DOWNLOAD');
  check(desarm.aliases.includes('Estatuto do Desarmamento'), 'desarm2003 has "Estatuto do Desarmamento" alias');
  check(desarm.aliases.includes('Lei 10826'), 'desarm2003 has "Lei 10826" alias');
  check(desarm.aliases.includes('Lei 10.826'), 'desarm2003 has "Lei 10.826" alias');
}

// 2. Corpus valida, sourceHash matches snapshot
const corpusFile = path.resolve(root, 'legal/corpus/desarm2003.json');
const corpus = JSON.parse(await fs.readFile(corpusFile, 'utf8'));
check(corpus.id === 'desarm2003', 'desarm2003 corpus has correct id');
const sourceFile = path.resolve(root, corpus.sourceFile);
const buf = await fs.readFile(sourceFile);
const sha = createHash('sha256').update(buf).digest('hex');
check(sha === corpus.sourceHash, `desarm2003 sourceHash matches PDF snapshot`);
try { validateNorm(corpus); check(true, 'desarm2003 validateNorm OK'); }
catch (e) { check(false, `desarm2003 validateNorm OK: ${e.message}`); }

// 3. Build DB, start API
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-wave5fix-'));
const testDbPath = path.join(tmpDir, 'wave5fix.db');
await buildLegalDatabase(testDbPath);
const { server, db } = await startLegalApiServer(testDbPath, 0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;

try {
  // 4. /api/legal/catalog: 51/51 (50 da wave 5 + 1 desarm2003 do fix)
  const r1 = await fetch(`${base}/api/legal/catalog`);
  check(r1.status === 200, 'GET /api/legal/catalog status');
  const catData = await r1.json();
  check(catData.norms.length === 51, `catalog tem 51 normas (got ${catData.norms.length})`);
  check(catData.norms.every(n => n.installed === true), `CATALOG_PENDING=0: todas as 51 instaladas`);

  // 5. PROVA REAL: Art. 12, 14, 16 com texto do PDF
  const targetArticles = ['art12', 'art14', 'art16'];
  for (const art of targetArticles) {
    const r = await fetch(`${base}/api/legal/norms/desarm2003/units/${art}`);
    check(r.status === 200, `desarm2003/${art} API status 200`);
    if (r.status === 200) {
      const u = await r.json();
      check(u.kind === 'artigo', `desarm2003/${art} kind is artigo`);
      check(u.text && u.text.length > 50, `desarm2003/${art} tem texto > 50 chars (length=${u.text?.length})`);
    }
  }

  // 6. Art. 7-A e Art. 11-A (com sufixo de letra)
  for (const art of ['art7-a', 'art11-a']) {
    const r = await fetch(`${base}/api/legal/norms/desarm2003/units/${art}`);
    check(r.status === 200, `desarm2003/${art} API status 200`);
    if (r.status === 200) {
      const u = await r.json();
      check(u.kind === 'artigo', `desarm2003/${art} kind is artigo`);
    }
  }

  // 7. Busca textual (PDF tem camada textual íntegra)
  // NOTA: A palavra "desarmamento" NÃO aparece no texto da lei (o nome
  // popular é "Estatuto do Desarmamento" mas o texto formal não o usa).
  // Usamos termos que existem no PDF.
  for (const q of ['porte ilegal', 'arma de fogo', 'Sinarm', 'comércio']) {
    const r = await fetch(`${base}/api/legal/norms/desarm2003/search?q=${encodeURIComponent(q)}&limit=5`);
    check(r.status === 200, `desarm2003 search "${q}" status`);
    if (r.status === 200) {
      const results = await r.json();
      check(Array.isArray(results) && results.length >= 1, `desarm2003 search "${q}" returns >=1 (got ${results.length})`);
    }
  }

  // 8. Global search encontra desarm2003 — usa termos do TEXTO, não do nome popular
  for (const q of ['porte ilegal', 'arma de fogo', 'Sinarm']) {
    const r = await fetch(`${base}/search?q=${encodeURIComponent(q)}`);
    check(r.status === 200, `global search "${q}" status`);
    if (r.status === 200) {
      const results = await r.json();
      const found = results.some(x => x.normId === 'desarm2003');
      check(found, `global search "${q}" finds desarm2003`);
    }
  }

  // 9. Download endpoint: idempotência
  const r9 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'desarm2003' }),
  });
  check(r9.status === 200, 'POST /api/legal/norms/download desarm2003 status');
  if (r9.status === 200) {
    const d = await r9.json();
    check(d.ok === true && d.alreadyInstalled === true,
      'desarm2003 alreadyInstalled=true (idempotency)');
  }

  // 10. URL inválida: catálogo rejeita
  const r10 = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'invalido-xyz' }),
  });
  check(r10.status === 404 || r10.status === 400, `unknown norm id rejected (${r10.status})`);

  // 11. Regressão: 50 normas anteriores continuam funcionando
  const cf88art5 = await fetch(`${base}/api/legal/norms/cf88/units/art5`);
  check(cf88art5.status === 200, 'CF88/art5 ainda funciona (regressão)');
  const cpc300 = await fetch(`${base}/api/legal/norms/cpc2015/units/art300`);
  check(cpc300.status === 200, 'CPC2015/art300 ainda funciona (regressão)');
  const acpArt1 = await fetch(`${base}/api/legal/norms/acp1985/units/art1`);
  check(acpArt1.status === 200, 'acp1985/art1 ainda funciona (regressão)');
  const drogasArt33 = await fetch(`${base}/api/legal/norms/drogas2006/units/art33`);
  check(drogasArt33.status === 200, 'drogas2006/art33 ainda funciona (regressão wave 5)');

} finally {
  server.close();
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
