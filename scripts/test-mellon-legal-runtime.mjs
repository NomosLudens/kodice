#!/usr/bin/env node
/**
 * test-mellon-legal-runtime.mjs
 *
 * Prova real de produto:
 *   - Abre o Kódice real servido de dist/
 *   - Sobrescreve window.KODICE_LEGAL_API_URL para apontar à Mellon
 *   - Verifica catálogo jurídico (61 normas)
 *   - Busca "CF" → abre CF/88
 *   - Busca "cc" → abre Código Civil
 *   - Busca "cpc 300" → abre Art. 300 do CPC com texto real
 *   - Captura screenshot de evidência
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:4173';
const LEGAL_API = process.env.LEGAL_API || 'https://mellon.taildb6c11.ts.net/api/legal';
const OUT_DIR = process.env.OUT_DIR || '/tmp/kodice-mellon-evidence';

let passed = 0, failed = 0;
const evidence = {};
function check(cond, name, ctx) {
  const ok = !!cond;
  if (ok) { console.log(`ok - ${name}`); passed++; }
  else { console.error(`not ok - ${name}` + (ctx ? `\n   ctx: ${ctx}` : '')); failed++; }
}

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];
const chromePath = process.env.CHROME_PATH || CHROME_PATHS.find(p => fs.existsSync(p));
if (!chromePath || !fs.existsSync(chromePath)) {
  console.error('No Chrome/Chromium found.');
  process.exit(2);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
         '--disable-dev-shm-usage', '--disable-web-security',
         '--disable-features=BlockInsecurePrivateNetworkRequests',
         '--disable-service-workers',
         '--ignore-certificate-errors'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', m => { if (m.type() === 'error') console.log('  [browser:error]', m.text()); });
  page.on('pageerror', err => console.error('  [pageerror]', err.message));

  // Override legal API URL → Mellon
  await page.evaluateOnNewDocument((url) => {
    window.KODICE_LEGAL_API_URL = url;
    window.KODICE_DISABLE_SW_RELOAD = true;
  }, LEGAL_API);

  // First fetch — sanity check from Node before browser
  const directHealth = await fetch(`${LEGAL_API}/health`).then(r => r.json()).catch(e => ({ error: String(e) }));
  evidence.directHealth = directHealth;
  check(directHealth.status === 'ok', 'Direct API health from Node → Mellon', JSON.stringify(directHealth));

  // Open app
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 10000 });
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 15000 });
  await page.waitForSelector('#vade-home-norms .vade-home-norm', { timeout: 10000 });

  const normCount = await page.evaluate(() => document.querySelectorAll('#vade-home-norms .vade-home-norm').length);
  evidence.normCount = normCount;
  check(normCount >= 50, `Catálogo jurídico carregado (${normCount} normas)`);

  const normTitles = await page.evaluate(() => Array.from(document.querySelectorAll('#vade-home-norms .vade-home-norm .vn-title')).map(e => e.textContent.trim()));
  evidence.normTitlesSample = normTitles.slice(0, 10);
  check(normTitles.some(t => /Constituição|CF\b/i.test(t)), 'CF presente no catálogo');
  check(normTitles.some(t => /C[oó]digo Civil/i.test(t)), 'CC presente no catálogo');
  check(normTitles.some(t => /Processo Civil|CPC/i.test(t)), 'CPC presente no catálogo');

  await page.screenshot({ path: path.join(OUT_DIR, '01-vade-home.png'), fullPage: true });

  // Helper: type query, click first result
  async function runSearch(query, expectRegex) {
    // Focus + clear via DOM
    await page.evaluate(() => {
      const inp = document.getElementById('vade-home-search-input');
      if (!inp) return;
      inp.focus();
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 250)); // wait for debounce + empty state
    // Set value programmatically + dispatch input to skip typing artefacts
    await page.evaluate((q) => {
      const inp = document.getElementById('vade-home-search-input');
      if (!inp) return;
      inp.value = q;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }, query);
    await page.waitForFunction(() => {
      const r = document.getElementById('vade-home-search-results');
      return r && !r.classList.contains('hidden') && r.querySelector('.vade-home-search-result');
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 200));
    const hit = await page.evaluate(() => document.querySelector('#vade-home-search-results .vade-home-search-result')?.textContent.trim() || '');
    const matched = expectRegex.test(hit);
    return { hit, matched };
  }

  async function clickResultByNormId(normId) {
    return await page.evaluate((id) => {
      const btn = document.querySelector(`#vade-home-search-results .vade-home-search-result[data-norm-id="${id}"]`);
      if (btn) { btn.click(); return true; }
      // fallback: first result
      document.querySelector('#vade-home-search-results .vade-home-search-result')?.click();
      return false;
    }, normId);
  }

  // BUSCA "CF"
  let r1 = await runSearch('CF', /Constituição|CF\b|CRFB/i);
  evidence.cfHit = r1.hit;
  check(r1.matched, `Busca "CF" resolveu para Constituição Federal (hit: "${r1.hit.slice(0,80)}")`);
  await clickResultByNormId('cf88');
  await page.waitForSelector('#legal-document .legal-unit', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT_DIR, '02-cf-open.png'), fullPage: false });

  // Voltar para home jurídica
  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 10000 });

  // BUSCA "cc"
  let r2 = await runSearch('cc', /C[oó]digo Civil/i);
  evidence.ccHit = r2.hit;
  check(r2.matched, `Busca "cc" resolveu para Código Civil (hit: "${r2.hit.slice(0,80)}")`);
  await clickResultByNormId('cc2002');
  await page.waitForSelector('#legal-document .legal-unit', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT_DIR, '03-cc-open.png'), fullPage: false });

  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 10000 });

  // BUSCA "cpc 300"
  let r3 = await runSearch('cpc 300', /Processo Civil|CPC/i);
  evidence.cpcHit = r3.hit;
  check(r3.matched, `Busca "cpc 300" resolveu (hit: "${r3.hit.slice(0,80)}")`);
  await clickResultByNormId('cpc2015');
  await page.waitForSelector('#legal-document [data-cp="art300"]', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));

  const article300 = await page.evaluate(() => {
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    return {
      title: art?.querySelector('.legal-unit-title')?.textContent?.trim() || '',
      textStart: art?.querySelector('.legal-unit-text')?.textContent?.trim().slice(0, 200) || '',
    };
  });
  evidence.article300 = article300;
  check(/ART\.?\s*300/i.test(article300.title), `Art. 300 título: "${article300.title}"`);
  check(/tutela de urg/i.test(article300.textStart), `Art. 300 texto real: "${article300.textStart.slice(0, 120)}..."`);
  await page.screenshot({ path: path.join(OUT_DIR, '04-cpc-art300.png'), fullPage: false });

  // Confirma que resposta veio da Mellon — checa via window
  const apiOriginUsed = await page.evaluate(() => window.legalState?.lastApiOrigin || null);
  evidence.apiOriginUsed = apiOriginUsed;

  fs.writeFileSync(path.join(OUT_DIR, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(`\nEvidence dir: ${OUT_DIR}`);

  // Mobile smoke (390x844) — sem overflow horizontal
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 300));
  const mobileOk = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  evidence.mobileOk = mobileOk;
  check(mobileOk, 'Mobile 390x844 sem overflow horizontal');
  await page.screenshot({ path: path.join(OUT_DIR, '05-mobile-home.png'), fullPage: false });

  // Re-write evidence with mobileOk
  fs.writeFileSync(path.join(OUT_DIR, 'evidence.json'), JSON.stringify(evidence, null, 2));

} catch (err) {
  console.error('Erro na execução:', err);
  failed++;
} finally {
  await browser.close();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
