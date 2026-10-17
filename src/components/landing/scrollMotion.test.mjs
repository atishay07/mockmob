// Guards for fast scrolling on the landing: the motion that runs while the page scrolls (Reveal entrances and
// the held stories' CSS) animates only transform and opacity, so a fling never repaints or relayouts a section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayWheel, touchStart, touchMove, touchEnd, QUIET_MS, RESTEP_MS } from './storyGesture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, '..', '..', 'app');
const css = fs.readdirSync(app).filter((name) => name.endsWith('.css')).map((name) => ({ name, text: fs.readFileSync(path.join(app, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

// Every `selector { declarations }` block whose selector matches, from every app stylesheet.
function blocks(match) {
  const found = [];
  for (const { name, text } of css) {
    for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (match(selector)) found.push({ name, selector: selector.trim(), body });
    }
  }
  return found;
}

const PAINT_OR_LAYOUT = /\b(filter|height|width|top|left|right|bottom|margin[a-z-]*|padding[a-z-]*|box-shadow|all)\b/;

test('reveal entrances animate transform and opacity only', () => {
  const reveal = blocks((selector) => /\.rv\b/.test(selector));
  assert.ok(reveal.length > 0, 'no .rv rules found');
  for (const { name, selector, body } of reveal) {
    const filter = body.match(/(?:^|;)\s*filter\s*:\s*([^;]+)/);
    assert.ok(!filter || filter[1].trim() === 'none', `${name}: ${selector} sets filter ${filter?.[1]}`);
    for (const [, value] of body.matchAll(/(?:^|;)\s*transition(?:-property)?\s*:\s*([^;]+)/g)) {
      assert.ok(!PAINT_OR_LAYOUT.test(value.replace(/var\([^)]*\)|calc\([^)]*\)/g, '')), `${name}: ${selector} transitions ${value.trim()}`);
    }
  }
});

test('a reveal reached at speed has a short, unstaggered entrance', () => {
  const snap = blocks((selector) => /\.rv\[data-snap="true"\]/.test(selector));
  assert.ok(snap.some(({ body }) => /transition-delay\s*:\s*0s/.test(body) && /transition-duration\s*:\s*0?\.\d+s/.test(body)));
});

test('held stories never animate layout', () => {
  const story = css.find(({ name }) => name === 'scroll-story.css');
  for (const [, value] of story.text.matchAll(/transition\s*:\s*([^;]+)/g)) {
    assert.ok(!PAINT_OR_LAYOUT.test(value.replace(/var\([^)]*\)|calc\([^)]*\)/g, '')), `scroll-story.css transitions ${value.trim()}`);
  }
});

// One gesture, one step (owner L-027 to L-029). storyGesture.mjs holds the decisions ScrollStory makes; these
// replay synthetic flicks of any size against a 4-step story.

const burst = (count, size, every = 8, start = 0) => Array.from({ length: count }, (_, i) => ({ t: start + i * every, dy: size }));
// A trackpad swipe: deltas rise then decay over about 1.5 s (60 events, 25 ms apart).
const trackpad = (start = 0, sign = 1) => Array.from({ length: 60 }, (_, i) => ({ t: start + i * 25, dy: sign * Math.max(1, Math.round(90 * Math.exp(-i / 12) * Math.min(1, (i + 1) / 3))) }));

test('a flick of any size moves a held story exactly one step', () => {
  for (const events of [burst(1, 100), burst(3, 120, 40), burst(8, 250), burst(14, 400), burst(40, 140, 16), trackpad()]) {
    const out = replayWheel(events, { steps: 4, from: 0 });
    assert.equal(out.step, 1, `${events.length} events of ${events[0].dy}px moved to step ${out.step}`);
    assert.equal(out.passed, 0, 'no event of a claimed flick reaches the page');
  }
});

test('two flicks with a quiet gap move two steps, never more', () => {
  const events = [...burst(14, 400), ...burst(14, 400, 8, 14 * 8 + QUIET_MS + 600)];
  assert.deepEqual(replayWheel(events, { steps: 4, from: 0 }).moves, [1, 2]);
});

test('a flick up from the first step and down from the last is left to the page', () => {
  assert.equal(replayWheel(burst(14, -400), { steps: 4, from: 0 }).passed, 14);
  assert.equal(replayWheel(burst(14, 400), { steps: 4, from: 3 }).passed, 14);
  // Upward from the last step still steps back one.
  assert.equal(replayWheel(burst(14, -400), { steps: 4, from: 3 }).step, 2);
});

test('a wheel that keeps spinning steps about once a second and is released at the end (no trap)', () => {
  const spin = burst(120, 100, 40); // 4.8 s of steady notches
  const out = replayWheel(spin, { steps: 4, from: 0 });
  assert.equal(out.step, 3);
  assert.ok(out.moves.length === 3, `moves ${out.moves}`);
  assert.ok(out.passed > 0, 'the rest of the stream reaches the page once the story has no step left');
  // A trackpad tail never counts as a second push.
  assert.ok(trackpad().at(-1).t > RESTEP_MS);
  assert.equal(replayWheel(trackpad(), { steps: 4, from: 0 }).step, 1);
});

test('one touch swipe, slow or fast, moves one step', () => {
  const claim = () => true;
  for (const [count, every] of [[5, 16], [30, 16], [3, 8]]) {
    let g = touchStart({ x: 200, y: 700, t: 0 });
    let steps = 0;
    for (let i = 1; i <= count; i += 1) {
      const out = touchMove(g, { x: 200, y: 700 - i * 60, t: i * every }, { claim });
      g = out.gesture;
      steps += Math.abs(out.step);
    }
    steps += Math.abs(touchEnd(g, { y: 700 - count * 60, t: count * every + 4 }, {}).step);
    assert.equal(steps, 1, `${count} moves stepped ${steps}`);
  }
  // A quick short flick still counts once; a sideways swipe is never the story's.
  let g = touchStart({ x: 200, y: 700, t: 0 });
  g = touchMove(g, { x: 200, y: 692, t: 20 }, { claim }).gesture;
  assert.equal(touchEnd(g, { y: 680, t: 60 }, {}).step, 1);
  g = touchStart({ x: 300, y: 700, t: 0 });
  const side = touchMove(g, { x: 200, y: 690, t: 20 }, { claim });
  assert.equal(side.cancel, false);
});

test('a burst whose events queue behind a busy page is still one push', () => {
  // Each event is sent only once the page has handled the one before; drawing the step keeps the page busy 450 ms.
  const events = [];
  let handled = 0;
  for (let i = 0; i < 14; i += 1) {
    const t = i === 0 ? 0 : handled + 16;
    handled = t + (i === 1 ? 450 : 30);
    events.push({ t, dy: 400, h: handled });
  }
  assert.ok(events.at(-1).t > 900, 'the burst spans far more than the quiet gap');
  assert.deepEqual(replayWheel(events, { steps: 4, from: 0 }).moves, [1]);
});

test('a swipe the browser delivers only as its end still moves one step', () => {
  const g = touchStart({ x: 195, y: 675, t: 0 });
  assert.equal(touchEnd(g, { x: 195, y: -100, t: 290 }, { claim: () => true }).step, 1);
  assert.equal(touchEnd(g, { x: 195, y: 670, t: 120 }, { claim: () => true }).step, 0, 'a tap is not a step');
  assert.equal(touchEnd(g, { x: 195, y: -100, t: 290 }, { claim: () => false }).step, 0, 'unclaimed: the page has it');
});
