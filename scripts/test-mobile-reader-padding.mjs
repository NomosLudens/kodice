#!/usr/bin/env node
/**
 * test-mobile-reader-padding.mjs
 *
 * Valida que a área de leitura do reader jurídico no mobile aproveita
 * melhor a altura vertical após o ajuste de padding-bottom.
 *
 * Compara:
 *  - altura visível do reader
 *  - primeiro unit visível acima do fold
 *  - ausência de overflow horizontal
 *  - sem regressão no desktop
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://kodice.nomosludens.ia.br';
const OUT_DIR = '/tmp/kodice-mobile-padding-evidence';
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
         '--disable-dev-shm-usage', '--disable-features=BlockInsecurePrivateNetworkRequests,SpeculationRules',
         '--ignore-certificate-errors'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      if (url && url.includes('/cdn-cgi/speculation')) {
        return Promise.resolve(new Response('', { status: 204 }));
      }
      return origFetch.apply(this, arguments);
    };
  });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 45000 });
  await page.waitForFunction(() => !!document.getElementById('vade-home-search-input'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1500));

  // Open a norm to enter the reader
  await page.evaluate(q => {
    const inp = document.getElementById('vade-home-search-input');
    if (!inp) throw new Error('search input missing');
    inp.focus(); inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, 'CF');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(q => {
    const inp = document.getElementById('vade-home-search-input');
    inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, 'CF');
  await page.waitForFunction(() => {
    const r = document.getElementById('vade-home-search-results');
    return r && !r.classList.contains('hidden') && r.querySelector('.vade-home-search-result');
  }, { timeout: 10000 });
  await page.evaluate(() => document.querySelector('#vade-home-search-results .vade-home-search-result[data-norm-id="cf88"]')?.click());
  await page.waitForSelector('#legal-document .legal-unit', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));

  // Measure reader layout on mobile
  const mobile = await page.evaluate(() => {
    const viewer = document.getElementById('legal-viewer');
    const r = viewer.getBoundingClientRect();
    const cs = window.getComputedStyle(viewer);
    const docEl = document.getElementById('legal-document');
    const docRect = docEl.getBoundingClientRect();
    const firstUnit = document.querySelector('#legal-document .legal-unit');
    const firstRect = firstUnit ? firstUnit.getBoundingClientRect() : null;
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const safeBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')) || 0;
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      viewerTop: r.top,
      viewerHeight: r.height,
      viewerVisibleH: r.height, // no header offset needed; reader fills the surface
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      docTop: docRect.top,
      docBottom: docRect.bottom,
      docHeight: docRect.height,
      firstUnitTop: firstRect ? firstRect.top : null,
      firstUnitText: firstUnit?.querySelector('.legal-unit-text')?.textContent?.slice(0, 60) || null,
      overflowX: overflow,
      safeBottom,
    };
  });

  console.log('=== MOBILE LAYOUT (390x844) ===');
  console.log(JSON.stringify(mobile, null, 2));

  // 1. Reading area must use height better — bottom padding ≤ 24px (was 96px).
  const padBottomPx = parseFloat(mobile.paddingBottom);
  check(padBottomPx <= 24, `Mobile padding-bottom do reader: ${padBottomPx}px (era 96px)`);

  // 2. Top padding trimmed (12px vs 24px original).
  const padTopPx = parseFloat(mobile.paddingTop);
  check(padTopPx <= 16, `Mobile padding-top do reader: ${padTopPx}px (era 24px)`);

  // 3. First unit visible acima do fold (reader deve mostrar conteúdo desde o topo).
  const firstUnitAboveFold = mobile.firstUnitTop !== null && mobile.firstUnitTop < mobile.vh * 0.5;
  check(firstUnitAboveFold, `Primeiro unit visível acima do meio da tela (top=${mobile.firstUnitTop}px)`);

  // 4. Sem overflow horizontal.
  check(mobile.overflowX <= 0, `Sem overflow horizontal (overflow=${mobile.overflowX}px)`);

  // 5. Sem regressão: o reader continua ocupando a altura disponível.
  // viewerHeight ≈ vh (full surface)
  check(mobile.viewerHeight >= mobile.vh * 0.95, `Reader ocupa ≥95% da viewport (${mobile.viewerHeight}px vs vh=${mobile.vh}px)`);

  await page.screenshot({ path: path.join(OUT_DIR, 'mobile-reader.png'), fullPage: false });

  // === DESKTOP regression check ===
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => document.querySelector('#vade-home-search-results .vade-home-search-result[data-norm-id="cf88"]')?.click());
  await page.waitForSelector('#legal-document .legal-unit', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 500));

  const desktop = await page.evaluate(() => {
    const viewer = document.getElementById('legal-viewer');
    const cs = window.getComputedStyle(viewer);
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      viewerHeight: viewer.getBoundingClientRect().height,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      overflowX: overflow,
    };
  });

  console.log('=== DESKTOP LAYOUT (1280x800) ===');
  console.log(JSON.stringify(desktop, null, 2));

  // Desktop padding must NOT have changed (96px bottom kept).
  check(parseFloat(desktop.paddingBottom) === 96, `Desktop padding-bottom preservado: ${desktop.paddingBottom}px (era 96px)`);
  check(parseFloat(desktop.paddingTop) === 40, `Desktop padding-top preservado: ${desktop.paddingTop}px (era 40px)`);
  check(desktop.overflowX <= 0, `Desktop sem overflow horizontal (overflow=${desktop.overflowX}px)`);

  await page.screenshot({ path: path.join(OUT_DIR, 'desktop-reader.png'), fullPage: false });

  fs.writeFileSync(path.join(OUT_DIR, 'evidence.json'), JSON.stringify({ mobile, desktop }, null, 2));

} catch (err) {
  console.error('Erro:', err);
  failed++;
} finally {
  await browser.close();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}