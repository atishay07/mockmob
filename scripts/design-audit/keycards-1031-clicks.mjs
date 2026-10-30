// Key cards web screens: the primary and recovery actions clicked for real (CDP mouse events at the control's centre, never
// element.click()), against `next dev` with the preview fixtures. Each step also checks that the control is the element at
// that point, so an invisible layer fails it.
//   node scripts/design-audit/keycards-1031-clicks.mjs http://localhost:3417
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3417'] = process.argv.slice(2);
const P = `${base}/preview/arena?`;

const results = [];
const ONLY = process.env.ONLY || '';
async function press(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const hit = await page.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py); return el ? el.outerHTML.slice(0, 80) : null; }, [x, y]);
  const own = await locator.evaluate((el, [px, py]) => { const at = document.elementFromPoint(px, py); return Boolean(at && (at === el || el.contains(at))); }, [x, y]);
  if (!own) throw new Error(`covered by ${hit}`);
  await page.mouse.click(x, y);
}
async function step(name, size, fn) {
  if (ONLY && !name.includes(ONLY)) return;
  try { await fn(); results.push(`ok    ${size} ${name}`); } catch (e) { results.push(`FAIL  ${size} ${name}: ${e.message.split('\n')[0]}`); }
}

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const size of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: size === 390 ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: size === 390, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const open = async (q, wait, state = 'visible') => { await page.goto(`${P}${q}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; }' }); await page.waitForSelector(wait, { timeout: 60000, state }); await page.waitForTimeout(800); };

    await step('home: Accountancy tab, then the other Part', size, async () => {
      await open('view=cards&plan=pro', '.kc-row');
      await press(page, page.locator('.kc-subjects__btn', { hasText: 'Accountancy' }));
      await page.waitForSelector('.kc-opt');
      await press(page, page.locator('.kc-opt__btn', { hasText: 'Computerised' }));
      await page.waitForSelector('.kc-opt__btn[aria-checked="true"]:has-text("Computerised")', { timeout: 8000 });
    });
    await step('home: a chapter row opens its deck', size, async () => {
      await open('view=cards&plan=pro', '.kc-row');
      await press(page, page.locator('.kc-row__link').first());
      await page.waitForSelector('.kc-dhead', { timeout: 30000 });
    });
    await step('deck Free: Add chapter to Revise', size, async () => {
      await open('view=deck&plan=free', '.kc-entry');
      await press(page, page.locator('.kc-side .kc-btn--volt'));
      await page.waitForSelector('.kc-inrevise', { timeout: 8000 });
    });
    await step('deck: Study tab, tap the card, rate Got it', size, async () => {
      await open('view=deck&plan=pro', '.kc-entry');
      await press(page, page.locator('.kc-seg__btn', { hasText: 'Study' }));
      await page.waitForSelector('.kc-play__card[data-tap]');
      await press(page, page.locator('.kc-play__prompt'));
      await page.waitForSelector('.kc-rate');
      await press(page, page.locator('.kc-rate__btn[data-rating="3"]'));
      await page.waitForFunction(() => /^2 of /.test(document.querySelector('.kc-pos')?.textContent || ''), null, { timeout: 8000 });
    });
    await step('deck: Last look Next', size, async () => {
      await open('view=deck&plan=pro&mode=last', '.kc-look');
      await press(page, page.locator('.kc-look__keys .kc-btn--volt'));
      await page.waitForFunction(() => /^2 of /.test(document.querySelector('.kc-pos')?.textContent || ''), null, { timeout: 8000 });
    });
    await step('deck: Report this card, sent', size, async () => {
      await open('view=deck&plan=pro', '.kc-entry');
      await press(page, page.locator('.kc-menu__btn').first());
      await press(page, page.locator('.kc-menu__item', { hasText: 'Report this card' }));
      await page.locator('.kc-report textarea').fill('A word differs from page 3.');
      await press(page, page.locator('.kc-report button[type="submit"]'));
      await page.waitForSelector('.kc-report--sent', { timeout: 8000 });
    });
    await step('revise: a Key card rated and the run moves on', size, async () => {
      await open('view=revise&plan=pro&revise=keycards&source=keycards', '.kc-play');
      await press(page, page.locator('.kc-play__keys .kc-btn'));
      await press(page, page.locator('.kc-rate__btn[data-rating="4"]'));
      await page.waitForFunction(() => /^2 of 3/.test(document.querySelector('.rvs-kind b')?.textContent || ''), null, { timeout: 8000 });
    });
    await step('result: Add both to Revise under a wrong answer', size, async () => {
      await open('view=result&plan=free', '#q-2', 'attached');
      const row = page.locator('#q-2');
      if (!(await row.isVisible())) await press(page, page.locator('button', { hasText: 'Your mistakes' }).first());
      if (!(await row.getAttribute('data-open'))) await press(page, row.locator('.rp-q__bar'));
      await press(page, row.locator('button', { hasText: /show the answer/i }).first());
      await page.waitForSelector('#q-2 .kc-line', { timeout: 15000 });
      await press(page, row.locator('.kc-line button'));
      await page.waitForSelector('#q-2 .kc-line .kc-inrevise', { timeout: 8000 });
    });
    await ctx.close();
  }
  // Reduced motion: everything lands at once and stays visible.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await step('reduced motion: rows and cards are fully visible at once', 390, async () => {
    await page.goto(`${P}view=deck&plan=pro`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('.kc-entry');
    const o = await page.evaluate(() => [...document.querySelectorAll('.kc-entry, .kc-panel')].slice(0, 4).map((el) => getComputedStyle(el).opacity + getComputedStyle(el).animationName));
    if (!o.every((v) => v.startsWith('1none'))) throw new Error(o.join(' '));
  });
  await ctx.close();
} finally {
  await browser.close();
}
console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
