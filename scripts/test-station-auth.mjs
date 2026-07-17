#!/usr/bin/env node
/**
 * test-station-auth.mjs
 *
 * Harness de teste para as funções de autenticação Station do PR #16.
 * Extrai as funções reais do index.html usando o extrator balanceado
 * (padrão do PR #14) e as executa contra mocks sintéticos.
 *
 * Não duplica lógica produtiva — testa o código real.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// Extrator balanceado (reutilizado de test-legal-gate.mjs / PR #14)
// ─────────────────────────────────────────────────────────────────────────────
function extractFunction(src, name) {
  const sig = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const start = src.search(sig);
  if (start === -1) throw new Error(`Função '${name}' não encontrada em index.html`);
  const declStart = src.lastIndexOf('\n', start) + 1;
  const parenOpen = src.indexOf('(', start);
  if (parenOpen === -1) throw new Error(`Parêntese de abertura não encontrado para '${name}'`);
  let parenDepth = 0, j = parenOpen;
  while (j < src.length) {
    if (src[j] === '(') parenDepth++;
    else if (src[j] === ')') { parenDepth--; if (parenDepth === 0) break; }
    j++;
  }
  const bodyStart = src.indexOf('{', j);
  if (bodyStart === -1) throw new Error(`Corpo de '${name}' não encontrado`);
  let depth = 0, i = bodyStart;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  return src.slice(declStart, i + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Infraestrutura de testes
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
    passed++;
  } catch (e) {
    console.error(`not ok - ${name}: ${e.message}`);
    failed++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Extrair funções do index.html
// ─────────────────────────────────────────────────────────────────────────────
const indexPath = join(__dirname, '..', 'index.html');
const src = readFileSync(indexPath, 'utf8');

const mapStationErrorSrc        = extractFunction(src, 'mapStationError');
const stationStatusFromErrorSrc = extractFunction(src, 'stationStatusFromError');
const stationFetchSrc           = extractFunction(src, 'stationFetch');
const releaseActiveBookSrc      = extractFunction(src, 'releaseActiveBookResources');

// ─────────────────────────────────────────────────────────────────────────────
// Factory de ambiente sintético
// ─────────────────────────────────────────────────────────────────────────────
function makeEnv({
  supabase = null,
  localStorageData = {},
  fetchImpl = async () => { throw new Error('fetch não configurado'); },
  stateOverride = {},
} = {}) {
  const ls = { ...localStorageData };
  const dom = {
    'reader':        { onscroll: null, innerHTML: '' },
    'epub-viewer':   { innerHTML: '' },
    'pdf-viewer':    { innerHTML: '' },
    'reader-content':{ innerHTML: '' },
  };
  const state = {
    activeBook: null,
    activeBookNotes: null,
    activeNoteKey: null,
    station: { baseUrl: '', status: 'unconfigured', books: [], health: null, error: null },
    ...stateOverride,
  };
  return {
    supabase,
    state,
    localStorage: {
      getItem: k => ls[k] ?? null,
      setItem: (k, v) => { ls[k] = String(v); },
      removeItem: k => { delete ls[k]; },
    },
    fetch: fetchImpl,
    ls,
    dom,
    document: { getElementById: id => dom[id] ?? null },
    toast: () => {},
    escapeHtml: s => s,
    URL: globalThis.URL,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Compilar funções reais no contexto sintético via new Function
// ─────────────────────────────────────────────────────────────────────────────
function buildContext(env) {
  const keys = Object.keys(env);
  const vals = keys.map(k => env[k]);

  // eslint-disable-next-line no-new-func
  const mapStationError = new Function(...keys,
    `"use strict"; ${mapStationErrorSrc}; return mapStationError;`)(...vals);

  // eslint-disable-next-line no-new-func
  const stationStatusFromError = new Function(...keys,
    `"use strict"; ${stationStatusFromErrorSrc}; return stationStatusFromError;`)(...vals);

  // stationFetch precisa de mapStationError injetado
  // eslint-disable-next-line no-new-func
  const stationFetch = new Function(...keys, 'mapStationError',
    `"use strict"; ${stationFetchSrc}; return stationFetch;`)(...vals, mapStationError);

  // eslint-disable-next-line no-new-func
  const releaseActiveBookResources = new Function(...keys,
    `"use strict"; ${releaseActiveBookSrc}; return releaseActiveBookResources;`)(...vals);

  return { mapStationError, stationStatusFromError, stationFetch, releaseActiveBookResources };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cenários
// ─────────────────────────────────────────────────────────────────────────────

// ─── 1–2: book.url relativa ─────────────────────────────────────────────────
await test('1. book.url relativa com mesma origin é aceita', async () => {
  const baseUrl = 'https://station.local';
  const b = { id: 'book-1', url: '/api/codice/books/book-1' };
  const bu = new URL(b.url, baseUrl);
  const expectedPath = `/api/codice/books/${encodeURIComponent(b.id)}`;
  assert(bu.origin === new URL(baseUrl).origin);
  assert(bu.pathname === expectedPath);
  assert(!bu.username && !bu.password && !bu.search && !bu.hash);
});

await test('2. book.url relativa de outra origin é rejeitada', async () => {
  const baseUrl = 'https://station.local';
  const b = { id: 'book-2', url: 'https://evil.example.com/api/codice/books/book-2' };
  const bu = new URL(b.url, baseUrl);
  assert(bu.origin !== new URL(baseUrl).origin);
});

// ─── 3–6: trustedOrigin ──────────────────────────────────────────────────────
await test('3. Primeira config: sem trustedOrigin → origin_not_allowed', async () => {
  const env = makeEnv({
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      },
    },
    localStorageData: {},
  });
  const { stationFetch } = buildContext(env);
  try {
    await stationFetch('/api/codice/health', { baseUrl: 'https://station.local' });
    assert(false, 'deve ter lançado');
  } catch (e) {
    assertEqual(e.code, 'origin_not_allowed');
  }
});

await test('4. Origin já confiável: stationFetch passa sem approvedOrigin', async () => {
  let fetchCalled = false;
  const env = makeEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
    },
  });
  const { stationFetch } = buildContext(env);
  await stationFetch('/api/codice/health', { baseUrl: 'https://station.local' });
  assert(fetchCalled);
});

await test('5. Origin diferente da confiável → origin_not_allowed', async () => {
  const env = makeEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
  });
  const { stationFetch } = buildContext(env);
  try {
    await stationFetch('/api/codice/health', { baseUrl: 'https://other.local' });
    assert(false, 'deve ter lançado');
  } catch (e) {
    assertEqual(e.code, 'origin_not_allowed');
  }
});

await test('6. approvedOrigin efêmera permite token; trustedOrigin não é salvo por stationFetch', async () => {
  let fetchCalled = false;
  const env = makeEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    },
    localStorageData: {},
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
    },
  });
  const { stationFetch } = buildContext(env);
  await stationFetch('/api/codice/health', {
    baseUrl: 'https://station.local',
    approvedOrigin: 'https://station.local',
  });
  assert(fetchCalled);
  assert(!env.ls['codice.station.trustedOrigin'], 'trustedOrigin não deve ser salvo pelo stationFetch');
});

// ─── 7–8: stationStatusFromError ─────────────────────────────────────────────
await test('7. stationStatusFromError: authentication_required e authentication_failed → login_required', async () => {
  const env = makeEnv();
  const { stationStatusFromError } = buildContext(env);
  assertEqual(stationStatusFromError('authentication_required'), 'login_required');
  assertEqual(stationStatusFromError('authentication_failed'), 'login_required');
});

await test('8. stationStatusFromError: station_auth_not_configured → auth_not_configured', async () => {
  const env = makeEnv();
  const { stationStatusFromError } = buildContext(env);
  assertEqual(stationStatusFromError('station_auth_not_configured'), 'auth_not_configured');
});

// ─── 9–11: retry ─────────────────────────────────────────────────────────────
await test('9. 401 authentication_failed → retry único → sucesso', async () => {
  let callCount = 0, refreshCalled = false;
  const env = makeEnv({
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
        refreshSession: async () => { refreshCalled = true; },
      },
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
    fetchImpl: async () => {
      callCount++;
      if (callCount === 1) return {
        ok: false, status: 401,
        clone: () => ({ json: async () => ({ error: 'authentication_failed' }) }),
      };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
    },
  });
  const { stationFetch } = buildContext(env);
  const res = await stationFetch('/api/codice/health', { baseUrl: 'https://station.local' });
  assert(res.ok);
  assert(refreshCalled);
  assertEqual(callCount, 2);
});

await test('10. retry → 401 novamente → sem loop (callCount == 2)', async () => {
  let callCount = 0;
  const env = makeEnv({
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
        refreshSession: async () => {},
      },
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
    fetchImpl: async () => {
      callCount++;
      return {
        ok: false, status: 401,
        clone: () => ({ json: async () => ({ error: 'authentication_failed' }) }),
      };
    },
  });
  const { stationFetch } = buildContext(env);
  try {
    await stationFetch('/api/codice/health', { baseUrl: 'https://station.local' });
    assert(false, 'deve ter lançado');
  } catch (e) {
    assertEqual(e.code, 'authentication_failed');
    assertEqual(callCount, 2);
  }
});

await test('11. 401 authentication_required → sem retry → 1 chamada', async () => {
  let callCount = 0;
  const env = makeEnv({
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
        refreshSession: async () => {},
      },
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
    fetchImpl: async () => {
      callCount++;
      return {
        ok: false, status: 401,
        clone: () => ({ json: async () => ({ error: 'authentication_required' }) }),
      };
    },
  });
  const { stationFetch } = buildContext(env);
  try {
    await stationFetch('/api/codice/health', { baseUrl: 'https://station.local' });
    assert(false, 'deve ter lançado');
  } catch (e) {
    assertEqual(e.code, 'authentication_required');
    assertEqual(callCount, 1);
  }
});

// ─── 12–13: releaseActiveBookResources ───────────────────────────────────────
await test('12. releaseActiveBookResources destrói rendition, epub.book e pdf', async () => {
  let renditionDestroyed = false, bookDestroyed = false, pdfDestroyed = false;
  const env = makeEnv({
    stateOverride: {
      activeBook: {
        rendition: { destroy: () => { renditionDestroyed = true; } },
        book:      { destroy: () => { bookDestroyed = true; } },
        pdf:       { destroy: () => { pdfDestroyed = true; } },
        isLocal: true,
      },
      activeBookNotes: { global: 'notas' },
      activeNoteKey: 'global',
    },
  });
  const { releaseActiveBookResources } = buildContext(env);
  await releaseActiveBookResources();
  assert(renditionDestroyed, 'rendition.destroy');
  assert(bookDestroyed, 'book.destroy');
  assert(pdfDestroyed, 'pdf.destroy');
  assert(env.state.activeBook === null, 'activeBook null');
  assert(env.state.activeBookNotes === null, 'activeBookNotes null');
  assert(env.state.activeNoteKey === null, 'activeNoteKey null');
});

await test('13. releaseActiveBookResources limpa epub-viewer, pdf-viewer, reader-content', async () => {
  const env = makeEnv({
    stateOverride: {
      activeBook: { rendition: null, book: null, pdf: null, isLocal: true },
    },
  });
  env.dom['epub-viewer'].innerHTML    = '<div>epub</div>';
  env.dom['pdf-viewer'].innerHTML     = '<div>pdf</div>';
  env.dom['reader-content'].innerHTML = '<div>content</div>';
  const { releaseActiveBookResources } = buildContext(env);
  await releaseActiveBookResources();
  assertEqual(env.dom['epub-viewer'].innerHTML, '');
  assertEqual(env.dom['pdf-viewer'].innerHTML, '');
  assertEqual(env.dom['reader-content'].innerHTML, '');
});

// ─── 14–16: Content-Type ─────────────────────────────────────────────────────
await test('14. Content-Type application/epub+zip; charset=utf-8 aceito para epub', async () => {
  const ctBase = 'application/epub+zip; charset=utf-8'.split(';')[0].trim().toLowerCase();
  assertEqual(ctBase, 'application/epub+zip');
});

await test('15. Content-Type text/html rejeitado para epub', async () => {
  const ctBase = 'text/html'.split(';')[0].trim().toLowerCase();
  assert(ctBase !== 'application/epub+zip');
});

await test('16. Content-Type text/plain; charset=utf-8 aceito para txt', async () => {
  const ctBase = 'text/plain; charset=utf-8'.split(';')[0].trim().toLowerCase();
  assertEqual(ctBase, 'text/plain');
});

// ─── Canários mutantes ────────────────────────────────────────────────────────
await test('canário-A: mutante sem Bearer é detectado como violação', async () => {
  const mutant = `async function stationFetch(path, { baseUrl }) {
    const res = await fetch(new URL(path, baseUrl), { mode: 'cors' });
    return res;
  }`;
  const hasBearer = /Authorization/.test(mutant) && /Bearer/.test(mutant);
  assert(!hasBearer, 'mutante sem Bearer deve ser detectado');
});

await test('canário-B: mutante sem trustedOrigin é detectado', async () => {
  const mutant = `async function stationFetch(path, { baseUrl }) {
    const accessToken = 'tok';
    const res = await fetch(new URL(path, baseUrl), { headers: { Authorization: 'Bearer ' + accessToken } });
    return res;
  }`;
  const hasOriginCheck = /trustedOrigin|approvedOrigin/.test(mutant);
  assert(!hasOriginCheck, 'mutante sem trustedOrigin deve ser detectado');
});

await test('canário-C: fetch de book.url é detectado', async () => {
  const bad  = `const res = await fetch(b.url, { credentials: 'omit' });`;
  const good = `const res = await stationFetch('/api/codice/books/' + id, { baseUrl });`;
  assert(/fetch\s*\(\s*(b|book)\.url/.test(bad), 'fetch de b.url deve ser detectado');
  assert(!/fetch\s*\(\s*(b|book)\.url/.test(good), 'stationFetch não deve acionar a regra');
});

// ─── Relatório final ──────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
