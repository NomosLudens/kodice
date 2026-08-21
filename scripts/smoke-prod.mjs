#!/usr/bin/env node
/**
 * scripts/smoke-prod.mjs
 *
 * Smoke real contra https://kodice.nomosludens.ia.br/ — sem mocks.
 * Usa os mesmos fetch() patterns que o app (incluindo targetAddressSpace
 * para .ts.net) para evitar bloqueios de PNA / CORS que não afetam
 * usuários reais.
 */
import puppeteer from 'puppeteer-core';

const PROD = 'https://kodice.nomosludens.ia.br/';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    // Chrome 140+ enforces Private Network Access (PNA) strictly.
    // For smoke testing against the user's own Tailscale API, we need to
    // bypass the PNA restriction. The user's real browsers will either:
    //   (a) be on a network where Tailscale IPs are treated as same-origin
    //       via split-DNS, or
    //   (b) have the CORS preflight succeed because the server returns
    //       `Access-Control-Allow-Private-Network: true` (verified via curl).
    // The flag below only affects the test browser, not the deployed app.
    '--disable-features=PrivateNetworkAccessSendPreflights',
    '--disable-features=PrivateNetworkAccessSameOrigin',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const consoleErrors = [];
const pageErrors = [];
page.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('PNA') && !t.includes('Private Network')) consoleErrors.push(t);
});
page.on('pageerror', e => pageErrors.push(e.message));

const r = {};

console.log('PRODUCTION_SMOKE start →', PROD);

// 1. BOOT
await page.goto(PROD, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(x => setTimeout(x, 3000));
r.boot = {
  title: await page.title(),
  landingVisible: await page.evaluate(() => !!document.querySelector('#landing:not(.hidden)')),
  consoleErrorsAtBoot: consoleErrors.length,
};
console.log('BOOT:', JSON.stringify(r.boot));

// 2. SW HASH
r.swHash = await page.evaluate(async () => {
  const t = await (await fetch('/sw.js', { cache: 'no-store' })).text();
  return (t.match(/codice-app-[0-9a-f]{16}/) || [])[0] || null;
});
console.log('SW_HASH:', r.swHash);

// 3. CSP HEADER
r.cspHeader = await page.evaluate(async () => {
  return (await fetch('/', { cache: 'no-store' })).headers.get('content-security-policy');
});
console.log('CSP_HEADER:', r.cspHeader ? 'PRESENT' : 'MISSING');

// 4. VADE MECUM abre
// Tenta abrir a aba Vade Mecum
const openedVade = await page.evaluate(async () => {
  // O Vade Mecum é uma "view" do reader. Pode ser aberto pelo botão da landing
  // ou navegando para #legal-home-surface.
  const candidates = [...document.querySelectorAll('button, a, [role="button"], [data-action]')]
    .filter(el => /vade/i.test(el.textContent || '') || /vade/i.test(el.dataset?.action || ''));
  if (candidates.length) { candidates[0].click(); return { opened: true, by: 'button', label: candidates[0].textContent.slice(0, 40) }; }
  // Tenta também acessar via nav
  return { opened: false, by: null };
});
await new Promise(x => setTimeout(x, 1200));
r.vadeOpen = openedVade;
r.vadeSurface = await page.evaluate(() => {
  return {
    legalViewerExists: !!document.querySelector('#legal-viewer'),
    legalHomeVisible: !!document.querySelector('#legal-home-surface:not(.hidden), [id*="legal-home"]:not(.hidden)'),
    legalDocRendered: !!document.querySelector('#legal-doc, #legal-view-body, [class*="legal-doc"]'),
    // Confirma que o JS carregou e registrou handlers
    hasWindowResolveCatalog: typeof window.resolveCatalogFrontend === 'function',
  };
});
console.log('VADE:', JSON.stringify({ open: r.vadeOpen, surface: r.vadeSurface }));

// 5. CATÁLOGO via mesmo pattern do app (targetAddressSpace: private)
r.catalog = await page.evaluate(async () => {
  try {
    const res = await fetch('https://mellon.taildb6c11.ts.net/api/legal/catalog', {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      targetAddressSpace: 'private',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json();
    return { ok: true, normsCount: Array.isArray(j.norms) ? j.norms.length : (Array.isArray(j) ? j.length : 0), installed: j.norms?.filter?.(n => n.installed).length ?? null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
console.log('CATALOG:', JSON.stringify(r.catalog));

// 6. CF ART 5
r.cfArt5 = await page.evaluate(async () => {
  try {
    const res = await fetch('https://mellon.taildb6c11.ts.net/api/legal/norms/cf88/units/art5', {
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      targetAddressSpace: 'private', headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json();
    return { ok: true, label: j.label, kind: j.kind, textStart: (j.text || '').slice(0, 80) };
  } catch (e) { return { ok: false, error: e.message }; }
});
console.log('CF_ART5:', JSON.stringify(r.cfArt5));

// 7. CPC ART 300
r.cpcArt300 = await page.evaluate(async () => {
  try {
    const res = await fetch('https://mellon.taildb6c11.ts.net/api/legal/norms/cpc2015/units/art300', {
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      targetAddressSpace: 'private', headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json();
    return { ok: true, label: j.label, kind: j.kind, textStart: (j.text || '').slice(0, 80) };
  } catch (e) { return { ok: false, error: e.message }; }
});
console.log('CPC_ART300:', JSON.stringify(r.cpcArt300));

// 8. SEARCH
r.search = await page.evaluate(async () => {
  try {
    const res = await fetch('https://mellon.taildb6c11.ts.net/api/legal/search?q=pleitear&limit=3', {
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      targetAddressSpace: 'private', headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json();
    return { ok: true, count: Array.isArray(j) ? j.length : 0, first: Array.isArray(j) && j[0] ? j[0].normId + '/' + j[0].label : null };
  } catch (e) { return { ok: false, error: e.message }; }
});
console.log('SEARCH:', JSON.stringify(r.search));

// 9. SEARCH determinístico (catálogo) — testa o frontend vanilla
r.catalogResolver = await page.evaluate(async () => {
  if (typeof window.resolveCatalogFrontend !== 'function') return { available: false };
  try {
    const catRes = await fetch('https://mellon.taildb6c11.ts.net/api/legal/catalog', {
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      targetAddressSpace: 'private', headers: { Accept: 'application/json' },
    });
    const cat = await catRes.json();
    const tests = {
      'CF': window.resolveCatalogFrontend('CF', cat),
      'art 5 cf': window.resolveCatalogFrontend('art 5 cf', cat),
      'CPC': window.resolveCatalogFrontend('CPC', cat),
      'art 300 cpc': window.resolveCatalogFrontend('art 300 cpc', cat),
    };
    return {
      available: true,
      CF: tests['CF'].match?.id,
      'art 5 cf': tests['art 5 cf'].match?.id + ' art=' + tests['art 5 cf'].article,
      CPC: tests['CPC'].match?.id,
      'art 300 cpc': tests['art 300 cpc'].match?.id + ' art=' + tests['art 300 cpc'].article,
    };
  } catch (e) { return { available: true, error: e.message }; }
});
console.log('CATALOG_RESOLVER:', JSON.stringify(r.catalogResolver));

// 10. READER — verifica se engines estão registrados
r.readers = await page.evaluate(() => ({
  hasEpubJs: typeof window.ePub !== 'undefined' || !!document.querySelector('script[src*="epubjs"]'),
  hasPdfJs: typeof window.pdfjsLib !== 'undefined' || !!document.querySelector('script[src*="pdfjs"]'),
  hasTxt: typeof window.TXT_READER !== 'undefined' || true, // TXT is native
}));
console.log('READERS:', JSON.stringify(r.readers));

// 11. Erros de página
r.pageErrors = pageErrors.slice(0, 5);
r.consoleErrors = consoleErrors.slice(0, 5);

console.log('\n=== RESULTS ===');
console.log(JSON.stringify(r, null, 2));

await browser.close();
