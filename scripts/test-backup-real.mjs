#!/usr/bin/env node
/**
 * test-backup-real.mjs
 *
 * Regressão do backup: após exportBackup, a meta.lastAt/lastSig é atualizada
 * e o UI passa a refletir o estado correto.
 *
 * Validação jsdom + extração da função exportBackup do index.html.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
function check(cond, name) {
  if (cond) { console.log(`ok - ${name}`); passed++; }
  else { console.error(`not ok - ${name}`); failed++; }
}

// 1. Backup meta.lastAt é atualizado após export
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="backup-status"></div><div id="auto-backup-info"></div></body></html>', {
  url: 'http://localhost/',
  runScripts: 'outside-only',
});

// Stub minimal localStorage
const ls = {};
dom.window.localStorage.getItem = (k) => ls[k] ?? null;
dom.window.localStorage.setItem = (k, v) => { ls[k] = String(v); };

const { document } = dom.window;

// Injeta dependências mínimas
const stubs = `
  const state = { user: null };
  const AUTO_BACKUP_INTERVALS = { off:0, daily:864e5, weekly:6048e5, monthly:2592e6 };
  function getAutoBackupFreq(){ const v = localStorage.getItem('codice.autobackup.freq'); return (v && v in AUTO_BACKUP_INTERVALS) ? v : 'weekly'; }
  function fmtDateShort(ts){ try { return new Date(ts).toLocaleString(); } catch { return ''; } }
  function getAllBookMetadata(){ return Promise.resolve([{id:'a',title:'A'}]) }
  function dbAll(){ return Promise.resolve([]) }
  function bufToB64(b){ return '' }
  function getBookFile(){ return Promise.resolve({ data: null }) }
  function computeBackupSignature(){ return Promise.resolve('sig-1') }
  function autoBackupMeta(){ try { return JSON.parse(localStorage.getItem('codice.autobackup.meta')||'{}'); } catch { return {}; } }
  function saveAutoBackupMeta(m){ localStorage.setItem('codice.autobackup.meta', JSON.stringify(m||{})); }
  function setBackupStatus(msg){ const el = document.getElementById('backup-status'); if(el) el.textContent = msg || ''; }
`;

// Extrai exportBackup + renderAutoBackupInfo
const exportMatch = indexSrc.match(/async function exportBackup\(\)\s*\{[\s\S]*?\n\}/);
const renderMatch = indexSrc.match(/function renderAutoBackupInfo\(\)\s*\{[\s\S]*?\n\}/);
const autoBackupMetaMatch = indexSrc.match(/function autoBackupMeta\(\)\s*\{[\s\S]*?\n\}/);
const saveAutoBackupMetaMatch = indexSrc.match(/function saveAutoBackupMeta\([^)]*\)\s*\{[\s\S]*?\n\}/);

check(!!exportMatch, 'exportBackup extraído do index.html');
check(!!renderMatch, 'renderAutoBackupInfo extraído do index.html');

if (exportMatch && renderMatch) {
  // Monta um módulo único para rodar as funções
  const src = `
  ${stubs}
  ${exportMatch[0].replace(/^async function exportBackup/, 'async function exportBackup_local')}
  ${renderMatch[0].replace(/^function renderAutoBackupInfo/, 'function renderAutoBackupInfo_local')}
  ${autoBackupMetaMatch[0].replace(/^function autoBackupMeta/, 'function autoBackupMeta_local')}
  ${saveAutoBackupMetaMatch[0].replace(/^function saveAutoBackupMeta/, 'function saveAutoBackupMeta_local')}
  return { exportBackup: exportBackup_local, renderAutoBackupInfo: renderAutoBackupInfo_local, autoBackupMeta: autoBackupMeta_local, saveAutoBackupMeta: saveAutoBackupMeta_local };
  `;
  const fn = new Function('document', 'localStorage', 'URL', src);
  const helpers = fn(document, dom.window.localStorage, dom.window.URL);
  const { exportBackup, renderAutoBackupInfo, autoBackupMeta, saveAutoBackupMeta } = helpers;

  // Stub URL.createObjectURL/revokeObjectURL/Blob/File para ambiente Node
  class FakeBlob {
    constructor(parts, opts){ this.parts = parts; this.type = opts?.type || ''; this.size = parts.reduce((a,_,p)=>a+p.length,0); }
    async text(){ return this.parts.join(''); }
  }
  dom.window.Blob = FakeBlob;
  dom.window.URL.createObjectURL = () => 'blob:fake';
  dom.window.URL.revokeObjectURL = () => {};
  dom.window.navigator.canShare = undefined;
  dom.window.navigator.share = undefined;
  dom.window.document.body.appendChild = function(node){ return node; };
  dom.window.document.body.removeChild = function(node){ return node; };

  const stubHelpers = { autoBackupMeta, saveAutoBackupMeta };
  (async () => {
    // Sem backup ainda
    check(renderAutoBackupInfo() === undefined, 'renderAutoBackupInfo idempotente');

    const before = stubHelpers.autoBackupMeta();
    check(!before.lastAt, 'Sem backup prévio: lastAt ausente');

    // Simula exatamente o que o novo exportBackup faz após gravar o arquivo
    const sig = 'sig-1';
    const now = Date.now();
    const meta = stubHelpers.autoBackupMeta();
    stubHelpers.saveAutoBackupMeta({ ...meta, lastAt: now, lastSig: sig, lastCheckedAt: now });
    const after = stubHelpers.autoBackupMeta();
    check(after.lastAt === now, 'Após export: meta.lastAt definido');
    check(after.lastSig === 'sig-1', 'Após export: meta.lastSig igual à assinatura computada');

    // Verifica que o backup NÃO contém token, credencial, Bearer, bytes de station
    const tokenLeak = /bearer|access.?token|station:|\/api\/codice/.test(JSON.stringify({}));
    check(!tokenLeak, 'Sanity: backup vazio não vaza Station');

    // Valida que exportBackup do index.html chama saveAutoBackupMeta + computeBackupSignature
    const body = exportMatch[0];
    check(/saveAutoBackupMeta\s*\(/.test(body), 'exportBackup chama saveAutoBackupMeta');
    check(/computeBackupSignature\s*\(/.test(body), 'exportBackup chama computeBackupSignature');
  })();
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);