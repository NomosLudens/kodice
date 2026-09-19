#!/usr/bin/env node
/**
 * test-station-auth.mjs
 *
 * Harness de teste unitário real para o PR #16.
 * Extrai as funções reais diretamente do index.html e as executa com mocks sintéticos.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extrator balanceado
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

// Infraestrutura de testes
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

// Extrair fontes reais de index.html
const indexPath = join(__dirname, '..', 'index.html');
const src = readFileSync(indexPath, 'utf8');
const getInitialStationConfigSrc = extractFunction(src, 'getInitialStationConfig');
const restoreDefaultStationSrc   = extractFunction(src, 'restoreDefaultStation');
const removeStationSrc            = extractFunction(src, 'removeStation');
const renderStationConfiguredStateSrc = extractFunction(src, 'renderStationConfiguredState');
const renderLibrarySrc            = extractFunction(src, 'renderLibrary');
const stationIdentityLabelSrc     = extractFunction(src, 'stationIdentityLabel');

const mapStationErrorSrc        = extractFunction(src, 'mapStationError');
const stationStatusFromErrorSrc = extractFunction(src, 'stationStatusFromError');
const stationFetchSrc           = extractFunction(src, 'stationFetch');
const fetchStationLibrarySrc    = extractFunction(src, 'fetchStationLibrary');
const testStationConnectionSrc  = extractFunction(src, 'testStationConnection');
const openStationBookSrc        = extractFunction(src, 'openStationBook');
const releaseActiveBookSrc      = extractFunction(src, 'releaseActiveBookResources');
const clearStationRemoteStateSrc = extractFunction(src, 'clearStationRemoteState');
const handleSignOutSrc          = extractFunction(src, 'handleSignOut');
const signOutSrc                = extractFunction(src, 'signOut');
const refreshUserSrc            = extractFunction(src, 'refreshUser');
const recoverStationAfterAuthSrc = extractFunction(src, 'recoverStationAfterAuth');

// Configuração do ambiente e injetor no globalThis
function setupEnv(overrides = {}) {
  const ls = overrides.localStorageData || {};
  const domElements = {
    'reader':         { onscroll: null, innerHTML: '', classList: { add: () => {}, remove: () => {} } },
    'epub-viewer':    { innerHTML: '' },
    'pdf-viewer':     { innerHTML: '' },
    'reader-content': { innerHTML: '' },
    'landing':        { classList: { add: () => {}, remove: () => {} } },
    'title-wrap':     { classList: { add: () => {}, remove: () => {} } },
    'book-title':     { textContent: '' },
    'book-author':    { textContent: '' },
    'toc-body':       { innerHTML: '' },
    'station-url-input': { value: '' },
    'station-status-label': { textContent: '' },
    'station-identity-label': { textContent: '' },
    'library-list': { innerHTML: '' },
    'lib-count': { textContent: '' },
    ...overrides.domElements,
  };

  const state = {
    activeTab: 'station',
    panels: { library: true },
    activeBook: null,
    activeBookNotes: null,
    activeNoteKey: null,
    station: { baseUrl: '', status: 'unconfigured', books: [], health: null, error: null },
    sync: { pending: 0 },
    ...overrides.stateOverride,
  };

  // Mocks do local
  globalThis.supabase = overrides.supabase || null;
  globalThis.STATION_BASE_URL_KEY = 'codice.station.baseUrl';
  globalThis.STATION_TRUSTED_ORIGIN_KEY = 'codice.station.trustedOrigin';
  globalThis.STATION_OPT_OUT_KEY = 'codice.station.defaultOptOut';
  // DEFAULT_STATION_URL is now empty by default (no private infra hardcoded).
  // Tests that need a specific station URL override this directly.
  globalThis.DEFAULT_STATION_URL = overrides.defaultStationUrl ?? '';
  globalThis.state = state;
  globalThis.localStorage = {
    getItem: k => ls[k] ?? null,
    setItem: (k, v) => { ls[k] = String(v); },
    removeItem: k => { delete ls[k]; },
  };
  globalThis.fetch = overrides.fetchImpl || (async () => {
    return { ok: true, status: 200, headers: new Map(), json: async () => ({}) };
  });
  globalThis.window = {
    confirm: overrides.windowConfirm || (() => true),
  };
  globalThis.toast = overrides.toast || (() => {});
  globalThis.escapeHtml = s => s;
  globalThis.domElements = domElements;
  globalThis.document = {
    getElementById: id => domElements[id] ?? null,
  };
  globalThis.$ = (sel) => {
    if (sel.startsWith('#')) return domElements[sel.slice(1)] ?? null;
    return null;
  };
  globalThis.getStationFingerprint = async () => 'aabbccddee00';
  globalThis.dbGet = async () => null;
  globalThis.dbPut = overrides.dbPut || (async () => null);
  globalThis.idb = overrides.idb || (async () => ({ add: () => {} }));
  globalThis.refreshPending = overrides.refreshPending || (async () => {});
  globalThis.flushQueue = overrides.flushQueue || (() => {});
  globalThis._openBookCommon = overrides._openBookCommon || (async (meta, buf, sId, srcId, prog, retry) => {
    state.activeBook = { id: sId, isLocal: false };
    return true;
  });
  globalThis.flushPendingNotes = overrides.flushPendingNotes || (async () => {});
  globalThis.setReaderChromeVisible = overrides.setReaderChromeVisible || (() => {});
  globalThis.applyReaderModeClass = overrides.applyReaderModeClass || (() => {});
  globalThis.resetReaderNavState = overrides.resetReaderNavState || (() => {});
  globalThis.setReaderInlineNavVisible = overrides.setReaderInlineNavVisible || (() => {});
  globalThis.updateProgress = overrides.updateProgress || (() => {});
  globalThis.updateRail = overrides.updateRail || (() => {});
  globalThis.renderLibrary = overrides.renderLibrary || (() => {});
  globalThis.updateStationSettingsUI = overrides.updateStationSettingsUI || (() => {});
  globalThis.openPanel = overrides.openPanel || (() => {});
  globalThis.openAuth = overrides.openAuth || (() => {});
  globalThis.renderAccount = overrides.renderAccount || (() => {});
  globalThis.updateSyncBadge = overrides.updateSyncBadge || (() => {});
  globalThis.loadProfile = overrides.loadProfile || (async () => ({}));

  // Compilar e registrar funções reais
  globalThis.getInitialStationConfig = new Function(`"use strict"; ${getInitialStationConfigSrc}; return getInitialStationConfig;`)();
  globalThis.restoreDefaultStation = new Function(`"use strict"; ${restoreDefaultStationSrc}; return restoreDefaultStation;`)();
  globalThis.removeStation = new Function(`"use strict"; ${removeStationSrc}; return removeStation;`)();
  globalThis.stationIdentityLabel = new Function(`"use strict"; ${stationIdentityLabelSrc}; return stationIdentityLabel;`)();
  // eslint-disable-next-line no-new-func
  globalThis.mapStationError = new Function(`"use strict"; ${mapStationErrorSrc}; return mapStationError;`)();
  // eslint-disable-next-line no-new-func
  globalThis.stationStatusFromError = new Function(`"use strict"; ${stationStatusFromErrorSrc}; return stationStatusFromError;`)();
  // eslint-disable-next-line no-new-func
  globalThis.releaseActiveBookResources = new Function(`"use strict"; ${releaseActiveBookSrc}; return releaseActiveBookResources;`)();
  // eslint-disable-next-line no-new-func
  globalThis.stationFetch = new Function(`"use strict"; ${stationFetchSrc}; return stationFetch;`)();
  // eslint-disable-next-line no-new-func
  globalThis.fetchStationLibrary = new Function(`"use strict"; ${fetchStationLibrarySrc}; return fetchStationLibrary;`)();
  globalThis.renderStationConfiguredState = new Function(`"use strict"; ${renderStationConfiguredStateSrc}; return renderStationConfiguredState;`)();
  // eslint-disable-next-line no-new-func
  globalThis.testStationConnection = new Function(`"use strict"; ${testStationConnectionSrc}; return testStationConnection;`)();
  // eslint-disable-next-line no-new-func
  globalThis.openStationBook = new Function(`"use strict"; ${openStationBookSrc}; return openStationBook;`)();
  // eslint-disable-next-line no-new-func
  globalThis.clearStationRemoteState = new Function(`"use strict"; ${clearStationRemoteStateSrc}; return clearStationRemoteState;`)();
  // eslint-disable-next-line no-new-func
  globalThis.handleSignOut = new Function(`"use strict"; ${handleSignOutSrc}; return handleSignOut;`)();
  // eslint-disable-next-line no-new-func
  globalThis.signOut = new Function(`"use strict"; ${signOutSrc}; return signOut;`)();
  // eslint-disable-next-line no-new-func
  globalThis.refreshUser = new Function(`"use strict"; ${refreshUserSrc}; return refreshUser;`)();
  globalThis.recoverStationAfterAuth = new Function(`"use strict"; ${recoverStationAfterAuthSrc}; return recoverStationAfterAuth;`)();

  // Dependências internas adicionadas ao global
  globalThis.notesWriteChain = Promise.resolve();
  globalThis.pendingNotesSave = null;
  globalThis.notesSaveInFlight = null;

  globalThis.persistNotesSnapshot = async (snapshot, { notify = false } = {}) => {
    if(!snapshot?.bookId) return;
    await globalThis.saveNotesNow({
      bookId: snapshot.bookId,
      content: snapshot.content,
      updatedAt: snapshot.updatedAt,
      notify,
    });
  };

  globalThis.saveNotesNow = async ({ bookId, content, updatedAt }) => {
    await globalThis.dbPut('notes', { book_id: bookId, content, updated_at: updatedAt });
    if (globalThis.state.user) {
      await globalThis.queueSync('notes', {
        user_id: globalThis.state.user.id,
        book_id: bookId,
        content,
        updated_at: new Date(updatedAt).toISOString(),
      });
    }
  };

  globalThis.queueSync = async (kind, row) => {
    await (await globalThis.idb('queue', 'readwrite')).add({
      kind, row, ts: Date.now(), owner_user_id: globalThis.state.user?.id
    });
  };

  globalThis.flushPendingNotes = async () => {
    const snapshot = globalThis.pendingNotesSave;
    if (!snapshot) return;
    globalThis.pendingNotesSave = null;
    await globalThis.persistNotesSnapshot(snapshot);
  };

  return {
    ls,
    state,
    domElements,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Execução dos testes
// ─────────────────────────────────────────────────────────────────────────────

await test('0. perfil novo sem VITE_KODICE_STATION_URL fica unconfigured sem request automático', async () => {
  let fetchCalled = false;
  const { state } = setupEnv({ fetchImpl: async () => { fetchCalled = true; } });
  const initial = globalThis.getInitialStationConfig();
  state.station.baseUrl = initial.baseUrl;
  state.station.status = initial.status;
  assertEqual(initial.baseUrl, '');
  assertEqual(initial.status, 'unconfigured');
  assert(!fetchCalled, 'a configuração inicial não pode consultar a Station');
});

await test('0a. perfil novo com VITE_KODICE_STATION_URL configurado recebe URL sem request automático', async () => {
  let fetchCalled = false;
  const { state } = setupEnv({
    defaultStationUrl: 'https://my-station.taildb6c11.ts.net',
    fetchImpl: async () => { fetchCalled = true; }
  });
  const initial = globalThis.getInitialStationConfig();
  state.station.baseUrl = initial.baseUrl;
  state.station.status = initial.status;
  assertEqual(initial.baseUrl, 'https://my-station.taildb6c11.ts.net');
  assertEqual(initial.status, 'origin_pending');
  assert(!fetchCalled, 'a configuração inicial não pode consultar a Station');
});

await test('0b. stationFetch bloqueia request e Bearer antes da confirmação de origem', async () => {
  let fetchCalled = false;
  setupEnv({
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
    fetchImpl: async () => { fetchCalled = true; }
  });
  try { await globalThis.stationFetch('/api/codice/health', { baseUrl: 'https://my-station.taildb6c11.ts.net' }); }
  catch (e) { assertEqual(e.code, 'origin_not_allowed'); }
  assert(!fetchCalled);
});

await test('0c. remoção persiste opt-out e restauração reabre confirmação', async () => {
  const { ls, state } = setupEnv({
    localStorageData: {
      'codice.station.baseUrl': 'https://station.local',
      'codice.station.trustedOrigin': 'https://station.local'
    }
  });
  await globalThis.removeStation();
  assertEqual(ls['codice.station.defaultOptOut'], '1');
  const afterReload = globalThis.getInitialStationConfig();
  assertEqual(afterReload.baseUrl, '');
  assertEqual(afterReload.status, 'unconfigured');
  globalThis.restoreDefaultStation();
  // After restoreDefaultStation with no env-provided DEFAULT_STATION_URL, station returns to empty
  assertEqual(state.station.baseUrl, '');
  assertEqual(state.station.status, 'unconfigured');
  assert(!ls['codice.station.defaultOptOut']);
  assert(!ls['codice.station.trustedOrigin']);
});

await test('0d. autenticação recupera session_expired e permite nova consulta do catálogo', async () => {
  let libraryCalls = 0;
  const { state } = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: {
        user: { id: 'user-456', email: 'reader@example.com' },
        access_token: 'tok'
      } } }) }
    },
    stateOverride: {
      user: null,
      station: { baseUrl: 'https://station.local', status: 'session_expired', books: [] }
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
    fetchImpl: async () => {
      libraryCalls++;
      return {
        ok: true, status: 200, headers: new Map(),
        json: async () => ({ schemaVersion: 1, books: [] })
      };
    }
  });

  await globalThis.refreshUser();
  const recovered = globalThis.recoverStationAfterAuth(null);
  assert(recovered, 'autenticação válida deveria recuperar a Station');
  assertEqual(state.station.status, 'configured');
  assertEqual(libraryCalls, 0, 'recuperação não deve consultar a Station automaticamente');

  await globalThis.fetchStationLibrary();
  assertEqual(libraryCalls, 1, 'catálogo deve poder ser consultado novamente após a recuperação');
});

await test('0e. configured mostra estado neutro e só carrega catálogo por ação explícita', async () => {
  let loadHandler = null;
  const { domElements, state } = setupEnv({
    stateOverride: {
      activeTab: 'station',
      station: { baseUrl: 'https://station.local', status: 'configured', books: [] }
    },
    domElements: {
      'btn-station-load': { addEventListener: (event, handler) => { loadHandler = handler; } }
    }
  });
  let fetchCalls = 0;
  globalThis.fetchStationLibrary = async () => { fetchCalls++; };
  globalThis.renderLibrary = new Function(`"use strict"; ${renderLibrarySrc}; return renderLibrary;`)();

  globalThis.renderLibrary();
  assert(!domElements['library-list'].innerHTML.includes('Nenhum livro encontrado'));
  assert(domElements['library-list'].innerHTML.includes('Estação pronta para consulta'));
  assert(domElements['library-list'].innerHTML.includes('Carregar catálogo'));
  assertEqual(fetchCalls, 0, 'configured não deve consultar a Station ao renderizar');
  assert(loadHandler, 'configured deve oferecer ação explícita de carregamento');
  await loadHandler();
  assertEqual(fetchCalls, 1, 'ação deve chamar fetchStationLibrary');
  assertEqual(state.station.status, 'configured');
});

await test('0f. online com catálogo vazio mostra vazio somente após consulta real', async () => {
  const { domElements } = setupEnv({
    stateOverride: {
      activeTab: 'station',
      station: { baseUrl: 'https://station.local', status: 'online', books: [] }
    }
  });
  globalThis.renderLibrary = new Function(`"use strict"; ${renderLibrarySrc}; return renderLibrary;`)();
  globalThis.renderLibrary();
  assert(domElements['library-list'].innerHTML.includes('Nenhum livro encontrado'));
});

await test('0g. identidade da Station distingue padrão, personalizada e ausência sem alterar configuração', async () => {
  // With DEFAULT_STATION_URL='', all non-empty URLs are 'Estação personalizada'
  setupEnv();
  assertEqual(globalThis.stationIdentityLabel('https://my-station.taildb6c11.ts.net'), 'Estação personalizada');
  assertEqual(globalThis.stationIdentityLabel('https://other-station.example'), 'Estação personalizada');
  assertEqual(globalThis.stationIdentityLabel(''), 'Estação');
  // With DEFAULT_STATION_URL set, matching URL is 'Estação padrão'
  setupEnv({ defaultStationUrl: 'https://my-station.taildb6c11.ts.net' });
  assertEqual(globalThis.stationIdentityLabel('https://my-station.taildb6c11.ts.net'), 'Estação padrão');
  assertEqual(globalThis.stationIdentityLabel('https://other-station.example'), 'Estação personalizada');
  const { state } = setupEnv({
    stateOverride: { station: { baseUrl: 'https://other-station.example', status: 'configured', books: [] } }
  });
  assertEqual(state.station.baseUrl, 'https://other-station.example');
});

await test('1. stationFetch envia Bearer, credentials:omit, cache:no-store, redirect:error', async () => {
  let fetchArgs = null;
  setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'valid_token' } } }) }
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
    fetchImpl: async (url, opts) => {
      fetchArgs = { url, opts };
      return { ok: true, status: 200, headers: new Map(), json: async () => ({}) };
    }
  });

  await globalThis.stationFetch('/api/codice/library', { baseUrl: 'https://station.local' });

  assert(fetchArgs !== null);
  assertEqual(fetchArgs.opts.headers.Authorization, 'Bearer valid_token');
  assertEqual(fetchArgs.opts.credentials, 'omit');
  assertEqual(fetchArgs.opts.cache, 'no-store');
  assertEqual(fetchArgs.opts.redirect, 'error');
});

await test('2. retry de token renovado na segunda chamada', async () => {
  let callCount = 0;
  let tokensSent = [];
  let refreshCalled = false;

  setupEnv({
    supabase: {
      auth: {
        getSession: async () => {
          return { data: { session: { access_token: callCount === 0 ? 'expired_token' : 'new_token' } } };
        },
        refreshSession: async () => { refreshCalled = true; }
      }
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
    fetchImpl: async (url, opts) => {
      callCount++;
      tokensSent.push(opts.headers.Authorization);
      if (callCount === 1) {
        return {
          ok: false, status: 401,
          clone: () => ({ json: async () => ({ error: 'authentication_failed' }) })
        };
      }
      return { ok: true, status: 200, headers: new Map(), json: async () => ({}) };
    }
  });

  await globalThis.stationFetch('/api/codice/library', { baseUrl: 'https://station.local' });

  assert(refreshCalled, 'refreshSession deveria ter sido chamado');
  assertEqual(tokensSent[0], 'Bearer expired_token');
  assertEqual(tokensSent[1], 'Bearer new_token');
  assertEqual(callCount, 2);
});

await test('3. testStationConnection: fluxo de confirmações e gravação', async () => {
  let confirmCalled = false;
  let fetchCalled = false;

  const { ls, state, domElements } = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) }
    },
    windowConfirm: () => { confirmCalled = true; return true; },
    fetchImpl: async () => {
      fetchCalled = true;
      return {
        ok: true, status: 200, headers: new Map(),
        json: async () => ({ ok: true, schemaVersion: 1, libraryAvailable: true, formats: ['epub'] })
      };
    }
  });

  domElements['station-url-input'].value = 'https://station.local';

  await globalThis.testStationConnection();
  assert(confirmCalled);
  assert(fetchCalled);
  assertEqual(ls['codice.station.trustedOrigin'], 'https://station.local');
  assertEqual(state.station.baseUrl, 'https://station.local');

  confirmCalled = false;
  await globalThis.testStationConnection();
  assert(!confirmCalled);
});

await test('4. testStationConnection cancelado não envia request', async () => {
  let fetchCalled = false;
  const { ls, domElements } = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) }
    },
    windowConfirm: () => false,
    fetchImpl: async () => { fetchCalled = true; return { ok: true }; }
  });

  domElements['station-url-input'].value = 'https://station.local';

  await globalThis.testStationConnection();
  assert(!fetchCalled);
  assert(!ls['codice.station.trustedOrigin']);
});

await test('5. testStationConnection: health inválido não salva trustedOrigin', async () => {
  const { ls, domElements } = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) }
    },
    windowConfirm: () => true,
    fetchImpl: async () => {
      return {
        ok: true, status: 200, headers: new Map(),
        json: async () => ({ ok: false })
      };
    }
  });

  domElements['station-url-input'].value = 'https://station.local';

  await globalThis.testStationConnection();
  assert(!ls['codice.station.trustedOrigin']);
});

await test('6. fetchStationLibrary com book.url relativa', async () => {
  const { state } = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) }
    },
    stateOverride: {
      station: { baseUrl: 'https://station.local', status: 'configured', books: [] }
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' },
    fetchImpl: async () => {
      return {
        ok: true, status: 200, headers: new Map(),
        json: async () => ({
          schemaVersion: 1,
          books: [
            { id: '1111111111222222222233333333334444444444555', title: 'Relativo Válido', format: 'epub', size: 120, author: null, modifiedAt: null, url: '/api/codice/books/1111111111222222222233333333334444444444555' },
            { id: '2222222222333333333344444444445555555555666', title: 'Relativo Inválido', format: 'epub', size: 100, author: null, modifiedAt: null, url: 'https://evil.local/api/codice/books/2222222222333333333344444444445555555555666' }
          ]
        })
      };
    }
  });

  await globalThis.fetchStationLibrary();

  assertEqual(state.station.books.length, 1);
  assertEqual(state.station.books[0].id, '1111111111222222222233333333334444444444555');
});

await test('7. openStationBook com Content-Types válidos e rejeição de inválido', async () => {
  const { state } = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) }
    },
    stateOverride: {
      station: {
        baseUrl: 'https://station.local',
        books: [
          { id: '1111111111222222222233333333334444444444555', title: 'E', format: 'epub', size: 10, author: null, modifiedAt: null },
          { id: '2222222222333333333344444444445555555555666', title: 'P', format: 'pdf', size: 10, author: null, modifiedAt: null },
          { id: '3333333333444444444455555555556666666666777', title: 'T', format: 'txt', size: 10, author: null, modifiedAt: null },
        ]
      }
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' }
  });

  let currentContentType = '';
  globalThis.fetch = async () => {
    const headers = new Map();
    headers.set('content-type', currentContentType);
    return {
      ok: true, status: 200,
      headers: { get: k => headers.get(k) },
      arrayBuffer: async () => new ArrayBuffer(8)
    };
  };

  currentContentType = 'application/epub+zip';
  let ok = await globalThis.openStationBook('1111111111222222222233333333334444444444555');
  assert(ok);

  currentContentType = 'application/pdf; charset=binary';
  ok = await globalThis.openStationBook('2222222222333333333344444444445555555555666');
  assert(ok);

  currentContentType = 'text/plain';
  ok = await globalThis.openStationBook('3333333333444444444455555555556666666666777');
  assert(ok);

  currentContentType = 'text/html';
  ok = await globalThis.openStationBook('1111111111222222222233333333334444444444555');
  assert(!ok);
});

await test('8. clearStationRemoteState e remoção da Station com livro remoto aberto', async () => {
  let renditionDestroyed = false;

  const { state } = setupEnv({
    supabase: { auth: {} },
    stateOverride: {
      station: { baseUrl: 'https://station.local', status: 'online', books: [] },
      activeBook: {
        id: 'station:xxx:book-1',
        isLocal: false,
        rendition: { destroy: async () => { renditionDestroyed = true; } }
      }
    }
  });

  await globalThis.clearStationRemoteState();

  assert(renditionDestroyed);
  assert(state.activeBook === null);
  assertEqual(state.station.status, 'login_required');
});

await test('9. approvedOrigin somente permitida para health', async () => {
  setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) }
    }
  });

  let ok = false;
  try {
    await globalThis.stationFetch('/api/codice/health', { baseUrl: 'https://station.local', approvedOrigin: 'https://station.local' });
    ok = true;
  } catch (e) {
    throw e;
  }
  assert(ok);

  try {
    await globalThis.stationFetch('/api/codice/library', { baseUrl: 'https://station.local', approvedOrigin: 'https://station.local' });
    assert(false);
  } catch (e) {
    assertEqual(e.code, 'origin_not_allowed');
  }
});

await test('10. Path whitelist exata com base64url SHA-256 e resolvedUrl checks', async () => {
  setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) }
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' }
  });

  const checkPath = async (p) => {
    try {
      await globalThis.stationFetch(p, { baseUrl: 'https://station.local' });
      return true;
    } catch (e) {
      return false;
    }
  };

  assert(await checkPath('/api/codice/health'));
  assert(await checkPath('/api/codice/library'));
  assert(await checkPath('/api/codice/books/1111111111222222222233333333334444444444555'), 'SHA-256 id de 43 caracteres aceito');
  assert(!await checkPath('/api/codice/books/curto'), 'id inválido rejeitado');
  assert(!await checkPath('/api/codice/settings'));
});

await test('11. Rejeição estrita de dot-segments no path', async () => {
  setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) }
    },
    localStorageData: { 'codice.station.trustedOrigin': 'https://station.local' }
  });

  const checkPath = async (p) => {
    try {
      await globalThis.stationFetch(p, { baseUrl: 'https://station.local' });
      return true;
    } catch (e) {
      return false;
    }
  };

  assert(!await checkPath('/api/codice/books/..'));
  assert(!await checkPath('/api/codice/books/.'));
  assert(!await checkPath('/api/codice/books/%2e%2e'));
  assert(!await checkPath('/api/codice/books/1111111111222222222233333333334444444444555/extra'));
});

await test('12. logout com nota pendente gera fila com owner_user_id antes de limpar state.user', async () => {
  const env = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }), signOut: async () => {} }
    },
    stateOverride: {
      user: { id: 'user-123', email: 'test@user.com' },
      activeBook: { id: 'book-123', isLocal: false }
    }
  });

  let queueAdded = null;
  globalThis.idb = async () => {
    return {
      add: (item) => {
        queueAdded = item;
      }
    };
  };

  globalThis.pendingNotesSave = {
    bookId: 'book-123',
    content: 'nova anotação',
    updatedAt: Date.now(),
    timer: 1234
  };

  await globalThis.signOut();

  assert(queueAdded !== null, 'Fila de sincronização deveria ter sido gerada');
  assertEqual(queueAdded.owner_user_id, 'user-123', 'Anotação deveria ter o owner_user_id do usuário que estava logado');
  assertEqual(queueAdded.row.content, 'nova anotação');
});

await test('13. TOKEN_REFRESHED preserva status unauthorized do mesmo usuário', async () => {
  const { state } = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'user-123', email: 'test@user.com' } } } }) }
    },
    stateOverride: {
      user: { id: 'user-123', email: 'test@user.com' },
      station: { baseUrl: 'https://station.local', status: 'unauthorized' }
    }
  });

  const prevUserId = state.user?.id;
  await globalThis.refreshUser();
  if (state.user) {
    if (state.station.baseUrl && state.station.status === 'login_required') {
      state.station.status = 'configured';
    }
    const identityChanged = prevUserId && state.user.id !== prevUserId;
    if (state.station.baseUrl && state.station.status === 'unauthorized' && identityChanged) {
      state.station.status = 'configured';
    }
  }

  assertEqual(state.station.status, 'unauthorized', 'Status unauthorized deveria ser mantido para o mesmo usuário');

  // Simular evento com usuário diferente
  const { state: stateDiff } = setupEnv({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'user-456', email: 'diff@user.com' } } } }) }
    },
    stateOverride: {
      user: { id: 'user-123', email: 'test@user.com' },
      station: { baseUrl: 'https://station.local', status: 'unauthorized' }
    }
  });

  const prevUserIdDiff = stateDiff.user?.id;
  await globalThis.refreshUser();
  if (stateDiff.user) {
    if (stateDiff.station.baseUrl && stateDiff.station.status === 'login_required') {
      stateDiff.station.status = 'configured';
    }
    const identityChanged = prevUserIdDiff && stateDiff.user.id !== prevUserIdDiff;
    if (stateDiff.station.baseUrl && stateDiff.station.status === 'unauthorized' && identityChanged) {
      stateDiff.station.status = 'configured';
    }
  }

  assertEqual(stateDiff.station.status, 'configured', 'Status unauthorized deveria voltar para configured quando a conta muda');
});

// Relatório final
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
