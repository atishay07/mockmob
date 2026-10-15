import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRACTISED_IDS, formatCount, practisedCounts } from './liveCount.mjs';
import { SAMPLE_SUBJECTS } from './sampleSubjects.mjs';
import { forgetLandingStats, loadLandingStats, loadPractisedCounts } from './landingStats.mjs';
import { CUET_ALLOWED_SUBJECTS } from '../../../data/cuet_controls.js';

// The hero's live line counts the 15 practised subjects and their questions, never the whole stored bank.

test('the practised ids are the stored ids of the 15 CUET subjects', () => {
  assert.deepEqual([...PRACTISED_IDS].sort(), [...CUET_ALLOWED_SUBJECTS].sort());
  assert.equal(PRACTISED_IDS.length, 15);
  assert.ok(PRACTISED_IDS.includes('gat'));
});

test('subjects outside the 15 are left out of both numbers', () => {
  const counts = { accountancy: 100, gat: 40, english: 60, legacy_quant: 900, some_old_subject: 25 };
  assert.deepEqual(practisedCounts(counts), { questions: 200, subjects: 3 });
});

test('a practised subject with no questions is not counted as a subject', () => {
  assert.deepEqual(practisedCounts({ accountancy: 10, economics: 0, physics: '7' }), { questions: 17, subjects: 2 });
});

test('no usable counts gives null, so the line stays empty', () => {
  assert.equal(practisedCounts(null), null);
  assert.equal(practisedCounts({}), null);
  assert.equal(practisedCounts({ legacy_quant: 500 }), null);
  assert.equal(practisedCounts({ accountancy: 'x' }), null);
});

// ---- One number, on one basis, from one read ----

const here = dirname(fileURLToPath(import.meta.url));

// A realistic stored snapshot: the practised subjects plus subjects the bank holds but nobody can pick.
const SNAPSHOT = {
  state: 'available',
  bankSize: 7544,
  checkedAt: '2026-10-15T19:06:07.454Z',
  subjectCounts: {
    accountancy: 1269, business_studies: 241, economics: 302, english: 209, gat: 227, mathematics: 344, physics: 301,
    chemistry: 376, biology: 415, computer_science: 386, history: 273, political_science: 281, geography: 223,
    psychology: 161, sociology: 280,
    odia: 74, urdu: 104, hindi: 10, tamil: 41, sanskrit: 8, fine_arts: 104, legal_studies: 136, home_science: 143,
  },
};
const respond = (body, status = 200) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('the figure is the practised subjects of the snapshot, not the bank and not every stored subject', () => {
  const counted = practisedCounts(SNAPSHOT.subjectCounts);
  assert.deepEqual(counted, { questions: 5288, subjects: 15 });
  assert.notEqual(counted.questions, SNAPSHOT.bankSize);
  const everyStored = Object.values(SNAPSHOT.subjectCounts).reduce((a, b) => a + b, 0);
  assert.ok(everyStored > counted.questions, 'subjects outside the 15 are left out');
});

test('the total equals the sum of the per-subject counts the page shows for those 15 subjects', () => {
  // SubjectCount (the lineup) reads subjectCounts[stored id] for each paper; the hero line is the sum of the same.
  const stored = (id) => (id === 'general_test' ? 'gat' : id);
  const perSubject = SAMPLE_SUBJECTS.map((subject) => SNAPSHOT.subjectCounts[stored(subject.id)] || 0);
  assert.equal(perSubject.reduce((a, b) => a + b, 0), practisedCounts(SNAPSHOT.subjectCounts).questions);
});

test('the same snapshot always gives the same figure and the same words', () => {
  const a = practisedCounts(SNAPSHOT.subjectCounts);
  const b = practisedCounts(structuredClone(SNAPSHOT.subjectCounts));
  assert.deepEqual(a, b);
  assert.equal(formatCount(a.questions), '5,288');
  assert.equal(formatCount(123456), '1,23,456');
});

test('every caller on the page shares one request, so one snapshot', async () => {
  forgetLandingStats();
  let requests = 0;
  const fetchImpl = async (url) => { requests += 1; assert.equal(url, '/api/stats'); return respond(SNAPSHOT)(); };
  const [stats, hero, band, again] = await Promise.all([
    loadLandingStats(fetchImpl),
    loadPractisedCounts(fetchImpl),
    loadPractisedCounts(fetchImpl),
    loadLandingStats(fetchImpl),
  ]);
  assert.equal(requests, 1);
  assert.equal(stats, again, 'the same response object');
  assert.deepEqual(hero, band);
  assert.deepEqual(hero, { questions: 5288, subjects: 15 });
  forgetLandingStats();
});

test('no answer gives no figure: unavailable, an error status or a failed request', async () => {
  for (const make of [respond({ state: 'unavailable' }), respond({ error: 'x' }, 503), async () => { throw new Error('offline'); }]) {
    forgetLandingStats();
    assert.equal(await loadPractisedCounts(make), null);
  }
  forgetLandingStats();
});

test('the hero line shows the whole figure at once and never counts up', () => {
  const hero = readFileSync(join(here, 'HeroLive.jsx'), 'utf8');
  assert.doesNotMatch(hero, /requestAnimationFrame|setInterval|setTimeout|performance\.now/, 'a count-up shows numbers that are not the count (it once showed a negative one)');
  assert.doesNotMatch(hero, /fetch\(/, 'the hero reads the page\'s shared request, not its own');
  assert.match(hero, /loadPractisedCounts/);
  assert.match(hero, /formatCount\(counts\.questions\)/);
});

test('no landing component counts the whole bank', () => {
  const offenders = [];
  for (const name of readdirSync(here).filter((file) => /\.(jsx|mjs|js)$/.test(file) && !/\.test\./.test(file))) {
    const source = readFileSync(join(here, name), 'utf8');
    if (/\bbankSize\b/.test(source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')) && name !== 'liveCount.mjs') offenders.push(`${name} reads bankSize`);
  }
  assert.deepEqual(offenders, []);
});
