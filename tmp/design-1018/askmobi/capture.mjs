// Headless captures of the Ask Mobi mock (playwright-core, own temp profile, no visible browser).
// node capture.mjs <tempProfileDir>
import { chromium } from 'file:///C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'captures');
mkdirSync(out, { recursive: true });
const page0 = pathToFileURL(path.join(here, 'index.html')).href;
const profile = process.argv[2];

const shots = [];
for (const theme of ['night', 'day']) {
  shots.push({ name: `web-1440-${theme}-answered`, q: `view=desk&theme=${theme}`, vp: [1440, 900] });
  shots.push({ name: `web-1440-${theme}-opening`, q: `view=desk&theme=${theme}&step=ask`, vp: [1440, 900] });
  shots.push({ name: `web-1440-${theme}-states`, q: `view=states&theme=${theme}`, vp: [1440, 900] });
  shots.push({ name: `web-390-${theme}-sheet`, q: `view=phone&theme=${theme}`, vp: [390, 844], mobile: true });
  shots.push({ name: `web-390-${theme}-entries`, q: `view=entries&theme=${theme}`, vp: [390, 844], mobile: true, full: true });
  shots.push({ name: `app-412-${theme}-sheet`, q: `view=phone&theme=${theme}&surface=app`, vp: [412, 915], mobile: true });
}

const ctx = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const problems = [];
try {
  for (const s of shots) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: s.vp[0], height: s.vp[1] });
    page.on('pageerror', (e) => problems.push(`${s.name}: ${e}`));
    await page.goto(`${page0}?${s.q}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`${s.name}: horizontal overflow ${overflow}px`);
    const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    if (!fonts.some((f) => f.includes('Bricolage'))) problems.push(`${s.name}: Bricolage not loaded`);
    const file = path.join(out, `${s.name}.png`);
    await page.screenshot({ path: file, fullPage: Boolean(s.full) });
    console.log(file);
    await page.close();
  }
} finally {
  await ctx.close();
}
console.log(problems.length ? `PROBLEMS\n${problems.join('\n')}` : 'no problems');
