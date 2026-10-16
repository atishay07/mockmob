// The first timed mock line (data/first_timed_mock.js, src/lib/server/timedMock.js): when it shows, what it says, and
// that it is gone once the student has a timed paper. 16 Oct 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEST_MODES } from '../test_modes.js';
import { MOCK_MODES } from '../attempt_ledger.js';
import {
  TIMED_MOCK_MODES, FIRST_TIMED_SURFACES, FIRST_TIMED_COPY, shortestTimedPaper, firstTimedMockHref, firstTimedMockPrompt,
} from '../first_timed_mock.js';
import { timedMockFacts } from '../../src/lib/server/timedMock.js';
import { S3 } from '../../scripts/mistake-lab/build-s3-fixtures.mjs';

const NONE = { sessions: 4, mocks: 0, timedMocks: 0, subject: 'accountancy' };

test('the timed modes are the ones the Lab counts as mocks', () => {
  assert.deepEqual([...TIMED_MOCK_MODES], [...MOCK_MODES]);
});

test('the shortest timed paper is read from the modes, never typed', () => {
  assert.deepEqual(shortestTimedPaper(), { mode: 'full', minutes: Math.round(TEST_MODES.full.fixedDurationSec / 60), questions: TEST_MODES.full.fixedCount });
  const modes = {
    full: { id: 'full', fixedDurationSec: 3600, fixedCount: 50 },
    nta: { id: 'nta', fixedDurationSec: 2700, fixedCount: 40 },
    quick: { id: 'quick', durationPerQuestionSec: 60, countOptions: [5, 10] },
  };
  assert.deepEqual(shortestTimedPaper(modes), { mode: 'nta', minutes: 45, questions: 40 });
  assert.equal(shortestTimedPaper({ quick: modes.quick }), null);
  assert.equal(shortestTimedPaper(null), null);
  // A tie goes to the earlier mode: Full mock, which a free account can start.
  assert.equal(shortestTimedPaper({ full: { id: 'full', fixedDurationSec: 3600, fixedCount: 50 }, nta: { id: 'nta', fixedDurationSec: 3600, fixedCount: 50 } }).mode, 'full');
});

test('a student with sessions and no timed paper is shown the line on Today, a practice result and Radar', () => {
  for (const surface of FIRST_TIMED_SURFACES) {
    const p = firstTimedMockPrompt(NONE, { surface, resultMode: 'quick' });
    assert.ok(p, surface);
    assert.equal(p.surface, surface);
    assert.equal(p.variant, 'first');
    assert.equal(p.paper.minutes, 60);
    assert.equal(p.paper.questions, 50);
    assert.match(p.line, /50 questions in 60 minutes/, surface);
    assert.equal(p.key.label, FIRST_TIMED_COPY.key);
    assert.equal(p.key.href, '/dashboard?subject=accountancy&mode=full');
  }
});

test('the line says what a timed mock unlocks, in the owner\'s words, on every surface', () => {
  for (const surface of FIRST_TIMED_SURFACES) {
    const p = firstTimedMockPrompt(NONE, { surface, resultMode: 'smart' });
    assert.ok(p.line.startsWith('Your first timed mock unlocks how long you spend on each question and where changed answers cost marks.'), surface);
  }
});

test('it is gone once the student has a timed paper, however many other sessions there are', () => {
  for (const surface of FIRST_TIMED_SURFACES) {
    assert.equal(firstTimedMockPrompt({ sessions: 30, mocks: 3, timedMocks: 1, subject: 'english' }, { surface, resultMode: 'quick' }), null, surface);
    assert.equal(firstTimedMockPrompt({ sessions: 1, mocks: 1, timedMocks: 5, subject: null }, { surface, resultMode: 'quick' }), null, surface);
  }
});

test('unknown is never zero: missing, partial or malformed facts show nothing', () => {
  const bads = [null, undefined, {}, 'none', [], { sessions: 4 }, { sessions: 4, mocks: 0 }, { sessions: 4, mocks: 0, timedMocks: '0' },
    { sessions: 4, mocks: 0, timedMocks: -1 }, { sessions: 4, mocks: 0, timedMocks: 1.5 }, { sessions: NaN, mocks: 0, timedMocks: 0 }, { sessions: 4, mocks: null, timedMocks: 0 }];
  for (const bad of bads) {
    for (const surface of FIRST_TIMED_SURFACES) assert.equal(firstTimedMockPrompt(bad, { surface, resultMode: 'quick' }), null, `${JSON.stringify(bad)} ${surface}`);
  }
});

test('an unknown surface shows nothing', () => {
  assert.equal(firstTimedMockPrompt(NONE, { surface: 'dashboard' }), null);
  assert.equal(firstTimedMockPrompt(NONE, {}), null);
  assert.equal(firstTimedMockPrompt(NONE), null);
});

test('Today waits for a first saved session; the result and Radar do not', () => {
  const fresh = { sessions: 0, mocks: 0, timedMocks: 0, subject: null };
  assert.equal(firstTimedMockPrompt(fresh, { surface: 'today' }), null);
  assert.ok(firstTimedMockPrompt(fresh, { surface: 'radar' }));
  assert.ok(firstTimedMockPrompt(fresh, { surface: 'result', resultMode: 'quick' }));
});

test('a timed mock\'s own result never carries it (that page has its own older-paper line)', () => {
  for (const mode of TIMED_MOCK_MODES) assert.equal(firstTimedMockPrompt(NONE, { surface: 'result', resultMode: mode }), null, mode);
  for (const mode of ['quick', 'smart', null, undefined]) assert.ok(firstTimedMockPrompt(NONE, { surface: 'result', resultMode: mode }), String(mode));
});

test('a student whose earlier mock has no clock record is not told it is their first', () => {
  const p = firstTimedMockPrompt({ sessions: 9, mocks: 2, timedMocks: 0, subject: 'economics' }, { surface: 'today' });
  assert.equal(p.variant, 'again');
  assert.doesNotMatch(p.line, /first/i);
  assert.match(p.line, /saved without a clock record/);
  assert.match(p.line, /50 questions in 60 minutes/);
});

test('the key opens the practice setup with the full mock chosen; an odd subject is dropped, never put in the address', () => {
  assert.equal(firstTimedMockHref('business_studies'), '/dashboard?subject=business_studies&mode=full');
  assert.equal(firstTimedMockHref(null), '/dashboard?mode=full');
  for (const bad of ['', 'Accountancy; drop', 'a b', '../x', 'x'.repeat(41), 7, {}]) assert.equal(firstTimedMockHref(bad), '/dashboard?mode=full', String(bad));
  const p = firstTimedMockPrompt({ ...NONE, subject: '../evil' }, { surface: 'today' });
  assert.equal(p.key.href, '/dashboard?mode=full');
});

test('the words carry no streak, deadline, price pressure, hype or arrows', () => {
  const words = [FIRST_TIMED_COPY.first(FIRST_TIMED_COPY.unlocks), FIRST_TIMED_COPY.again(FIRST_TIMED_COPY.unlocks), FIRST_TIMED_COPY.paper({ questions: 50, minutes: 60 }), FIRST_TIMED_COPY.key].join(' ');
  assert.doesNotMatch(words, /streak|today only|hurry|last chance|limited|don.t miss|only \d+ left|!|→|—|%/i);
});

// ---------- the server's count ----------

// A small stand-in for the Supabase client: the filters the facts read, over rows shaped like the attempts table.
function fakeDb(attempts, { failOn = null } = {}) {
  const rows = attempts.map((a) => ({ id: a.id, user_id: a.userId || S3.USER, subject: a.subject, completed_at: a.completedAt, selection_meta: a.selectionMeta, questions_snapshot: a.questionsSnapshot }));
  const pick = (row, path) => {
    const [col, ...keys] = path.replace(/->>/g, '->').split('->');
    return keys.reduce((v, k) => (v == null ? v : v[k]), row[col]);
  };
  return {
    from(table) {
      assert.equal(table, 'attempts');
      const q = { cols: '', head: false, filters: [], sort: null, max: Infinity };
      const run = () => {
        if (failOn && q.cols.includes(failOn)) return { data: null, error: { message: 'boom' }, count: null };
        let list = rows.filter((r) => q.filters.every((f) => f(r)));
        if (q.sort) list = [...list].sort((a, b) => b.completed_at - a.completed_at);
        const count = list.length;
        list = list.slice(0, q.max);
        if (q.head) return { data: null, error: null, count };
        const alias = q.cols.match(/(\w+):(\S+)/);
        const data = list.map((r) => {
          if (alias) return { id: r.id, [alias[1]]: pick(r, alias[2]) };
          if (q.cols === 'subject') return { subject: r.subject };
          return { id: r.id, selection_meta: r.selection_meta, questions_snapshot: r.questions_snapshot };
        });
        return { data, error: null, count };
      };
      const api = {
        select(cols, opts) { q.cols = cols; q.head = Boolean(opts?.head); return api; },
        eq(col, v) { q.filters.push((r) => (col === 'user_id' ? r.user_id === v : pick(r, col) === v)); return api; },
        in(col, vs) { q.filters.push((r) => vs.includes(col === 'id' ? r.id : pick(r, col))); return api; },
        order() { q.sort = true; return api; },
        limit(n) { q.max = n; return api; },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return api;
    },
  };
}

test('the count is the Lab\'s own: Full or NTA with a readable clock; a practice clock does not count', async () => {
  const { M1, M2, PRACTICE } = S3;
  // A mock with no device clock at all (an older record).
  const noClock = { ...M2, id: 'old', subject: 'economics', completedAt: PRACTICE.completedAt + 1000, selectionMeta: { ...M2.selectionMeta, recovery: { ...M2.selectionMeta.recovery, telemetry: undefined, timeline: [] } } };
  assert.deepEqual(await timedMockFacts(S3.USER, fakeDb([PRACTICE])), { sessions: 1, mocks: 0, timedMocks: 0, subject: PRACTICE.subject });
  assert.deepEqual(await timedMockFacts(S3.USER, fakeDb([PRACTICE, noClock])), { sessions: 2, mocks: 1, timedMocks: 0, subject: 'economics' }); // the newest session names the subject
  const facts = await timedMockFacts(S3.USER, fakeDb([PRACTICE, noClock, M1]));
  assert.equal(facts.sessions, 3);
  assert.equal(facts.mocks, 2);
  assert.equal(facts.timedMocks, 1);
  assert.equal(firstTimedMockPrompt(facts, { surface: 'today' }), null, 'gone once a timed paper is read');
  assert.ok(firstTimedMockPrompt(await timedMockFacts(S3.USER, fakeDb([PRACTICE, noClock])), { surface: 'today' }), 'still shown with only a clockless mock');
});

test('a device record that did not match the answers is not a timed paper', async () => {
  const bad = { ...S3.M1, id: 'bad', selectionMeta: { ...S3.M1.selectionMeta, recovery: { ...S3.M1.selectionMeta.recovery, telemetry: 'inconsistent', timeline: [] } } };
  assert.equal((await timedMockFacts(S3.USER, fakeDb([bad]))).timedMocks, 0);
});

test('a failed read throws, so the page shows nothing instead of a wrong zero', async () => {
  for (const failOn of ['id', 'subject', 'tel:']) {
    await assert.rejects(timedMockFacts(S3.USER, fakeDb([S3.PRACTICE], { failOn })), /TIMED_MOCK_UNAVAILABLE/, failOn);
  }
  await assert.rejects(timedMockFacts('', fakeDb([])), /attempt_owner_required/);
});
