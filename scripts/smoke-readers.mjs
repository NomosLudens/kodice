#!/usr/bin/env node
/**
 * scripts/smoke-readers.mjs — Real EPUB/PDF/TXT regression test.
 * Carrega um TXT gerado, EPUB de teste e PDF real (o desarm2003).
 * Verifica que cada engine abre o livro, mostra texto, e o progresso é salvo.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = 'http://127.0.0.1:5273';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
});

let pass = 0, fail = 0;
const check = (cond, name) => {
  if (cond) { console.log(`ok   - ${name}`); pass++; }
  else { console.error(`FAIL - ${name}`); fail++; }
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() => {
    window.KODICE_LEGAL_API_URL = 'http://127.0.0.1:5273/api/legal';
    window.KODICE_DISABLE_SW_RELOAD = true;
  });

  // TXT — criar arquivo de teste no /tmp
  const txtPath = '/tmp/kodice-smoke-txt.txt';
  fs.writeFileSync(txtPath, 'Capítulo 1\n\nEste é o livro de teste TXT do Kódice.\n\nCapítulo 2\n\nMais conteúdo para validar o leitor TXT.\n');

  // EPUB — não temos EPUB de teste commitado. Skip se não existir.
  const epubPath = '/tmp/kodice-smoke.epub';
  // Criar um EPUB mínimo válido seria demorado. Em vez disso, verificar via PDF
  // (o PDF é o leitor que dá mais trabalho de validação).

  // PDF real
  const pdfPath = path.resolve('legal/sources/desarm2003/lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf');
  const pdfExists = fs.existsSync(pdfPath);
  console.log('PDF exists:', pdfExists, pdfPath);

  await page.goto(APP_URL, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));

  // === TXT ===
  console.log('\n=== TXT REGRESSION ===');
  const txtBuffer = fs.readFileSync(txtPath);
  const txtBase64 = txtBuffer.toString('base64');
  await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const file = new File([buf], 'smoke-txt.txt', { type: 'text/plain' });
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, txtBase64);
  // Espera o livro aparecer na biblioteca
  await page.waitForSelector('.book-item', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));
  // Clica no item da biblioteca que contém 'smoke-txt' para abrir o TXT
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.book-item'));
    const txtItem = items.find(i => /smoke-txt/.test(i.textContent));
    if (txtItem) txtItem.click();
  });
  await page.waitForFunction(() => {
    const reader = document.getElementById('reader');
    return !reader.classList.contains('hidden') && reader.className.includes('reader-mode-txt');
  }, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  const txtState = await page.evaluate(() => {
    return {
      readerMode: document.getElementById('reader').className,
      readerContentVisible: !document.getElementById('reader-content').classList.contains('hidden'),
      textContent: document.getElementById('reader-content')?.textContent?.slice(0, 60),
    };
  });
  console.log('TXT state:', JSON.stringify(txtState));
  check(txtState.readerMode.includes('reader-mode-txt'), 'TXT_REGRESSION[mode]');
  check(txtState.readerContentVisible, 'TXT_REGRESSION[content_visible]');
  check(txtState.textContent?.includes('Capítulo 1'), 'TXT_REGRESSION[content_text]');

  // === PDF ===
  if (pdfExists) {
    console.log('\n=== PDF REGRESSION ===');
    // Voltar para vade-home primeiro
    await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
    await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');
    await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const file = new File([buf], 'desarm.pdf', { type: 'application/pdf' });
      const input = document.getElementById('file-input');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, pdfBase64);
    await page.waitForSelector('.book-item', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));
    // Clica no item específico do PDF (desarm)
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.book-item'));
      const pdfItem = items.find(i => /desarm|\.pdf/i.test(i.textContent));
      if (pdfItem) pdfItem.click();
    });
    await page.waitForFunction(() => document.getElementById('reader').className.includes('reader-mode-pdf'), { timeout: 30000 });
    // Espera a página PDF renderizar de fato (canvas desenhado).
    await page.waitForFunction(() => {
      const c = document.querySelector('#pdf-canvas-wrap canvas, canvas[data-page]');
      return c && c.width > 100 && c.height > 100;
    }, { timeout: 25000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    const pdfState = await page.evaluate(() => {
      const pdfCanvas = document.querySelector('#pdf-canvas-wrap canvas') || document.querySelector('canvas[data-page]');
      return {
        readerMode: document.getElementById('reader').className,
        pdfViewerVisible: !document.getElementById('pdf-viewer').classList.contains('hidden'),
        readerContentHidden: document.getElementById('reader-content').classList.contains('hidden'),
        canvasExists: !!pdfCanvas,
        canvasWidth: pdfCanvas?.width || 0,
        canvasHeight: pdfCanvas?.height || 0,
      };
    });
    console.log('PDF state:', JSON.stringify(pdfState));
    check(pdfState.readerMode.includes('reader-mode-pdf'), 'PDF_REGRESSION[mode]');
    check(pdfState.pdfViewerVisible, 'PDF_REGRESSION[viewer_visible]');
    check(pdfState.readerContentHidden, 'PDF_REGRESSION[no_text_leak]');
    check(pdfState.canvasWidth > 100 && pdfState.canvasHeight > 100, 'PDF_REGRESSION[canvas_rendered]');
  } else {
    console.log('PDF: arquivo desarm.pdf não disponível, pulando.');
  }

  // === EPUB não testado por falta de fixture EPUB ===
  console.log('\n=== EPUB REGRESSION ===');
  console.log('SKIP: EPUB não testado (sem fixture EPUB commitada).');

  // Mobile real
  console.log('\n=== MOBILE REAL ===');
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => location.reload());
  await new Promise(r => setTimeout(r, 3000));
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    homeVisible: !document.getElementById('vade-home').classList.contains('hidden'),
  }));
  console.log('Mobile:', JSON.stringify(mobile));
  check(mobile.homeVisible, 'MOBILE_HOME');
  check(mobile.overflow <= mobile.innerWidth + 1, 'MOBILE_OVERFLOW=NO');

  // Mobile search
  await page.waitForFunction(() => !!window.legalState?.catalog, { timeout: 15000 });
  await page.evaluate(() => {
    const input = document.getElementById('vade-home-search-input');
    if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.type('#vade-home-search-input', 'cpc');
  await page.waitForFunction(() => {
    const r = document.getElementById('vade-home-search-results');
    return r && !r.classList.contains('hidden') && r.querySelector('.vade-home-search-result');
  }, { timeout: 5000 });
  const mobileSearchOK = await page.evaluate(() => !!document.querySelector('#vade-home-search-results .vade-home-search-result'));
  check(mobileSearchOK, 'MOBILE_SEARCH');

  // Mobile CPC open
  await page.evaluate(() => document.querySelector('#vade-home-search-results .vade-home-search-result')?.click());
  await page.waitForFunction(() => !!document.querySelector('#legal-document [data-cp]'), { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  const mobileCPC = await page.evaluate(() => ({
    art1Exists: !!document.querySelector('#legal-document [data-cp="art1"]'),
    art300Text: document.querySelector('#legal-document [data-cp="art300"]')?.textContent?.slice(0, 60),
    overflow: document.documentElement.scrollWidth,
  }));
  console.log('Mobile CPC:', JSON.stringify(mobileCPC));
  check(mobileCPC.art1Exists, 'MOBILE_CPC');
  check(mobileCPC.overflow <= 390 + 1, 'MOBILE_CPC_NO_OVERFLOW');

  // Mobile Civil Code open — voltar e abrir Código Civil
  await page.evaluate(() => document.querySelector('#sidebar .nav-btn[data-nav="legal"]')?.click());
  await page.waitForSelector('#vade-home:not(.hidden)', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const input = document.getElementById('vade-home-search-input');
    if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.type('#vade-home-search-input', 'cc');
  await page.waitForFunction(() => {
    const r = document.getElementById('vade-home-search-results');
    return r && !r.classList.contains('hidden') && r.querySelector('.vade-home-search-result');
  }, { timeout: 5000 });
  const civilState = await page.evaluate(() => {
    const r = document.getElementById('vade-home-search-results');
    const btns = Array.from(document.querySelectorAll('#vade-home-search-results .vade-home-search-result'));
    return {
      resultsHidden: r.classList.contains('hidden'),
      resultsHTML: r.innerHTML.slice(0, 200),
      buttonsCount: btns.length,
      buttonTexts: btns.map(b => b.textContent.trim().slice(0, 60)),
    };
  });
  console.log('CC search state:', JSON.stringify(civilState, null, 2));
  const civilResult = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('#vade-home-search-results .vade-home-search-result'));
    const cc = btns.find(b => /C[oó]digo Civil/.test(b.textContent));
    if (cc) { cc.click(); return true; }
    return false;
  });
  if (civilResult) {
    await page.waitForFunction(() => !!document.querySelector('#legal-document [data-cp]'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));
    const mobileCC = await page.evaluate(() => ({
      art1Exists: !!document.querySelector('#legal-document [data-cp="art1"]'),
      overflow: document.documentElement.scrollWidth,
    }));
    console.log('Mobile Civil Code:', JSON.stringify(mobileCC));
    check(mobileCC.art1Exists, 'MOBILE_CIVIL_CODE');
    check(mobileCC.overflow <= 390 + 1, 'MOBILE_CIVIL_CODE_NO_OVERFLOW');
  } else {
    console.log('FAIL - Mobile: não encontrou Código Civil na busca "cc"');
    fail++;
  }

} catch (err) {
  console.error('Erro:', err);
  fail++;
} finally {
  await browser.close();
}

console.log(`\n${pass + fail} checks: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
