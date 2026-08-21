#!/usr/bin/env node
/**
 * scripts/smoke-visual.mjs
 * Smoke visual final contra o dev server local — verifica os 10 critérios
 * da missão (boot, favicon, identidade, jurídico, livro, mobile, dark/light).
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = process.env.URL || 'http://127.0.0.1:5273';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const results = {};
let pass = 0, fail = 0;
const check = (cond, name) => {
  if (cond) { console.log(`ok - ${name}`); pass++; results[name] = true; }
  else { console.error(`not ok - ${name}`); fail++; results[name] = false; }
};

async function visualCheck(page, viewport, label) {
  await page.setViewport(viewport);
  await page.evaluate(() => location.reload());
  await new Promise(r => setTimeout(r, 1500));

  // 1. Boot abre na home jurídica
  const homeVisible = await page.evaluate(() => !document.getElementById('vade-home').classList.contains('hidden'));
  check(homeVisible, `boot.vade_home_visible[${label}]`);

  // 2. Landing de upload oculta
  const landingHidden = await page.evaluate(() => document.getElementById('landing').classList.contains('hidden'));
  check(landingHidden, `boot.landing_hidden[${label}]`);

  // 3. Brand cristal no topo (sidebar)
  const hasKodiceLogo = await page.evaluate(() => !!document.querySelector('#sidebar .brand img[src*="kodice-logo"]'));
  check(hasKodiceLogo, `brand.sidebar_kodice_logo[${label}]`);

  // 4. Logo no hero da home jurídica
  const heroLogo = await page.evaluate(() => !!document.querySelector('#vade-home .vade-home-mark[src*="kodice-logo"]'));
  check(heroLogo, `brand.vade_home_hero_logo[${label}]`);

  // 5. Title contém "Kódice" + "Vade Mecum"
  const title = await page.title();
  check(/Kódice.*Vade Mecum/.test(title), `brand.title[${label}] "${title}"`);

  // 6. Manifest aponta para icon-512 oficial
  const manifestOk = await page.evaluate(async () => {
    try {
      const r = await fetch('/manifest.webmanifest');
      const m = await r.json();
      return Array.isArray(m.icons) && m.icons.some(i => i.src === '/icon-512.png');
    } catch { return false; }
  });
  check(manifestOk, `pwa.manifest_has_icon_512[${label}]`);

  // 7. Favicon aponta para o cristal
  const faviconOk = await page.evaluate(async () => {
    try {
      const r = await fetch('/icon-512.png');
      return r.ok && r.headers.get('content-type') === 'image/png';
    } catch { return false; }
  });
  check(faviconOk, `pwa.icon_512_serves_png[${label}]`);

  // 8. Sidebar tem "Vade Mecum" como item Jurídico
  const sidebarHasVade = await page.evaluate(() => {
    const item = document.querySelector('#sidebar .nav-btn[data-nav="legal"]');
    return !!item && /Vade Mecum/i.test(item.textContent);
  });
  check(sidebarHasVade, `nav.vade_mecum_in_sidebar[${label}]`);

  // 9. Sidebar tem "Biblioteca" como item secundário
  const sidebarHasLib = await page.evaluate(() => {
    const item = document.querySelector('#sidebar .nav-btn[data-nav="library"]');
    return !!item && /Biblioteca/i.test(item.textContent);
  });
  check(sidebarHasLib, `nav.library_in_sidebar[${label}]`);

  // 10. Sem overflow horizontal
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(noOverflow, `layout.no_horizontal_overflow[${label}]`);

  // 11. Search box existe na home jurídica
  const hasSearch = await page.evaluate(() => !!document.getElementById('vade-home-search-input'));
  check(hasSearch, `vade.search_input[${label}]`);

  // 12. Nenhum resíduo de "Biblioteca do Kódice" / "KÓDICE" na sidebar
  const cleanBrand = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar').textContent;
    return !/Biblioteca do Kódice/.test(sidebar);
  });
  check(cleanBrand, `clean.no_old_brand_text[${label}]`);

  // 13. CTA secundária "Abrir biblioteca" presente
  const ctaLib = await page.evaluate(() => !!document.getElementById('btn-vade-open-library'));
  check(ctaLib, `vade.cta_open_library[${label}]`);

  // 14. CTA secundária "Adicionar livro" presente
  const ctaAdd = await page.evaluate(() => !!document.getElementById('btn-vade-pick-file'));
  check(ctaAdd, `vade.cta_add_book[${label}]`);
}

const page = await browser.newPage();
page.on('pageerror', e => console.error('  [pageerror]', e.message));
await page.evaluateOnNewDocument(() => {
  window.KODICE_LEGAL_API_URL = 'http://127.0.0.1:5273/api/legal';
  window.KODICE_DISABLE_SW_RELOAD = true;
});
await page.goto(URL, { waitUntil: 'domcontentloaded' });

// Verifica light + dark em mobile e desktop
for (const theme of ['dark', 'light']) {
  await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
  for (const vp of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'mobile-320', width: 320, height: 720 },
  ]) {
    await visualCheck(page, vp, `${theme}.${vp.name}`);
  }
}

await browser.close();
console.log(`\n${pass + fail} checks: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
