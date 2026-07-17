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
  { id: 'ip-127-porta', pattern: /127\.0\.0\.1:4519/g, rule: 'Endereço 127.0.0.1:4519 é proibido' },
  { id: 'localhost-4519', pattern: /localhost:4519/g, rule: 'Endereço localhost:4519 é proibido' },
  { id: 'ip-tailscale', pattern: /100\.\d+\.\d+\.\d+/g, rule: 'Endereço Tailscale (100.x) hardcoded proibido' },
  { id: 'ts-net', pattern: /\.ts\.net/g, rule: 'Hostname .ts.net hardcoded proibido' },
  { id: 'vite-station-url', pattern: /VITE_STATION_URL/g, rule: 'VITE_STATION_URL proibido (usar configuração via UI)' },
  { id: 'import-route', pattern: /\/api\/codice\/import/g, rule: 'Rota de importação proibida na integração Héstia' },
  { id: 'service-worker-cache-station', pattern: /codice\.station\.baseUrl.*serviceWorker/g, rule: 'Service Worker caching de station proibido' },

  // Integração Héstia
  { id: 'hestia-api-base',       pattern: 'HESTIA_API_BASE',         rule: 'Constante HESTIA_API_BASE da integração Héstia removida' },
  { id: 'hestia-localhost',      pattern: '127.0.0.1:4517',          rule: 'Endereço local hardcoded da API Héstia (127.0.0.1:4517)' },
  { id: 'fetch-hestia-library',  pattern: 'fetchHestiaLibrary',      rule: 'Função fetchHestiaLibrary da integração Héstia removida' },
  { id: 'download-hestia-book',  pattern: 'downloadHestiaBook',      rule: 'Função downloadHestiaBook da integração Héstia removida' },
  { id: 'import-docx-to-hestia', pattern: 'importDocxToHestia',      rule: 'Função importDocxToHestia da integração Héstia removida' },
  { id: 'hestia-books-regex',    pattern: /\bhestiaBooks\b/,         rule: 'Identificador hestiaBooks da integração Héstia removido' },
  { id: 'hestia-server-author',  pattern: 'Héstia Server',           rule: 'Metadado inventado "Héstia Server" da integração Héstia removida' },

  // Fallback jurídico específico cf88/cpc2015
  { id: 'legal-fallback-ids',    pattern: /id\s*===\s*['"]cf88['"]\s*\|\|\s*id\s*===\s*['"]cpc2015['"]/, rule: 'Fallback específico cf88/cpc2015 em openBook() — deve ser removido' },
  { id: 'fetch-legal-epub',      pattern: /fetch\s*\(\s*`\/legal\/\$\{/, rule: 'fetch de /legal/${id}.epub — fallback jurídico de rede removido' },

  // Artefatos jurídicos amostrais textuais
  { id: 'public-cf88-epub',      pattern: 'cf88.epub',               rule: 'Referência a cf88.epub — EPUB amostral não deve existir em produto' },
  { id: 'public-cpc2015-epub',   pattern: 'cpc2015.epub',            rule: 'Referência a cpc2015.epub — EPUB amostral não deve existir em produto' },
  { id: 'public-foundation-json',pattern: 'foundation-v1.json',      rule: 'Referência a foundation-v1.json — pacote jurídico amostral não deve existir em produto' },
];

const TEXT_EXTENSIONS = new Set([
  '.html', '.js', '.mjs', '.cjs', '.ts', '.tsx',
  '.json', '.css', '.txt', '.md', '.webmanifest',
]);

function extractFunctionBody(content, fnName) {
  const regex = new RegExp(`(?:async\\s+)?function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const match = regex.exec(content);
  if (!match) return null;
  let start = match.index + match[0].length;
  let braces = 1;
  let end = start;
  while (end < content.length && braces > 0) {
    if (content[end] === '{') braces++;
    if (content[end] === '}') braces--;
    end++;
  }
  return content.slice(start, end - 1);
}

function checkJsRegressions(filePath, content) {
  if (!filePath.endsWith('index.html')) return;
  // Checks
  if (content.includes('\x24\x24a(')) fail(filePath, 'Regressão JS global', 'Uso de $'+'$a(');
  if (content.includes('\x24(\x24(')) fail(filePath, 'Regressão JS global', 'Uso de $'+'($'+'(');
  if (/querySelector\([^)]+\)\.forEach/.test(content)) fail(filePath, 'Regressão JS global', 'querySelector().forEach');

  // Definitions
  const defRenderBookBuffer = content.match(/function\s+renderBookBuffer\b|const\s+renderBookBuffer\s*=|let\s+renderBookBuffer\s*=/g);
  if (!defRenderBookBuffer && content.includes('renderBookBuffer')) fail(filePath, 'Regressão JS', 'renderBookBuffer chamada sem definição');
  if (defRenderBookBuffer && defRenderBookBuffer.length > 1) fail(filePath, 'Regressão JS', 'renderBookBuffer definida mais de uma vez');

  const defShowBookOpenError = content.match(/function\s+showBookOpenError\b|const\s+showBookOpenError\s*=|let\s+showBookOpenError\s*=/g);
  if (!defShowBookOpenError && content.includes('showBookOpenError')) fail(filePath, 'Regressão JS', 'showBookOpenError chamada sem definição');

  ['renderEpub', 'renderPdf', 'renderTxt'].forEach(fn => {
    const def = content.match(new RegExp(`function\\s+${fn}\\b|const\\s+${fn}\\s*=|let\\s+${fn}\\s*=`, 'g'));
    if (def && def.length > 1) fail(filePath, 'Regressão JS', `${fn} definida mais de uma vez`);
  });
}

function checkStationBoundary(filePath, content) {
  if (!filePath.endsWith('index.html')) return;
  const fns = ['fetchStationLibrary', 'testStationConnection', 'openStationBook'];
  fns.forEach(fn => {
    const body = extractFunctionBody(content, fn);
    if (!body) return;

    const rules = [
      { p: /\b(POST|PUT|PATCH|DELETE)\b/i, msg: 'Method HTTP proibido' },
      { p: /credentials\s*:\s*['"]include['"]/i, msg: 'credentials include' },
      { p: /mode\s*:\s*['"]no-cors['"]/i, msg: 'mode no-cors' },
      { p: /Authorization/i, msg: 'Authorization header' },
      { p: /cookie/i, msg: 'cookies' },
      { p: /\bputBook\b/, msg: 'putBook' },
      { p: /\bdbPut\b/, msg: 'dbPut' },
      { p: /\bcaches\.open\b/, msg: 'caches.open' },
      { p: /\bcache\.put\b/, msg: 'cache.put' },
      { p: /\bCacheStorage\b/, msg: 'CacheStorage' },
      { p: /\bshowSaveFilePicker\b/, msg: 'showSaveFilePicker' },
      { p: /\bserviceWorker\.postMessage\b/, msg: 'serviceWorker.postMessage' },
      { p: /['"]book_files['"]/, msg: 'persistência em book_files' },
      { p: /['"]books['"]/, msg: 'persistência no catálogo books' }
    ];

    rules.forEach(r => {
      if (r.p.test(body)) {
        fail(filePath, `Fronteira Station violada em ${fn}: ${r.msg}`, r.p.source);
      }
    });
  });
}

function checkLegalAndFormats(filePath, content) {
  if (filePath.endsWith('.md')) return; // ignore docs

  const uiRules = [
    { p: /Vade Mecum disponível/i, msg: 'Vade Mecum disponível' },
    { p: /Constituição completa/i, msg: 'Constituição completa' },
    { p: /CPC completo/i, msg: 'CPC completo' },
    { p: /corpus oficial/i, msg: 'corpus oficial' },
    { p: /corpus completo/i, msg: 'corpus completo' },
  ];
  uiRules.forEach(r => {
    if (r.p.test(content)) fail(filePath, `Texto jurídico proibido na UI: ${r.msg}`, r.p.source);
  });

  const formatRules = [
    { p: /['"]\.?docx?['"]/i, msg: 'Suporte a DOCX proibido' },
    { p: /['"]\.?doc['"]/i, msg: 'Suporte a DOC proibido' },
    { p: /['"]\.?odt['"]/i, msg: 'Suporte a ODT proibido' },
    { p: /['"]\.?rtf['"]/i, msg: 'Suporte a RTF proibido' },
    { p: /application\/vnd\.openxmlformats-officedocument/i, msg: 'MIME de OpenXML proibido' },
  ];
  formatRules.forEach(r => {
    if (r.p.test(content)) fail(filePath, `Formato proibido: ${r.msg}`, r.p.source);
  });
}

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

  checkJsRegressions(filePath, content);
  checkStationBoundary(filePath, content);
  checkLegalAndFormats(filePath, content);
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

if (violations > 0) {
  console.error(`\nProduct boundary verification FAILED: ${violations} violation(s) found.`);
  process.exit(1);
}
console.log('Product boundary verification passed.');
