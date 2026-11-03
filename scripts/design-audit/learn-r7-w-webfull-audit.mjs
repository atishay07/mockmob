// Learn v2 round 7, packet W (LK62, LK59): the phone website as the full product, and the recommendations as one module.
// Audit capture: for each signed-in page, at 390 and 1440, Night and Day, a first-screen shot (and a full page at 390), plus a census
// of what a student can reach (every visible link and button, its place on the page, and the links the page holds but hides) and
// every recommendation line on the page (its words, where, its type size). Capture only: preview decks=real, no push, no DB write.
//   node scripts/design-audit/learn-r7-w-webfull-audit.mjs http://localhost:3465 tmp/learn-1103/r7-w/before
//   ONLY=<page ids>   SIZES=390,1440   THEMES=dark,light   FULL=0
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3465', OUTARG = 'tmp/learn-1103/r7-w/before'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const LOCK = process.env.BROWSER_LOCK || resolve(ROOT, '../tmp-devslots/browser.lock');
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const sizes = (process.env.SIZES || '390,1440').split(',').filter(Boolean);
const themes = (process.env.THEMES || 'dark,light').split(',').filter(Boolean);
const FULL = process.env.FULL !== '0';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = { 390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true }, 1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false } };
const P = '/preview/arena?decks=real&study=on&plan=pro&student=commerce&data=ready&';
const PAGES = [
  { id: 'learn', url: `${P}view=learn2&subject=accountancy`, wait: '.lh-hero:not(.lh-hero--skel), .lh-err' },
  { id: 'learn-find', url: `${P}view=learn2&subject=accountancy&lv=find`, wait: '.lh-find' },
  { id: 'chapter', url: `${P}view=learn2-chapter&chapter=accountancy.admission-of-partner`, wait: '.lc-go__key, .lc-resume__key' },
  { id: 'cards', url: `${P}view=learn2-cards&chapter=accountancy.admission-of-partner`, wait: '.lcv, .lc-cards, main h1' },
  { id: 'explore', url: `${P}view=explore`, wait: '.fxc-row:not(.fxc-row--skel) .fxc-cover, .fxc-msg' },
  { id: 'practice', url: `${P}view=dashboard`, wait: 'main h1, main h2' },
  { id: 'today', url: `${P}view=today`, wait: 'main h1' },
  { id: 'papers', url: `${P}view=review`, wait: 'main h1, main h2' },
];
// Every line on a page that recommends something to the student (what to do next, and why): the words a student reads as advice.
const REC = [
  ['learn: offer headline', '.lh-hero__title'], ['learn: offer line', '.lh-hero__line'], ['learn: offer sub', '.lh-hero__sub'], ['learn: Or row', '.lh-or__row'],
  ['learn: roadmap verdict', '.lh-row__verdict'], ['learn: roadmap here', '.lh-row__here'], ['learn: header note', '.lh-map__new, .lh-note'],
  ['explore: cover For you', '.fxc-line--lead'], ['explore: cover line', '.fxc-line:not(.fxc-line--lead)'], ['explore: feed Mobi', '.dfm, .feed-mobi, [class*="mobi-note"], [class*="MobiNote"]'],
  ['chapter: lead reason', '.lc-go__why, .lc-why, .lc-lead__why, .lc-reason'], ['chapter: verdict', '.lc-state, .lc-verdict'],
  ['today: move', '.tm-move, .today-move, [class*="today-move"], [class*="TodayMove"]'], ['today: weak', '[class*="today-weak"], .tw-row'], ['today: cue', '[class*="today-cue"], .tcue'],
  ['any: Mobi note', '[class*="mobi"][class*="note"], [class*="mobi-line"], [class*="mobi-say"]'],
];

let beat = null;
async function takeLock() {
  for (let i = 0; i < 600; i += 1) {
    try { mkdirSync(LOCK); break; } catch {
      try { if (Date.now() - statSync(LOCK).mtimeMs > 10 * 60 * 1000) { rmSync(LOCK, { recursive: true, force: true }); continue; } } catch { /* gone */ }
      await sleep(3000);
    }
  }
  beat = setInterval(() => { try { const t = new Date(); utimesSync(LOCK, t, t); } catch { /* none */ } }, 20000);
}
const dropLock = () => { if (beat) clearInterval(beat); try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* none */ } };

const census = (page, rec) => page.evaluate((REC) => {
  const vh = innerHeight;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  const where = (el) => (el.closest('.arena-topbar') ? 'topbar' : el.closest('.arena-dock') ? 'dock' : el.closest('.arena-sidebar') ? 'sidebar' : el.closest('.arena-placetabs, [aria-label="Practice pages"]') ? 'tabs' : el.closest('.arena-sheet') ? 'sheet' : el.closest('.arena-fixture-note') ? 'preview-note' : 'page');
  const all = [...document.querySelectorAll('a[href], button, [role="tab"], select, input[type="search"]')].filter((el) => !el.closest('.arena-fixture-note, nextjs-portal'));
  const shown = []; const hidden = [];
  for (const el of all) {
    const item = { t: label(el), href: el.getAttribute('href') || null, where: where(el) };
    if (!item.t && !item.href) continue;
    if (vis(el)) { const r = el.getBoundingClientRect(); shown.push({ ...item, y: Math.round(r.top + scrollY), first: r.top < vh }); } else hidden.push(item);
  }
  const recs = [];
  for (const [kind, sel] of REC) {
    for (const el of document.querySelectorAll(sel)) {
      if (!vis(el) || el.closest('.arena-fixture-note')) continue;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      recs.push({ kind, text: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 120), y: Math.round(r.top + scrollY), first: r.top < vh, size: cs.fontSize, weight: cs.fontWeight, colour: cs.color });
    }
  }
  return { height: document.documentElement.scrollHeight, vh, shown, hidden, recs };
}, rec);

async function run() {
  await takeLock();
  const browser = await chromium.launch({ executablePath, args: ['--disable-gpu'] });
  const report = {};
  try {
    for (const pg of PAGES.filter((p) => !only.length || only.includes(p.id))) {
      for (const size of sizes) {
        for (const theme of themes) {
          const S = SIZES[size];
          const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
          await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); localStorage.setItem('mm:fxc:nudged', '1'); } catch { /* none */ } }, theme);
          const page = await ctx.newPage();
          const errors = [];
          page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
          const name = `${pg.id}-${size}-${theme === 'dark' ? 'night' : 'day'}`;
          try {
            await page.goto(`${BASE}${pg.url}&kcs=r7w-${name}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
            await page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' }).catch(() => {});
            await page.waitForSelector(pg.wait, { timeout: 120000, state: 'visible' }).catch(() => errors.push(`wait ${pg.wait} timed out`));
            await page.waitForTimeout(1800);
            await page.screenshot({ path: join(OUT, `${name}.png`) });
            if (FULL && size === '390' && theme === 'dark') await page.screenshot({ path: join(OUT, `${name}-full.png`), fullPage: true });
            if (theme === 'dark') report[`${pg.id}-${size}`] = { ...(await census(page, REC)), errors };
            console.log('saved', name, errors.length ? errors : '');
          } catch (e) { console.log('failed', name, e.message.slice(0, 200)); }
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
    dropLock();
    writeFileSync(join(OUT, 'census.json'), JSON.stringify(report, null, 1));
  }
}
run().catch((e) => { console.error(e); dropLock(); process.exit(1); });
