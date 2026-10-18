// W-044 (release 10, taste round 2): the cue below the fold must SHOW on a phone. At 390 x 844, Night, with the preview's dev note
// hidden, the week starts below the fold at scroll 0, so `.tcue` must not be data-seen there; a first scroll of 24 px or more steps
// it away. Headless playwright-core only, its own temp profile.
//   node scripts/design-audit/today-cue-r10-check.mjs http://localhost:3317
//   PLAYWRIGHT_CORE=<path to playwright-core>  HEADLESS_SHELL=<path to chrome-headless-shell.exe>  (optional overrides)
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3317'] = process.argv.slice(2);
const profile = mkdtempSync(join(tmpdir(), 'today-cue-'));
const ctx = await chromium.launchPersistentContext(profile, { headless: true, executablePath, viewport: { width: 390, height: 844 }, hasTouch: true });
let failed = false;
try {
  await ctx.addInitScript(() => { try { localStorage.setItem('mm:theme:v1', 'dark'); } catch { /* none */ } });
  const page = await ctx.newPage();
  await page.goto(`${base}/preview/arena?view=today`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; }' });
  await page.waitForSelector('.tm__key', { timeout: 30000 });
  await page.waitForTimeout(600);
  const atTop = await page.evaluate(() => ({ y: window.scrollY, seen: document.querySelector('.tcue')?.dataset.seen ?? null, wait: document.querySelector('.tcue')?.dataset.wait ?? null, week: Math.round(document.getElementById('week')?.getBoundingClientRect().top ?? -1) }));
  const shown = atTop.y === 0 && atTop.seen == null && atTop.wait == null && atTop.week > 844 - 96;
  console.log(`${shown ? 'PASS' : 'FAIL'} scroll 0: .tcue ${atTop.seen == null ? 'not data-seen' : 'data-seen'}, week top ${atTop.week} px`);
  failed ||= !shown;
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(400);
  const away = await page.evaluate(() => document.querySelector('.tcue')?.dataset.seen ?? null);
  console.log(`${away != null ? 'PASS' : 'FAIL'} after a 40 px scroll: .tcue ${away != null ? 'data-seen' : 'still shown'}`);
  failed ||= away == null;
} finally {
  await ctx.close();
  rmSync(profile, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
