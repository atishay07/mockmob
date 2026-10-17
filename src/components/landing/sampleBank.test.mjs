import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_BANK, dealSet } from './sampleBank.mjs';
import { SAMPLE_SUBJECTS, SAMPLE_SIZE, sampleSubject } from './sampleSubjects.mjs';
import { SAMPLE_RECORD_KEY, nextRecord, recordSample } from './sampleRecord.mjs';
import { CUET_PUBLIC_ALLOWED_SUBJECTS } from '../../../data/cuet_controls.js';

// The landing sample: every subject a visitor can pick has five well-formed questions, the picker offers exactly
// the subjects MockMob practises, and the record the dock reads follows the contract.

test('the picker offers every practised subject, the five launch chips first', () => {
  assert.deepEqual([...SAMPLE_SUBJECTS.map((s) => s.id)].sort(), [...CUET_PUBLIC_ALLOWED_SUBJECTS].sort());
  assert.deepEqual(SAMPLE_SUBJECTS.filter((s) => s.featured).map((s) => s.name), ['Accountancy', 'Business Studies', 'Economics', 'English', 'General Test']);
  assert.equal(sampleSubject('economics').name, 'Economics');
  assert.equal(sampleSubject('nope'), null);
});

test('each subject has five questions with four distinct options and a valid key', () => {
  for (const { id } of SAMPLE_SUBJECTS) {
    const set = SAMPLE_BANK[id];
    assert.ok(Array.isArray(set), `${id} has questions`);
    assert.equal(set.length, SAMPLE_SIZE, `${id} has ${SAMPLE_SIZE}`);
    for (const item of set) {
      assert.equal(item.options.length, 4, item.q);
      assert.equal(new Set(item.options).size, 4, `distinct options: ${item.q}`);
      assert.ok(Number.isInteger(item.correct) && item.correct >= 0 && item.correct < 4, item.q);
      for (const field of ['q', 'why', 'chapter']) assert.ok(typeof item[field] === 'string' && item[field].trim(), `${field}: ${item.q}`);
    }
    // The answers are not all in one position, so guessing one letter does not pass a set.
    assert.ok(new Set(set.map((item) => item.correct)).size >= 2, `${id} spreads its keys`);
  }
});

test('the copy follows the house rules: no exclamation marks, em dashes or middle dots', () => {
  const text = JSON.stringify(SAMPLE_BANK) + JSON.stringify(SAMPLE_SUBJECTS);
  assert.doesNotMatch(text, /!/);
  assert.doesNotMatch(text, /—/);
  assert.doesNotMatch(text, /·/);
});

test('the record keeps the contract and never steps back once finished', () => {
  const first = nextRecord(null, { answered: 1, done: false, subject: 'economics', at: 'T1' });
  assert.deepEqual(first, { answered: 1, done: false, subject: 'economics', at: 'T1' });
  const finished = nextRecord(first, { answered: 5, done: true, subject: 'economics', at: 'T2' });
  assert.deepEqual(finished, { answered: 5, done: true, subject: 'economics', at: 'T2' });
  const again = nextRecord(finished, { answered: 2, done: false, subject: 'physics', at: 'T3' });
  assert.deepEqual(again, { answered: 5, done: true, subject: 'physics', at: 'T3' });
  assert.deepEqual(nextRecord({ answered: 'x', done: 'yes' }, { answered: 1, done: false, subject: 'english', at: 'T' }), { answered: 1, done: false, subject: 'english', at: 'T' });
});

test('recordSample writes the key, announces the right event, and survives blocked storage', () => {
  const store = new Map();
  const events = [];
  class FakeEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  const env = {
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    CustomEvent: FakeEvent,
    dispatchEvent: (e) => events.push(e),
  };
  recordSample({ answered: 1, done: false, subject: 'english' }, env);
  recordSample({ answered: 5, done: true, subject: 'english' }, env);
  const saved = JSON.parse(store.get(SAMPLE_RECORD_KEY));
  assert.equal(SAMPLE_RECORD_KEY, 'mm:sample:v1');
  assert.equal(saved.answered, 5);
  assert.equal(saved.done, true);
  assert.equal(saved.subject, 'english');
  assert.ok(!Number.isNaN(Date.parse(saved.at)));
  assert.deepEqual(events.map((e) => e.type), ['mm:sample-progress', 'mm:sample-done']);
  assert.equal(events[1].detail.done, true);

  const blocked = { get localStorage() { throw new Error('blocked'); }, CustomEvent: FakeEvent, dispatchEvent: (e) => events.push(e) };
  const record = recordSample({ answered: 2, done: false, subject: 'physics' }, blocked);
  assert.equal(record.answered, 2);
  assert.equal(events.at(-1).type, 'mm:sample-progress');
  assert.equal(recordSample({ answered: 1, done: false, subject: 'x' }, null), null);
});

test('dealing shuffles words, keeps ordered scales, and always moves the key with its option', () => {
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const positions = new Set();
  for (const { id } of SAMPLE_SUBJECTS) {
    const dealt = dealSet(id, random);
    assert.equal(dealt.length, SAMPLE_SIZE);
    dealt.forEach((item, i) => {
      const source = SAMPLE_BANK[id][i];
      assert.equal(item.options[item.correct], source.options[source.correct], `key follows: ${source.q}`);
      assert.deepEqual([...item.options].sort(), [...source.options].sort());
      if (source.keep || source.options.every((o) => /^[\d₹+−(.-]/.test(o))) assert.deepEqual(item.options, source.options);
      positions.add(item.correct);
    });
  }
  assert.equal(positions.size, 4);
  assert.deepEqual(dealSet('nope'), []);
});

test('a finished run names its one next move, and a later run keeps it until it finishes', () => {
  const done = nextRecord(null, { answered: 5, done: true, subject: 'accountancy', at: 'T1', focus: 'Partnership' });
  assert.equal(done.focus, 'Partnership');
  const again = nextRecord(done, { answered: 1, done: false, subject: 'economics', at: 'T2', focus: null });
  assert.equal(again.focus, 'Partnership');
  const clean = nextRecord(again, { answered: 5, done: true, subject: 'economics', at: 'T3', focus: null });
  assert.equal('focus' in clean, false, 'a run with no misses names no chapter');
});

test('the finished sample names a chapter only when it holds the most misses outright, and at least two', async () => {
  const { nextChapter, groupMissed, sampleMove } = await import('./sampleResult.mjs');
  // Three misses in three chapters: a tie says nothing, so the move is a Full mock.
  const tie = sampleMove(['Cash flow statement', 'Accounting equation', 'Partnership: fundamentals']);
  assert.equal(tie.focus, null);
  assert.match(tie.text, /^a Full mock of 50 questions, to see which chapter to fix first\./);
  // One miss is not enough either.
  assert.equal(nextChapter(groupMissed(['Partnership: fundamentals'])), null);
  // Two of three misses in one chapter (two topics): that chapter, with its count beside the move.
  const two = sampleMove(['Partnership: admission of a partner', 'Cash flow statement', 'Partnership: new profit-sharing ratio']);
  assert.equal(two.focus, 'Partnership');
  assert.match(two.text, /^10 questions on Partnership, where 2 of your 3 misses came from\./);
  // Each chapter is listed once, with one readable topic.
  const groups = groupMissed(['Partnership: admission of a partner', 'Partnership: new profit-sharing ratio']);
  assert.deepEqual(groups, [{ chapter: 'Partnership', misses: 2, topic: 'Admission of a partner' }]);
  // A 2-2 tie names nothing.
  assert.equal(nextChapter(groupMissed(['A: x', 'A: y', 'B: x', 'B: y'])), null);
});

test('no sign-up key promises to carry the sample chapter it cannot carry', async () => {
  // Sign-up sends a new student through onboarding, which drops any saved return page (auth-redirect.js
  // postSignInPath), so no key may say "Start free and practise <chapter>".
  const { readFileSync } = await import('node:fs');
  for (const name of ['DemoDrill.jsx', 'HeroKeys.jsx']) {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /Start free and practise|and practise \{/, `${name} promises a chapter through sign-up`);
  }
  const redirect = readFileSync(new URL('../../lib/auth-redirect.js', import.meta.url), 'utf8');
  assert.match(redirect, /if \(needsOnboarding\) return arenaHomePath/, 'if onboarding starts keeping the return page, this key can name the chapter again');
});
