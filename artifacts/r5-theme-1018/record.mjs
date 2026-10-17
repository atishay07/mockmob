// Records the theme switch: slowed frames of the toggle and of the page reveal, a real-speed fps/CLS run,
// and static captures, at 390x844 and 1440x900 from Day and from Night. Usage: node record.mjs <label> <outDir> [path]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const [label = 'run', outRoot = '.', route = '/'] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:3392';
const out = path.join(outRoot, label);
fs.mkdirSync(out, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-theme-rec-'));
const RATE = 0.1; // animations run at a tenth of real speed while frames are captured

const ctx = await chromium.launchPersistentContext(profile, {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  args: ['--disable-extensions', '--no-first-run'],
});
const report = { label, route, runs: [] };

async function prep(page, vp, theme) {
  await page.setViewportSize(vp);
  await page.addInitScript((t) => {
    try { localStorage.setItem('mm:theme:v1', t); localStorage.setItem('mm:theme-hint:v1', '1'); } catch {}
  }, theme);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const toggles = page.locator('.mm-theme-toggle');
    const n = await toggles.count();
    for (let i = 0; i < n; i += 1) {
      const t = toggles.nth(i);
      if (await t.isVisible()) { await t.scrollIntoViewIfNeeded(); return t; }
    }
    await page.waitForTimeout(1500); // the dev server sometimes fails one read on Windows; load again
  }
  throw new Error('no visible toggle');
}

for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  for (const theme of ['light', 'dark']) {
    const tag = `${vp.width}-${theme === 'dark' ? 'night' : 'day'}`;
    const run = { tag };

    // 1) Static capture and slowed frames.
    let page = await ctx.newPage();
    let toggle = await prep(page, vp, theme);
    await page.screenshot({ path: path.join(out, `${tag}-static.png`) });
    const box = await toggle.boundingBox();
    const clip = { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 4), width: box.width + 12, height: box.height + 8 };
    await page.screenshot({ path: path.join(out, `${tag}-toggle-start.png`), clip });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    // Freeze every running animation (the switch's transitions and the page reveal), then step through time.
    await page.waitForFunction(() => document.getAnimations().length > 0, null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => { for (const a of document.getAnimations()) a.pause(); });
    const frames = [];
    const STEPS = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 450, 500, 560, 620, 700, 800, 1000];
    for (let i = 0; i < STEPS.length; i += 1) {
      const ms = STEPS[i];
      await page.evaluate((t) => new Promise((done) => {
        for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
        requestAnimationFrame(() => requestAnimationFrame(done));
      }), ms);
      const f = `${tag}-f${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(out, f), clip });
      if (i % 3 === 0) await page.screenshot({ path: path.join(out, `${tag}-page-f${String(i).padStart(2, '0')}.png`), scale: 'css' });
      frames.push({ f, ms });
    }
    await page.evaluate(() => { for (const a of document.getAnimations()) a.finish?.(); });
    await page.waitForTimeout(300);
    run.frames = frames;
    run.after = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.screenshot({ path: path.join(out, `${tag}-end.png`) });
    await page.close();

    // 2) Real-speed fps and layout shift.
    page = await ctx.newPage();
    toggle = await prep(page, vp, theme);
    const b2 = await toggle.boundingBox();
    await page.evaluate(() => {
      window.__shifts = 0;
      try {
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts += e.value; })
          .observe({ type: 'layout-shift', buffered: false });
      } catch {}
      window.__frames = [];
      window.__rec = true;
      const tick = (t) => { if (!window.__rec) return; window.__frames.push(t); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.waitForTimeout(1100);
    const perf = await page.evaluate(() => {
      window.__rec = false;
      const f = window.__frames;
      const d = f.slice(1).map((t, k) => t - f[k]);
      d.sort((a, b) => a - b);
      const avg = d.reduce((s, x) => s + x, 0) / Math.max(1, d.length);
      return { frames: f.length, avgMs: +avg.toFixed(2), p95Ms: +(d[Math.floor(d.length * 0.95)] || 0).toFixed(2), maxMs: +(d[d.length - 1] || 0).toFixed(2), longOver25: d.filter((x) => x > 25).length, cls: +window.__shifts.toFixed(4) };
    });
    const b3 = await toggle.boundingBox();
    perf.toggleMoved = Math.abs(b3.x - b2.x) + Math.abs(b3.y - b2.y) + Math.abs(b3.width - b2.width);
    run.perf = perf;
    await page.close();

    // 3) Reduced motion: the switch must change at once.
    page = await ctx.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    toggle = await prep(page, vp, theme);
    const b4 = await toggle.boundingBox();
    await page.mouse.click(b4.x + b4.width / 2, b4.y + b4.height / 2);
    await page.waitForTimeout(60);
    run.reduced = await page.evaluate(() => {
      const thumb = document.querySelector('.mm-theme-toggle:not([hidden]) .mm-theme-toggle__thumb');
      const running = document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.transitionProperty || a.animationName || a.constructor.name);
      return { theme: document.documentElement.dataset.theme, vt: !!document.documentElement.dataset.themeSwitching, thumbTransform: thumb && getComputedStyle(thumb).transform, running: running.slice(0, 12) };
    });
    await page.screenshot({ path: path.join(out, `${tag}-reduced-60ms.png`) });
    await page.close();

    report.runs.push(run);
  }
}

// Contact sheets: every toggle frame of each run with its animation time.
for (const run of report.runs) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1400, height: 400 });
  const cells = run.frames.map(({ f, ms }) => `<figure><img src="file:///${path.join(out, f).replace(/\\/g, '/')}"><figcaption>${ms} ms</figcaption></figure>`).join('');
  await page.setContent(`<html><body style="margin:0;padding:12px;background:#888;font:12px system-ui"><h3 style="margin:0 0 8px">${label} ${run.tag} (toggle frames, time in animation ms)</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${cells}</div><style>figure{margin:0;background:#fff;padding:4px;text-align:center}img{width:180px;display:block}</style></body></html>`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `SHEET-${run.tag}.png`), fullPage: true });
  await page.close();
}

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
console.log(JSON.stringify(report.runs.map((r) => ({ tag: r.tag, after: r.after, frames: r.frames.length, perf: r.perf, reduced: r.reduced })), null, 1));
