// node --test src/components/landing/companionModel.test.mjs
// Round 14 (13 Nov 2026): the phone scroll companion's rules (companionModel.mjs) and the component's contract with the
// page (MobiCompanion.jsx, r14-companion.css). Source-level, so no server is needed; tmp/1114-companion walks the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMPANION, SECTION_ASKS, SECTION_POSES, POSES, askForSection, sectionKey, poseForSection, velocity, lean, poseDecision, wantShown, floorLift, isTappable, bubbleGone, restSpot,
} from './companionModel.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('each section gives its pose, every pose is one Mascot can draw, the rest stand idle', () => {
  assert.equal(poseForSection('hero'), 'attentive');
  assert.equal(poseForSection('colleges'), 'attentive');
  assert.equal(poseForSection('statement'), 'thinking');
  assert.equal(poseForSection('key-cards'), 'pointing');
  assert.equal(poseForSection('exam-experience'), 'reading');
  assert.equal(poseForSection('compass'), 'pointing');
  assert.equal(poseForSection('du-eligibility'), 'pointing');
  assert.equal(poseForSection('on-instagram'), 'greeting');
  assert.equal(poseForSection('pricing'), 'attentive');
  assert.equal(poseForSection('faq'), 'thinking');
  assert.equal(poseForSection('wall-of-love'), 'idle');
  assert.equal(poseForSection(''), 'idle');
  for (const pose of Object.values(SECTION_POSES)) assert.ok(POSES.includes(pose), pose);
});

test('a section is keyed by its id, else by the class that names it', () => {
  assert.equal(sectionKey({ id: 'pricing', classes: ['lp-sec'] }), 'pricing');
  assert.equal(sectionKey({ classes: 'lp-hero' }), 'hero');
  assert.equal(sectionKey({ classes: ['lp-statement'] }), 'statement');
  assert.equal(sectionKey({ classes: 'lp-close' }), 'close');
  assert.equal(sectionKey({ classes: 'lp-sec lp-sec--band' }), 'faq');
  assert.equal(sectionKey({}), '');
});

test('speed is clamped to -1..1; he stands still while the page moves: no lean and no stretch at any speed', () => {
  assert.equal(velocity(0, 16), 0);
  assert.equal(velocity(5000, 16), 1);
  assert.equal(velocity(-5000, 16), -1);
  assert.ok(velocity(10, 16) > 0 && velocity(10, 16) < 1);
  assert.equal(velocity(10, 0), velocity(10, 16), 'a zero frame gap reads as one frame');
  for (const v of [0, 0.5, 1, -1, 3]) assert.deepEqual(lean(v), { deg: 0, stretch: 0 });
  assert.equal(COMPANION.leanDeg, 0);
  assert.equal(COMPANION.stretch, 0);
});

test('he stands only on the bottom bar: with no bar up he is out', () => {
  const base = { scrollY: 600, viewport: 844 };
  assert.equal(wantShown({ ...base, docked: true }), true);
  assert.equal(wantShown({ ...base, docked: false }), false);
});

test('a tap asks about the section he is in, where Mobi has something to go on', () => {
  assert.equal(askForSection('pricing'), 'What do I get on Free?');
  assert.equal(askForSection('inside-the-lab'), 'What is the Mistake Lab?');
  assert.equal(askForSection('wall-of-love'), null);
  assert.equal(askForSection(''), null);
  for (const q of Object.values(SECTION_ASKS)) { assert.ok(q.endsWith('?') && q.length <= 60, q); assert.doesNotMatch(q, /!/); }
});

test('a pose changes only when slow or resting, and at most once per 600 ms', () => {
  assert.equal(poseDecision({ current: 'idle', wanted: 'idle', resting: true }).commit, false, 'same pose');
  assert.equal(poseDecision({ current: 'idle', wanted: 'thinking', speed: 0.9, now: 5000, lastAt: 0 }).commit, false, 'fast scroll');
  assert.equal(poseDecision({ current: 'idle', wanted: 'thinking', speed: 0.9, resting: true, now: 5000, lastAt: 0 }).commit, true, 'resting wins');
  assert.equal(poseDecision({ current: 'idle', wanted: 'thinking', speed: 0.1, now: 5000, lastAt: 0 }).commit, true, 'slow');
  const gap = poseDecision({ current: 'idle', wanted: 'thinking', speed: 0, now: 1000, lastAt: 700 });
  assert.equal(gap.commit, false);
  assert.equal(gap.waitMs, 300, 'tells the caller when to try again');
});

test('he stays out on the hero first screen and for any other Mobi, a carrying bar, the Ask sheet, the nav sheet or the footer', () => {
  const base = { scrollY: 600, viewport: 844 };
  assert.equal(wantShown({ scrollY: 400, viewport: 844 }), false, 'under 60 % of a screen');
  assert.equal(wantShown(base), true);
  assert.equal(wantShown({ ...base, otherMobi: true }), false);
  assert.equal(wantShown({ ...base, barOn: true }), false);
  assert.equal(wantShown({ ...base, askOpen: true }), false);
  assert.equal(wantShown({ ...base, navOpen: true }), false);
  assert.equal(wantShown({ ...base, footer: true }), false);
  assert.equal(wantShown({ scrollY: 600 }), false, 'no viewport read yet');
});

test('he rides the dock: his feet on its top edge when it is up, his own gap when it is not', () => {
  assert.equal(floorLift({ docked: false, dockHeight: 70 }), 0);
  assert.equal(floorLift({ docked: true, dockHeight: 70, restBottom: 14 }), 56);
  assert.equal(floorLift({ docked: true, dockHeight: 10, restBottom: 14 }), 0);
  assert.equal(floorLift({ docked: true, dockHeight: 0 }), 0);
});

test('the control check knows what a reader taps', () => {
  for (const tag of ['A', 'button', 'input', 'select', 'textarea', 'summary', 'label']) assert.ok(isTappable({ tag }), tag);
  assert.ok(isTappable({ tag: 'div', role: 'button' }));
  assert.equal(isTappable({ tag: 'p' }), false);
  assert.equal(isTappable({ tag: 'section', role: 'region' }), false);
});

test('he never covers words or controls: he stands where clear, shows his head over a body-only hit, else steps aside (17 Nov 2026)', () => {
  assert.equal(restSpot({ full: false, head: false }), 'stand');
  assert.equal(restSpot({ full: true, head: false }), 'tuck');
  assert.equal(restSpot({ full: true, head: true }), 'aside');
  assert.equal(restSpot(), 'stand');
  const base = { scrollY: 900, viewport: 844, docked: true };
  assert.equal(wantShown({ ...base, aside: true }), false, 'aside: out until a clear rest');
  assert.equal(wantShown({ ...base, aside: false }), true);
  const SRC = read('MobiCompanion.jsx');
  assert.match(SRC, /n\.nodeType !== 3/, 'words are text nodes under him, not only controls');
  assert.match(SRC, /restSpot\(\{ full, head \}\)/);
  assert.match(SRC, /bubbleEl\.getBoundingClientRect\(\)/, 'the hello checks its own box before it shows');
});

test('the hello leaves after 3 s or a 400 px scroll', () => {
  assert.equal(bubbleGone({ shownAt: 0, now: 2999, fromY: 1000, y: 1300 }), false);
  assert.equal(bubbleGone({ shownAt: 0, now: 3000, fromY: 1000, y: 1000 }), true);
  assert.equal(bubbleGone({ shownAt: 0, now: 100, fromY: 1000, y: 1401 }), true);
  assert.equal(bubbleGone({ shownAt: 0, now: 100, fromY: 1000, y: 599 }), true);
});

test('the component keeps the page contract: one scroll read, a real button, the event, phones only, cleanup', () => {
  const SRC = read('MobiCompanion.jsx');
  const CSS = read('../../app/r14-companion.css');
  assert.match(SRC, /scrollBus\.subscribe\(/, 'the shared scroll read');
  assert.doesNotMatch(SRC, /addEventListener\(\s*'scroll'/, 'no scroll listener of its own');
  assert.doesNotMatch(SRC, /requestAnimationFrame\(/, 'no frame loop of its own');
  assert.match(SRC, /<button[^>]*type="button"[^>]*aria-label="Ask Mobi a question"/);
  assert.match(SRC, /new CustomEvent\('mm:ask-mobi', \{ detail: \{ source: 'companion', section: s\.section \} \}\)/);
  assert.match(SRC, /docked: docked\(\)/, 'shown only on the bar');
  assert.doesNotMatch(SRC, /hop\(/, 'no hops');
  assert.match(SRC, /matchMedia\('\(max-width: 899px\)'\)/);
  assert.match(SRC, /data-pip-static/);
  assert.match(SRC, /getElementById\('mbp-/, 'nothing when the sprite is missing');
  assert.match(SRC, /sessionStorage/);
  assert.match(SRC, /elementsFromPoint/);
  for (const name of ['disconnect()', 'offScroll()']) assert.ok(SRC.includes(name), name);
  assert.match(CSS, /prefers-reduced-motion: reduce/);
  assert.match(CSS, /html\[data-motion='reduced'\]/);
  assert.match(CSS, /:focus-visible/);
  assert.doesNotMatch(CSS, /pip-arrive|mc-hop/, 'no hop on arrival or on a pose change');
  assert.doesNotMatch(CSS, /gradient\(|backdrop-filter|drop-shadow/, 'no gradients, glows or glass');
});
