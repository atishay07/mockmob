// Learn v2 round 6, packet Web D (LK39, LK41, LK43): the cards worth looking at. Before and after shots of the feed card (both faces),
// the run card (both faces), a question, the Explore covers and the Cards view, at 390 and 1440, Night and Day. A copy of
// learn-1101-r4-run-capture.mjs with its drivers and its own jobs. Capture only: no push, no deploy, no DB write (preview decks=real).
//   node scripts/design-audit/learn-r6-d-cards-capture.mjs http://localhost:3463 tmp/learn-1103/r6-d/before
//   ONLY=<job ids>   SIZES=390,1440   THEMES=dark,light
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

// ---- the jobs ----------------------------------------------------------------------------------------------------------------
const SHOTS = [
  { id: 'feed', async run(env) {
    const { page } = env;
    await open(env, feedUrl('pro', AOP, 'commerce'), FEED_ITEM, 2200);
    // the first card item in view
    for (let i = 0; i < 12; i += 1) {
      const s = await feedKind(page);
      if (s.k === 'card') break;
      if (s.k === 'q' && !s.answered) { await press(env, page.locator('.st-track > .st-page:not([inert]) .st-opt').first()); await page.waitForTimeout(600); }
      await press(env, stepKey(page)).catch(() => {}); await page.waitForTimeout(700);
    }
    await png(env, 'd01-feed-card-front', 'Explore feed (Pro): a Key card face up, the next item peeking');
    await press(env, stepKey(page)); await page.waitForTimeout(800);
    await png(env, 'd02-feed-card-back', 'Explore feed: the same card turned (NCERT line)');
    for (let i = 0; i < 20; i += 1) {
      await press(env, stepKey(page)).catch(() => {}); await page.waitForTimeout(700);
      const s = await feedKind(page);
      if (s.k === 'q' && !s.answered) { await page.waitForTimeout(500); await png(env, 'd03-feed-question', 'Explore feed: a question, not yet answered'); return; }
      if (s.k === 'card' && !s.turned) continue;
    }
    state.notes.push(`feed ${env.size} ${env.theme}: no question reached`);
  } },
  { id: 'run', async run(env) {
    const { page } = env;
    await open(env, runUrl(C1, 'pro', 'commerce'), '.lr-area', 2200);
    for (let i = 0; i < 12; i += 1) { const s = await runKind(page); if (s.k === 'card') break; await runStep(env, s); }
    await png(env, 'd04-run-card-front', 'Chapter run (Pro): a Key card face up');
    await press(env, page.locator('.lr-card').first()); await page.waitForSelector('.lr-keys--rate', { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(800);
    await png(env, 'd05-run-card-back', 'Chapter run: the same card turned, the grade keys');
    for (let i = 0; i < 40; i += 1) {
      const s = await runKind(page);
      if (s.k === 'end') break;
      if (s.k === 'q' && !s.answered) { await page.waitForTimeout(600); await png(env, 'd06-run-question', 'Chapter run: a question, not yet answered'); return; }
      await runStep(env, s);
    }
    state.notes.push(`run ${env.size} ${env.theme}: no question reached`);
  } },
  { id: 'covers', async run(env) {
    await open(env, view('explore'), COVERS, 2800); await toTop(env.page);
    await scrollTo(env.page, '.fxc', env.size === '390' ? 72 : 120); await env.page.waitForTimeout(600);
    await png(env, 'd07-explore-covers', 'Explore (Pro, Commerce): the chapter covers row');
  } },
  { id: 'cards', async run(env) {
    await open(env, view('learn2-cards', 'pro', 'commerce', `&chapter=${C1}`), 'main', 3500); await toTop(env.page);
    await env.page.waitForTimeout(1200);
    await png(env, 'd08-cards-view', 'The chapter\'s Cards view (Pro, Partnership fundamentals), first screen');
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
  const md = ['# Learn v2 round 6, Web D capture (3 Nov 2026): the cards', '',
    `Made by scripts/design-audit/learn-r6-d-cards-capture.mjs against \`next dev --webpack\` (${BASE}, preview decks=real), never production. Night = dark theme, Day = light theme. Phones 390x844 at scale 2, desktop 1440x900 (a small phone 360x640, a wide desktop 1920x1080 where named).`, '',
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
