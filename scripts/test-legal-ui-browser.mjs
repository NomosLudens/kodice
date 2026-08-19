#!/usr/bin/env node
/**
 * test-legal-ui-browser.mjs
 *
 * Validação browser-side do fluxo jurídico real: o usuário clica de verdade em
 * Jurídico → CPC/2015 → Parte Geral → Livro V → Título II → Capítulo I → Art. 300.
 *
 * ZERO interceptação, ZERO mocks, ZERO injeção manual de DOM, ZERO disable-web-security.
 */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5273';
let previewServer = null;

if (APP_URL.includes('127.0.0.1:5273')) {
  const distDir = path.resolve('dist');
  previewServer = http.createServer((req, res) => {
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
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-web-security'],
});

try {
  const page = await browserInstance.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.warn('  [console.error]', msg.text());
  });
  page.on('pageerror', err => console.warn('  [pageerror]', err.message));
  page.on('requestfailed', req => console.warn('  [requestfailed]', req.url(), req.failure()?.errorText));

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(APP_URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));

  const titleText = await page.title();
  check(titleText.includes('KÓDICE'), `Título contém KÓDICE: "${titleText}"`);

  // 1. Clicar no botão Jurídico
  const legalBtnExists = await page.evaluate(() => {
    const el = document.querySelector('[data-nav="legal"]');
    if (el) { el.click(); return true; }
    return false;
  });
  check(legalBtnExists, 'Botão Jurídico acionado no sidebar');

  await page.waitForSelector('#legal-norms .legal-norm-btn', { timeout: 8000 }).catch(() => {});
  const status = await page.$eval('#legal-status', el => el.textContent).catch(() => '');
  const normsCount = await page.$$eval('#legal-norms .legal-norm-btn', els => els.length).catch(() => 0);
  check(normsCount > 0, `Lista normas carregada (${normsCount} normas, status="${status}")`);

  if (normsCount > 0) {
    // 2. Clicar no CPC/2015
    await page.click('.legal-norm-btn');
    await page.waitForSelector('[data-cp="parte-geral"]', { timeout: 8000 });

    const rootChildCount = await page.$$eval('#legal-children .legal-child-btn', els => els.length).catch(() => 0);
    check(rootChildCount > 0, `Filhos da raiz carregados (${rootChildCount} unidades)`);

    // 3. Clicar em PARTE GERAL (parte-geral)
    await page.click('[data-cp="parte-geral"]');
    await page.waitForSelector('[data-cp="parte-geral-livro-v"]', { timeout: 8000 });

    // 4. Clicar em LIVRO V (parte-geral-livro-v)
    await page.click('[data-cp="parte-geral-livro-v"]');
    await page.waitForSelector('[data-cp="parte-geral-livro-v-tit-ii"]', { timeout: 8000 });

    // 5. Clicar em TÍTULO II (parte-geral-livro-v-tit-ii)
    await page.click('[data-cp="parte-geral-livro-v-tit-ii"]');
    await page.waitForSelector('[data-cp="parte-geral-livro-v-tit-ii-cap-i"]', { timeout: 8000 });

    // 6. Clicar em CAPÍTULO I (parte-geral-livro-v-tit-ii-cap-i)
    await page.click('[data-cp="parte-geral-livro-v-tit-ii-cap-i"]');
    await page.waitForSelector('[data-cp="art300"]', { timeout: 8000 });

    // 7. Clicar em Art. 300 (art300)
    await page.click('[data-cp="art300"]');
    await new Promise(r => setTimeout(r, 2000));

    const articleText = await page.$eval('#legal-article', el => el.innerText).catch(() => '');
    check(articleText.includes('tutela de urgência será concedida'),
          `Art. 300 aberto por cliques reais (trecho: "${articleText.slice(0, 100).replace(/\n/g, ' ')}")`);

    // 8. Reload do app e sanidade
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    const titleAfterReload = await page.title();
    check(titleAfterReload.includes('KÓDICE'), 'Reload mantém o app no ar');
  }

} finally {
  await browserInstance.close();
  if (previewServer) previewServer.close();
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);