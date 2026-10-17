// Headless captures with playwright-core (installed Chrome via channel, own temp profile; never a visible browser).
// Usage: node cap.mjs [filter-regex]
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const here = dirname(fileURLToPath(import.meta.url));
const jobs = JSON.parse(readFileSync(join(here, 'jobs.json'), 'utf8'));
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
mkdirSync(join(here, 'captures'), { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'mm-today1018-'));
const ctx = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const report = [];
try {
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.push(`console error: ${m.text()}`); });
  page.on('pageerror', (e) => report.push(`page error: ${e.message}`));
  for (const job of jobs) {
    if (only && !only.test(job.out)) continue;
    await page.setViewportSize({ width: job.w, height: job.h });
    const url = `${pathToFileURL(join(here, job.page)).href}?chrome=0&anim=0&full=${job.full ? 1 : 0}&${job.q || ''}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    for (const sel of job.click || []) {
      // A real pointer click at the element's centre, after a hit test: nothing may cover it.
      const el = page.locator(sel).first();
      await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
      const box = await el.boundingBox();
      const hit = await page.evaluate(([x, y, s]) => { const t = document.elementFromPoint(x, y); const want = document.querySelector(s); return !!(t && want && (want === t || want.contains(t))); }, [box.x + box.width / 2, box.y + box.height / 2, sel]);
      if (!hit) report.push(`${job.out}: ${sel} is covered at its centre`);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(job.clickWait || 700);
    }
    if (job.scroll) await page.evaluate((s) => { const el = document.querySelector(s); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 72); }, job.scroll);
    await page.waitForTimeout(job.wait || 350);
    // No horizontal page scroll at any width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) report.push(`${job.out}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: join(here, 'captures', `${job.out}.png`), fullPage: !!job.full });
    console.log(job.out);
  }
} finally {
  await ctx.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may hold a file for a moment */ }
}
console.log(report.length ? `\nISSUES\n${report.join('\n')}` : '\nno issues');
