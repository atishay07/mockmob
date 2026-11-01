// Learn v2 round 4, packet R4-run: the run and the feed after the R4 fixes (a copy of learn-1101-r3-merged-capture.mjs with the
// run and feed jobs, plus r09: a brand-new student's first question with the hint). Capture only: no push, no deploy, no DB write.
//   node scripts/design-audit/learn-1101-r4-run-capture.mjs http://localhost:3482 tmp/learn-1101/r4-after/R4-run
//   ONLY=<job ids, comma separated>   SIZES=390,1440,360x640,1920   THEMES=dark,light
// Consolidates the working parts of learn-1101-r2-home-capture (Learn home), -p2 (run, feed, ends), -p3 and -r3-explore (chapter,
// Explore, Saved, Practice), -extra (Today, Free ends) and hero-1101-r3-capture (the home page) into ONE script, fixed for the round-3
// labels ("Turn over", "Keep going", the phone subject picker, the feed's peek card edge).
// One headless Chromium, held under the GLOBAL mkdir lock ../tmp-devslots/browser.lock (touched every 20 s; stale after 10 minutes;
// removed at the end); the chrome-headless-shell pids this run started are killed at the end. Results merge into <out>/index.json;
// <out>/INDEX.md and <out>/console-errors.txt are rewritten from it after every run. Night = dark theme, Day = light theme.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3482', OUTARG = 'tmp/learn-1101/r4-after/R4-run'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const LOCK = process.env.BROWSER_LOCK || resolve(ROOT, '../tmp-devslots/browser.lock');
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const sizeFilter = (process.env.SIZES || '').split(',').filter(Boolean);
const themeFilter = (process.env.THEMES || '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = {
  1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false },
  390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true },
  '360x640': { viewport: { width: 360, height: 640 }, dsf: 2, touch: true },
  1920: { viewport: { width: 1920, height: 1080 }, dsf: 1, touch: false },
};
const IGN = /Fixture endpoint not supplied|favicon|Download the React DevTools|status of 40[1-4]|status of 418|status of 503/i;
const P = '/preview/arena?decks=real&study=on&';
const C1 = 'accountancy.partnership-fundamentals';
const AOP = 'accountancy.admission-of-partner';
const view = (v, plan = 'pro', student = 'commerce', extra = '') => `${P}view=${v}&plan=${plan}&student=${student}${extra}`;
const homeUrl = (plan, student, subject = 'accountancy', lv = '') => `${P}view=learn2&plan=${plan}&student=${student}${subject ? `&subject=${subject}` : ''}${lv ? `&lv=${lv}` : ''}`;
const chapterUrl = (chapter, plan, student, min = '') => `${P}view=learn2-chapter&plan=${plan}&student=${student}&chapter=${chapter}${min ? `&min=${min}` : ''}`;
const runUrl = (chapter, plan, student) => `${P}view=learn2-run&plan=${plan}&student=${student}&chapter=${chapter}&min=10&kind=mix`;
const feedUrl = (plan = 'pro', chapter = AOP, student = 'commerce') => `${P}view=learn2-feed&plan=${plan}&student=${student}&chapter=${chapter}&min=10`;
const CH_WAIT = '.lc-go__key, .lc-resume__key';
const COVERS = '.fxc-row:not(.fxc-row--skel) .fxc-cover';
const FEED_ITEM = '.st-page--card:not([inert]), .st-page--q:not([inert])';
const LEARN_WAIT = '.lh-hero:not(.lh-hero--skel), .lh-err';

// ---- lock --------------------------------------------------------------------------------------------------------------------
let beat = null;
async function takeLock() {
  for (let i = 0; i < 600; i += 1) {
    try { mkdirSync(LOCK); break; } catch {
      try { if (Date.now() - statSync(LOCK).mtimeMs > 10 * 60 * 1000) { rmSync(LOCK, { recursive: true, force: true }); continue; } } catch { /* gone */ }
      await sleep(3000);
    }
    if (i === 599) throw new Error('browser lock busy for 30 minutes');
  }
  beat = setInterval(() => { try { const t = new Date(); utimesSync(LOCK, t, t); } catch { /* none */ } }, 20000);
}
const dropLock = () => { if (beat) clearInterval(beat); try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* none */ } };

// ---- state -------------------------------------------------------------------------------------------------------------------
const STATE_FILE = join(OUT, 'index.json');
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { pngs: [], failures: [], notes: [], consoles: [] };
state.consoles ||= [];
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
const themeName = (t) => (t === 'dark' ? 'night' : 'day');

async function makeEnv(browser, shot, size, theme) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
  const page = await ctx.newPage();
  const env = { ctx, page, size, theme, touch: S.touch, vp: S.viewport, shot, errors: [], kcs: `r3m-${shot.id}-${size}-${theme}-${Date.now() % 1e9}` };
  page.on('pageerror', (e) => env.errors.push(`pageerror ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGN.test(m.text())) env.errors.push(m.text().slice(0, 200)); });
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
async function png(env, base, what, { full = false, clip = null } = {}) {
  const { page } = env;
  await page.waitForFunction(() => ![...document.querySelectorAll('.skeleton')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }), null, { timeout: 15000 }).catch(() => state.notes.push(`${base} ${env.size} ${themeName(env.theme)}: a skeleton was still showing`));
  const file = `${base}-${env.size}-${themeName(env.theme)}.png`;
  await page.screenshot({ path: join(OUT, file), fullPage: full, ...(clip ? { clip } : {}) });
  const dim = clip ? `${clip.width}x${clip.height} crop` : full ? await page.evaluate(() => `${innerWidth}x${document.documentElement.scrollHeight}`) : `${env.vp.width}x${env.vp.height}`;
  state.pngs = state.pngs.filter((p) => p.file !== file);
  state.pngs.push({ file, what, viewport: `${env.size} (${dim}${SIZES[env.size].dsf === 2 ? ', scale 2' : ''})`, theme: themeName(env.theme), job: env.shot.id, url: env.url || '', errors: env.errors.slice(0, 4) });
  console.log('saved', file, env.errors.length ? `(${env.errors.length} console errors)` : '');
}
const toTop = (page) => page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll('main, .st-view')) el.scrollTop = 0; });
const scrollTo = (page, sel, offset = 72) => page.evaluate(([s, o]) => { const el = document.querySelector(s); if (!el) return; const y = el.getBoundingClientRect().top + window.scrollY - o; window.scrollTo(0, y); for (const m of document.querySelectorAll('main')) { if (m.scrollHeight > m.clientHeight + 4) m.scrollTop += el.getBoundingClientRect().top - o; } }, [sel, offset]);

/** One preview API call inside the page (the realdeck forwarder's own address), for setting a student's state up. */
const api = (page, { plan, student, kcs }, to, { method = 'GET', body = null, query = {} } = {}) => page.evaluate(async ({ plan: pl, student: st, kcs: s, to: path, method: m, body: b, query: q }) => {
  const u = new URLSearchParams({ _to: path, _plan: pl, _student: st, _s: s, ...q });
  const res = await fetch(`/preview/arena/realdeck?${u}`, { method: m, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) });
  return { status: res.status, body: await res.json().catch(() => null) };
}, { plan, student, kcs, to, method, body, query });
async function endOpenRun(page, who) {
  const s = await api(page, who, '/api/learn/subject', { query: { subject: 'accountancy' } });
  const id = s.body?.roadmap?.key?.run?.resume;
  if (id) await api(page, who, `/api/learn/runs/${id}/end`);
  return s.body?.roadmap?.mode;
}
async function useFreeSession(page, who) {
  await endOpenRun(page, who);
  const r = (await api(page, who, '/api/learn/subject', { query: { subject: 'accountancy' } })).body.roadmap;
  const run = (await api(page, who, '/api/learn/runs', { method: 'POST', body: { ...r.key.run, requestKey: `cap-${who.kcs}`.slice(0, 90).replace(/[^A-Za-z0-9_-]/g, '-') } })).body;
  const q = run?.items?.find((i) => i.type === 'question');
  if (q) await api(page, who, `/api/learn/runs/${run.id}/answer`, { method: 'POST', body: { itemId: q.id, choice: q.question.options[0].key } });
  if (run?.id) await api(page, who, `/api/learn/runs/${run.id}/end`);
}
/** Run `setup` (an API call sequence) from a preview page of the same student, then the caller opens the real page. */
async function prime(env, setup, plan, student) {
  await env.page.goto(`${BASE}${view('today', plan, student)}&kcs=${encodeURIComponent(env.kcs)}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await setup(env.page, { plan, student, kcs: env.kcs });
}

// ---- drivers: the feed (.st-*) and the run (.lr-*) -----------------------------------------------------------------------------
const feedKind = (page) => page.evaluate(() => {
  if (document.querySelector('.st-end')) return { k: 'end', ready: Boolean(document.querySelector('.st-end .st-endx__h')) };
  const p = [...document.querySelectorAll('.st-track > .st-page')].find((x) => !x.hasAttribute('inert'));
  if (!p) return { k: 'none' };
  if (p.querySelector('.st-cp')) return { k: 'checkpoint' };
  if (p.classList.contains('st-page--q')) return { k: 'q', answered: Boolean(p.querySelector('.st-opt[data-state="right"], .st-opt[data-state="wrong"]')) };
  return { k: 'card', turned: Boolean(p.querySelector('.st-card[data-turned]')) };
});
const stepKey = (page) => page.locator('.st-bar .st-step.kc-btn--volt:visible').last();
async function feedWalk(env, { untilCheckpoint = false } = {}) {
  const { page } = env;
  for (let i = 0; i < 120; i += 1) {
    const s = await feedKind(page);
    if (s.k === 'end') { await page.waitForSelector('.st-end .st-endx__h', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1600); return 'end'; }
    if (s.k === 'checkpoint' && untilCheckpoint) { await page.waitForTimeout(700); return 'checkpoint'; }
    if (s.k === 'none') { await page.waitForTimeout(800); continue; }
    if (s.k === 'q' && !s.answered) {
      await press(env, page.locator('.st-track > .st-page:not([inert]) .st-opt').first());
      await page.waitForSelector('.st-track > .st-page:not([inert]) .st-opt[data-state]', { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    if (s.k === 'card' && !s.turned) {
      await press(env, stepKey(page)); await page.waitForTimeout(450);
      // keep the 2nd and 5th cards, so the end has a pile
      if (i % 5 === 1) { await press(env, page.locator('.st-bar__side--l .st-railkey').first()).catch(() => {}); await page.waitForTimeout(700); }
    }
    await press(env, stepKey(page)).catch(() => {});
    await page.waitForTimeout(650);
  }
  return 'lost';
}
const runKind = (page) => page.evaluate(() => {
  if (document.querySelector('.lr-body--end')) return { k: 'end' };
  if (document.querySelector('.lr-round')) return { k: 'round' };
  const a = document.querySelector('.lr-area');
  if (!a) return { k: 'none' };
  if (a.dataset.type === 'question') return { k: 'q', answered: Boolean(document.querySelector('.lr-verdict')) };
  if (a.dataset.type === 'lesson') return { k: 'lesson' };
  return { k: 'card', rate: Boolean(document.querySelector('.lr-keys--rate')) };
});
async function runStep(env, s, { pick = 0 } = {}) {
  const { page } = env;
  if (s.k === 'q' && !s.answered) {
    const n = await page.locator('.lr-opt').count();
    await press(env, page.locator('.lr-opt').nth(Math.min(pick, Math.max(0, n - 1)))); await page.waitForSelector('.lr-verdict', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(700); return;
  }
  if (s.k === 'round') { await press(env, page.locator('.lr-round .kc-btn--volt')); await page.waitForTimeout(350); return; }
  if (s.k === 'card' && s.rate) { await press(env, page.locator('.lr-rate[data-rating="3"]')); await page.waitForTimeout(900); return; }
  if (s.k === 'lesson') { await press(env, page.locator('.lr-keys--lesson .kc-btn--line')); await page.waitForTimeout(600); return; }
  await press(env, page.locator('.lr-bar .kc-btn--volt').first()).catch(() => {});
  await page.waitForTimeout(550);
}
async function runToEnd(env) {
  for (let i = 0; i < 160; i += 1) {
    const s = await runKind(env.page);
    if (s.k === 'end') { await env.page.waitForSelector('.st-endx__h', { timeout: 30000 }).catch(() => {}); await env.page.waitForTimeout(1700); return true; }
    if (s.k === 'none') { await env.page.waitForTimeout(800); continue; }
    await runStep(env, s);
  }
  return false;
}
const drawer = (page) => page.waitForSelector('.st-drawer', { timeout: 5000, state: 'visible' }).then(() => true).catch(() => false);
const closeRun = (env) => (env.touch ? press(env, env.page.locator('.lr-close:visible').first()) : env.page.keyboard.press('Escape'));
const closeFeed = (env) => (env.touch ? press(env, env.page.locator('.st-iconkey[aria-label="Close the feed"]:visible').first()) : env.page.keyboard.press('Escape'));

// ---- the home page `/` (from hero-1101-r3-capture) ------------------------------------------------------------------------------
async function openHome(env, extra = 4500) {
  await env.page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 300000 });
  env.url = '/';
  await env.page.waitForTimeout(extra);
}
const homeMeasure = (page) => page.evaluate(() => {
  const title = document.querySelector('.lp-title');
  return { titleText: title?.innerText || null, titleLines: title ? Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)) : null, trust: document.querySelector('.lp-trust-line')?.innerText || null, mobiLines: [...document.querySelectorAll('.lp-mobi__line')].map((l) => l.textContent), overflowX: document.documentElement.scrollWidth > innerWidth };
});
const noteHome = async (env, tag) => { const m = await homeMeasure(env.page); state.notes.push(`home ${tag} ${env.size} ${themeName(env.theme)}: ${JSON.stringify(m)}`); if (m.overflowX) state.notes.push(`home ${tag} ${env.size} ${themeName(env.theme)}: HORIZONTAL OVERFLOW`); };

// ---- the jobs ----------------------------------------------------------------------------------------------------------------
// sizes: default 390 and 1440, each in Night and Day.
const SHOTS = [
  // the home page /
  { id: 'home', sizes: ['390', '1440', '360x640', '1920'], async run(env) {
    await openHome(env);
    if (env.size === '390') {
      await png(env, 'h01-home-first', 'Home page /, first screen');
      await noteHome(env, 'first');
      const h = await env.page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < h; y += 500) { await env.page.evaluate((yy) => window.scrollTo(0, yy), y); await env.page.waitForTimeout(250); }
      await env.page.evaluate(() => window.scrollTo(0, 0)); await env.page.waitForTimeout(800);
      await png(env, 'h02-home-full', 'Home page /, the full page', { full: true });
    } else if (env.size === '360x640') { await png(env, 'h03-home-first', 'Home page /, first screen on a small phone (360x640)'); await noteHome(env, 'first'); }
    else if (env.size === '1920') { await png(env, 'h04-home-first', 'Home page /, first screen at 1920x1080'); await noteHome(env, 'first'); }
    else { await png(env, 'h01-home-first', 'Home page /, first screen'); await noteHome(env, 'first'); }
  } },
  { id: 'home-taps', sizes: ['390', '1440'], async run(env) {
    await openHome(env);
    const sel = env.size === '390' ? '.lp-mobi--room' : '.lp-mobi--host';
    for (let i = 1; i <= 2; i += 1) {
      await env.page.locator(`${sel} .mobi-react__hit`).first().click();
      await env.page.waitForTimeout(900);
      await png(env, `h05-home-mobi-tap${i}`, `Home page /, after Mobi was tapped ${i === 1 ? 'once' : 'twice'}`);
      if (i === 2) await noteHome(env, 'tap2');
    }
  } },

  // Today and Practice
  { id: 'today-new', async run(env) {
    await open(env, view('today', 'free', 'new'), 'main', 3500); await toTop(env.page);
    await png(env, 't01-today-new-free', 'Today for a brand-new Free student (student=new, nothing done), first screen');
    if (env.size === '390') await png(env, 't01-today-new-free-full', 'Today, the full page (brand-new Free student)', { full: true });
  } },
  { id: 'today-pro', async run(env) {
    await open(env, view('today'), 'main', 3500); await toTop(env.page);
    await png(env, 't02-today-returning-pro', 'Today for a returning Pro student (Commerce), first screen');
    if (env.size === '390') await png(env, 't02-today-returning-pro-full', 'Today, the full page (returning Pro, Commerce)', { full: true });
  } },
  { id: 'practice-pro', async run(env) {
    await open(env, view('dashboard'), 'main', 3800); await toTop(env.page);
    await png(env, 'p01-practice-pro-full', 'Practice for Pro (Commerce), the full page', { full: true });
  } },
  { id: 'practice-free', async run(env) {
    await open(env, view('dashboard', 'free'), 'main', 3800); await toTop(env.page);
    await png(env, 'p02-practice-free-full', 'Practice for Free (Commerce), the full page', { full: true });
  } },

  // Learn home
  { id: 'home-new-free', async run(env) {
    await open(env, homeUrl('free', 'new'), LEARN_WAIT, 3000); await toTop(env.page);
    await png(env, 'l01-learn-home-fresh-free', 'Learn home for a brand-new Free student (Accountancy), top of the page');
    if (env.size === '390') await png(env, 'l01-learn-home-fresh-free-full', 'Learn home, brand-new Free student, the full page', { full: true });
  } },
  { id: 'home-returning-pro', async run(env) {
    await prime(env, endOpenRun, 'pro', 'commerce');
    await open(env, homeUrl('pro', 'commerce'), LEARN_WAIT, 2500); await toTop(env.page);
    await png(env, 'l02-learn-home-returning-pro', 'Learn home for a returning Pro student (the seeded unfinished run ended first: Today\'s 10 minutes), top');
    if (env.size === '390') await png(env, 'l02-learn-home-returning-pro-full', 'Learn home, returning Pro student, the full page', { full: true });
  } },
  { id: 'home-unfinished', async run(env) {
    await open(env, homeUrl('pro', 'commerce'), LEARN_WAIT, 2500); await toTop(env.page);
    await png(env, 'l03-learn-home-unfinished-run', 'Learn home for a returning student with an unfinished run (the Continue key), top');
    if (env.size === '390') await png(env, 'l03-learn-home-unfinished-run-full', 'Learn home, unfinished run, the full page', { full: true });
  } },
  { id: 'home-free-done', async run(env) {
    await prime(env, useFreeSession, 'free', 'commerce');
    await open(env, homeUrl('free', 'commerce'), LEARN_WAIT, 2500); await toTop(env.page);
    await png(env, 'l04-learn-home-free-done', 'Learn home for Free after the day\'s session was used, top');
    if (env.size === '390') await png(env, 'l04-learn-home-free-done-full', 'Learn home, Free after the day\'s session, the full page', { full: true });
  } },
  { id: 'home-picker', sizes: ['390'], async run(env) {
    await open(env, homeUrl('pro', 'commerce'), '.lh-picker__btn', 2500); await toTop(env.page);
    await png(env, 'l05-learn-home-picker-closed', 'Learn home on a phone: the subject picker row (closed)');
    await press(env, env.page.locator('.lh-picker__btn').first());
    await env.page.waitForSelector('.lh-psheet__panel', { timeout: 8000, state: 'visible' }).catch(() => state.notes.push(`home-picker ${env.theme}: the sheet did not open`));
    await env.page.waitForTimeout(700);
    await png(env, 'l05-learn-home-picker-open', 'Learn home on a phone: the subject picker open as a bottom sheet');
  } },
  { id: 'dock', sizes: ['390'], async run(env) {
    await open(env, homeUrl('pro', 'commerce'), LEARN_WAIT, 2500); await toTop(env.page);
    await png(env, 'l06-dock-learn', 'The 390 dock at the foot of Learn home (bottom 140 px; the whole first screen is l02/l03)', { clip: { x: 0, y: 704, width: 390, height: 140 } });
    await open(env, view('dashboard'), 'main', 3000); await toTop(env.page);
    await png(env, 'l06-dock-practice', 'The 390 dock at the foot of Practice (bottom 140 px)', { clip: { x: 0, y: 704, width: 390, height: 140 } });
  } },
  { id: 'sidebar', sizes: ['1440'], async run(env) {
    await open(env, view('dashboard'), 'main', 3800); await toTop(env.page);
    await png(env, 'l07-sidebar-practice', '1440, the sidebar on Practice (Practice marked)');
    await open(env, view('explore'), COVERS, 2800); await toTop(env.page);
    await png(env, 'l07-sidebar-explore', '1440, the sidebar on Explore (Explore marked)');
    await open(env, homeUrl('pro', 'commerce'), LEARN_WAIT, 2500); await toTop(env.page);
    await png(env, 'l07-sidebar-learn', '1440, the sidebar on Learn (Learn marked)');
  } },

  // the chapter page
  { id: 'chapter-free-fresh', async run(env) {
    await open(env, chapterUrl(C1, 'free', 'new'), CH_WAIT, 2200); await toTop(env.page);
    await png(env, 'c01-chapter-fresh-free', 'Chapter page for a brand-new Free student (Accounting for Partnership: Basic Concepts), top');
    if (env.size === '390') await png(env, 'c01-chapter-fresh-free-full', 'Chapter page, brand-new Free student, the full page', { full: true });
  } },
  { id: 'chapter-pro', async run(env) {
    await open(env, chapterUrl(C1, 'pro', 'commerce', 10), CH_WAIT, 2200); await toTop(env.page);
    await png(env, 'c02-chapter-returning-pro', 'Chapter page for a returning Pro student (10 min), top');
    if (env.size === '390') await png(env, 'c02-chapter-returning-pro-full', 'Chapter page, returning Pro student, the full page', { full: true });
  } },
  { id: 'chapter-resume', async run(env) {
    await open(env, chapterUrl(AOP, 'pro', 'commerce', 10), CH_WAIT, 2200); await toTop(env.page);
    if (!(await env.page.locator('.lc-resume').count())) state.notes.push(`chapter-resume ${env.size} ${env.theme}: no resume row`);
    await png(env, 'c03-chapter-resume', 'Chapter page with an unfinished run: one main key, Continue');
    if (await env.page.locator('.lc-fresh').count()) {
      await press(env, env.page.locator('.lc-fresh').first());
      await env.page.waitForTimeout(700);
      await png(env, 'c03-chapter-resume-fresh-open', 'Chapter page with an unfinished run, "Start fresh instead" opened');
    }
  } },

  // Explore, Saved
  { id: 'explore-top', async run(env) {
    await open(env, view('explore'), COVERS, 2800); await toTop(env.page);
    await png(env, 'x01-explore-top', 'Explore top (Pro, Commerce): subject and Saved, the covers');
    if (env.size === '390') await png(env, 'x01-explore-full', 'Explore, the full page (Pro, Commerce)', { full: true });
  } },
  { id: 'explore-singles', async run(env) {
    await open(env, view('explore'), COVERS, 2800);
    await env.page.waitForSelector('.ex-question', { timeout: 30000 }).catch(() => state.notes.push('explore-singles: no question cards'));
    await scrollTo(env.page, '#ex-questions', env.size === '390' ? 120 : 96);
    await env.page.waitForTimeout(700);
    await png(env, 'x02-explore-singles', 'Explore, Single questions (3 stems, options on tap)');
  } },
  { id: 'saved', async run(env) {
    await open(env, view('saved'), '.sv-list, .sv-empty', 2500); await toTop(env.page);
    await png(env, 'x03-saved', 'Saved (Pro, Commerce), top');
  } },
  { id: 'explore-l2off', sizes: ['390', '1440'], async run(env) {
    if (env.theme !== 'dark') return;
    const messages = [];
    env.page.on('console', (m) => messages.push(`[${m.type()}] ${m.text().slice(0, 4000)}`));
    env.page.on('pageerror', (e) => messages.push(`[pageerror] ${e.message.slice(0, 4000)}`));
    await open(env, view('explore', 'pro', 'commerce', '&l2=off'), '.ex-page', 3000); await toTop(env.page);
    await env.page.waitForTimeout(2500);
    state.consoles = state.consoles.filter((c) => c.name !== `explore-l2off-${env.size}`);
    state.consoles.push({ name: `explore-l2off-${env.size}`, lines: messages });
    writeFileSync(join(OUT, `explore-l2off-${env.size}-console.txt`), messages.length ? messages.join('\n') : 'no console output');
    await png(env, 'x04-explore-l2off', 'Explore with &l2=off (the old page); the console is in explore-l2off-*-console.txt');
  } },

  // the run (.lr-*)
  { id: 'run', async run(env) {
    const { page } = env;
    await open(env, runUrl(C1, 'pro', 'commerce'), '.lr-area', 1800);
    await png(env, 'r01-run-card-front', 'Run, a Key card face up (front), the Turn over key');
    await press(env, page.locator('.lr-card').first()); await page.waitForSelector('.lr-keys--rate', { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(700);
    await png(env, 'r02-run-card-turned', 'Run, the same card turned, with the rating keys');
    const got = { q: false, wrong: false };
    for (let i = 0; i < 60 && !got.wrong; i += 1) {
      const s = await runKind(page);
      if (s.k === 'end') break;
      if (s.k === 'q' && !s.answered) {
        if (!got.q) { await page.waitForTimeout(500); await png(env, 'r03-run-question', 'Run, a question not yet answered'); got.q = true; }
        const n = await page.locator('.lr-opt').count();
        await runStep(env, s, { pick: i % Math.max(1, n) });
        if (await page.locator('.lr-opt[data-state="wrong"]').count()) { await page.waitForTimeout(900); await png(env, 'r04-run-wrong-line', 'Run, a wrong answer with the line you needed'); got.wrong = true; }
        continue;
      }
      await runStep(env, s);
    }
    if (!got.wrong) state.notes.push(`run ${env.size} ${env.theme}: no wrong answer reached`);
    await closeRun(env);
    if (await drawer(page)) { await page.waitForTimeout(600); await png(env, 'r05-run-stop-sheet', 'Run, the "Stop for now?" sheet'); await press(env, page.locator('.st-drawer .st-textkey').first()); await page.waitForTimeout(500); }
    else state.notes.push(`run ${env.size} ${env.theme}: the stop sheet did not open`);
    const ok = await runToEnd(env);
    await png(env, 'r06-run-end', ok ? 'Run end (Pro): what moved, the lead key, the lines' : 'Run: the end was NOT reached (the last state shown)');
  } },
  { id: 'run-stopped', async run(env) {
    const { page } = env;
    await open(env, runUrl(C1, 'pro', 'commerce'), '.lr-area', 1800);
    for (let i = 0; i < 6; i += 1) { const s = await runKind(page); await runStep(env, s); }
    await closeRun(env);
    if (await drawer(page)) { await press(env, page.locator('.st-drawer .kc-btn--volt, .st-drawer .st-drawer__keys button').first()); await page.waitForSelector('.st-endx__h', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1700); }
    else state.notes.push(`run-stopped ${env.size} ${env.theme}: the stop sheet did not open`);
    await png(env, 'r07-run-end-stopped', 'Run end after "Stop here" part way: Stopped at N of M');
  } },
  { id: 'run-first-question', async run(env) {
    const { page } = env;
    await open(env, runUrl(C1, 'free', 'new'), '.lr-area', 1800);
    for (let i = 0; i < 40; i += 1) {
      const s = await runKind(page);
      if (s.k === 'q' && !s.answered) { await page.waitForTimeout(600); await png(env, 'r09-run-first-question-hint', 'Run, a brand-new student’s first question: the hint once, above the options'); return; }
      if (s.k === 'end') break;
      await runStep(env, s);
    }
    state.notes.push(`run-first-question ${env.size} ${env.theme}: no question reached`);
  } },
  { id: 'run-free-end', async run(env) {
    await open(env, runUrl(C1, 'free', 'commerce'), '.lr-area', 1800);
    const ok = await runToEnd(env);
    await png(env, 'r08-run-end-free', ok ? 'Run end on Free (a returning Free student): the Free line and See Pro' : 'Run on Free: the end was NOT reached (the last state shown)');
  } },

  // the feed (.st-*)
  { id: 'feed-first', async run(env) {
    await open(env, feedUrl('free', AOP, 'new'), FEED_ITEM, 2600);
    await png(env, 'f01-feed-first-visit', 'Explore feed, first visit (Free, new): the next item peeks as a card edge, with the chip');
    await press(env, stepKey(env.page)); await env.page.waitForTimeout(900);
    await png(env, 'f02-feed-first-visit-turned', 'Same, the card turned (the chip stays until the student moves)');
    const keys = await env.page.evaluate(() => [...document.querySelectorAll('.st-bar button')].map((b) => `${b.className} | ${b.textContent.trim()} | ${b.offsetParent ? 'shown' : 'hidden'}`));
    state.notes.push(`feed-first ${env.size} ${env.theme}: bar keys after the turn: ${JSON.stringify(keys)}`);
    await press(env, env.page.locator('.st-bar .st-step:visible').last(), 'next'); await env.page.waitForTimeout(1800);
    const chip = await env.page.locator('.st-cue').count();
    state.notes.push(`feed-first ${env.size} ${env.theme}: after moving on once the chip count is ${chip}`);
    await png(env, 'f03-feed-later-item-no-chip', `Explore feed, a later item (the chip count is ${chip}; none expected)`);
  } },
  { id: 'feed', async run(env) {
    const { page } = env;
    await open(env, feedUrl('pro', AOP, 'commerce'), FEED_ITEM, 1800);
    await png(env, 'f04-feed-card-front', 'Feed (Pro), a Key card face up, the next item peeking');
    const r = await feedWalk(env, { untilCheckpoint: true });
    if (r === 'checkpoint') {
      await png(env, 'f05-feed-checkpoint', 'Feed checkpoint: one headline, one line, the kept fan');
      await closeFeed(env);
      if (await drawer(page)) { await page.waitForTimeout(600); await png(env, 'f06-feed-stop-sheet', 'Feed, the "Stop for now?" sheet at the checkpoint'); await press(env, page.locator('.st-drawer .st-textkey').first()); await page.waitForTimeout(500); }
      else state.notes.push(`feed ${env.size} ${env.theme}: the stop sheet did not open`);
      await press(env, stepKey(page)).catch(() => {}); await page.waitForTimeout(600);
    } else state.notes.push(`feed ${env.size} ${env.theme}: no checkpoint reached (${r})`);
    const end = await feedWalk(env);
    await png(env, 'f07-feed-end', end === 'end' ? 'Feed end (Pro): chapter, headline, pile, numbers, bar, the keys' : 'Feed: the end was NOT reached (the last state shown)');
  } },
  { id: 'feed-free-end', async run(env) {
    await open(env, feedUrl('free', AOP, 'commerce'), FEED_ITEM, 1800);
    const end = await feedWalk(env);
    await png(env, 'f08-feed-end-free', end === 'end' ? 'Feed end on Free: the Free line with See Pro' : 'Feed on Free: the end was NOT reached (the last state shown)');
    if (end === 'end') {
      await open(env, feedUrl('free', C1, 'commerce'), '.st-free, .st-state, .st-page--card:not([inert]), .st-page--q:not([inert])', 1800);
      await png(env, 'f09-feed-free-refused', 'Feed start refused on Free after the session: one message and the ways on');
    }
  } },
];

// ---- run -------------------------------------------------------------------------------------------------------------------------
const shellPids = () => {
  try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome-headless-shell.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split('\n').map((l) => l.split('","')[1]).filter(Boolean).map(Number); } catch { return []; }
};
const before = new Set(shellPids());
await takeLock();
let browser = null;
let pids = [];
const DEFAULT_SIZES = ['390', '1440'];
try {
  browser = await chromium.launch({ headless: true, executablePath });
  await sleep(700);
  pids = shellPids().filter((x) => !before.has(x));
  console.log('headless pids started by this run:', pids.join(',') || '(none seen)');
  for (const shot of SHOTS) {
    if (only.length && !only.includes(shot.id)) continue;
    for (const size of shot.sizes || DEFAULT_SIZES) {
      for (const theme of ['dark', 'light']) {
        if (sizeFilter.length && !sizeFilter.includes(size)) continue;
        if (themeFilter.length && !themeFilter.includes(theme)) continue;
        state.failures = state.failures.filter((f) => !(f.job === shot.id && f.size === size && f.theme === themeName(theme)));
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          const env = await makeEnv(browser, shot, size, theme);
          try {
            await Promise.race([shot.run(env), new Promise((_, rej) => { setTimeout(() => rej(new Error('job timed out after 6 minutes')), 6 * 60 * 1000); })]);
            await env.ctx.close(); break;
          } catch (e) {
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
  }
} finally {
  await browser?.close().catch(() => {});
  await sleep(800);
  for (const x of shellPids().filter((p) => pids.includes(p))) { try { execFileSync('taskkill', ['/PID', String(x), '/T', '/F']); } catch { /* none */ } }
  saveState();
  dropLock();
  // INDEX.md and console-errors.txt, rebuilt from everything captured so far
  const real = state.pngs.filter((p) => existsSync(join(OUT, p.file))).sort((a, b) => a.file.localeCompare(b.file));
  const md = ['# Learn v2 round 4, R4-run capture (1 Nov 2026): the run and the feed', '',
    `Made by scripts/design-audit/learn-1101-r4-run-capture.mjs against \`next dev --webpack\` (${BASE}, preview decks=real), never production. Night = dark theme, Day = light theme. Phones 390x844 at scale 2, desktop 1440x900 (a small phone 360x640, a wide desktop 1920x1080 where named).`, '',
    `Image count: ${real.length} PNG.`, '', '| file | viewport | theme | what it shows |', '| --- | --- | --- | --- |',
    ...real.map((p) => `| ${p.file} | ${p.viewport} | ${p.theme === 'night' ? 'Night' : 'Day'} | ${p.what} |`)];
  writeFileSync(join(OUT, 'INDEX.md'), `${md.join('\n')}\n`);
  const ce = ['# Console errors (page errors and console.error, minus the known fixture noise), by shot', ''];
  for (const p of real) for (const e of p.errors || []) ce.push(`${p.file}: ${e}`);
  ce.push('', '# Console output of Explore with &l2=off', '');
  for (const c of state.consoles) ce.push(`${c.name}: ${c.lines.length ? c.lines.join(' || ') : 'no console output'}`);
  ce.push('', '# Failures', '', ...(state.failures.length ? state.failures.map((f) => `${f.job} ${f.size} ${f.theme}: ${f.message}`) : ['none']), '', '# Notes', '', ...state.notes);
  writeFileSync(join(OUT, 'console-errors.txt'), `${ce.join('\n')}\n`);
  console.log(`merged capture done: ${real.length} PNG, ${state.failures.length} failures`);
}
