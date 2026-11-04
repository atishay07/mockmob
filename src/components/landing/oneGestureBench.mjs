// The one-gesture bench: real Chrome, real touch and wheel input (CDP Input.dispatch*), against the home page's held
// stories. Used by oneGesture.test.mjs (skipped when no Chrome or no server is reachable) and by hand:
//   node src/components/landing/oneGestureBench.mjs [url=http://localhost:3467/] [mode=matrix|perf] [width=390]
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

export async function openBench({ url, width = 390, height = 844, theme = 'dark', touch = true, cpu = 1, label = 'one-gesture bench', lock = true } = {}) {
  const tag = `${label} pid ${process.pid} ${new Date().toISOString()}`;
  if (lock) await takeLock(tag);
  const { chromium } = require(PLAYWRIGHT);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-extensions', '--js-flags=--max-old-space-size=512'] });
    const ctx = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch, colorScheme: theme,
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
    const bench = new Bench({ page, cdp, width, height, errors, closeFn: async () => { try { await browser.close(); } finally { if (lock) dropLock(tag); } } });
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
    for (let i = 0; i < notches; i += 1) {
      await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
      if (gapMs) await sleep(gapMs);
    }
  }

  /** A trackpad swipe: `count` wheel events whose deltas decay over `ms`. */
  async trackpad(count = 60, ms = 900, peak = 90) {
    const x = Math.round(this.width / 2);
    const y = Math.round(this.height / 2);
    for (let i = 0; i < count; i += 1) {
      await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: Math.max(1, Math.round(peak * (1 - i / count) ** 2)) });
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

// ---------------------------------------------------------------- the matrix (the LK69 acceptance)
const distances = [60, 150, 300, 600];
const speeds = [400, 1200, 3000, 6000];

export function expectedRest(story, step) { return story.rests[step]; }

/**
 * Run the LK69 matrix on one story: 16 flick cells, slow drags, a nudge, reversals, two quick flicks, entry, exit.
 * Returns rows { id, ok, ... }. `ok` is true when the gesture's rule held.
 */
export async function runMatrix(bench, name, { log = () => {} } = {}) {
  const rows = [];
  const refresh = async () => bench.story(name);
  const at = async (k) => { let s = await refresh(); await bench.jump(s.rests[k]); s = await refresh(); if (Math.abs((await bench.y()) - s.rests[k]) > 2) await bench.jump(s.rests[k]); return refresh(); };
  const check = async (id, startStep, gesture, rule) => {
    const before = await at(startStep);
    await gesture(before);
    const y = await bench.settle();
    const after = await refresh();
    const step = await bench.step(name);
    const nearest = after.rests.reduce((best, r, i) => (Math.abs(r - y) < Math.abs(after.rests[best] - y) ? i : best), 0);
    const off = y - after.rests[nearest];
    const row = { id, start: startStep, step, delta: step - startStep, y, off, nearest, inHold: y >= after.top - 2 && y <= after.top + after.hold + 2 };
    row.ok = rule(row, after);
    rows.push(row);
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${name} ${id} step ${startStep}->${step} y ${y} off ${off}`);
    return row;
  };
  const one = (r) => r.delta === 1 && Math.abs(r.off) <= 2;
  for (const d of distances) for (const v of speeds) await check(`flick-${d}-${v}`, 1, () => bench.flick(d, v), one);
  for (const d of [120, 150, 300]) await check(`slow-drag-${d}`, 1, () => bench.drag(d), one);
  await check('nudge-20', 1, () => bench.drag(20), (r) => r.delta === 0 && Math.abs(r.off) <= 2);
  await check('reverse-100-back-100', 1, () => bench.dragReverse(100, 100), (r) => r.delta === 0 && Math.abs(r.off) <= 2);
  await check('reverse-300-back-200', 1, () => bench.dragReverse(300, 200), (r) => r.delta === 1 && Math.abs(r.off) <= 2);
  await check('back-one', 2, () => bench.flick(-300, 1200, { fromY: 120 }), (r) => r.delta === -1 && Math.abs(r.off) <= 2);
  await check('two-flicks-150ms', 1, async () => { await bench.flick(300, 3000); await sleep(150); await bench.flick(300, 3000); }, one);
  await check('two-flicks-700ms', 1, async () => { await bench.flick(300, 3000); await sleep(700); await bench.flick(300, 3000); }, (r) => r.delta === 2 && Math.abs(r.off) <= 2);
  // The edges: a fling arriving from outside stops on step 0 / the last step; a fling leaving is free; a finger that
  // is still down when it arrives is never clamped.
  const edge = async (id, from, gesture, rule) => {
    let s = await refresh();
    const y0 = from(s);
    await bench.jump(y0);
    s = await refresh();
    await gesture(s);
    const y = await bench.settle();
    s = await refresh();
    const step = await bench.step(name);
    const row = { id, start: Math.round(y0), step, delta: 0, y, off: 0, nearest: 0, inHold: y >= s.top - 2 && y <= s.top + s.hold + 2 };
    row.ok = rule(row, s);
    rows.push(row);
    log(`${row.ok ? 'ok  ' : 'FAIL'} ${name} ${id} from ${row.start} step ${step} y ${y} (top ${s.top}, end ${s.top + s.hold})`);
  };
  const innerH = bench.height;
  await edge('enter-flick-600-6000-from-500-above', (s) => s.top - 500, () => bench.flick(600, 6000), (r, s) => r.step === 0 && Math.abs(r.y - s.rests[0]) <= 2);
  await edge('enter-flick-300-1200-from-500-above', (s) => s.top - 500, () => bench.flick(300, 1200), (r, s) => r.step === 0 && Math.abs(r.y - s.rests[0]) <= 2);
  await edge('enter-flick-600-6000-from-below', (s) => s.top + s.hold + 500, () => bench.flick(-600, 6000, { fromY: 120 }), (r, s) => r.step === s.steps - 1 && Math.abs(r.y - s.rests[s.steps - 1]) <= 2);
  await edge('exit-flick-300-3000-down', (s) => s.rests[s.steps - 1], () => bench.flick(300, 3000), (r, s) => r.y > s.top + s.hold + 2);
  await edge('exit-flick-300-3000-up', (s) => s.rests[0], () => bench.flick(-300, 3000, { fromY: 120 }), (r, s) => r.y < s.top - 2);
  await edge('slow-drag-300-arriving-is-free', (s) => s.top - 500, () => bench.drag(300), (r, s) => r.y > s.top - 500 + 200 && r.y < s.top);
  void innerH;
  return rows;
}

// ---------------------------------------------------------------- frames under load (the LK69 lag acceptance)
/**
 * 22 swipes (450 px at 900 px/s, lifted while moving, 600 ms apart) from the top of the page at 4x CPU: the frame gaps
 * (requestAnimationFrame deltas) and the long frames the browser reports. Accept: p95 <= 20 ms and no frame over 100 ms.
 */
export async function runPerf(bench, { swipes = 22, rate = 4, gapMs = 600, dist = 450, speed = 900 } = {}) {
  await bench.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(800);
  await bench.page.evaluate(() => {
    window.__fr = []; window.__loaf = [];
    let last = 0;
    const tick = (t) => { if (last) window.__fr.push(t - last); last = t; window.__raf = requestAnimationFrame(tick); };
    window.__raf = requestAnimationFrame(tick);
    try { new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__loaf.push(Math.round(e.duration)); }).observe({ type: 'long-animation-frame', buffered: false }); } catch { /* none */ }
  });
  await bench.cdp.send('Emulation.setCPUThrottlingRate', { rate });
  for (let i = 0; i < swipes; i += 1) { await bench.flick(dist, speed); await sleep(gapMs); }
  await sleep(900);
  await bench.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const { frames, loaf, y } = await bench.page.evaluate(() => { cancelAnimationFrame(window.__raf); return { frames: window.__fr, loaf: window.__loaf, y: Math.round(scrollY) }; });
  const sorted = [...frames].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const out = { swipes, rate, frames: frames.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +Math.max(0, ...frames).toFixed(1), over33: frames.filter((f) => f > 33.4).length, over50: frames.filter((f) => f > 50).length, over100: frames.filter((f) => f > 100).length, loafOver100: loaf.filter((d) => d > 100).length, loafMax: Math.max(0, ...loaf), endY: y };
  out.ok = out.p95 <= 20 && out.over100 === 0;
  return out;
}

// ---------------------------------------------------------------- by hand
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [url = 'http://localhost:3467/', mode = 'matrix', width = '390'] = process.argv.slice(2);
  const touch = Number(width) < 900;
  const bench = await openBench({ url, width: Number(width), height: touch ? 844 : 900, touch, label: `one-gesture ${mode}` });
  try {
    if (mode === 'matrix') {
      for (const name of (process.argv[5] || 'ft-story,lc').split(',')) {
        const rows = await runMatrix(bench, name, { log: console.log });
        console.log(`${name}: ${rows.filter((r) => r.ok).length}/${rows.length} ok`);
      }
    }
    console.log('errors', bench.errors.slice(0, 8));
  } finally { await bench.close(); }
}
