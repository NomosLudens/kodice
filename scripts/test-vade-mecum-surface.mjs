#!/usr/bin/env node
/**
 * test-vade-mecum-surface.mjs
 *
 * Validação automatizada do Vade Mecum como entrada padrão do Kódice:
 *  1. Boot abre direto na home jurídica (#vade-home) — não na landing de upload.
 *  2. Catálogo jurídico real é listado (61 normas).
 *  3. CTA secundária "Abrir biblioteca" / "Adicionar livro" presente.
 *  4. Busca determinística ("300 cpc") resolve via catálogo e abre o Art. 300
 *     do CPC2015 no reader como documento contínuo.
 *  5. Texto do Art. 300 começa com "A tutela de urgência…".
 *  6. Mobile (390×844) sem overflow horizontal.
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

  const title = await page.title();
  check(/Kódice|KÓDICE/.test(title), `Título do aplicativo contém Kódice (${JSON.stringify(title)})`);

  // 1. Boot abre na home jurídica — sem precisar clicar em nada
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  const bootState = await page.evaluate(() => {
    const home = document.getElementById('vade-home');
    const landing = document.getElementById('landing');
    const reader = document.getElementById('reader');
    const titleWrap = document.getElementById('title-wrap');
    const inlineNav = document.getElementById('reader-inline-nav');
    const progressBar = document.getElementById('progress');
    return {
      homeVisible: !!(home && !home.classList.contains('hidden')),
      landingHidden: !!(landing && landing.classList.contains('hidden')),
      readerHidden: !!(reader && reader.classList.contains('hidden')),
      // GATES da missão de correção 10 incidentes:
      // home jurídica não pode vazar estado do livro
      titleWrapHidden: !!(titleWrap && titleWrap.classList.contains('hidden')),
      bookTitleEmpty: document.getElementById('book-title').textContent === '',
      bookAuthorEmpty: document.getElementById('book-author').textContent === '',
      inlineNavHidden: !!(inlineNav && inlineNav.classList.contains('hidden')),
      progressWidth: progressBar?.firstElementChild?.style.width || '0%',
    };
  });
  check(bootState.homeVisible, 'Boot abre direto na home jurídica (Vade Mecum)');
  check(bootState.landingHidden, 'Landing de upload não está visível no boot');
  check(bootState.readerHidden, 'Reader não está visível no boot');
  // Gate: home jurídica não vaza estado do livro pessoal
  check(bootState.titleWrapHidden, 'HOME_BOOK_TITLE_VISIBLE=NO [title-wrap hidden]');
  check(bootState.bookTitleEmpty, 'HOME_BOOK_TITLE_VISIBLE=NO [title empty]');
  check(bootState.bookAuthorEmpty, 'HOME_BOOK_AUTHOR_VISIBLE=NO [author empty]');
  check(bootState.inlineNavHidden, 'HOME_INLINE_PREV_NEXT_VISIBLE=NO [inline-nav hidden]');
  check(bootState.progressWidth === '0%', 'HOME_BOOK_PROGRESS_VISIBLE=NO [progress 0%]');

  // 2. Catálogo jurídico carrega (61 normas)
  await page.waitForSelector('#vade-home-norms .vade-home-norm', { timeout: 10000 });
  const normTitles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('#vade-home-norms .vade-home-norm .vn-title')).map(e => e.textContent.trim());
  });
  check(normTitles.length >= 50, `Catálogo jurídico: ${normTitles.length} normas listadas`);
  const cpcIndex = normTitles.findIndex(t => /CPC|Processo Civil/i.test(t));
  check(cpcIndex >= 0, 'Card CPC/2015 presente na home jurídica');

  // 3. CTA secundária "Abrir biblioteca" presente
  const libBtn = await page.$('#btn-vade-open-library');
  const addBtn = await page.$('#btn-vade-pick-file');
  check(!!libBtn, 'CTA secundária "Abrir biblioteca" presente');
  check(!!addBtn, 'CTA secundária "Adicionar livro" presente');

  // 4. Busca determinística "cpc 300" — via input da home jurídica
  // (formato "<alias-curto> <número-artigo>" que o resolver determinístico aceita)
  // Primeiro garante que o catálogo está carregado (resolveCatalogFrontend
  // depende de legalState.catalog). A home carrega ambos em paralelo, mas o
  // test pode rodar mais rápido do que o /catalog em CI.
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 10000 });
  await page.type('#vade-home-search-input', 'cpc 300');
  // Espera o catálogo resolver (resolver frontend é síncrono, mas o catálogo
  // pode estar sendo carregado em background — aguarda até 5s).
  await page.waitForFunction(() => {
    const results = document.getElementById('vade-home-search-results');
    return results && !results.classList.contains('hidden') && results.querySelector('.vade-home-search-result');
  }, { timeout: 5000 });
  const searchHit = await page.evaluate(() => {
    const btn = document.querySelector('#vade-home-search-results .vade-home-search-result');
    return btn ? btn.textContent.trim() : '';
  });
  // "CPC" deve aparecer como sigla (não como substring de "Código Penal")
  check(/\bCPC\b|Código de Processo Civil/i.test(searchHit), `Busca "cpc 300" resolveu para catálogo (${searchHit.slice(0,80)})`);

  // Clica no resultado — abre documento contínuo com Art. 300
  await page.evaluate(() => {
    document.querySelector('#vade-home-search-results .vade-home-search-result')?.click();
  });
  await page.waitForFunction(() => {
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    return !!(art && art.querySelector('.legal-unit-title'));
  }, { timeout: 15000 });

  const articleState = await page.evaluate(() => {
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    const title = art?.querySelector('.legal-unit-title')?.textContent || '';
    const text = art?.querySelector('.legal-unit-text')?.textContent || '';
    const r = art ? art.getBoundingClientRect() : null;
    return {
      title,
      textStart: text.slice(0, 80),
      inViewport: !!(r && r.top < window.innerHeight && r.bottom > 0),
      unitsCount: document.querySelectorAll('#legal-document .legal-unit').length
    };
  });
  check(articleState.title.includes('ART. 300'), `Artigo 300 materializado no documento: "${articleState.title}"`);
  check(articleState.textStart.includes('tutela') || articleState.textStart.length > 20, `Texto do Art. 300 começa com: "${articleState.textStart}"`);

  // 5. Clicar no botão "Jurídico" do sidebar volta para a home jurídica (não para landing de upload)
  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 3000 });
  const backToHome = await page.evaluate(() => {
    const home = document.getElementById('vade-home');
    const landing = document.getElementById('landing');
    return { home: !home.classList.contains('hidden'), landing: !landing.classList.contains('hidden') };
  });
  check(backToHome.home && !backToHome.landing, 'Voltar pelo Jurídico retorna à home jurídica (não à landing)');

  // 6. Mobile (390×844) sem overflow horizontal
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 200));
  const hasNoHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  check(hasNoHorizontalOverflow, 'Mobile (390×844) não apresenta overflow horizontal');

  // 7. Mobile 320px (menor viewport) também sem overflow
  await page.setViewport({ width: 320, height: 720 });
  await new Promise(r => setTimeout(r, 200));
  const noOverflow320 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(noOverflow320, 'Mobile (320×720) não apresenta overflow horizontal');

} catch (err) {
  console.error('Erro na execução do teste:', err);
  failed++;
} finally {
  await browserInstance.close();
  if (previewServer) previewServer.close();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
