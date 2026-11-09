// The one-gesture bench: real Chrome, real touch and wheel input (CDP Input.dispatch*), against the home page's held
// stories. Used by oneGesture.test.mjs (skipped when no Chrome or no server is reachable) and by hand:
//   node src/components/landing/oneGestureBench.mjs [url=http://localhost:3467/] [mode=matrix|flow|wheel|jump|fast|perf] [width=390] [stories] [warm]
// `flow` (10 Nov 2026, LK190) is the touch screen's own matrix: nothing holds there, so `matrix` (one gesture, one step
// by touch) now describes only a touch on a mouse-first device and is no longer run at phone width.
//
// Real Chrome, not chrome-headless-shell: the shell never scrolls on synthetic input (LK69 forensics). One headless
// browser on this PC at a time: the shared lock (tmp-devslots/browser.lock) is taken before launch and dropped after.
// Everything is a CDP touch sequence with exact timestamps (8 ms apart), lifted while moving (Chrome flings) or held.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const PLAYWRIGHT = process.env.MM_PLAYWRIGHT || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core';
export const CHROME = process.env.MM_CHROME || 'C:/Users/atish/.cache/puppeteer/chrome/win64-151.0.7922.71/chrome-win64/chrome.exe';
const LOCK = process.env.MM_BROWSER_LOCK || 'C:/Users/atish/Desktop/mockmob copy/tmp-devslots/browser.lock';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const benchAvailable = () => existsSync(CHROME) && existsSync(PLAYWRIGHT.replace(/\/playwright-core$/, '') + '/playwright-core');

// ---------------------------------------------------------------- the shared browser lock
async function takeLock(label) {
  for (let i = 0; i < 120; i += 1) {
    try { writeFileSync(LOCK, label, { flag: 'wx' }); return; } catch (error) {
      if (!['EEXIST', 'EISDIR', 'EPERM', 'EBUSY'].includes(error.code)) throw error;
      await sleep(30000);
    }
  }
  throw new Error('browser lock busy for an hour');
}
function dropLock(label) {
  try { if (existsSync(LOCK) && readFileSync(LOCK, 'utf8') === label) rmSync(LOCK, { force: true }); } catch { /* not ours */ }
}

// ---------------------------------------------------------------- opening a page
/** Hold the shared lock for a whole burst of benches (open several, one after another) and drop it at the end. */
export async function withLock(label, fn) {
  const tag = `${label} pid ${process.pid} ${new Date().toISOString()}`;
  await takeLock(tag);
  try { return await fn(); } finally { dropLock(tag); }
}

export async function openBench({ url, width = 390, height = 844, theme = 'dark', touch = true, cpu = 1, label = 'one-gesture bench', lock = true, reducedMotion = 'no-preference' } = {}) {
  const tag = `${label} pid ${process.pid} ${new Date().toISOString()}`;
  if (lock) await takeLock(tag);
  const { chromium } = require(PLAYWRIGHT);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-extensions', '--js-flags=--max-old-space-size=512'] });
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch, colorScheme: theme, reducedMotion,
      userAgent: touch ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36' : undefined,
    });
    await ctx.addInitScript((t) => { try { localStorage.setItem('mm:theme:v1', t); localStorage.setItem('mm:theme-hint:v1', '1'); } catch { /* none */ } }, theme);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror ${String(error.message).slice(0, 200)}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console ${message.text().slice(0, 200)}`); });
    const cdp = await ctx.newCDPSession(page);
    await page.goto(url, { waitUntil: 'load', timeout: 240000 });
    await sleep(url.startsWith('file:') ? 800 : 3500);
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const bench = new Bench({ page, cdp, width, height, errors, reloads: 0, closeFn: async () => { try { await browser.close(); } finally { if (lock) dropLock(tag); } } });
    // A dev server reloads the page when someone saves a file under it: a cell that ran across a reload is not a result.
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) bench.reloads += 1; });
    return bench;
  } catch (error) {
    try { await browser?.close(); } finally { if (lock) dropLock(tag); }
    throw error;
  }
}

class Bench {
  constructor(parts) { Object.assign(this, parts); }

  y() { return this.page.evaluate(() => Math.round(window.scrollY)); }

  /** Every held story: its name, 0-based step, geometry and resting places (document px). */
  async stories() {
    return this.page.evaluate(() => [...document.querySelectorAll('.ss[data-pinned="true"]')].map((root) => {
      const track = root.querySelector('.ss__track');
      const stage = root.querySelector('.ss__stage');
      const top = Math.round(track.getBoundingClientRect().top + window.scrollY);
      const hold = track.offsetHeight - stage.offsetHeight;
      const steps = Number(root.style.getPropertyValue('--ss-steps')) || root.querySelectorAll('.ss__beat').length;
      const name = [...root.classList].find((c) => c !== 'ss' && !c.startsWith('ss--')) || 'story';
      return { name, top, hold, steps, step: Number(root.dataset.step), stageH: stage.offsetHeight, gap: hold / Math.max(1, steps - 1), rests: Array.from({ length: steps }, (_, k) => Math.round(top + (hold * k) / Math.max(1, steps - 1))) };
    }));
  }

  async story(name) { return (await this.stories()).find((s) => s.name === name); }

  async step(name) { return this.page.evaluate((n) => Number(document.querySelector(`.ss.${n}`)?.dataset.step), name); }

  /** Put the page at y from inside the hold (a second jump: a first one across an edge is read as a fling and clamped). */
  async jump(y) {
    for (let i = 0; i < 2; i += 1) {
      await this.page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), Math.round(y));
      await this.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await sleep(i ? 400 : 900);
    }
  }

  /** Wait until the page has not moved for `quiet` ms. */
  async settle(quiet = 700, max = 12000) {
    const t0 = Date.now();
    let last = await this.y();
    let since = Date.now();
    while (Date.now() - t0 < max) {
      await sleep(80);
      const y = await this.y();
      if (y !== last) { last = y; since = Date.now(); } else if (Date.now() - since >= quiet) break;
    }
    await sleep(300);
    return this.y();
  }

  // ---- touch
  async flick(dist, speed, { fromY, fling = true } = {}) {
    const x = Math.round(this.width / 2);
    const y0 = fromY ?? (dist > 0 ? this.height - 84 : 110);
    const total = (Math.abs(dist) / speed) * 1000;
    const n = Math.max(3, Math.round(total / 8));
    const dt = total / n;
    let t = Date.now() / 1000;
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }], timestamp: t });
    for (let i = 1; i <= n; i += 1) {
      t += dt / 1000;
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - (dist * i) / n) }], timestamp: t });
      await sleep(dt);
    }
    if (!fling) { await sleep(300); t = Date.now() / 1000; }
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t + 0.001 });
  }

  async drag(dist, { stepPx = 2, everyMs = 25, holdMs = 250 } = {}) {
    const x = Math.round(this.width / 2);
    const y0 = dist > 0 ? this.height - 64 : 100;
    const n = Math.max(1, Math.round(Math.abs(dist) / stepPx));
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= n; i += 1) {
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - Math.sign(dist) * i * stepPx) }] });
      await sleep(everyMs);
    }
    await sleep(holdMs);
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  async dragReverse(fwd, back, { stepPx = 2, everyMs = 16, holdMs = 250 } = {}) {
    const x = Math.round(this.width / 2);
    const y0 = Math.round(this.height * 0.7);
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    const n1 = Math.round(Math.abs(fwd) / stepPx);
    const n2 = Math.round(Math.abs(back) / stepPx);
    for (let i = 1; i <= n1; i += 1) { await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - Math.sign(fwd) * i * stepPx) }] }); await sleep(everyMs); }
    for (let i = 1; i <= n2; i += 1) { await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - Math.sign(fwd) * (n1 * stepPx - i * stepPx)) }] }); await sleep(everyMs); }
    await sleep(holdMs);
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  // ---- wheel and keys
  async wheel(notches, { deltaY = 100, gapMs = 40 } = {}) {
    const x = Math.round(this.width / 2);
    const y = Math.round(this.height / 2);
    // Timestamps are given (like the touch events), so a busy renderer that is slow to acknowledge one event cannot
    // stretch the gaps between them: a real wheel does not wait for the page.
    let t = Date.now() / 1000;
    for (let i = 0; i < notches; i += 1) {
      await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY, timestamp: t });
      t += gapMs / 1000;
      if (gapMs) await sleep(gapMs);
    }
  }

  /** A trackpad swipe: `count` wheel events whose deltas decay over `ms`. */
  async trackpad(count = 60, ms = 900, peak = 90) {
    const x = Math.round(this.width / 2);
    const y = Math.round(this.height / 2);
    let t = Date.now() / 1000;
    for (let i = 0; i < count; i += 1) {
      await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: Math.max(1, Math.round(peak * (1 - i / count) ** 2)), timestamp: t });
      t += ms / count / 1000;
      await sleep(ms / count);
    }
  }

  async key(name) { await this.page.keyboard.press(name); }

  /** The listeners registered on window that can cancel a scroll (touchmove, wheel, touchstart non-passive). */
  async nonPassive() {
    const { result } = await this.cdp.send('Runtime.evaluate', { expression: 'window' });
    const { listeners } = await this.cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    return listeners.filter((l) => ['touchstart', 'touchmove', 'wheel', 'touchend'].includes(l.type) && !l.passive).map((l) => l.type);
  }

  async documentHeight() { return this.page.evaluate(() => document.documentElement.scrollHeight); }

  async close() { await this.closeFn(); }
}

/** Run one cell; if the page was reloaded under it (a dev server hot reload), wait and run it again (at most 3 times). */
async function steady(bench, log, id, cell) {
  for (let attempt = 0; ; attempt += 1) {
    const before = bench.reloads;
    let row = null;
    try { row = await cell(); } catch (error) {
      const navigated = /Execution context was destroyed|navigation/i.test(String(error?.message));
      if (!(navigated || bench.reloads !== before) || attempt >= 3) throw error;
    }
    if (row && bench.reloads === before) return row;
    if (attempt >= 3) return row;
    log(`redo ${id}: the page was reloaded under the cell (a file changed under the dev server)`);
    await sleep(5000);
  }
}

// ---------------------------------------------------------------- the matrix (the LK69 acceptance)
const distances = [60, 150, 300, 600];
const speeds = [400, 1200, 3000, 6000];

export function expectedRest(story, step) { return story.rests[step]; }

/**
 * Run the LK69 matrix on one story: 16 flick cells, slow drags, a nudge, reversals, two quick flicks, entry, exit.
 * Returns rows { id, ok, ... }. `ok` is true when the gesture's rule held.
 */
export async function runMatrix(bench, name, { log = () => {}, reduced = false } = {}) {
  const rows = [];
  const refresh = async () => bench.story(name);
  const at = async (k) => { let s = await refresh(); await bench.jump(s.rests[k]); s = await refresh(); if (Math.abs((await bench.y()) - s.rests[k]) > 2) await bench.jump(s.rests[k]); return refresh(); };
  const check = async (id, startStep, gesture, rule) => {
    const row = await steady(bench, log, id, async () => {
      const before = await at(startStep);
      await gesture(before);
      const y = await bench.settle();
      const after = await refresh();
      const step = await bench.step(name);
      const nearest = after.rests.reduce((best, r, i) => (Math.abs(r - y) < Math.abs(after.rests[best] - y) ? i : best), 0);
      const off = y - after.rests[nearest];
      const made = { id, start: startStep, step, delta: step - startStep, y, off, nearest, inHold: y >= after.top - 2 && y <= after.top + after.hold + 2 };
      made.ok = rule(made, after);
      return made;
    });
    rows.push(row);
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${name} ${id} step ${startStep}->${row.step} y ${row.y} off ${row.off}`);
    return row;
  };
  const one = (r) => r.delta === 1 && Math.abs(r.off) <= 2;
  for (const d of distances) for (const v of speeds) await check(`flick-${d}-${v}`, 1, () => bench.flick(d, v), one);
  for (const d of [120, 150, 300]) await check(`slow-drag-${d}`, 1, () => bench.drag(d), one);
  await check('nudge-20', 1, () => bench.drag(20), (r) => r.delta === 0 && Math.abs(r.off) <= 2);
  await check('reverse-100-back-100', 1, () => bench.dragReverse(100, 100), (r) => r.delta === 0 && Math.abs(r.off) <= 2);
  await check('reverse-300-back-200', 1, () => bench.dragReverse(300, 200), (r) => r.delta === 1 && Math.abs(r.off) <= 2);
  await check('back-one', 2, () => bench.flick(-300, 1200, { fromY: 120 }), (r) => r.delta === -1 && Math.abs(r.off) <= 2);
  // 150 ms apart: inside the 420 ms lock the second flick is swallowed (1 step); under reduced motion the lock is 120 ms, so it counts (2).
  await check('two-flicks-150ms', 1, async () => { await bench.flick(300, 3000); await sleep(150); await bench.flick(300, 3000); }, reduced ? (r) => r.delta === 2 && Math.abs(r.off) <= 2 : one);
  await check('two-flicks-700ms', 1, async () => { await bench.flick(300, 3000); await sleep(700); await bench.flick(300, 3000); }, (r) => r.delta === 2 && Math.abs(r.off) <= 2);
  // The edges: a fling arriving from outside stops on step 0 / the last step; a fling leaving is free; a drag that ends
  // short of a story is free. A finger that drags the page into a story is held on the rest it came in by (5 Nov 2026,
  // LK90: a 600 px swipe from 360 px above the statement used to end on its step 1 or 2).
  const edge = async (id, from, gesture, rule) => {
    let last = null;
    const row = await steady(bench, log, id, async () => {
      let s = await refresh();
      const y0 = from(s);
      await bench.jump(y0);
      // The gesture starts from where it was meant to: a start the page did not take (a busy machine) is jumped to again.
      for (let tries = 0; tries < 3 && Math.abs((await bench.y()) - y0) > 2; tries += 1) await bench.jump(y0);
      s = await refresh();
      await gesture(s);
      const y = await bench.settle();
      s = await refresh();
      const step = await bench.step(name);
      const made = { id, start: Math.round(y0), step, delta: 0, y, off: 0, nearest: 0, inHold: y >= s.top - 2 && y <= s.top + s.hold + 2 };
      made.ok = rule(made, s);
      last = s;
      return made;
    });
    rows.push(row);
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${name} ${id} from ${row.start} step ${row.step} y ${row.y} (top ${last?.top}, end ${last ? last.top + last.hold : '?'})`);
  };
  const innerH = bench.height;
  await edge('enter-flick-600-6000-from-500-above', (s) => s.top - 500, () => bench.flick(600, 6000), (r, s) => r.step === 0 && Math.abs(r.y - s.rests[0]) <= 2);
  await edge('enter-drag-600-2500-from-360-above', (s) => s.top - 360, () => bench.flick(600, 2500), (r, s) => r.step === 0 && Math.abs(r.y - s.rests[0]) <= 2);
  await edge('enter-flick-300-1200-from-200-above', (s) => s.top - 200, () => bench.flick(300, 1200), (r, s) => r.step === 0 && Math.abs(r.y - s.rests[0]) <= 2);
  await edge('enter-flick-600-6000-from-below', (s) => s.top + s.hold + 500, () => bench.flick(-600, 6000, { fromY: 120 }), (r, s) => r.step === s.steps - 1 && Math.abs(r.y - s.rests[s.steps - 1]) <= 2);
  await edge('exit-flick-300-3000-down', (s) => s.rests[s.steps - 1], () => bench.flick(300, 3000), (r, s) => r.y > s.top + s.hold + 2);
  await edge('exit-flick-300-3000-up', (s) => s.rests[0], () => bench.flick(-300, 3000, { fromY: 120 }), (r, s) => r.y < s.top - 2);
  await edge('slow-drag-300-arriving-is-free', (s) => s.top - 500, () => bench.drag(300), (r, s) => r.y > s.top - 500 + 200 && r.y < s.top);
  void innerH;
  return rows;
}

// ---------------------------------------------------------------- FLOW: the touch screen's matrix (10 Nov 2026, LK190)
/**
 * On a touch screen a story never holds the page (ScrollStory.jsx FLOW). What must hold instead, cell by cell:
 *   free      every gesture moves the page the way the finger went; a flick is never caught on a story's edge
 *   settled   a scroll that rests inside a story rests exactly on a resting place, and the story shows that step
 *   gentle    from a rest, a drag of 0.6 of a gap moves one step, 0.3 of a gap none, and back the same way
 *   shown     walking the story with gentle drags shows every step once, in order
 *   passing   a fling from above the story runs on into it (or through it); the steps it passes show in order
 * Returns rows { id, ok, ... } like runMatrix.
 */
export async function runFlow(bench, name, { log = () => {} } = {}) {
  const rows = [];
  const refresh = async () => bench.story(name);
  const at = async (k) => { let s = await refresh(); await bench.jump(s.rests[k]); s = await refresh(); if (Math.abs((await bench.y()) - s.rests[k]) > 2) await bench.jump(s.rests[k]); return refresh(); };
  const read = async (id, start, y0) => {
    const y = await bench.settle();
    const s = await refresh();
    const step = await bench.step(name);
    const nearest = s.rests.reduce((best, r, i) => (Math.abs(r - y) < Math.abs(s.rests[best] - y) ? i : best), 0);
    const inHold = y >= s.top - 2 && y <= s.top + s.hold + 2;
    return [{ id, start, step, delta: step - start, y, y0, off: y - s.rests[nearest], nearest, inHold }, s];
  };
  // At rest inside the story: on a resting place, showing that step. Outside it: the story shows the end it was left by.
  const consistent = (r, s) => (r.inHold ? Math.abs(r.off) <= 2 && r.step === r.nearest : (r.y > s.top + s.hold ? r.step === s.steps - 1 : r.step === 0));
  const check = async (id, startStep, gesture, rule) => {
    const row = await steady(bench, log, id, async () => {
      const before = await at(startStep);
      const y0 = await bench.y();
      await gesture(before);
      const [made, s] = await read(id, startStep, y0);
      made.ok = consistent(made, s) && rule(made, s);
      return made;
    });
    rows.push(row);
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${name} ${id} step ${startStep}->${row.step} y ${row.y0}->${row.y} off ${row.off}${row.inHold ? '' : ' (left the story)'}`);
    return row;
  };
  const s0 = await refresh();
  const gap = s0.gap;
  const reach = bench.height - 170; // the longest drag one finger can make on this screen
  // gentle: the distances are shares of this story's own gap.
  await check('drag-0.3-gap-stays', 1, () => bench.drag(Math.round(gap * 0.3)), (r) => r.delta === 0);
  if (gap * 0.6 <= reach) await check('drag-0.6-gap-one-step', 1, () => bench.drag(Math.round(gap * 0.6)), (r) => r.delta === 1);
  if (gap * 0.6 <= reach) await check('drag-back-0.6-gap-one-step', 2, () => bench.drag(-Math.round(gap * 0.6)), (r) => r.delta === -1);
  if (gap * 1.6 <= reach && s0.steps > 3) await check('drag-1.6-gap-two-steps', 1, () => bench.drag(Math.round(gap * 1.6)), (r) => r.delta === 2);
  await check('nudge-20-stays', 1, () => bench.drag(20), (r) => r.delta === 0);
  await check('reverse-100-back-100-stays', 1, () => bench.dragReverse(100, 100), (r) => r.delta === 0);
  // free: a flick always moves the page down, by more the harder it is; where it ends is consistent.
  let lastTravel = 0;
  for (const [d, v] of [[150, 1200], [300, 1200], [300, 3000], [600, 3000], [600, 6000]]) {
    const row = await check(`flick-${d}-${v}`, 1, () => bench.flick(d, v), (r) => r.y > r.y0 + Math.min(d, gap / 2) - 2 || r.delta >= 1);
    row.travel = row.y - row.y0;
    lastTravel = Math.max(lastTravel, row.travel);
  }
  await check('flick-up-300-3000', Math.min(2, s0.steps - 1), () => bench.flick(-300, 3000, { fromY: 120 }), (r) => r.y < r.y0);
  // Two quick flicks are two flicks: nothing is swallowed by a lock.
  await check('two-flicks-150ms', 0, async () => { await bench.flick(200, 2000); await sleep(150); await bench.flick(200, 2000); }, (r) => r.delta >= 1 || !r.inHold);
  // shown: gentle drags walk every step once, in order.
  {
    const id = 'walk-every-step';
    const row = await steady(bench, log, id, async () => {
      let s = await at(0);
      const seen = [await bench.step(name)];
      const dragPx = Math.min(reach, Math.round(s.gap * 0.62));
      for (let i = 1; i < s.steps; i += 1) { await bench.drag(dragPx); await bench.settle(500); seen.push(await bench.step(name)); }
      s = await refresh();
      const y = await bench.y();
      const want = Array.from({ length: s.steps }, (_, k) => k);
      return { id, start: 0, step: seen[seen.length - 1], delta: seen.length - 1, y, y0: s.rests[0], off: y - s.rests[s.steps - 1], nearest: s.steps - 1, inHold: true, seen, ok: dragPx >= s.gap * 0.55 ? JSON.stringify(seen) === JSON.stringify(want) : seen.every((k, i) => i === 0 || k >= seen[i - 1]) };
    });
    rows.push(row);
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${name} ${id} steps shown ${row.seen.join(' ')}`);
  }
  // passing: a fling from above is not caught on the first rest; the steps it passes show in order (never backwards).
  const edge = async (id, from, gesture, rule) => {
    const row = await steady(bench, log, id, async () => {
      let s = await refresh();
      const y0 = from(s);
      await bench.jump(y0);
      for (let tries = 0; tries < 3 && Math.abs((await bench.y()) - y0) > 2; tries += 1) await bench.jump(y0);
      await bench.page.evaluate((n) => {
        const root = document.querySelector(`.ss.${n}`);
        window.__flowSeen = [Number(root.dataset.step)];
        window.__flowWatch?.disconnect();
        window.__flowWatch = new MutationObserver(() => { const k = Number(root.dataset.step); if (window.__flowSeen[window.__flowSeen.length - 1] !== k) window.__flowSeen.push(k); });
        window.__flowWatch.observe(root, { attributes: true, attributeFilter: ['data-step'] });
      }, name);
      await gesture(s);
      const [made] = await read(id, 0, Math.round(y0));
      s = await refresh();
      made.seen = await bench.page.evaluate(() => { window.__flowWatch?.disconnect(); return window.__flowSeen; });
      made.ok = consistent(made, s) && rule(made, s);
      return made;
    });
    rows.push(row);
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${name} ${id} y ${row.y0}->${row.y} step ${row.step}, shown on the way ${row.seen.join(' ')}${row.inHold ? '' : ' (left the story)'}`);
  };
  const rising = (seen) => seen.every((k, i) => i === 0 || k > seen[i - 1]);
  const falling = (seen) => seen.every((k, i) => i === 0 || k < seen[i - 1]);
  await edge('pass-flick-600-6000-from-500-above', (s) => s.top - 500, () => bench.flick(600, 6000), (r, s) => r.y > s.rests[0] + s.gap / 2 && rising(r.seen));
  await edge('pass-flick-600-2500-from-360-above', (s) => s.top - 360, () => bench.flick(600, 2500), (r, s) => r.y > s.rests[0] + 2 && rising(r.seen));
  await edge('pass-flick-600-6000-from-below', (s) => s.top + s.hold + 500, () => bench.flick(-600, 6000, { fromY: 120 }), (r, s) => r.y < s.rests[s.steps - 1] - s.gap / 2 && falling(r.seen));
  await edge('exit-flick-300-3000-down', (s) => s.rests[s.steps - 1], () => bench.flick(300, 3000), (r, s) => r.y > s.top + s.hold + 2);
  await edge('exit-flick-300-3000-up', (s) => s.rests[0], () => bench.flick(-300, 3000, { fromY: 120 }), (r, s) => r.y < s.top - 2);
  await edge('slow-drag-300-short-of-the-story-is-free', (s) => s.top - 500, () => bench.drag(300), (r, s) => r.y > s.top - 500 + 200 && r.y < s.top);
  void lastTravel;
  return rows;
}

/**
 * FLOW's one stop, on a page nobody has scrolled yet: the first fling that brings each story on from above lands on its
 * first step; the same fling a second time runs on into the story. A quiet story (the statement) never lands a fling.
 * Each story is tried on a fresh load (a story the reader has rested in no longer lands anything). Returns rows { id, ok, ... }.
 */
export async function runLanding(bench, { log = () => {} } = {}) {
  const rows = [];
  const names = (await bench.stories()).map((s) => s.name);
  for (const name of names) {
    const lands = await bench.page.evaluate((n) => document.querySelector(`.ss.${n}`)?.closest('.lp-statement') === null, name);
    // A page nobody has scrolled: a fling that lands on one story has usually flown through the one before it, so each
    // story is tried on its own fresh load, from the top (a reload restores the scroll, and a page restored inside a
    // story has come to rest there: that story would already count as arrived in).
    await bench.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await sleep(600);
    await bench.page.reload({ waitUntil: 'load', timeout: 240000 });
    await sleep(3500);
    for (const pass of ['first', 'second']) {
      const id = `${name}-${pass}-fling-from-above`;
      const row = await steady(bench, log, id, async () => {
        let s = await bench.story(name);
        const y0 = s.top - 500;
        await sleep(3200); // past the fling window of the gesture before, so the jump below is not read as a fling
        await bench.jump(y0);
        for (let tries = 0; tries < 3 && Math.abs((await bench.y()) - y0) > 2; tries += 1) await bench.jump(y0);
        await bench.flick(600, 6000);
        const y = await bench.settle();
        s = await bench.story(name);
        const step = await bench.step(name);
        const landed = Math.abs(y - s.rests[0]) <= 2 && step === 0;
        const ranOn = y > s.rests[0] + s.gap / 2;
        return { id, start: y0, step, y, top: s.top, ok: lands && pass === 'first' ? landed : ranOn, landed, ranOn };
      });
      rows.push(row);
      log(`${row.ok ? 'ok  ' : 'FAIL'} ${id} y ${row.start}->${row.y} (first rest ${row.top}) step ${row.step}: ${row.landed ? 'landed on the first step' : row.ranOn ? 'ran on into the story' : 'stopped short'}`);
    }
  }
  return rows;
}

/**
 * The whole page by flicks: how many of the same ordinary flick (300 px at 1200 px/s, lifted moving) it takes to bring
 * `selector` (default the plans) to the top of the window from the top of the page, and whether any flick left the page
 * where it was (stuck). The number the owner asked about: "People will just not scroll to the end of the pricing page."
 */
export async function runJourney(bench, { selector = '#pricing', dist = 300, speed = 1200, max = 140, log = () => {} } = {}) {
  await bench.jump(0);
  await bench.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(600);
  let flicks = 0;
  let stuck = 0;
  const trail = [];
  const target = async () => bench.page.evaluate((sel) => { const n = document.querySelector(sel); return n ? Math.round(n.getBoundingClientRect().top + window.scrollY) : null; }, selector);
  for (; flicks < max; ) {
    const goal = await target();
    const y0 = await bench.y();
    if (goal === null || y0 >= goal - bench.height * 0.5) break;
    await bench.flick(dist, speed);
    const y = await bench.settle(350, 6000);
    flicks += 1;
    const stories = await bench.stories();
    const live = stories.filter((s) => y >= s.top - 2 && y <= s.top + s.hold + 2).map((s) => `${s.name}:${s.step}`).join(' ');
    // A flick inside a held story moves a step without moving the page far: that is the story's step, not a stuck page.
    if (Math.abs(y - y0) < 4 && !live) stuck += 1;
    trail.push(`${y}${live ? ` [${live}]` : ''}`);
    log(`flick ${flicks}: ${y0} -> ${y}${live ? ` [${live}]` : ''}`);
  }
  return { flicks, stuck, reached: flicks < max, height: await bench.documentHeight(), trail };
}

// ---------------------------------------------------------------- wheel, trackpad and keys (desktop)
/** One notch, five, thirty, a trackpad tail, two notches 700 ms apart, one up, PageDown and Space: each is its own gesture. */
export async function runWheel(bench, name, { log = () => {} } = {}) {
  const rows = [];
  const refresh = async () => bench.story(name);
  const at = async (k) => { let s = await refresh(); await bench.jump(s.rests[k]); s = await refresh(); if (Math.abs((await bench.y()) - s.rests[k]) > 2) await bench.jump(s.rests[k]); await bench.page.mouse.move(Math.round(bench.width / 2), Math.round(bench.height / 2)); return refresh(); };
  const check = async (id, startStep, gesture, expected) => {
    const row = await steady(bench, log, id, async () => {
      await at(startStep);
      await gesture();
      const y = await bench.settle();
      const s = await refresh();
      const step = await bench.step(name);
      const nearest = s.rests.reduce((best, r, i) => (Math.abs(r - y) < Math.abs(s.rests[best] - y) ? i : best), 0);
      const off = y - s.rests[nearest];
      return { id, start: startStep, step, delta: step - startStep, y, off, ok: step - startStep === expected && Math.abs(off) <= 2 };
    });
    rows.push(row);
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${name} ${id} step ${startStep}->${row.step} y ${row.y} off ${row.off}`);
  };
  await check('wheel-1-notch', 1, () => bench.wheel(1), 1);
  await check('wheel-5-notches-40ms', 1, () => bench.wheel(5, { gapMs: 40 }), 1);
  await check('wheel-30-notches-10ms', 1, () => bench.wheel(30, { gapMs: 10 }), 1);
  await check('trackpad-60-events-900ms', 1, () => bench.trackpad(60, 900), 1);
  await check('wheel-2-notches-700ms-apart', 1, async () => { await bench.wheel(1); await sleep(700); await bench.wheel(1); }, 2);
  await check('wheel-1-notch-up', 2, () => bench.wheel(1, { deltaY: -100 }), -1);
  await check('key-pagedown', 1, () => bench.key('PageDown'), 1);
  await check('key-space', 1, () => bench.key('Space'), 1);
  await check('key-arrowup', 2, () => bench.key('ArrowUp'), -1);
  // R5 (6 Nov 2026): a mouse spun without a pause from above the story (one burst: notches 60 ms apart). It used to stop
  // at the door and shake 100 px for as long as the wheel turned. Now it lands on the first rest without overshooting,
  // holds it through the lock, steps on while the wheel turns, and the page never moves back up while spinning down.
  const spin = await steady(bench, log, 'wheel-spin-in-from-above', async () => {
    let s = await refresh();
    await bench.jump(s.top - 260);
    await bench.settle(400);
    await bench.page.mouse.move(Math.round(bench.width / 2), Math.round(bench.height / 2));
    const trace = await record(bench, 600, () => bench.wheel(24, { gapMs: 60 }));
    await bench.settle();
    s = await refresh();
    let back = 0;
    for (let i = 1; i < trace.length; i += 1) back = Math.max(back, trace[i - 1].y - trace[i].y);
    const step = await bench.step(name);
    return { id: 'wheel-spin-in-from-above', start: -1, step, back, ok: step >= 1 && back <= 2 };
  });
  rows.push(spin);
  log(`${spin.ok ? 'ok  ' : 'FAIL'} ${name} wheel-spin-in-from-above step ${spin.step} moved back ${spin.back} px`);
  return rows;
}

// ---------------------------------------------------------------- the demo jump (LK89, 5 Nov 2026)
/**
 * A tap on a same-page link to the demo card (#try-practice) from below a held story, then 2.6 s of frames: the page must
 * land with the question card wholly on screen under the nav and stay there, with focus on the card. The link is the bench's own, pinned where a thumb taps the dock, so the journey
 * does not depend on which key the hero or the dock carries today. `places`: 'below:<story class>' (40 px past that
 * story's track, so the story is within a screen) or 'compass' (the Compass section, the Recovery Lab's story above it).
 * R3-D4 (5 Nov 2026) adds the reader's own shortcuts, each tapped where a thumb finds it:
 *   'skip:<story class>'  the bottom bar's Skip, from the story's second rest (phones): the page lands with the next
 *                         section's heading 20 px under the site bar, out of the story, and stays; focus on that heading.
 *   'top:<story class>'   the bar's Top from the story's second rest (phones): the page lands at 0 and stays.
 *   'logo'                the site bar's logo from below the last held story: the page lands at 0 and stays.
 *   'pill'                the phone nav's Pricing pill from the top: the plan's heading lands under the site bar. Retired
 *                         from the default list in round 4 (owner LK133): the pill opens /pricing now, not an in-page jump.
 */
export async function runJump(bench, { log = () => {}, places } = {}) {
  const touch = bench.width < 900;
  await bench.page.evaluate(() => {
    if (document.getElementById('bench-jump')) return;
    const a = document.createElement('a');
    a.id = 'bench-jump';
    a.href = '#try-practice';
    a.textContent = 'Try 5 questions first';
    Object.assign(a.style, { position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: '2147483000', padding: '14px 20px', background: '#D2F000', color: '#0B1000', font: '600 16px system-ui', borderRadius: '14px' });
    document.body.appendChild(a);
  });
  const stories = await bench.stories();
  // The bar's shortcuts exist on phones only; the logo everywhere.
  const shortcuts = touch ? [...stories.filter((s) => s.name !== 'lp-statement__story').map((s) => `skip:${s.name}`), 'top:lc', 'logo'] : ['logo'];
  const list = places || [...stories.map((s) => `below:${s.name}`), 'compass', ...shortcuts];
  const rows = [];
  for (const place of list) {
    if (/^(skip|top):|^(logo|pill)$/.test(place)) {
      const row = await steady(bench, log, `jump-${place}`, () => shortcut(bench, place, touch));
      rows.push(row);
      if (row.skipped) { log(`skip ${row.id}`); continue; }
      log(`${row.ok ? 'ok  ' : 'FAIL'} ${row.id} from ${row.start} to ${row.y} (expected ${row.expected}): heading top ${row.headTop ?? '-'} (nav ${row.navBottom}), ${row.moves} moves, left again ${row.leftAgain} frames, story step ${row.step ?? '-'}, focus ${row.focus}`);
      continue;
    }
    const row = await steady(bench, log, `jump-${place}`, async () => {
      const from = await bench.page.evaluate((where) => {
        if (where === 'compass') { const c = document.getElementById('compass'); return c ? Math.round(c.getBoundingClientRect().top + scrollY + 120) : null; }
        const root = document.querySelector(`.ss.${where.slice(6)}[data-pinned="true"]`);
        if (!root) return null;
        const track = root.querySelector('.ss__track');
        return Math.round(track.getBoundingClientRect().top + scrollY + track.offsetHeight + 40);
      }, place);
      if (from === null) return { id: `jump-${place}`, ok: true, skipped: true };
      await bench.jump(from);
      await bench.settle(500);
      const start = await bench.y();
      const box = await bench.page.evaluate(() => { const r = document.getElementById('bench-jump').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
      await bench.page.evaluate(() => {
        window.__jt = [];
        const tick = () => { window.__jt.push(Math.round(scrollY)); window.__jtRaf = requestAnimationFrame(tick); };
        window.__jtRaf = requestAnimationFrame(tick);
      });
      if (touch) {
        await bench.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
        await sleep(60);
        await bench.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await bench.page.mouse.click(box.x, box.y);
      }
      await sleep(2600);
      const out = await bench.page.evaluate(() => {
        cancelAnimationFrame(window.__jtRaf);
        const card = document.querySelector('#try-practice .lp-desk__card');
        const nav = document.querySelector('.mm-nav');
        const navBottom = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
        const r = card.getBoundingClientRect();
        const dock = document.querySelector('.lp-dockgate');
        return { trace: window.__jt, y: Math.round(scrollY), cardTop: Math.round(r.top), cardBottom: Math.round(r.bottom), navBottom: Math.round(navBottom), vh: innerHeight, focus: String(document.activeElement?.className || document.activeElement?.tagName), dock: dock?.dataset.shown ?? null };
      });
      // DemoJump places the card wholly on screen under the nav (centred, the room above it showing what that leaves).
      const onScreen = out.cardTop >= out.navBottom + 9 && out.cardBottom <= out.vh;
      // After the page first reaches where it ends, it never leaves it again (no loop, no put back).
      const firstAt = out.trace.findIndex((y) => Math.abs(y - out.y) <= 3);
      const leftAgain = firstAt < 0 ? -1 : out.trace.slice(firstAt).filter((y) => Math.abs(y - out.y) > 3).length;
      const moves = out.trace.filter((y, i) => i > 0 && y !== out.trace[i - 1]).length;
      return { id: `jump-${place}`, start, y: out.y, cardTop: out.cardTop, navBottom: out.navBottom, moves, leftAgain, focus: out.focus, dock: out.dock, ok: onScreen && leftAgain === 0 && /mm-drill/.test(out.focus) };
    });
    rows.push(row);
    if (row.skipped) { log(`skip ${row.id}`); continue; }
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${row.id} from ${row.start} to ${row.y}: card top ${row.cardTop} (nav ${row.navBottom}), ${row.moves} moves, left again ${row.leftAgain} frames, focus ${row.focus}, dock ${row.dock}`);
  }
  return rows;
}

/** One of the reader's shortcuts (R3-D4): the bar's Skip or Top, or the logo. See runJump. */
async function shortcut(bench, place, touch) {
  const [kind, name] = place.split(':');
  const id = `jump-${place}`;
  const page = bench.page;
  await page.evaluate(() => { const link = document.getElementById('bench-jump'); if (link) link.style.display = 'none'; });
  try {
    let from;
    if (kind === 'pill') {
      from = 0;
    } else if (kind === 'logo') {
      const all = await bench.stories();
      const last = all[all.length - 1];
      from = last.top + last.hold + Math.round(bench.height * 1.5);
    } else {
      const s = await bench.story(name);
      if (!s) return { id, ok: true, skipped: true };
      from = s.rests[Math.min(1, s.steps - 1)];
    }
    await bench.jump(from);
    await bench.settle(500);
    const start = await bench.y();
    const selector = { skip: '.lp-bar[data-on="true"] .lp-bar__skip', top: '.lp-bar[data-on="true"] .lp-bar__top', logo: '.mm-nav .logo', pill: '.mm-nav .mm-nav__price' }[kind];
    // The bar rises 200 ms after its story goes live.
    let box = null;
    for (let i = 0; i < 20 && !box; i += 1) {
      box = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!(r.width > 0) || getComputedStyle(el).visibility === 'hidden') return null;
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), href: el.getAttribute('href') };
      }, selector);
      if (!box) await sleep(100);
    }
    if (!box) return { id, ok: false, start, y: start, expected: null, moves: 0, leftAgain: 0, navBottom: 0, focus: `no ${selector} on screen` };
    await page.evaluate(() => {
      window.__jt = [];
      const tick = () => { window.__jt.push(Math.round(scrollY)); window.__jtRaf = requestAnimationFrame(tick); };
      window.__jtRaf = requestAnimationFrame(tick);
    });
    if (touch) {
      await bench.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
      await sleep(60);
      await bench.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.click(box.x, box.y);
    }
    await sleep(2600);
    const out = await page.evaluate(({ kind: k, href, story }) => {
      cancelAnimationFrame(window.__jtRaf);
      const nav = document.querySelector('.mm-nav');
      const navBottom = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0;
      const active = document.activeElement;
      const focus = active ? `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''}${typeof active.className === 'string' && active.className ? `.${active.className.split(' ')[0]}` : ''}` : 'none';
      const root = story ? document.querySelector(`.ss.${story}`) : null;
      const step = root ? Number(root.dataset.step) : null;
      if (k !== 'skip' && k !== 'pill') return { trace: window.__jt, y: Math.round(scrollY), expected: 0, navBottom, focus, step };
      const section = document.getElementById(href.slice(1));
      const head = section.querySelector('.lp-head, h2') || section;
      let top = 0;
      for (let node = head; node; node = node.offsetParent) top += node.offsetTop;
      const track = root?.querySelector('.ss__track');
      const stage = root?.querySelector('.ss__stage');
      const holdEnd = track ? Math.round(track.getBoundingClientRect().top + scrollY + track.offsetHeight - stage.offsetHeight) : null;
      return { trace: window.__jt, y: Math.round(scrollY), expected: Math.round(top - navBottom - 20), headTop: Math.round(head.getBoundingClientRect().top), navBottom, focus, step, holdEnd };
    }, { kind, href: box.href, story: name || null });
    const firstAt = out.trace.findIndex((y) => Math.abs(y - out.y) <= 3);
    const leftAgain = firstAt < 0 ? -1 : out.trace.slice(firstAt).filter((y) => Math.abs(y - out.y) > 3).length;
    const moves = out.trace.filter((y, i) => i > 0 && y !== out.trace[i - 1]).length;
    let ok = Math.abs(out.y - out.expected) <= 3 && leftAgain === 0;
    if (kind === 'skip') ok = ok && out.headTop >= out.navBottom && out.y > out.holdEnd + 2 && /h2/.test(out.focus);
    if (kind === 'pill') ok = ok && out.headTop >= out.navBottom && /h2/.test(out.focus);
    if (kind === 'top') ok = ok && /main#main-content/.test(out.focus);
    return { id, start, y: out.y, expected: out.expected, headTop: out.headTop, navBottom: out.navBottom, moves, leftAgain, step: out.step, focus: out.focus, ok };
  } finally {
    await page.evaluate(() => { const link = document.getElementById('bench-jump'); if (link) link.style.display = ''; });
  }
}

// ---------------------------------------------------------------- the fast-scroll hunt (LK90, 5 Nov 2026)
/** Record scrollY and every story's step on each frame while `gesture` runs and `ms` after it. */
export async function record(bench, ms, gesture) {
  await bench.page.evaluate(() => {
    window.__tr = [];
    const roots = [...document.querySelectorAll('.ss[data-pinned="true"]')];
    const t0 = performance.now();
    const tick = (t) => { window.__tr.push({ t: Math.round(t - t0), y: Math.round(scrollY), s: roots.map((r) => Number(r.dataset.step)) }); window.__trRaf = requestAnimationFrame(tick); };
    window.__trRaf = requestAnimationFrame(tick);
  });
  await gesture();
  await sleep(ms);
  return bench.page.evaluate(() => { cancelAnimationFrame(window.__trRaf); return window.__tr; });
}

/**
 * Read a trace against one story's rule. kind: 'enter-down' | 'enter-up' (a fling from outside must stop on the first or
 * the last rest), 'leave-down' | 'leave-up' (a fling from the edge rest leaves freely), 'step' (one step forward).
 * Faults, each a count of frames: reversals (the page moved against the gesture by more than 3 px to a place outside
 * every hold: a clamp putting the page back inside a hold, this story's or the next one's, is a put and never shows,
 * because the stage is sticky there), outside (once inside the hold, the page was seen outside it again: the stage
 * unpinned and jumped), flashes (once inside the hold, the story showed a step other than the one it ends on), reentry
 * (a leaving fling came back into the hold), skips (a step change of more than one, or more than one change).
 */
export function readTrace(trace, story, idx, kind, start, all = [story], settled = null) {
  const top = story.top;
  const end = story.top + story.hold;
  const inside = (y) => y >= top - 2 && y <= end + 2;
  const held = (y) => all.some((s) => y >= s.top - 2 && y <= s.top + s.hold + 2);
  const dir = kind === 'enter-down' || kind === 'leave-down' || kind === 'step' ? 1 : -1;
  // Where the gesture ended: read after the page has been still for 400 ms (a fling held on a rest can run on past the
  // recorded window), else the last recorded frame.
  const last = trace[trace.length - 1];
  const final = settled || { y: last.y, step: last.s[idx] };
  let reversals = 0;
  let outside = 0;
  let flashes = 0;
  let reentry = 0;
  let puts = 0;
  let wasInside = false;
  let leftAt = -1;
  let changes = 0;
  let maxJump = 0;
  let overshoot = 0;
  for (let i = 1; i < trace.length; i += 1) {
    const a = trace[i - 1];
    const b = trace[i];
    const dy = b.y - a.y;
    if (dy * dir < -3) { if (held(b.y)) puts += 1; else reversals += 1; }
    if (b.s[idx] !== a.s[idx]) { changes += 1; maxJump = Math.max(maxJump, Math.abs(b.s[idx] - a.s[idx])); }
    if (inside(b.y)) wasInside = true;
    if (kind.startsWith('enter') && wasInside && !inside(b.y)) outside += 1;
    if (kind.startsWith('enter') && wasInside && inside(b.y) && b.s[idx] !== final.step) flashes += 1;
    if (kind.startsWith('enter') && wasInside) overshoot = Math.max(overshoot, dir > 0 ? b.y - story.rests[0] : story.rests[story.steps - 1] - b.y);
    if (kind.startsWith('leave')) {
      if (!inside(b.y) && leftAt < 0) leftAt = i;
      if (leftAt >= 0 && inside(b.y)) reentry += 1;
    }
  }
  const rest = (k) => story.rests[k];
  let ok;
  if (kind === 'enter-down') ok = final.step === 0 && Math.abs(final.y - rest(0)) <= 2;
  else if (kind === 'enter-up') ok = final.step === story.steps - 1 && Math.abs(final.y - rest(story.steps - 1)) <= 2;
  else if (kind === 'leave-down') ok = final.y > end + 2;
  else if (kind === 'leave-up') ok = final.y < top - 2;
  else ok = final.step === start + 1 && Math.abs(final.y - rest(start + 1)) <= 2;
  const skips = kind === 'step' ? (changes > 1 ? changes - 1 : 0) + (maxJump > 1 ? 1 : 0) : 0;
  const faults = reversals + outside + flashes + reentry + skips;
  return { ok: ok && faults === 0, landed: ok, final, reversals, outside, flashes, reentry, puts, skips, changes, overshoot, frames: trace.length };
}

const fastLine = (name, row) => `${row.ok ? 'ok  ' : 'FAIL'} ${name} ${row.id} from ${row.start} -> y ${row.final.y} step ${row.final.step}${row.landed ? '' : ' (wrong place)'}; reversals ${row.reversals} outside ${row.outside} flashes ${row.flashes} reentry ${row.reentry} skips ${row.skips} puts ${row.puts} overshoot ${row.overshoot}`;

/** Where a hunt cell starts: above or below the story for an entry, on the edge rest for a leave, on rest 1 for a step. */
function huntStart(s, kind, far) {
  const startStep = kind === 'step' ? 1 : kind === 'leave-down' ? s.steps - 1 : kind === 'leave-up' ? 0 : null;
  const y0 = kind === 'enter-down' ? s.top - far : kind === 'enter-up' ? s.top + s.hold + far : s.rests[startStep];
  return { startStep, y0 };
}

/**
 * The hunt: fast flicks (600-1600 px at 2500-8000 px/s) entering, leaving and stepping one held story, each traced frame
 * by frame (readTrace). Returns rows { id, ok, ...faults }.
 */
export async function runFast(bench, name, { log = () => {}, dists = [600, 1000, 1600], speeds = [2500, 5000, 8000], kinds = ['enter-down', 'enter-up', 'leave-down', 'leave-up', 'step'] } = {}) {
  const rows = [];
  const idx = (await bench.stories()).findIndex((s) => s.name === name);
  if (idx < 0) return rows;
  for (const kind of kinds) for (const d of dists) for (const v of speeds) {
    const id = `${kind}-${d}-${v}`;
    const row = await steady(bench, log, id, async () => {
      let s = await bench.story(name);
      const { startStep, y0 } = huntStart(s, kind, Math.round(d * 0.6));
      await bench.jump(y0);
      for (let tries = 0; tries < 3 && Math.abs((await bench.y()) - y0) > 2; tries += 1) await bench.jump(y0);
      await bench.settle(400);
      s = await bench.story(name);
      const down = kind === 'enter-down' || kind === 'leave-down' || kind === 'step';
      const trace = await record(bench, 1600, () => bench.flick(down ? d : -d, v, down ? {} : { fromY: 120 }));
      const end = { y: await bench.settle(400), step: await bench.step(name) };
      const all = await bench.stories();
      return { id, start: y0, ...readTrace(trace, all[idx], idx, kind, startStep ?? 0, all, end), rests: all[idx].rests, trace: trace.map((f) => [f.t, f.y, f.s[idx]]) };
    });
    rows.push(row);
    log(fastLine(name, row));
  }
  return rows;
}

/** Wheel bursts at 1440: notches entering, leaving and inside one held story, traced like the flicks. */
export async function runWheelFast(bench, name, { log = () => {}, bursts = [[10, 10], [20, 8], [40, 4]], kinds = ['enter-down', 'enter-up', 'leave-down', 'leave-up', 'step'] } = {}) {
  const rows = [];
  const idx = (await bench.stories()).findIndex((s) => s.name === name);
  if (idx < 0) return rows;
  for (const kind of kinds) for (const [notches, gapMs] of bursts) {
    const id = `wheel-${kind}-${notches}x${gapMs}ms`;
    const row = await steady(bench, log, id, async () => {
      let s = await bench.story(name);
      const { startStep, y0 } = huntStart(s, kind, 600);
      await bench.jump(y0);
      for (let tries = 0; tries < 3 && Math.abs((await bench.y()) - y0) > 2; tries += 1) await bench.jump(y0);
      await bench.settle(400);
      await bench.page.mouse.move(Math.round(bench.width / 2), Math.round(bench.height / 2));
      s = await bench.story(name);
      const down = kind === 'enter-down' || kind === 'leave-down' || kind === 'step';
      const trace = await record(bench, 1400, () => bench.wheel(notches, { deltaY: down ? 100 : -100, gapMs }));
      const end = { y: await bench.settle(400), step: await bench.step(name) };
      const all = await bench.stories();
      return { id, start: y0, ...readTrace(trace, all[idx], idx, kind, startStep ?? 0, all, end), rests: all[idx].rests, trace: trace.map((f) => [f.t, f.y, f.s[idx]]) };
    });
    rows.push(row);
    log(fastLine(name, row));
  }
  return rows;
}

// ---------------------------------------------------------------- frames under load (the LK69 lag acceptance)
/**
 * 22 swipes (450 px at 900 px/s, lifted while moving, 600 ms apart) from the top of the page at 4x CPU: the frame gaps
 * (requestAnimationFrame deltas) and the long frames the browser reports. Accept: p95 <= 20 ms and no frame over 100 ms.
 */
export async function runPerf(bench, { swipes = 22, rate = 4, gapMs = 600, dist = 450, speed = 900, warm = false } = {}) {
  const reloads0 = bench.reloads;
  if (warm) {
    // Draw every section once (content-visibility, images, fonts) so what is measured is the gesture, not first paint.
    const total = await bench.documentHeight();
    for (let y = 0; y < total + 1000; y += Math.round(bench.height * 0.6)) { await bench.page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y); await sleep(220); }
  }
  await bench.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(warm ? 1800 : 800);
  await bench.page.evaluate(() => {
    window.__fr = []; window.__loaf = [];
    let last = 0;
    const tick = (t) => { if (last) window.__fr.push(t - last); last = t; window.__raf = requestAnimationFrame(tick); };
    window.__raf = requestAnimationFrame(tick);
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__loaf.push(Math.round(e.duration));
          if (e.duration > 100) (window.__loafWhy ||= []).push({ d: Math.round(e.duration), y: Math.round(scrollY), block: Math.round(e.blockingDuration), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), scripts: e.scripts.map((sc) => `${sc.invoker || sc.type}|${(sc.sourceURL || '').split('/').slice(-1)[0].slice(0, 40)}|${sc.sourceFunctionName || ''}|${Math.round(sc.duration)}|forced ${Math.round(sc.forcedStyleAndLayoutDuration || 0)}`).slice(0, 4) });
        }
      }).observe({ type: 'long-animation-frame', buffered: false });
    } catch { /* none */ }
  });
  await bench.cdp.send('Emulation.setCPUThrottlingRate', { rate });
  for (let i = 0; i < swipes; i += 1) { await bench.flick(dist, speed); await sleep(gapMs); }
  await sleep(900);
  await bench.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const { frames, loaf, y, why } = await bench.page.evaluate(() => { cancelAnimationFrame(window.__raf); return { frames: window.__fr, loaf: window.__loaf, y: Math.round(scrollY), why: window.__loafWhy || [] }; });
  const sorted = [...frames].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const out = { swipes, rate, frames: frames.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +Math.max(0, ...frames).toFixed(1), over33: frames.filter((f) => f > 33.4).length, over50: frames.filter((f) => f > 50).length, over100: frames.filter((f) => f > 100).length, loafOver100: loaf.filter((d) => d > 100).length, loafMax: Math.max(0, ...loaf), endY: y, reloaded: bench.reloads - reloads0, why: why.slice(0, 12) };
  out.ok = out.p95 <= 20 && out.over100 === 0 && out.reloaded === 0;
  return out;
}

// ---------------------------------------------------------------- by hand
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [url = 'http://localhost:3467/', mode = 'matrix', width = '390'] = process.argv.slice(2);
  const touch = Number(width) < 900;
  const bench = await openBench({ url, width: Number(width), height: touch ? 844 : 900, touch, label: `one-gesture ${mode}` });
  try {
    const tally = (name, rows) => console.log(`${name}: ${rows.filter((r) => r.ok).length}/${rows.length} ok`);
    const names = () => (process.argv[5] || 'ft-story,lc').split(',');
    if (mode === 'matrix') for (const name of names()) tally(name, await runMatrix(bench, name, { log: console.log }));
    if (mode === 'flow') for (const name of names()) tally(name, await runFlow(bench, name, { log: console.log }));
    if (mode === 'landing') tally('landing', await runLanding(bench, { log: console.log }));
    if (mode === 'journey') console.log(JSON.stringify(await runJourney(bench, { log: console.log })));
    if (mode === 'wheel') for (const name of names()) tally(name, await runWheel(bench, name, { log: console.log }));
    if (mode === 'jump') tally('jump', await runJump(bench, { log: console.log }));
    if (mode === 'fast') for (const name of names()) tally(name, await (touch ? runFast : runWheelFast)(bench, name, { log: console.log }));
    if (mode === 'perf') console.log(JSON.stringify(await runPerf(bench, { warm: process.argv[6] === 'warm' })));
    console.log('errors', bench.errors.slice(0, 8));
  } finally { await bench.close(); }
}
