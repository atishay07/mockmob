// Learn v2 round 6, Web E (LK37) capture: Learn home's offer length and the chapter page's "What's in this run" switches.
// Capture only: no product code, no push, no deploy, no database write (the preview student lives in memory).
//   node scripts/design-audit/learn-1103-choices-capture.mjs http://localhost:3464 <out dir>
//   ONLY=<job ids>   SIZES=390,1440   THEMES=dark,light
// One headless Chromium under the global mkdir lock ../tmp-devslots/browser.lock (stale after 10 minutes); its pids are killed at the end.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, statSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3464', OUTARG = 'tmp/learn-1103/web-e'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const LOCK = resolve(ROOT, '../tmp-devslots/browser.lock');
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const sizeFilter = (process.env.SIZES || '').split(',').filter(Boolean);
const themeFilter = (process.env.THEMES || '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = { 1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false }, 390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true } };
const IGN = /Fixture endpoint not supplied|favicon|Download the React DevTools|status of 40[1-4]|status of 418|status of 503/i;
const P = '/preview/arena?decks=real&study=on&';
const C1 = 'accountancy.partnership-fundamentals';
const AOP = 'accountancy.admission-of-partner';
const home = (plan, student) => `${P}view=learn2&plan=${plan}&student=${student}&subject=accountancy`;
const chapter = (key, plan, student, min) => `${P}view=learn2-chapter&plan=${plan}&student=${student}&chapter=${key}&min=${min}`;

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

const api = (page, { plan, student, kcs }, to, { method = 'GET', body = null, query = {} } = {}) => page.evaluate(async ({ plan: pl, student: st, kcs: s, to: path, method: m, body: b, query: q }) => {
  const u = new URLSearchParams({ _to: path, _plan: pl, _student: st, _s: s, ...q });
  const res = await fetch(`/preview/arena/realdeck?${u}`, { method: m, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) });
  return { status: res.status, body: await res.json().catch(() => null) };
}, { plan, student, kcs, to, method, body, query });
async function endOpenRun(page, who) {
  const s = await api(page, who, '/api/learn/subject', { query: { subject: 'accountancy' } });
  const id = s.body?.roadmap?.key?.run?.resume;
  if (id) await api(page, who, `/api/learn/runs/${id}/end`);
}

async function makeEnv(browser, id, size, theme) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); localStorage.removeItem('mm:learn2:minutes'); } catch { /* none */ } }, theme);
  const page = await ctx.newPage();
  const env = { ctx, page, id, size, theme, touch: S.touch, errors: [], kcs: `e-${id}-${size}-${theme}-${Date.now() % 1e9}` };
  page.on('pageerror', (e) => env.errors.push(`pageerror ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGN.test(m.text())) env.errors.push(m.text().slice(0, 200)); });
  return env;
}
const press = (env, loc) => (env.touch ? loc.tap() : loc.click());
async function open(env, url, waitSel, extra = 1800) {
  await env.page.goto(`${BASE}${url}&kcs=${encodeURIComponent(env.kcs)}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await env.page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' }).catch(() => {});
  await env.page.waitForSelector(waitSel, { timeout: 120000, state: 'visible' });
  await env.page.waitForTimeout(extra);
}
const themeName = (t) => (t === 'dark' ? 'night' : 'day');
async function png(env, base, { full = false } = {}) {
  const file = `${base}-${env.size}-${themeName(env.theme)}.png`;
  await env.page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll('main, .st-view')) el.scrollTop = 0; });
  await env.page.waitForTimeout(300);
  await env.page.screenshot({ path: join(OUT, file), fullPage: full });
  console.log('saved', file, env.errors.length ? `(${env.errors.length} console errors: ${env.errors[0]})` : '');
}
const prime = async (env, plan, student) => {
  await env.page.goto(`${BASE}${P}view=today&plan=${plan}&student=${student}&kcs=${encodeURIComponent(env.kcs)}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await endOpenRun(env.page, { plan, student, kcs: env.kcs });
};
const HERO = '.lh-hero:not(.lh-hero--skel)';
const GO = '.lc-go__key, .lc-resume__key';

const SHOTS = [
  { id: 'home-offer', async run(env) {
    await prime(env, 'pro', 'commerce');
    await open(env, home('pro', 'commerce'), `${HERO} .lh-hero__len`);
    await png(env, 'e01-home-offer-10');
    await press(env, env.page.locator('.lh-hero__len [role="radio"]').nth(2));
    await env.page.waitForFunction(() => /20 minutes/.test(document.querySelector('.lh-hero__title')?.textContent || ''), null, { timeout: 15000 });
    await env.page.waitForTimeout(700);
    await png(env, 'e02-home-offer-20');
    await press(env, env.page.locator('.lh-hero__len [role="radio"]').nth(3));
    await env.page.waitForSelector('.lc-own', { state: 'visible' });
    await env.page.waitForTimeout(500);
    await png(env, 'e03-home-offer-other-sheet');
  } },
  { id: 'home-free', async run(env) {
    await open(env, home('free', 'new'), `${HERO} .lh-hero__len`);
    await press(env, env.page.locator('.lh-hero__len [role="radio"]').nth(2));
    await env.page.waitForSelector('.lh-hero__cap', { timeout: 15000 });
    await env.page.waitForTimeout(600);
    await png(env, 'e04-home-free-20-capped');
  } },
  { id: 'chapter-switches', async run(env) {
    await open(env, chapter(C1, 'pro', 'commerce', 10), GO);
    await png(env, 'e05-chapter-run-10', { full: env.size === '390' });
    const piles = env.page.locator('.lc-pile__btn[role="switch"]');
    const n = await piles.count();
    // leave the second pile out, then look at the live line
    await press(env, piles.nth(1));
    await env.page.waitForTimeout(900);
    await png(env, 'e06-chapter-run-10-one-out', { full: env.size === '390' });
    // try to switch every other pile off: the last one in must shake and stay
    for (let i = 0; i < n; i += 1) { if ((await piles.nth(i).getAttribute('aria-checked')) === 'true') await press(env, piles.nth(i)); await env.page.waitForTimeout(250); }
    await env.page.waitForTimeout(600);
    await png(env, 'e07-chapter-run-10-last-in', { full: env.size === '390' });
  } },
  { id: 'chapter-20', async run(env) {
    await open(env, chapter(AOP, 'pro', 'commerce', 20), GO);
    const fresh = env.page.locator('.lc-fresh');
    if (await fresh.count()) { await press(env, fresh.first()); await env.page.waitForTimeout(700); }
    await png(env, 'e08-chapter-run-20', { full: env.size === '390' });
  } },
  { id: 'chapter-free', async run(env) {
    await open(env, chapter(C1, 'free', 'commerce', 10), GO);
    await png(env, 'e09-chapter-free', { full: env.size === '390' });
  } },
];

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
  for (const shot of SHOTS) {
    if (only.length && !only.includes(shot.id)) continue;
    for (const size of ['390', '1440']) {
      for (const theme of ['dark', 'light']) {
        if (sizeFilter.length && !sizeFilter.includes(size)) continue;
        if (themeFilter.length && !themeFilter.includes(theme)) continue;
        const env = await makeEnv(browser, shot.id, size, theme);
        try { await shot.run(env); } catch (e) {
          console.log('FAILED', shot.id, size, theme, e.message.split('\n')[0]);
          try { await env.page.screenshot({ path: join(OUT, `ZZ-FAILED-${shot.id}-${size}-${themeName(theme)}.png`) }); } catch { /* none */ }
        }
        await env.ctx.close().catch(() => {});
      }
    }
  }
} finally {
  await browser?.close().catch(() => {});
  await sleep(800);
  for (const x of shellPids().filter((p) => pids.includes(p))) { try { execFileSync('taskkill', ['/PID', String(x), '/T', '/F']); } catch { /* none */ } }
  dropLock();
}
