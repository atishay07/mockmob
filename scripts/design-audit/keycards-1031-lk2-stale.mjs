// LK2, a failed re-read after a saved choice (390 px, Night and Day): the page keeps its list and its picker, one line says
// "Saved. The chapter list did not refresh." with Try again, and Try again lands the new list. Writes tmp/lk-1031/lk2-stale-*.png.
//   node scripts/design-audit/keycards-1031-lk2-stale.mjs http://localhost:3441 tmp/lk-1031
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3441', out = 'tmp/lk-1031'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const homeRead = (url) => url.pathname === '/preview/arena/realdeck' && url.searchParams.get('_to') === '/api/keycards';
const browser = await chromium.launch({ headless: true, executablePath });
let bad = 0;
try {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: theme });
    await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
    const page = await ctx.newPage();
    const tag = theme === 'dark' ? 'night' : 'day';
    await page.goto(`${base}/preview/arena?decks=real&view=cards&student=commerce&plan=pro&subject=accountancy&kcs=lk2-stale-${tag}-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });
    await page.waitForSelector('.kc-opt__btn', { timeout: 90000 });
    await page.waitForTimeout(1200);
    const radios = page.locator('.kc-opt__btn');
    const match = (u) => homeRead(u);
    await page.route(match, (route) => (route.request().method() === 'GET' ? route.abort() : route.continue()));
    await radios.nth(1).click();
    await page.waitForFunction(() => document.querySelector('.kc-opt__fine')?.textContent.includes('did not refresh'), null, { timeout: 20000 });
    await page.waitForTimeout(400);
    await page.locator('.kc-opt').evaluate((el) => window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 140)));
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => ({
      checked: [...document.querySelectorAll('.kc-opt__btn')].findIndex((b) => b.getAttribute('aria-checked') === 'true'),
      rows: document.querySelectorAll('.kc-row').length,
      errorPage: Boolean(document.querySelector('[role="alert"]') && document.body.textContent.includes('Key cards did not load')),
      busy: document.querySelector('#kc-units')?.getAttribute('aria-busy'),
      again: document.querySelector('.kc-opt__again')?.getBoundingClientRect().height,
    }));
    console.log(tag, 'after failed re-read', JSON.stringify(state));
    if (state.checked !== 1 || !state.rows || state.errorPage || state.busy === 'true' || !state.again || state.again < 44) bad += 1;
    await page.screenshot({ path: join(out, `lk2-stale-1-failed-${tag}.png`) });
    await page.unroute(match);
    await page.locator('.kc-opt__again').click();
    await page.waitForFunction(() => document.querySelector('.kc-opt__fine')?.textContent.startsWith('Only that'), null, { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `lk2-stale-2-retried-${tag}.png`) });
    console.log(tag, 'after Try again: selected', await page.evaluate(() => [...document.querySelectorAll('.kc-opt__btn')].findIndex((b) => b.getAttribute('aria-checked') === 'true')), 'rows', await page.locator('.kc-row').count());
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (bad) { console.log('FAILED'); process.exit(1); }
