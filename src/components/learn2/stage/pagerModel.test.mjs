// The study stage's pure rules: the pager (wheel, release, scroller, keys) and the text rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WHEEL, wheelState, wheelStep, rubber, releaseVelocity, releaseTarget, touchLock, canScroll, scrollerThatCanMove, keyAction } from './pagerModel.mjs';
import { frontSize, backSize, optionTexts, twoColumns, assertionReason, doneLine, timeLeft, speakable, chapterRef, matchLists } from './stageText.mjs';

const run = (events) => {
  let s = wheelState();
  const moves = [];
  for (const e of events) { const r = wheelStep(s, e); s = r.state; moves.push(r.move); }
  return moves.filter(Boolean);
};

test('one mouse notch moves one item at once', () => {
  assert.deepEqual(run([{ dy: 100, t: 0 }]), [1]);
  assert.deepEqual(run([{ dy: -120, t: 0 }]), [-1]);
});

test('a trackpad swipe moves one item after 60 px and its inertia tail moves nothing', () => {
  const swipe = Array.from({ length: 30 }, (_, i) => ({ dy: 40 - i, t: i * 16 }));
  assert.deepEqual(run(swipe), [1]);
});

test('three notches 1.3 s apart move three items; ten notches in one burst move one', () => {
  assert.deepEqual(run([{ dy: 100, t: 0 }, { dy: 100, t: 1300 }, { dy: 100, t: 2600 }]), [1, 1, 1]);
  assert.deepEqual(run(Array.from({ length: 10 }, (_, i) => ({ dy: 100, t: i * 60 }))), [1]);
  assert.deepEqual(run([{ dy: 100, t: 0 }, { dy: 100, t: 230 }]), [1, 1]);
});

test('Firefox line deltas count as 40 px a line; sideways and pinch are not the pager\'s', () => {
  assert.deepEqual(run([{ dy: 3, mode: 1, t: 0 }]), [1]);
  assert.equal(wheelStep(wheelState(), { dy: 10, dx: 80, t: 0 }).prevent, false);
  assert.equal(wheelStep(wheelState(), { dy: 100, t: 0, ctrl: true }).move, 0);
});

test('a gesture that starts inside a scroller ends there; a move in progress swallows the wheel', () => {
  let s = wheelState();
  let r = wheelStep(s, { dy: 100, t: 0, inner: true });
  assert.equal(r.prevent, false); s = r.state;
  r = wheelStep(s, { dy: 100, t: 50, inner: false }); // the scroller reached its edge mid-gesture
  assert.equal(r.move, 0); assert.equal(r.prevent, true); s = r.state;
  r = wheelStep(s, { dy: 100, t: 400 }); // a new gesture from the edge
  assert.equal(r.move, 1);
  assert.equal(wheelStep(wheelState(), { dy: 100, t: 0, moving: true }).move, 0);
  assert.ok(WHEEL.quiet === 220 && WHEEL.step === 60);
});

test('release: 18% of the area or 0.35 px/ms, never more than one item, a flick back springs back', () => {
  assert.equal(releaseTarget({ dy: -300, v: 0, height: 844, index: 2, count: 10 }), 3); // a slow third of the screen
  assert.equal(releaseTarget({ dy: -100, v: 0, height: 844, index: 2, count: 10 }), 2);
  assert.equal(releaseTarget({ dy: -40, v: -0.5, height: 844, index: 2, count: 10 }), 3);
  assert.equal(releaseTarget({ dy: 200, v: 0, height: 844, index: 2, count: 10 }), 1);
  assert.equal(releaseTarget({ dy: -800, v: -4, height: 844, index: 2, count: 10 }), 3);
  assert.equal(releaseTarget({ dy: -300, v: 0.6, height: 844, index: 2, count: 10 }), 1);
  assert.equal(releaseTarget({ dy: -300, v: 0, height: 844, index: 9, count: 10 }), 9);
  assert.equal(releaseTarget({ dy: 300, v: 0, height: 844, index: 0, count: 10 }), 0);
});

test('velocity over the last 80 ms; rubber band at the ends; tap and direction lock', () => {
  assert.equal(releaseVelocity([{ t: 0, y: 0 }, { t: 100, y: -10 }, { t: 160, y: -50 }, { t: 180, y: -70 }]), -60 / 80);
  assert.equal(releaseVelocity([{ t: 0, y: 0 }]), 0);
  assert.equal(rubber(100, 0, 5), 35);
  assert.equal(rubber(-100, 4, 5), -35);
  assert.equal(rubber(-100, 2, 5), -100);
  assert.equal(touchLock(3, 4), 'tap');
  assert.equal(touchLock(2, 20), 'vertical');
  assert.equal(touchLock(30, 10), 'side');
});

test('the scroller that can move: the edge rule', () => {
  assert.equal(canScroll({ scrollTop: 0, scrollHeight: 900, clientHeight: 500 }, 1), true);
  assert.equal(canScroll({ scrollTop: 0, scrollHeight: 900, clientHeight: 500 }, -1), false);
  assert.equal(canScroll({ scrollTop: 400, scrollHeight: 900, clientHeight: 500 }, 1), false);
  assert.equal(canScroll({ scrollTop: 0, scrollHeight: 500, clientHeight: 500 }, 1), false);
  const root = { parentElement: null };
  const box = { parentElement: root, scrollTop: 10, scrollHeight: 900, clientHeight: 400, s: 'auto' };
  const leaf = { parentElement: box, scrollTop: 0, scrollHeight: 20, clientHeight: 20, s: 'visible' };
  const styleOf = (el) => ({ overflowY: el.s || 'visible' });
  assert.equal(scrollerThatCanMove(leaf, 1, root, styleOf), box);
  assert.equal(scrollerThatCanMove(leaf, -1, root, styleOf), box);
  box.scrollTop = 500;
  assert.equal(scrollerThatCanMove(leaf, 1, root, styleOf), null);
});

test('the key table', () => {
  for (const k of ['ArrowDown', 'PageDown', 'j']) assert.equal(keyAction(k, {}), 'next');
  for (const k of ['ArrowUp', 'PageUp', 'k']) assert.equal(keyAction(k, {}), 'prev');
  assert.equal(keyAction('Home', {}), 'first');
  assert.equal(keyAction('End', {}), 'last');
  assert.equal(keyAction(' ', { turnable: true }), 'turn');
  assert.equal(keyAction('Enter', {}), 'next');
  assert.equal(keyAction(' ', { onControl: true, turnable: true }), null);
  assert.equal(keyAction('ArrowDown', { mods: true }), null);
  assert.equal(keyAction('ArrowDown', { typing: true }), null);
  assert.equal(keyAction('ArrowDown', { scrollable: (d) => d === 1 }), null);
  assert.equal(keyAction('ArrowUp', { scrollable: (d) => d === 1 }), 'prev');
  assert.deepEqual(keyAction('2', { answerable: true, options: 4 }), { answer: 1 });
  assert.deepEqual(keyAction('C', { answerable: true, options: 4 }), { answer: 2 });
  assert.deepEqual(keyAction('5', { answerable: true, options: 5 }), { answer: 4 });
  assert.equal(keyAction('5', { answerable: true, options: 4 }), null);
  assert.equal(keyAction('a', { answerable: true, options: 4, foreign: true }), null);
  assert.equal(keyAction('a', { answerable: false, options: 4 }), null);
  assert.equal(keyAction('s', { saveable: true }), 'save');
  assert.equal(keyAction('S', { saveable: true, answerable: true, options: 4 }), 'save');
  assert.equal(keyAction('s', { saveable: false }), null);
  assert.equal(keyAction('s', { saveable: true, foreign: true }), null);
  assert.equal(keyAction('s', { saveable: true, typing: true }), null);
  assert.deepEqual(keyAction('f', { answerable: true, options: 6 }), { answer: 5 });
  assert.equal(keyAction('Escape', {}), 'escape');
  assert.equal(keyAction('?', {}), 'help');
});

test('text: front and back sizes, blanks read aloud, options stripped only when every option carries its letter', () => {
  assert.equal(frontSize('What is goodwill?'), 's');
  assert.equal(frontSize('x'.repeat(100)), 'm');
  assert.equal(frontSize('x'.repeat(121)), 'l');
  assert.equal(backSize('x'.repeat(100)), 's');
  assert.equal(backSize('x'.repeat(330)), 'xl');
  assert.equal(speakable('The ____ ratio'), 'The blank ratio');
  assert.deepEqual(optionTexts([{ key: 'A', text: 'A. Nil' }, { key: 'B', text: 'B. Rs 100' }]), ['Nil', 'Rs 100']);
  assert.deepEqual(optionTexts([{ key: 'A', text: '(A) Nil' }, { key: 'B', text: '(B) Rs 100' }]), ['Nil', 'Rs 100']);
  assert.deepEqual(optionTexts([{ key: 'A', text: 'A reduction in capital' }, { key: 'B', text: 'Both' }]), ['A reduction in capital', 'Both']);
  assert.equal(twoColumns(['Rs 25,200, Rs 16,800 and Nil', 'Nil']), true);
  assert.equal(twoColumns(['a'.repeat(29), 'b']), false);
});

test('text: Assertion and Reason, the done line, time left, the book line', () => {
  assert.deepEqual(assertionReason('Assertion (A): Goodwill is an asset. Reason (R): It can be sold.'), { assertion: 'Goodwill is an asset.', reason: 'It can be sold.' });
  assert.equal(assertionReason('What is goodwill?'), null);
  assert.equal(doneLine({ reached: 21, of: 21, minutes: 9 }), 'All 21 done in 9 min.');
  assert.equal(doneLine({ reached: 21, of: 21 }), 'All 21 done.');
  assert.equal(doneLine({ reached: 8, of: 21, minutes: 4 }), 'You stopped at 8 of 21.');
  assert.equal(timeLeft(30), 'Under a minute left');
  assert.equal(timeLeft(330), 'About 6 min left');
  assert.equal(timeLeft(0), null);
  assert.equal(chapterRef({ ref: 'Ch 4', partTitle: 'Accountancy Part 1' }), 'Ch 4, Accountancy Part 1');
  assert.equal(chapterRef({}), null);
});

test('text: a List-I / List-II stem is set as two lists; a plain stem is not', () => {
  const m = matchLists('Match each situation in List-I with its treatment in List-II. List-I (A) Paid privately. (B) Through the firm. List-II (I) No entry. (II) Bank A/c Dr. (III) Nil. Choose the correct answer from the options given below:');
  assert.equal(m.lead, 'Match each situation in List-I with its treatment in List-II.');
  assert.deepEqual(m.one.map((x) => x.label), ['A', 'B']);
  assert.deepEqual(m.two.map((x) => [x.label, x.text]), [['I', 'No entry.'], ['II', 'Bank A/c Dr.'], ['III', 'Nil.']]);
  assert.equal(m.tail, 'Choose the correct answer from the options given below:');
  assert.equal(matchLists('What is goodwill?'), null);
});
