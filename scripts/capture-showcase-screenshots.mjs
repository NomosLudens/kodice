#!/usr/bin/env node
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createLegalApiHandler } from './legal-api-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.resolve(rootDir, 'docs/assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];
const chromePath = process.env.CHROME_PATH || CHROME_PATHS.find(p => fs.existsSync(p));
if (!chromePath) {
  console.error('Chrome executable not found. Cannot capture screenshots.');
  process.exit(1);
}

const legalDbPath = path.resolve(rootDir, 'legal.db');
const db = new DatabaseSync(legalDbPath);
const legalHandler = createLegalApiHandler(db);
const distDir = path.resolve(rootDir, 'dist');
const PORT = 5275;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/legal')) {
    return legalHandler(req, res);
  }
  let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) filePath = path.join(distDir, 'index.html');
  const ext = path.extname(filePath);
  const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.png' ? 'image/png' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}).listen(PORT, '127.0.0.1');

console.log('Capturando screenshots reais da vitrine Kódice...');

const browser = await puppeteer.launch({
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: 'new',
});

try {
  // 1. Desktop Vade Mecum Home
  const pageDesktop = await browser.newPage();
  await pageDesktop.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await pageDesktop.evaluateOnNewDocument((port) => {
    window.KODICE_LEGAL_API_URL = `http://127.0.0.1:${port}/api/legal`;
    window.KODICE_DISABLE_SW_RELOAD = true;
  }, PORT);

  await pageDesktop.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await pageDesktop.waitForSelector('#vade-home:not(.hidden)', { timeout: 10000 });
  await pageDesktop.waitForSelector('#vade-home-norms .vade-home-norm', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 600));

  await pageDesktop.screenshot({ path: path.join(assetsDir, 'kodice-desktop.png') });
  console.log('  ✓ docs/assets/kodice-desktop.png');

  // 2. Desktop Vade Mecum Reader (Art. 300 CPC)
  await pageDesktop.waitForFunction(() => !!window.legalState?.catalog, { timeout: 10000 });
  await pageDesktop.type('#vade-home-search-input', 'cpc 300');
  await pageDesktop.waitForFunction(() => {
    const results = document.getElementById('vade-home-search-results');
    return results && !results.classList.contains('hidden') && results.querySelector('.vade-home-search-result');
  }, { timeout: 5000 });

  await pageDesktop.evaluate(() => {
    document.querySelector('#vade-home-search-results .vade-home-search-result')?.click();
  });

  await pageDesktop.waitForFunction(() => {
    const art = document.querySelector('#legal-document [data-cp="art300"]');
    return !!(art && art.querySelector('.legal-unit-title'));
  }, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));

  await pageDesktop.screenshot({ path: path.join(assetsDir, 'kodice-vade-mecum.png') });
  console.log('  ✓ docs/assets/kodice-vade-mecum.png');
  await pageDesktop.close();

  // 3. Mobile View (390x844)
  const pageMobile = await browser.newPage();
  await pageMobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pageMobile.evaluateOnNewDocument((port) => {
    window.KODICE_LEGAL_API_URL = `http://127.0.0.1:${port}/api/legal`;
    window.KODICE_DISABLE_SW_RELOAD = true;
  }, PORT);

  await pageMobile.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await pageMobile.waitForSelector('#vade-home:not(.hidden)', { timeout: 10000 });
  await pageMobile.waitForSelector('#vade-home-norms .vade-home-norm', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 600));

  await pageMobile.screenshot({ path: path.join(assetsDir, 'kodice-mobile.png') });
  console.log('  ✓ docs/assets/kodice-mobile.png');
  await pageMobile.close();

} finally {
  await browser.close();
  server.close();
  db.close();
}

console.log('Screenshots capturados com sucesso em docs/assets/!');
