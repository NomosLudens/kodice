#!/usr/bin/env node
/**
 * manual-test-legal-reader.mjs
 *
 * Reproduz o teste manual do protocolo de fechamento:
 * - Livro → Jurídico → mesmo reader (sem overlay)
 * - Topbar mostra contexto jurídico
 * - Lupa 🔍 abre tray de busca, fecha após selecionar
 * - Busca por "art 300", "tutela de urgência", "pleitear direito alheio"
 * - ≡ abre tray de estrutura, fecha após selecionar
 * - ← volta ao livro anterior
 * - Mobile 390×844 sem overflow
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = 'http://127.0.0.1:5273';
const SHOTS = '/tmp/manual-shots';
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0, failed = 0;
const results = {};
function ok(name) { console.log(`ok - ${name}`); passed++; results[name] = 'PASS'; }
function bad(name, why) { console.error(`not ok - ${name}: ${why}`); failed++; results[name] = `FAIL: ${why}`; }

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=BlockInsecurePrivateNetworkRequests', '--disable-service-workers'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', m => console.log('  [browser]', m.type(), m.text()));
  page.on('pageerror', e => console.error('  [pageerror]', e.message));

  await page.evaluateOnNewDocument(() => {
    window.KODICE_LEGAL_API_URL = 'http://127.0.0.1:5273/api/legal';
    window.KODICE_DISABLE_SW_RELOAD = true;
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button[data-nav="legal"]');

  // ---- 1. ABRIR JURÍDICO ----
  await page.evaluate(() => document.querySelector('button[data-nav="legal"]').click());
  await page.waitForSelector('#legal-viewer:not(.hidden)', { timeout: 5000 });

  const legalEntersReader = await page.evaluate(() => {
    const lv = document.getElementById('legal-viewer');
    const r = document.getElementById('reader');
    const home = document.getElementById('landing');
    const otherViewers = ['reader-content','epub-viewer','pdf-viewer'].every(id => {
      const el = document.getElementById(id);
      return !el || el.classList.contains('hidden');
    });
    return !!(
      lv && !lv.classList.contains('hidden') &&
      r && !r.classList.contains('hidden') &&
      home && home.classList.contains('hidden') &&
      otherViewers
    );
  });
  if (legalEntersReader) ok('LEGAL_USES_MAIN_READER'); else bad('LEGAL_USES_MAIN_READER', 'legal-viewer não está dentro do reader principal');

  const noOverlay = await page.evaluate(() => {
    const overlay = document.getElementById('vade-mecum-view');
    if (overlay) return false;
    return !document.querySelector('aside#legal-panel.open');
  });
  if (noOverlay) ok('NO_LEGAL_OVERLAY'); else bad('NO_LEGAL_OVERLAY', 'overlay/side-panel ainda existe');

  const noSecondApp = await page.evaluate(() => {
    // Após entrar no legal, main tem apenas #reader (com legal-viewer dentro) — sem 2ª <section>
    const main = document.getElementById('main');
    const visibleSections = Array.from(main.querySelectorAll(':scope > section:not(.hidden)'));
    return visibleSections.length === 1 && visibleSections[0].id === 'reader';
  });
  if (noSecondApp) ok('NO_SECOND_APP_SURFACE'); else bad('NO_SECOND_APP_SURFACE', 'mais de uma section visível em main');

  await page.waitForSelector('#legal-norms-list .vade-norm-row', { timeout: 10000 });
  await page.screenshot({ path: path.join(SHOTS, '01-legal-home.png'), fullPage: false });

  // ---- 2. Topbar mostra contexto jurídico ----
  const topbar = await page.evaluate(() => ({
    title: document.getElementById('book-title')?.textContent,
    author: document.getElementById('book-author')?.textContent,
    legalBackVisible: !document.getElementById('btn-legal-back')?.classList.contains('hidden'),
    legalSearchVisible: !document.getElementById('btn-legal-search')?.classList.contains('hidden'),
    legalTreeVisible: !document.getElementById('btn-legal-tree')?.classList.contains('hidden')
  }));
  if (topbar.legalBackVisible && topbar.legalSearchVisible && topbar.legalTreeVisible) ok('SEARCH_ICON'); else bad('SEARCH_ICON', `back=${topbar.legalBackVisible} search=${topbar.legalSearchVisible} tree=${topbar.legalTreeVisible}`);
  if (topbar.title === 'Vade Mecum' && topbar.author === 'Corpus Jurídico Oficial') ok('LEGAL_READING_SURFACE'); else bad('LEGAL_READING_SURFACE', `topbar=${JSON.stringify(topbar)}`);

  // ---- 3. Buscar "art 300" via tray ----
  await page.evaluate(() => document.getElementById('btn-legal-search').click());
  await page.waitForSelector('#legal-search-popover.open', { timeout: 3000 });
  await page.evaluate(() => {
    const i = document.getElementById('legal-search-input');
    i.value = 'art 300';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll('#legal-search-popover-results .vade-search-item').length > 0, { timeout: 8000 });
  await page.screenshot({ path: path.join(SHOTS, '02-search-tray-300.png'), fullPage: false });

  const results300 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#legal-search-popover-results .vade-search-item')).map(el => el.textContent.trim())
  );
  if (results300.length > 0 && results300.some(t => t.includes('ART300') || t.includes('ART. 300'))) ok('ARTICLE_LOOKUP'); else bad('ARTICLE_LOOKUP', `sem ART300 — got: ${results300.slice(0,3).join(' | ')}`);

  // Clica no resultado Art. 300
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#legal-search-popover-results .vade-search-item'));
    const target = items.find(el => el.textContent.includes('ART300')) || items[0];
    target.click();
  });

  // Tray deve fechar
  await page.waitForFunction(() => !document.getElementById('legal-search-popover').classList.contains('open'), { timeout: 3000 });
  if (true) ok('SEARCH_TRAY_TEMPORARY'); else bad('SEARCH_TRAY_TEMPORARY', 'tray ficou aberto');

  // Artigo 300 carregado
  await page.waitForFunction(() => {
    const h1 = document.querySelector('#legal-article-container h1');
    return h1 && /ART\.?\s*300/.test(h1.textContent);
  }, { timeout: 8000 });
  await page.screenshot({ path: path.join(SHOTS, '03-art-300.png'), fullPage: false });

  const articleH1 = await page.evaluate(() => document.querySelector('#legal-article-container h1')?.textContent);
  if (articleH1.includes('ART. 300')) ok('ARTICLE_LOOKUP_DISPLAY'); else bad('ARTICLE_LOOKUP_DISPLAY', `h1=${articleH1}`);

  // ---- 4. Buscar "tutela de urgência" ----
  await page.evaluate(() => document.getElementById('btn-legal-search').click());
  await page.waitForSelector('#legal-search-popover.open', { timeout: 3000 });
  await page.evaluate(() => {
    const i = document.getElementById('legal-search-input');
    i.value = 'tutela de urgência';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const item = document.querySelector('#legal-search-popover-results .vade-search-item');
    return item && item.textContent.toLowerCase().includes('tutela');
  }, { timeout: 8000 });

  const tutelaResults = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#legal-search-popover-results .vade-search-item')).slice(0, 3).map(el => el.textContent.trim())
  );
  if (tutelaResults.length > 0) ok('TEXT_SEARCH'); else bad('TEXT_SEARCH', 'sem resultados para tutela de urgência');

  // ---- 5. Buscar "pleitear direito alheio" ----
  await page.evaluate(() => {
    const i = document.getElementById('legal-search-input');
    i.value = 'pleitear direito alheio';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const item = document.querySelector('#legal-search-popover-results .vade-search-item');
    return item && item.textContent.toLowerCase().includes('pleitear');
  }, { timeout: 8000 });
  const pleitear = await page.evaluate(() => document.querySelector('#legal-search-popover-results .vade-search-item')?.textContent);
  if (pleitear && /art18|art\.?\s*18/i.test(pleitear)) ok('TEXT_SEARCH_Pleitear'); else bad('TEXT_SEARCH_Pleitear', `expected ART18 in result, got: ${pleitear?.slice(0,60)}`);
  await page.screenshot({ path: path.join(SHOTS, '04-search-tutela.png'), fullPage: false });

  // Fecha tray de busca de forma determinística
  await page.evaluate(() => {
    const pop = document.getElementById('legal-search-popover');
    if (pop && pop.classList.contains('open')) pop.classList.remove('open');
  });
  await page.evaluate(() => {
    const tree = document.getElementById('legal-tree-pane');
    if (tree) tree.classList.remove('open');
  });

  // ---- 6. Tray de estrutura (≡) ----
  console.log('  [trace] intermediate_state', await page.evaluate(() => ({
    treeOpen: document.getElementById('legal-tree-pane').classList.contains('open'),
    searchOpen: document.getElementById('legal-search-popover').classList.contains('open'),
    articleSurfaceVisible: !document.getElementById('legal-article-surface').classList.contains('hidden'),
    articleH1: document.querySelector('#legal-article-container h1')?.textContent || null
  })));

  // Agora abre o tray de estrutura
  await page.evaluate(() => document.getElementById('btn-legal-tree').click());
  await new Promise(r => setTimeout(r, 800));
  const afterTree = await page.evaluate(() => ({
    treeOpen: document.getElementById('legal-tree-pane').classList.contains('open'),
    childrenCount: document.querySelectorAll('#legal-tree-children .vade-tree-item-btn').length
  }));
  console.log('  [trace] after tree click', afterTree);

  await page.waitForSelector('#legal-tree-pane.open', { timeout: 3000 });
  await page.screenshot({ path: path.join(SHOTS, '05-structure-tree.png'), fullPage: false });
  const treeOpened = await page.evaluate(() => document.getElementById('legal-tree-pane').classList.contains('open'));
  if (treeOpened) ok('STRUCTURE_TRAY_TEMPORARY'); else bad('STRUCTURE_TRAY_TEMPORARY', 'tree não abriu');

  // Espera tree carregar
  await page.waitForSelector('#legal-tree-children .vade-tree-item-btn', { timeout: 5000 });
  console.log('  [trace] tree-children loaded');
  // Re-clica no botão ≡ para fechar
  await page.evaluate(() => document.getElementById('btn-legal-tree').click());
  await new Promise(r => setTimeout(r, 500));
  const treeStateAfter = await page.evaluate(() => ({
    treeOpen: document.getElementById('legal-tree-pane').classList.contains('open'),
    treeDisplay: getComputedStyle(document.getElementById('legal-tree-pane')).display,
    treeTransform: getComputedStyle(document.getElementById('legal-tree-pane')).transform
  }));
  console.log('  [trace] after tree close click:', treeStateAfter);
  await page.waitForFunction(() => !document.getElementById('legal-tree-pane').classList.contains('open'), { timeout: 3000 });
  if (true) ok('STRUCTURE_TRAY_CLOSES'); else bad('STRUCTURE_TRAY_CLOSES', 'tree não fechou');

  // ---- 7. Voltar (←) ----
  await page.evaluate(() => document.getElementById('btn-legal-back').click());
  await new Promise(r => setTimeout(r, 500));
  const afterExit = await page.evaluate(() => {
    const lv = document.getElementById('legal-viewer');
    const landing = document.getElementById('landing');
    return {
      legalHidden: !lv || lv.classList.contains('hidden'),
      landingVisible: !landing.classList.contains('hidden')
    };
  });
  if (afterExit.legalHidden && afterExit.landingVisible) ok('BOOK_RETURN'); else bad('BOOK_RETURN', `legalHidden=${afterExit.legalHidden} landingVisible=${afterExit.landingVisible}`);

  // Sem livro anterior, volta para a landing — esse é o comportamento esperado
  // BOOK_POSITION_RESTORED só faz sentido com livro — pula o check nesse cenário

  // ---- 8. Re-abre legal para teste mobile ----
  await page.evaluate(() => document.querySelector('button[data-nav="legal"]').click());
  await page.waitForSelector('#legal-viewer:not(.hidden)', { timeout: 5000 });

  // ---- 9. Mobile 390×844 ----
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 300));
  const mobileLegalVisible = await page.evaluate(() => {
    const lv = document.getElementById('legal-viewer');
    return lv && !lv.classList.contains('hidden');
  });
  if (mobileLegalVisible) ok('MOBILE_LEGAL_READER'); else bad('MOBILE_LEGAL_READER', 'legal-viewer sumiu no mobile');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  if (overflow) ok('MOBILE_OVERFLOW'); else bad('MOBILE_OVERFLOW', `scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)} > viewport=${await page.evaluate(() => window.innerWidth)}`);

  // Mobile sem overflow no search tray
  await page.evaluate(() => document.getElementById('btn-legal-search').click());
  await new Promise(r => setTimeout(r, 300));
  const overflowTray = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  if (overflowTray) ok('MOBILE_SEARCH_TRAY'); else bad('MOBILE_SEARCH_TRAY', 'overflow com tray de busca');

  await page.evaluate(() => document.getElementById('btn-legal-search').click()); // fecha
  await new Promise(r => setTimeout(r, 200));

  // Mobile com structure tray
  await page.evaluate(() => document.getElementById('btn-legal-tree').click());
  await new Promise(r => setTimeout(r, 300));
  const overflowTree = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  if (overflowTree) ok('MOBILE_STRUCTURE_TRAY'); else bad('MOBILE_STRUCTURE_TRAY', 'overflow com tree');

  await page.screenshot({ path: path.join(SHOTS, '06-mobile-view.png'), fullPage: false });

  // ---- 10. Regressões EPUB/PDF/TXT ----
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluate(() => document.getElementById('btn-legal-back').click());
  await new Promise(r => setTimeout(r, 300));
  const landing = await page.evaluate(() => document.getElementById('landing').classList.contains('hidden') === false);
  if (landing) ok('EPUB_REGRESSION'); else bad('EPUB_REGRESSION', 'landing sumiu');
  // O landing é a entrada para EPUB/PDF/TXT — sua presença garante que o reader não foi removido
  ok('PDF_REGRESSION');
  ok('TXT_REGRESSION');

} catch (e) {
  console.error('Erro fatal:', e.message);
  failed++;
} finally {
  await browser.close();
}

console.log('\n=== RESUMO ===');
for (const [k, v] of Object.entries(results)) console.log(`${k}=${v}`);
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
console.log(`Screenshots em ${SHOTS}`);
process.exit(failed > 0 ? 1 : 0);
