// Learn v2 round 2, packet P3 (chapter page, Explore, Saved, the phone tab row, Practice) AFTER capture (1 Nov 2026).
//   node scripts/design-audit/learn-1101-r2-p3-capture.mjs http://localhost:3483 tmp/learn-1101/r2-after/p3
//   ONLY=<substrings of a shot id>   SIZES=390,1440   THEMES=dark,light
// One headless Chromium under the CROSS-PACKET mkdir lock ../tmp-devslots/browser.lock (stale after 10 minutes, touched every
// 20 s, removed at the end); the pids it started are killed at the end. Results go to <out>/index.json.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3483', OUTARG = 'tmp/learn-1101/r2-after/p3'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const LOCK = process.env.BROWSER_LOCK || resolve(ROOT, '../tmp-devslots/browser.lock');
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
const view = (v, plan = 'pro', student = 'commerce', extra = '') => `${P}view=${v}&plan=${plan}&student=${student}${extra}`;
const chapterUrl = (chapter, plan, student, min = '') => `${P}view=learn2-chapter&plan=${plan}&student=${student}&chapter=${chapter}${min ? `&min=${min}` : ''}`;
const CH_WAIT = '.lc-go__key, .lc-resume__key';
const COVERS = '.fxc-row:not(.fxc-row--skel) .fxc-cover';

let beat = null;
async function takeLock() {
  for (let i = 0; i < 400; i += 1) {
    try { mkdirSync(LOCK); break; } catch {
      try { if (Date.now() - statSync(LOCK).mtimeMs > 10 * 60 * 1000) { rmSync(LOCK, { recursive: true, force: true }); continue; } } catch { /* gone */ }
      await sleep(3000);
    }
    if (i === 399) throw new Error('browser lock busy for 20 minutes');
  }
  beat = setInterval(() => { try { const t = new Date(); utimesSync(LOCK, t, t); } catch { /* none */ } }, 20000);
}
const dropLock = () => { if (beat) clearInterval(beat); try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* none */ } };

const STATE_FILE = join(OUT, 'index.json');
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { pngs: [], failures: [], notes: [] };
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
const themeName = (t) => (t === 'dark' ? 'night' : 'day');

async function makeEnv(browser, shot, size, theme) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
  const page = await ctx.newPage();
  const env = { ctx, page, size, theme, touch: S.touch, vp: S.viewport, shot, errors: [], kcs: `r2p3-${shot.id}-${size}-${theme}-${Date.now() % 1e9}` };
  page.on('pageerror', (e) => env.errors.push(`pageerror ${e.message.slice(0, 160)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGN.test(m.text())) env.errors.push(m.text().slice(0, 160)); });
  return env;
}
async function open(env, url, waitSel, extra = 1500) {
  await env.page.goto(`${BASE}${url}&kcs=${encodeURIComponent(env.kcs)}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await env.page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' }).catch(() => {});
  await env.page.waitForSelector(waitSel, { timeout: 120000, state: 'visible' });
  env.url = url;
  await env.page.waitForTimeout(extra);
}
async function png(env, base, what, { full = false } = {}) {
  const { page } = env;
  await page.waitForFunction(() => ![...document.querySelectorAll('.skeleton')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }), null, { timeout: 15000 }).catch(() => state.notes.push(`${base}: skeleton still showing`));
  const file = `${base}-${env.size}-${themeName(env.theme)}.png`;
  await page.screenshot({ path: join(OUT, file), fullPage: full });
  const dim = full ? await page.evaluate(() => `${innerWidth}x${document.documentElement.scrollHeight}`) : `${env.vp.width}x${env.vp.height}`;
  state.pngs = state.pngs.filter((p) => p.file !== file);
  state.pngs.push({ file, what, size: `${env.size} (${dim}${SIZES[env.size].dsf === 2 ? ', scale 2' : ''})`, theme: themeName(env.theme), job: env.shot.id, url: env.url || '', errors: env.errors.slice(0, 4) });
  console.log('saved', file, env.errors.length ? `(${env.errors.length} console errors)` : '');
}
const toTop = (page) => page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll('main')) el.scrollTop = 0; });
const scrollTo = (page, sel, offset = 72) => page.evaluate(([s, o]) => { const el = document.querySelector(s); if (!el) return; const y = el.getBoundingClientRect().top + window.scrollY - o; window.scrollTo(0, y); for (const m of document.querySelectorAll('main')) { if (m.scrollHeight > m.clientHeight + 4) m.scrollTop += el.getBoundingClientRect().top - o; } }, [sel, offset]);

const SHOTS = [
  { id: 'chapter-pro', async run(env) {
    await open(env, chapterUrl(C1, 'pro', 'commerce', 10), CH_WAIT, 2200); await toTop(env.page);
    await png(env, '40-chapter-pro-returning', 'Chapter page, returning Pro (Accounting for Partnership: Basic Concepts, 10 min): 32 px title, piles, Start, Quick recap, First up');
    if (env.size === 390) await png(env, '40-chapter-pro-returning-full', 'Chapter page, returning Pro, the full page', { full: true });
  } },
  { id: 'chapter-free-fresh', async run(env) {
    await open(env, chapterUrl(C1, 'free', 'new'), CH_WAIT, 2200); await toTop(env.page);
    await png(env, '89-chapter-free-fresh', 'Chapter page, brand-new Free student (no verdict, no first-visit line, First up)');
    if (env.size === 390) await png(env, '89-chapter-free-fresh-full', 'Chapter page, brand-new Free student, the full page (no "No lesson yet" line)', { full: true });
  } },
  { id: 'chapter-resume', async run(env) {
    await open(env, chapterUrl(AOP, 'pro', 'commerce', 10), CH_WAIT, 2200); await toTop(env.page);
    if (!(await env.page.locator('.lc-resume').count())) state.notes.push(`chapter-resume ${env.size} ${env.theme}: no resume row`);
    await png(env, '42-chapter-resume', 'Chapter page with an unfinished run: one main key (Pick up), the picker under "Start fresh instead"');
    if (await env.page.locator('.lc-fresh').count()) {
      await (env.touch ? env.page.locator('.lc-fresh').tap() : env.page.locator('.lc-fresh').click());
      await env.page.waitForTimeout(700);
      await png(env, '42-chapter-resume-fresh-open', 'Chapter page with an unfinished run, "Start fresh instead" opened');
    }
  } },
  { id: 'chapter-free-returning', async run(env) {
    await open(env, chapterUrl(C1, 'free', 'commerce'), CH_WAIT, 2200); await toTop(env.page);
    await png(env, '41-chapter-free-returning', 'Chapter page, returning Free student');
  } },
  { id: 'explore-top', async run(env) {
    await open(env, view('explore'), COVERS, 2800); await toTop(env.page);
    await png(env, '81-explore-top', 'Explore top: the four-tab row (Explore marked), the subject and "Saved 2" in one row, the covers near the top (Pro, Commerce)');
    if (env.size === 390) await png(env, '81-explore-full', 'Explore, the full page (Pro, Commerce)', { full: true });
  } },
  { id: 'explore-below', async run(env) {
    await open(env, view('explore'), COVERS, 2800);
    await env.page.waitForSelector('.ex-question', { timeout: 30000 }).catch(() => state.notes.push('explore-below: no question cards'));
    await scrollTo(env.page, '#ex-questions', env.size === 390 ? 120 : 96);
    await env.page.waitForTimeout(700);
    await png(env, '82-explore-singles', 'Explore below the covers: "Single questions", 3 stems (options on tap), More questions');
  } },
  { id: 'explore-first', async run(env) {
    await open(env, view('explore', 'free', 'new'), COVERS, 2800); await toTop(env.page);
    await png(env, '90-explore-first-visit', 'Explore for a first-time Free student: "Start here", "Cards and questions"');
  } },
  { id: 'saved', async run(env) {
    await open(env, view('saved'), '.sv-list, .sv-empty', 2500); await toTop(env.page);
    await png(env, '83-saved-in-explore', 'Saved inside Explore: the tab row marks Explore, "‹ Explore" above the title, no swipe sentence');
  } },
  { id: 'practice', async run(env) {
    await open(env, view('dashboard'), 'main', 3800); await toTop(env.page);
    await png(env, '80-practice', 'Practice page (Pro, Commerce): the four equal tabs, no "Unlimited" pill or access sentence, no "Included" badges');
    if (env.size === 390) await png(env, '80-practice-full', 'Practice, the full page (no second Learn card)', { full: true });
  } },
  { id: 'practice-free', async run(env) {
    await open(env, view('dashboard', 'free'), 'main', 3800); await toTop(env.page);
    await png(env, '80-practice-free', 'Practice page on Free: the balance stays, prices on the tiles');
  } },
];

const MATRIX = [[390, 'dark'], [390, 'light'], [1440, 'dark'], [1440, 'light']];
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
      state.failures = state.failures.filter((f) => !(f.job === shot.id && f.size === size && f.theme === themeName(theme)));
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const env = await makeEnv(browser, shot, size, theme);
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
  console.log('p3 capture done');
}
