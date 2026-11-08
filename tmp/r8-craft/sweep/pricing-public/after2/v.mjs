import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const OUT = 'C:/Users/atish/Desktop/mockmob copy/wt-1108-craft/tmp/r8-craft/sweep/pricing-public/after2/';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/atish/.cache/puppeteer/chrome/win64-151.0.7922.71/chrome-win64/chrome.exe' });
const tops = (re, sel) => {
  const el = [...document.querySelectorAll(sel)].find(e => re.test(e.textContent) && ![...e.children].some(c => re.test(c.textContent)));
  if (!el) return null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, out = null;
  while ((n = walker.nextNode())) { const i = n.nodeValue.search(/31[\s\u00a0]July[\s\u00a0]2027/); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 12); out = { lines: new Set([...r.getClientRects()].map(x => Math.round(x.top))).size, nbsp: n.nodeValue.slice(i, i + 12).includes('\u00a0') }; break; } }
  return out;
};
try {
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [360, 640]]) for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    await ctx.addInitScript(t => { try { localStorage.setItem('mm:theme:v1', t); localStorage.setItem('mm:theme-hint:v1', '1'); } catch {} }, theme);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:3530/pricing', { waitUntil: 'networkidle', timeout: 120000 });
    // Open the cancel answer the way a visitor does: click its summary.
    const opened = await page.evaluate(() => {
      const d = [...document.querySelectorAll('details')].find(x => /What happens when I cancel/i.test(x.querySelector('summary')?.textContent || ''));
      if (!d) return false; d.querySelector('summary').scrollIntoView({ block: 'center' }); return true;
    });
    if (opened) await page.locator('summary', { hasText: /What happens when I cancel/i }).first().click();
    await page.waitForTimeout(900);
    const faq = await page.evaluate(`(${tops.toString()})(/stays active until/, 'p,dd,div,li,span')`);
    await page.evaluate(() => { const el = [...document.querySelectorAll('p,dd,div,li,span')].find(e => /stays active until/.test(e.textContent) && e.children.length === 0); el?.scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: OUT + `faq-open-${w}-${theme}.jpg`, type: 'jpeg', quality: 62 });
    let dock = null;
    if (w < 768) {
      await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(900);
      dock = await page.evaluate(`(${tops.toString()})(/once, through/, '.mm-dock *, [class*="dock"] *, [class*="Dock"] *')`);
      await page.screenshot({ path: OUT + `dock-${w}-${theme}.jpg`, type: 'jpeg', quality: 62 });
    }
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(w, theme, 'opened', opened, 'faq', JSON.stringify(faq), 'dock', JSON.stringify(dock), 'hscroll', hscroll);
    await ctx.close();
  }
} finally { await browser.close(); }
