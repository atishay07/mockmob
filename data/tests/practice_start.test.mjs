// L8 (15 Nov 2026): a device-held practice session started again with the same key keeps its first start's clock and paper
// (src/lib/server/practiceStart.js, wired in practiceSessions.js startPractice). On the in-memory Supabase client, which
// keeps learning_allowances' primary key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { claimPracticeStart, paperOf, releasePracticeStart, PRACTICE_START_KIND } from '../../src/lib/server/practiceStart.js';

const T0 = Date.parse('2026-11-15T10:00:00+05:30');
const paperA = paperOf([{ id: 'q1' }, { id: 'q2' }]);

test('the first start is recorded; a second start of the same session gets the first clock and paper back', async () => {
  const db = fakeDb({});
  const first = await claimPracticeStart(db, { userId: 'u1', id: 'att_practice_1', at: T0, paper: paperA });
  assert.deepEqual(first, { at: T0, paper: paperA, inserted: true });
  // 40 minutes later, no receipt: the network retry and the restart trick both get the first start, not a new hour.
  const again = await claimPracticeStart(db, { userId: 'u1', id: 'att_practice_1', at: T0 + 40 * 60_000, paper: paperOf([{ id: 'q9' }]) });
  assert.deepEqual(again, { at: T0, paper: paperA, inserted: false });
  assert.equal(db.tables.learning_allowances.length, 1);
  assert.equal(db.tables.learning_allowances[0].kind, PRACTICE_START_KIND);
  // Another student, or another session, is its own first start.
  assert.equal((await claimPracticeStart(db, { userId: 'u2', id: 'att_practice_1', at: T0 + 5, paper: paperA })).inserted, true);
  assert.equal((await claimPracticeStart(db, { userId: 'u1', id: 'att_practice_2', at: T0 + 5, paper: paperA })).inserted, true);
});

test('a start whose charge failed leaves no record; a database that cannot answer refuses the start', async () => {
  const db = fakeDb({});
  await claimPracticeStart(db, { userId: 'u1', id: 's1', at: T0, paper: paperA });
  await releasePracticeStart(db, { userId: 'u1', id: 's1' });
  assert.equal((await claimPracticeStart(db, { userId: 'u1', id: 's1', at: T0 + 60_000, paper: paperA })).at, T0 + 60_000);
  const down = fakeDb({});
  down.failures.learning_allowances = () => true;
  await assert.rejects(claimPracticeStart(down, { userId: 'u1', id: 's1', at: T0, paper: paperA }), /SESSION_CREATE_FAILED/);
});

test('startPractice: the claim comes before the row is built, a different paper is refused, a refused charge un-claims', () => {
  const src = readFileSync(new URL('../../src/lib/server/practiceSessions.js', import.meta.url), 'utf8');
  const claim = src.indexOf('await claimPracticeStart(db, { userId, id, at: created, paper })');
  assert.ok(claim > 0 && claim < src.indexOf('const row = { id, user_id: userId'), 'the clock is settled before the row');
  assert.match(src, /const paper = durableLearningEnabled\(\) \? null : paperOf\(questions\);/, 'device-held only; the durable row already does this');
  // Review of 15 Nov 2026: a rebuilt paper that differs is served with the first clock, never refused (one charge, one attempt).
  assert.doesNotMatch(src, /first\.paper !== paper\) throw/);
  assert.match(src, /if \(first\) created = first\.at;/);
  assert.match(src, /\} catch \(error\) \{ await unclaim\(\); throw error; \}/);
  assert.match(src, /await unclaim\(\);\r?\n\s+if \(firstFullMock === 'unknown'\)/, 'a refused free full mock un-claims too');
});
