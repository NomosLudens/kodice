#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const CHROME_PATH = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const TEST_WEB_PORT = process.env.VITE_PORT || 5199;

console.log('=== TESTE DE NAVEGADOR REAL NO AMBIENTE DEV (DEV:FULL) ===\n');

// 1. Iniciar bun run dev:full na porta configurada
console.log(`Iniciando dev:full na porta ${TEST_WEB_PORT}...`);
const devProcess = spawn('bun', ['run', 'dev:full'], {
  cwd: rootDir,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    VITE_PORT: String(TEST_WEB_PORT),
  },
});

devProcess.stdout.on('data', (d) => process.stdout.write(`[dev:out] ${d}`));
devProcess.stderr.on('data', (d) => process.stderr.write(`[dev:err] ${d}`));

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return true;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout aguardando ${url}`);
}

await waitForHttp('http://127.0.0.1:4520/health');
console.log('\n  ✓ API jurídica pronta em http://127.0.0.1:4520/health');

await waitForHttp(`http://localhost:${TEST_WEB_PORT}/`);
console.log(`  ✓ Frontend Vite pronto em http://localhost:${TEST_WEB_PORT}/`);

// 2. Iniciar Puppeteer e capturar requisições de rede
const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: 'new',
});

const requests = [];
let reqProdApi = 0;
let reqTsNet = 0;
let reqSupabase = 0;
let reqLocalApi = 0;

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

page.on('request', (req) => {
  const url = req.url();
  requests.push(url);
  if (url.includes('api.kodice.nomosludens.ia.br')) reqProdApi++;
  if (url.includes('.ts.net')) reqTsNet++;
  if (url.includes('supabase.co')) reqSupabase++;
  if (url.includes('127.0.0.1:4520') || url.includes('/api/legal')) reqLocalApi++;
});

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [browser:err]', msg.text());
});

const results = {};

async function searchInput(query) {
  await page.evaluate(() => {
    const inp = document.getElementById('vade-home-search-input');
    if (inp) {
      inp.focus();
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const r = document.getElementById('vade-home-search-results');
    if (r) {
      r.classList.add('hidden');
      r.innerHTML = '';
    }
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate((q) => {
    const inp = document.getElementById('vade-home-search-input');
    if (inp) {
      inp.value = q;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, query);
  await page.waitForFunction(() => {
    const r = document.getElementById('vade-home-search-results');
    return r && !r.classList.contains('hidden') && r.querySelector('.vade-home-search-result');
  }, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 200));
}

try {
  // A. Abertura do app (HOME)
  await page.goto(`http://localhost:${TEST_WEB_PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 10000 });
  const homeVisible = await page.evaluate(() => {
    const h = document.getElementById('vade-home');
    return !!(h && !h.classList.contains('hidden'));
  });
  results['HOME'] = homeVisible ? 'PASS' : 'FAIL';
  console.log(`HOME: ${results['HOME']}`);

  // B. Vade Mecum: carregar catálogo de 61 normas
  await page.waitForSelector('#vade-home-norms .vade-home-norm', { timeout: 15000 });
  const normCount = await page.evaluate(() => {
    return document.querySelectorAll('#vade-home-norms .vade-home-norm').length;
  });
  results['VADE_MECUM'] = normCount >= 60 ? 'PASS' : 'FAIL';
  console.log(`VADE_MECUM: ${results['VADE_MECUM']} (${normCount} normas)`);

  // C. Busca CPC 300 e abertura no leitor
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 10000 });
  await searchInput('cpc 300');

  await page.evaluate(() => {
    document.querySelector('#vade-home-search-results .vade-home-search-result')?.click();
  });

  await page.waitForFunction(() => {
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    return !!(art && (art.querySelector('.legal-unit-title') || art.querySelector('.legal-unit-text') || art.textContent.includes('tutela de urgência')));
  }, { timeout: 30000 });

  const cpcText = await page.evaluate(() => {
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    return art ? art.textContent : '';
  });
  results['CPC_ART300'] = cpcText.includes('tutela de urgência') ? 'PASS' : 'FAIL';
  console.log(`CPC_ART300: ${results['CPC_ART300']}`);

  // Voltar para a home jurídica
  await page.click('#btn-legal-back');
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 10000 });

  // D. Busca CF Art. 5 e abertura
  await searchInput('cf 5');

  await page.evaluate(() => {
    document.querySelector('#vade-home-search-results .vade-home-search-result')?.click();
  });
  await page.waitForFunction(() => {
    const art = document.querySelector('#legal-document [data-cp="art5"]');
    return !!(art && (art.querySelector('.legal-unit-title') || art.querySelector('.legal-unit-text') || art.textContent.includes('Todos são iguais')));
  }, { timeout: 30000 });

  const cfText = await page.evaluate(() => {
    const art = document.querySelector('#legal-document [data-cp="art5"]');
    return art ? art.textContent : '';
  });
  results['CF_ART5'] = cfText.includes('Todos são iguais perante a lei') ? 'PASS' : 'FAIL';
  console.log(`CF_ART5: ${results['CF_ART5']}`);

  // Voltar para a home jurídica
  await page.click('#btn-legal-back');
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 10000 });

  // E. Busca ACP (Ação Civil Pública - acp1985)
  await searchInput('acp 1');
  const acpHit = await page.evaluate(() => {
    return document.querySelector('#vade-home-search-results .vade-home-search-result')?.textContent || '';
  });
  results['ACP_SEARCH'] = /ACP|Ação Civil Pública/i.test(acpHit) ? 'PASS' : 'FAIL';
  console.log(`ACP_SEARCH: ${results['ACP_SEARCH']}`);

  // F. PWA: Manifest presente e Service Worker API ativa
  const pwaMeta = await page.evaluate(() => {
    const manifest = document.querySelector('link[rel="manifest"]')?.href;
    const hasSW = 'serviceWorker' in navigator;
    return { manifest: !!manifest, hasSW };
  });
  results['PWA'] = (pwaMeta.manifest && pwaMeta.hasSW) ? 'PASS' : 'FAIL';
  console.log(`PWA: ${results['PWA']}`);

  // G. Mobile 390x844: Teste de viewport sem overflow
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await new Promise((r) => setTimeout(r, 600));
  const mobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  results['MOBILE_390x844'] = !mobileOverflow ? 'PASS' : 'FAIL';
  console.log(`MOBILE_390x844: ${results['MOBILE_390x844']}`);

} finally {
  await browser.close();
  devProcess.kill('SIGTERM');
}

console.log('\n=== RESULTADOS DOS TESTES DE BROWSER REAL ===');
for (const [k, v] of Object.entries(results)) {
  console.log(`${k}=${v}`);
}

console.log('\n=== AUDITORIA DE REQUISIÇÕES DE REDE (BROWSER) ===');
console.log(`TOTAL_REQUESTS=${requests.length}`);
console.log(`REQUESTS_TO_PRODUCTION_API=${reqProdApi}`);
console.log(`REQUESTS_TO_TS_NET=${reqTsNet}`);
console.log(`REQUESTS_TO_SUPABASE=${reqSupabase}`);
console.log(`REQUESTS_TO_LOCAL_API=${reqLocalApi}`);

const allPass = Object.values(results).every(v => v === 'PASS') &&
                reqProdApi === 0 &&
                reqTsNet === 0 &&
                reqSupabase === 0 &&
                reqLocalApi > 0;

console.log(`\nVEREDICTO_BROWSER_REAL=${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
