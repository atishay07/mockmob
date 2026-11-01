// Home hero, round 2 (LK32, 1 Nov 2026): stills and measurements of / against a local `next dev`, never production.
//   node scripts/design-audit/hero-1101-r2-capture.mjs http://localhost:3485 tmp/learn-1101/r2-after/hero
//   ONLY=first,full,taps,small,desk-answer   (default: everything)
// ONE headless Chromium, only while holding the shared browser lock (a mkdir lock in tmp-devslots beside the worktrees,
// stale after 10 minutes); it is touched every 20 s and removed at the end, and the shells this run started are killed.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3485', OUTARG = 'tmp/learn-1101/r2-after/hero'] = process.argv.slice(2);
const OUT = resolve(ROOT, OUTARG);
const LOCK = resolve(ROOT, '..', 'tmp-devslots', 'browser.lock');
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (job) => !only.length || only.includes(job);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

for (;;) {
  try { mkdirSync(LOCK); break; } catch {
    try { if (Date.now() - statSync(LOCK).mtimeMs > 10 * 60 * 1000) { rmSync(LOCK, { recursive: true, force: true }); continue; } } catch { /* gone */ }
    console.log('waiting for the browser lock');
    await sleep(15000);
  }
}
const beat = setInterval(() => { try { const t = new Date(); utimesSync(LOCK, t, t); } catch { /* none */ } }, 20000);
const shellPids = () => { try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome-headless-shell.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split('\n').map((l) => l.split('","')[1]).filter(Boolean).map(Number); } catch { return []; } };
const before = new Set(shellPids());

const SIZES = {
  390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true },
  360: { viewport: { width: 360, height: 640 }, dsf: 2, touch: true },
  1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false },
  1024: { viewport: { width: 1024, height: 768 }, dsf: 1, touch: false },
};
const tname = (t) => (t === 'dark' ? 'night' : 'day');
const rows = [];
let browser = null;
let pids = [];

const measure = (page) => page.evaluate(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); if (!b.width && !b.height) return null; return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom + scrollY) }; };
  return {
    theme: document.documentElement.dataset.theme,
    room: r('.lp-room'), mobiRoom: r('.lp-mobi--room .lp-mobi__figure'), bubbleRoom: r('.lp-mobi--room .lp-mobi__bubble'),
    title: r('.lp-title'), lead: r('.lp-lead'), cta: r('.lp-cta'), facts: r('.lp-hero__facts'), links: r('.lp-hero__links'),
    stage: r('#try-practice'), card: r('.lp-stage__card'), proof: r('.lp-proof'), host: r('.lp-mobi--host .lp-mobi__figure'), bubbleHost: r('.lp-mobi--host .lp-mobi__bubble'),
    rig: [...document.querySelectorAll('.lp-mobi')].map((m) => m.dataset.rig),
    imgs: [...document.querySelectorAll('.lp-room__file')].map((i) => ({ src: i.currentSrc.split('/').pop(), ready: i.dataset.ready })),
    lines: [...document.querySelectorAll('.lp-mobi__line')].map((l) => l.textContent),
    flyer: !!document.querySelector('.pip-guide-flyer') && getComputedStyle(document.querySelector('.pip-guide-flyer')).opacity,
    overflowX: document.documentElement.scrollWidth > innerWidth,
  };
});

async function open(size, theme, extra = {}) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme, reducedMotion: extra.reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.text().includes('HMDBG')) console.log(m.text()); });
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools|status of 40|status of 50/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(extra.wait ?? Number(process.env.WAIT || 4500));
  return { ctx, page, errors };
}

async function tap(page, sel) {
  await page.locator(`${sel} .mobi-react__hit`).first().click();
}

try {
  browser = await chromium.launch({ headless: true, executablePath });
  await sleep(700);
  pids = shellPids().filter((x) => !before.has(x));
  for (const size of [390, 1440]) {
    for (const theme of ['dark', 'light']) {
      if (!want('first') && !want('full')) continue;
      const { ctx, page, errors } = await open(size, theme);
      const name = `hero-first-${size}-${tname(theme)}.png`;
      await page.screenshot({ path: join(OUT, name) });
      const m = await measure(page);
      rows.push({ file: name, size, theme, m, errors });
      console.log(name, JSON.stringify(m), errors.length ? errors : '');
      if (want('full') && size === 390) {
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < h; y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(250); }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(800);
        const full = `hero-full-${size}-${tname(theme)}.png`;
        await page.screenshot({ path: join(OUT, full), fullPage: true });
        rows.push({ file: full, size, theme });
      }
      await ctx.close();
    }
  }
  if (want('probe')) {
    const { ctx, page, errors } = await open(1440, 'dark', { wait: 15000 });
    console.log('probe', JSON.stringify(await measure(page)), errors);
    await tap(page, '.lp-mobi--host');
    await page.waitForTimeout(3000);
    console.log('after tap', JSON.stringify((await measure(page)).lines), (await measure(page)).rig, errors);
    await page.screenshot({ path: join(OUT, 'probe-1440.png') });
    await ctx.close();
  }
  if (want('taps')) {
    for (const [size, theme] of [[390, 'dark'], [390, 'light'], [1440, 'dark']]) {
      const { ctx, page, errors } = await open(size, theme);
      const sel = size === 390 ? '.lp-mobi--room' : '.lp-mobi--host';
      for (let i = 1; i <= 6; i += 1) {
        await tap(page, sel);
        await page.waitForTimeout(i === 4 ? 120 : 700);
        if ([1, 4, 6].includes(i)) {
          const name = `hero-tap${i}-${size}-${tname(theme)}.png`;
          await page.screenshot({ path: join(OUT, name), clip: size === 390 ? { x: 0, y: 0, width: 390, height: 844 } : undefined });
          const m = await measure(page);
          rows.push({ file: name, size, theme, lines: m.lines, rig: m.rig });
          console.log(name, m.lines, m.rig);
        }
        await page.waitForTimeout(500);
      }
      if (errors.length) console.log('errors', errors);
      await ctx.close();
    }
  }
  if (want('small')) {
    for (const theme of ['dark', 'light']) {
      const { ctx, page } = await open(360, theme);
      const name = `hero-first-360x640-${tname(theme)}.png`;
      await page.screenshot({ path: join(OUT, name) });
      const m = await measure(page);
      rows.push({ file: name, size: 360, theme, m });
      console.log(name, JSON.stringify(m));
      await ctx.close();
    }
    const { ctx, page } = await open(1024, 'dark');
    await page.screenshot({ path: join(OUT, 'hero-first-1024-night.png') });
    console.log('1024', JSON.stringify(await measure(page)));
    await ctx.close();
  }
  if (want('desk-answer')) {
    const { ctx, page } = await open(1440, 'dark');
    await page.locator('.mm-drill__option').nth(1).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'hero-answered-1440-night.png') });
    await ctx.close();
    const p2 = await open(390, 'dark');
    await p2.page.locator('.mm-drill__option').nth(0).click();
    await p2.page.waitForTimeout(900);
    await p2.page.screenshot({ path: join(OUT, 'hero-answered-390-night.png') });
    await p2.ctx.close();
  }
  if (want('reduced')) {
    const { ctx, page } = await open(390, 'dark', { reduced: true });
    await tap(page, '.lp-mobi--room');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, 'hero-reduced-tap1-390-night.png') });
    console.log('reduced', JSON.stringify(await measure(page)));
    await ctx.close();
  }
} finally {
  clearInterval(beat);
  await browser?.close().catch(() => {});
  await sleep(800);
  for (const x of shellPids().filter((p) => pids.includes(p))) { try { execFileSync('taskkill', ['/PID', String(x), '/T', '/F']); } catch { /* none */ } }
  writeFileSync(join(OUT, `index-${Date.now()}.json`), JSON.stringify(rows, null, 1));
  try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* none */ }
}
