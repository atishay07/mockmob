// node --test src/components/landing/dockState.test.mjs
// The landing dock and bands follow the sample contract: localStorage "mm:sample:v1" and the
// "mm:sample-progress" / "mm:sample-done" events. Storage can be blocked or hold anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLE_KEY, SAMPLE_EVENTS, NO_SAMPLE, readSample, visitorKind } from './useSampleState.js';

function withStorage(value, run) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = { localStorage: { getItem: (key) => { if (value instanceof Error) throw value; return key === SAMPLE_KEY ? value : null; } } };
  try { run(); } finally { if (had) Object.defineProperty(globalThis, 'window', had); else delete globalThis.window; }
}

test('the contract names the shared key and both events', () => {
  assert.equal(SAMPLE_KEY, 'mm:sample:v1');
  assert.deepEqual(SAMPLE_EVENTS, ['mm:sample-progress', 'mm:sample-done']);
});

test('nothing stored, or storage blocked, reads as no sample', () => {
  withStorage(null, () => assert.deepEqual(readSample(), NO_SAMPLE));
  withStorage(new Error('blocked'), () => assert.deepEqual(readSample(), NO_SAMPLE));
  withStorage('{not json', () => assert.deepEqual(readSample(), NO_SAMPLE));
});

test('progress and done are read from the record', () => {
  withStorage('{"answered":2,"done":false,"subject":"english","at":"2026-10-15T18:00:00Z"}', () => assert.deepEqual(readSample(), { answered: 2, done: false }));
  withStorage('{"answered":5,"done":true,"subject":"english"}', () => assert.deepEqual(readSample(), { answered: 5, done: true }));
});

test('a malformed record never claims answers', () => {
  withStorage('{"answered":"x","done":true}', () => assert.deepEqual(readSample(), NO_SAMPLE));
  withStorage('{"answered":-3,"done":true}', () => assert.deepEqual(readSample(), NO_SAMPLE));
  withStorage('7', () => assert.deepEqual(readSample(), NO_SAMPLE));
});

test('the visitor is a member, sampled or new, in that order of precedence', () => {
  assert.equal(visitorKind(true, { answered: 5, done: true }), 'member');
  assert.equal(visitorKind(false, { answered: 1, done: false }), 'sampled');
  assert.equal(visitorKind(false, NO_SAMPLE), 'new');
  assert.equal(visitorKind(false, undefined), 'new');
});

// Owner, L-008/L-009 (17 Oct 2026): "the dock must be one real key whose label follows state". A new visitor sees
// "Start free"; a guest who finished the sample sees "Sign up"; a signed-in member sees "Welcome back" over one
// "Go to practice". No state has a second key, and none promises that sample answers are saved (nothing saves them).
test('the dock is one real key whose label follows state, and never falls back to a small linked line', () => {
  const dock = readFileSync(new URL('./HeroDockGate.jsx', import.meta.url), 'utf8');
  const ways = readFileSync(new URL('./useWayIn.js', import.meta.url), 'utf8');
  for (const text of ['Welcome back', 'Go to practice', 'Start free', 'Sign up']) {
    assert.ok(dock.includes(text) || ways.includes(text), text);
  }
  // The words follow the visitor: Start free, Sign up once the sample is finished, "Welcome back" only for a member.
  const body = dock.slice(dock.indexOf('export function LandingDock()'), dock.indexOf('export default HeroDockGate'));
  assert.match(body, /const label = kind === 'member' \? 'Welcome back' : '';/);
  assert.match(body, /kind === 'sampled' && sample\.done \? 'Sign up' : 'Start free'/);
  assert.match(ways, /homeText: 'Go to practice'/);
  // One key per state: a member's, or the sign-up key. No second key, no anchor to the sample, no saved-answers line.
  assert.equal((body.match(/<Link /g) || []).length, 2);
  assert.ok(!/<a /.test(body), 'no second key in the dock');
  assert.ok(!dock.includes('Try 5 questions'));
  assert.ok(!dock.includes('Save your answers'));
  assert.ok(!dock.includes('lp-docklink'));
  // A new visitor gets no label: "Free to start" is said by the hero, the pricing and the close.
  assert.ok(!dock.includes("'Free to start'"));
});

test('one dock rule: up from the hero to the close, never retired by a held story in portrait', () => {
  const gate = readFileSync(new URL('./HeroDockGate.jsx', import.meta.url), 'utf8');
  const depth = readFileSync(new URL('../../app/hero-depth.css', import.meta.url), 'utf8');
  const story = readFileSync(new URL('../../app/scroll-story.css', import.meta.url), 'utf8');
  // The gate watches only the hero's keys and the sample; the DU form no longer lowers it.
  assert.ok(!gate.includes('du-teaser__pick'));
  assert.ok(!gate.includes("ss[data-live"));
  // A live held story lowers the dock only in landscape, where there is no height to spare.
  const portraitHide = depth.split('\n').filter((line) => line.includes(":has(.ss[data-live='true'])") && line.includes('.mm-dock'));
  assert.ok(portraitHide.length === 1);
  assert.ok(depth.includes('(orientation: landscape) and (max-height: 520px)'));
  // Held stories keep the dock's band free at their foot on phones.
  assert.match(story, /\.mm\.lp \.ss \{ --ss-bottom: var\(--lp-dock-room/);
  // An in-page volt key quiets the top bar's key.
  assert.ok(depth.includes("[data-volt-held='true'] .mm-nav .mm-nav__cta"));
});

test('the next-move chapter is read only from a finished record', () => {
  withStorage('{"answered":5,"done":true,"focus":"Partnership"}', () => assert.deepEqual(readSample(), { answered: 5, done: true, focus: 'Partnership' }));
  withStorage('{"answered":2,"done":false,"focus":"Partnership"}', () => assert.deepEqual(readSample(), { answered: 2, done: false }));
  withStorage('{"answered":5,"done":true,"focus":42}', () => assert.deepEqual(readSample(), { answered: 5, done: true }));
});
