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

if (violations > 0) {
  console.error(`\nProduct boundary verification FAILED: ${violations} violation(s) found.`);
  process.exit(1);
}
console.log('Product boundary verification passed.');
