// Desktop: does a button move when it is clicked? Real mouse, every frame's box. node tmp/1126-final/jump.mjs [url]
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
const targets = [
  ['stream tab', '.lp-cq__stream >> nth=2'],
  ['subject chip', '.lp-cq__subject >> nth=2'],
  ['one-place tab', '#your-prep [role="tab"] >> nth=1'],
  ['one-place tab 3', '#your-prep [role="tab"] >> nth=2'],
  ['lab rail', '#inside-the-lab .lc__rail button >> nth=2'],
  ['compass category', '#compass [aria-pressed="false"] >> nth=0'],
  ['compass round', '#compass [aria-pressed="false"] >> nth=4'],
  ['compass preset', '#compass button:has-text("800")'],
  ['pricing count 2', '#pricing button:has-text("2") >> nth=0'],
  ['pricing count 4', '#pricing button:has-text("4") >> nth=0'],
  ['pricing opener', '#pricing summary >> nth=0'],
  ['exam option', '#your-prep button >> nth=6'],
];
for (const [label, sel] of targets) {
  const loc = page.locator(sel).first();
  if (!(await loc.count())) { console.log(label.padEnd(18), 'not found'); continue; }
  await loc.evaluate((el) => { const r = el.getBoundingClientRect(); window.scrollBy({ top: r.top - innerHeight * 0.45, behavior: 'instant' }); });
  await w(1500);
  const b = await loc.boundingBox();
  const cx = b.x + b.width * 0.5, cy = b.y + b.height * 0.5;
  await page.mouse.move(cx - 260, cy - 120); await w(300);
  await page.mouse.move(cx + b.width * 0.22, cy + b.height * 0.18, { steps: 18 }); await w(900);
  await loc.evaluate((el) => {
    window.__s = []; const t0 = performance.now();
    const tick = () => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); window.__s.push([Math.round(performance.now() - t0), +r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), cs.translate, cs.transform === 'none' ? '' : cs.transform, cs.scale]); if (performance.now() - t0 < 1400) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await w(200);
  await page.mouse.down(); await w(90); await page.mouse.up();
  await w(1400);
  const s = await page.evaluate(() => window.__s);
  const xs = s.map((r) => r[1]), ys = s.map((r) => r[2]);
  const dx = Math.max(...xs) - Math.min(...xs), dy = Math.max(...ys) - Math.min(...ys);
  // the frames where the box changed by more than 0.6 px from the frame before
  const jumps = []; for (let i = 1; i < s.length; i += 1) { const d = Math.hypot(s[i][1] - s[i - 1][1], s[i][2] - s[i - 1][2]); if (d > 0.6) jumps.push(`${s[i][0]}ms ${d.toFixed(1)}px (translate ${s[i][4]}; transform ${s[i][5].slice(0, 40)})`); }
  console.log(label.padEnd(18), `moved x ${dx.toFixed(1)} y ${dy.toFixed(1)} px over the click;`, jumps.length ? jumps.slice(0, 6).join(' | ') : 'no frame-to-frame jump');
  await page.mouse.move(40, 300); await w(300);
  if (page.url() !== url) { await page.goto(url, { waitUntil: 'load' }); await w(6000); }
}
await browser.close();
