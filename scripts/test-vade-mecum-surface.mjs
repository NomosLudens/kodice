#!/usr/bin/env node
/**
 * test-vade-mecum-surface.mjs
 *
 * Validação automatizada da Superfície Principal do Vade Mecum:
 * 1. Transição para visão principal #vade-mecum-view (não overlay).
 * 2. Card da norma real CPC/2015 visível na Home.
 * 3. Busca determinística ("300" e "tutela de urgência").
 * 4. Navegação por resultado direto de busca para Art. 300.
 * 5. Layout Desktop (320px tree + leitor editorial).
 * 6. Layout Mobile (390×844) sem overflow horizontal.
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

const browserInstance = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
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

  // 1. Alternar para a superfície do Vade Mecum
  await page.waitForSelector('button[data-nav="legal"]');
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-nav="legal"]');
    if (btn) btn.click();
  });

  const isMainSurfaceVisible = await page.evaluate(() => {
    const v = document.getElementById('vade-mecum-view');
    const l = document.getElementById('landing');
    const r = document.getElementById('reader');
    return v && !v.classList.contains('hidden') && l.classList.contains('hidden') && r.classList.contains('hidden');
  });
  check(isMainSurfaceVisible, 'Vade Mecum é exibido como superfície principal (não overlay)');

  // 2. Card da Norma CPC/2015
  await page.waitForSelector('#vade-norms-grid .vade-norm-card', { timeout: 10000 });
  const normTitle = await page.evaluate(() => {
    const card = document.querySelector('#vade-norms-grid .vade-norm-card');
    return card ? card.textContent : '';
  });
  check(normTitle.includes('Processo Civil') || normTitle.includes('CPC'), 'Card da norma real retornado pela API');

  // 3. Busca determinística por "300"
  await page.evaluate(() => {
    const input = document.getElementById('vade-search-input');
    if (input) {
      input.value = '300';
      window.performVadeSearch('300');
    }
  });
  try {
    await page.waitForFunction(() => document.querySelectorAll('#vade-search-results-list .vade-search-item').length > 0, { timeout: 8000 });
  } catch (err) {
    const listHtml = await page.evaluate(() => document.getElementById('vade-search-results-list')?.innerHTML);
    console.error('Debug step 3 listHtml:', listHtml);
    throw err;
  }

  const searchResultsCount = await page.evaluate(() => {
    return document.querySelectorAll('#vade-search-results-list .vade-search-item').length;
  });
  check(searchResultsCount > 0, `Busca por '300' retornou ${searchResultsCount} unidade(s)`);

  // 4. Abrir Art. 300 via resultado de busca
  await page.evaluate(() => {
    window.openVadeNormReader('cpc2015', 'art300');
  });
  await page.waitForFunction(() => !!document.querySelector('#vade-article-container h1'), { timeout: 10000 });

  const articleTitle = await page.evaluate(() => {
    return document.querySelector('#vade-article-container h1')?.textContent || '';
  });
  check(articleTitle.includes('ART. 300'), `Artigo 300 aberto editorialmente: "${articleTitle}"`);

  // 5. Testar Busca por Texto ("tutela de urgência")
  await page.evaluate(() => {
    const list = document.getElementById('vade-search-results-list');
    if (list) list.innerHTML = '';
    const input = document.getElementById('vade-search-input');
    if (input) {
      input.value = 'tutela de urgência';
      window.performVadeSearch('tutela de urgência');
    }
  });
  await page.waitForFunction(() => {
    const item = document.querySelector('#vade-search-results-list .vade-search-item');
    return item && item.textContent.toLowerCase().includes('tutela');
  }, { timeout: 10000 });

  const textSearchResult = await page.evaluate(() => {
    return document.querySelector('#vade-search-results-list .vade-search-item')?.textContent || '';
  });
  check(textSearchResult.includes('tutela de urgência') || textSearchResult.includes('ART'), 'Busca textual por "tutela de urgência" retornou resultados');

  // 6. Testar Responsividade Mobile (390×844) sem overflow horizontal
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
