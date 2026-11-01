// Learn v2 round-2 "before" capture, the extras the final job list misses (1 Nov 2026): the Practice tab row, Today, the Learn
// home for a brand-new Free student and a returning Pro student (also full page), the first-time Explore feed, Find, the stop
// sheet in Day, and the Free end of the feed and of the run. Capture only; no product code is touched.
//   node scripts/design-audit/learn-1101-r2-extra-capture.mjs http://localhost:3471 tmp/learn-1101/r2-before
//   ONLY=<substrings of a shot id>   SIZES=390,1440   THEMES=dark,light
// Same rules as learn-1101-final-capture.mjs: one headless Chromium, held under the mkdir lock tmp/learn-1101/browser.lock (touched
// every 20 s, removed at the end). Results are merged into <out>/extra-index.json.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3471', OUTARG = 'tmp/learn-1101/r2-before'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const LOCK = join(ROOT, 'tmp/learn-1101/browser.lock');
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const sizeFilter = (process.env.SIZES || '').split(',').filter(Boolean).map(Number);
const themeFilter = (process.env.THEMES || '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = {
  1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false },
  390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true },
};
const IGN = /Fixture endpoint not supplied|favicon|Download the React DevTools|status of 40[1-4]|status of 418|status of 503/i;
const P = '/preview/arena?decks=real&study=on&';
const C1 = 'accountancy.partnership-fundamentals';
const AOP = 'accountancy.admission-of-partner';
const exploreUrl = (plan = 'pro', student = 'commerce') => `${P}view=explore&plan=${plan}&student=${student}`;
const feedUrl = (plan = 'pro', chapter = AOP, student = 'commerce') => `${P}view=learn2-feed&plan=${plan}&student=${student}&chapter=${chapter}&min=10`;
const homeUrl = (plan, student, subject = 'accountancy', lv = '') => `${P}view=learn2&plan=${plan}&student=${student}${subject ? `&subject=${subject}` : ''}${lv ? `&lv=${lv}` : ''}`;
const chapterUrl = (chapter, plan, student) => `${P}view=learn2-chapter&plan=${plan}&student=${student}&chapter=${chapter}`;
const runUrl = (chapter, plan, student) => `${P}view=learn2-run&plan=${plan}&student=${student}&chapter=${chapter}&min=10&kind=mix`;
const view = (v, plan = 'pro', student = 'commerce') => `${P}view=${v}&plan=${plan}&student=${student}`;

// ---- lock --------------------------------------------------------------------------------------------------------------
let beat = null;
async function takeLock() {
  mkdirSync(join(ROOT, 'tmp/learn-1101'), { recursive: true });
  for (let i = 0; i < 400; i += 1) {
    try { mkdirSync(LOCK); break; } catch {
      try { if (Date.now() - statSync(LOCK).mtimeMs > 5 * 60 * 1000) { rmSync(LOCK, { recursive: true, force: true }); continue; } } catch { /* gone */ }
      await sleep(3000);
    }
    if (i === 399) throw new Error('browser lock busy for 20 minutes');
  }
  beat = setInterval(() => { try { const t = new Date(); utimesSync(LOCK, t, t); } catch { /* none */ } }, 20000);
}
const dropLock = () => { if (beat) clearInterval(beat); try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* none */ } };

const STATE_FILE = join(OUT, 'extra-index.json');
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { pngs: [], failures: [], notes: [] };
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
const themeName = (t) => (t === 'dark' ? 'night' : 'day');

async function makeEnv(browser, shot, size, theme) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
  const page = await ctx.newPage();
  const env = { ctx, page, size, theme, touch: S.touch, vp: S.viewport, shot, errors: [], kcs: `r2x-${shot.id}-${size}-${theme}-${Date.now() % 1e9}` };
  page.on('pageerror', (e) => env.errors.push(`pageerror ${e.message.slice(0, 160)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGN.test(m.text())) env.errors.push(m.text().slice(0, 160)); });
  return env;
}
const press = (env, loc) => (env.touch ? loc.tap() : loc.click());
async function open(env, url, waitSel, extra = 1500) {
  await env.page.goto(`${BASE}${url}&kcs=${encodeURIComponent(env.kcs)}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await env.page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' }).catch(() => {});
  await env.page.waitForSelector(waitSel, { timeout: 120000, state: 'visible' });
  env.url = url;
  await env.page.waitForTimeout(extra);
}
async function png(env, base, what, { full = false } = {}) {
  const page = env.page;
  await page.waitForFunction(() => ![...document.querySelectorAll('.skeleton')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }), null, { timeout: 15000 }).catch(() => env.notes?.push?.('skeleton still showing'));
  const file = `${base}-${env.size}-${themeName(env.theme)}.png`;
  await page.screenshot({ path: join(OUT, file), fullPage: full });
  const dim = full ? await page.evaluate(() => `${innerWidth}x${document.documentElement.scrollHeight}`) : `${env.vp.width}x${env.vp.height}`;
  state.pngs = state.pngs.filter((p) => p.file !== file);
  state.pngs.push({ file, what, size: `${env.size} (${dim}${SIZES[env.size].dsf === 2 ? ', scale 2' : ''})`, theme: themeName(env.theme), job: env.shot.id, url: env.url || '' });
  console.log('saved', file);
}

// ---- drivers (the feed's .st-* and the run's .lr-*) -----------------------------------------------------------------------
const feedKind = (page) => page.evaluate(() => {
  if (document.querySelector('.st-end')) return { k: 'end', ready: Boolean(document.querySelector('.st-end .st-endform__title')) };
  const pages = [...document.querySelectorAll('.st-track > .st-page')];
  const p = pages.find((x) => !x.hasAttribute('inert'));
  if (!p) return { k: 'none' };
  if (p.querySelector('.st-cp')) return { k: 'checkpoint' };
  if (p.classList.contains('st-page--q')) return { k: 'q', answered: Boolean(p.querySelector('.st-opt[data-state="right"], .st-opt[data-state="wrong"]')) };
  return { k: 'card', turned: Boolean(p.querySelector('.st-card[data-turned]')) };
});
const stepKey = (page) => page.locator('.st-bar .kc-btn--volt.st-step:visible').last();
async function feedToEnd(env) {
  const { page } = env;
  for (let i = 0; i < 120; i += 1) {
    const s = await feedKind(page);
    if (s.k === 'end') { await page.waitForSelector('.st-end .st-endform__title', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500); return true; }
    if (s.k === 'none') { await page.waitForTimeout(800); continue; }
    if (s.k === 'q' && !s.answered) {
      await press(env, page.locator('.st-track > .st-page:not([inert]) .st-opt').first());
      await page.waitForSelector('.st-track > .st-page:not([inert]) .st-opt[data-state="right"], .st-track > .st-page:not([inert]) .st-opt[data-state="wrong"], .st-track > .st-page:not([inert]) .st-opt[data-state="key"]', { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    if (s.k === 'card' && !s.turned) { await press(env, stepKey(page)); await page.waitForTimeout(450); }
    await press(env, stepKey(page)).catch(() => {});
    await page.waitForTimeout(650);
  }
  return false;
}
const runKind = (page) => page.evaluate(() => {
  if (document.querySelector('.lr-body--end')) return { k: 'end' };
  if (document.querySelector('.lr-round')) return { k: 'round' };
  const a = document.querySelector('.lr-area');
  if (!a) return { k: 'none' };
  if (a.dataset.type === 'question') return { k: 'q', answered: Boolean(document.querySelector('.lr-opt[data-state="right"], .lr-opt[data-state="wrong"], .lr-opt[data-state="key"]')) || Boolean(document.querySelector('.lr-verdict')) };
  if (a.dataset.type === 'lesson') return { k: 'lesson' };
  return { k: 'card', rate: Boolean(document.querySelector('.lr-keys--rate')) };
});
async function runToEnd(env) {
  const { page } = env;
  for (let i = 0; i < 160; i += 1) {
    const s = await runKind(page);
    if (s.k === 'end') { await page.waitForSelector('.lr-endform__title, .lr-endform__name', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1700); return true; }
    if (s.k === 'none') { await page.waitForTimeout(800); continue; }
    if (s.k === 'q' && !s.answered) { await press(env, page.locator('.lr-opt').first()); await page.waitForSelector('.lr-verdict', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(700); continue; }
    if (s.k === 'round') { await press(env, page.locator('.lr-round .kc-btn--volt')); await page.waitForTimeout(350); continue; }
    if (s.k === 'card' && s.rate) { await press(env, page.locator('.lr-rate[data-rating="3"]')); await page.waitForTimeout(900); continue; }
    if (s.k === 'lesson') { await press(env, page.locator('.lr-keys--lesson .kc-btn--line')); await page.waitForTimeout(600); continue; }
    await press(env, page.locator('.lr-bar .kc-btn--volt').first()).catch(() => {});
    await page.waitForTimeout(550);
  }
  return false;
}
const toTop = (page) => page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll('main, .st-view')) el.scrollTop = 0; });

// ---- shots: sizes x themes default 390 dark+light, 1440 dark -------------------------------------------------------------------
const MATRIX = [[390, 'dark'], [390, 'light'], [1440, 'dark']];
const SHOTS = [
  { id: 'practice-dashboard', async run(env) {
    await open(env, view('dashboard'), 'main', 3500); await toTop(env.page);
    await png(env, '80-practice-dashboard', 'Practice page (dashboard) top: the row of Practice tabs on a phone (Practice, Learn, Your papers, Explore, Saved); Pro, Commerce student');
    if (env.size === 390) await png(env, '80-practice-dashboard-full', 'Practice page, the full page (Pro, Commerce student)', { full: true });
  } },
  { id: 'practice-explore-tabs', async run(env) {
    await open(env, exploreUrl(), '.fxc-row:not(.fxc-row--skel) .fxc-cover', 2500); await toTop(env.page);
    await png(env, '81-explore-top-with-tabs', 'Explore page top with the Practice tab row (Explore selected) and the first chapter cover; Pro, Commerce student');
    if (env.size === 390) await png(env, '81-explore-top-with-tabs-full', 'Explore page, the full page (Pro, Commerce student)', { full: true });
  } },
  { id: 'practice-saved', async run(env) {
    await open(env, view('saved'), 'main', 3500); await toTop(env.page);
    await png(env, '82-saved-top-with-tabs', 'Saved page top with the Practice tab row (Saved selected); Pro, Commerce student');
  } },
  { id: 'practice-learn-tab', async run(env) {
    await open(env, homeUrl('pro', 'commerce', null), '.lh .lh-find', 2500); await toTop(env.page);
    await png(env, '83-learn-home-no-subject-pro', 'Learn home with no subject in the address (Pro, Commerce student), the Practice tab row above it');
  } },
  { id: 'today', async run(env) {
    await open(env, view('today'), 'main', 3500); await toTop(env.page);
    await png(env, '84-today-returning-pro', 'Today for a returning Pro student (Commerce)');
    if (env.size === 390) await png(env, '84-today-returning-pro-full', 'Today, the full page (returning Pro, Commerce)', { full: true });
  } },
  { id: 'today-new', async run(env) {
    await open(env, view('today', 'free', 'new'), 'main', 3500); await toTop(env.page);
    await png(env, '85-today-brand-new-free', 'Today for a brand-new Free student (student=new, nothing done)');
    if (env.size === 390) await png(env, '85-today-brand-new-free-full', 'Today, the full page (brand-new Free student)', { full: true });
  } },
  { id: 'home-fresh-free', async run(env) {
    await open(env, homeUrl('free', 'new', 'accountancy'), '.lh .lh-find', 3000); await toTop(env.page);
    await png(env, '86-learn-home-fresh-free', 'Learn home for a brand-new Free student (student=new, zero history), Accountancy; top of the page');
    if (env.size === 390) await png(env, '86-learn-home-fresh-free-full', 'Learn home, brand-new Free student, the full page', { full: true });
  } },
  { id: 'home-fresh-free-nosubject', async run(env) {
    await open(env, homeUrl('free', 'new', null), '.lh .lh-find', 3000); await toTop(env.page);
    await png(env, '87-learn-home-fresh-free-no-subject', 'Learn home for a brand-new Free student with no subject in the address (the default landing)');
  } },
  { id: 'home-pro-full', async run(env) {
    await open(env, homeUrl('pro', 'commerce', 'accountancy'), '.lh-row', 2500); await toTop(env.page);
    await png(env, '88-learn-home-returning-pro-full', 'Learn home for a returning Pro student (Commerce, Accountancy), the full page', { full: true });
  } },
  { id: 'chapter-fresh-free', async run(env) {
    await open(env, chapterUrl(C1, 'free', 'new'), '.lc-pile:not(.lc-pile--skel)', 2500); await toTop(env.page);
    await png(env, '89-chapter-fresh-free', 'Chapter page for a brand-new Free student (Accounting for Partnership: Basic Concepts), top');
    if (env.size === 390) await png(env, '89-chapter-fresh-free-full', 'Chapter page, brand-new Free student, the full page', { full: true });
  } },
  { id: 'chapter-pro-full', async run(env) {
    await open(env, chapterUrl(C1, 'pro', 'commerce'), '.lc-pile:not(.lc-pile--skel)', 2500); await toTop(env.page);
    await png(env, '89-chapter-returning-pro-full', 'Chapter page for a returning Pro student, the full page', { full: true });
  } },
  { id: 'explore-first-visit', async run(env) {
    await open(env, exploreUrl('free', 'new'), '.fxc-row:not(.fxc-row--skel) .fxc-cover', 2500); await toTop(env.page);
    await png(env, '90-explore-first-visit', 'Explore for a first-time visitor (Free, student=new): the covers');
    if (env.size === 390) await png(env, '90-explore-first-visit-full', 'Explore for a first-time visitor, the full page', { full: true });
  } },
  { id: 'feed-first-visit', async run(env) {
    await open(env, feedUrl('free', AOP, 'new'), '.st-page--card:not([inert]), .st-page--q:not([inert])', 2000);
    await png(env, '91-feed-first-visit-first-item', 'Explore feed opened by a first-time student (Free, student=new): the first item as a new visitor sees it (is there any cue that it swipes up?)');
    await env.page.waitForTimeout(4000);
    await png(env, '91-feed-first-visit-after-4s', 'Same, 4 seconds later (does a nudge appear?)');
    await press(env, stepKey(env.page)); await env.page.waitForTimeout(900);
    await png(env, '91-feed-first-visit-card-turned', 'Same, after the step key once (the card turned)');
  } },
  { id: 'find', async run(env) {
    await open(env, homeUrl('pro', 'commerce', 'accountancy', 'find'), '.lh .lh-find', 2500); await toTop(env.page);
    await png(env, '92-find-pro', 'Find view of Learn (lv=find), Pro, Commerce student');
  } },
  { id: 'find-fresh', async run(env) {
    await open(env, homeUrl('free', 'new', 'accountancy', 'find'), '.lh .lh-find', 2500); await toTop(env.page);
    await png(env, '92-find-fresh-free', 'Find view of Learn (lv=find), brand-new Free student');
  } },
  { id: 'stop-sheets', async run(env) {
    const { page } = env;
    await open(env, runUrl(C1, 'pro', 'commerce'), '.lr-area', 1800);
    // the sheet only opens once something was done: turn the first card, rate it, then close
    await press(env, page.locator('.lr-bar .kc-btn--volt').first()); await page.waitForSelector('.lr-keys--rate', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600); await press(env, page.locator('.lr-rate[data-rating="3"]')).catch(() => {}); await page.waitForTimeout(1600);
    if (env.touch) await press(env, page.locator('.lr-close:visible').first()); else await page.keyboard.press('Escape');
    if (await page.waitForSelector('.st-drawer', { timeout: 5000, state: 'visible' }).then(() => true).catch(() => false)) { await page.waitForTimeout(800); await png(env, '93-run-stop-sheet', 'Run, "Stop for now?" (the stop sheet), opened on the first card'); }
    else state.notes.push(`stop-sheets ${env.size} ${env.theme}: the run stop sheet did not open`);
    await open(env, feedUrl('pro', AOP, 'commerce'), '.st-page--card:not([inert]), .st-page--q:not([inert])', 1800);
    await press(env, stepKey(page)); await page.waitForTimeout(500); await press(env, stepKey(page)); await page.waitForTimeout(1200);
    if (env.touch) await press(env, page.locator('.st-iconkey[aria-label="Close the feed"]:visible').first()); else await page.keyboard.press('Escape');
    if (await page.waitForSelector('.st-drawer', { timeout: 5000, state: 'visible' }).then(() => true).catch(() => false)) { await page.waitForTimeout(800); await png(env, '94-feed-stop-sheet', 'Feed, "Stop for now?" (the stop sheet), opened on the first card'); }
    else state.notes.push(`stop-sheets ${env.size} ${env.theme}: the feed stop sheet did not open`);
  } },
  { id: 'free-end-feed', async run(env) {
    await open(env, feedUrl('free', AOP, 'commerce'), '.st-page--card:not([inert]), .st-page--q:not([inert])', 1800);
    const ok = await feedToEnd(env);
    await png(env, '95-feed-end-free', ok ? 'Feed end on Free (a returning Free student, Admission of a Partner): the end with the Free line and See Pro' : 'Feed on Free: the end was NOT reached in 120 steps, this is where the walk stopped');
    if (env.size === 390 && ok) await png(env, '95-feed-end-free-full', 'Feed end on Free, the full end screen', { full: true });
  } },
  { id: 'free-end-run', async run(env) {
    await open(env, runUrl(C1, 'free', 'commerce'), '.lr-area', 1800);
    const ok = await runToEnd(env);
    await png(env, '96-run-end-free', ok ? 'Run end on Free (a returning Free student, Partnership Fundamentals 10 min): the end with the Free line and See Pro' : 'Run on Free: the end was NOT reached in 160 steps, this is where the walk stopped');
  } },
];

// ---- run ---------------------------------------------------------------------------------------------------------------------
const shellPids = () => {
  try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome-headless-shell.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split('\n').map((l) => l.split('","')[1]).filter(Boolean).map(Number); } catch { return []; }
};
const before = new Set(shellPids());
await takeLock();
let browser = null;
let pids = [];
try {
  browser = await chromium.launch({ headless: true, executablePath });
  await sleep(700);
  pids = shellPids().filter((x) => !before.has(x));
  console.log('headless pids started by this run:', pids.join(',') || '(none seen)');
  for (const shot of SHOTS) {
    if (only.length && !only.some((o) => shot.id.includes(o))) continue;
    for (const [size, theme] of MATRIX) {
      if (sizeFilter.length && !sizeFilter.includes(size)) continue;
      if (themeFilter.length && !themeFilter.includes(theme)) continue;
      state.failures = state.failures.filter((f) => !(f.job === shot.id && f.size === size && f.theme === theme));
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const env = await makeEnv(browser, shot, size, theme);
        env.notes = [];
        try { await shot.run(env); await env.ctx.close(); break; } catch (e) {
          const msg = e.message.split('\n')[0];
          console.log('FAILED attempt', attempt, shot.id, size, theme, msg);
          try { await env.page.screenshot({ path: join(OUT, `ZZ-FAILED-${shot.id}-${size}-${themeName(theme)}.png`) }); } catch { /* none */ }
          await env.ctx.close().catch(() => {});
          if (attempt === 2) state.failures.push({ job: shot.id, size, theme: themeName(theme), message: msg });
        }
      }
      saveState();
    }
  }
} finally {
  await browser?.close().catch(() => {});
  await sleep(800);
  for (const x of shellPids().filter((p) => pids.includes(p))) { try { execFileSync('taskkill', ['/PID', String(x), '/T', '/F']); } catch { /* none */ } }
  saveState();
  dropLock();
  console.log('extra capture done');
}
