// Learn v2 audit capture (1 Nov 2026): Explore covers, the Explore feed, Learn home, the chapter page, the run player and the Key
// cards view, at 1440x900 and 1366x768 (mouse, scale 1) and 390x844 and 360x780 (touch, scale 2), against `next dev` (the
// development preview's &decks=real source), never production data. It only captures and measures; it changes no product code.
// Reuses the selectors, waits, themes and the question-fixture answering of learn-1031-capture.mjs and learn-1031-feed2-capture.mjs.
//   node scripts/design-audit/learn-1101-audit-capture.mjs http://localhost:3451 tmp/learn-1101/audit
//   ONLY=<substrings of a job id or a file base>   SIZES=1440,390   THEMES=dark,light   WARM=0 (skip the warm-up pass)
// One headless Chromium at a time. State is kept in <out>/index.json so partial runs merge; index.md is rewritten at the end.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const [BASE = 'http://localhost:3451', OUTARG = 'tmp/learn-1101/audit'] = process.argv.slice(2);
const OUT = resolve(OUTARG);
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const sizeFilter = (process.env.SIZES || '').split(',').filter(Boolean).map(Number);
const themeFilter = (process.env.THEMES || '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

const QUESTIONS = JSON.parse(readFileSync(new URL('../../data/fixtures/learn-preview-questions.json', import.meta.url), 'utf8')).questions;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const stripLetter = (s) => norm(s).replace(/^(Option\s+)?[A-F][.)]?\s+/i, '');
const LEARNED = [{ start: 'Under the fixed capital method', key: '(B), (A), (C), (D)' }];
const keyTextOf = (f) => {
  const i = 'ABCDEF'.indexOf(f.correct_answer);
  const o = f.options.find((x) => x && x.key === f.correct_answer) || f.options[i];
  return stripLetter(typeof o === 'string' ? o : o?.text);
};
const fixtureFor = (body) => { const b = norm(body); return QUESTIONS.find((q) => norm(q.body) === b) || QUESTIONS.find((q) => b && norm(q.body).startsWith(b.slice(0, 60))) || null; };

const P = '/preview/arena?decks=real&study=on&';
const C1 = 'accountancy.partnership-fundamentals';
const AOP = 'accountancy.admission-of-partner';
const NOQ = 'accountancy.goodwill-valuation'; // cards, no questions
const ONEQ = 'accountancy.profit-and-loss-appropriation-account'; // cards, one question
const NOCARDS = 'accountancy.computerized-accounting-system'; // no cards, no questions
const wait = (page, ms) => page.waitForTimeout(ms);
const sizeNum = (x) => Number(String(x).split(' ')[0]);

const SIZES = {
  1440: { viewport: { width: 1440, height: 900 }, dsf: 1, touch: false },
  1366: { viewport: { width: 1366, height: 768 }, dsf: 1, touch: false },
  390: { viewport: { width: 390, height: 844 }, dsf: 2, touch: true },
  360: { viewport: { width: 360, height: 780 }, dsf: 2, touch: true },
};
const ALL = [1440, 1366, 390, 360];
const TWO = [1440, 390];
const IGNORE = /Fixture endpoint not supplied|status of 503|status of 418|status of 404|status of 402|status of 401|favicon|Download the React DevTools/i;

// ---- State kept between runs -----------------------------------------------------------------------------------------------
const STATE_FILE = join(OUT, 'index.json');
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { pngs: [], pages: [], measures: {}, failures: [], notes: [], cleanup: [] };
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
const dropOld = (jobId, size, theme) => {
  state.pages = state.pages.filter((p) => !(p.job === jobId && p.size === size && p.theme === theme));
  state.failures = state.failures.filter((p) => !(p.job === jobId && p.size === size && p.theme === theme));
};

// ---- Page recording --------------------------------------------------------------------------------------------------------
const pathOf = (u) => { try { const x = new URL(u); return x.pathname; } catch { return u.slice(0, 80); } };
async function makeEnv(browser, job, size, theme) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ }
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none */ }
  }, theme);
  const page = await ctx.newPage();
  const cdp = S.touch ? await ctx.newCDPSession(page) : null;
  const rec = { job: job.id, size, theme, loads: [], errors: [], failed: [], http: [], cls: 0, spill: 0, notes: [] };
  rec.loadEvents = 0;
  page.on('load', () => { rec.loadEvents += 1; });
  page.on('pageerror', (e) => rec.errors.push(`pageerror ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error') rec.errors.push(m.text().slice(0, 220)); });
  page.on('requestfailed', (r) => rec.failed.push(`${r.method()} ${pathOf(r.url())} ${r.failure()?.errorText || ''}`.trim()));
  page.on('response', (r) => { if (r.status() >= 400) rec.http.push(`${r.status()} ${r.request().method()} ${pathOf(r.url())}`); });
  const env = { ctx, page, cdp, size, theme, touch: S.touch, vp: S.viewport, job, rec, kcs: `a1101-${job.id}-${size}-${theme}-${Date.now()}`, saved: [] };
  return env;
}
const themeName = (t) => (t === 'dark' ? 'night' : 'day');
const hideNote = (page) => page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' }).catch(() => {});
const press = (env, loc) => (env.touch ? loc.tap() : loc.click());

async function open(env, url, waitSel, { extraWait = 1200 } = {}) {
  const full = `${BASE}${url}&kcs=${encodeURIComponent(env.kcs)}`;
  const t0 = Date.now();
  await env.page.goto(full, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await hideNote(env.page);
  await env.page.waitForSelector(waitSel, { timeout: 120000, state: 'visible' });
  env.rec.loads.push({ url, ms: Date.now() - t0, sel: waitSel });
  env.url = url;
  await wait(env.page, extraWait);
}

/** One PNG: base is 'NN-area-state'; the file is base-WIDTH-theme.png. */
async function png(env, base, what, { full = false, raw = false, url = env.url } = {}) {
  const page = env.page;
  if (!raw) {
    await page.waitForFunction(() => ![...document.querySelectorAll('.skeleton')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }), null, { timeout: 30000 }).catch(() => env.rec.notes.push(`${base}: a skeleton was still showing after 30 s`));
  }
  const file = `${base}-${env.size}-${themeName(env.theme)}.png`;
  if (full) {
    await page.addStyleTag({ content: '[data-shot-hide] { visibility: hidden !important; }' }).catch(() => {});
    await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.position !== 'fixed') continue; const r = el.getBoundingClientRect(); if (r.height < 200 && r.bottom >= innerHeight - 60 && r.width > 200) el.setAttribute('data-shot-hide', ''); } }).catch(() => {});
  }
  await page.screenshot({ path: join(OUT, file), fullPage: full });
  if (full) await page.evaluate(() => { for (const el of document.querySelectorAll('[data-shot-hide]')) el.removeAttribute('data-shot-hide'); }).catch(() => {});
  const dim = full ? await page.evaluate(() => `${innerWidth}x${document.documentElement.scrollHeight}`) : `${env.vp.width}x${env.vp.height}`;
  const spill = await page.evaluate(() => {
    let worst = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    for (const el of document.querySelectorAll('.fx-feed, .fx-slot[data-active], .fxc')) { const was = el.scrollLeft; el.scrollLeft = 200; worst = Math.max(worst, el.scrollLeft); el.scrollLeft = was; }
    return worst;
  }).catch(() => 0);
  env.rec.spill = Math.max(env.rec.spill, spill);
  env.rec.cls = Math.max(env.rec.cls, await page.evaluate(() => window.__cls || 0).catch(() => 0));
  state.pngs = state.pngs.filter((p) => p.file !== file);
  state.pngs.push({ file, url: url || '', what, size: `${env.size} (${dim}${SIZES[env.size].dsf === 2 ? ', scale 2' : ''})`, theme: themeName(env.theme), job: env.job.id });
  env.saved.push(base);
  console.log('saved', file);
}
/** Covered-control check: is the element at the centre of `sel` the element itself? */
const coverCheck = async (env, sel, label) => {
  const r = await env.page.locator(sel).filter({ visible: true }).first().evaluate((el) => {
    const b = el.getBoundingClientRect();
    if (b.bottom < 0 || b.top > innerHeight) return 'off screen';
    const at = document.elementFromPoint(b.left + b.width / 2, Math.min(b.top + b.height / 2, innerHeight - 1));
    return at && (el === at || el.contains(at)) ? null : (at ? `${at.tagName}.${at.className}` : 'nothing');
  }).catch((e) => `missing (${e.message.split('\n')[0]})`);
  if (r) env.rec.notes.push(`${label || sel} is covered by ${r}`);
};

// ---- Feed drivers (the feed2 script, with a keyboard path on the computer) -------------------------------------------------
const active = (page) => page.evaluate(() => {
  const s = document.querySelector('.fx-slot[data-active]');
  if (!s) return { k: 'none' };
  const i = Number(s.dataset.slot);
  if (s.classList.contains('fx-slot--end')) return { k: 'end', i, ready: Boolean(s.querySelector('.fx-end__title')) };
  if (s.querySelector('.fx-cp')) return { k: 'checkpoint', i };
  if (s.querySelector('.fx-q')) return { k: 'q', i, answered: Boolean(s.querySelector('.fx-opt[data-state="right"], .fx-opt[data-state="wrong"]')), body: s.querySelector('.fx-stem')?.textContent || '' };
  if (s.querySelector('.fx-card')) return { k: 'card', i, flipped: s.querySelector('.fx-card[data-flipped]') !== null, kept: Boolean(s.querySelector('.fx-rail__key[data-on]')) };
  return { k: 'none', i };
});
const slotLoc = (page) => page.locator('.fx-slot[data-active]');
async function swipeUp(env, { share = 0.6, steps = 12, wantMove = true } = {}) {
  const { page, cdp } = env;
  const before = (await active(page)).i;
  const vp = page.viewportSize();
  const x = Math.round(vp.width * 0.42);
  const distance = Math.round(vp.height * share);
  let y = Math.round(vp.height * 0.85);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let k = 0; k < steps; k += 1) { y -= distance / steps; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y) }] }); await wait(page, 16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  if (wantMove) await page.waitForFunction((b) => { const s = document.querySelector('.fx-slot[data-active]'); return s && Number(s.dataset.slot) !== b; }, before, { timeout: 4000 }).catch(() => {});
  await wait(page, 650);
}
async function nextItem(env) {
  if (env.touch) return swipeUp(env);
  const before = (await active(env.page)).i;
  await env.page.keyboard.press('ArrowDown');
  await env.page.waitForFunction((b) => { const s = document.querySelector('.fx-slot[data-active]'); return s && Number(s.dataset.slot) !== b; }, before, { timeout: 3500 }).catch(() => {});
  await wait(env.page, 700);
  return undefined;
}
async function answer(env, want) {
  const { page } = env;
  const s = await active(page);
  const f = fixtureFor(s.body);
  const opts = await slotLoc(page).locator('.fx-opt .fx-opt__t').allTextContents();
  let idx = want === 'right' ? 0 : 1;
  if (f) {
    const keyText = keyTextOf(f);
    const keyAt = opts.findIndex((t) => stripLetter(t) === keyText);
    if (keyAt >= 0) idx = want === 'right' ? keyAt : (keyAt === 0 ? 1 : 0);
  }
  await page.waitForFunction(() => new Promise((res) => { const f2 = document.querySelector('.fx-feed'); const a = f2.scrollTop; requestAnimationFrame(() => requestAnimationFrame(() => res(Math.abs(f2.scrollTop - a) < 0.5))); }), null, { timeout: 5000 }).catch(() => {});
  const graded = slotLoc(page).locator('.fx-opt[data-state="right"], .fx-opt[data-state="wrong"]').first();
  for (let t = 0; t < 3; t += 1) {
    await press(env, slotLoc(page).locator('.fx-opt').nth(idx));
    if (await graded.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) break;
  }
  await graded.waitFor({ timeout: 5000 });
  return (await slotLoc(page).locator('.fx-opt[data-state="right"]').count()) ? 'right' : 'wrong';
}
const feedUrl = (plan = 'pro', chapter = AOP, min = 10, student = 'commerce') => `${P}view=learn2-feed&plan=${plan}&student=${student}&chapter=${chapter}&min=${min}`;

/** Where the stage sits: shares of the viewport the card, the rail and everything visible take, for the active slot. */
const stageMetrics = (page) => page.evaluate(() => {
  const vw = innerWidth; const vh = innerHeight;
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const slot = document.querySelector('.fx-slot[data-active]');
  if (!slot) return null;
  const parts = {};
  for (const sel of ['.fx-cardwrap', '.fx-card', '.fx-q', '.fx-rail', '.fx-cp', '.fx-end', '.fx-sheet']) parts[sel] = r(slot.querySelector(sel));
  const top = document.querySelector('.fx-top');
  parts['.fx-top'] = r(top);
  let l = 1e9; let t = 1e9; let rr = 0; let bb = 0;
  const boxes = [...slot.querySelectorAll('.fx-card, .fx-q, .fx-rail, .fx-cp, .fx-end, .fx-sheet, .fx-hint, .fx-streak, .fx-opts')];
  if (top) boxes.push(...top.querySelectorAll('.fx-close, .fx-title, .fx-ticks'));
  for (const el of boxes) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > vh) continue;
    l = Math.min(l, b.left); t = Math.min(t, Math.max(b.top, 0)); rr = Math.max(rr, b.right); bb = Math.max(bb, Math.min(b.bottom, vh));
  }
  const union = rr > l ? { x: Math.round(l), y: Math.round(t), w: Math.round(rr - l), h: Math.round(bb - t) } : null;
  const main = parts['.fx-card'] || parts['.fx-q'] || parts['.fx-cp'] || parts['.fx-end'];
  return {
    vw, vh, parts, union,
    mainShare: main ? Number((main.w / vw).toFixed(3)) : null,
    contentShare: union ? Number((union.w / vw).toFixed(3)) : null,
    contentBoxAreaShare: union ? Number(((union.w * union.h) / (vw * vh)).toFixed(3)) : null,
    emptyLeftRight: union ? { left: union.x, right: Math.round(vw - union.x - union.w) } : null,
  };
});

// ---- Run drivers (the 1031 capture script) -------------------------------------------------------------------------------------
const runState0 = (page) => page.evaluate(() => {
  if (document.querySelector('[data-phase="end"] .lr-end__title, .lr-fan, .lr-lead')) return { k: 'end' };
  if (document.querySelector('.lr-round')) return { k: 'round' };
  if (document.querySelector('.lr-recapend')) return { k: 'recapEnd' };
  const q = document.querySelector('.lr-q');
  if (q) return { k: 'q', answered: Boolean(document.querySelector('.lr-verdict')), mistake: Boolean(q.querySelector('.lr-q__kind[data-mistake]')), body: q.querySelector('.lr-q__stem')?.textContent || '' };
  if (document.querySelector('.lr-card--lesson')) return { k: 'lesson' };
  if (document.querySelector('.kc-rate')) return { k: 'rate' };
  if (document.querySelector('.lr-card')) return { k: 'card' };
  return { k: 'none' };
});
const runState = async (page) => { const s = await runState0(page); s.limit = (await page.locator('.lr-fine-dock').count()) > 0; return s; };
const settleRun = async (page) => { await page.waitForFunction(() => !document.querySelector('.lr[data-leaving]'), null, { timeout: 8000 }).catch(() => {}); await wait(page, 280); };
async function runAnswer(env, want, body) {
  const { page } = env;
  const f0 = fixtureFor(body);
  const learned = LEARNED.find((l) => norm(body).startsWith(l.start));
  const f = f0 || (learned ? { options: [{ key: 'K', text: learned.key }], correct_answer: 'K' } : null);
  const opts = await page.locator('.lr-opt').evaluateAll((els) => els.map((e) => e.querySelector('.lr-opt__text')?.textContent || ''));
  let idx = -1;
  if (f) {
    const keyText = keyTextOf(f);
    const keyAt = keyText ? opts.findIndex((t) => stripLetter(t) === keyText) : -1;
    if (keyAt >= 0) idx = want === 'right' ? keyAt : (keyAt === 0 ? 1 : 0);
  }
  if (idx < 0) idx = want === 'right' ? 0 : 1;
  await press(env, page.locator('.lr-opt').nth(idx));
  await page.waitForSelector('.lr-verdict', { timeout: 15000 });
  await wait(page, 700);
}
async function drive(env, stop, policy = () => 'right', max = 120) {
  const { page } = env;
  let nq = 0;
  for (let i = 0; i < max; i += 1) {
    const s = await runState(page);
    if (stop(s)) return s;
    if (s.k === 'end' || s.k === 'recapEnd') return s;
    if (s.k === 'q' && !s.answered) { await runAnswer(env, policy(s, nq), s.body); nq += 1; continue; }
    if (s.k === 'round') { await press(env, page.locator('.lr-round .kc-btn--volt')); await wait(page, 300); continue; }
    if (s.k === 'rate') {
      await press(env, page.locator('.kc-rate__btn[data-rating="3"]'));
      await page.waitForFunction(() => !document.querySelector('.kc-rate') && !document.querySelector('.lr[data-leaving]'), null, { timeout: 20000 });
      await settleRun(page); continue;
    }
    await press(env, page.locator('.lr-dock .kc-btn--volt').first());
    await wait(page, 450);
    await settleRun(page);
  }
  throw new Error(`the run did not reach the wanted state in ${max} steps`);
}
const toEnd = (env) => drive(env, (s) => s.k === 'end' || s.k === 'recapEnd');
const scrollPlayer = (page) => page.evaluate(() => { const el = document.querySelector('.lr'); if (el && el.scrollHeight > el.clientHeight + 4) { el.scrollTo(0, el.scrollHeight); return true; } return false; });
const runUrl = (chapter, min, plan = 'pro', student = 'commerce', kind = 'mix') => `${P}view=learn2-run&plan=${plan}&student=${student}&chapter=${chapter}&min=${min}&kind=${kind}`;

// ---- The jobs ----------------------------------------------------------------------------------------------------------------
const scrollToEl = (page, sel, offset) => page.locator(sel).first().evaluate((el, o) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o), offset);
const exploreUrl = (plan = 'pro', student = 'commerce') => `${P}view=explore&plan=${plan}&student=${student}`;
const homeUrl = (plan = 'pro', student = 'commerce', subject = 'accountancy') => `${P}view=learn2&plan=${plan}&student=${student}${subject ? `&subject=${subject}` : ''}`;
const chapterUrl = (chapter, min, plan = 'pro', student = 'commerce') => `${P}view=learn2-chapter&plan=${plan}&student=${student}&chapter=${chapter}&min=${min}`;
const cardsUrl = (chapter, f, plan = 'pro', student = 'commerce') => `${P}view=learn2-cards&plan=${plan}&student=${student}&chapter=${chapter}&f=${f}`;
const COVERS_WAIT = '.fxc-cover:not([data-skel])';
const CH_WAIT = '.lc-pile:not(.lc-pile--skel)';

const JOBS = [
  // ---- Explore ----
  { id: 'explore-covers', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    await open(env, exploreUrl(), COVERS_WAIT);
    await scrollToEl(env.page, '.fxc', 70); await wait(env.page, 600);
    await coverCheck(env, '.fxc-play', 'Explore cover play key');
    await png(env, '01-explore-covers', 'Explore, the chapter covers row in view (Pro, Commerce student)');
    if (env.theme === 'dark') {
      await env.page.evaluate(() => { const el = document.querySelector('.fxc'); window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY - 70); });
      await wait(env.page, 600);
      if (env.size === 1440 || env.size === 390) await png(env, '02-explore-list', 'Explore, the list below the covers');
    }
  } },
  { id: 'explore-free', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, exploreUrl('free', 'commerce'), COVERS_WAIT);
    await scrollToEl(env.page, '.fxc', 70); await wait(env.page, 600);
    await png(env, '03-explore-free', 'Explore covers on the Free plan (Commerce student)');
  } },
  { id: 'explore-new', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, exploreUrl('free', 'new'), COVERS_WAIT);
    await scrollToEl(env.page, '.fxc', 70); await wait(env.page, 600);
    await png(env, '04-explore-new', 'Explore covers for a first-time student (student=new, Free)');
  } },
  { id: 'explore-full', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, exploreUrl(), COVERS_WAIT);
    await png(env, '05-explore-full', 'Explore, full-page capture (scrolling)', { full: true });
  } },

  // ---- Feed: loading, then the whole session from one walk ----
  { id: 'feed-loading', sizes: TWO, themes: ['dark'], async run(env) {
    const sel = '[aria-label="Starting the feed"]';
    const file = '10-feed-loading-' + env.size + '-night.png';
    const t0 = Date.now();
    let got = null;
    // Attempt 1: natural speed (the skeleton is on screen for a few hundred ms in a warm development server).
    await env.page.goto(BASE + feedUrl() + '&kcs=' + encodeURIComponent(env.kcs + '-L0'), { waitUntil: 'commit', timeout: 300000 });
    while (Date.now() - t0 < 20000) {
      const before = await env.page.locator(sel).count().catch(() => 0);
      if (before) {
        const buf = await env.page.screenshot().catch(() => null);
        const after = await env.page.locator(sel).count().catch(() => 0);
        if (buf && after) { got = { buf, at: Date.now() - t0, held: false }; break; }
      } else if (await env.page.locator('.fx-card').count().catch(() => 0)) break;
    }
    if (!got) {
      env.rec.notes.push('natural speed: the skeleton is gone before a screenshot can finish; photographed with the start request held 2.5 s by the capture script');
      // Attempt 2: an init script wraps the fetch the preview installs, so the start request (POST /api/learn/runs) answers 2.5 s late.
      const pg = await env.ctx.newPage();
      await pg.addInitScript(() => {
        let f = window.fetch;
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          get() {
            return (input, init = {}) => {
              try {
                const u = new URL(typeof input === 'string' ? input : input.url, location.origin);
                if (u.pathname === '/api/learn/runs' && String(init.method || 'GET').toUpperCase() === 'POST') return new Promise((r) => setTimeout(r, 2500)).then(() => f.call(window, input, init));
              } catch { /* none */ }
              return f.call(window, input, init);
            };
          },
          set(v) { f = v; },
        });
      });
      const t1 = Date.now();
      await pg.goto(BASE + feedUrl() + '&kcs=' + encodeURIComponent(env.kcs + '-L1'), { waitUntil: 'commit', timeout: 300000 });
      await pg.waitForSelector(sel, { state: 'visible', timeout: 60000 });
      await hideNote(pg);
      await wait(pg, 700);
      const buf = await pg.screenshot();
      const still = await pg.locator(sel).count();
      got = { buf, at: Date.now() - t1, held: true, still };
      await pg.close();
    }
    writeFileSync(join(OUT, file), got.buf);
    state.pngs = state.pngs.filter((x) => x.file !== file);
    state.pngs.push({ file, url: feedUrl(), what: 'Feed loading state (the skeleton) ' + (got.held ? 'with the start request held 2.5 s by the capture script (at natural speed it shows for only a few hundred ms)' : 'at natural speed, first seen ' + got.at + ' ms after navigation start'), size: env.size + ' (' + env.vp.width + 'x' + env.vp.height + (SIZES[env.size].dsf === 2 ? ', scale 2' : '') + ')', theme: 'night', job: env.job.id });
    console.log('saved', file, got.held ? '(held)' : '(natural)');
  } },
  { id: 'feed-session', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    const { page } = env;
    const dark = env.theme === 'dark';
    const star = new Set(['card-front', 'card-turned', 'question', 'wrong-sheet', 'end']);
    const wantSave = (name) => (dark ? (env.size === 1440 || env.size === 390 || star.has(name)) : (name === 'card-front' || name === 'wrong-sheet'));
    const save = async (name, base, what, opts) => { if (wantSave(name)) await png(env, base, what, opts); };
    await open(env, feedUrl(), '.fx-card');
    await coverCheck(env, '.fx-rail__key', 'feed Keep key');
    await save('card-front', '11-feed-card-front', 'Feed, a card face up (front)');
    // A card turned, then kept.
    await press(env, slotLoc(page).locator('.fx-card')); await wait(page, 800);
    await save('card-turned', '12-feed-card-turned', 'Feed, the card turned (answer side)');
    await press(env, slotLoc(page).locator('.fx-rail__key').first());
    await page.waitForSelector('.fx-slot[data-active] .fx-rail__key[data-on]', { timeout: 8000 }).catch(() => env.rec.notes.push('Keep did not show its on state'));
    await wait(page, 600);
    await save('kept', '13-feed-kept', 'Feed, the card kept (Keep on)');
    const got = { question: false, streak: false, wrong: false, checkpoint: false };
    let nq = 0; let wrongs = 0; let ended = false;
    for (let i = 0; i < 90; i += 1) {
      const s = await active(page);
      if (s.k === 'end') {
        await page.waitForSelector('.fx-slot[data-active] .fx-end__title', { timeout: 20000 }).catch(() => {});
        await wait(page, 900);
        await save('end', '17-feed-end', 'Feed, the end screen (kept pile, return day, keys)');
        ended = true; break;
      }
      if (!dark && got.wrong) break; // Day needs only the card front and the wrong answer
      if (s.k === 'checkpoint' && !got.checkpoint) { got.checkpoint = true; await wait(page, 500); await save('checkpoint', '16-feed-checkpoint', 'Feed, a checkpoint screen'); }
      if (s.k === 'q' && !s.answered) {
        if (!got.question) {
          got.question = true; await wait(page, 400);
          await save('question', '14-feed-question', 'Feed, a question not yet answered');
          if (dark && (env.size === 1440 || env.size === 390 || env.size === 1366 || env.size === 360)) { state.measures[`stage-question-${env.size}`] = await stageMetrics(page); }
        }
        const want = !dark ? 'wrong' : (nq === 3 && !got.wrong) || (nq > 3 && !got.wrong && wrongs < 3 && nq % 2 === 1) ? 'wrong' : 'right';
        const res = await answer(env, want); nq += 1; await wait(page, 600);
        if (res === 'right' && !got.streak && await page.locator('.fx-streak').count()) { got.streak = true; await wait(page, 700); await save('streak', '15-feed-right-streak', 'Feed, a right answer with the streak shown'); }
        if (res === 'wrong') {
          wrongs += 1;
          const sheet = await page.waitForSelector('.fx-slot[data-active] .fx-sheet', { timeout: 5000 }).then(() => true).catch(() => false);
          if (sheet || wrongs >= 3) {
            await wait(page, 900);
            got.wrong = true;
            await save('wrong-sheet', sheet ? '18-feed-wrong-sheet' : '18-feed-wrong-nosheet', sheet ? 'Feed, a wrong answer with the line sheet (the line you needed)' : 'Feed, a wrong answer; no line sheet appeared');
            if (sheet) await press(env, slotLoc(page).locator('.fx-sheet__x'));
            await wait(page, 400);
          }
        }
        const sheetOpen = await slotLoc(page).locator('.fx-sheet__x').count();
        if (sheetOpen) { await press(env, slotLoc(page).locator('.fx-sheet__x')); await wait(page, 300); }
      } else if (s.k === 'card' && s.i % 3 === 0 && !s.kept) {
        await press(env, slotLoc(page).locator('.fx-rail__key').first()); await wait(page, 450);
      }
      await nextItem(env);
    }
    if (dark && !ended) env.rec.notes.push('the walk did not reach the end screen in 90 steps');
    if (dark && !got.checkpoint) state.notes.push(`feed-session ${env.size}: no checkpoint screen was met during the walk`);
    if (dark && !got.streak) state.notes.push(`feed-session ${env.size}: no streak of right answers appeared during the walk`);
    if (dark && !got.wrong) state.notes.push(`feed-session ${env.size}: no wrong answer was graded during the walk`);
  } },
  { id: 'feed-free', sizes: TWO, themes: ['dark'], async run(env) {
    const { page } = env;
    await open(env, feedUrl('free'), '.fx-card');
    for (let i = 0; i < 90; i += 1) {
      const s = await active(page);
      if (s.k === 'end') break;
      if (s.k === 'q' && !s.answered) { await answer(env, 'right'); await wait(page, 500); }
      else if (s.k === 'card' && s.i < 4 && !s.kept) { await press(env, slotLoc(page).locator('.fx-rail__key').first()); await wait(page, 450); }
      await nextItem(env);
    }
    await page.waitForSelector('.fx-slot[data-active] .fx-end__title', { timeout: 20000 }).catch(() => {});
    await wait(page, 900);
    await png(env, '19-feed-free-end', 'Feed end screen on the Free plan (first feed of the day, Free line)');
    await open(env, feedUrl('free'), '.fx-end--free, .fx-card');
    await png(env, '20-feed-free-second', 'Feed started a second time the same day on Free (the limit screen, or a new feed if the limit did not apply)');
  } },
  ...[[NOQ, '21-feed-chapter-no-questions', 'a chapter with cards and no questions (Goodwill)'], [ONEQ, '22-feed-chapter-one-question', 'a chapter with cards and one question (Profit and Loss Appropriation Account)'], [NOCARDS, '23-feed-chapter-no-cards', 'a chapter with no cards and no questions (Computerised Accounting System)']].map(([ch, base, what]) => ({
    id: base.slice(3), sizes: TWO, themes: ['dark'],
    async run(env) {
      const { page } = env;
      await open(env, feedUrl('pro', ch), '.fx-card, .fx-end__title, .kc-err, .fx-end', { extraWait: 1500 });
      await png(env, `${base}-first`, `Feed, first screen of ${what}`);
      let met = null;
      for (let i = 0; i < 70; i += 1) {
        const s = await active(page);
        if (s.k === 'end') { await wait(page, 1200); met = 'end'; break; }
        if (s.k === 'q' && !s.answered) { await answer(env, 'right'); await wait(page, 500); }
        if (s.k === 'none' && i > 1) break;
        await nextItem(env);
      }
      if (met === 'end') await png(env, `${base}-end`, `Feed, end screen of ${what}`);
      else env.rec.notes.push('end screen not reached');
    },
  })),

  // ---- Feed measurements ----
  { id: 'feed-measure', sizes: ALL, themes: ['dark'], async run(env) {
    const { page, size } = env;
    const m = { size: `${env.vp.width}x${env.vp.height}`, touch: env.touch };
    const info = () => page.evaluate(() => {
      const f = document.querySelector('.fx-feed');
      const slots = [...document.querySelectorAll('.fx-slot')];
      const a = document.querySelector('.fx-slot[data-active]');
      return { top: Math.round(f.scrollTop * 10) / 10, offs: slots.map((s) => s.offsetTop), h: f.clientHeight, active: a ? Number(a.dataset.slot) : null, n: slots.length };
    });
    const midway = (i) => Math.min(...i.offs.map((o) => Math.abs(o - i.top))) > 2;
    const fresh = async (tag) => { env.kcs = `a1101-measure-${size}-${tag}-${Date.now()}`; await open(env, feedUrl(), '.fx-card', { extraWait: 1800 }); };
    await fresh('stage');
    m.stage = await stageMetrics(page);
    state.measures[`stage-card-${size}`] = m.stage;
    // (c) every visible interactive control on the first card, and on a question
    const controls = () => page.evaluate(() => {
      const vis = (el) => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); if (!(cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && b.width > 2 && b.height > 2 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth)) return false; const at = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1), Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1)); return Boolean(at) && (el === at || el.contains(at)); };
      return [...document.querySelectorAll('button, a[href], [role="button"], input, [tabindex]:not([tabindex="-1"])')].filter(vis).map((el) => {
        const b = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), cls: String(el.className).split(' ')[0], label: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      });
    });
    m.controlsCard = await controls();
    const navLike = (c) => /next|previous|prev\b|down|up\b|scroll|swipe|skip|more|continue/i.test(c.label);
    m.controlsNavLike = m.controlsCard.filter(navLike);
    m.ticks = await page.evaluate(() => { const t = [...document.querySelectorAll('.fx-tick')]; return { count: t.length, clickable: t.some((e) => /^(BUTTON|A)$/.test(e.tagName) || e.getAttribute('role') === 'button'), tag: t[0]?.tagName || null }; });
    m.hint = await page.evaluate(() => [...document.querySelectorAll('.fx-hint')].map((e) => ({ text: e.textContent.trim().slice(0, 60), visible: e.getBoundingClientRect().height > 0 })));
    if (!env.touch) {
      const vp = env.vp;
      const gesture = async (kind) => {
        await fresh(kind);
        await page.mouse.move(vp.width / 2, vp.height / 2);
        const before = await info();
        const t0 = Date.now();
        if (kind === 'wheel1') await page.mouse.wheel(0, 100);
        else for (let k = 0; k < 6; k += 1) { await page.mouse.wheel(0, 40); }
        const dur = Date.now() - t0;
        await wait(page, Math.max(0, 1000 - (Date.now() - t0)));
        const at1 = await info();
        await wait(page, 1500);
        const at25 = await info();
        return { gestureMs: dur, before: { top: before.top, active: before.active }, after1s: { top: at1.top, active: at1.active, midway: midway(at1) }, after2_5s: { top: at25.top, active: at25.active, midway: midway(at25) }, slotHeight: before.h, itemsMoved: (at25.active ?? 0) - (before.active ?? 0) };
      };
      m.wheelSingle = await gesture('wheel1');
      m.wheelBurst = await gesture('burst');
      // A second single wheel tick after the first, to see whether ticks add up or snap back.
      await fresh('wheel3');
      await page.mouse.move(vp.width / 2, vp.height / 2);
      const seq = [];
      for (let k = 0; k < 3; k += 1) { await page.mouse.wheel(0, 100); await wait(page, 1300); const i = await info(); seq.push({ top: i.top, active: i.active, midway: midway(i) }); }
      m.wheelThreeTicks = seq;
      const extraWheel = async (label, n, dy, gap) => {
        await fresh(label);
        await page.mouse.move(vp.width / 2, vp.height / 2);
        const b0 = await info(); const t0 = Date.now();
        for (let k = 0; k < n; k += 1) { await page.mouse.wheel(0, dy); if (gap) await wait(page, gap); }
        const dur = Date.now() - t0;
        await wait(page, 1600);
        const b1 = await info();
        return { events: n, deltaY: dy, totalPx: n * dy, gestureMs: dur, from: b0.active, to: b1.active, top: b1.top, midway: midway(b1), itemsMoved: (b1.active ?? 0) - (b0.active ?? 0) };
      };
      const thresholds = [];
      for (const dy of [200, 300, 400, 460, 500, 700]) {
        await fresh('t' + dy);
        await page.mouse.move(vp.width / 2, vp.height / 2);
        await page.mouse.wheel(0, dy); await wait(page, 1500);
        const i = await info();
        thresholds.push({ singleEventDeltaY: dy, itemsMoved: (i.active ?? 0), top: i.top, midway: midway(i) });
      }
      m.wheelSingleEventThreshold = thresholds;
      m.wheelExtra = [await extraWheel('w5', 5, 100, 25), await extraWheel('w6', 6, 100, 25), await extraWheel('w15', 15, 40, 25), await extraWheel('w30', 30, 40, 15)];
      // (b) keys
      await fresh('keys');
      const keyRes = [];
      const press1 = async (key, label) => {
        const a0 = await active(page); await page.keyboard.press(key); await wait(page, 1100); const a1 = await active(page);
        keyRes.push({ key: label || key, from: `${a0.k}#${a0.i}${a0.flipped ? ' (turned)' : ''}`, to: `${a1.k}#${a1.i}${a1.flipped ? ' (turned)' : ''}`, moved: a1.i !== a0.i, changed: JSON.stringify(a0) !== JSON.stringify(a1) });
      };
      await press1('ArrowDown'); await press1('ArrowUp'); await press1('PageDown'); await press1('PageUp');
      await press1('ArrowDown'); await press1('ArrowUp');
      await press1('Space', 'Space (first, card face up)'); await press1('Space', 'Space (second)');
      await press1('j'); await press1('k'); await press1('End'); await press1('Home');
      m.keys = keyRes;
      // a click on the empty stage, then ArrowDown (keys must work after a click)
      await fresh('keys2');
      await page.mouse.click(vp.width * 0.15, vp.height * 0.5); await wait(page, 500);
      const b0 = await active(page); await page.keyboard.press('ArrowDown'); await wait(page, 1100); const b1 = await active(page);
      m.arrowAfterBackdropClick = { from: b0.i, to: b1.i };
    } else {
      // (e) a touch swipe of 300 px, three in a row
      const seqs = [];
      for (const kind of ['touch300']) {
        await fresh(kind);
        for (let k = 0; k < 3; k += 1) {
          const b0 = await info();
          const x = Math.round(env.vp.width * 0.42); let y = Math.round(env.vp.height * 0.8);
          await env.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
          for (let j = 0; j < 12; j += 1) { y -= 25; await env.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await wait(page, 16); }
          await env.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await wait(page, 1300);
          const b1 = await info();
          seqs.push({ swipe: k + 1, from: b0.active, to: b1.active, itemsMoved: (b1.active ?? 0) - (b0.active ?? 0), top: b1.top, midway: midway(b1), slotHeight: b1.h });
        }
      }
      m.swipe300px16msSteps = seqs;
      await fresh('touchfast');
      const seqFast = [];
      for (let k = 0; k < 3; k += 1) {
        const b0 = await info();
        const x = Math.round(env.vp.width * 0.42); let y = Math.round(env.vp.height * 0.8);
        await env.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let j = 0; j < 6; j += 1) { y -= 50; await env.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await wait(page, 7); }
        await env.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await wait(page, 1300);
        const b1 = await info();
        seqFast.push({ swipe: k + 1, from: b0.active, to: b1.active, itemsMoved: (b1.active ?? 0) - (b0.active ?? 0), top: b1.top, midway: midway(b1) });
      }
      m.swipe300pxFlick40ms = seqFast;
      // The same 300 px as the browser's own touch scroll gesture (a fling at a normal finger speed).
      await fresh('touchgesture');
      const seq2 = [];
      for (let k = 0; k < 3; k += 1) {
        const b0 = await info();
        await env.cdp.send('Input.synthesizeScrollGesture', { x: Math.round(env.vp.width * 0.42), y: Math.round(env.vp.height * 0.75), yDistance: -300, speed: 800, gestureSourceType: 'touch' });
        await wait(page, 1300);
        const b1 = await info();
        seq2.push({ swipe: k + 1, from: b0.active, to: b1.active, itemsMoved: (b1.active ?? 0) - (b0.active ?? 0), top: b1.top, midway: midway(b1) });
      }
      m.swipe300pxGesture800pxs = seq2;
    }
    state.measures[`feed-${size}`] = m;
    env.rec.notes.push('measurements written to the index');
  } },

  // ---- Learn home ----
  { id: 'home-top', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    await open(env, homeUrl(), '.lh-row');
    await coverCheck(env, '.lh-row__link', 'Learn home first chapter row');
    await png(env, '30-home-top', 'Learn home, top of the page (Accountancy, Pro, Commerce student)');
    if (env.theme === 'dark' && (env.size === 1440 || env.size === 390)) {
      await scrollToEl(env.page, '.lh-row', 150); await wait(env.page, 500);
      await png(env, '31-home-chapters', 'Learn home, the chapters list scrolled into view');
    }
  } },
  { id: 'home-search', sizes: TWO, themes: ['dark'], async run(env) {
    const { page } = env;
    await open(env, homeUrl(), '.lh-row');
    await press(env, page.locator('.lh-find input'));
    await page.waitForSelector('.l2f-shelf', { timeout: 30000 }).catch(() => env.rec.notes.push('no shelves appeared on focus'));
    await wait(page, 900);
    await page.evaluate(() => { const el = document.querySelector('.lh-find'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 76); });
    await wait(page, 400);
    await png(env, '32-home-search-focused', 'Learn home, search focused (the shelves)');
    await page.keyboard.type('goodwill', { delay: 70 });
    await page.waitForSelector('.l2f-results .l2c-row, .l2f-results .l2f-link', { timeout: 20000 }).catch(() => env.rec.notes.push('no results appeared for "goodwill"'));
    await wait(page, 900);
    await png(env, '33-home-search-goodwill', 'Learn home, search typed "goodwill" (results)');
  } },
  { id: 'home-new', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, homeUrl('free', 'new', null), '.lh-row');
    await png(env, '34-home-new', 'Learn home for a first-time student (student=new, Free)');
  } },
  { id: 'home-free', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, homeUrl('free', 'commerce'), '.lh-row');
    await png(env, '35-home-free', 'Learn home on the Free plan (Commerce student, Accountancy)');
  } },
  { id: 'home-full', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, homeUrl(), '.lh-row');
    await png(env, '36-home-full', 'Learn home, full-page capture (scrolling)', { full: true });
  } },

  // ---- Chapter page ----
  { id: 'chapter-10', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    await open(env, chapterUrl(C1, 10), CH_WAIT);
    await coverCheck(env, '.lc-go__key', 'chapter start key');
    await png(env, '40-chapter-10min', 'Chapter page, 10 min (Accounting for Partnership: Basic Concepts, Pro)');
  } },
  { id: 'chapter-lengths', sizes: TWO, themes: ['dark'], async run(env) {
    const { page } = env;
    await open(env, chapterUrl(C1, 5), CH_WAIT);
    await png(env, '41-chapter-5min', 'Chapter page, 5 min');
    await open(env, chapterUrl(C1, 20), CH_WAIT);
    await png(env, '42-chapter-20min', 'Chapter page, 20 min');
    await open(env, chapterUrl(C1, 10), CH_WAIT);
    await press(env, page.locator('.lc-len__btn').nth(3));
    await page.waitForSelector('.lc-own', { timeout: 10000 }).catch(() => env.rec.notes.push('Your own sheet did not open'));
    await wait(page, 700);
    await png(env, '43-chapter-own', 'Chapter page, "Your own" length sheet open');
  } },
  { id: 'chapter-states', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, chapterUrl(C1, 10, 'free', 'commerce'), CH_WAIT);
    await png(env, '44-chapter-free', 'Chapter page on the Free plan (10 min)');
    await open(env, chapterUrl(C1, 10, 'free', 'new'), CH_WAIT);
    await png(env, '45-chapter-new', 'Chapter page for a first-time student (student=new, Free)');
    await open(env, chapterUrl(AOP, 10), CH_WAIT);
    await png(env, '46-chapter-lesson', 'Chapter page of a chapter that has a lesson (Admission of a Partner, 10 min)');
    await open(env, chapterUrl(NOQ, 10), CH_WAIT);
    await png(env, '47-chapter-no-questions', 'Chapter page of a chapter with cards and no questions (Goodwill)');
  } },
  { id: 'chapter-full', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, chapterUrl(C1, 10), CH_WAIT);
    await png(env, '48-chapter-full', 'Chapter page, full-page capture (scrolling)', { full: true });
  } },

  // ---- Run ----
  { id: 'run-front', sizes: ALL, themes: ['dark', 'light'], dayOn: TWO, async run(env) {
    const { page } = env;
    await open(env, runUrl(C1, 10), '.lr-card');
    await coverCheck(env, '.lr-dock .kc-btn--volt', 'run dock key');
    await png(env, '50-run-card-front', 'Run, a card face up (front)');
    if (env.theme !== 'dark') return;
    await press(env, page.locator('.lr-dock .kc-btn--volt'));
    await page.waitForSelector('.kc-rate', { timeout: 10000 });
    await wait(page, 600);
    await coverCheck(env, '.kc-rate__btn[data-rating="3"]', 'run rating key');
    await png(env, '51-run-card-revealed', 'Run, the card revealed with the rating keys');
  } },
  { id: 'run-question', sizes: ALL, themes: ['dark'], async run(env) {
    await open(env, runUrl(C1, 10), '.lr-card');
    await drive(env, (s) => s.k === 'q' && !s.answered);
    await wait(env.page, 500);
    await coverCheck(env, '.lr-opt', 'run option');
    await png(env, '52-run-question', 'Run, a question not yet answered');
  } },
  { id: 'run-wrong', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, runUrl(C1, 10), '.lr-card');
    await drive(env, (s) => s.k === 'q' && s.answered, () => 'wrong');
    await wait(env.page, 700);
    await png(env, '53-run-wrong-line', 'Run, a wrong answer with the line you needed');
    if (await scrollPlayer(env.page)) { await wait(env.page, 300); await png(env, '53-run-wrong-line-bottom', 'Run, the same screen scrolled to its bottom'); }
  } },
  { id: 'run-lesson', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, runUrl(AOP, 20), '.lr-card');
    const s = await drive(env, (x) => x.k === 'lesson', () => 'right', 160).catch((e) => { env.rec.notes.push(`no lesson item reached: ${e.message}`); state.notes.push(`run-lesson ${env.size}: ${e.message}`); return null; });
    if (s) { await wait(env.page, 800); await png(env, '54-run-lesson', 'Run, a lesson item (Admission of a Partner, 20 min)'); }
  } },
  { id: 'run-end', sizes: ALL, themes: ['dark'], async run(env) {
    await open(env, runUrl(C1, 10), '.lr-card');
    await toEnd(env);
    await env.page.waitForSelector('.lr-end__title, .lr-fan', { timeout: 30000 });
    await wait(env.page, 1600);
    await png(env, '55-run-end', 'Run, the end screen (Pro)');
  } },
  { id: 'run-free-limit', sizes: TWO, themes: ['dark'], async run(env) {
    const { page } = env;
    // Free's 10 card ratings a day are not reached in the first 10-minute run (it has about 6 cards): finish it, start a second one
    // and rate on until the dock shows the limit line.
    await open(env, runUrl(C1, 10, 'free'), '.lr-card');
    await toEnd(env);
    await page.waitForSelector('.lr-end__title, .lr-fan', { timeout: 30000 }).catch(() => {});
    await wait(page, 1200);
    await png(env, '57-run-free-end', 'Run end screen on Free (first run of the day)');
    await open(env, runUrl(C1, 10, 'free'), '.lr-card, .lr-q, .lr-err, .kc-err, .lr-state', { extraWait: 1500 });
    await png(env, '58-run-free-second', 'Run started a second time the same day on Free (it starts; no session limit screen)');
    // The second mix is questions only and Free sees about 6 cards a chapter, so the card-rating limit (10 a day) is reached in a run of a second chapter.
    await open(env, runUrl(AOP, 10, 'free'), '.lr-card, .lr-q, .lr-err, .kc-err, .lr-state', { extraWait: 1500 });
    const hit = await drive(env, (x) => x.limit, () => 'right', 160).catch((e) => { env.rec.notes.push('limit not reached: ' + String(e.message).split(String.fromCharCode(10))[0]); return null; });
    if (hit && hit.limit) {
      await wait(page, 700);
      await png(env, '59-run-free-limit', 'Run on Free at the card-rating limit (a run of a second chapter, Admission of a Partner, after two runs the same day; the limit line over the dock)');
    } else {
      state.notes.push('run-free-limit ' + env.size + ': the card-rating limit line was not reached');
    }
  } },

  // ---- Key cards view ----
  { id: 'cards', sizes: TWO, themes: ['dark'], async run(env) {
    await open(env, cardsUrl(C1, 'all'), '.l2c-row');
    await coverCheck(env, '.l2c-hit-area', 'cards first row');
    await png(env, '60-cards-all', 'Key cards, all (Pro)');
    await open(env, cardsUrl(C1, 'must'), '.l2c-row');
    await png(env, '61-cards-must-know', 'Key cards, Must-know filter');
    await open(env, cardsUrl(C1, 'all', 'free'), '.l2c-row');
    await png(env, '62-cards-free-top', 'Key cards on the Free plan, top');
    await env.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await wait(env.page, 600);
    await png(env, '63-cards-free-locked', 'Key cards on the Free plan, scrolled to the end (the locked line)');
  } },
];

// ---- Warm-up, run, report --------------------------------------------------------------------------------------------------
const shellPids = () => {
  try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome-headless-shell.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split(String.fromCharCode(10)).map((l) => l.split('","')[1]).filter(Boolean).map(Number); } catch { return []; }
};
const pidsBefore = new Set(shellPids());
const browser = await chromium.launch({ headless: true, executablePath });
await new Promise((r) => setTimeout(r, 700));
const browserPids = shellPids().filter((x) => !pidsBefore.has(x));
console.log('headless pids started by this run:', browserPids.join(',') || '(none seen)');
const t00 = Date.now();
try {
  if (process.env.WARM !== '0') {
    const ctx = await browser.newContext({ viewport: SIZES[1440].viewport });
    const page = await ctx.newPage();
    for (const [u, sel] of [[exploreUrl(), COVERS_WAIT], [homeUrl(), '.lh-row'], [chapterUrl(C1, 10), CH_WAIT], [runUrl(C1, 10), '.lr-card'], [cardsUrl(C1, 'all'), '.l2c-row'], [feedUrl(), '.fx-card']]) {
      try { await page.goto(`${BASE}${u}&kcs=a1101-warm-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 300000 }); await page.waitForSelector(sel, { timeout: 120000 }); } catch (e) { console.log('warm-up miss', u, e.message.split('\n')[0]); }
    }
    await ctx.close();
    console.log('warm-up done', Date.now() - t00, 'ms');
  }
  for (const job of JOBS) {
    if (only.length && !only.some((o) => job.id.includes(o))) continue;
    for (const theme of job.themes) {
      for (const size of job.sizes) {
        if (sizeFilter.length && !sizeFilter.includes(size)) continue;
        if (themeFilter.length && !themeFilter.includes(theme)) continue;
        if (theme === 'light' && job.dayOn && !job.dayOn.includes(size)) continue;
        dropOld(job.id, size, theme);
        let env = null;
        let attemptNote = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          env = await makeEnv(browser, job, size, theme);
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
          else { attemptNote = failure; await env.ctx.close(); state.pngs = state.pngs.filter((x) => !(x.job === job.id && sizeNum(x.size) === size && x.theme === themeName(theme) && false)); }
        }
        if (attemptNote) env.rec.notes.push(attemptNote);
        state.pages.push({ job: job.id, size, theme, ms: env.ms, loads: env.rec.loads, errors: env.rec.errors, failed: env.rec.failed, http: env.rec.http, cls: Number(env.rec.cls.toFixed(3)), spill: env.rec.spill, notes: env.rec.notes });
        saveState();
        await env.ctx.close();
      }
    }
  }
} finally {
  await browser.close().catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  const stillUp = shellPids().filter((x) => browserPids.includes(x));
  for (const x of stillUp) { try { execFileSync('taskkill', ['/PID', String(x), '/T', '/F']); } catch { /* none */ } }
  state.cleanup.push(`${new Date().toISOString()} headless pids [${browserPids.join(',')}]: ${stillUp.length ? 'still running after close, killed by PID ' + stillUp.join(',') : 'all exited after close'}`);

  saveState();
  console.log('cleanup:', state.cleanup[state.cleanup.length - 1]);
}
console.log('done', Math.round((Date.now() - t00) / 1000), 's');
