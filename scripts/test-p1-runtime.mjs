#!/usr/bin/env node
/**
 * test-p1-runtime.mjs
 *
 * Regressões funcionais dos P1 do fechamento Kódice. Usa jsdom para
 * instanciar o DOM real e validar as funções extraídas do bundle.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, '..', 'index.html');
const indexSrc = readFileSync(indexPath, 'utf8');

let passed = 0, failed = 0;
function check(cond, name) {
  if (cond) { console.log(`ok - ${name}`); passed++; }
  else { console.error(`not ok - ${name}`); failed++; }
}

function extractFunctionBody(src, name) {
  const sig = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const start = src.search(sig);
  if (start === -1) return null;
  const parenOpen = src.indexOf('(', start);
  let parenDepth = 0, j = parenOpen;
  while (j < src.length) {
    if (src[j] === '(') parenDepth++;
    else if (src[j] === ')') { parenDepth--; if (parenDepth === 0) break; }
    j++;
  }
  const bodyStart = src.indexOf('{', j);
  let depth = 0, i = bodyStart;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  return src.slice(bodyStart + 1, i);
}

const dom = new JSDOM('<!DOCTYPE html><html><body>' +
  '<select id="note-key-selector"><option value="global">Nota Geral</option></select>' +
  '<div id="note-selector-container" class="hidden"></div>' +
  '<textarea id="notebook"></textarea>' +
  '</body></html>', { runScripts: 'outside-only' });
const { window } = dom;
const { document } = window;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  activeBook: null,
  activeBookNotes: null,
  activeNoteKey: 'global',
};

const body = extractFunctionBody(indexSrc, 'updateNoteKeySelectorOptions');
check(!!body, 'updateNoteKeySelectorOptions extraída do index.html');

// Injeta os helpers globais via vm context
const update = new Function('state', '$', '$$', 'document', `
  with(state){ ${body} }
`);

// 1. PDF outline tolerante
state.activeBook = {
  id: 'test-pdf',
  type: 'pdf',
  title: 'Manual',
  toc: [
    { label: 'Capítulo 1', dest: 'chapter1', depth: 0 },
    { label: 'Seção 1.1', dest: 'sec1.1', depth: 1 },
  ],
};
try {
  update(state, $, $$, document);
  check(true, 'updateNoteKeySelectorOptions não lança TypeError com toc PDF sem href');
  const opts = document.querySelectorAll('#note-key-selector option');
  check(opts.length === 1 && opts[0].value === 'global',
        'Nenhuma option inválida injetada a partir de toc PDF');
} catch (e) {
  check(false, 'updateNoteKeySelectorOptions NÃO deve lançar com toc PDF: ' + e.message);
}

// 2. EPUB TOC com href deve continuar populando
state.activeBook = {
  id: 'test-epub',
  type: 'epub',
  title: 'Livro',
  toc: [
    { label: 'Cap. 1', href: 'OEBPS/ch1.xhtml#ch1', depth: 0 },
    { label: 'Cap. 1.1', href: 'OEBPS/ch1.xhtml#ch1-1', depth: 1 },
  ],
};
document.getElementById('note-key-selector').innerHTML = '<option value="global">Nota Geral</option>';
try {
  update(state, $, $$, document);
  const opts = document.querySelectorAll('#note-key-selector option');
  check(opts.length === 3, `EPUB TOC populou options (3 esperados, ${opts.length} obtidos)`);
  const values = Array.from(opts).map(o => o.value);
  check(values.includes('ch1') && values.includes('ch1-1'), 'options contém ch1 e ch1-1');
} catch (e) {
  check(false, 'updateNoteKeySelectorOptions NÃO deve lançar com toc EPUB: ' + e.message);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);