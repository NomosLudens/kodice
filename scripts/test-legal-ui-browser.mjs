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

const APP_URL = process.env.APP_URL || 'https://kodice.nomosludens.ia.br';

let passed = 0, failed = 0;
function check(cond, name) {
  if (cond) { console.log(`ok - ${name}`); passed++; }
  else { console.error(`not ok - ${name}`); failed++; }
}

const browserInstance = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
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
    await page.evaluate(() => document.querySelector('[data-norm-id="cpc2015"]')?.click());
    await new Promise(r => setTimeout(r, 2000));

    const rootChildCount = await page.$$eval('#legal-children .legal-child-btn', els => els.length).catch(() => 0);
    check(rootChildCount > 0, `Filhos da raiz carregados (${rootChildCount} unidades)`);

    // 3. Clicar em PARTE GERAL (parte-geral)
    await page.evaluate(() => document.querySelector('[data-cp="parte-geral"]')?.click());
    await new Promise(r => setTimeout(r, 1500));

    // 4. Clicar em LIVRO V (parte-geral-livro-v)
    await page.evaluate(() => document.querySelector('[data-cp="parte-geral-livro-v"]')?.click());
    await new Promise(r => setTimeout(r, 1500));

    // 5. Clicar em TÍTULO II (parte-geral-livro-v-tit-ii)
    await page.evaluate(() => document.querySelector('[data-cp="parte-geral-livro-v-tit-ii"]')?.click());
    await new Promise(r => setTimeout(r, 1500));

    // 6. Clicar em CAPÍTULO I (parte-geral-livro-v-tit-ii-cap-i)
    await page.evaluate(() => document.querySelector('[data-cp="parte-geral-livro-v-tit-ii-cap-i"]')?.click());
    await new Promise(r => setTimeout(r, 1500));

    // 7. Clicar em Art. 300 (art300)
    await page.evaluate(() => document.querySelector('[data-cp="art300"]')?.click());
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
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);