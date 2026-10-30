// Key cards web screens (KEYCARDS-BUILD-SPEC.md section 3, proof): every screen at 390 and 1440 px, Night and Day, against
// `next dev` with the preview fixtures (/preview/arena?view=cards|deck|revise|result), never production data. Headless
// playwright-core with its own temp profile; the preview's development note is hidden in the shots.
//   node scripts/design-audit/keycards-1031-capture.mjs http://localhost:3417 tmp/walk-1031/web
//   PLAYWRIGHT_CORE=<path to playwright-core>  HEADLESS_SHELL=<path to chrome-headless-shell.exe>  ONLY=<substring>
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3417', out = 'tmp/walk-1031/web'] = process.argv.slice(2);
const only = process.env.ONLY || '';
mkdirSync(out, { recursive: true });

const P = '/preview/arena?';
const SHOTS = [
  { name: 'cards-home-free', url: `${P}view=cards&plan=free`, wait: '.kc-row', full: true },
  { name: 'cards-home-pro', url: `${P}view=cards&plan=pro`, wait: '.kc-row', full: true },
  { name: 'cards-home-option', url: `${P}view=cards&plan=pro&subject=accountancy`, wait: '.kc-opt', full: true },
  { name: 'deck-read-free', url: `${P}view=deck&plan=free`, wait: '.kc-entry', full: true },
  { name: 'deck-read-pro', url: `${P}view=deck&plan=pro`, wait: '.kc-entry', full: true },
  { name: 'deck-read-formula', url: `${P}view=deck&plan=pro&chapter=accountancy.accounting-ratios`, wait: '.kc-entry', full: true },
  { name: 'deck-study-front', url: `${P}view=deck&plan=pro&mode=study`, wait: '.kc-play' },
  { name: 'deck-study-answer', url: `${P}view=deck&plan=pro&mode=study`, wait: '.kc-play', act: async (page) => { await page.keyboard.press('Space'); await page.waitForSelector('.kc-rate'); } },
  { name: 'deck-study-end-free', url: `${P}view=deck&plan=free&mode=study`, wait: '.kc-play', act: async (page) => {
    for (let i = 0; i < 5; i += 1) { await page.keyboard.press('Space'); await page.waitForSelector('.kc-rate'); await page.keyboard.press(i % 2 ? '2' : i === 4 ? '1' : '3'); await page.waitForTimeout(300); }
    await page.waitForSelector('.kc-end');
  } },
  { name: 'deck-last-look', url: `${P}view=deck&plan=pro&mode=last`, wait: '.kc-look', act: async (page) => { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350); } },
  { name: 'deck-menu-report', url: `${P}view=deck&plan=pro`, wait: '.kc-entry', act: async (page) => {
    await page.locator('.kc-menu__btn').first().click();
    await page.locator('.kc-menu__item', { hasText: 'Report this card' }).click();
    await page.waitForSelector('.kc-report textarea');
  } },
  { name: 'revise-keycards', url: `${P}view=revise&plan=pro&revise=keycards&source=keycards`, wait: '.kc-play', act: async (page) => { await page.keyboard.press('Space'); await page.waitForSelector('.kc-rate'); } },
  { name: 'revise-queue-head', url: `${P}view=revise&plan=pro&revise=keycards`, wait: '.rvs-mix' },
  { name: 'revise-free-limit', url: `${P}view=revise&plan=free&revise=keycards&source=keycards&kc=limit`, wait: '.kc-play', act: async (page) => { await page.keyboard.press('Space'); await page.waitForSelector('.kc-rate'); await page.keyboard.press('2'); await page.waitForSelector('.kc-gate'); } },
  { name: 'result-line-you-needed', url: `${P}view=result&plan=free`, wait: '#q-2', attached: true, act: async (page) => {
    const row = page.locator('#q-2');
    if (!(await row.isVisible())) await page.locator('button', { hasText: 'Your mistakes' }).first().click();
    await row.scrollIntoViewIfNeeded();
    if (!(await row.getAttribute('data-open'))) await row.locator('.rp-q__bar').click();
    const show = row.locator('button', { hasText: /show the answer|see the answer|show answer|show me/i }).first();
    if (await show.count()) await show.click();
    await page.waitForSelector('#q-2 .kc-line', { timeout: 15000 });
    await page.locator('#q-2 .kc-line').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150));
  } },
  { name: 'cards-home-loading', url: `${P}view=cards&plan=free&data=loading`, wait: '.kc-skel', sizes: [390] },
  { name: 'cards-home-off', url: `${P}view=cards&plan=free&kc=off`, wait: '.kc-quiet-state', sizes: [390] },
  { name: 'cards-home-error', url: `${P}view=cards&plan=free&kc=error`, wait: '.ui-state', sizes: [390] },
  { name: 'cards-home-sparse', url: `${P}view=cards&plan=free&kc=sparse`, wait: '.kc-row', sizes: [390] },
  { name: 'deck-empty', url: `${P}view=deck&plan=pro&kc=empty`, wait: '.kc-quiet-state', sizes: [390] },
];

const sizes = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
const errors = [];
const profile = mkdtempSync(join(tmpdir(), 'kc-walk-'));
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const theme of ['dark', 'light']) {
    for (const size of [390, 1440]) {
      const ctx = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: size === 390 ? 2 : 1, hasTouch: size === 390, colorScheme: theme });
      await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
      for (const shot of SHOTS) {
        if (only && !shot.name.includes(only)) continue;
        if (shot.sizes && !shot.sizes.includes(size)) continue;
        if (shot.sizes && theme === 'light' && !shot.lightToo) continue;
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${shot.name} ${size} ${theme}: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error' && !/Fixture endpoint not supplied|status of 503|status of 418|status of 404|status of 402|favicon/i.test(m.text())) errors.push(`${shot.name} ${size} ${theme} console: ${m.text().slice(0, 200)}`); });
        const file = join(out, `${shot.name}-${size}-${theme === 'dark' ? 'night' : 'day'}.png`);
        try {
          await page.goto(`${base}${shot.url}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });
          await page.waitForSelector(shot.wait, { timeout: 60000, state: shot.attached ? 'attached' : 'visible' });
          await page.waitForTimeout(700);
          if (shot.act) await shot.act(page);
          await page.waitForTimeout(450);
          await page.screenshot({ path: file, fullPage: Boolean(shot.full) });
          console.log('saved', file);
        } catch (e) {
          errors.push(`${shot.name} ${size} ${theme}: ${e.message.split('\n')[0]}`);
          try { await page.screenshot({ path: file.replace('.png', '-FAILED.png') }); } catch { /* none */ }
        }
        await page.close();
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
if (errors.length) { console.log('ERRORS'); for (const e of errors) console.log(' ', e); process.exit(1); }
