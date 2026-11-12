// node --test src/components/landing/companionModel.test.mjs
// Round 14 (13 Nov 2026): the phone scroll companion's rules (companionModel.mjs) and the component's contract with the
// page (MobiCompanion.jsx, r14-companion.css). Source-level, so no server is needed; tmp/1114-companion walks the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMPANION, SECTION_POSES, POSES, sectionKey, poseForSection, velocity, lean, poseDecision, wantShown, floorLift, isTappable, bubbleGone,
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

test('speed is clamped to -1..1 and the lean stays within 5 degrees; only a flick stretches him, never past 1.06', () => {
  assert.equal(velocity(0, 16), 0);
  assert.equal(velocity(5000, 16), 1);
  assert.equal(velocity(-5000, 16), -1);
  assert.ok(velocity(10, 16) > 0 && velocity(10, 16) < 1);
  assert.equal(velocity(10, 0), velocity(10, 16), 'a zero frame gap reads as one frame');
  assert.deepEqual(lean(0), { deg: 0, stretch: 0 });
  assert.equal(lean(1).deg, 5);
  assert.equal(lean(-1).deg, -5);
  assert.equal(lean(3).deg, 5, 'clamped');
  assert.equal(lean(0.5).stretch, 0, 'a steady scroll does not stretch');
  assert.equal(lean(1).stretch, COMPANION.stretch);
  assert.ok(lean(-1).stretch <= 0.06 && lean(0.8).stretch > 0);
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
  assert.match(SRC, /new CustomEvent\('mm:ask-mobi', \{ detail: \{ source: 'companion' \} \}\)/);
  assert.match(SRC, /matchMedia\('\(max-width: 899px\)'\)/);
  assert.match(SRC, /data-pip-static/);
  assert.match(SRC, /getElementById\('mbp-/, 'nothing when the sprite is missing');
  assert.match(SRC, /sessionStorage/);
  assert.match(SRC, /elementsFromPoint/);
  for (const name of ['disconnect()', 'offScroll()']) assert.ok(SRC.includes(name), name);
  assert.match(CSS, /prefers-reduced-motion: reduce/);
  assert.match(CSS, /html\[data-motion='reduced'\]/);
  assert.match(CSS, /:focus-visible/);
  assert.match(CSS, /pip-arrive/);
  assert.doesNotMatch(CSS, /gradient\(|backdrop-filter|drop-shadow/, 'no gradients, glows or glass');
});
