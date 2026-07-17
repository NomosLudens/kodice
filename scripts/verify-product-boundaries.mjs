#!/usr/bin/env node
/**
 * verify-product-boundaries.mjs
 *
 * Verifica que o produto Kódice não contém resíduos da integração Héstia
 * nem corpus jurídico amostral em posição produtiva.
 *
 * Caminhos inspecionados:
 *   - index.html
 *   - src/        (recursivo)
 *   - public/     (recursivo)
 *   - dist/       (recursivo, quando existir)
 *   - package.json
 *   - legal/corpus/*.json  (apenas nível raiz, não _sample/)
 *
 * Encerra com código ≠ 0 em caso de violação.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

let violations = 0;

function fail(file, rule, excerpt) {
  console.error(`BOUNDARY VIOLATION\n  arquivo : ${file}\n  regra   : ${rule}\n  trecho  : ${excerpt}\n`);
  violations++;
}

// ──────────────────────────────────────────────────────────────────────────────
// Regras textuais
// ──────────────────────────────────────────────────────────────────────────────
const TEXT_RULES = [
  { id: 'ip-127', pattern: /127\.0\.0\.1:4519/g, rule: 'Endereço 127.0.0.1:4519 é proibido' },
  { id: 'localhost-4519', pattern: /localhost:4519/g, rule: 'Endereço localhost:4519 é proibido' },
  { id: 'ip-tailscale', pattern: /100\.\d+\.\d+\.\d+/g, rule: 'Endereço Tailscale (100.x) hardcoded proibido' },
  { id: 'ts-net', pattern: /\.ts\.net/g, rule: 'Hostname .ts.net hardcoded proibido' },
  { id: 'vite-station-url', pattern: /VITE_STATION_URL/g, rule: 'VITE_STATION_URL proibido (usar configuração via UI)' },
  { id: 'include-credentials', pattern: /credentials\s*:\s*['"]include['"]/g, rule: 'credentials include proibido na integração Héstia' },
  { id: 'no-cors-mode', pattern: /mode\s*:\s*['"]no-cors['"]/g, rule: 'mode no-cors proibido na integração Héstia' },
  { id: 'import-route', pattern: /\/api\/codice\/import/g, rule: 'Rota de importação proibida na integração Héstia' },
  { id: 'service-worker-cache-station', pattern: /codice\.station\.baseUrl.*serviceWorker/g, rule: 'Service Worker caching de station proibido' },
  // PR #16 — Autenticação Station
  { id: 'station-fetch-direct-health',   pattern: /fetch\s*\(\s*[^,)]*\/api\/codice\/health/,    rule: 'Fetch direto a /api/codice/health fora de stationFetch proibido' },
  { id: 'station-fetch-direct-library',  pattern: /fetch\s*\(\s*[^,)]*\/api\/codice\/library/,   rule: 'Fetch direto a /api/codice/library fora de stationFetch proibido' },
  { id: 'station-fetch-direct-books',    pattern: /fetch\s*\(\s*[^,)]*\/api\/codice\/books/,     rule: 'Fetch direto a /api/codice/books fora de stationFetch proibido' },
  { id: 'station-token-log',             pattern: /console\.(log|warn|error|info)[^;]*access.?token/i, rule: 'Token de acesso da Station em console proibido' },
  { id: 'station-token-localstorage',    pattern: /localStorage\.[^;]*access.?token/i,           rule: 'Token de acesso da Station em localStorage proibido' },
  { id: 'station-token-sessionstorage',  pattern: /sessionStorage\.[^;]*access.?token/i,         rule: 'Token de acesso da Station em sessionStorage proibido' },
  { id: 'station-token-indexeddb',       pattern: /dbPut[^;]*access.?token/i,                    rule: 'Token de acesso da Station em IndexedDB proibido' },
  { id: 'station-book-url-fetch',        pattern: /fetch\s*\(\s*b\.url|fetch\s*\(\s*book\.url/,   rule: 'Fetch direto de book.url proibido — usar stationFetch com path construído' },
  // Integração Héstia
  { id: 'hestia-api-base',       pattern: 'HESTIA_API_BASE',         rule: 'Constante HESTIA_API_BASE da integração Héstia removida' },
  { id: 'hestia-localhost',      pattern: '127.0.0.1:4517',          rule: 'Endereço local hardcoded da API Héstia (127.0.0.1:4517)' },
  { id: 'fetch-hestia-library',  pattern: 'fetchHestiaLibrary',      rule: 'Função fetchHestiaLibrary da integração Héstia removida' },
  { id: 'download-hestia-book',  pattern: 'downloadHestiaBook',      rule: 'Função downloadHestiaBook da integração Héstia removida' },
  { id: 'import-docx-to-hestia', pattern: 'importDocxToHestia',      rule: 'Função importDocxToHestia da integração Héstia removida' },
  { id: 'hestia-books-regex',    pattern: /\bhestiaBooks\b/,         rule: 'Identificador hestiaBooks da integração Héstia removido' },
  { id: 'api-codice-import',     pattern: '/api/codice/import',      rule: 'Rota POST /api/codice/import da integração Héstia removida' },
  { id: 'hestia-server-author',  pattern: 'Héstia Server',           rule: 'Metadado inventado "Héstia Server" da integração Héstia removida' },
  // DOCX no file input
  { id: 'docx-file-input',       pattern: /accept=[^>]*\.docx/,      rule: 'Extensão .docx no accept do file input principal (suporte DOCX foi removido)' },
  { id: 'docx-mime-type',        pattern: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', rule: 'Mime type DOCX detectado no produto' },
  { id: 'docx-handlefiles',      pattern: /['"]docx['"]\s*\]\s*\.includes|\.includes\(\s*['"]docx['"]\)|\bdocx\b/, rule: 'DOCX listado como formato aceito no produto' },
  // Fallback jurídico específico cf88/cpc2015
  { id: 'legal-fallback-ids',    pattern: /id\s*===\s*['"]cf88['"]\s*\|\|\s*id\s*===\s*['"]cpc2015['"]/,
                                                                      rule: 'Fallback específico cf88/cpc2015 em openBook() — deve ser removido' },
  { id: 'fetch-legal-epub',      pattern: /fetch\s*\(\s*`\/legal\/\$\{/, rule: 'fetch de /legal/${id}.epub — fallback jurídico de rede removido' },
  // Artefatos jurídicos amostrais
  { id: 'public-cf88-epub',      pattern: 'cf88.epub',               rule: 'Referência a cf88.epub — EPUB amostral não deve existir em produto' },
  { id: 'public-cpc2015-epub',   pattern: 'cpc2015.epub',            rule: 'Referência a cpc2015.epub — EPUB amostral não deve existir em produto' },
  { id: 'public-foundation-json',pattern: 'foundation-v1.json',      rule: 'Referência a foundation-v1.json — pacote jurídico amostral não deve existir em produto' },
];

const TEXT_EXTENSIONS = new Set([
  '.html', '.js', '.mjs', '.cjs', '.ts', '.tsx',
  '.json', '.css', '.txt', '.md', '.webmanifest',
]);

function checkTextFile(filePath, rules) {
  const ext = extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return;

  // Ignore checking verify-product-boundaries.mjs itself to avoid self-violations
  if (filePath.endsWith('verify-product-boundaries.mjs')) return;

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  for (const { pattern, rule: ruleMsg } of rules) {
    if (typeof pattern === 'string') {
      const idx = content.indexOf(pattern);
      if (idx !== -1) {
        const lineStart = content.lastIndexOf('\n', idx) + 1;
        const lineEnd = content.indexOf('\n', idx);
        const excerpt = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim().slice(0, 120);
        fail(filePath, ruleMsg, excerpt);
      }
    } else {
      const globalRe = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      const match = globalRe.exec(content);
      if (match) {
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const lineEnd = content.indexOf('\n', match.index);
        const excerpt = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim().slice(0, 120);
        fail(filePath, ruleMsg, excerpt);
      }
    }
  }
}

// Diretórios ignorados no walk
const SKIP_DIRS = new Set(['.git', 'node_modules', '.agents']);

function walkDir(dir, rules) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      walkDir(full, rules);
    } else {
      checkTextFile(full, rules);
    }
  }
}

// Arquivos físicos proibidos em public/ e dist/
function checkForbiddenFiles() {
  const forbidden = [
    { path: 'public/legal/cf88.epub',         rule: 'EPUB amostral cf88.epub não deve existir em public/legal/' },
    { path: 'public/legal/cpc2015.epub',       rule: 'EPUB amostral cpc2015.epub não deve existir em public/legal/' },
    { path: 'public/legal/foundation-v1.json', rule: 'Pacote jurídico foundation-v1.json não deve existir em public/legal/' },
    { path: 'dist/legal/cf88.epub',           rule: 'EPUB amostral cf88.epub não deve existir em dist/legal/' },
    { path: 'dist/legal/cpc2015.epub',         rule: 'EPUB amostral cpc2015.epub não deve existir em dist/legal/' },
    { path: 'dist/legal/foundation-v1.json',   rule: 'Pacote jurídico foundation-v1.json não deve existir em dist/legal/' },
  ];
  for (const { path, rule } of forbidden) {
    if (existsSync(path)) fail(path, rule, '(arquivo existe no disco)');
  }
}

// Corpus jurídico produtivo: legal/corpus/*.json (raiz, não _sample/)
// Proibido apontar sourceFile para legal/sources/sample/
function checkLegalCorpusRoot() {
  const corpusDir = 'legal/corpus';
  if (!existsSync(corpusDir)) return;
  let entries;
  try { entries = readdirSync(corpusDir); } catch { return; }
  for (const entry of entries) {
    if (entry === '_sample') continue;
    if (!entry.endsWith('.json')) continue;
    const full = join(corpusDir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (!st.isFile()) continue;
    let parsed;
    try { parsed = JSON.parse(readFileSync(full, 'utf8')); } catch {
      fail(full, 'Arquivo de corpus jurídico inválido (JSON malformado)', '(parse error)');
      continue;
    }
    const sf = parsed?.sourceFile ?? parsed?.acquisition?.sourceFile ?? '';
    if (typeof sf === 'string' && sf.includes('legal/sources/sample')) {
      fail(full, 'Corpus jurídico em legal/corpus/ aponta sourceFile para legal/sources/sample/ — use corpus oficial', sf);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Execução
// ──────────────────────────────────────────────────────────────────────────────

checkTextFile('index.html', TEXT_RULES);
checkTextFile('package.json', TEXT_RULES);

walkDir('src', TEXT_RULES);
walkDir('public', TEXT_RULES);
if (existsSync('dist')) walkDir('dist', TEXT_RULES);

checkForbiddenFiles();
checkLegalCorpusRoot();

// ──────────────────────────────────────────────────────────────────────────────
// Verificações estruturais do código fonte: corpos de função
// ──────────────────────────────────────────────────────────────────────────────

/**
 * extractFunctionBody — extrator balanceado de função por nome.
 * Encontra o { do corpo após equilibrar os parênteses da assinatura.
 * Evita capturar object-destructuring nos parâmetros como corpo.
 * Reutiliza o padrão do PR #14.
 */
function extractFunctionBody(src, name) {
  const sig = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const start = src.search(sig);
  if (start === -1) return '';
  // Equilibrar parênteses da lista de parâmetros
  const parenOpen = src.indexOf('(', start);
  if (parenOpen === -1) return '';
  let parenDepth = 0, j = parenOpen;
  while (j < src.length) {
    if (src[j] === '(') parenDepth++;
    else if (src[j] === ')') { parenDepth--; if (parenDepth === 0) break; }
    j++;
  }
  // O corpo começa no { após o )
  const bodyStart = src.indexOf('{', j);
  if (bodyStart === -1) return '';
  let depth = 0, i = bodyStart;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  return src.slice(bodyStart, i + 1);
}

function assertFunctionBody(src, funcName, check, rule) {
  const body = extractFunctionBody(src, funcName);
  if (!body) { fail('index.html', `Função ${funcName} não encontrada`, rule); return; }
  if (!check(body)) fail('index.html', rule, `(no corpo de ${funcName})`);
}

let indexSrc = '';
try { indexSrc = readFileSync('index.html', 'utf8'); } catch {}

if (indexSrc) {
  // 1. Bearer obrigatório dentro de stationFetch
  assertFunctionBody(indexSrc, 'stationFetch',
    b => /Authorization/.test(b) && /Bearer/.test(b),
    'stationFetch deve conter Authorization: Bearer');

  // 2. stationFetch deve verificar trustedOrigin (via approvedOrigin || localStorage)
  assertFunctionBody(indexSrc, 'stationFetch',
    b => /trustedOrigin|approvedOrigin/.test(b),
    'stationFetch deve verificar trustedOrigin ou approvedOrigin antes de enviar token');

  // 3. stationFetch deve validar pathname (/api/codice/) e whitelist
  assertFunctionBody(indexSrc, 'stationFetch',
    b => /\/api\/codice\//.test(b) && /isHealth\s*=/.test(b) && /isLibrary\s*=/.test(b) && /isBook\s*=/.test(b),
    'stationFetch deve validar pathname e aplicar whitelist (/api/codice/health, /api/codice/library, /api/codice/books/<id>)');

  // 4. fetchStationLibrary deve chamar stationFetch, sem fetch direto nem approvedOrigin
  assertFunctionBody(indexSrc, 'fetchStationLibrary',
    b => /stationFetch\s*\(/.test(b) && !/\bfetch\s*\(/.test(b.replace(/stationFetch/g, '')) && !/approvedOrigin/.test(b),
    'fetchStationLibrary deve chamar stationFetch, não fetch diretamente, e não passar approvedOrigin');

  // 5. testStationConnection deve chamar stationFetch
  assertFunctionBody(indexSrc, 'testStationConnection',
    b => /stationFetch\s*\(/.test(b) && !/\bfetch\s*\(/.test(b.replace(/stationFetch/g, '')),
    'testStationConnection deve chamar stationFetch e não fetch diretamente');

  // 6. openStationBook deve chamar stationFetch, sem fetch direto nem approvedOrigin
  assertFunctionBody(indexSrc, 'openStationBook',
    b => /stationFetch\s*\(/.test(b) && !/\bfetch\s*\(/.test(b.replace(/stationFetch/g, '')) && !/approvedOrigin/.test(b),
    'openStationBook deve chamar stationFetch, não fetch diretamente, e não passar approvedOrigin');

  // 7. refreshSession exatamente 1 vez no arquivo inteiro
  const refreshCount = (indexSrc.match(/supabase\.auth\.refreshSession/g) || []).length;
  if (refreshCount !== 1) {
    fail('index.html', `supabase.auth.refreshSession deve ocorrer exatamente 1 vez (encontrado: ${refreshCount})`, 'stationFetch');
  }

  // 8. Nenhum fetch de book.url em nenhuma parte do arquivo
  if (/fetch\s*\(\s*(b|book)\.url/.test(indexSrc)) {
    fail('index.html', 'Fetch direto de book.url detectado no arquivo', '(global)');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Canários — comprovam que as regras acima detectam implementações mutantes
// ──────────────────────────────────────────────────────────────────────────────
function selfAssert(cond, msg) {
  if (!cond) { console.error(`CANARY FAIL: ${msg}`); process.exit(2); }
}

// Canário 1: Bearer pattern realmente detecta sua ausência
{
  const goodBody = `{ headers: { Authorization: 'Bearer ' + token } }`;
  const badBody  = `{ headers: { 'X-Token': token } }`;
  selfAssert(/Authorization/.test(goodBody) && /Bearer/.test(goodBody), 'Bearer pattern deve passar em corpo bom');
  selfAssert(!(/Authorization/.test(badBody) && /Bearer/.test(badBody)), 'Bearer pattern deve falhar em corpo mau');
}

// Canário 2: trustedOrigin pattern
{
  const goodBody = `const trusted = approvedOrigin || localStorage.getItem('codice.station.trustedOrigin');`;
  const badBody  = `// sem verificação de origin`;
  selfAssert(/trustedOrigin|approvedOrigin/.test(goodBody), 'trustedOrigin pattern deve passar em corpo bom');
  selfAssert(!/trustedOrigin|approvedOrigin/.test(badBody), 'trustedOrigin pattern deve falhar em corpo mau');
}

// Canário 3: fetch direto em fetchStationLibrary é detectado
{
  const badConsumer = `async function fetchStationLibrary() { const res = await fetch(url, {}); }`;
  const body = extractFunctionBody(badConsumer, 'fetchStationLibrary');
  const hasDirect = !/stationFetch\s*\(/.test(body);
  selfAssert(hasDirect, 'Corpo sem stationFetch deve ser detectado como violacão');
}

// Canário 4: fetch de book.url é detectado
{
  const bad = `const res = await fetch(b.url, { credentials: 'omit' });`;
  selfAssert(/fetch\s*\(\s*(b|book)\.url/.test(bad), 'fetch de b.url deve ser detectado');
  const good = `const res = await stationFetch('/api/codice/books/' + id, { baseUrl });`;
  selfAssert(!/fetch\s*\(\s*(b|book)\.url/.test(good), 'stationFetch não deve ser detectado como b.url');
}

// Canário 5: extrator balanceado funciona com funções aninhadas
{
  const src = `function outer() { function inner() { return {}; } return inner(); }`;
  const body = extractFunctionBody(src, 'outer');
  selfAssert(body.includes('inner'), 'Extrator deve capturar função aninhada');
  selfAssert(!extractFunctionBody(src, 'nonexistent'), 'Extrator deve retornar string vazia para função inexistente');
}

// Canário 6: approvedOrigin em consumidor não autorizado é detectado
{
  const badBody = `async function fetchStationLibrary() {
    const res = await stationFetch('/api/codice/library', { baseUrl, approvedOrigin: 'http://foo' });
  }`;
  const body = extractFunctionBody(badBody, 'fetchStationLibrary');
  selfAssert(/approvedOrigin/.test(body), 'approvedOrigin no fetchStationLibrary deve ser detectado');
}

// Canário 7: fetch direto misturado com stationFetch é detectado
{
  const badBody = `async function fetchStationLibrary() {
    const r1 = await stationFetch('/api/codice/library', { baseUrl });
    const r2 = await fetch('/some/other/url');
  }`;
  const body = extractFunctionBody(badBody, 'fetchStationLibrary');
  const hasFetchWithoutStationFetch = /\bfetch\s*\(/.test(body.replace(/stationFetch/g, ''));
  selfAssert(hasFetchWithoutStationFetch, 'fetch direto misturado com stationFetch deve ser detectado');
}

// Canário 8: whitelist no stationFetch é detectada
{
  const goodFetchBody = `
    const isHealth = path === '/api/codice/health';
    const isLibrary = path === '/api/codice/library';
    const isBook = path.startsWith('/api/codice/books/') && !path.slice(18).includes('/');
  `;
  const badFetchBody = `
    // sem whitelist
  `;
  const check = b => /isHealth\s*=/.test(b) && /isLibrary\s*=/.test(b) && /isBook\s*=/.test(b);
  selfAssert(check(goodFetchBody), 'Whitelist deve ser aceita');
  selfAssert(!check(badFetchBody), 'Ausência de whitelist deve falhar');
}

if (violations > 0) {
  console.error(`\nProduct boundary verification FAILED: ${violations} violation(s) found.`);
  process.exit(1);
}
console.log('Product boundary verification passed.');
