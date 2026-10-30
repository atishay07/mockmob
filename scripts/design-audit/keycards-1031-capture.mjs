// Key cards web screens (KEYCARDS-BUILD-SPEC.md section 3, proof): every screen at 390 and 1440 px, Night and Day, against
// `next dev` with the preview fixtures (/preview/arena?view=cards|deck|revise|result|today|review, /preview/study), never
// production data. Headless playwright-core with its own temp profile; the preview's development note is hidden in the shots.
//   node scripts/design-audit/keycards-1031-capture.mjs http://localhost:3417 tmp/walk-1031/web
//   PLAYWRIGHT_CORE=<path to playwright-core>  HEADLESS_SHELL=<path to chrome-headless-shell.exe>  ONLY=<substring>  THEMES=dark,light  SIZES=390,1440
// Phone shots of long screens are full pages; desktop shots are the viewport (what a student sees first). Each shot also
// hit-tests its main control with elementFromPoint, so an invisible layer over the page fails the run.
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [base = 'http://localhost:3417', out = 'tmp/walk-1031/web'] = process.argv.slice(2);
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const themes = (process.env.THEMES || 'dark,light').split(',');
const sizeList = (process.env.SIZES || '390,1440').split(',').map(Number);
mkdirSync(out, { recursive: true });

const P = '/preview/arena?';
const reveal = async (page) => { await page.keyboard.press('Space'); await page.waitForSelector('.kc-rate'); };
const SHOTS = [
  // /cards
  { name: 'cards-home-free', url: `${P}view=cards&plan=free`, wait: '.kc-row', full: 'phone', hit: '.kc-row__link' },
  { name: 'cards-home-pro', url: `${P}view=cards&plan=pro`, wait: '.kc-row', full: 'phone', hit: '.kc-today__key' },
  { name: 'cards-home-option', url: `${P}view=cards&plan=pro&subject=accountancy`, wait: '.kc-opt', full: 'phone', hit: '.kc-opt__btn' },
  // /cards/[chapter]
  { name: 'deck-read-free', url: `${P}view=deck&plan=free`, wait: '.kc-entry', full: 'phone', hit: '.kc-seg__btn' },
  { name: 'deck-read-pro', url: `${P}view=deck&plan=pro`, wait: '.kc-entry', full: 'phone', hit: '.kc-seg__btn' },
  { name: 'deck-read-formula', url: `${P}view=deck&plan=pro&chapter=accountancy.accounting-ratios`, wait: '.kc-entry', full: 'phone' },
  { name: 'deck-study-front', url: `${P}view=deck&plan=pro&mode=study`, wait: '.kc-play', hit: '.kc-play__keys .kc-btn' },
  { name: 'deck-study-answer', url: `${P}view=deck&plan=pro&mode=study`, wait: '.kc-play', act: reveal, hit: '.kc-rate__btn' },
  { name: 'deck-study-end-free', url: `${P}view=deck&plan=free&mode=study`, wait: '.kc-play', act: async (page) => {
    for (let i = 0; i < 5; i += 1) { await reveal(page); await page.keyboard.press(i === 4 ? '1' : i % 2 ? '2' : '3'); await page.waitForTimeout(350); }
    await page.waitForSelector('.kc-end');
  } },
  { name: 'deck-last-look', url: `${P}view=deck&plan=pro&mode=last`, wait: '.kc-look', act: async (page) => { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350); } },
  { name: 'deck-menu-report', url: `${P}view=deck&plan=pro`, wait: '.kc-entry', act: async (page) => {
    await page.locator('.kc-menu__btn').first().click();
    await page.waitForSelector('.kc-menu__list');
    await page.waitForTimeout(250);
  } },
  { name: 'deck-report-form', url: `${P}view=deck&plan=pro`, wait: '.kc-entry', act: async (page) => {
    await page.locator('.kc-menu__btn').first().click();
    await page.locator('.kc-menu__item', { hasText: 'Report this card' }).click();
    await page.waitForSelector('.kc-report textarea');
  } },
  // Revise
  { name: 'revise-queue-head', url: `${P}view=revise&plan=pro&revise=keycards`, wait: '.rvs-mix' },
  { name: 'revise-keycards', url: `${P}view=revise&plan=pro&revise=keycards&source=keycards`, wait: '.kc-play', act: reveal, hit: '.kc-rate__btn' },
  { name: 'revise-free-limit', url: `${P}view=revise&plan=free&revise=keycards&source=keycards&kc=limit`, wait: '.kc-play', act: async (page) => { await reveal(page); await page.keyboard.press('2'); await page.waitForSelector('.kc-end--limit'); } },
  // The line you needed
  { name: 'result-line-you-needed', url: `${P}view=result&plan=free`, wait: '#q-2', attached: true, act: async (page) => {
    const row = page.locator('#q-2');
    if (!(await row.isVisible())) await page.locator('button', { hasText: 'Your mistakes' }).first().click();
    await row.scrollIntoViewIfNeeded();
    if (!(await row.getAttribute('data-open'))) await row.locator('.rp-q__bar').click();
    // The answer stays sealed until the student asks; the line you needed comes with it (it would give the answer away).
    const show = row.locator('button', { hasText: /show the answer/i }).first();
    if (await show.count()) await show.click();
    await page.waitForSelector('#q-2 .kc-line', { timeout: 15000 });
    await page.locator('#q-2 .kc-line').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120));
  } },
  // Entry points
  { name: 'entry-learn-row', url: '/preview/study', wait: '.cx-row', act: async (page) => {
    await page.waitForSelector('a.cx-row[href*="cards"]', { timeout: 20000 });
    await page.locator('a.cx-row[href*="cards"]').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 220));
  } },
  { name: 'entry-today-revise', url: `${P}view=today&plan=pro&revise=keycards`, wait: '.tq__tile', act: async (page) => {
    await page.locator('.tq').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 160));
  } },
  // States
  { name: 'cards-home-loading', url: `${P}view=cards&plan=free&data=loading`, wait: '.kc-skel', sizes: [390] },
  { name: 'cards-home-off', url: `${P}view=cards&plan=free&kc=off`, wait: '.kc-quiet-state', sizes: [390] },
  { name: 'cards-home-error', url: `${P}view=cards&plan=free&kc=error`, wait: '.ui-state', sizes: [390] },
  { name: 'cards-home-sparse', url: `${P}view=cards&plan=free&kc=sparse`, wait: '.kc-row', sizes: [390] },
  { name: 'deck-empty', url: `${P}view=deck&plan=pro&kc=empty`, wait: '.kc-quiet-state', sizes: [390] },
  // Pro chapter sheet, as printed
  { name: 'deck-print-sheet', url: `${P}view=deck&plan=pro`, wait: '.kc-entry', sizes: [1440], themes: ['dark'], print: true },
];

const sizes = { 390: { width: 390, height: 844 }, 1440: { width: 1440, height: 900 } };
const errors = [];
const profile = mkdtempSync(join(tmpdir(), 'kc-walk-'));
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const theme of themes) {
    for (const size of sizeList) {
      const ctx = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: size === 390 ? 2 : 1, hasTouch: size === 390, isMobile: size === 390, colorScheme: theme });
      await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
      for (const shot of SHOTS) {
        if (only.length && !only.some((o) => shot.name.includes(o))) continue;
        if (shot.sizes && !shot.sizes.includes(size)) continue;
        if (shot.themes && !shot.themes.includes(theme)) continue;
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${shot.name} ${size} ${theme}: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error' && !/Fixture endpoint not supplied|status of 503|status of 418|status of 404|status of 402|status of 401|favicon|Download the React DevTools/i.test(m.text())) errors.push(`${shot.name} ${size} ${theme} console: ${m.text().slice(0, 200)}`); });
        const file = join(out, `${shot.name}-${size}-${theme === 'dark' ? 'night' : 'day'}.png`);
        try {
          await page.goto(`${base}${shot.url}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });
          await page.waitForSelector(shot.wait, { timeout: 60000, state: shot.attached ? 'attached' : 'visible' });
          await page.waitForTimeout(1100);
          if (shot.act) await shot.act(page);
          await page.waitForTimeout(500);
          if (shot.hit) {
            // Nothing invisible may cover the main control: the element at its centre is the control or inside it.
            const covered = await page.locator(shot.hit).first().evaluate((el) => {
              const r = el.getBoundingClientRect();
              if (r.bottom < 0 || r.top > innerHeight) return null;
              const at = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1));
              return at && (el === at || el.contains(at)) ? null : (at ? `${at.tagName}.${at.className}` : 'nothing');
            });
            if (covered) errors.push(`${shot.name} ${size} ${theme}: ${shot.hit} is covered by ${covered}`);
          }
          if (shot.print) await page.emulateMedia({ media: 'print' });
          const full = shot.full === true || (shot.full === 'phone' && size === 390);
          await page.screenshot({ path: file, fullPage: full || Boolean(shot.print) });
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
