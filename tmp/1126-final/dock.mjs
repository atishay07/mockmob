import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: 'C:/Users/atish/.cache/puppeteer/chrome/win64-151.0.7922.71/chrome-win64/chrome.exe', headless: true, args: ['--headless=new'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true })).newPage();
await page.goto(process.argv[2] || 'http://localhost:3571/', { waitUntil: 'load' }); await w(8000);
for (const sel of ['.dwk-key', '#compass .mm-btn--primary', '#pricing .mm-btn--primary', '.lp-close .mm-btn--primary', '#faq summary', '#cuet-2026 .lp-cq__strip']) {
  const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); window.scrollBy({ top: r.top - innerHeight * 0.5, behavior: 'instant' }); return true; }, sel);
  await w(1400);
  console.log(sel.padEnd(34), ok ? await page.evaluate(() => { const g = document.querySelector('.lp-dockgate'); const d = g && g.firstElementChild; return `gate shown=${g ? g.dataset.shown : '?'} dock rect top=${d ? Math.round(d.getBoundingClientRect().top) : '?'} opacity=${d ? getComputedStyle(d).opacity : '?'} gateOpacity=${g ? getComputedStyle(g).opacity : '?'} transform=${g ? getComputedStyle(g).transform : '?'}`; }) : 'missing');
}
await browser.close();
