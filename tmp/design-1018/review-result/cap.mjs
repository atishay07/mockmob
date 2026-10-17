// Headless captures through playwright-core (system Chrome via channel, own temp profile, deleted after).
// Usage: node cap.mjs [filterRegex]
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'captures');
mkdirSync(out, { recursive: true });
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;

const themes = ['night', 'day'];
const jobs = [];
const add = (page, q, w, h, name, extra = {}) => { for (const t of themes) jobs.push({ page, q: `${q}${t === 'day' ? '&theme=light' : ''}`, w, h, out: `${name}-${w}-${t}.png`, ...extra }); };
for (const w of [390, 1440]) {
  const h = w === 390 ? 844 : 900;
  add('web.html', 's=review', w, h, 'web-review');
  add('web.html', 's=review&open=ret', w, h, 'web-review-other', { to: '[data-ch="ret"]', offset: 70 });
  add('web.html', 's=result', w, h, 'web-result-front');
  add('web.html', 's=result', w, h, 'web-result-depth', { to: '#depth', offset: 70 });
  add('web.html', 's=mistakes', w, h, 'web-result-mistakes', { to: w === 390 ? '#part' : '#depth', offset: w === 390 ? 60 : 70 });
  add('web.html', 's=replay', w, h, 'web-replay50', { to: w === 390 ? '#part' : '#depth', offset: w === 390 ? 60 : 70 });
  add('web.html', 's=replay10', w, h, 'web-replay10', { to: w === 390 ? '#part' : '#depth', offset: w === 390 ? 60 : 70 });
  add('web.html', 's=replaycut', w, h, 'web-replaycut', { to: w === 390 ? '#part' : '#depth', offset: w === 390 ? 60 : 70 });
}
jobs.push({ page: 'web.html', q: 's=review', w: 390, h: 844, out: 'web-review-390-night-full.png', full: true });
jobs.push({ page: 'web.html', q: 's=result', w: 390, h: 844, out: 'web-result-390-night-full.png', full: true });
jobs.push({ page: 'web.html', q: 's=replay', w: 1440, h: 900, out: 'web-replay50-1440-night-full.png', full: true });
for (const t of themes) {
  const th = t === 'day' ? '&theme=light' : '';
  const A = (q, name, extra = {}) => jobs.push({ page: 'app.html', q: q + th, w: 412, h: 915, out: `${name}-412-${t}.png`, ...extra });
  A('s=review', 'app-review');
  A('s=review', 'app-review-lower', { to: '[data-sec="saved"]', offset: 80, inner: true });
  A('s=result', 'app-result-front');
  A('s=result', 'app-result-depth', { to: '#depth', offset: 70, inner: true });
  A('s=mistakes', 'app-result-mistakes', { to: '[data-part="mistakes"]', offset: 70, inner: true });
  A('s=replay', 'app-replay50', { to: '.rb', offset: 170, inner: true });
  A('s=replay10', 'app-replay10', { to: '.rb', offset: 170, inner: true });
}

const profile = mkdtempSync(join(tmpdir(), 'mm-1018-rr-'));
let ctx;
try {
  ctx = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, args: ['--hide-scrollbars'] });
  const page = ctx.pages()[0] || await ctx.newPage();
  for (const job of jobs) {
    if (only && !only.test(job.out)) continue;
    await page.setViewportSize({ width: job.w, height: job.h });
    await page.goto(`${pathToFileURL(join(here, job.page)).href}?${job.q}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    if (job.to) {
      await page.evaluate(({ sel, offset, inner }) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const scroller = inner ? document.querySelector('[data-scroller]') : null;
        if (scroller) scroller.scrollTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - offset;
        else window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
      }, { sel: job.to, offset: job.offset || 0, inner: Boolean(job.inner) });
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: join(out, job.out), fullPage: Boolean(job.full) });
    process.stdout.write(`${job.out}\n`);
  }
} finally {
  await ctx?.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* the profile is in temp */ }
}
