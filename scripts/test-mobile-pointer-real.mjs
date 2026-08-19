import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));

// Acha elementos críticos de touch no reader (injetados em tempo de execução)
const checks = await page.evaluate(() => {
  const nav = document.querySelector('#reader-inline-nav');
  const navStyle = nav ? getComputedStyle(nav) : null;
  const btnStyle = nav?.querySelector('button') ? getComputedStyle(nav.querySelector('button')) : null;
  const topbar = document.querySelector('#topbar');
  const topbarStyle = topbar ? getComputedStyle(topbar) : null;
  // Confirma que não há CSS inválido
  return {
    navPointerEvents: navStyle?.pointerEvents,
    navBtnPointerEvents: btnStyle?.pointerEvents,
    topbarPointerEvents: topbarStyle?.pointerEvents,
  };
});

console.log('CSS efetivo em mobile:');
console.log('  #reader-inline-nav pointer-events:', checks.navPointerEvents);
console.log('  #reader-inline-nav button pointer-events:', checks.navBtnPointerEvents);
console.log('  #topbar pointer-events:', checks.topbarPointerEvents);

let pass = true;
if (!checks.navPointerEvents || !checks.navBtnPointerEvents) pass = false;
if (checks.navPointerEvents === 'none' && checks.navBtnPointerEvents !== 'auto') pass = false;

console.log(pass ? 'PASS — pointer-events válidos' : 'FAIL — pointer-events inconsistente');
await browser.close();
process.exit(pass ? 0 : 1);
