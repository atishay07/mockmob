// Explore feed v2 (docs/brain/learn-1031/FEED-2.md): the proof captures and the touch film, against `next dev` (the development
// preview's &decks=real source), never production data. Headless playwright-core with the chrome-headless-shell, one browser at a
// time. Phones are touch contexts (hasTouch, isMobile, deviceScaleFactor 2): taps are real touch taps (locator.tap) and swipes
// are real touch scroll gestures (CDP Input.synthesizeScrollGesture, gestureSourceType 'touch'), so the scroll-snap is the
// browser's own. One fresh in-memory student per shot (&kcs=). The preview's development note is hidden.
//   node scripts/design-audit/learn-1031-feed2-capture.mjs http://localhost:3451 tmp/learn-1031/feed2
//   ONLY=<substrings>  FILM=0 (skip the film)  FILM_ONLY=1 (only the film)  REDUCED=1 (a reduced-motion pass)
// Problems (console errors, sideways spill, layout shift, a covered key) print under ERRORS and the run exits 1.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const executablePath = process.env.HEADLESS_SHELL || 'C:/Users/atish/.cache/puppeteer/chrome-headless-shell/win64-151.0.7922.71/chrome-headless-shell-win64/chrome-headless-shell.exe';
const FFMPEG = process.env.FFMPEG || 'C:/Users/atish/AppData/Roaming/Python/Python312/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const [base = 'http://localhost:3451', out = 'tmp/learn-1031/feed2'] = process.argv.slice(2);
const only = (process.env.ONLY || '').split(',').filter(Boolean);
mkdirSync(out, { recursive: true });

const QUESTIONS = JSON.parse(readFileSync(new URL('../../data/fixtures/learn-preview-questions.json', import.meta.url), 'utf8')).questions;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const stripLetter = (s) => norm(s).replace(/^(Option\s+)?[A-F][.)]?\s+/i, '');
const keyTextOf = (f) => {
  const i = 'ABCDEF'.indexOf(f.correct_answer);
  const o = f.options.find((x) => x && x.key === f.correct_answer) || f.options[i];
  return stripLetter(typeof o === 'string' ? o : o?.text);
};
const fixtureFor = (body) => { const b = norm(body); return QUESTIONS.find((q) => norm(q.body) === b) || QUESTIONS.find((q) => b && norm(q.body).startsWith(b.slice(0, 60))) || null; };

const P = '/preview/arena?decks=real&study=on&';
const AOP = 'accountancy.admission-of-partner';
const feedUrl = (plan = 'pro', chapter = AOP, min = 10) => `${P}view=learn2-feed&plan=${plan}&student=commerce&chapter=${chapter}&min=${min}`;
const wait = (page, ms) => page.waitForTimeout(ms);

// ---- Feed drivers ------------------------------------------------------------------------------------------------------
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
const slot = (page) => page.locator('.fx-slot[data-active]');
/** A real touch swipe up: touchStart, touchMove every 16 ms, touchEnd (the browser's own scroll and snap answer it). */
async function swipeUp(page, cdp, { share = 0.6, steps = 12 } = {}) {
  const before = (await active(page)).i;
  const vp = page.viewportSize();
  const x = Math.round(vp.width * 0.42);
  // A synthetic touch has no fling, so the swipe travels most of the screen (a real flick of a third of it does the same).
  const distance = Math.round(vp.height * share);
  let y = Math.round(vp.height * 0.85);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let k = 0; k < steps; k += 1) { y -= distance / steps; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y) }] }); await wait(page, 16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction((b) => { const s = document.querySelector('.fx-slot[data-active]'); return s && Number(s.dataset.slot) !== b; }, before, { timeout: 4000 }).catch(() => {});
  await wait(page, 650);
}
async function answer(page, want) {
  const s = await active(page);
  const f = fixtureFor(s.body);
  const opts = await slot(page).locator('.fx-opt .fx-opt__t').allTextContents();
  let idx = want === 'right' ? 0 : 1;
  if (f) {
    const keyText = keyTextOf(f);
    const keyAt = opts.findIndex((t) => stripLetter(t) === keyText);
    if (keyAt >= 0) idx = want === 'right' ? keyAt : (keyAt === 0 ? 1 : 0);
  }
  // A tap while the snap is still settling only stops the scroll (as on a phone): wait for the feed to rest, and tap once more if needed.
  await page.waitForFunction(() => new Promise((res) => { const f = document.querySelector('.fx-feed'); const a = f.scrollTop; requestAnimationFrame(() => requestAnimationFrame(() => res(Math.abs(f.scrollTop - a) < 0.5))); }), null, { timeout: 5000 }).catch(() => {});
  const graded = slot(page).locator('.fx-opt[data-state="right"], .fx-opt[data-state="wrong"]').first();
  for (let t = 0; t < 3; t += 1) {
    await slot(page).locator('.fx-opt').nth(idx).tap();
    if (await graded.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) break;
  }
  await graded.waitFor({ timeout: 5000 });
  const got = await slot(page).locator('.fx-opt[data-state="right"]').count() ? 'right' : 'wrong';
  return got;
}
/** Swipe on until `stop(state)`; questions on the way are answered by `policy`. */
async function walk(page, cdp, stop, policy = () => 'right', { keep = () => false } = {}, max = 40) {
  let nq = 0;
  for (let i = 0; i < max; i += 1) {
    const s = await active(page);
    if (stop(s)) return s;
    if (s.k === 'end') return s;
    if (s.k === 'q' && !s.answered) { await answer(page, policy(s, nq)); nq += 1; await wait(page, 700); const s2 = await active(page); if (stop(s2)) return s2; }
    if (s.k === 'q' && await slot(page).locator('.fx-sheet__x').count()) { await slot(page).locator('.fx-sheet__x').tap(); await wait(page, 300); }
    if (s.k === 'card' && keep(s) && !s.kept) { await slot(page).locator('.fx-rail__key').first().tap(); await wait(page, 500); }
    await swipeUp(page, cdp);
  }
  throw new Error('the feed did not reach the wanted state');
}

// ---- The shots ------------------------------------------------------------------------------------------------------------
const SHOTS = [
  { name: '01-explore-covers', url: `${P}view=explore&plan=pro&student=commerce`, wait: '.fxc-cover:not([data-skel])', hit: '.fxc-play',
    act: async (page) => { await page.locator('.fxc').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70)); await wait(page, 600); } },
  { name: '02-feed-card-front', url: feedUrl(), wait: '.fx-card', hit: '.fx-rail__key', themes: ['dark', 'light'], widths: [390, 360, 430] },
  { name: '03-feed-card-turned', url: feedUrl(), wait: '.fx-card',
    act: async (page) => { await slot(page).locator('.fx-card').tap(); await wait(page, 700); } },
  { name: '04-feed-kept', url: feedUrl(), wait: '.fx-card',
    act: async (page) => { await slot(page).locator('.fx-card').tap(); await wait(page, 600); await slot(page).locator('.fx-rail__key').first().tap(); await page.waitForSelector('.fx-slot[data-active] .fx-rail__key[data-on]'); await wait(page, 600); } },
  { name: '05-feed-question', url: feedUrl(), wait: '.fx-card', hit: '.fx-opt', widths: [390, 360, 430],
    act: async (page, cdp) => { await walk(page, cdp, (s) => s.k === 'q' && !s.answered); await wait(page, 300); } },
  { name: '06-feed-right-streak', url: feedUrl(), wait: '.fx-card',
    act: async (page, cdp) => {
      for (let i = 0; i < 40; i += 1) {
        if (await page.locator('.fx-streak').count()) break;
        const s = await active(page);
        if (s.k === 'end') throw new Error('no streak of 3 in this feed');
        if (s.k === 'q' && !s.answered) { await answer(page, 'right'); await wait(page, 500); continue; }
        await swipeUp(page, cdp);
      }
      await wait(page, 700);
    } },
  { name: '07-feed-wrong-sheet', url: feedUrl(), wait: '.fx-card', themes: ['dark', 'light'], hit: '.fx-sheet__x',
    act: async (page, cdp) => { await walk(page, cdp, (s) => s.k === 'q' && !s.answered); await answer(page, 'wrong'); await page.waitForSelector('.fx-slot[data-active] .fx-sheet'); await wait(page, 900); } },
  { name: '08-feed-checkpoint', url: feedUrl(), wait: '.fx-card', hit: '.fx-cp .kc-btn--volt',
    act: async (page, cdp) => { await walk(page, cdp, (s) => s.k === 'checkpoint', (s, n) => (n === 1 ? 'wrong' : 'right'), { keep: (s) => s.i % 3 === 0 }); await wait(page, 500); } },
  { name: '09-feed-end', url: feedUrl(), wait: '.fx-card', themes: ['dark', 'light'], widths: [390, 360, 430],
    act: async (page, cdp) => {
      await walk(page, cdp, (s) => s.k === 'end', (s, n) => (n === 1 ? 'wrong' : 'right'), { keep: (s) => s.i % 3 === 0 }, 60);
      await page.waitForSelector('.fx-slot[data-active] .fx-end__title', { timeout: 20000 }); await wait(page, 900);
    } },
  { name: '10-feed-free-end', url: feedUrl('free'), wait: '.fx-card', hit: '.fx-free .fx-textkey',
    act: async (page, cdp) => {
      await walk(page, cdp, (s) => s.k === 'end', () => 'right', { keep: (s) => s.i < 4 }, 60);
      await page.waitForSelector('.fx-slot[data-active] .fx-end__title', { timeout: 20000 }); await wait(page, 900);
    } },
  { name: '11-learn-home-search', url: `${P}view=learn2&plan=pro&student=commerce&subject=accountancy`, wait: '.lh-find input', hit: '.lh-find input',
    act: async (page) => { await page.waitForSelector('.lh-row', { timeout: 60000 }); await wait(page, 500); } },
  { name: '12-learn-home-find-shelves', url: `${P}view=learn2&plan=pro&student=commerce&subject=accountancy`, wait: '.lh-find input',
    act: async (page) => { await page.waitForSelector('.lh-row', { timeout: 60000 }); await page.locator('.lh-find input').tap(); await page.waitForSelector('.l2f-shelf:not([role="status"] *)', { timeout: 30000 }); await wait(page, 900); await page.evaluate(() => { const el = document.querySelector('.lh-find'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 76); }); await wait(page, 400); } },
  { name: '13-learn-home-goodwill', url: `${P}view=learn2&plan=pro&student=commerce&subject=accountancy`, wait: '.lh-find input',
    act: async (page) => {
      await page.waitForSelector('.lh-row', { timeout: 60000 });
      await page.locator('.lh-find input').tap();
      await page.keyboard.type('goodwill', { delay: 70 });
      await page.waitForSelector('.l2f-results .l2c-row, .l2f-results .l2f-link', { timeout: 20000 });
      await wait(page, 900);
      await page.evaluate(() => { const el = document.querySelector('.lh-find'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 76); });
      await wait(page, 400);
    } },
];

const SIZES = { 390: { width: 390, height: 844 }, 360: { width: 360, height: 780 }, 430: { width: 430, height: 932 } };
const errors = [];
const IGNORE = /Fixture endpoint not supplied|status of 503|status of 418|status of 404|status of 402|status of 401|favicon|Download the React DevTools/i;
const reduced = process.env.REDUCED === '1';

async function newPhone(browser, { width = 390, theme = 'dark', video = null } = {}) {
  const ctx = await browser.newContext({ viewport: SIZES[width], deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: theme, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('mm:theme:v1', t); } catch { /* none */ }
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none */ }
  }, theme);
  return ctx;
}
const hideNote = (page) => page.addStyleTag({ content: '.arena-fixture-note { display: none !important; } nextjs-portal { display: none !important; }' });

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const shot of SHOTS) {
    if (process.env.FILM_ONLY === '1') break;
    if (only.length && !only.some((o) => shot.name.includes(o))) continue;
    for (const theme of shot.themes || ['dark']) {
      for (const width of shot.widths || [390]) {
        if (theme === 'light' && width !== 390) continue;
        const ctx = await newPhone(browser, { width, theme });
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        const tag = `${shot.name} ${width} ${theme}`;
        page.on('pageerror', (e) => errors.push(`${tag}: pageerror ${e.message.slice(0, 200)}`));
        page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(`${tag} console: ${m.text().slice(0, 200)}`); });
        const file = join(out, `${shot.name}-${width}-${theme === 'dark' ? 'night' : 'day'}${reduced ? '-reduced' : ''}.png`);
        try {
          await page.goto(`${base}${shot.url}&kcs=${encodeURIComponent(`f2-${shot.name}-${width}-${theme}-${Date.now()}`)}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
          await hideNote(page);
          await page.waitForSelector(shot.wait, { timeout: 120000, state: 'visible' });
          await wait(page, 1200);
          const clsBefore = await page.evaluate(() => window.__cls || 0);
          if (shot.act) await shot.act(page, cdp);
          await wait(page, 300);
          if (shot.hit) {
            const covered = await page.locator(`${shot.hit}`).filter({ visible: true }).first().evaluate((el) => {
              const r = el.getBoundingClientRect();
              if (r.bottom < 0 || r.top > innerHeight) return 'off screen';
              const at = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1));
              return at && (el === at || el.contains(at)) ? null : (at ? `${at.tagName}.${at.className}` : 'nothing');
            }).catch((e) => `missing (${e.message.split('\n')[0]})`);
            if (covered) errors.push(`${tag}: ${shot.hit} is covered by ${covered}`);
          }
          // Sideways spill: the page, and whether the feed itself can be pushed sideways (a clipped bleed does not count).
          const spill = await page.evaluate(() => {
            let worst = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            for (const el of document.querySelectorAll('.fx-feed, .fx-slot[data-active], .fxc')) { const was = el.scrollLeft; el.scrollLeft = 200; worst = Math.max(worst, el.scrollLeft); el.scrollLeft = was; }
            return worst;
          });
          if (spill > 1) errors.push(`${tag}: sideways spill ${spill}px`);
          const cls = await page.evaluate(() => window.__cls || 0);
          if (cls - clsBefore > 0.02 || cls > 0.1) errors.push(`${tag}: layout shift ${cls.toFixed(3)} (after load ${(cls - clsBefore).toFixed(3)})`);
          await page.screenshot({ path: file });
          console.log('saved', file);
        } catch (e) {
          errors.push(`${tag}: ${e.message.split('\n')[0]}`);
          try { await page.screenshot({ path: file.replace('.png', '-FAILED.png') }); } catch { /* none */ }
        }
        await ctx.close();
      }
    }
  }

  // ---- The film: a real touch walk at 390 Night, 12 to 15 s --------------------------------------------------------------
  if (process.env.FILM !== '0' && !only.length) {
    const frames = resolve(out, 'film-frames');
    rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    const ctx = await newPhone(browser, { width: 390, theme: 'dark' });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    page.on('pageerror', (e) => errors.push(`film: pageerror ${e.message.slice(0, 200)}`));
    await page.goto(`${base}${P}view=explore&plan=pro&student=commerce&kcs=f2-film-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    await hideNote(page);
    await page.waitForSelector('.fxc-cover:not([data-skel])', { timeout: 120000 });
    // Warm the feed route once so the film shows the walk, not the first compile.
    await page.evaluate(async (u) => { await fetch(u).catch(() => {}); }, `${base}${feedUrl()}`);
    await page.locator('.fxc').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
    await wait(page, 800);
    const stamps = [];
    let n = 0;
    cdp.on('Page.screencastFrame', async (f) => {
      const name = `f${String(n += 1).padStart(5, '0')}.jpg`;
      writeFileSync(join(frames, name), Buffer.from(f.data, 'base64'));
      stamps.push({ name, t: f.metadata.timestamp });
      await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
    await wait(page, 500);
    await page.locator('.fxc-play').first().tap();
    await page.waitForSelector('.fx-slot[data-active] .fx-card', { timeout: 30000 });
    await hideNote(page);
    await wait(page, 700);
    await slot(page).locator('.fx-card').tap();
    await wait(page, 1000);
    await slot(page).locator('.fx-rail__key').first().tap();
    await wait(page, 750);
    await swipeUp(page, cdp);
    for (let i = 0; i < 8 && (await active(page)).k !== 'q'; i += 1) await swipeUp(page, cdp);
    await wait(page, 500);
    await answer(page, 'wrong');
    await wait(page, 1500);
    await slot(page).locator('.fx-sheet__x').tap();
    await wait(page, 600);
    await swipeUp(page, cdp);
    for (let i = 0; i < 8 && (await active(page)).k !== 'q'; i += 1) await swipeUp(page, cdp);
    await wait(page, 400);
    await answer(page, 'right');
    await wait(page, 1000);
    await cdp.send('Page.stopScreencast');
    await wait(page, 300);
    await ctx.close();
    // Encode with each frame's own duration (a screencast sends frames only when the screen changes).
    stamps.sort((a, b) => a.t - b.t);
    const list = stamps.map((s, i) => `file '${join(frames, s.name).replace(/\\/g, '/')}'\nduration ${Math.max(0.016, ((stamps[i + 1]?.t ?? s.t + 0.5) - s.t)).toFixed(3)}`).join('\n');
    writeFileSync(join(frames, 'list.txt'), `${list}\nfile '${join(frames, stamps[stamps.length - 1].name).replace(/\\/g, '/')}'\n`);
    const film = resolve(out, 'feed2-touch-walk-390-night.webm');
    // Over 15 s, the extra comes off the start (the covers screen), so the film always ends on the graded answer.
    const total = stamps.length ? stamps[stamps.length - 1].t - stamps[0].t + 0.5 : 0;
    const skip = Math.max(0, total - 15).toFixed(2);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(frames, 'list.txt'), '-ss', skip, '-vf', 'fps=30,scale=780:-2', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', film], { stdio: 'inherit' });
    const secs = total - Number(skip);
    console.log('film', film, `${secs.toFixed(1)} s`, `${stamps.length} frames`);
    if (secs < 12 || secs > 15.05) errors.push(`film: ${secs.toFixed(1)} s, wanted 12 to 15 s`);
    rmSync(frames, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}
if (errors.length) { console.log('ERRORS'); for (const e of errors) console.log(' ', e); process.exit(1); }
