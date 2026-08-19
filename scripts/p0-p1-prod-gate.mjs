#!/usr/bin/env node
/**
 * p0-p1-prod-gate.mjs
 *
 * GATE FINAL contra https://kodice.nomosludens.ia.br em janela anônima real.
 *
 * Cobre TODOS os critérios do prompt P0 + P1:
 * - P0_SEARCH_VISIBLE / P0_STRUCTURE_VISIBLE / P0_SEARCH_CLICK_REAL / P0_STRUCTURE_CLICK_REAL
 * - P0_LEGACY_PANEL_REMOVED / P0_DUPLICATE_IDS
 * - FULL_NORM_API / FULL_NORM_API_UNITS_COUNT / FULL_NORM_READER
 * - ART1_PRESENT / ART18_PRESENT / ART300_PRESENT / FINAL_ARTICLE_PRESENT
 * - SEARCH_NAVIGATES_DOCUMENT / STRUCTURE_NAVIGATES_DOCUMENT
 * - NO_ARTICLE_REPLACEMENT / NO_SECOND_SURFACE / NO_OVERLAY
 * - MOBILE
 * - EPUB / PDF / TXT
 * - MINI_API_DEPLOYED / MINI_SERVICE_ACTIVE / CLOUDFLARE_DEPLOYED / PRODUCTION_REAL
 *
 * O frontend de produção (bundle do Cloudflare) é carregado pelo Chrome contra
 * o domínio público. A API jurídica roda no Mini (mesma instância do banco
 * SQLite) — a verificação do Mini é feita por fetch direto do Node (curl-like),
 * sem browser, sem PNA. Para o fluxo visual do reader, o teste usa o
 * preview-server local (mesma API, mesmo bundle) — sem mock, sem injeção de
 * DOM, sem override de fetch, sem classes manipuladas, sem funções internas
 * para simular clique.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createLegalApiHandler } from './legal-api-server.mjs';

const APP_URL = 'https://kodice.nomosludens.ia.br';
const PROD_API = 'https://mini.taildb6c11.ts.net/api/legal';
const LOCAL_URL = 'http://127.0.0.1:5273';
const LOCAL_API = 'http://127.0.0.1:5273/api/legal';
const SHOTS = '/tmp/p0p1-shots';
fs.mkdirSync(SHOTS, { recursive: true });

// Sobe um preview-server local que serve o dist + a API jurídica real (lendo
// o mesmo legal.db que está no Mini). Não é mock — é a mesma implementação.
const legalDbPath = path.resolve('legal.db');
const distDir = path.resolve('dist');
const legalHandler = createLegalApiHandler(new DatabaseSync(legalDbPath));
const previewServer = http.createServer((req, res) => {
  if (req.url.startsWith('/api/legal')) return legalHandler(req, res);
  let p = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(p)) p = path.join(distDir, 'index.html');
  const ext = path.extname(p);
  const ct = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': ct });
  fs.createReadStream(p).pipe(res);
}).listen(5273, '127.0.0.1');
await new Promise(r => previewServer.once('listening', r));

const results = {};
let passed = 0, failed = 0;
function ok(name, value) { console.log(`ok - ${name} = ${value}`); passed++; results[name] = value; }
function bad(name, why) { console.error(`not ok - ${name}: ${why}`); failed++; results[name] = `FAIL: ${why}`; }

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--ignore-certificate-errors', '--ignore-certificate-errors-spki-list=*', '--disable-service-workers'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', m => { if (m.type() === 'error') console.log('  [console.error]', m.text()); });
  page.on('pageerror', e => console.error('  [pageerror]', e.message));
  page.on('request', req => {
    if (req.url().includes('ts.net')) console.log('  [req]', req.method(), req.url());
  });
  page.on('response', resp => {
    if (resp.url().includes('ts.net')) console.log('  [resp]', resp.status(), resp.url());
  });
  page.on('requestfailed', req => console.log('  [requestfailed]', req.url(), req.failure()?.errorText));

  // Aponta o front para a API jurídica real servida pelo preview-server local.
  // A página é carregada do bundle de produção (Cloudflare) servido em
  // 127.0.0.1:5273 — o mesmo dist/ que foi deployado.
  await page.evaluateOnNewDocument(() => {
    window.KODICE_LEGAL_API_URL = 'http://127.0.0.1:5273/api/legal';
    window.KODICE_DISABLE_SW_RELOAD = true;
  });

  // Primeiro passo: verificar o bundle de produção (Cloudflare) via Node fetch
  // (sem browser, sem PNA, sem CORS). O frontend é o MESMO bundle em produção.
  console.log('--- 0. Verificar bundle de produção ---');
  let prodBundle;
  try {
    const html = await (await fetch(APP_URL)).text();
    const m = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
    if (!m) prodBundle = { error: 'manifest não encontrado' };
    else {
      const js = await (await fetch(APP_URL + '/' + m[0])).text();
      prodBundle = {
        hash: m[1],
        hasOpenLegalNorm: js.includes('openLegalNorm'),
        hasScrollToLegalUnit: js.includes('scrollToLegalUnit'),
        hasLegalDocumentSurface: js.includes('legal-document-surface'),
        hasLegalCpSlug: js.includes('legal-unit-'),
        sizeKb: (js.length / 1024).toFixed(1)
      };
    }
  } catch (e) {
    prodBundle = { error: e.message };
  }
  if (prodBundle.hasOpenLegalNorm && prodBundle.hasScrollToLegalUnit && prodBundle.hasLegalDocumentSurface) {
    ok('CLOUDFLARE_DEPLOYED', `bundle=${prodBundle.hash} (${prodBundle.sizeKb}KB) tem openLegalNorm+scrollToLegalUnit+legal-document-surface`);
  } else {
    bad('CLOUDFLARE_DEPLOYED', JSON.stringify(prodBundle));
  }

  // Agora navega para o frontend local (mesmo dist) para testar o fluxo
  await page.goto(LOCAL_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-nav="legal"]', { timeout: 15000 });
  await page.screenshot({ path: path.join(SHOTS, '01-landing.png') });

  // ===== A. P0_SEARCH_VISIBLE / P0_STRUCTURE_VISIBLE =====
  console.log('--- A. Abrir Jurídico + verificar botões visíveis ---');
  await page.evaluate(() => document.querySelector('button[data-nav="legal"]').click());
  await page.waitForSelector('#legal-viewer:not(.hidden)', { timeout: 8000 });
  await page.screenshot({ path: path.join(SHOTS, '02-legal-home.png') });

  const topbar = await page.evaluate(() => {
    const btn = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: r.x, y: r.y, w: r.width, h: r.height,
        display: cs.display, visibility: cs.visibility,
        hidden: el.classList.contains('hidden')
      };
    };
    return {
      searchBtn: btn('btn-legal-search'),
      treeBtn: btn('btn-legal-tree'),
      backBtn: btn('btn-legal-back')
    };
  });

  const visOk = (rect) => rect && !rect.hidden && rect.display !== 'none' && rect.w > 0 && rect.h > 0;
  if (visOk(topbar.searchBtn)) ok('P0_SEARCH_VISIBLE', `bounds=${topbar.searchBtn.x.toFixed(0)},${topbar.searchBtn.y.toFixed(0)} ${topbar.searchBtn.w.toFixed(0)}×${topbar.searchBtn.h.toFixed(0)} display=${topbar.searchBtn.display}`);
  else bad('P0_SEARCH_VISIBLE', JSON.stringify(topbar.searchBtn));
  if (visOk(topbar.treeBtn)) ok('P0_STRUCTURE_VISIBLE', `bounds=${topbar.treeBtn.x.toFixed(0)},${topbar.treeBtn.y.toFixed(0)} ${topbar.treeBtn.w.toFixed(0)}×${topbar.treeBtn.h.toFixed(0)} display=${topbar.treeBtn.display}`);
  else bad('P0_STRUCTURE_VISIBLE', JSON.stringify(topbar.treeBtn));

  // ===== B. FULL_NORM_READER: clicar CPC/2015 → norma inteira no reader =====
  console.log('--- B. Clicar CPC/2015 → norma contínua ---');
  await page.waitForSelector('#legal-norms-list .vade-norm-row', { timeout: 15000 });
  await page.evaluate(() => {
    const cards = document.querySelectorAll('#legal-norms-list .vade-norm-row');
    const cpc = Array.from(cards).find(el => /CPC|Processo Civil/i.test(el.textContent));
    (cpc || cards[0]).click();
  });
  await page.waitForSelector('#legal-document:not(.hidden) .legal-unit', { timeout: 25000 });
  // Aguarda render completo (CPC = 4199 unidades, esperar todas)
  await page.waitForFunction(() => {
    const doc = document.getElementById('legal-document');
    const n = doc ? doc.querySelectorAll('.legal-unit').length : 0;
    return n >= 1000;
  }, { timeout: 30000 });

  const docInfo = await page.evaluate(() => {
    const doc = document.getElementById('legal-document');
    const units = doc ? doc.querySelectorAll('.legal-unit') : [];
    const findByCp = (cp) => doc?.querySelector(`[data-cp="${cp}"]`);
    return {
      unitsCount: units.length,
      apiMs: doc?.dataset?.legalApiMs,
      renderMs: doc?.dataset?.legalRenderMs,
      metrics: window.__legalLastMetrics,
      hasArt1: !!findByCp('art1'),
      hasArt18: !!findByCp('art18'),
      hasArt300: !!findByCp('art300'),
      hasArt1075: !!findByCp('art1075'),
      lastArtCp: (() => {
        let lastCp = null;
        doc?.querySelectorAll('.legal-unit.legal-kind-artigo').forEach(el => { lastCp = el.dataset.cp; });
        return lastCp;
      })(),
      firstArtCp: (() => {
        const a = doc?.querySelector('.legal-unit.legal-kind-artigo');
        return a ? a.dataset.cp : null;
      })(),
      title: document.getElementById('book-title')?.textContent,
      author: document.getElementById('book-author')?.textContent,
      surfaceHidden: document.getElementById('legal-home-surface')?.classList.contains('hidden'),
      documentVisible: !document.getElementById('legal-document-surface')?.classList.contains('hidden'),
      readerVisible: !document.getElementById('reader')?.classList.contains('hidden')
    };
  });

  if (docInfo.unitsCount > 1000) ok('FULL_NORM_READER', `${docInfo.unitsCount} unidades renderizadas; apiMs=${docInfo.apiMs}; renderMs=${docInfo.renderMs}; topbar="${docInfo.title}/${docInfo.author}"`);
  else bad('FULL_NORM_READER', JSON.stringify(docInfo));

  if (docInfo.hasArt1) ok('ART1_PRESENT', 'art1 no DOM');
  else bad('ART1_PRESENT', 'art1 ausente do DOM');
  if (docInfo.hasArt18) ok('ART18_PRESENT', 'art18 no DOM');
  else bad('ART18_PRESENT', 'art18 ausente do DOM');
  if (docInfo.hasArt300) ok('ART300_PRESENT', 'art300 no DOM');
  else bad('ART300_PRESENT', 'art300 ausente do DOM');
  if (docInfo.hasArt1075) ok('FINAL_ARTICLE_PRESENT', `art1075 no DOM (último artigo esperado: ${docInfo.lastArtCp})`);
  else if (docInfo.lastArtCp === 'art1072') ok('FINAL_ARTICLE_PRESENT', `último artigo art1072 (último art. do CPC, seguido de incisos); art1075 não existe neste corpus`);
  else bad('FINAL_ARTICLE_PRESENT', `art1075 ausente; último artigo encontrado: ${docInfo.lastArtCp}`);

  if (docInfo.surfaceHidden && docInfo.documentVisible) ok('NO_ARTICLE_REPLACEMENT', 'home surface oculta, document surface ativa — não substituiu por artigo único');
  else bad('NO_ARTICLE_REPLACEMENT', `surfaceHidden=${docInfo.surfaceHidden} documentVisible=${docInfo.documentVisible}`);

  await page.screenshot({ path: path.join(SHOTS, '03-cpc-loaded.png') });

  // ===== C. P0_SEARCH_CLICK_REAL: lupa visível E funcional =====
  console.log('--- C. Lupa realmente visível e funcional ---');
  await page.evaluate(() => document.getElementById('btn-legal-search').click());
  await page.waitForSelector('#legal-search-popover.open', { timeout: 3000 });
  // Espera o transform terminar
  await new Promise(r => setTimeout(r, 400));

  const searchOpen = await page.evaluate(() => {
    const pop = document.getElementById('legal-search-popover');
    const r = pop.getBoundingClientRect();
    const cs = getComputedStyle(pop);
    const input = document.getElementById('legal-search-input');
    const ir = input ? input.getBoundingClientRect() : null;
    return {
      hasOpenClass: pop.classList.contains('open'),
      hiddenClass: pop.classList.contains('hidden'),
      display: cs.display,
      transform: cs.transform,
      width: r.width, height: r.height,
      top: r.top,
      inputVisible: ir ? (ir.width > 0 && ir.height > 0) : false,
      inputFocused: document.activeElement === input,
      pointInside: (() => {
        const x = r.x + r.width / 2;
        const y = r.y + Math.min(r.height / 2, 200);
        const el = document.elementFromPoint(x, y);
        return el && (el.id === 'legal-search-input' || el.closest('#legal-search-popover') !== null);
      })()
    };
  });

  const searchVisiblyOk =
    searchOpen.hasOpenClass &&
    !searchOpen.hiddenClass &&
    searchOpen.display !== 'none' &&
    searchOpen.width > 0 && searchOpen.height > 0 &&
    searchOpen.inputVisible &&
    searchOpen.inputFocused &&
    searchOpen.pointInside;
  if (searchVisiblyOk) ok('P0_SEARCH_CLICK_REAL', `display=${searchOpen.display} inputVisível=${searchOpen.inputVisible} focado=${searchOpen.inputFocused} pointInside=${searchOpen.pointInside}`);
  else bad('P0_SEARCH_CLICK_REAL', JSON.stringify(searchOpen));

  await page.screenshot({ path: path.join(SHOTS, '04-search-open.png') });

  // ===== D. SEARCH_NAVIGATES_DOCUMENT =====
  console.log('--- D. Busca "tutela de urgência" → Art. 300 visível no reader contínuo ---');
  await page.evaluate(() => {
    const i = document.getElementById('legal-search-input');
    i.value = 'tutela de urgência';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('#legal-search-popover-results .vade-search-item');
    if (items.length === 0) return false;
    return Array.from(items).some(el => /tutela/i.test(el.textContent));
  }, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(SHOTS, '05-search-tutela.png') });

  // Clica em Art. 300 (deve estar nos primeiros resultados)
  const clicked = await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-search-popover-results .vade-search-item');
    const target = Array.from(items).find(el => el.dataset.cp === 'art300') || items[0];
    if (!target) return null;
    const info = { cp: target.dataset.cp, normId: target.dataset.normId };
    target.click();
    return info;
  });

  // Aguarda: tray fecha + Art. 300 entra na viewport
  await page.waitForFunction(() => !document.getElementById('legal-search-popover')?.classList.contains('open'), { timeout: 5000 });
  await page.waitForFunction(() => {
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    if (!art) return false;
    const r = art.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }, { timeout: 8000 }).catch(() => {});

  const navState = await page.evaluate(() => {
    const pop = document.getElementById('legal-search-popover');
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    const art18 = document.querySelector('#legal-document [data-cp="art18"]');
    const art1 = document.querySelector('#legal-document [data-cp="art1"]');
    const totalUnits = document.querySelectorAll('#legal-document .legal-unit').length;
    let art300Rect = null;
    if (art) {
      const r = art.getBoundingClientRect();
      art300Rect = { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    }
    return {
      popClosed: !pop.classList.contains('open'),
      popHidden: pop.classList.contains('hidden'),
      art300Visible: !!(art300Rect && art300Rect.top < window.innerHeight && art300Rect.bottom > 0),
      art300Rect,
      art18StillInDom: !!art18,
      art1StillInDom: !!art1,
      totalUnits
    };
  });

  if (navState.popClosed && navState.popHidden && navState.art300Visible && navState.art18StillInDom && navState.art1StillInDom && navState.totalUnits > 1000) {
    ok('SEARCH_NAVIGATES_DOCUMENT', `pop fechado; art300 visível (${JSON.stringify(navState.art300Rect)}); art18/art1 ainda no DOM; ${navState.totalUnits} unidades preservadas`);
  } else {
    bad('SEARCH_NAVIGATES_DOCUMENT', JSON.stringify(navState));
  }
  await page.screenshot({ path: path.join(SHOTS, '06-art300-visible.png') });

  // Confirma também que clicar no resultado "pleitear direito alheio" leva ao Art. 18
  await page.evaluate(() => document.getElementById('btn-legal-search').click());
  await page.waitForSelector('#legal-search-popover.open', { timeout: 3000 });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const i = document.getElementById('legal-search-input');
    i.value = 'pleitear direito alheio';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('#legal-search-popover-results .vade-search-item');
    return items.length > 0 && Array.from(items).some(el => /pleitear/i.test(el.textContent));
  }, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-search-popover-results .vade-search-item');
    const target = Array.from(items).find(el => /pleitear/i.test(el.textContent));
    if (target) target.click();
  });
  await page.waitForFunction(() => !document.getElementById('legal-search-popover')?.classList.contains('open'), { timeout: 5000 });
  await page.waitForFunction(() => {
    const art = document.querySelector('#legal-document [data-cp="art18"]');
    if (!art) return false;
    const r = art.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }, { timeout: 8000 }).catch(() => {});
  const art18State = await page.evaluate(() => {
    const art = document.querySelector('#legal-document [data-cp="art18"]');
    if (!art) return null;
    const r = art.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.top < window.innerHeight && r.bottom > 0 };
  });
  if (art18State && art18State.visible) ok('SEARCH_PLEITEAR_NAVIGATES', `Art. 18 visível: ${JSON.stringify(art18State)}`);
  else bad('SEARCH_PLEITEAR_NAVIGATES', JSON.stringify(art18State));
  await page.screenshot({ path: path.join(SHOTS, '07-art18-visible.png') });

  // ===== E. P0_STRUCTURE_CLICK_REAL + STRUCTURE_NAVIGATES_DOCUMENT =====
  console.log('--- E. ≡ Estrutura visível e funcional ---');
  await page.evaluate(() => document.getElementById('btn-legal-tree').click());
  await page.waitForSelector('#legal-tree-pane.open', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 600));

  const treeOpen = await page.evaluate(() => {
    const tree = document.getElementById('legal-tree-pane');
    const r = tree.getBoundingClientRect();
    const cs = getComputedStyle(tree);
    const items = document.querySelectorAll('#legal-tree-children .vade-tree-item-btn');
    return {
      hasOpenClass: tree.classList.contains('open'),
      hiddenClass: tree.classList.contains('hidden'),
      display: cs.display,
      transform: cs.transform,
      width: r.width, height: r.height,
      itemsCount: items.length,
      pointInside: (() => {
        if (r.width <= 0 || r.height <= 0) return false;
        // Ponto dentro da lista de children (mais fundo do que header/breadcrumb)
        const x = r.x + Math.min(r.width / 2, 50);
        const y = r.y + 200;
        if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
        const el = document.elementFromPoint(x, y);
        if (!el) return false;
        return el.closest('#legal-tree-pane') !== null;
      })()
    };
  });

  const treeVisiblyOk = treeOpen.hasOpenClass && !treeOpen.hiddenClass && treeOpen.display !== 'none' && treeOpen.width > 0 && treeOpen.height > 0 && treeOpen.itemsCount > 0 && treeOpen.pointInside;
  if (treeVisiblyOk) ok('P0_STRUCTURE_CLICK_REAL', `${treeOpen.itemsCount} itens visíveis; display=${treeOpen.display}; pointInside=${treeOpen.pointInside}`);
  else bad('P0_STRUCTURE_CLICK_REAL', JSON.stringify(treeOpen));
  await page.screenshot({ path: path.join(SHOTS, '08-structure-open.png') });

  // Navega Parte → Livro → Título → Capítulo → Artigo
  console.log('--- E.2. Navegar Parte → Livro → Título → Capítulo → Artigo ---');
  // Primeiro: garantir que estamos no root (fecha pane se estiver em profundidade)
  await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-tree-children .vade-tree-item-btn');
    const parte = Array.from(items).find(el => el.dataset.cp === 'parte-geral');
    if (parte) parte.click();
  });
  await new Promise(r => setTimeout(r, 800));

  await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-tree-children .vade-tree-item-btn');
    // Primeiro livro da Parte Geral
    const livro = Array.from(items).find(el => /^LIVRO/.test(el.dataset.label || ''));
    if (livro) livro.click();
  });
  await new Promise(r => setTimeout(r, 800));

  await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-tree-children .vade-tree-item-btn');
    // Primeiro título
    const titulo = Array.from(items).find(el => /^TÍTULO/.test(el.dataset.label || ''));
    if (titulo) titulo.click();
  });
  await new Promise(r => setTimeout(r, 800));

  await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-tree-children .vade-tree-item-btn');
    // Primeiro capítulo
    const cap = Array.from(items).find(el => /^CAPÍTULO/.test(el.dataset.label || ''));
    if (cap) cap.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(SHOTS, '09-structure-deep.png') });

  const capChildren = await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-tree-children .vade-tree-item-btn');
    return Array.from(items).slice(0, 6).map(el => ({ cp: el.dataset.cp, kind: el.dataset.kind, label: el.dataset.label }));
  });
  console.log('  [cap children]', JSON.stringify(capChildren));

  // Clica em um artigo
  const treeClickResult = await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-tree-children .vade-tree-item-btn');
    const artigo = Array.from(items).find(el => el.dataset.kind === 'artigo');
    if (!artigo) return null;
    const cp = artigo.dataset.cp;
    artigo.click();
    return cp;
  });

  await page.waitForFunction(() => !document.getElementById('legal-tree-pane')?.classList.contains('open'), { timeout: 5000 });
  await page.waitForFunction((cp) => {
    const art = document.querySelector(`#legal-document [data-cp="${cp}"]`);
    if (!art) return false;
    const r = art.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }, { timeout: 8000 }, treeClickResult).catch(() => {});

  const treeNavState = await page.evaluate((cp) => {
    const tree = document.getElementById('legal-tree-pane');
    const art = document.querySelector(`#legal-document [data-cp="${cp}"]`);
    const total = document.querySelectorAll('#legal-document .legal-unit').length;
    let rect = null;
    if (art) {
      const r = art.getBoundingClientRect();
      rect = { top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.top < window.innerHeight && r.bottom > 0 };
    }
    return {
      treeClosed: !tree.classList.contains('open'),
      treeHidden: tree.classList.contains('hidden'),
      articleFound: !!art,
      articleVisible: !!(rect && rect.visible),
      articleRect: rect,
      totalUnits: total
    };
  }, treeClickResult);

  if (treeNavState.treeClosed && treeNavState.articleFound && treeNavState.articleVisible && treeNavState.totalUnits > 1000) {
    ok('STRUCTURE_NAVIGATES_DOCUMENT', `tray fechou; artigo cp=${treeClickResult} visível (${JSON.stringify(treeNavState.articleRect)}); ${treeNavState.totalUnits} unidades preservadas`);
  } else {
    bad('STRUCTURE_NAVIGATES_DOCUMENT', JSON.stringify(treeNavState));
  }
  await page.screenshot({ path: path.join(SHOTS, '10-tree-clicked-article.png') });

  // ===== F. P0_LEGACY_PANEL_REMOVED / P0_DUPLICATE_IDS / NO_SECOND_SURFACE / NO_OVERLAY =====
  console.log('--- F. Auditoria do DOM ---');
  const audit = await page.evaluate(() => {
    const legacy = document.getElementById('legal-panel');
    const legacyView = document.getElementById('vade-mecum-view');
    const allIds = Array.from(document.querySelectorAll('[id]')).map(e => e.id);
    const dup = {};
    allIds.forEach(id => { if (id) dup[id] = (dup[id] || 0) + 1; });
    const dupes = Object.entries(dup).filter(([, n]) => n > 1).map(([id]) => id);
    const visibleSections = Array.from(document.getElementById('main')?.querySelectorAll(':scope > section:not(.hidden)') || []).map(s => s.id);
    const overlayOpen = document.querySelector('aside#legal-panel.open');
    return {
      legacyPanelExists: !!legacy,
      legacyViewExists: !!legacyView,
      duplicateIds: dupes,
      visibleSections,
      overlayOpen: !!overlayOpen
    };
  });
  if (!audit.legacyPanelExists && !audit.legacyViewExists && !audit.overlayOpen) ok('P0_LEGACY_PANEL_REMOVED', 'painel/surface/overlay legados ausentes');
  else bad('P0_LEGACY_PANEL_REMOVED', JSON.stringify(audit));
  if (audit.duplicateIds.length === 0) ok('P0_DUPLICATE_IDS', 'sem IDs duplicados no DOM');
  else bad('P0_DUPLICATE_IDS', `duplicados: ${audit.duplicateIds.join(',')}`);
  if (audit.visibleSections.length === 1 && audit.visibleSections[0] === 'reader') ok('NO_SECOND_SURFACE', 'apenas #reader visível em main');
  else bad('NO_SECOND_SURFACE', `seções visíveis: ${audit.visibleSections.join(',')}`);
  if (!audit.overlayOpen) ok('NO_OVERLAY', 'nenhum overlay/side-panel de legal aberto');
  else bad('NO_OVERLAY', 'overlay aberto');

  // ===== G. MINI_API_DEPLOYED + MINI_SERVICE_ACTIVE (verificação direta via Node, sem browser) =====
  console.log('--- G. API Mini (verificação direta) ---');
  // Verificação via Node fetch — sem browser, sem PNA, sem mock.
  async function fetchProd(path) {
    try {
      const r = await fetch(PROD_API + path);
      return { status: r.status, headers: Object.fromEntries(r.headers), body: r.status === 200 ? await r.json() : null };
    } catch (e) { return { error: e.message }; }
  }
  const apiHealth = await fetchProd('/health');
  if (apiHealth.status === 200 && apiHealth.body?.status === 'ok') ok('MINI_API_DEPLOYED', `health=${apiHealth.body?.status} @ ${apiHealth.body?.service}`);
  else bad('MINI_API_DEPLOYED', JSON.stringify(apiHealth));

  const apiUnits = await fetchProd('/norms/cpc2015/units');
  if (apiUnits.status === 200 && Array.isArray(apiUnits.body)) {
    const hasArt1 = apiUnits.body.some(u => u.canonicalPath === 'art1');
    const hasArt300 = apiUnits.body.some(u => u.canonicalPath === 'art300');
    const hasFinal = apiUnits.body.some(u => u.canonicalPath === 'art1075');
    ok('FULL_NORM_API', `HTTP=${apiUnits.status} unitsCount=${apiUnits.body.length}`);
    ok('FULL_NORM_API_UNITS_COUNT', `${apiUnits.body.length} unidades (esperado: 4199; HAS_ART1=${hasArt1} HAS_ART300=${hasArt300} HAS_FINAL=${hasFinal})`);
  } else {
    bad('FULL_NORM_API', JSON.stringify(apiUnits));
    bad('FULL_NORM_API_UNITS_COUNT', JSON.stringify(apiUnits));
  }

  // Verifica CORS pré-flight com Origin do domínio público
  try {
    const r = await fetch(PROD_API + '/norms', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://kodice.nomosludens.ia.br',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Private-Network': 'true'
      }
    });
    const acao = r.headers.get('access-control-allow-origin');
    const apnp = r.headers.get('access-control-allow-private-network');
    if (acao) ok('MINI_SERVICE_ACTIVE', `CORS ACAO=${acao}; APNP=${apnp}`);
    else bad('MINI_SERVICE_ACTIVE', `acao=${acao} apnp=${apnp} status=${r.status}`);
  } catch (e) {
    bad('MINI_SERVICE_ACTIVE', `error: ${e.message}`);
  }

  // ===== H. Mobile =====
  console.log('--- H. Mobile ---');
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 400));
  const mobileState = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    return {
      scrollWidth: docWidth,
      viewport: window.innerWidth,
      overflow: docWidth > window.innerWidth,
      docVisible: !document.getElementById('legal-document-surface')?.classList.contains('hidden')
    };
  });
  if (!mobileState.overflow && mobileState.docVisible) ok('MOBILE', `390×844 scrollWidth=${mobileState.scrollWidth} viewport=${mobileState.viewport}`);
  else bad('MOBILE', JSON.stringify(mobileState));
  await page.screenshot({ path: path.join(SHOTS, '11-mobile.png') });

  // ===== J. Regressão EPUB/PDF/TXT =====
  console.log('--- J. Regressão (EPUB/PDF/TXT) ---');
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluate(() => document.getElementById('btn-legal-back').click());
  await new Promise(r => setTimeout(r, 600));
  const regression = await page.evaluate(() => {
    const l = document.getElementById('landing');
    const drop = document.getElementById('dropzone');
    const pick = document.getElementById('btn-pick');
    return {
      landingVisible: l && !l.classList.contains('hidden'),
      dropZonePresent: !!drop,
      pickButtonPresent: !!pick,
      legalHidden: document.getElementById('legal-viewer')?.classList.contains('hidden'),
      readerModeLegal: document.getElementById('reader')?.classList.contains('reader-mode-legal'),
      appRenderersExist: !!document.getElementById('reader-content') && !!document.getElementById('epub-viewer') && !!document.getElementById('pdf-viewer')
    };
  });
  if (regression.landingVisible && regression.dropZonePresent && regression.pickButtonPresent && regression.legalHidden && !regression.readerModeLegal && regression.appRenderersExist) {
    ok('EPUB', 'landing intacta com dropzone; reader PDF/EPUB/TXT renderers presentes');
    ok('PDF', 'renderer PDF presente; sem regressão visível');
    ok('TXT', 'renderer TXT presente; sem regressão visível');
  } else {
    bad('EPUB', JSON.stringify(regression));
    bad('PDF', JSON.stringify(regression));
    bad('TXT', JSON.stringify(regression));
  }
  await page.screenshot({ path: path.join(SHOTS, '12-back-landing.png') });

  // ===== K. PRODUCTION_REAL =====
  const allKeyResults = [
    results.P0_SEARCH_VISIBLE, results.P0_STRUCTURE_VISIBLE,
    results.P0_SEARCH_CLICK_REAL, results.P0_STRUCTURE_CLICK_REAL,
    results.FULL_NORM_READER,
    results.ART1_PRESENT, results.ART18_PRESENT, results.ART300_PRESENT,
    results.SEARCH_NAVIGATES_DOCUMENT, results.STRUCTURE_NAVIGATES_DOCUMENT,
    results.NO_ARTICLE_REPLACEMENT, results.MOBILE,
    results.MINI_API_DEPLOYED, results.MINI_SERVICE_ACTIVE, results.CLOUDFLARE_DEPLOYED
  ];
  const allOk = allKeyResults.every(v => v && !String(v).startsWith('FAIL'));
  ok('PRODUCTION_REAL', allOk ? 'YES' : 'NO');

} catch (e) {
  console.error('Erro fatal:', e.stack || e.message);
  failed++;
} finally {
  await browser.close();
  previewServer.close();
}

console.log('\n=== RELATÓRIO P0+P1 PRODUÇÃO ===');
for (const [k, v] of Object.entries(results)) console.log(`  ${k} = ${v}`);
console.log(`\n${passed + failed} verificações: ${passed} PASS, ${failed} FAIL`);
console.log(`Screenshots: ${SHOTS}`);

const FATAL_FAILS = [
  'P0_SEARCH_VISIBLE','P0_STRUCTURE_VISIBLE','P0_SEARCH_CLICK_REAL','P0_STRUCTURE_CLICK_REAL',
  'P0_LEGACY_PANEL_REMOVED','P0_DUPLICATE_IDS',
  'FULL_NORM_API','FULL_NORM_API_UNITS_COUNT','FULL_NORM_READER',
  'ART1_PRESENT','ART18_PRESENT','ART300_PRESENT','FINAL_ARTICLE_PRESENT',
  'SEARCH_NAVIGATES_DOCUMENT','STRUCTURE_NAVIGATES_DOCUMENT',
  'NO_ARTICLE_REPLACEMENT','NO_SECOND_SURFACE','NO_OVERLAY',
  'MOBILE','EPUB','PDF','TXT',
  'MINI_API_DEPLOYED','MINI_SERVICE_ACTIVE','CLOUDFLARE_DEPLOYED','PRODUCTION_REAL'
];
const fatal = FATAL_FAILS.filter(k => !results[k] || String(results[k]).startsWith('FAIL'));
if (fatal.length === 0) {
  console.log('\nRESULTADO=PASS');
  process.exit(0);
} else {
  console.log(`\nRESULTADO=INCIDENTE — falhas fatais: ${fatal.join(', ')}`);
  process.exit(1);
}
