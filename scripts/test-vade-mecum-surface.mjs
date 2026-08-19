#!/usr/bin/env node
/**
 * test-vade-mecum-surface.mjs
 *
 * Validação automatizada do modo legal integrado ao reader principal:
 * 1. Vade Mecum é aberto dentro do #reader (não overlay, não segunda app).
 * 2. Norma real CPC/2015 listada na home do legal-viewer.
 * 3. Busca determinística ("300") via tray temporário (🔍).
 * 4. Resultado da busca fecha o tray e renderiza Art. 300 no reader.
 * 5. Busca textual ("tutela de urgência") retorna resultados.
 * 6. Tray de estrutura (≡) abre/fecha temporariamente.
 * 7. Layout Mobile (390×844) sem overflow horizontal.
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLegalApiHandler } from './legal-api-server.mjs';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5273';
let previewServer = null;

const legalDbPath = path.resolve('legal.db');
const legalHandler = fs.existsSync(legalDbPath) ? createLegalApiHandler(new DatabaseSync(legalDbPath)) : null;

if (APP_URL.includes('127.0.0.1:5273')) {
  const distDir = path.resolve('dist');
  previewServer = http.createServer((req, res) => {
    if (req.url.startsWith('/api/legal') && legalHandler) {
      return legalHandler(req, res);
    }
    let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) filePath = path.join(distDir, 'index.html');
    const ext = path.extname(filePath);
    const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  }).listen(5273, '127.0.0.1');
}

let passed = 0, failed = 0;
function check(cond, name) {
  if (cond) { console.log(`ok - ${name}`); passed++; }
  else { console.error(`not ok - ${name}`); failed++; }
}

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];
const envPath = process.env.CHROME_PATH;
const resolvedPath = envPath || CHROME_PATHS.find(p => fs.existsSync(p));
const chromePath = resolvedPath && fs.existsSync(resolvedPath) ? resolvedPath : null;
if (!chromePath) {
  console.log('SKIP: Chrome/Chromium not found in this environment (CI/build env).');
  console.log('Set CHROME_PATH env var to override. Test validado localmente.');
  console.log(`\n0 tests: 0 passed, 0 failed (skipped)`);
  process.exit(0);
}

const browserInstance = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=BlockInsecurePrivateNetworkRequests',
    '--disable-service-workers'
  ],
});

try {
  const page = await browserInstance.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log('  [browser]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('  [pageerror]', err.message));

  await page.evaluateOnNewDocument(() => {
    window.KODICE_LEGAL_API_URL = 'http://127.0.0.1:5273/api/legal';
    window.KODICE_DISABLE_SW_RELOAD = true;
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  check((await page.title()).includes('KÓDICE'), 'Título do aplicativo contém KÓDICE');

  // 1. Alternar para a superfície do Vade Mecum (modo legal do reader principal)
  await page.waitForSelector('button[data-nav="legal"]');
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-nav="legal"]');
    if (btn) btn.click();
  });

  const isMainSurfaceVisible = await page.evaluate(() => {
    const lv = document.getElementById('legal-viewer');
    const l = document.getElementById('landing');
    const r = document.getElementById('reader');
    const otherViewers = ['reader-content','epub-viewer','pdf-viewer'].every(id => {
      const el = document.getElementById(id);
      return !el || el.classList.contains('hidden');
    });
    return !!(lv && !lv.classList.contains('hidden') && l.classList.contains('hidden') && !r.classList.contains('hidden') && otherViewers);
  });
  check(isMainSurfaceVisible, 'Vade Mecum é exibido dentro do reader principal (não overlay)');

  // 2. Norma CPC/2015 listada na home do legal-viewer
  await page.waitForSelector('#legal-norms-list .vade-norm-row', { timeout: 10000 });
  const normTitle = await page.evaluate(() => {
    const card = document.querySelector('#legal-norms-list .vade-norm-row');
    return card ? card.textContent : '';
  });
  check(normTitle.includes('Processo Civil') || normTitle.includes('CPC'), 'Card da norma real retornado pela API');

  // 3. Abre o tray temporário de busca (🔍) e busca determinística por "300"
  await page.evaluate(() => {
    const btn = document.getElementById('btn-legal-search');
    if (btn) btn.click();
  });
  await page.waitForSelector('#legal-search-popover.open', { timeout: 5000 });
  await page.evaluate(() => {
    const input = document.getElementById('legal-search-input');
    if (input) {
      input.value = '300';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  try {
    await page.waitForFunction(() => document.querySelectorAll('#legal-search-popover-results .vade-search-item').length > 0, { timeout: 8000 });
  } catch (err) {
    const listHtml = await page.evaluate(() => document.getElementById('legal-search-popover-results')?.innerHTML);
    console.error('Debug step 3 listHtml:', listHtml);
    throw err;
  }

  const searchResultsCount = await page.evaluate(() => {
    return document.querySelectorAll('#legal-search-popover-results .vade-search-item').length;
  });
  check(searchResultsCount > 0, `Busca por '300' retornou ${searchResultsCount} unidade(s)`);

  // 4. Clica no resultado Art. 300 (deve fechar o tray e abrir o artigo)
  await page.evaluate(() => {
    const items = document.querySelectorAll('#legal-search-popover-results .vade-search-item');
    const target = Array.from(items).find(el => el.textContent.includes('ART300') || el.textContent.includes('ART. 300'));
    if (target) target.click();
    else items[0]?.click();
  });
  // Tray deve fechar
  await page.waitForFunction(() => !document.getElementById('legal-search-popover')?.classList.contains('open'), { timeout: 3000 });
  check(true, 'Tray de busca fecha após selecionar resultado');

  // Artigo 300 aberto editorialmente
  await page.waitForFunction(() => {
    const h1 = document.querySelector('#legal-article-container h1');
    return h1 && h1.textContent.includes('ART. 300');
  }, { timeout: 10000 });
  const articleTitle = await page.evaluate(() => {
    return document.querySelector('#legal-article-container h1')?.textContent || '';
  });
  check(articleTitle.includes('ART. 300'), `Artigo 300 aberto editorialmente: "${articleTitle}"`);

  // 5. Testar Busca por Texto ("tutela de urgência") via tray
  await page.evaluate(() => {
    const btn = document.getElementById('btn-legal-search');
    if (btn) btn.click();
  });
  await page.waitForSelector('#legal-search-popover.open', { timeout: 3000 });
  await page.evaluate(() => {
    const input = document.getElementById('legal-search-input');
    if (input) {
      input.value = 'tutela de urgência';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForFunction(() => {
    const item = document.querySelector('#legal-search-popover-results .vade-search-item');
    return item && item.textContent.toLowerCase().includes('tutela');
  }, { timeout: 10000 });

  const textSearchResult = await page.evaluate(() => {
    return document.querySelector('#legal-search-popover-results .vade-search-item')?.textContent || '';
  });
  check(textSearchResult.includes('tutela de urgência') || textSearchResult.includes('ART'), 'Busca textual por "tutela de urgência" retornou resultados');

  // 6. Tray de estrutura (≡) é temporário
  await page.evaluate(() => {
    const btn = document.getElementById('btn-legal-search');
    if (btn) btn.click(); // fecha busca
  });
  await page.waitForFunction(() => !document.getElementById('legal-search-popover')?.classList.contains('open'), { timeout: 3000 });
  await page.evaluate(() => {
    const btn = document.getElementById('btn-legal-tree');
    if (btn) btn.click();
  });
  await page.waitForSelector('#legal-tree-pane.open', { timeout: 3000 });
  check(true, 'Tray de estrutura (≡) abre temporariamente');
  // Fecha
  await page.evaluate(() => {
    const btn = document.getElementById('btn-legal-tree');
    if (btn) btn.click();
  });
  await page.waitForFunction(() => !document.getElementById('legal-tree-pane')?.classList.contains('open'), { timeout: 3000 });
  check(true, 'Tray de estrutura (≡) fecha ao clicar fora');

  // 7. Testar Responsividade Mobile (390×844) sem overflow horizontal
  await page.setViewport({ width: 390, height: 844 });
  const hasNoHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  check(hasNoHorizontalOverflow, 'Mobile (390×844) não apresenta overflow horizontal');

} catch (err) {
  console.error('Erro na execução do teste:', err);
  failed++;
} finally {
  await browserInstance.close();
  if (previewServer) previewServer.close();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
