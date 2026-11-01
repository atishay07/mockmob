// Learn v2 round 2, packet P2 (run, feed and end screens) AFTER capture (1 Nov 2026). Capture only.
//   node scripts/design-audit/learn-1101-r2-p2-capture.mjs http://localhost:3482 tmp/learn-1101/r2-after/p2
//   ONLY=<substrings of a shot id>   SIZES=390,1440   THEMES=dark,light
// One headless Chromium, held under the GLOBAL mkdir lock ../tmp-devslots/browser.lock (shared by every packet; touched every
// 20 s; older than 10 minutes counts as stale), removed at the end. Index: <out>/index.json.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [BASE = 'http://localhost:3482', OUTARG = 'tmp/learn-1101/r2-after/p2'] = process.argv.slice(2);
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
const feedUrl = (plan = 'pro', chapter = AOP, student = 'commerce') => `${P}view=learn2-feed&plan=${plan}&student=${student}&chapter=${chapter}&min=10`;
const runUrl = (chapter, plan, student) => `${P}view=learn2-run&plan=${plan}&student=${student}&chapter=${chapter}&min=10&kind=mix`;

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

const STATE_FILE = join(OUT, 'index.json');
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { pngs: [], failures: [], notes: [] };
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
const themeName = (t) => (t === 'dark' ? 'night' : 'day');

async function makeEnv(browser, shot, size, theme) {
  const S = SIZES[size];
  const ctx = await browser.newContext({ viewport: S.viewport, deviceScaleFactor: S.dsf, hasTouch: S.touch, isMobile: S.touch, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ } }, theme);
  const page = await ctx.newPage();
  const env = { ctx, page, size, theme, touch: S.touch, vp: S.viewport, shot, errors: [], kcs: `r2p2-${shot.id}-${size}-${theme}-${Date.now() % 1e9}` };
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
async function png(env, base, what) {
  const page = env.page;
  await page.waitForFunction(() => ![...document.querySelectorAll('.skeleton')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }), null, { timeout: 15000 }).catch(() => {});
  const file = `${base}-${env.size}-${themeName(env.theme)}.png`;
  await page.screenshot({ path: join(OUT, file) });
  state.pngs = state.pngs.filter((p) => p.file !== file);
  state.pngs.push({ file, what, theme: themeName(env.theme), size: env.size, url: env.url || '', errors: env.errors.slice(0, 5) });
  console.log('saved', file, env.errors.length ? `errors: ${env.errors.join(' | ')}` : '');
}

// ---- drivers ---------------------------------------------------------------------------------------------------------------
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

const SHOTS = [
  { id: 'run', async run(env) {
    const { page } = env;
    await open(env, runUrl(C1, 'pro', 'commerce'), '.lr-area', 1800);
    await png(env, '50-run-card-front', 'Run, a Key card face up (front), with the first-run cue "Tap the card to turn it"');
    await press(env, page.locator('.lr-card').first()); await page.waitForSelector('.lr-keys--rate', { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(700);
    await png(env, '51-run-card-turned', 'Run, the card turned with Missed / Got it / Easy');
    // Got it, then on to the first question
    let got = { q: false, wrong: false };
    for (let i = 0; i < 60 && !got.wrong; i += 1) {
      const s = await runKind(page);
      if (s.k === 'end') break;
      if (s.k === 'q' && !s.answered) {
        if (!got.q) { await page.waitForTimeout(500); await png(env, '52-run-question', 'Run, a question not yet answered (Skip under the last option)'); got.q = true; }
        const n = await page.locator('.lr-opt').count();
        await runStep(env, s, { pick: (i % Math.max(1, n)) });
        const wrong = await page.locator('.lr-opt[data-state="wrong"]').count();
        if (wrong) { await page.waitForTimeout(900); await png(env, '53-run-wrong-line', 'Run, a wrong answer: the stem\'s end in view, "Not quite. It\'s C." and the line you needed (4 lines, then Read the whole line)'); got.wrong = true; }
        continue;
      }
      await runStep(env, s);
    }
    if (!got.wrong) state.notes.push(`run ${env.size} ${env.theme}: no wrong answer reached`);
    // the stop sheet
    if (env.touch) await press(env, page.locator('.lr-close:visible').first()); else await page.keyboard.press('Escape');
    if (await drawer(page)) { await page.waitForTimeout(600); await png(env, '54-run-stop-sheet', 'Run, "Stop for now?": "N of M done. It\'s all saved.", Stop here and Keep going'); await press(env, page.locator('.st-drawer .st-textkey').first()); await page.waitForTimeout(500); }
    else state.notes.push(`run ${env.size} ${env.theme}: the stop sheet did not open`);
    const ok = await runToEnd(env);
    await png(env, '55-run-end', ok ? 'Run end (Pro): the chapter, the headline with Mobi, the pile, the numbers, the bar, one key and one link' : 'Run: the end was NOT reached');
  } },
  { id: 'run-stopped', async run(env) {
    const { page } = env;
    await open(env, runUrl(C1, 'pro', 'commerce'), '.lr-area', 1800);
    for (let i = 0; i < 6; i += 1) { const s = await runKind(page); await runStep(env, s); }
    if (env.touch) await press(env, page.locator('.lr-close:visible').first()); else await page.keyboard.press('Escape');
    if (await drawer(page)) { await press(env, page.locator('.st-drawer .kc-btn--volt').first()); await page.waitForSelector('.st-endx__h', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1700); }
    await png(env, '56-run-end-stopped', 'Run end after "Stop here" part way: "Stopped at N of M"');
  } },
  { id: 'run-first', async run(env) {
    await open(env, runUrl(C1, 'free', 'new'), '.lr-area', 1800);
    await png(env, '57-run-first-card-new', 'Run, a brand-new Free student\'s first card: the cue "Tap the card to turn it"');
  } },
  { id: 'run-free-end', async run(env) {
    await open(env, runUrl(C1, 'free', 'commerce'), '.lr-area', 1800);
    const ok = await runToEnd(env);
    await png(env, '96-run-end-free', ok ? 'Run end on Free (returning Free student): the free line with See Pro inline, a key that works today, Questions on this chapter' : 'Run on Free: the end was NOT reached');
  } },
  { id: 'feed-first', async run(env) {
    await open(env, feedUrl('free', AOP, 'new'), '.st-page--card:not([inert]), .st-page--q:not([inert])', 2600);
    await png(env, '91-feed-first-visit-first-item', 'Explore feed, first visit (Free, new): the next item peeks above the bar and the chip "Swipe up for the next one" / "Scroll or press \u2193"');
    await press(env, stepKey(env.page)); await env.page.waitForTimeout(900);
    await png(env, '91-feed-first-visit-card-turned', 'Same, the card turned (the chip stays until the student moves)');
  } },
  { id: 'feed', async run(env) {
    const { page } = env;
    await open(env, feedUrl('pro', AOP, 'commerce'), '.st-page--card:not([inert]), .st-page--q:not([inert])', 1800);
    await png(env, '10-feed-card-front', 'Feed, a Key card face up (front), filling the stage, the next item peeking');
    const r = await feedWalk(env, { untilCheckpoint: true });
    if (r === 'checkpoint') {
      await png(env, '16-feed-checkpoint', 'Feed checkpoint: one headline, one line, the kept fan');
      if (env.touch) await press(env, page.locator('.st-iconkey[aria-label="Close the feed"]:visible').first()); else await page.keyboard.press('Escape');
      if (await drawer(page)) { await page.waitForTimeout(600); await png(env, '17-feed-stop-sheet', 'Feed, "Stop for now?" at the checkpoint'); await press(env, page.locator('.st-drawer .st-textkey').first()); await page.waitForTimeout(500); }
      await press(env, stepKey(page)).catch(() => {}); await page.waitForTimeout(600);
    }
    const end = await feedWalk(env);
    await png(env, '18-feed-end', end === 'end' ? 'Feed end (Pro): chapter, headline, pile, numbers, bar, Another 10 minutes and Next' : 'Feed: the end was NOT reached');
  } },
  { id: 'feed-free-end', async run(env) {
    await open(env, feedUrl('free', AOP, 'commerce'), '.st-page--card:not([inert]), .st-page--q:not([inert])', 1800);
    const end = await feedWalk(env);
    await png(env, '95-feed-end-free', end === 'end' ? 'Feed end on Free: the free line with See Pro, Quick recap, Questions on this chapter' : 'Feed on Free: the end was NOT reached');
    if (end === 'end') {
      await open(env, feedUrl('free', C1, 'commerce'), '.st-free, .st-page--card:not([inert]), .st-page--q:not([inert])', 1800);
      await png(env, '21-feed-free-refused', 'Feed start refused on Free after the session: one message, Pick up / Revise / See Pro');
    }
  } },
];

const shellPids = () => {
  try { return execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome-headless-shell.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split('\n').map((l) => l.split('","')[1]).filter(Boolean).map(Number); } catch { return []; }
};
const MATRIX = [[390, 'dark'], [390, 'light'], [1440, 'dark'], [1440, 'light']];
const before = new Set(shellPids());
await takeLock();
let browser = null;
let pids = [];
try {
  browser = await chromium.launch({ headless: true, executablePath });
  await sleep(700);
  pids = shellPids().filter((x) => !before.has(x));
  for (const shot of SHOTS) {
    if (only.length && !only.some((o) => shot.id === o)) continue;
    for (const [size, theme] of MATRIX) {
      if (sizeFilter.length && !sizeFilter.includes(size)) continue;
      if (themeFilter.length && !themeFilter.includes(theme)) continue;
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
  console.log('p2 capture done');
}
