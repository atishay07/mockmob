// Home hero, round 3 (R3-hero, 1 Nov 2026): stills and measurements of / against a local `next dev`, never production.
//   node scripts/design-audit/hero-1101-r3-capture.mjs http://localhost:3485 tmp/learn-1101/r3-after/hero
//   ONLY=first,full,small,taps,wide   (default: everything)
// ONE headless Chromium while holding the shared browser lock (mkdir lock in tmp-devslots, stale after 10 minutes).
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3485', OUTARG = 'tmp/learn-1101/r3-after/hero'] = process.argv.slice(2);
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
  800: { viewport: { width: 800, height: 900 }, dsf: 1, touch: false },
  1024: { viewport: { width: 1024, height: 768 }, dsf: 1, touch: false },
  1280: { viewport: { width: 1280, height: 800 }, dsf: 1, touch: false },
  1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false },
  1920: { viewport: { width: 1920, height: 1080 }, dsf: 1, touch: false },
};
const tname = (t) => (t === 'dark' ? 'night' : 'day');
const rows = [];
let browser = null;
let pids = [];

const measure = (page) => page.evaluate(() => {
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); if (!b.width && !b.height) return null; return { x: Math.round(b.left * 10) / 10, y: Math.round(b.top + scrollY), w: Math.round(b.width * 10) / 10, h: Math.round(b.height), right: Math.round(b.right * 10) / 10, bottom: Math.round(b.bottom + scrollY) }; };
  const r = (sel) => rect(document.querySelector(sel));
  const lum = (c) => { const [R, G, B] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const bubble = document.querySelector('.lp-mobi--host .lp-mobi__bubble');
  let contrast = null;
  if (bubble && bubble.getBoundingClientRect().width > 4) {
    const cs = getComputedStyle(bubble); const line = bubble.querySelector('.lp-mobi__line');
    const fg = parse(getComputedStyle(line).color); const bg = parse(cs.backgroundColor);
    const a = fg[3] ?? 1; const bgc = bg.slice(0, 3);
    const mix = fg.slice(0, 3).map((v, i) => v * a + bgc[i] * (1 - a));
    const l1 = lum(mix) + 0.05; const l2 = lum(bgc) + 0.05;
    let opacity = 1; for (let e = line; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
    contrast = { ratio: Math.round((Math.max(l1, l2) / Math.min(l1, l2)) * 100) / 100, fg: getComputedStyle(line).color, bg: cs.backgroundColor, opacity: Math.round(opacity * 100) / 100 };
  }
  const stage = document.querySelector('#try-practice');
  const sb = stage ? stage.getBoundingClientRect() : null;
  const bayPx = parseFloat(getComputedStyle(stage || document.body, '::before').left) || 0; // inset is negative
  const bay = sb ? { left: Math.round((sb.left + bayPx) * 10) / 10, top: Math.round(sb.top + bayPx + scrollY), right: Math.round((sb.right - bayPx) * 10) / 10, bottom: Math.round(sb.bottom - bayPx + scrollY) } : null;
  const copyText = [...document.querySelectorAll('.lp-hero__copy .lp-trust-line__seg, .lp-hero__copy .lp-bank, .lp-hero__copy .lp-hero__tool, .lp-hero__copy .lp-hero__exam-link, .lp-hero__copy .lp-lead, .lp-hero__copy .lp-cta a')].map((e) => { const rr = document.createRange(); rr.selectNodeContents(e); return { cls: e.className.split(' ')[0] || e.tagName, ...rect(rr) }; });
  const title = document.querySelector('.lp-title');
  return {
    theme: document.documentElement.dataset.theme,
    title: r('.lp-title'), titleText: title?.innerText, titleLines: title ? Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)) : null,
    trustSegs: [...document.querySelectorAll('.lp-trust-line__seg')].map((s) => { const rr = document.createRange(); rr.selectNodeContents(s); return { text: s.textContent, lines: new Set([...rr.getClientRects()].map((q) => Math.round(q.top))).size }; }),
    trust: r('.lp-trust-line'), cta: r('.lp-cta'), stage: rect(stage), bay, card: r('.lp-stage__card'),
    host: r('.lp-mobi--host .lp-mobi__figure'), bubbleHost: rect(bubble), contrast,
    copyText,
    room: r('.lp-room'), mobiRoom: r('.lp-mobi--room .lp-mobi__figure'), bubbleRoom: r('.lp-mobi--room .lp-mobi__bubble'),
    lines: [...document.querySelectorAll('.lp-mobi__line')].map((l) => l.textContent),
    rig: [...document.querySelectorAll('.lp-mobi')].map((m) => m.dataset.rig),
    caret: !!document.querySelector('.lp-morph__caret, .lp-morph'),
    overflowX: document.documentElement.scrollWidth > innerWidth,
  };
});

async function open(size, theme, extra = {}) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme, reducedMotion: extra.reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools|status of 40|status of 50/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 180000 });
  await page.waitForTimeout(extra.wait ?? Number(process.env.WAIT || 4500));
  return { ctx, page, errors };
}
const tap = (page, sel) => page.locator(`${sel} .mobi-react__hit`).first().click();
const keep = (file, size, theme, m, errors) => {
  rows.push({ file, size, theme, m, errors });
  console.log(file, JSON.stringify({ titleText: m.titleText, titleLines: m.titleLines, trustSegs: m.trustSegs, host: m.host, bubbleHost: m.bubbleHost, bay: m.bay, contrast: m.contrast, overflowX: m.overflowX, caret: m.caret }), errors.length ? errors : '');
};

try {
  browser = await chromium.launch({ headless: true, executablePath });
  await sleep(700);
  pids = shellPids().filter((x) => !before.has(x));
  if (want('first') || want('full')) {
    for (const size of [390, 1440]) {
      for (const theme of ['dark', 'light']) {
        const { ctx, page, errors } = await open(size, theme);
        const name = `hero-first-${size}-${tname(theme)}.png`;
        await page.screenshot({ path: join(OUT, name) });
        keep(name, size, theme, await measure(page), errors);
        if (want('full') && size === 390) {
          const h = await page.evaluate(() => document.documentElement.scrollHeight);
          for (let y = 0; y < h; y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(250); }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(800);
          await page.screenshot({ path: join(OUT, `hero-full-${size}-${tname(theme)}.png`), fullPage: true });
        }
        await ctx.close();
      }
    }
  }
  if (want('small')) {
    for (const theme of ['dark', 'light']) {
      const { ctx, page, errors } = await open(360, theme);
      const name = `hero-first-360x640-${tname(theme)}.png`;
      await page.screenshot({ path: join(OUT, name) });
      keep(name, 360, theme, await measure(page), errors);
      await ctx.close();
    }
  }
  if (want('wide')) {
    for (const size of (process.env.WIDE || '1280,1920').split(',').map(Number)) {
      for (const theme of ['dark', 'light']) {
        const { ctx, page, errors } = await open(size, theme);
        const name = `hero-first-${size}-${tname(theme)}.png`;
        await page.screenshot({ path: join(OUT, name) });
        keep(name, size, theme, await measure(page), errors);
        await ctx.close();
      }
    }
  }
  if (want('taps')) {
    for (const [size, theme] of [[390, 'dark'], [390, 'light'], [1440, 'dark'], [1440, 'light'], [1280, 'dark'], [1920, 'dark']]) {
      const { ctx, page, errors } = await open(size, theme);
      const sel = size === 390 ? '.lp-mobi--room' : '.lp-mobi--host';
      for (let i = 1; i <= 2; i += 1) {
        await tap(page, sel);
        await page.waitForTimeout(900);
        const name = `hero-tap${i}-${size}-${tname(theme)}.png`;
        await page.screenshot({ path: join(OUT, name) });
        keep(name, size, theme, await measure(page), errors);
        await page.waitForTimeout(300);
      }
      await ctx.close();
    }
  }
} finally {
  clearInterval(beat);
  await browser?.close().catch(() => {});
  await sleep(800);
  for (const x of shellPids().filter((p) => pids.includes(p))) { try { execFileSync('taskkill', ['/PID', String(x), '/T', '/F']); } catch { /* none */ } }
  writeFileSync(join(OUT, `index-${Date.now()}.json`), JSON.stringify(rows, null, 1));
  try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* none */ }
}
