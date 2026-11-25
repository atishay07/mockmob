// The landing as a visitor meets it: every section's place and height at phone and desktop size, and the phone page as
// screen-sized pictures. node tmp/1126-final/audit.mjs [url] [outdir]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const url = process.argv[2] || 'http://localhost:3571/';
const out = process.argv[3] || 'tmp/1126-final/audit';
mkdirSync(out, { recursive: true });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: 'C:/Users/atish/.cache/puppeteer/chrome/win64-151.0.7922.71/chrome-win64/chrome.exe', headless: true, args: ['--headless=new'] });
const inventory = {};
for (const [name, width, height] of [['phone', 390, 760], ['desktop', 1440, 900]]) {
  const phone = width < 800;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await w(8000);
  // Walk the page once so every lazy section is drawn, then measure.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total + 2000; y += height * 0.8) { await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y); await w(350); }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await w(1200);
  inventory[name] = await page.evaluate(() => {
    const main = document.getElementById('main-content');
    const rows = [];
    for (const el of main.children) {
      const r = el.getBoundingClientRect();
      if (r.height < 4) continue;
      const h = el.querySelector('h1, h2');
      rows.push({ tag: el.tagName.toLowerCase(), id: el.id || null, cls: (el.className || '').toString().split(' ').slice(0, 3).join(' '), top: Math.round(r.top + scrollY), height: Math.round(r.height), heading: h ? h.innerText.replace(/\s+/g, ' ').slice(0, 70) : null, words: el.innerText.split(/\s+/).filter(Boolean).length, buttons: el.querySelectorAll('a.mm-btn, button.mm-btn, a.dwk-key').length });
    }
    return { pageHeight: document.documentElement.scrollHeight, viewport: innerHeight, rows };
  });
  if (phone) {
    const full = inventory[name].pageHeight;
    let i = 0;
    for (let y = 0; y < full; y += height - 110) {
      await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y); await w(900);
      await page.screenshot({ path: `${out}/phone-${String(i).padStart(2, '0')}.png` });
      i += 1;
    }
    inventory[name].screens = i;
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/inventory.json`, JSON.stringify(inventory, null, 1));
for (const name of ['phone', 'desktop']) {
  const inv = inventory[name];
  console.log(`\n${name}: page ${inv.pageHeight} px = ${(inv.pageHeight / inv.viewport).toFixed(1)} screens`);
  for (const r of inv.rows) console.log(`${String(r.height).padStart(5)} px ${(r.height / inv.viewport).toFixed(1).padStart(4)} scr  ${String(r.words).padStart(4)} words  ${(r.id || r.cls || r.tag).padEnd(22)} ${r.heading || ''}`);
}
