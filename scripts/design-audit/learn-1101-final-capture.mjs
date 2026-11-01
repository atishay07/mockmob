// Learn v2 final capture (1 Nov 2026): the stills, the measurements and two films of Learn v2 and the Explore feed, against
// `next dev` (the development preview's &decks=real source), never production data. It only captures and measures; it changes no
// product code. Selectors are the shared stage's (src/components/learn2/stage: .st-*), the run player's (.lr-*), the covers'
// (.fxc-*), the chapter page's (.lc-*), Learn home's (.lh-*, .l2f-*) and the Key cards view's (.l2c-*).
//   node scripts/design-audit/learn-1101-final-capture.mjs http://localhost:3451 tmp/learn-1101/final
//   ONLY=<substrings of a job id>   SIZES=1440,390   THEMES=dark,light   (default: everything)
// ONE headless Chromium at a time, and only while holding tmp/learn-1101/browser.lock (a mkdir lock, stale after 5 minutes; this
// script touches it every 20 s and removes it at the end). State is kept in <out>/index.json so partial runs merge;
// index.md is rewritten at the end of every run. The films are recorded with the DevTools screencast and encoded by the local
// ffmpeg that ships with the owner's Remotion install (no download, no new dependency).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const FFMPEG = process.env.FFMPEG || 'C:/Users/atish/Desktop/MockMob-promo-film/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3451', OUTARG = 'tmp/learn-1101/final'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const LOCK = join(ROOT, 'tmp/learn-1101/browser.lock');
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const sizeFilter = (process.env.SIZES || '').split(',').filter(Boolean).map(Number);
const themeFilter = (process.env.THEMES || '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

const QUESTIONS = JSON.parse(readFileSync(join(ROOT, 'data/fixtures/learn-preview-questions.json'), 'utf8')).questions;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const stripLetter = (s) => norm(s).replace(/^(Option\s+)?[A-F][.)]?\s+/i, '');
const LEARNED = [{ start: 'Under the fixed capital method', key: '(B), (A), (C), (D)' }];
const keyTextOf = (f) => {
  const i = 'ABCDEF'.indexOf(f.correct_answer);
  const o = f.options.find((x) => x && x.key === f.correct_answer) || f.options[i];
  return stripLetter(typeof o === 'string' ? o : o?.text);
};
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const fixtureFor = (body) => { const b = key(body); return QUESTIONS.find((q) => key(q.body) === b) || QUESTIONS.find((q) => b.length > 20 && key(q.body).startsWith(b.slice(0, 50))) || null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wait = (page, ms) => page.waitForTimeout(ms);

const P = '/preview/arena?decks=real&study=on&';
const C1 = 'accountancy.partnership-fundamentals';
const AOP = 'accountancy.admission-of-partner';
const CPSR = 'accountancy.change-in-profit-sharing-ratio';
const SIZES = {
  1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false },
  1366: { viewport: { width: 1366, height: 650 }, dsf: 1, touch: false },
  1024: { viewport: { width: 1024, height: 768 }, dsf: 1, touch: false },
  390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true },
  360: { viewport: { width: 360, height: 780 }, dsf: 2, touch: true },
};
const ALL = [1440, 1366, 1024, 390, 360];
const TWO = [1440, 390];
const IGNORE = /Fixture endpoint not supplied|favicon|Download the React DevTools|status of 40[1-4]|status of 418|status of 503/i;

// ---- Lock ------------------------------------------------------------------------------------------------------------------
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

// ---- State kept between runs -----------------------------------------------------------------------------------------------
const STATE_FILE = join(OUT, 'index.json');
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { pngs: [], films: [], pages: [], measures: {}, failures: [], notes: [], cleanup: [] };
state.films ||= [];
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
const dropOld = (jobId, size, theme) => {
  state.pages = state.pages.filter((p) => !(p.job === jobId && p.size === size && p.theme === theme));
  state.failures = state.failures.filter((p) => !(p.job === jobId && p.size === size && p.theme === theme));
};
const themeName = (t) => (t === 'dark' ? 'night' : 'day');

// ---- Page recording --------------------------------------------------------------------------------------------------------
const pathOf = (u) => { try { return new URL(u).pathname; } catch { return String(u).slice(0, 80); } };
async function makeEnv(browser, job, size, theme, extra = {}) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: extra.dsf || S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ }
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none */ }
  }, theme);
  const page = await ctx.newPage();
  const cdp = S.touch ? await ctx.newCDPSession(page) : null;
  const rec = { job: job.id, size, theme, loads: [], errors: [], failed: [], http: [], cls: 0, spill: 0, notes: [], volt: {} };
  rec.loadEvents = 0;
  page.on('load', () => { rec.loadEvents += 1; });
  page.on('pageerror', (e) => rec.errors.push(`pageerror ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) rec.errors.push(m.text().slice(0, 220)); });
  page.on('requestfailed', (r) => rec.failed.push(`${r.method()} ${pathOf(r.url())} ${r.failure()?.errorText || ''}`.trim()));
  page.on('response', (r) => { if (r.status() >= 400 && !IGNORE.test(`status of ${r.status()}`)) rec.http.push(`${r.status()} ${r.request().method()} ${pathOf(r.url())}`); });
  return { ctx, page, cdp, size, theme, touch: S.touch, vp: S.viewport, job, rec, kcs: `a1101f-${job.id}-${size}-${theme}-${Date.now() % 1e9}`, saved: [] };
}
const hideNote = (page) => page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' }).catch(() => {});
const press = (env, loc) => (env.touch ? loc.tap() : loc.click());

async function open(env, url, waitSel, { extraWait = 1200, timeout = 120000 } = {}) {
  const full = `${BASE}${url}&kcs=${encodeURIComponent(env.kcs)}`;
  const t0 = Date.now();
  await env.page.goto(full, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await hideNote(env.page);
  await env.page.waitForSelector(waitSel, { timeout, state: 'visible' });
  env.rec.loads.push({ url, ms: Date.now() - t0, sel: waitSel });
  env.url = url;
  await wait(env.page, extraWait);
}

/** How many volt keys are in view (visible, inside the viewport, not inert or hidden from the reader). */
const voltInView = (page) => page.evaluate(() => [...document.querySelectorAll('.kc-btn--volt, .lh-key--volt')].filter((el) => {
  if (el.closest('[inert], [aria-hidden="true"], [hidden]')) return false;
  const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
  if (!(cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && b.width > 2 && b.height > 2 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth)) return false;
  const at = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1), Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1));
  if (!at) return false;
  const ctl = at.closest('a, button');
  return el === at || el.contains(at) || Boolean(ctl && ctl.contains(el));
}).length).catch(() => -1);

/** One PNG: base is 'NN-area-state'; the file is base-WIDTH-theme.png. */
async function png(env, base, what, { full = false, url = env.url } = {}) {
  const page = env.page;
  await page.waitForFunction(() => ![...document.querySelectorAll('.skeleton')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }), null, { timeout: 15000 }).catch(() => env.rec.notes.push(`${base}: a skeleton was still showing after 15 s`));
  const file = `${base}-${env.size}-${themeName(env.theme)}.png`;
  await page.screenshot({ path: join(OUT, file), fullPage: full });
  const volt = await voltInView(page);
  env.rec.volt[base] = volt;
  const spill = await page.evaluate(() => {
    let worst = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    for (const el of document.querySelectorAll('.st-view, .st-page, .fxc-row')) { if (el.classList.contains('fxc-row')) continue; const was = el.scrollLeft; el.scrollLeft = 200; worst = Math.max(worst, el.scrollLeft); el.scrollLeft = was; }
    return worst;
  }).catch(() => 0);
  env.rec.spill = Math.max(env.rec.spill, spill);
  env.rec.cls = Math.max(env.rec.cls, await page.evaluate(() => window.__cls || 0).catch(() => 0));
  const dim = full ? await page.evaluate(() => `${innerWidth}x${document.documentElement.scrollHeight}`) : `${env.vp.width}x${env.vp.height}`;
  state.pngs = state.pngs.filter((p) => p.file !== file);
  state.pngs.push({ file, url: url || '', what, size: `${env.size} (${dim}${SIZES[env.size].dsf === 2 ? ', scale 2' : ''})`, theme: themeName(env.theme), job: env.job.id, volt });
  env.saved.push(base);
  console.log('saved', file, 'volt', volt);
}
/** Is the element at the centre of `sel` the element itself (or inside it)? Returns null when yes, else what covers it. */
const coverCheck = async (env, sel, label) => {
  const r = await env.page.locator(sel).filter({ visible: true }).first().evaluate((el) => {
    const b = el.getBoundingClientRect();
    if (b.bottom < 0 || b.top > innerHeight) return 'off screen';
    const at = document.elementFromPoint(b.left + b.width / 2, Math.min(b.top + b.height / 2, innerHeight - 1));
    return at && (el === at || el.contains(at)) ? null : (at ? `${at.tagName}.${at.className}` : 'nothing');
  }).catch((e) => `missing (${e.message.split('\n')[0]})`);
  if (r) env.rec.notes.push(`${label || sel} is covered by ${r}`);
  return r;
};
const scrollToEl = (page, sel, offset) => page.locator(sel).first().evaluate((el, o) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o), offset);

// ---- URLs ------------------------------------------------------------------------------------------------------------------
const exploreUrl = (plan = 'pro', student = 'commerce') => `${P}view=explore&plan=${plan}&student=${student}`;
const feedUrl = (plan = 'pro', chapter = AOP, min = 10, student = 'commerce') => `${P}view=learn2-feed&plan=${plan}&student=${student}&chapter=${chapter}&min=${min}`;
const homeUrl = (plan = 'pro', student = 'commerce', subject = 'accountancy') => `${P}view=learn2&plan=${plan}&student=${student}${subject ? `&subject=${subject}` : ''}`;
const chapterUrl = (chapter, min, plan = 'pro', student = 'commerce') => `${P}view=learn2-chapter&plan=${plan}&student=${student}&chapter=${chapter}${min ? `&min=${min}` : ''}`;
const runUrl = (chapter, min, plan = 'pro', student = 'commerce', kind = 'mix') => `${P}view=learn2-run&plan=${plan}&student=${student}&chapter=${chapter}&min=${min}&kind=${kind}`;
const cardsUrl = (chapter, f, plan = 'pro', student = 'commerce') => `${P}view=learn2-cards&plan=${plan}&student=${student}&chapter=${chapter}&f=${f}`;
const COVERS_WAIT = '.fxc-row:not(.fxc-row--skel) .fxc-cover';
const FEED_WAIT = '.st-page--card:not([inert]), .st-page--q:not([inert])';
const CH_WAIT = '.lc-pile:not(.lc-pile--skel)';

// ---- Feed drivers (the shared stage) ---------------------------------------------------------------------------------------
const feedState = (page) => page.evaluate(() => {
  if (document.querySelector('.st-end')) return { k: 'end', ready: Boolean(document.querySelector('.st-end .st-endform__title')) };
  const pages = [...document.querySelectorAll('.st-track > .st-page')];
  const i = pages.findIndex((p) => !p.hasAttribute('inert'));
  const p = pages[i];
  if (!p) return { k: document.querySelector('.st-state') ? 'state' : 'none', i };
  if (p.querySelector('.st-cp')) return { k: 'checkpoint', i };
  if (p.classList.contains('st-page--q')) {
    return { k: 'q', i, answered: Boolean(p.querySelector('.st-opt[data-state="right"], .st-opt[data-state="wrong"]')), body: p.querySelector('.st-stem')?.textContent || '', verdict: p.querySelector('.st-verdict')?.textContent || '' };
  }
  return { k: 'card', i, turned: Boolean(p.querySelector('.st-card[data-turned]')), kept: Boolean(document.querySelector('.st-railkey[data-on]')) };
});
const livePage = (page) => page.locator('.st-track > .st-page:not([inert])');
const stepKey = (page) => page.locator('.st-bar .kc-btn--volt.st-step:visible').last();
async function feedStep(env, { settle = 760 } = {}) {
  const { page } = env;
  const before = (await feedState(page)).i;
  await press(env, stepKey(page));
  await page.waitForFunction((b) => { if (document.querySelector('.st-end')) return true; const pages = [...document.querySelectorAll('.st-track > .st-page')]; const i = pages.findIndex((p) => !p.hasAttribute('inert')); const turned = Boolean(pages[i]?.querySelector('.st-card[data-turned]')); return i !== b || turned || true; }, before, { timeout: 2000 }).catch(() => {});
  await wait(page, settle);
}
/** Turn a card (if face up) and go on: the step key twice on a card, once on an answered question or a checkpoint. */
async function feedNext(env, opts) {
  const s = await feedState(env.page);
  if (s.k === 'card' && !s.turned) await feedStep(env, { settle: 520 });
  await feedStep(env, opts);
}
async function feedAnswer(env, want) {
  const { page } = env;
  const s = await feedState(page);
  const f = fixtureFor(s.body);
  const learned = LEARNED.find((l) => norm(s.body).startsWith(l.start));
  const fx = f || (learned ? { options: [{ key: 'K', text: learned.key }], correct_answer: 'K' } : null);
  const opts = await livePage(page).locator('.st-opt .st-opt__t').allTextContents();
  let idx = want === 'right' ? 0 : 1;
  let known = false;
  if (fx) {
    const keyText = keyTextOf(fx);
    const keyAt = opts.findIndex((t) => stripLetter(t) === keyText);
    if (keyAt >= 0) { known = true; idx = want === 'right' ? keyAt : (keyAt === 0 ? 1 : 0); }
  }
  if (!known) env.rec.notes.push(`answer: the question is not in the fixture (${norm(s.body).slice(0, 50)}), so "${want}" is a guess`);
  const graded = livePage(page).locator('.st-opt[data-state="right"], .st-opt[data-state="wrong"], .st-opt[data-state="key"]').first();
  for (let t = 0; t < 3; t += 1) {
    await press(env, livePage(page).locator('.st-opt').nth(idx));
    if (await graded.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) break;
  }
  await graded.waitFor({ timeout: 6000 });
  const res = (await livePage(page).locator('.st-opt[data-state="right"]').count()) && !(await livePage(page).locator('.st-opt[data-state="wrong"]').count()) ? 'right' : 'wrong';
  return { res, known };
}
const lineOpen = (page) => page.waitForSelector('.st-track > .st-page:not([inert]) .st-lineopen[data-open] .st-line', { timeout: 6000 }).then(() => true).catch(() => false);
const keepKey = (page) => page.locator('.st-railkey:visible').filter({ hasText: /Keep|Kept|In Revise/ }).first();
const stopSheetOpen = (env) => (env.touch ? press(env, env.page.locator('.st-iconkey[aria-label="Close the feed"]:visible').first()) : env.page.keyboard.press('Escape'));
const drawerShown = (page) => page.waitForSelector('.st-drawer', { timeout: 5000, state: 'visible' }).then(() => true).catch(() => false);
/** Touch swipe up (the next item) by the finger, through the DevTools protocol. */
async function swipeUp(env, { share = 0.55, steps = 12, gap = 16 } = {}) {
  const { page, cdp } = env;
  const vp = env.vp;
  const x = Math.round(vp.width * 0.42);
  const distance = Math.round(vp.height * share);
  let y = Math.round(vp.height * 0.8);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let k = 0; k < steps; k += 1) { y -= distance / steps; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y) }] }); await sleep(gap); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(page, 700);
}

/** Free's session is claimed at the first answered question: open a feed on Free and answer one. */
async function claimFree(env, chapter = AOP) {
  await open(env, feedUrl('free', chapter), FEED_WAIT, { extraWait: 1000 });
  for (let i = 0; i < 20; i += 1) {
    const s = await feedState(env.page);
    if (s.k === 'q' && !s.answered) { await feedAnswer(env, 'right'); await wait(env.page, 600); return true; }
    if (s.k === 'end' || s.k === 'none' || s.k === 'state') return false;
    await feedNext(env);
  }
  return false;
}

// ---- Run drivers ------------------------------------------------------------------------------------------------------------
const runState = (page) => page.evaluate(() => {
  if (document.querySelector('.lr-body--end')) return { k: 'end', ready: Boolean(document.querySelector('.lr-endform__title, .lr-endform__name')) };
  if (document.querySelector('.lr-round')) return { k: 'round' };
  const a = document.querySelector('.lr-area');
  if (!a) return { k: 'none' };
  const t = a.dataset.type;
  if (t === 'question') return { k: 'q', answered: Boolean(document.querySelector('.lr-opt[data-state="right"], .lr-opt[data-state="wrong"], .lr-opt[data-state="key"]')) || Boolean(document.querySelector('.lr-verdict')), body: a.querySelector('.lr-q__stem, .lr-stemwrap')?.textContent || '' };
  if (t === 'lesson') return { k: 'lesson' };
  return { k: 'card', rate: Boolean(document.querySelector('.lr-keys--rate')) };
});
async function runAnswer(env, want, body) {
  const { page } = env;
  const f0 = fixtureFor(body);
  const learned = LEARNED.find((l) => norm(body).startsWith(l.start));
  const f = f0 || (learned ? { options: [{ key: 'K', text: learned.key }], correct_answer: 'K' } : null);
  const opts = await page.locator('.lr-opt').evaluateAll((els) => els.map((e) => e.querySelector('.lr-opt__text')?.textContent || ''));
  let idx = want === 'right' ? 0 : 1;
  if (f) {
    const keyAt = opts.findIndex((t) => stripLetter(t) === keyTextOf(f));
    if (keyAt >= 0) idx = want === 'right' ? keyAt : (keyAt === 0 ? 1 : 0);
  }
  await press(env, page.locator('.lr-opt').nth(idx));
  await page.waitForSelector('.lr-verdict', { timeout: 15000 });
  await wait(page, 800);
}
const settleRun = async (page) => { await page.waitForFunction(() => !document.querySelector('.lr[data-leaving]'), null, { timeout: 8000 }).catch(() => {}); await wait(page, 300); };
/** Drive the run until stop(state) is true. */
async function runDrive(env, stop, policy = () => 'right', max = 140) {
  const { page } = env;
  let nq = 0;
  for (let i = 0; i < max; i += 1) {
    const s = await runState(page);
    if (stop(s)) return s;
    if (s.k === 'end') return s;
    if (s.k === 'q' && !s.answered) { await runAnswer(env, policy(s, nq), s.body); nq += 1; continue; }
    if (s.k === 'round') { await press(env, page.locator('.lr-round .kc-btn--volt')); await wait(page, 350); continue; }
    if (s.k === 'card' && s.rate) {
      await press(env, page.locator('.lr-rate[data-rating="3"]'));
      await page.waitForFunction(() => !document.querySelector('.lr-keys--rate') && !document.querySelector('.lr-area[data-leaving]'), null, { timeout: 20000 }).catch(() => {});
      await settleRun(page); continue;
    }
    if (s.k === 'lesson') { await press(env, page.locator('.lr-keys--lesson .kc-btn--line')); await wait(page, 500); await settleRun(page); continue; }
    await press(env, page.locator('.lr-bar .kc-btn--volt').first());
    await wait(page, 480);
    await settleRun(page);
  }
  throw new Error(`the run did not reach the wanted state in ${max} steps`);
}

// ---- The jobs ----------------------------------------------------------------------------------------------------------------
const wantStar = (env, star) => env.theme === 'dark' || star;
const JOBS = [
  // ================= Explore =================
  { id: 'explore-covers', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    await open(env, exploreUrl(), COVERS_WAIT);
    await scrollToEl(env.page, '.fxc', 70); await wait(env.page, 700);
    await coverCheck(env, '.fxc-cover', 'Explore first cover');
    await png(env, '01-explore-covers', 'Explore, the chapter covers in view (Pro, Commerce student)');
  } },
  { id: 'explore-paged', sizes: ALL, themes: ['dark'], async run(env) {
    const { page } = env;
    await open(env, exploreUrl(), COVERS_WAIT);
    await scrollToEl(page, '.fxc', 70); await wait(page, 600);
    const desk = page.locator('.fxc-arrows .fxc-arrow[aria-label="Next chapters"]:visible');
    if (!env.touch && await desk.count() && await desk.first().isEnabled()) {
      await press(env, desk.first()); await wait(page, 1400);
      await png(env, '02-explore-covers-paged', 'Explore, the covers paged once with the arrow (desktop)');
    } else {
      await press(env, page.locator('.fxc-pager .fxc-arrow[aria-label="Next chapter"]:visible').first()); await wait(page, 1300);
      await png(env, '02-explore-covers-second', 'Explore, the second cover snapped into place (phone pager)');
    }
  } },
  { id: 'explore-free-used', sizes: ALL, themes: ['dark'], async run(env) {
    const { page } = env;
    const claimed = await claimFree(env);
    if (!claimed) env.rec.notes.push('the free session was not claimed by an answered question');
    await open(env, exploreUrl('free', 'commerce'), COVERS_WAIT);
    await scrollToEl(page, '.fxc', 70); await wait(page, 700);
    await png(env, '03-explore-free-day-used', 'Explore on Free after the day\'s session was used (an answered question claims it): the "done for today" line');
  } },
  { id: 'explore-l2off', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, `${exploreUrl()}&l2=off`, '.ex-question', { extraWait: 2500 });
    await png(env, '04-explore-flag-off', 'Explore with the live site\'s flag off (&l2=off): no chapter covers, the old page');
  } },

  // ================= Feed (Admission of a Partner, Pro, Commerce) =================
  { id: 'feed-walk', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    const { page } = env;
    const dark = env.theme === 'dark';
    const save = async (base, what, star) => { if (wantStar(env, star)) await png(env, base, what); };
    await open(env, feedUrl(), FEED_WAIT, { extraWait: 1500 });
    await coverCheck(env, '.st-bar .kc-btn--volt.st-step', 'feed step key');
    await save('10-feed-card-front', 'Feed, a Key card face up (front)', true);
    // turn: Space on a computer, a tap on a phone
    if (env.touch) await press(env, livePage(page).locator('.st-card__hit')); else await page.keyboard.press('Space');
    await wait(page, 900);
    await save('11-feed-card-turned', 'Feed, the card turned (NCERT\'s line)', true);
    await press(env, keepKey(page));
    await page.waitForSelector('.st-railkey[data-on]:visible', { timeout: 8000 }).catch(() => env.rec.notes.push('Keep did not show its on state'));
    await wait(page, 1100);
    await save('12-feed-kept', 'Feed, the card kept (the Keep key on, "In Revise")', false);
    const got = { question: false, right: false, streak: false, wrong: false, checkpoint: false, stop: false };
    let nq = 0; let ended = false; let wrongs = 0;
    for (let i = 0; i < 100; i += 1) {
      const s = await feedState(page);
      if (s.k === 'end') {
        await page.waitForSelector('.st-end .st-endform__title', { timeout: 20000 }).catch(() => {});
        await wait(page, 1400);
        await save('18-feed-end', 'Feed, the end (the kept pile, the lines, the keys)', true);
        ended = true; break;
      }
      if (!dark && got.wrong && !got.endSeen) { /* day keeps going to the end */ }
      if (s.k === 'checkpoint') {
        if (!got.checkpoint) { got.checkpoint = true; await wait(page, 500); await save('16-feed-checkpoint', 'Feed, a checkpoint (after 8 items)', false);
          await stopSheetOpen(env);
          if (await drawerShown(page)) { await wait(page, 700); await save('17-feed-stop-sheet', 'Feed, "Stop for now?" (the stop sheet) at the checkpoint', false); got.stop = true; await press(env, page.locator('.st-drawer .kc-btn--line').first()); await wait(page, 600); }
        }
        await feedStep(env); continue;
      }
      if (s.k === 'q' && !s.answered) {
        if (!got.question) { got.question = true; await wait(page, 500); await save('13-feed-question', 'Feed, a question not yet answered', true); }
        const want = (nq === 1 && !got.wrong) ? 'wrong' : 'right';
        const { res } = await feedAnswer(env, want); nq += 1; await wait(page, 700);
        if (res === 'right' && !got.right) { got.right = true; await wait(page, 500); await save('14-feed-right', 'Feed, a right answer ("Right.")', false); }
        if (res === 'right' && !got.streak && /in a row/.test((await feedState(page)).verdict || '')) { got.streak = true; await save('14-feed-right-streak', 'Feed, a right answer with the streak ("Right. 3 in a row.")', false); }
        if (res === 'wrong') {
          wrongs += 1;
          const shown = await lineOpen(page);
          await wait(page, 1500);
          if (!got.wrong) { got.wrong = true; await save('15-feed-wrong-line', shown ? 'Feed, a wrong answer with the line you needed opened under the options' : 'Feed, a wrong answer (no line opened)', true); }
        }
        await feedStep(env); continue;
      }
      if (s.k === 'card' && !s.kept && s.i > 0 && s.i % 4 === 0) { await press(env, keepKey(page)); await wait(page, 500); }
      await feedNext(env);
    }
    if (!ended) env.rec.notes.push('the walk did not reach the end in 100 steps');
    for (const [k, v] of Object.entries(got)) if (!v && dark) state.notes.push(`feed-walk ${env.size}: ${k} was not met during the walk`);
  } },
  { id: 'feed-free', sizes: ALL, themes: ['dark'], async run(env) {
    await open(env, feedUrl('free', AOP, 10, 'commerce'), FEED_WAIT, { extraWait: 1500 });
    await png(env, '20-feed-free-first', 'Feed for a Free returning student (plan=free, student=commerce): the first item');
  } },
  { id: 'feed-free-refused', sizes: ALL, themes: ['dark'], async run(env) {
    const { page } = env;
    const claimed = await claimFree(env, AOP);
    if (!claimed) env.rec.notes.push('the free session was not claimed');
    await open(env, feedUrl('free', C1), '.st-state, .st-page--card:not([inert])', { extraWait: 1500 });
    await png(env, '21-feed-free-refused', 'Feed start refused on Free (the day\'s one session already used): "Today\'s free session is used" and the ways that still work');
    const t = await page.locator('.st-state__title').first().textContent().catch(() => '');
    if (!/free session is used/i.test(t || '')) env.rec.notes.push(`the refused start did not show (title: ${t || 'none'})`);
  } },

  // ================= Learn home =================
  { id: 'home', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    const { page } = env;
    const dark = env.theme === 'dark';
    await open(env, homeUrl(), '.lh-row');
    await coverCheck(env, '.lh-row__link', 'Learn home first chapter row');
    await png(env, '30-home-top', 'Learn home, top of the page (Accountancy, Pro, Commerce student)');
    await press(env, page.locator('.lh-find input'));
    await page.waitForSelector('.lh-find[data-active]', { timeout: 10000 }).catch(() => env.rec.notes.push('the search did not show as focused'));
    await wait(page, 1000);
    await page.evaluate(() => { const el = document.querySelector('.lh-find'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 76); });
    await wait(page, 500);
    if (dark) await png(env, '31-home-search-focused', 'Learn home, the search focused (its shelves: due today, missed lately, in Revise; recent searches when there are some)');
    await page.keyboard.type('goodwill', { delay: 70 });
    await page.waitForSelector('.lh-panel .l2c-row', { timeout: 20000 }).catch(() => env.rec.notes.push('no results appeared for "goodwill"'));
    await wait(page, 1000);
    await png(env, '32-home-search-goodwill', 'Learn home, search typed "goodwill" (results)');
  } },

  // ================= Chapter page =================
  { id: 'chapter', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    await open(env, chapterUrl(C1, 10), CH_WAIT);
    await coverCheck(env, '.lc-go__key', 'chapter start key');
    await png(env, '40-chapter-10min', 'Chapter page, 10 minutes (Accounting for Partnership: Basic Concepts, Pro)');
  } },
  { id: 'chapter-free', sizes: ALL, themes: ['dark'], async run(env) {
    const { page } = env;
    await open(env, chapterUrl(C1, 20, 'free'), CH_WAIT);
    const seg = await page.locator('.lc-len-wrap [aria-checked="true"], .lc-len-wrap [aria-pressed="true"], .lc-seg [aria-checked="true"]').first().textContent().catch(() => '?');
    env.rec.notes.push(`length chosen: ${norm(seg)}`);
    await page.waitForFunction(() => /up to 10 minutes/i.test(document.querySelector('.lc-go__note')?.textContent || ''), null, { timeout: 8000 }).catch(() => env.rec.notes.push('the capped line did not show'));
    await wait(page, 600);
    await png(env, '41-chapter-free-20-capped', 'Chapter page on Free with 20 minutes picked: the capped line ("Free sessions are up to 10 minutes. Pro has any length.")');
  } },
  { id: 'chapter-resume', sizes: ALL, themes: ['dark'], async run(env) {
    await open(env, chapterUrl(AOP, 10), CH_WAIT);
    const has = await env.page.locator('.lc-resume').count();
    if (!has) env.rec.notes.push('no resume row (the commerce student has an unfinished run in Admission of a Partner)');
    await png(env, '42-chapter-resume', 'Chapter page for a student with an unfinished run (Admission of a Partner: "You stopped at 6 of 16 today", Pick up where you stopped)');
  } },

  // ================= Run =================
  { id: 'run-walk', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    const { page } = env;
    const dark = env.theme === 'dark';
    const save = async (base, what, star) => { if (wantStar(env, star)) await png(env, base, what); };
    await open(env, runUrl(C1, 10), '.lr-area', { extraWait: 1500 });
    await coverCheck(env, '.lr-bar .kc-btn--volt', 'run step key');
    await save('50-run-card-front', 'Run, a Key card face up (front)', true);
    if (env.touch) await press(env, page.locator('.lr-bar .kc-btn--volt')); else await page.keyboard.press('Space');
    await page.waitForSelector('.lr-keys--rate', { timeout: 10000 });
    await wait(page, 800);
    await coverCheck(env, '.lr-rate[data-rating="3"]', 'run rating key');
    await save('51-run-card-revealed', 'Run, the card revealed with the four rating keys', true);
    await runDrive(env, (s) => s.k === 'q' && !s.answered);
    await wait(page, 600);
    await save('52-run-question', 'Run, a question not yet answered', false);
    await runAnswer(env, 'wrong', (await runState(page)).body);
    await wait(page, 1500);
    await save('53-run-wrong-line', 'Run, a wrong answer with the line you needed', true);
    if (!dark) return;
    // the stop sheet
    if (env.touch) await press(env, page.locator('.lr-close:visible').first()); else await page.keyboard.press('Escape');
    if (await drawerShown(page)) { await wait(page, 700); await png(env, '54-run-stop-sheet', 'Run, "Stop for now?" (the stop sheet)'); await press(env, page.locator('.st-drawer .kc-btn--line').first()); await wait(page, 500); }
    else env.rec.notes.push('the stop sheet did not open');
    await runDrive(env, (s) => s.k === 'end');
    await page.waitForSelector('.lr-endform__title, .lr-endform__name', { timeout: 30000 }).catch(() => {});
    await wait(page, 1700);
    await png(env, '55-run-end', 'Run, the end (what moved, the lead key, the lines)');
  } },
  { id: 'run-end-day', sizes: TWO, themes: ['light'], async run(env) {
    await open(env, runUrl(C1, 10), '.lr-area', { extraWait: 1500 });
    await runDrive(env, (s) => s.k === 'end');
    await page2(env);
    await wait(env.page, 1700);
    await png(env, '55-run-end', 'Run, the end (what moved, the lead key, the lines)');
  } },

  // ================= Key cards view =================
  { id: 'cards', sizes: ALL, themes: ['dark'], async run(env) {
    await open(env, cardsUrl(C1, 'all'), '.l2c-row');
    await coverCheck(env, '.l2c-hit-area', 'cards first row');
    await png(env, '60-cards-all', 'Key cards, all (Pro)');
    await open(env, cardsUrl(C1, 'must'), '.l2c-row');
    await png(env, '61-cards-must-know', 'Key cards, Must-know filter');
  } },
];
async function page2(env) { await env.page.waitForSelector('.lr-endform__title, .lr-endform__name', { timeout: 30000 }).catch(() => {}); }

// ================= Print =================
JOBS.push({ id: 'print', sizes: [1440], themes: ['light'], async run(env) {
  const { page } = env;
  await env.ctx.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints += 1; }; });
  await open(env, chapterUrl(AOP, 10), 'button.lc-shelf__row--key', { extraWait: 1200 });
  await press(env, page.locator('button.lc-shelf__row--key').first());
  await page.waitForSelector('.kc-print', { state: 'attached', timeout: 30000 }).catch(() => env.rec.notes.push('the print sheet did not appear'));
  await wait(page, 2500);
  const prints = await page.evaluate(() => window.__prints);
  env.rec.notes.push(`window.print was called ${prints} time(s) (stubbed in the capture)`);
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 794, height: 1123 });
  await wait(page, 700);
  await page.pdf({ path: join(OUT, '70-print-chapter-sheet.pdf'), format: 'A4', printBackground: true });
  env.vp = { width: 794, height: 1123 };
  await png(env, '70-print-chapter-sheet-page1', 'The chapter\'s printed sheet (Admission of a Partner), page 1, print media at A4; the PDF of the whole sheet is 70-print-chapter-sheet.pdf');
  const rec = state.pngs.find((p) => p.file.startsWith('70-print-chapter-sheet-page1'));
  if (rec) rec.size = '794x1123 (A4 at 96 dpi, print media)';
  await page.emulateMedia({ media: null });
} });

// ================= Real CUET content =================
// Each target is a question of data/fixtures/learn-preview-questions.json that has to be seen unanswered in a run that serves it:
// the 20-minute Pro feed of Admission of a Partner, and the "Questions only" run (kind mix, cards, mistakes and lessons left out) of Change in Profit Sharing Ratio.
const TARGETS = [
  { chapter: AOP, ids: ['5bde762f1a36a3a7d894f0aa45f655e9'], base: '80-real-match-the-column-and-longest', what: 'a match-the-column question (List-I / List-II) and the longest case stem (1,186 characters), Admission of a Partner' },
  { chapter: AOP, ids: ['1b1b7a4b-355f-48e5-861c-d7b546975896'], base: '81-real-assertion-reason', what: 'an Assertion-Reason question, Admission of a Partner' },
  { chapter: CPSR, ids: ['01cfb56e', '01dbaa4a', '625c82bf'], base: '82-real-statements', what: 'a statements question (Statement I, II, III; options such as "I and II only"), Change in Profit Sharing Ratio' },
  { chapter: CPSR, ids: ['341d2ffb9c69a0f0bef64c9eea5e2706'], base: '83-real-match-the-column-short', what: 'a second, shorter match-the-column question (A to D against List-II I to IV), Change in Profit Sharing Ratio' },
];
JOBS.push({ id: 'real-content', sizes: [1440, 360], themes: ['dark'], async run(env) {
  const { page } = env;
  for (const chapter of [AOP, CPSR]) {
    const todo = TARGETS.filter((t) => t.chapter === chapter);
    const left = new Set(todo.map((t) => t.base));
    env.kcs = `${env.kcs}-${chapter.split('.')[1].slice(0, 6)}`;
    const served = [];
    const viaFeed = chapter === AOP;
    const grab = async (stem, label) => {
      const f = fixtureFor(stem);
      served.push(f ? f.id.slice(0, 8) : '(not in fixture)');
      const t = f && todo.find((x) => left.has(x.base) && x.ids.some((id) => f.id.startsWith(id)));
      if (t) { await wait(page, 700); await png(env, t.base, `Real CUET content in the ${label}: ${t.what}`); left.delete(t.base); }
    };
    if (viaFeed) {
      await open(env, feedUrl('pro', chapter, 20), FEED_WAIT, { extraWait: 1500 });
      for (let i = 0; i < 100 && left.size; i += 1) {
        const s0 = await feedState(page);
        if (s0.k === 'end') break;
        if (s0.k === 'q' && !s0.answered) { await grab(s0.body, 'feed'); await feedAnswer(env, 'right'); await wait(page, 500); await feedStep(env); continue; }
        await feedNext(env);
      }
    } else {
      await open(env, `${runUrl(chapter, 20)}&out=cards,mistakes,lesson`, '.lr-area', { extraWait: 1500 });
      for (let i = 0; i < 80 && left.size; i += 1) {
        const s0 = await runState(page);
        if (s0.k === 'end') break;
        if (s0.k === 'q' && !s0.answered) { await grab(s0.body, 'run player'); await runAnswer(env, 'right', s0.body); continue; }
        await runDrive(env, (x) => (x.k === 'q' && !x.answered) || x.k === 'end', () => 'right', 20);
      }
    }
    env.rec.notes.push(`${chapter}: questions served (${viaFeed ? "feed" : "questions-only run"}): ${served.join(', ')}`);
    for (const b of left) { env.rec.notes.push(`target ${b} was not served by ${viaFeed ? "the 20-minute feed" : "the questions-only run"} of ${chapter}`); state.notes.push(`real-content ${env.size}: ${b} was not served`); }
  }
} });

// ================= Measurements =================
const feedPos = async (page) => { const s = await feedState(page); return s.k === 'end' ? 'end' : s.i; };
const hitAtCentre = (page, sel) => page.locator(sel).first().evaluate((el) => {
  const b = el.getBoundingClientRect();
  const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  const ctl = at?.closest('a, button');
  return { ok: Boolean(at) && (el === at || el.contains(at) || Boolean(ctl && ctl.contains(el))), at: at ? `${at.tagName}.${String(at.className).slice(0, 40)}` : 'nothing', disabled: el.disabled === true, rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] };
}).catch((e) => ({ ok: false, at: `missing (${e.message.split('\n')[0]})` }));
const trackTop = (page) => page.evaluate(() => { const p = document.querySelector('.st-track > .st-page:not([inert])'); return p ? Math.round(p.getBoundingClientRect().top * 10) / 10 : null; });

JOBS.push({ id: 'measure-desktop', sizes: [1440, 1366], themes: ['dark'], async run(env) {
  const { page, vp } = env;
  const m = { size: `${vp.width}x${vp.height}` };
  let n = 0;
  const fresh = async () => { n += 1; env.kcs = `a1101f-md-${vp.width}-${n}-${Date.now() % 1e9}`; await open(env, feedUrl(), FEED_WAIT, { extraWait: 1500 }); await page.mouse.move(vp.width * 0.5, vp.height * 0.5); };
  // wheel
  await fresh();
  await page.mouse.wheel(0, 100); await wait(page, 1500);
  const w1 = await feedPos(page); await wait(page, 1500); const w1b = await feedPos(page);
  m.wheelOneEvent100 = { from: 0, after1_5s: w1, after3s: w1b, movedExactlyOne: w1 === 1 && w1b === 1, settled: Math.abs((await trackTop(page)) - (await page.evaluate(() => document.querySelector('.st-view').getBoundingClientRect().top))) < 2 };
  await fresh();
  const cdp = await env.ctx.newCDPSession(page);
  await page.evaluate(() => { window.__w = []; addEventListener('wheel', (e) => window.__w.push({ t: e.timeStamp, dy: e.deltaY }), true); });
  const sends = [];
  const tb = Date.now();
  for (let k = 0; k < 12; k += 1) sends.push(new Promise((r) => setTimeout(async () => { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: vp.width / 2, y: vp.height / 2, deltaX: 0, deltaY: 30 }); r(); }, k * 16)));
  await Promise.all(sends);
  const burstMs = Date.now() - tb;
  await wait(page, 1500); const b1 = await feedPos(page); await wait(page, 1500); const b2 = await feedPos(page);
  const arrived = await page.evaluate(() => window.__w);
  m.trackpadBurst12x30 = { events: 12, deltaY: 30, totalPx: 360, sentOverMs: burstMs, arrivedEvents: arrived.length, arrivedSpanMs: arrived.length ? Math.round(arrived[arrived.length - 1].t - arrived[0].t) : null, after1_5s: b1, after3s: b2, movedExactlyOne: b1 === 1 && b2 === 1 };
  await fresh();
  const seq = [];
  for (let k = 0; k < 3; k += 1) { await page.mouse.wheel(0, 100); await wait(page, 1300); seq.push(await feedPos(page)); }
  m.threeWheelNotchesApart = { positions: seq, oneEach: seq.join() === '1,2,3' };
  // keys
  await fresh();
  const keys = [];
  const key1 = async (k, label, expect) => {
    const a = await feedState(page); await page.keyboard.press(k); await wait(page, 1000); const b = await feedState(page);
    const from = a.k === 'end' ? 'end' : `${a.k}#${a.i}${a.turned ? ' turned' : ''}`;
    const to = b.k === 'end' ? 'end' : `${b.k}#${b.i}${b.turned ? ' turned' : ''}`;
    keys.push({ key: label || k, from, to, expected: expect, pass: to === expect || (k === 'Home' && to.startsWith(expect)) });
  };
  await key1('ArrowDown', 'ArrowDown', 'card#1');
  await key1('j', 'j', 'card#2');
  await key1('ArrowUp', 'ArrowUp', 'card#1');
  await key1('k', 'k', 'card#0');
  await key1('End', 'End', 'end');
  await key1('Home', 'Home (from the end)', 'card#0');
  await key1('Space', 'Space on a face-up card (turns)', 'card#0 turned');
  await key1('Space', 'Space on a turned card (next)', 'card#1');
  await key1('PageDown', 'PageDown', 'card#2');
  await key1('PageUp', 'PageUp', 'card#1');
  await key1('Home', 'Home', 'card#0');
  m.keys = keys;
  // Previous and the volt key at their centres, at the first card and at the second
  await fresh();
  m.hit = { firstCard: { prev: await hitAtCentre(page, '.st-bar .st-prev'), volt: await hitAtCentre(page, '.st-bar .kc-btn--volt.st-step'), keep: await hitAtCentre(page, '.st-railkey') } };
  await page.keyboard.press('ArrowDown'); await wait(page, 1000);
  m.hit.secondItem = { prev: await hitAtCentre(page, '.st-bar .st-prev'), volt: await hitAtCentre(page, '.st-bar .kc-btn--volt.st-step, .st-bar .st-skip') };
  // a real click on Previous and on the volt key moves/turns
  const a0 = await feedState(page);
  await press(env, page.locator('.st-bar .st-prev').first()); await wait(page, 900);
  const a1 = await feedState(page);
  m.clickPrevious = { from: `${a0.k}#${a0.i}`, to: `${a1.k}#${a1.i}`, pass: a1.i === a0.i - 1 };
  const v0 = await feedState(page);
  await press(env, page.locator('.st-bar .kc-btn--volt.st-step').first()); await wait(page, 900);
  const v1 = await feedState(page);
  m.clickVolt = { from: `${v0.k}#${v0.i}${v0.turned ? ' turned' : ''}`, to: `${v1.k}#${v1.i}${v1.turned ? ' turned' : ''}`, pass: JSON.stringify(v0) !== JSON.stringify(v1) };
  // the backdrop: a click on the empty margin then ArrowDown still works
  await fresh();
  await page.mouse.click(vp.width * 0.08, vp.height * 0.5); await wait(page, 400);
  const c0 = await feedPos(page); await page.keyboard.press('ArrowDown'); await wait(page, 1000);
  m.arrowAfterMarginClick = { from: c0, to: await feedPos(page) };
  state.measures[`desktop-${vp.width}x${vp.height}`] = m;
} });

const touchDrag = async (env, { distance, steps, gap, hold = 0, from = 0.8 }) => {
  const { cdp, vp } = env;
  const x = Math.round(vp.width * 0.42); let y = Math.round(vp.height * from);
  const t0 = Date.now();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let k = 0; k < steps; k += 1) { y -= distance / steps; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y) }] }); await sleep(gap); }
  if (hold) await sleep(hold);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return { ms: Date.now() - t0, px: distance, pxPerMs: Number((distance / Math.max(1, (steps * gap))).toFixed(3)) };
};
JOBS.push({ id: 'measure-phone', sizes: [390, 360], themes: ['dark'], async run(env) {
  const { page, vp } = env;
  const m = { size: `${vp.width}x${vp.height}` };
  let n = 0;
  const fresh = async () => { n += 1; env.kcs = `a1101f-mp-${vp.width}-${n}-${Date.now() % 1e9}`; await open(env, feedUrl(), FEED_WAIT, { extraWait: 1500 }); };
  const area = async () => page.evaluate(() => Math.round(document.querySelector('.st-view').getBoundingClientRect().height));
  await fresh();
  m.itemAreaHeight = await area();
  m.releaseDistance18pc = Math.round(0.18 * m.itemAreaHeight);
  const top0 = await trackTop(page);
  const g1 = await touchDrag(env, { distance: 300, steps: 30, gap: 36, hold: 120 });
  await wait(page, 1300);
  m.slowDrag300px = { gesture: g1, to: await feedPos(page), movedExactlyOne: (await feedPos(page)) === 1, restsAtTop: Math.abs((await trackTop(page)) - top0) < 2 };
  await fresh();
  const top1 = await trackTop(page);
  const g2 = await touchDrag(env, { distance: 90, steps: 18, gap: 40, hold: 150 });
  await wait(page, 1300);
  m.slowDrag90px = { gesture: g2, to: await feedPos(page), springsBack: (await feedPos(page)) === 0, restsAtTop: Math.abs((await trackTop(page)) - top1) < 2, topAfter: await trackTop(page), topBefore: top1 };
  await fresh();
  const flings = [];
  for (let k = 0; k < 3; k += 1) {
    const g = await touchDrag(env, { distance: 300, steps: 6, gap: 7 });
    await wait(page, 1300);
    flings.push({ gesture: g, position: await feedPos(page) });
  }
  m.fastFling300pxThreeInARow = { flings, positions: flings.map((f) => f.position), oneEach: flings.map((f) => f.position).join() === '1,2,3' };
  const trials = [];
  for (let k = 0; k < 3; k += 1) {
    await fresh();
    await page.evaluate(() => { window.__t = []; addEventListener('touchmove', (e) => window.__t.push({ t: e.timeStamp, y: e.touches[0].clientY }), true); });
    const g4 = await touchDrag(env, { distance: 80, steps: 4, gap: 6 });
    await wait(page, 1300);
    const ts = await page.evaluate(() => window.__t);
    const last = ts[ts.length - 1];
    const from = ts.find((q) => last.t - q.t <= 80) || ts[0];
    const v = last && from && last.t > from.t ? Number(((last.y - from.y) / (last.t - from.t)).toFixed(2)) : null;
    trials.push({ gesture: g4, pageSideVelocityPxPerMs: v, threshold: 0.35, to: await feedPos(page) });
  }
  m.shortQuickFlick80px = { trials, note: 'moves one only when the release velocity is over 0.35 px/ms, measured on the page; a slow harness (events more than about 70 ms apart) is a slow finger' };
  await fresh();
  await press(env, page.locator('.st-page--card:not([inert]) .st-card__hit'));
  await wait(page, 900);
  m.tapTurnsCard = { turned: (await feedState(page)).turned };
  m.hit = { volt: await hitAtCentre(page, '.st-bar .kc-btn--volt.st-step'), keep: await hitAtCentre(page, '.st-bar .st-railkey'), prev: 'Previous is not drawn on a phone' };
  state.measures[`phone-${vp.width}x${vp.height}`] = m;
} });

// ================= Films =================
class Recorder {
  constructor(env, w, h) { this.env = env; this.w = w; this.h = h; this.frames = []; }
  async start() {
    const { page, ctx } = this.env;
    this.cdp = await ctx.newCDPSession(page);
    this.cdp.on('Page.screencastFrame', async (f) => {
      this.frames.push({ t: (f.metadata?.timestamp ? f.metadata.timestamp * 1000 : Date.now()), b: Buffer.from(f.data, 'base64') });
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* stopped */ }
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: this.w, maxHeight: this.h, everyNthFrame: 1 });
    this.t0 = Date.now();
  }
  async stop(file, what, url) {
    try { await this.cdp.send('Page.stopScreencast'); } catch { /* none */ }
    await sleep(300);
    const end = Date.now();
    const frames = this.frames.sort((a, b) => a.t - b.t);
    if (!frames.length) throw new Error('the screencast produced no frames');
    const start = frames[0].t;
    const seconds = (Math.max(end, frames[frames.length - 1].t + 200) - start) / 1000;
    const dir = join(OUT, `.frames-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const fps = 25; const count = Math.max(1, Math.round(seconds * fps));
    let at = 0;
    for (let k = 0; k < count; k += 1) {
      const time = start + (k * 1000) / fps;
      while (at + 1 < frames.length && frames[at + 1].t <= time) at += 1;
      writeFileSync(join(dir, `f${String(k).padStart(5, '0')}.jpg`), frames[at].b);
    }
    const out = join(OUT, file);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%05d.jpg'), '-c:v', 'libvpx', '-b:v', '3M', '-crf', '10', '-pix_fmt', 'yuv420p', '-an', out]);
    rmSync(dir, { recursive: true, force: true });
    const bytes = statSync(out).size;
    state.films = state.films.filter((x) => x.file !== file);
    state.films.push({ file, url, what, seconds: Number(seconds.toFixed(1)), size: `${this.w}x${this.h}`, bytes, frames: frames.length, theme: 'night' });
    console.log('film', file, seconds.toFixed(1), 's', Math.round(bytes / 1024), 'KB', frames.length, 'screencast frames');
  }
}
const FILM1 = { id: 'film-phone', sizes: [390], themes: ['dark'], env: { dsf: 2 }, async run(env) {
  const { page } = env;
  await open(env, exploreUrl(), COVERS_WAIT);
  await scrollToEl(page, '.fxc', 70); await wait(page, 600);
  const rec = new Recorder(env, 780, 1688);
  await rec.start();
  await wait(page, 1500);
  await press(env, page.locator('.fxc-cover').first());
  await page.waitForSelector(FEED_WAIT, { timeout: 60000 });
  await wait(page, 1300);
  await press(env, livePage(page).locator('.st-card__hit')); await wait(page, 1500);
  await press(env, keepKey(page)); await wait(page, 1500);
  await swipeUp(env, { steps: 10, gap: 14 });
  for (let k = 0; k < 6; k += 1) { const s = await feedState(page); if (s.k === 'q') break; await swipeUp(env, { steps: 10, gap: 14 }); }
  const q = await feedState(page);
  if (q.k === 'q' && !q.answered) {
    await wait(page, 700);
    await feedAnswer(env, 'wrong');
    await lineOpen(page);
    await wait(page, 2200);
    await press(env, stepKey(page)); await wait(page, 900);
  } else env.rec.notes.push('no question was reached for the wrong answer');
  for (let k = 0; k < 14; k += 1) {
    const s = await feedState(page);
    if (s.k === 'checkpoint') break;
    await swipeUp(env, { steps: 9, gap: 12 });
  }
  const end = await feedState(page);
  if (end.k !== 'checkpoint') env.rec.notes.push(`the film did not reach the checkpoint (${end.k})`);
  await wait(page, 2000);
  await rec.stop('film-1-phone-feed.webm', 'Phone, 390x844, touch: an Explore cover (Play), the card turn, Keep (the flight), a swipe, a wrong answer with the line opening, Next, on to the checkpoint', `${exploreUrl()} (then the feed of the first cover)`);
} };
const FILM2 = { id: 'film-desktop', sizes: [1440], themes: ['dark'], async run(env) {
  const { page, vp } = env;
  await open(env, feedUrl(), FEED_WAIT, { extraWait: 1200 });
  await page.mouse.move(vp.width * 0.5, vp.height * 0.5);
  const rec = new Recorder(env, 1440, 900);
  await rec.start();
  const t0 = Date.now();
  await wait(page, 1500);
  await page.mouse.wheel(0, 100); await wait(page, 1100);
  await page.keyboard.press('Space'); await wait(page, 1300);
  await page.keyboard.press('Space'); await wait(page, 900);
  let streak = 0; let sawStreak = false;
  for (let k = 0; k < 40 && Date.now() - t0 < 21000; k += 1) {
    const s = await feedState(page);
    if (s.k === 'end') break;
    if (s.k === 'q' && !s.answered) {
      const f = fixtureFor(s.body);
      const opts = await livePage(page).locator('.st-opt .st-opt__t').allTextContents();
      let idx = 0;
      if (f) { const at = opts.findIndex((t) => stripLetter(t) === keyTextOf(f)); if (at >= 0) idx = at; }
      await page.keyboard.press(String(idx + 1)); await wait(page, 1300);
      const v = (await feedState(page)).verdict || '';
      const row = v.match(/(\d+) in a row/);
      if (row) { sawStreak = true; if (Number(row[1]) >= 4) { await wait(page, 1300); break; } await wait(page, 500); }
      streak += 1;
      await page.keyboard.press('Space'); await wait(page, 700);
      continue;
    }
    if (s.k === 'checkpoint') { await page.keyboard.press('Space'); await wait(page, 700); continue; }
    if (s.k === 'card') { if (k % 2 === 0) await page.mouse.wheel(0, 100); else await page.keyboard.press('ArrowDown'); await wait(page, 750); continue; }
    await page.keyboard.press('ArrowDown'); await wait(page, 750);
  }
  if (!sawStreak) env.rec.notes.push('the streak line ("Right. N in a row.") was not reached in the film');
  await page.keyboard.press('End');
  await page.waitForSelector('.st-end .st-endform__title', { timeout: 20000 }).catch(() => {});
  await wait(page, 2600);
  await rec.stop('film-2-desktop-feed.webm', 'Desktop, 1440x900, mouse and keys: the feed with the wheel, Space to turn, questions answered with the number keys (the streak line when reached), End to the end screen', feedUrl());
} };
JOBS.push(FILM1, FILM2);

// ================= index.md =================
const kb = (n) => `${Math.round(n / 1024).toLocaleString('en-GB')} KB`;
function writeIndex() {
  const L = [];
  L.push('# Learn v2 and the Explore feed: final capture (1 Nov 2026)');
  L.push('');
  L.push('Made by scripts/design-audit/learn-1101-final-capture.mjs against `next dev` (http://localhost:3451, the development preview, `decks=real`), never production data. Night is the default theme; Day is added at 1440 and 390 for the starred shots. Stills are PNG; desktop at scale 1, phones (390x844, 360x780) at scale 2. `volt` is the number of volt keys in view (visible and not covered) when the still was taken.');
  L.push('');
  L.push(`Counts: ${state.pngs.length} stills, ${state.films.length} films, ${state.failures.length} failed jobs.`);
  L.push('');
  L.push('## Stills');
  L.push('');
  L.push('| file | URL | what it shows | size | theme | volt |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  const sorted = [...state.pngs].sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true }));
  for (const p of sorted) {
    let bytes = '';
    try { bytes = kb(statSync(join(OUT, p.file)).size); } catch { /* gone */ }
    L.push(`| ${p.file} | \`${p.url}\` | ${p.what} | ${p.size}, ${bytes} | ${p.theme} | ${p.volt ?? ''} |`);
  }
  L.push('');
  L.push('## Films');
  L.push('');
  L.push('| file | URL | what it shows | length | size | theme |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  for (const f of state.films) L.push(`| ${f.file} | \`${f.url}\` | ${f.what} | ${f.seconds} s | ${f.size}, ${kb(f.bytes)} | ${f.theme} |`);
  L.push('');
  L.push('## Print');
  L.push('');
  if (existsSync(join(OUT, '70-print-chapter-sheet.pdf'))) L.push(`70-print-chapter-sheet.pdf: the whole printed sheet (A4, ${kb(statSync(join(OUT, '70-print-chapter-sheet.pdf')).size)}).`);
  L.push('');
  L.push('## Measurements');
  L.push('');
  L.push('```json');
  L.push(JSON.stringify(state.measures, null, 1));
  L.push('```');
  L.push('');
  L.push('## Pages: console errors, layout shift, sideways scroll, volt keys');
  L.push('');
  L.push('| job | size | theme | console errors | failed requests | HTTP >= 400 | CLS | sideways scroll (px) | notes |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const p of state.pages) L.push(`| ${p.job} | ${p.size} | ${p.theme} | ${p.errors.length ? p.errors.map((e) => e.replace(/\|/g, '/')).join('; ') : 'none'} | ${p.failed.length ? p.failed.join('; ') : 'none'} | ${p.http.length ? p.http.join('; ') : 'none'} | ${p.cls} | ${p.spill} | ${(p.notes || []).join('; ').replace(/\|/g, '/')} |`);
  L.push('');
  L.push('## Notes and failures');
  L.push('');
  for (const n of state.notes) L.push(`- ${n}`);
  for (const f of state.failures) L.push(`- FAILED ${f.job} ${f.size} ${f.theme}: ${f.message}`);
  if (!state.notes.length && !state.failures.length) L.push('- none');
  L.push('');
  L.push('## Cleanup');
  L.push('');
  for (const c of state.cleanup) L.push(`- ${c}`);
  writeFileSync(join(OUT, 'index.md'), `${L.join('\n')}\n`);
}

// ---- Run, report ---------------------------------------------------------------------------------------------------------------
const shellPids = () => {
  try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome-headless-shell.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split(String.fromCharCode(10)).map((l) => l.split('","')[1]).filter(Boolean).map(Number); } catch { return []; }
};
const pidsBefore = new Set(shellPids());
await takeLock();
let browser = null;
const t00 = Date.now();
let browserPids = [];
try {
  browser = await chromium.launch({ headless: true, executablePath });
  await sleep(700);
  browserPids = shellPids().filter((x) => !pidsBefore.has(x));
  console.log('headless pids started by this run:', browserPids.join(',') || '(none seen)');
  for (const job of JOBS) {
    if (only.length && !only.some((o) => job.id.includes(o))) continue;
    for (const theme of job.themes) {
      for (const size of job.sizes) {
        if (sizeFilter.length && !sizeFilter.includes(size)) continue;
        if (themeFilter.length && !themeFilter.includes(theme)) continue;
        if (theme === 'light' && job.dayOn && !job.dayOn.includes(size)) continue;
        dropOld(job.id, size, theme);
        state.notes = state.notes.filter((n) => !n.startsWith(job.id + ' '));
        let env = null;
        let attemptNote = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          env = await makeEnv(browser, job, size, theme, job.env || {});
          const t1 = Date.now();
          let failure = null;
          try {
            await job.run(env);
          } catch (e) {
            failure = e.message.split(String.fromCharCode(10))[0];
            console.log('FAILED (attempt ' + attempt + ')', job.id, size, theme, failure);
            try { await env.page.screenshot({ path: join(OUT, 'ZZ-FAILED-' + job.id + '-' + size + '-' + themeName(theme) + '.png') }); } catch { /* none */ }
          }
          env.ms = Date.now() - t1;
          const expectedLoads = env.rec.loads.length;
          if (env.rec.loadEvents > expectedLoads + 1) env.rec.notes.push('the page loaded ' + env.rec.loadEvents + ' times for ' + expectedLoads + ' navigations (an unexpected reload, most likely the development server refreshing)');
          if (!failure) { if (attempt > 1) attemptNote = 'succeeded on the second attempt; the first failed with: ' + attemptNote; break; }
          if (attempt === 2) state.failures.push({ job: job.id, size, theme, message: failure + ' (failed twice)' });
          else { attemptNote = failure; await env.ctx.close(); }
        }
        if (attemptNote) env.rec.notes.push(attemptNote);
        state.pages.push({ job: job.id, size, theme, ms: env.ms, loads: env.rec.loads, errors: env.rec.errors, failed: env.rec.failed, http: env.rec.http, cls: Number(env.rec.cls.toFixed(3)), spill: env.rec.spill, volt: env.rec.volt, notes: env.rec.notes });
        saveState();
        await env.ctx.close();
      }
    }
  }
} finally {
  await browser?.close().catch(() => {});
  await sleep(800);
  const stillUp = shellPids().filter((x) => browserPids.includes(x));
  for (const x of stillUp) { try { execFileSync('taskkill', ['/PID', String(x), '/T', '/F']); } catch { /* none */ } }
  state.cleanup.push(`${new Date().toISOString()} headless pids [${browserPids.join(',')}]: ${stillUp.length ? 'still running after close, killed by PID ' + stillUp.join(',') : 'all exited after close'}`);
  saveState();
  try { writeIndex(); } catch (e) { console.log('index.md failed', e.message); }
  dropLock();
  console.log('cleanup:', state.cleanup[state.cleanup.length - 1]);
}
console.log('done', Math.round((Date.now() - t00) / 1000), 's');
