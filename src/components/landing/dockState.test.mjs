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

test('the dock keeps its three states and never falls back to a small linked line', () => {
  const dock = readFileSync(new URL('./HeroDockGate.jsx', import.meta.url), 'utf8');
  for (const text of ['Welcome back', 'Save your answers', 'Free to start', 'Go to practice', 'Start free', 'Try 5 questions']) {
    assert.ok(dock.includes(text) || readFileSync(new URL('./useWayIn.js', import.meta.url), 'utf8').includes(text), text);
  }
  assert.ok(!dock.includes('lp-docklink'));
  // The sample's own key is offered only to a visitor who has not tried it.
  assert.match(dock, /kind === 'new' \? <a href="#try-practice"/);
});
