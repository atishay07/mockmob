// Round-2 "before": the LIVE production home page, signed out (fresh context, no cookies), read only.
//   node scripts/design-audit/learn-1101-r2-live-home.mjs https://www.mockmob.in/ tmp/learn-1101/r2-before/live-home
// 390x844 (scale 2) and 1440x900 (scale 1), dark and light, first screen and full page. Holds the same mkdir browser lock.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [URL0 = 'https://www.mockmob.in/', OUTARG = 'tmp/learn-1101/r2-before/live-home'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const LOCK = join(ROOT, 'tmp/learn-1101/browser.lock');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let beat = null;
for (let i = 0; i < 400; i += 1) {
  try { mkdirSync(LOCK); break; } catch {
    try { if (Date.now() - statSync(LOCK).mtimeMs > 5 * 60 * 1000) { rmSync(LOCK, { recursive: true, force: true }); continue; } } catch { /* gone */ }
    await sleep(3000);
  }
  if (i === 399) throw new Error('browser lock busy for 20 minutes');
}
beat = setInterval(() => { try { const t = new Date(); utimesSync(LOCK, t, t); } catch { /* none */ } }, 20000);
const shellPids = () => { try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome-headless-shell.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split('\n').map((l) => l.split('","')[1]).filter(Boolean).map(Number); } catch { return []; } };
const before = new Set(shellPids());
const SIZES = { 390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true }, 1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false } };
const rows = [];
let browser = null;
let pids = [];
try {
  browser = await chromium.launch({ headless: true, executablePath });
  await sleep(700);
  pids = shellPids().filter((x) => !before.has(x));
  for (const size of [390, 1440]) {
    for (const theme of ['dark', 'light']) {
      const S = SIZES[size];
      const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
      await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
      const page = await ctx.newPage();
      try {
        await page.goto(URL0, { waitUntil: 'load', timeout: 120000 });
        await page.waitForTimeout(4000);
        const first = `home-first-screen-${size}-${theme === 'dark' ? 'night' : 'day'}.png`;
        await page.screenshot({ path: join(OUT, first) });
        const shownTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'media-dark' : 'media-light'));
        rows.push({ file: first, size, theme, what: `Live home page signed out, first screen (${size}x${S.viewport.height}); document theme attribute: ${shownTheme}` });
        // scroll through so reveal-on-scroll content is drawn, then back to the top
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < h; y += Math.round(S.viewport.height * 0.6)) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(350); }
        await page.waitForTimeout(800);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(800);
        const full = `home-full-${size}-${theme === 'dark' ? 'night' : 'day'}.png`;
        await page.screenshot({ path: join(OUT, full), fullPage: true });
        const dim = await page.evaluate(() => `${innerWidth}x${document.documentElement.scrollHeight}`);
        rows.push({ file: full, size, theme, what: `Live home page signed out, full page after scrolling through it (${dim})` });
        console.log('saved', first, full, dim);
      } catch (e) { console.log('FAILED', size, theme, e.message.split('\n')[0]); rows.push({ file: '', size, theme, what: `FAILED: ${e.message.split('\n')[0]}` }); }
      await ctx.close();
    }
  }
} finally {
  await browser?.close().catch(() => {});
  await sleep(800);
  for (const x of shellPids().filter((p) => pids.includes(p))) { try { execFileSync('taskkill', ['/PID', String(x), '/T', '/F']); } catch { /* none */ } }
  writeFileSync(join(OUT, 'live-index.json'), JSON.stringify(rows, null, 1));
  clearInterval(beat);
  try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* none */ }
  console.log('live capture done');
}
