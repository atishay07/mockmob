// Headless captures with playwright-core (installed Chrome via channel, own temp profile; never a visible browser).
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'captures'), { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'mm-badges1018-'));
const ctx = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const report = [];
try {
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', (e) => report.push(`page error: ${e.message}`));
  for (const pg of ['badges', 'icons']) for (const [s, w] of [['app', 412], ['web', 390]]) for (const theme of ['night', 'day']) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(`${pathToFileURL(join(here, pg + '.html')).href}?s=${s}&theme=${theme}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) report.push(`${pg}-${s}-${theme}: horizontal overflow ${overflow}px`);
    const out = join(here, 'captures', `${pg}-${s}${w}-${theme}.png`);
    await page.screenshot({ path: out, fullPage: true });
    report.push(`ok ${out}`);
  }
} finally { await ctx.close(); rmSync(profile, { recursive: true, force: true }); }
console.log(report.join('\n'));
