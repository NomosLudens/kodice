#!/usr/bin/env node
/**
 * test-public-legal-flow.mjs
 *
 * Prova real do produto publicado contra api.kodice.nomosludens.ia.br:
 *  - Abre https://kodice.nomosludens.ia.br
 *  - Verifica que Vade Mecum carrega
 *  - Verifica que Network aponta para api.kodice.nomosludens.ia.br
 *  - Confirma CF, CC, CPC Art. 300
 *  - Confirma que NÃO chama mellon.taildb6c11.ts.net
 *  - Confirma que PNA não bloqueia (sem ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS)
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = 'https://kodice.nomosludens.ia.br';
const OUT_DIR = '/tmp/kodice-public-flow-evidence';
fs.mkdirSync(OUT_DIR, { recursive: true });

const CHROME_PATHS = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
const chromePath = process.env.CHROME_PATH || CHROME_PATHS.find(p => fs.existsSync(p));
if (!chromePath) { console.error('No Chrome'); process.exit(2); }

let passed = 0, failed = 0;
function check(cond, name, ctx) {
  if (cond) { console.log(`ok - ${name}`); passed++; }
  else { console.error(`not ok - ${name}` + (ctx ? `\n   ctx: ${ctx}` : '')); failed++; }
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
         '--disable-dev-shm-usage', '--disable-features=BlockInsecurePrivateNetworkRequests',
         '--ignore-certificate-errors'],
});

const networkLog = [];
const consoleErrors = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/legal') || url.includes('kodice.nomosludens') || url.includes('mellon.taildb6c11') || url.includes('api.kodice')) {
      networkLog.push({ t: 'req', method: req.method(), url });
    }
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/legal') || url.includes('api.kodice')) {
      networkLog.push({ t: 'resp', status: res.status(), url });
    }
  });
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('requestfailed', r => {
    const url = r.url();
    if (url.includes('/api/legal') || url.includes('api.kodice') || url.includes('mellon.taildb6c11')) {
      networkLog.push({ t: 'failed', url, failure: r.failure()?.errorText });
    }
  });

  // Cold visit
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#vade-home', { timeout: 10000 }).catch(() => null);
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 15000 });
  await page.waitForSelector('#vade-home-norms .vade-home-norm', { timeout: 10000 });

  await new Promise(r => setTimeout(r, 1500));

  const state = await page.evaluate(() => {
    const lbl = document.getElementById('vade-home-status-label')?.textContent || '';
    const norms = Array.from(document.querySelectorAll('#vade-home-norms .vade-home-norm .vn-title')).map(e => e.textContent.trim());
    const win = {
      legalApiUrl: (window.getLegalApiUrl?.() ?? 'no-fn'),
      hasCatalog: !!window.legalState?.catalog,
      allNormsCount: window.legalState?.allNorms?.length,
      catalogNormsCount: window.legalState?.catalog?.norms?.length,
    };
    return { state: lbl, normsSample: norms.slice(0, 5), normsCount: norms.length, win };
  });

  check(state.normsCount >= 50, `Catálogo jurídico carregado (${state.normsCount} normas)`);
  check(state.win.hasCatalog, 'window.legalState.catalog populado');
  check(state.normsSample.some(t => /Constituição|CF\b/i.test(t)), 'CF presente no catálogo');
  check(state.normsSample.some(t => /C[oó]digo Civil/i.test(t)), 'CC presente no catálogo');
  check(state.normsSample.some(t => /Processo Civil|CPC/i.test(t)), 'CPC presente no catálogo');

  await page.screenshot({ path: path.join(OUT_DIR, '01-home.png'), fullPage: false });

  // === Verifica URL efetiva ===
  const apiUsed = state.win.legalApiUrl;
  check(/api\.kodice\.nomosludens\.ia\.br/.test(apiUsed), `getLegalApiUrl() = ${apiUsed} (não Melltaildb6c11)`);

  // === BUSCA CF ===
  async function runSearch(query, expectNormId) {
    await page.evaluate(() => {
      const inp = document.getElementById('vade-home-search-input');
      if (!inp) return;
      inp.focus();
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 250));
    await page.evaluate(q => {
      const inp = document.getElementById('vade-home-search-input');
      inp.value = q;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }, query);
    await page.waitForFunction(() => {
      const r = document.getElementById('vade-home-search-results');
      return r && !r.classList.contains('hidden') && r.querySelector('.vade-home-search-result');
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 200));
    const hit = await page.evaluate(() => document.querySelector('#vade-home-search-results .vade-home-search-result')?.textContent.trim() || '');
    return await page.evaluate(normId => {
      const btn = document.querySelector(`#vade-home-search-results .vade-home-search-result[data-norm-id="${normId}"]`);
      if (btn) { btn.click(); return true; }
      return false;
    }, expectNormId).then(clicked => ({ hit, clicked }));
  }

  let r1 = await runSearch('CF', 'cf88');
  check(/Constituição|CF\b|CRFB/i.test(r1.hit), `Busca "CF" → CF (hit: "${r1.hit.slice(0,80)}")`);
  await page.waitForSelector('#legal-document .legal-unit', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT_DIR, '02-cf.png'), fullPage: false });

  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 10000 });

  let r2 = await runSearch('cc', 'cc2002');
  check(/C[oó]digo Civil/i.test(r2.hit), `Busca "cc" → CC (hit: "${r2.hit.slice(0,80)}")`);
  await page.waitForSelector('#legal-document .legal-unit', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT_DIR, '03-cc.png'), fullPage: false });

  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 10000 });

  let r3 = await runSearch('cpc 300', 'cpc2015');
  check(/Processo Civil|CPC/i.test(r3.hit), `Busca "cpc 300" → CPC (hit: "${r3.hit.slice(0,80)}")`);
  await page.waitForSelector('#legal-document [data-cp="art300"]', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));

  const art300 = await page.evaluate(() => {
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    return {
      title: art?.querySelector('.legal-unit-title')?.textContent?.trim() || '',
      textStart: art?.querySelector('.legal-unit-text')?.textContent?.trim().slice(0, 200) || '',
    };
  });
  check(/ART\.?\s*300/i.test(art300.title), `Art. 300 título: "${art300.title}"`);
  check(/tutela de urg/i.test(art300.textStart), `Art. 300 texto real: "${art300.textStart.slice(0,120)}..."`);
  await page.screenshot({ path: path.join(OUT_DIR, '04-cpc300.png'), fullPage: false });

  // === Verifica PNA ===
  const pnaErrors = consoleErrors.filter(e => /ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS|local address space/i.test(e));
  check(pnaErrors.length === 0, `PNA errors: ${pnaErrors.length}`, pnaErrors.join('\n'));

  // === Verifica que TODAS as chamadas /api/legal foram para api.kodice.nomosludens.ia.br ===
  const legalCalls = networkLog.filter(e => e.url && e.url.includes('/api/legal'));
  const mellonCalls = legalCalls.filter(e => /mellon\.taildb6c11/.test(e.url));
  const publicCalls = legalCalls.filter(e => /api\.kodice\.nomosludens\.ia\.br/.test(e.url));
  check(mellonCalls.length === 0, `Nenhuma chamada /api/legal para mellon.taildb6c11 (${mellonCalls.length} chamadas indevidas)`);
  check(publicCalls.length >= 3, `Chamadas para api.kodice.nomosludens.ia.br: ${publicCalls.length}`);

  // === Mobile ===
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 600));
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check(noOverflow, 'Mobile 390x844 sem overflow horizontal');
  await page.screenshot({ path: path.join(OUT_DIR, '05-mobile.png'), fullPage: false });

  fs.writeFileSync(path.join(OUT_DIR, 'evidence.json'), JSON.stringify({
    state, art300, r1, r2, r3, networkLog: networkLog.slice(-30), consoleErrors,
    pnaErrorsCount: pnaErrors.length,
    mellonCallsCount: mellonCalls.length,
    publicCallsCount: publicCalls.length,
  }, null, 2));

} catch (err) {
  console.error('Erro:', err);
  failed++;
} finally {
  await browser.close();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}