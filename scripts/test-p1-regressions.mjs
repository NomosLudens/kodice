#!/usr/bin/env node
/**
 * test-p1-regressions.mjs
 *
 * Regressões sintéticas para os P1 do fechamento Kódice:
 *  - PDF outline (consumer updateNoteKeySelectorOptions deve tolerar item sem href)
 *  - exportBackup (deve atualizar meta.lastAt/lastSig)
 *
 * Estratégia: extrai as funções reais de index.html e as executa contra um
 * DOM mínimo via jsdom-like (sem dependências: usamos linkedom interno via
 * RegExp+Array), ou simplesmente validamos os trechos esperados por inspeção.
 *
 * O harness usa apenas a extração de trechos para garantir que a regressão
 * existe no código atual e não foi revertida.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, '..', 'index.html');
const src = readFileSync(indexPath, 'utf8');

let passed = 0, failed = 0;
function check(cond, name) {
  if (cond) { console.log(`ok - ${name}`); passed++; }
  else { console.error(`not ok - ${name}`); failed++; }
}

function extractFunction(src, name) {
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
  return src.slice(bodyStart, i + 1);
}

// === PDF outline ===
// Garante que updateNoteKeySelectorOptions tolera toc de PDF (sem href).
{
  const body = extractFunction(src, 'updateNoteKeySelectorOptions');
  check(!!body, 'updateNoteKeySelectorOptions existe no index.html');
  // O consumer deve fazer a leitura de href de forma defensiva (não href.indexOf
  // sem checagem). Antes do fix: item.href.indexOf('#'). Depois: typeof === 'string'.
  check(/typeof\s+item\.href\s*===\s*['"]string['"]/.test(body) ||
        /typeof\s+item\.href\s*!==s*['"]string['"]/.test(body) ||
        /href\s*=\s*typeof\s+item\.href/.test(body),
        'updateNoteKeySelectorOptions lê item.href defensivamente (sem TypeError)');
}

// === Backup meta ===
{
  const body = extractFunction(src, 'exportBackup');
  check(!!body, 'exportBackup existe no index.html');
  check(/saveAutoBackupMeta\s*\(/.test(body),
        'exportBackup chama saveAutoBackupMeta após export manual');
  check(/computeBackupSignature\s*\(/.test(body),
        'exportBackup atualiza meta.lastSig com a assinatura atual');
}

// === pagehide nota ===
{
  const body = extractFunction(src, 'flushPendingNotesSync');
  check(!!body, 'flushPendingNotesSync existe para fechar a página sem perda');
  check(/indexedDB\.open/.test(body),
        'flushPendingNotesSync usa IndexedDB síncrono via open+put');
}

// === pointer-events (não tem typo) ===
{
  const lines = src.split('\n').filter(l => /pointer-event/i.test(l));
  const bad = lines.filter(l => /pointer-event\s*:/i.test(l));
  check(bad.length === 0,
        'Nenhuma regra CSS usa a propriedade inválida "pointer-event:" (sem s)');
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);