#!/usr/bin/env node
/**
 * test-legal-catalog.mjs
 *
 * Testes determinísticos do catálogo jurídico:
 *   - alias exato resolve para a norma correta
 *   - padrão "art N <norma>" resolve com número
 *   - colisões (CC != CPC, CP != CPP, CTN != CTB) não confundem
 *   - SEM LLM, sem fuzzy matching, sem embeddings
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolveCatalog, normalizeQuery, loadCatalog } from './legal-catalog-lib.mjs';

let passed = 0, failed = 0;
function check(cond, name) {
  if (cond) { console.log(`ok - ${name}`); passed++; }
  else { console.error(`not ok - ${name}`); failed++; }
}

const catalog = await loadCatalog();

const cases = [
  // CF
  ['CF', 'cf88'],
  ['cf88', 'cf88'],
  ['CRFB', 'cf88'],
  ['CRFB88', 'cf88'],
  ['CF88', 'cf88'],
  ['Constituição', 'cf88'],
  ['constituicao federal', 'cf88'],
  // CF + artigo
  ['art 5 cf', 'cf88', '5'],
  ['art. 5 cf', 'cf88', '5'],
  ['artigo 5 cf', 'cf88', '5'],
  ['art 5 constituicao', 'cf88', '5'],
  ['cf art 5', 'cf88', '5'],
  ['5 cf', 'cf88', '5'],
  ['CF art. 5', 'cf88', '5'],

  // CPC
  ['CPC', 'cpc2015'],
  ['cpc2015', 'cpc2015'],
  ['13105', 'cpc2015'],
  ['Lei 13105', 'cpc2015'],
  ['Lei 13.105', 'cpc2015'],
  ['lei-13105', 'cpc2015'],
  ['lei-13-105', 'cpc2015'],
  ['300 cpc', 'cpc2015', '300'],
  ['cpc 300', 'cpc2015', '300'],
  ['art 300 cpc', 'cpc2015', '300'],
  ['art. 300 CPC', 'cpc2015', '300'],
  ['art 300 CPC/2015', 'cpc2015', '300'],

  // CPP
  ['CPP', 'cpp1941'],
  ['3689', 'cpp1941'],
  ['lei 3689', 'cpp1941'],

  // CDC
  ['CDC', 'cdc1990'],
  ['8078', 'cdc1990'],
  ['lei 8.078', 'cdc1990'],

  // CC
  ['CC', 'cc2002'],
  ['CC2002', 'cc2002'],
  ['Lei 10406', 'cc2002'],
  ['Lei 10.406', 'cc2002'],

  // CP (collision with CPP)
  ['CP', 'cp1940'],

  // CLT
  ['CLT', 'clt1943'],
  ['5452', 'clt1943'],

  // CTN (collision with CTB)
  ['CTN', 'ctn1966'],
  ['CTB', 'ctb1997'],

  // ECA
  ['ECA', 'eca1990'],

  // LGPD
  ['LGPD', 'lgpd2018'],

  // LAI
  ['LAI', 'lai2011'],

  // LMP / Maria da Penha
  ['LMP', 'lmp2006'],
  ['Maria da Penha', 'lmp2006'],

  // ADCT
  ['ADCT', 'cf88-adct']
];

for (const [query, expectedId, expectedArticle] of cases) {
  const r = resolveCatalog(query, catalog);
  const okId = r.match?.id === expectedId;
  const okArt = expectedArticle == null ? r.article == null : r.article === expectedArticle;
  check(okId && okArt, `${query} -> ${expectedId}${expectedArticle ? '#' + expectedArticle : ''}`);
}

// Colisões explícitas
const collisions = [
  ['CP', 'cpp1941'], // NÃO deve resolver para CPP
  ['CPP', 'cp1940'], // NÃO deve resolver para CP
  ['CC', 'cpc2015'], // NÃO deve resolver para CPC
  ['CPC', 'cc2002'], // NÃO deve resolver para CC
  ['CTN', 'ctb1997'], // NÃO deve resolver para CTB
  ['CTB', 'ctn1966'], // NÃO deve resolver para CTN
];
let collisionCount = 0;
for (const [query, wrongId] of collisions) {
  const r = resolveCatalog(query, catalog);
  if (r.match?.id === wrongId) {
    check(false, `COLLISION: ${query} -> ${wrongId} (deveria ser outro)`);
    collisionCount++;
  } else {
    check(true, `NO_COLLISION: ${query} -> ${r.match?.id || 'null'} (≠ ${wrongId})`);
  }
}

// Normalização
check(normalizeQuery('CF') === 'cf', 'normalize CF -> cf');
check(normalizeQuery('CF/88') === 'cf/88', 'normalize CF/88 -> cf/88');
check(normalizeQuery('  cf  88 ') === 'cf 88', 'normalize whitespace');
check(normalizeQuery('Constituição') === 'constituicao', 'normalize acentos');
check(normalizeQuery('Art. 5º CF') === 'art 5 cf', 'normalize Art. 5º CF');

// Consultas sem referência reconhecida devem retornar null
const textQueries = ['pleitear', 'tutela de urgencia', 'ordem cronologica', ''];
for (const q of textQueries) {
  const r = resolveCatalog(q, catalog);
  check(r.match == null, `NO_MATCH: "${q}" não é referência reconhecida`);
}

// Garantir que aliases com pontos sejam normalizados
check(normalizeQuery('Lei 10.406') === 'lei 10.406', 'normalize Lei 10.406');

// Verifica que o catálogo não usa LLM/embeddings (smoke test: arquivo é JSON puro sem campos proibidos)
const raw = await fs.readFile(path.resolve('legal/catalog.json'), 'utf8');
const forbidden = ['embedding', 'openai', 'openrouter', 'ollama', 'fuzzy', 'llm', 'vector', 'gpt-'];
let hasForbidden = false;
for (const term of forbidden) {
  if (raw.toLowerCase().includes(term)) { hasForbidden = true; console.error(`Termo proibido encontrado no catálogo: ${term}`); }
}
check(!hasForbidden, 'LLM_USED_FOR_CATALOG=0 (sem embeddings/LLM no catalog.json)');

console.log(`\n${passed + failed} checks: ${passed} pass, ${failed} fail`);
console.log(`CATALOG_RESOLUTION=${failed === 0 ? 'PASS' : 'FAIL'}`);
console.log(`CATALOG_ALIAS_COLLISIONS=${collisionCount}`);
console.log(`LLM_USED_FOR_CATALOG=${hasForbidden ? '1' : '0'}`);
process.exit(failed > 0 ? 1 : 0);
