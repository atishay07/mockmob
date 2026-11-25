// Desktop: the Mistake Lab held in the window; click each rail key and record the key's own box every frame.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const url = process.argv[2] || 'http://localhost:3571/';
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: 'C:/Users/atish/.cache/puppeteer/chrome/win64-151.0.7922.71/chrome-win64/chrome.exe', headless: true, args: ['--headless=new'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load' });
await w(8000);
await page.evaluate(() => { const t = document.querySelector('#inside-the-lab .ss__track'); window.scrollTo({ top: scrollY + t.getBoundingClientRect().top + 40, behavior: 'instant' }); });
await w(2500);
const keys = page.locator('#inside-the-lab .lc__rail button');
const n = await keys.count();
console.log('rail keys', n, 'scrollY', await page.evaluate(() => Math.round(scrollY)));
for (const i of [1, 3, 0, 4, 2]) {
  const loc = keys.nth(i);
  const b = await loc.boundingBox();
  if (!b) { console.log(i, 'no box'); continue; }
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.mouse.move(cx - 200, cy + 150); await w(200);
  await page.mouse.move(cx + 6, cy + 4, { steps: 14 }); await w(700);
  await loc.evaluate((el) => {
    window.__s = []; const t0 = performance.now(); const stage = el.closest('.ss__stage');
    const tick = () => { const r = el.getBoundingClientRect(); window.__s.push([Math.round(performance.now() - t0), +r.left.toFixed(1), +r.top.toFixed(1), Math.round(scrollY), stage ? stage.getAttribute('data-lean') : null, stage ? stage.style.transform : '', getComputedStyle(el).translate]); if (performance.now() - t0 < 1500) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await w(150);
  await page.mouse.down(); await w(80); await page.mouse.up();
  await w(1500);
  const s = await page.evaluate(() => window.__s);
  const ys = s.map((r) => r[2]); const xs = s.map((r) => r[1]);
  const moved = []; for (let k = 1; k < s.length; k += 1) { const d = Math.hypot(s[k][1] - s[k - 1][1], s[k][2] - s[k - 1][2]); if (d > 0.5) moved.push(`${s[k][0]}ms dy ${(s[k][2] - s[k - 1][2]).toFixed(1)} dx ${(s[k][1] - s[k - 1][1]).toFixed(1)} lean=${s[k][4]} tf=${(s[k][5] || '').slice(0, 34)} tr=${s[k][6]}`); }
  console.log(`key ${i}: y range ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)} x range ${(Math.max(...xs) - Math.min(...xs)).toFixed(1)}; scroll ${s[0][3]} -> ${s[s.length - 1][3]};`, moved.length ? moved.slice(0, 5).join(' | ') : 'still');
}
await browser.close();
