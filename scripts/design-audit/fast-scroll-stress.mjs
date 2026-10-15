// Fast-scroll stress for the landing: touch flings (390x844, touch) and hard wheel and trackpad-like
// inertia (1440x900), recorded frame by frame. It answers: does the page height drift while scrolling
// (content-visibility estimates), does a held story fight momentum (scrollY reversing against the input),
// does one gesture still move a held story exactly one step, are reveals settled once a fling stops,
// and how many long tasks and long frames the scroll costs.
//
//   node scripts/design-audit/fast-scroll-stress.mjs [--url http://localhost:3000] [--out artifacts/fast-scroll]
//
// It starts no server: point it at one that is already running. PLAYWRIGHT_CORE and CHROME override the
// playwright-core module and the Chrome binary used by the other design-audit scripts.
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const URL_ = arg('url', 'http://localhost:3000');
const OUT = arg('out', 'artifacts/fast-scroll');
const CORE = process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { chromium } = await import(pathToFileURL(CORE).href);

// Runs in the page before any script: a frame recorder plus long task and layout shift observers.
function instrument() {
  const rec = { frames: [], longTasks: [], shifts: 0, overflowToggles: 0, recording: false };
  window.__fss = rec;
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) rec.longTasks.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true });
  } catch { /* not supported */ }
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) rec.shifts += e.value; }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* not supported */ }
  // The init script can run before the root element exists, so the observer retries and never blocks the frame recorder.
  const watchRoot = () => { try { new MutationObserver(() => { rec.overflowToggles += 1; }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] }); } catch { document.addEventListener('DOMContentLoaded', watchRoot, { once: true }); } };
  watchRoot();
  const tick = (t) => {
    if (rec.recording) {
      const steps = [...document.querySelectorAll('.ss')].map((n) => n.dataset.step).join(',');
      rec.frames.push({ t: Math.round(t), y: Math.round(scrollY), h: document.documentElement.scrollHeight, steps, hushed: document.documentElement.style.overflow === 'hidden' });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function summarise(frames, longTasks, from) {
  const heights = frames.map((f) => f.h);
  let reversals = 0;
  let longFrames = 0;
  let worstFrame = 0;
  for (let i = 2; i < frames.length; i += 1) {
    const a = frames[i - 1].y - frames[i - 2].y;
    const b = frames[i].y - frames[i - 1].y;
    if (Math.abs(a) > 2 && Math.abs(b) > 2 && Math.sign(a) !== Math.sign(b)) reversals += 1;
    const gap = frames[i].t - frames[i - 1].t;
    worstFrame = Math.max(worstFrame, gap);
    if (gap > 50) longFrames += 1;
  }
  const tasks = longTasks.filter((task) => task.at >= from);
  return {
    frames: frames.length,
    heightDriftPx: heights.length ? Math.max(...heights) - Math.min(...heights) : 0,
    reversals, // the signature of a story fighting momentum: the page jerks back and forth frame to frame
    longFrames,
    worstFrameMs: worstFrame,
    longTasks: tasks.length,
    worstLongTaskMs: tasks.reduce((m, task) => Math.max(m, task.ms), 0),
    hushedFrames: frames.filter((f) => f.hushed).length,
    stepChanges: frames.reduce((n, f, i) => n + (i && f.steps !== frames[i - 1].steps ? 1 : 0), 0),
  };
}

async function record(page, run) {
  await page.evaluate(() => { window.__fss.frames = []; window.__fss.recording = true; });
  const from = await page.evaluate(() => performance.now());
  await run();
  await page.waitForTimeout(900);
  const data = await page.evaluate(() => { window.__fss.recording = false; return { frames: window.__fss.frames, longTasks: window.__fss.longTasks }; });
  // Reveals that are in but still not fully shown 900 ms after the scroll stopped: arrivals that were still fading.
  const unsettled = await page.evaluate(() => [...document.querySelectorAll('.rv[data-in="true"]')].filter((n) => {
    const r = n.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && Number(getComputedStyle(n).opacity) < 0.99;
  }).length);
  return { ...summarise(data.frames, data.longTasks, from), unsettledReveals: unsettled };
}

// One gesture, one step: park the page on each story's first resting place, send one burst, read the step.
async function oneGestureOneStep(page, cdp, kind) {
  const stories = await page.evaluate(() => [...document.querySelectorAll('.ss[data-pinned="true"] .ss__track')].map((t) => Math.round(t.getBoundingClientRect().top + scrollY)));
  const results = [];
  for (const top of stories) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), top);
    await page.waitForTimeout(700);
    const before = await page.evaluate((y) => [...document.querySelectorAll('.ss')].find((n) => Math.abs(n.querySelector('.ss__track').getBoundingClientRect().top + scrollY - y) < 2)?.dataset.step, top);
    if (kind === 'wheel') {
      for (let i = 0; i < 14; i += 1) { await page.mouse.wheel(0, 120); await page.waitForTimeout(12); }
    } else {
      // Real touch events: a synthesized scroll gesture does not reach the story's touch handlers in headless Chrome.
      const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
      await touch('touchStart', 650);
      for (let y = 650; y >= 450; y -= 20) { await touch('touchMove', y); await page.waitForTimeout(16); }
      await touch('touchEnd');
    }
    await page.waitForTimeout(1100);
    const after = await page.evaluate((y) => [...document.querySelectorAll('.ss')].find((n) => Math.abs(n.querySelector('.ss__track').getBoundingClientRect().top + scrollY - y) < 2)?.dataset.step, top);
    results.push({ top, before: Number(before), after: Number(after), oneStep: Number(after) - Number(before) === 1 });
  }
  return results;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const report = { url: URL_, at: new Date().toISOString() };

  // Phone: touch flings down the whole page and back up.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(instrument);
    const page = await ctx.newPage();
    await page.goto(URL_, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const cdp = await ctx.newCDPSession(page);
    const fling = (dy) => cdp.send('Input.synthesizeScrollGesture', { x: 195, y: dy < 0 ? 700 : 150, yDistance: dy, speed: 9000, gestureSourceType: 'touch', preventFling: false });
    report.phoneDown = await record(page, async () => {
      for (let i = 0; i < 30; i += 1) {
        await fling(-650);
        if (i === 4 || i === 12) await page.screenshot({ path: `${OUT}/phone-fling-${i}.png` });
      }
    });
    await page.screenshot({ path: `${OUT}/phone-after-flings.png` });
    report.phoneUp = await record(page, async () => { for (let i = 0; i < 30; i += 1) await fling(650); });
    report.phoneOneStep = await oneGestureOneStep(page, cdp, 'touch');
    report.phoneShifts = await page.evaluate(() => ({ cls: window.__fss.shifts, rootStyleWrites: window.__fss.overflowToggles }));
    await ctx.close();
  }

  // Desktop: a hard mouse wheel, then a trackpad-like inertia tail, both down and up.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(instrument);
    const page = await ctx.newPage();
    await page.goto(URL_, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.mouse.move(720, 450);
    const cdp = await ctx.newCDPSession(page);
    report.desktopWheel = await record(page, async () => {
      for (let i = 0; i < 160; i += 1) { await page.mouse.wheel(0, 400); await page.waitForTimeout(16); }
    });
    await page.screenshot({ path: `${OUT}/desktop-after-wheel.png` });
    report.desktopInertiaUp = await record(page, async () => {
      for (let swipe = 0; swipe < 12; swipe += 1) {
        for (let d = 160; d > 2; d *= 0.93) { await page.mouse.wheel(0, -d); await page.waitForTimeout(16); }
      }
    });
    report.desktopOneStep = await oneGestureOneStep(page, cdp, 'wheel');
    report.desktopShifts = await page.evaluate(() => ({ cls: window.__fss.shifts, rootStyleWrites: window.__fss.overflowToggles }));
    await ctx.close();
  }

  await browser.close();
  await fs.writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

await main();
