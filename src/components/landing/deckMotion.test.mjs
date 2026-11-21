// The tour deck's motion (18 Nov 2026, owner LK304): where the pile is for a scroll position, and each card's pose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DECK_DEPTH, DECK_REST, DECK_TAU, deckPose, deckProgress } from './deckMotion.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('the pile follows the scroll from the first card to the last and never past either', () => {
  assert.equal(deckProgress(-200, 2000, 5), 0);
  assert.equal(deckProgress(0, 2000, 5), 0);
  assert.equal(deckProgress(2000, 2000, 5), 4);
  assert.equal(deckProgress(9000, 2000, 5), 4);
  assert.equal(deckProgress(500, 2000, 5), 1, 'a quarter of the hold is the second of five cards, landed');
  assert.equal(deckProgress(100, 0, 5), 0, 'no hold, no travel');
  assert.equal(deckProgress(100, 2000, 1), 0, 'one card never moves');
  let last = -1;
  for (let y = 0; y <= 2000; y += 10) {
    const p = deckProgress(y, 2000, 5);
    assert.ok(p >= last - 1e-9, `never backwards at ${y}`);
    last = p;
  }
});

test('a landed card stays put while the page creeps: the ends of each step are a rest', () => {
  const step = 500;
  assert.equal(deckProgress(step * DECK_REST * 0.9, 2000, 5), 0);
  assert.equal(deckProgress(step - step * DECK_REST * 0.9, 2000, 5), 1);
  const mid = deckProgress(step / 2, 2000, 5);
  assert.ok(Math.abs(mid - 0.5) < 1e-9, 'half way through the scroll is half way through the deal');
});

test('reduced motion: whole cards only, and a card is on top, under, or gone, never travelling', () => {
  assert.equal(deckProgress(240, 2000, 5, true), 0);
  assert.equal(deckProgress(260, 2000, 5, true), 1);
  assert.equal(deckPose(-0.4, { reduced: true }).transform, 'translate3d(0, 0, 0)');
  assert.equal(deckPose(-0.6, { reduced: true }).hidden, true);
  assert.equal(deckPose(1.2, { reduced: true, peek: 12 }).transform, deckPose(1, { peek: 12 }).transform);
});

test('a card rises from the foot of the pile and lies flat as it lands', () => {
  const foot = deckPose(-1);
  assert.equal(foot.hidden, true);
  assert.equal(foot.opacity, '0');
  const half = deckPose(-0.5);
  assert.equal(half.hidden, false);
  assert.match(half.transform, /^translate3d\(0, 52\.00%, 0\) rotateX\(3\.50deg\)$/);
  assert.equal(deckPose(0).transform, 'translate3d(0, 0, 0)');
  assert.equal(deckPose(0).shade, '0.000');
});

test('a covered card sinks one peek and a twentieth per card over it, dims, and is gone after the pile is three deep', () => {
  const one = deckPose(1, { peek: 12 });
  assert.equal(one.transform, 'translate3d(0, -12.0px, 0) scale(0.9500)');
  assert.equal(one.opacity, '1.000');
  assert.ok(Number(one.shade) > 0);
  const two = deckPose(2, { peek: 16 });
  assert.equal(two.transform, 'translate3d(0, -32.0px, 0) scale(0.9000)');
  assert.equal(deckPose(2.5).opacity, '0.500');
  const gone = deckPose(DECK_DEPTH + 1);
  assert.equal(gone.hidden, true);
  assert.equal(gone.opacity, '0');
  // Only transform and opacity are ever written.
  for (const t of [-0.99, -0.3, 0, 0.4, 1.7, 2.9]) assert.deepEqual(Object.keys(deckPose(t)).sort(), ['hidden', 'opacity', 'shade', 'transform']);
});

test('a finger is followed almost one to one; a mouse step is eased', () => {
  assert.ok(DECK_TAU.touch < DECK_TAU.mouse);
  assert.ok(DECK_TAU.touch <= 80 && DECK_TAU.mouse <= 200);
});

test('the deck is one held story on every pointer, plays each demo as its card comes on, and moves only transform and opacity', () => {
  const deck = read('./TourDeck.jsx');
  assert.match(deck, /<ScrollStory steps=\{slides\.length\} className="td-story" label="What is inside MockMob, tool by tool" Content=\{Deck\} slides=\{slides\} samples=\{samples\} \/>/);
  assert.doesNotMatch(deck, /hold=\{/, 'no media query lets a pointer out of the hold');
  assert.match(deck, /play=\{on && running\}/);
  assert.match(deck, /card\.style\.transform = pose\.transform;/);
  assert.doesNotMatch(deck, /style\.(top|left|height|width|margin)/, 'never layout');
  assert.match(deck, /bus\.subscribe/, 'the page\'s one scroll read, not a listener of its own');
  const css = read('../../app/r18-tour-deck.css');
  assert.doesNotMatch(css, /transition:\s*all/);
  assert.match(css, /\.td-story\[data-pinned='false'\] \.td__card \{ position: static;/, 'without the hold the cards are a plain list');
  const page = read('../../app/page.js');
  // Since 21 Nov 2026 the home page draws the deck's screens as rows of its one frame (OnePlace.jsx), handed the same tour
  // and the same samples; the deck itself (TourDeck.jsx) stays for any page that draws it.
  assert.match(page, /<OnePlaceGate keyCards=\{KEY_CARDS\} photo=\{MISTAKE_PHOTO_ON\} price=\{MOBI_PRICE\} tour=\{TOUR\} samples=\{TOUR_SAMPLES\}>/);
  assert.match(read('./OnePlace.jsx'), /<TourStage Screen=\{Screen\} active=\{on\} play=\{on && playing\} epoch=\{stages\.gen\[i\]\} sample=\{samples\?\.\[row\.id\] \?\? null\} \/>/);
});
