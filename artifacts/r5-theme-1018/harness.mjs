// Isolated switch frames: renders the real switch markup with a given marketing-theme.css, presses it with the
// pointer, freezes every transition and steps through time. Usage: node harness.mjs <label> <css> <markup:svg|plain> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [label, cssFile, markup, outRoot] = process.argv.slice(2);
const out = path.join(outRoot, `iso-${label}`);
fs.mkdirSync(out, { recursive: true });
const css = fs.readFileSync(cssFile, 'utf8');
const glyphs = markup === 'svg'
  ? `<svg class="mm-theme-toggle__sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.35 5.35l1.85 1.85M16.8 16.8l1.85 1.85M5.35 18.65l1.85-1.85M16.8 7.2l1.85-1.85"/></svg><svg class="mm-theme-toggle__moon" viewBox="0 0 24 24"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z"/></svg>`
  : '';
const html = (theme) => `<!doctype html><html data-theme="${theme}"><head><style>${css}
html,body{margin:0;height:100%} html[data-theme='light'] body{background:#f4f5f0} html[data-theme='dark'] body{background:#0b100e}
.stage{display:grid;place-items:center;height:100%}</style></head><body><div class="stage"><button type="button" class="mm-theme-toggle" role="switch" aria-label="Dark mode"><span class="mm-theme-toggle__sky"><i class="mm-theme-toggle__star"></i><i class="mm-theme-toggle__star"></i><i class="mm-theme-toggle__star"></i><span class="mm-theme-toggle__thumb">${glyphs}</span></span></button></div>
<script>document.querySelector('button').addEventListener('click',()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';});</script></body></html>`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-theme-iso-'));
const ctx = await chromium.launchPersistentContext(profile, {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, viewport: { width: 120, height: 70 }, deviceScaleFactor: 6,
});
const STEPS = [0, 30, 60, 90, 120, 160, 200, 250, 300, 350, 400, 450, 500, 560, 640, 760];
const sheets = [];
for (const theme of ['light', 'dark']) {
  const page = await ctx.newPage();
  await page.setContent(html(theme));
  await page.waitForTimeout(300);
  const box = await page.locator('button').boundingBox();
  const clip = { x: box.x, y: box.y + 4, width: box.width, height: box.height - 8 };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.evaluate(() => { for (const a of document.getAnimations()) a.pause(); });
  const frames = [];
  for (const ms of STEPS) {
    await page.evaluate((t) => new Promise((done) => {
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
      requestAnimationFrame(() => requestAnimationFrame(done));
    }), ms);
    const buf = await page.screenshot({ clip });
    frames.push({ ms, b64: buf.toString('base64') });
  }
  const animated = await page.evaluate(() => [...new Set(document.getAnimations().map((a) => `${a.effect?.target?.className || ''}:${a.transitionProperty || a.animationName}`))]);
  sheets.push({ from: theme, frames, animated });
  await page.close();
}
const page = await ctx.newPage();
await page.setViewportSize({ width: 1500, height: 300 });
const rows = sheets.map((s) => `<h3>${label}: ${s.from === 'light' ? 'Day to Night' : 'Night to Day'}</h3><div class="row">${s.frames.map((f) => `<figure><img src="data:image/png;base64,${f.b64}"><figcaption>${f.ms} ms</figcaption></figure>`).join('')}</div>`).join('');
await page.setContent(`<html><body style="margin:0;padding:10px;background:#9a9a9a;font:12px system-ui"><style>h3{margin:6px 0}.row{display:flex;flex-wrap:wrap;gap:4px}figure{margin:0;text-align:center;background:#fff;padding:3px}img{width:84px;display:block}</style>${rows}</body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, `SHEET-iso-${label}.png`), fullPage: true });
fs.writeFileSync(path.join(out, 'animated.json'), JSON.stringify(sheets.map((s) => ({ from: s.from, animated: s.animated })), null, 1));
await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
console.log(JSON.stringify(sheets.map((s) => ({ from: s.from, animated: s.animated }))));
