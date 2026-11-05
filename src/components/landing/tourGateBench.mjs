// The tour gate (R3-D5, LK105, 5 Nov 2026): real Chrome against the home page's held feature tour ("What's inside
// MockMob"), proving the step change is clean. Two recorders run in the page while one-step gestures walk the tour:
//
//   1. A MutationObserver (attributeOldValue) on the tour sees every data-active and data-ts-step change in commit order.
//      On every activation a screen's data-ts-step must read 0 and never go down until the screen leaves (the old bug:
//      0, then the FINISHED step, then 0 again as the demo restarted mid-fade). A leaving screen must not change at all
//      while it is still visible (the old bug: it popped to its finished state during its fade-out).
//   2. A per-frame opacity recorder (requestAnimationFrame, getComputedStyle, stamped with the frame's time) on every
//      slide. Two slides may both show for under 30 ms, and while they do the fainter of the two stays below 0.25 (the
//      old symmetric crossfade held two slides at about 50/50 for about 115 ms on every step, text through text).
//
// It also notes, per step, when the chip row starts to move and whether a rail icon was on screen before it had loaded.
//
//   node src/components/landing/tourGateBench.mjs [url=http://localhost:3584/] [out.json] [label]
//
// Runs 390x844 touch and 1440x900 wheel, each at 1x and 4x CPU, under the shared browser lock (oneGestureBench.mjs).
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openBench, withLock } from './oneGestureBench.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const GATE = { overlapMs: 30, overlapOpacity: 0.25, visible: 0.05 };

// ---------------------------------------------------------------- the analysis (pure; unit-tested in tourGate.test.mjs)
/**
 * log: [{ t, i, attr: 'data-active' | 'data-ts-step' | 'data-step', old, val }] in commit order (i is the slide index;
 * data-step is the story root's, i = -1). frames: [{ t, ops: [opacity per slide], sl, unloaded }].
 * Returns one row per step change and the gate's verdict.
 */
export function analyzeTourRun(log, frames, { slides = 10 } = {}) {
  const ts = Array.from({ length: slides }, () => null);
  const runs = [];
  const open = new Map(); // slide -> its current activation run
  for (const event of log) {
    if (event.attr === 'data-ts-step') {
      ts[event.i] = Number(event.val);
      open.get(event.i)?.values.push(Number(event.val));
    } else if (event.attr === 'data-active') {
      if (event.val === 'true') {
        open.set(event.i, { i: event.i, t: event.t, values: [ts[event.i]] });
      } else {
        const run = open.get(event.i);
        if (run) { run.end = event.t; runs.push(run); open.delete(event.i); }
      }
    }
  }
  for (const run of open.values()) runs.push(run);
  runs.sort((a, b) => a.t - b.t);

  // A leaving slide's changes count only while it is still on screen (its opacity above the visible floor).
  const opacityAt = (i, t) => {
    let best = null;
    for (const frame of frames) { if (frame.t >= t) { best = frame; break; } }
    return best ? best.ops[i] : 0;
  };
  const leaves = [...log.filter((e) => e.attr === 'data-active' && e.val === 'false')].map((e) => {
    const changes = log.filter((x) => x.attr === 'data-ts-step' && x.i === e.i && x.t >= e.t && !log.some((y) => y.attr === 'data-active' && y.i === e.i && y.val === 'true' && y.t >= e.t && y.t <= x.t));
    const seen = changes.filter((x) => opacityAt(e.i, x.t) > GATE.visible || x.t - e.t < 4);
    return { i: e.i, t: e.t, visibleChanges: seen.map((x) => `${x.old}>${x.val}@+${Math.round(x.t - e.t)}`) };
  });

  const steps = runs.map((run) => {
    const values = run.values.filter((v) => v !== null);
    const startsAtZero = values[0] === 0;
    let monotonic = true;
    for (let k = 1; k < values.length; k += 1) if (values[k] < values[k - 1]) monotonic = false;
    // The slide that left in the same commit as this one came on.
    const out = log.find((e) => e.attr === 'data-active' && e.val === 'false' && Math.abs(e.t - run.t) < 1);
    const from = out ? out.i : null;
    const stepEvent = [...log].reverse().find((e) => e.attr === 'data-step' && e.t <= run.t + 0.5);
    const from0 = Math.min(run.t, stepEvent ? stepEvent.t : run.t) - 5;
    const window = frames.filter((f) => f.t >= from0 && f.t <= run.t + 700);
    let first = null; let last = null; let maxMin = 0; let twoAbove01 = 0;
    for (const frame of window) {
      const inc = frame.ops[run.i] ?? 0;
      const outOp = from === null ? 0 : frame.ops[from] ?? 0;
      if (inc > GATE.visible && outOp > GATE.visible) { first ??= frame.t; last = frame.t; maxMin = Math.max(maxMin, Math.min(inc, outOp)); }
      if (frame.ops.filter((o) => o > 0.1).length >= 2) twoAbove01 += 1;
    }
    const sl0 = window.length ? window[0].sl : 0;
    const chipMove = window.find((f) => Math.abs(f.sl - sl0) > 1);
    const unloadedFrames = window.filter((f) => f.unloaded > 0).length;
    const leave = from === null ? null : leaves.find((l) => l.i === from && Math.abs(l.t - run.t) < 1);
    return {
      from, to: run.i, at: Math.round(run.t), values: values.join('>'), startsAtZero, monotonic,
      commitAfterStepMs: stepEvent ? Math.round(run.t - stepEvent.t) : null,
      overlapMs: first === null ? 0 : Math.round(last - first), overlapMaxMin: Number(maxMin.toFixed(3)), framesTwoAbove01: twoAbove01,
      chipMoveMs: chipMove ? Math.round(chipMove.t - (stepEvent ? stepEvent.t : run.t)) : null, unloadedIconFrames: unloadedFrames,
      leavingChanges: leave ? leave.visibleChanges : [],
    };
  });
  const fails = [];
  for (const s of steps) {
    if (!s.startsAtZero || !s.monotonic) fails.push(`activation ${s.from}->${s.to} data-ts-step ${s.values}`);
    if (s.leavingChanges.length) fails.push(`leaving ${s.from} changed while visible: ${s.leavingChanges.join(' ')}`);
    if (s.from !== null && (s.overlapMs >= GATE.overlapMs || s.overlapMaxMin >= GATE.overlapOpacity)) fails.push(`overlap ${s.from}->${s.to} ${s.overlapMs} ms at ${s.overlapMaxMin}`);
  }
  return { steps, fails, ok: fails.length === 0 && steps.length > 0 };
}

// ---------------------------------------------------------------- the recorders (run in the page)
function installRecorders() {
  const root = document.querySelector('.ft-story');
  if (!root) throw new Error('no tour on the page');
  const slides = [...root.querySelectorAll('.ft__slide')];
  const nav = root.querySelector('.ft__list');
  const gate = { log: [], frames: [], on: true };
  const indexOf = (node) => (node === root ? -1 : Number(node.closest('.ft__slide')?.dataset.index));
  const observer = new MutationObserver((records) => {
    const t = performance.now();
    records.forEach((record, k) => {
      if (record.attributeName === 'data-step' && record.target !== root) return;
      let val;
      for (let j = k + 1; j < records.length; j += 1) {
        if (records[j].target === record.target && records[j].attributeName === record.attributeName) { val = records[j].oldValue; break; }
      }
      if (val === undefined) val = record.target.getAttribute(record.attributeName);
      if (val === record.oldValue) return;
      gate.log.push({ t, i: indexOf(record.target), attr: record.attributeName, old: record.oldValue, val });
    });
  });
  observer.observe(root, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-active', 'data-ts-step', 'data-step'] });
  // Each sample is stamped with its frame's time (the rAF timestamp): that is the time the browser computed the frame's
  // animated opacity at. performance.now() inside a long frame at 4x CPU runs up to a frame later, which smears a short
  // overlap across two samples.
  const frame = (t) => {
    if (!gate.on) return;
    const ops = slides.map((slide) => Number(getComputedStyle(slide).opacity));
    let unloaded = 0;
    if (nav) {
      const box = nav.getBoundingClientRect();
      for (const img of nav.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        if (r.right > box.left + 1 && r.left < box.right - 1 && r.bottom > 0 && r.top < innerHeight && !(img.complete && img.naturalWidth > 0)) unloaded += 1;
      }
    }
    gate.frames.push({ t, now: Math.round(performance.now() * 10) / 10, ops: ops.map((o) => Math.round(o * 1000) / 1000), sl: nav ? Math.round(nav.scrollLeft) : 0, unloaded });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  gate.stop = () => { gate.on = false; observer.disconnect(); };
  window.__tourGate = gate;
  return slides.length;
}

// ---------------------------------------------------------------- one run
/** Open the page (opening skipped), walk the tour one gesture at a time and return the recorders' data and the verdict. */
export async function runTourGate({ url, width, height, touch, cpu, theme = 'dark', log = () => {} }) {
  const bench = await openBench({ url: 'about:blank', width, height, touch, cpu: 1, theme, lock: false, label: 'tour gate' });
  try {
    await bench.page.context().addInitScript(() => {
      try { localStorage.setItem('mm:opened:v1', '1'); sessionStorage.setItem('mm:opening:v1', '1'); } catch { /* none */ }
    });
    await bench.page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await sleep(2500);
    if (cpu > 1) await bench.cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    let story = await bench.story('ft-story');
    if (!story) throw new Error('the tour is not held on this page');
    await bench.jump(story.rests[0]);
    story = await bench.story('ft-story');
    if (story.step !== 0) await bench.jump(story.rests[0]);
    await bench.page.mouse.move(Math.round(width / 2), Math.round(height / 2));
    await sleep(1800);
    const slides = await bench.page.evaluate(installRecorders);
    const forward = touch ? () => bench.flick(300, 1200) : () => bench.wheel(1);
    const back = touch ? () => bench.flick(-300, 1200, { fromY: 120 }) : () => bench.wheel(1, { deltaY: -100 });
    const moves = [];
    const go = async (gesture, wait, dir) => {
      const before = await bench.step('ft-story');
      await gesture();
      await sleep(wait);
      const after = await bench.step('ft-story');
      moves.push({ before, after, dir, ok: after - before === dir });
    };
    // Every tool forward at a reading pace, two back, then quick swipes (just past the 420 ms lock) both ways
    // across Ask Mobi, whose 1.4 s demo is still building when the reader moves on (the leaving screen must not pop).
    for (let k = 1; k < slides; k += 1) await go(forward, 1700, 1);
    for (let k = 0; k < 2; k += 1) await go(back, 1700, -1);
    // A touch flick itself takes 250 ms and the 420 ms lock runs from its release, so a phone waits 450 ms after it.
    const quick = touch ? 450 : 520;
    for (let k = 0; k < 3; k += 1) await go(back, quick, -1);
    await sleep(1200);
    for (let k = 0; k < 3; k += 1) await go(forward, quick, 1);
    await sleep(1500);
    const data = await bench.page.evaluate(() => { window.__tourGate.stop(); return { log: window.__tourGate.log, frames: window.__tourGate.frames }; });
    const verdict = analyzeTourRun(data.log, data.frames, { slides });
    const frameGaps = data.frames.slice(1).map((f, k) => f.t - data.frames[k].t).sort((a, b) => a - b);
    const result = {
      width, height, touch, cpu, slides, moves, movesOk: moves.every((m) => m.ok), errors: bench.errors.slice(0, 8),
      frameGapP50: Math.round(frameGaps[Math.floor(frameGaps.length / 2)] || 0), ...verdict,
    };
    log(`${width} ${touch ? 'touch' : 'wheel'} ${cpu}x: ${verdict.ok ? 'PASS' : 'FAIL'} (${verdict.steps.length} activations, ${verdict.fails.length} faults; moves ${result.movesOk ? 'one step each' : 'NOT one step each'})`);
    for (const fail of verdict.fails) log(`  ${fail}`);
    return { ...result, raw: data };
  } finally { await bench.close(); }
}

/** The whole gate: 390 touch and 1440 wheel, 1x and 4x CPU, one lock burst. */
export async function runTourGateAll(url, { log = console.log, theme = 'dark' } = {}) {
  return withLock('tour gate', async () => {
    const out = [];
    for (const cfg of [
      { width: 390, height: 844, touch: true, cpu: 1 },
      { width: 390, height: 844, touch: true, cpu: 4 },
      { width: 1440, height: 900, touch: false, cpu: 1 },
      { width: 1440, height: 900, touch: false, cpu: 4 },
    ]) out.push(await runTourGate({ url, theme, log, ...cfg }));
    return out;
  });
}

// ---------------------------------------------------------------- by hand
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [url = 'http://localhost:3584/', file = '', label = ''] = process.argv.slice(2);
  const runs = await runTourGateAll(url);
  const summary = runs.map(({ raw, ...rest }) => { void raw; return rest; });
  if (file) writeFileSync(file, JSON.stringify({ label, url, at: new Date().toISOString(), runs: summary, raw: runs.map((r) => r.raw) }, null, 1));
  for (const run of summary) {
    console.log(`\n== ${label} ${run.width} ${run.touch ? 'touch' : 'wheel'} ${run.cpu}x: ${run.ok ? 'PASS' : 'FAIL'}; frame gap p50 ${run.frameGapP50} ms`);
    for (const s of run.steps) console.log(`  ${s.from}->${s.to} ts ${s.values} | overlap ${s.overlapMs} ms at ${s.overlapMaxMin} (2 slides >0.1: ${s.framesTwoAbove01} fr) | commit +${s.commitAfterStepMs} ms | chips +${s.chipMoveMs} ms | unloaded icon frames ${s.unloadedIconFrames}${s.leavingChanges.length ? ` | LEAVING ${s.leavingChanges.join(' ')}` : ''}`);
  }
  process.exitCode = runs.every((r) => r.ok && r.movesOk) ? 0 : 1;
}
