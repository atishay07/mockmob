// Navigation v2 (docs/brain/learn-1031/NAV-2.md, preview &nav=n2): the renders for the owner's call. Same pattern as
// learn-1031-capture.mjs: headless playwright-core with the chrome-headless-shell against `next dev`, the REAL decks, one fresh
// in-memory student per shot (&kcs=), the development note hidden, real pointer taps. One browser at a time, closed at the end.
//   node scripts/design-audit/learn-1031-nav2-capture.mjs http://localhost:3451 tmp/learn-1031/nav2
//   FFMPEG=<path to ffmpeg>  (the switch film is encoded from the page's own screencast frames; without it the frames stay as PNGs)
// A run that logs problems (console errors, sideways spill, layout shift above 0.02) prints them under ERRORS and exits 1.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ffmpeg = process.env.FFMPEG || 'C:/Users/atish/AppData/Roaming/Python/Python312/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const [base = 'http://localhost:3451', out = 'tmp/learn-1031/nav2'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const Q = 'decks=real&plan=pro&student=commerce&nav=n2';
const P = '/preview/arena?';
const SHOTS = [
  { name: 'nav2-01-sidebar-learn', url: `${P}view=learn2&${Q}`, wait: '.lh-row', size: 1440, themes: ['dark', 'light'] },
  { name: 'nav2-02-practice-half', url: `${P}view=dashboard&${Q}`, wait: '.arena-halves__switch[data-placed]', size: 390, themes: ['dark', 'light'] },
  { name: 'nav2-03-learn-half', url: `${P}view=learn2&${Q}`, wait: '.lh-row', size: 390, themes: ['dark', 'light'] },
  { name: 'nav2-04-learn-find', url: `${P}view=learn2&lv=find&${Q}`, wait: '.l2f-shelf', size: 390, themes: ['dark'] },
];
const sizes = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
const IGNORE = /Fixture endpoint not supplied|status of 503|status of 418|status of 404|status of 402|status of 401|favicon|Download the React DevTools/i;
const errors = [];
const wait = (page, ms) => page.waitForTimeout(ms);

async function context(browser, size, theme) {
  const ctx = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: size === 390 ? 2 : 1, hasTouch: size === 390, isMobile: size === 390, colorScheme: theme });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ }
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none */ }
  }, theme);
  return ctx;
}

async function open(ctx, url, waitFor, tag) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag}: pageerror ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(`${tag} console: ${m.text().slice(0, 200)}`); });
  await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });
  await page.waitForSelector(waitFor, { timeout: 120000, state: 'visible' });
  await wait(page, 1200);
  await page.waitForFunction(() => ![...document.querySelectorAll('.skeleton')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), null, { timeout: 30000 }).catch(() => errors.push(`${tag}: still showing a skeleton after 30 s`));
  await wait(page, 600);
  return page;
}

async function check(page, tag) {
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (spill > 1) errors.push(`${tag}: the page scrolls sideways by ${spill}px`);
  const cls = await page.evaluate(() => window.__cls || 0);
  if (cls > 0.1) errors.push(`${tag}: layout shift ${cls.toFixed(3)}`);
  // Every door in a half's row fits at 390 px (NAV-2.md: no peek cue needed).
  const row = await page.evaluate(() => { const r = document.querySelector('.arena-halves .arena-tabs__row'); return r && getComputedStyle(r).display !== 'none' ? r.scrollWidth - r.clientWidth : null; });
  if (row !== null && row > 1) errors.push(`${tag}: the half's door row overflows by ${row}px`);
}

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const shot of SHOTS) {
    for (const theme of shot.themes) {
      const tag = `${shot.name} ${shot.size} ${theme}`;
      const ctx = await context(browser, shot.size, theme);
      try {
        const page = await open(ctx, `${shot.url}&kcs=${encodeURIComponent(`${shot.name}-${theme}`)}`, shot.wait, tag);
        await check(page, tag);
        const file = join(out, `${shot.name}-${shot.size}-${theme === 'dark' ? 'night' : 'day'}.png`);
        await page.screenshot({ path: file });
        console.log('saved', file);
      } catch (e) {
        errors.push(`${tag}: ${e.message.split('\n')[0]}`);
      }
      await ctx.close();
    }
  }

  // The film: 390 Night, tap Learn in the title switch, then Practice (about 4 s), from the page's own screencast frames.
  {
    const tag = 'nav2-05-switch 390 dark';
    const ctx = await context(browser, 390, 'dark');
    try {
      const kcs = '&kcs=nav2-05-switch';
      // Warm the Learn half once so the film shows the switch, not the development server compiling.
      const warm = await open(ctx, `${P}view=learn2&${Q}${kcs}`, '.lh-row', tag);
      await warm.close();
      const page = await open(ctx, `${P}view=dashboard&${Q}${kcs}`, '.arena-halves__switch[data-live]', tag);
      const frames = join(out, 'nav2-05-frames');
      rmSync(frames, { recursive: true, force: true });
      mkdirSync(frames, { recursive: true });
      const list = [];
      const cdp = await ctx.newCDPSession(page);
      cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
        const name = `f${String(list.length).padStart(4, '0')}.png`;
        writeFileSync(join(frames, name), Buffer.from(data, 'base64'));
        list.push({ name, t: metadata.timestamp });
        cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 780, maxHeight: 1688 });
      const start = Date.now() / 1000;
      await wait(page, 700);
      await page.locator('.arena-halves__word[data-word="learn"]').tap();
      await page.waitForSelector('.lh-row', { timeout: 30000 });
      await wait(page, 1500);
      await page.locator('.arena-halves__word[data-word="practice"]').tap();
      await page.waitForFunction(() => !document.querySelector('.lh'), null, { timeout: 30000 });
      await wait(page, 1500);
      const end = Date.now() / 1000;
      await cdp.send('Page.stopScreencast');
      await check(page, tag);
      if (!list.length) throw new Error('no screencast frames');
      // A concat list with each frame held until the next one (the screencast only sends a frame when the page changes).
      const lines = [];
      list.forEach((f, i) => {
        const next = i + 1 < list.length ? list[i + 1].t : Math.max(f.t + 0.1, end);
        lines.push(`file '${resolve(frames, f.name).replace(/\\/g, '/')}'`, `duration ${Math.max(0.001, next - f.t).toFixed(3)}`);
      });
      lines.push(`file '${resolve(frames, list[list.length - 1].name).replace(/\\/g, '/')}'`);
      const listFile = join(frames, 'list.txt');
      writeFileSync(listFile, `${lines.join('\n')}\n`);
      const film = join(out, 'nav2-05-switch-390-night.webm');
      if (existsSync(ffmpeg)) {
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', 'fps=30,scale=780:-2', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-pix_fmt', 'yuv420p', film]);
        rmSync(frames, { recursive: true, force: true });
        console.log('saved', film, `(${list.length} frames, ${(end - start).toFixed(1)} s)`);
      } else {
        errors.push(`${tag}: no ffmpeg at ${ffmpeg}; the frames are in ${frames}`);
      }
    } catch (e) {
      errors.push(`${tag}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.log('ERRORS');
  for (const e of errors) console.log(' ', e);
  process.exitCode = 1;
}
