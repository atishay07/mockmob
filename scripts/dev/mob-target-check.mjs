// A real-render check for the Mob's tap targets: every button, link, input, select and switch on /mob must measure at
// least 44 px in both directions in its own box (go/no-go check 17 Oct: "targets are 44 px" passed on CSS strings while
// a 52 x 32 box shipped). Drives headless Chrome through playwright-core (its own temporary profile, closed on exit)
// against a running dev server's fixture page, in Night and Day, at 390 and 1440, in each fixture state. In the states
// with other members it also opens a member's "..." menu with a real click and measures the menu's buttons.
// Usage: node scripts/dev/mob-target-check.mjs http://localhost:3334 [shotsDir]
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PW = process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);

const base = process.argv[2] || 'http://localhost:3334';
const shots = process.argv[3] || null;
if (shots) mkdirSync(shots, { recursive: true });
const STATES = ['ready', 'pro', 'notsat', 'two', 'private', 'blocked', 'alone', 'sample', 'locked', 'extras', 'complete', 'full'];
const SCAN = (root) => [...document.querySelectorAll(`${root} :is(button, a[href], input:not([type=radio]):not([type=checkbox]), select, [role=switch], summary)`)]
  .map((e) => { const b = e.getBoundingClientRect(); return { cls: String(e.className).slice(0, 36), label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28), w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; })
  .filter((x) => x.w > 0 && x.h > 0 && (x.w < 44 || x.h < 44));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const failures = [];
const seen = { menuButtons: [], menus: 0 };
try {
  for (const theme of ['dark', 'light']) for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', colorScheme: theme });
    await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch {} }, theme);
    const page = await ctx.newPage();
    for (const state of STATES) {
      await page.goto(`${base}/preview/arena?view=mob&mob=${state}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForSelector('.mob-page .mob-card', { timeout: 120000 });
      await page.waitForTimeout(400);
      for (const small of await page.evaluate(SCAN, '.mob-page')) failures.push({ theme, w, state, ...small });
      const more = page.locator('.mob-page button[aria-label^="More for"]').first();
      if (await more.count()) {
        const box = await more.boundingBox();
        seen.menuButtons.push({ theme, w, state, w_: box.width, h_: box.height });
        if (box.width < 44 || box.height < 44) failures.push({ theme, w, state, label: 'More for (member menu)', w_: box.width, h_: box.height });
        await more.click();
        await page.waitForSelector('.mob-menu__item', { timeout: 10000 });
        seen.menus += 1;
        for (const small of await page.evaluate(SCAN, '[role=dialog]')) failures.push({ theme, w, state, inMenu: true, ...small });
        if (shots && state === 'ready') await page.screenshot({ path: `${shots}/menu-${theme}-${w}.png` });
        await page.keyboard.press('Escape');
      }
      if (shots && state === 'ready') await page.screenshot({ path: `${shots}/mob-${theme}-${w}.png`, fullPage: true });
    }
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ menuButtons: seen.menuButtons.slice(0, 4), menusOpened: seen.menus }));
if (failures.length) { console.error(JSON.stringify(failures, null, 1)); process.exit(1); }
console.log(`ok: every Mob target is at least 44 x 44 (${STATES.length} states x 2 widths x 2 themes, member menus opened)`);
