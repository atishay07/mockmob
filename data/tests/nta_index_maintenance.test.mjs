// Keeping nta_question_index current (Q8b): the daily safety rebuild's reasons (new question, edited content,
// age), its idempotency and deadline, one rebuild at a time per subject, the throttled touch queue the factory
// paths use, the log line, and that every publish path is wired to a rebuild. No network: the database is the
// in-memory fake shared with nta_index_fresh.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createNtaIndexTouchQueue, describeNtaIndexRun, flushNtaIndexRebuilds, noteNtaIndexPublish, ntaIndexDrift,
  rebuildNtaIndexSubject, refreshStaleNtaIndexes,
} from '../nta_index.js';
import { FIXTURE_SECRET, makeBank } from './ntaEngineFixtures.mjs';
import { BUILT, OLD, PRODUCTION, fakeDb, indexRows, setup, sideTables } from './ntaIndexFakeDb.mjs';

const CLOCK = Date.parse('2026-10-14T12:00:00.000Z'); // a day after BUILT
const DAY = 24 * 60 * 60 * 1000;
const evidenceReads = (db) => db.calls.filter(([kind, table, columns]) => kind === 'select' && table === 'questions' && String(columns).includes('evidence'));
// A real rebuild whose build time is the test clock, so ages and freshness are coherent.
const rebuildAt = (ms) => (client, subject, options) => rebuildNtaIndexSubject(client, subject, { ...options, now: new Date(ms) });
const upsertCalls = (db) => db.calls.filter(([kind]) => kind === 'upsert' || kind === 'delete');

test('an edited question (same created_at, new content) makes the daily run rebuild its subject, drop the row that no longer verifies, and be quiet afterwards', async () => {
  const { questions, indexed } = setup({ published: OLD });
  const db = fakeDb({ questions: questions.map((row) => ({ ...row })), nta_question_index: indexRows(indexed, 'chemistry'), ...sideTables });
  const options = { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], now: () => CLOCK, rebuild: rebuildAt(CLOCK) };
  const quiet = await refreshStaleNtaIndexes(db, options);
  assert.equal(quiet.subjects[0].skipped, 'fresh', 'untouched content costs no rebuild');
  assert.equal(evidenceReads(db).length, 0, 'the check never read the evidence column');
  // Someone corrects a stem after the build. created_at and live_at do not move, so only the hash can tell.
  const edited = db.tables.questions.find((row) => row.id === indexed[0].id);
  edited.body = `${edited.body} (corrected)`;
  const drift = await ntaIndexDrift(db, 'chemistry');
  assert.deepEqual(drift.drifted, [edited.id]);
  assert.equal(drift.checked, indexed.length);
  const out = await refreshStaleNtaIndexes(db, options);
  assert.equal(out.subjects[0].reason, 'content_changed');
  assert.equal(out.subjects[0].driftedQuestions, 1);
  // The edit voids the question's evidence (it was scored on other text), so the rebuild drops its row: until it is
  // re-verified it stays out of NTA papers on both read paths, and the index no longer holds a row that cannot verify.
  assert.equal(out.subjects[0].removed, 1);
  assert.equal(db.tables.nta_question_index.some((row) => row.question_id === edited.id), false);
  assert.equal(out.subjects[0].indexed, questions.length - 1, 'every other question, the one never indexed included');
  assert.equal((await refreshStaleNtaIndexes(db, { ...options, now: () => CLOCK + 1000 })).subjects[0].skipped, 'fresh');
  assert.deepEqual((await ntaIndexDrift(db, 'chemistry')).drifted, []);
});

test('a question whose passage lives in its passage group is not mistaken for an edit (the build hashed it with the passage attached)', async () => {
  const bank = makeBank('english').map((row) => ({ ...row, created_at: OLD, live_at: OLD }));
  const child = bank.find((row) => row.passage_group_id && row.passage_text);
  assert.ok(child, 'the fixture bank has passage questions');
  // Passage text only in the group, as in production for passage children.
  const questions = bank.map((row) => (row === child ? { ...row, passage_text: null } : row));
  const group = { id: child.passage_group_id, title: 't', passage_text: child.passage_text, passage_type: 'rc', status: 'live', discoverable: true };
  const db = fakeDb({ questions, nta_question_index: [], ...sideTables, passage_groups: [group] });
  const built = await rebuildNtaIndexSubject(db, 'english', { secret: FIXTURE_SECRET, now: new Date(CLOCK) });
  assert.ok(built.indexed > 0);
  assert.deepEqual((await ntaIndexDrift(db, 'english')).drifted, []);
  const out = await refreshStaleNtaIndexes(db, { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['english'], now: () => CLOCK + 1000 });
  assert.equal(out.subjects[0].skipped, 'fresh');
});

test('an index older than a week is rebuilt, oldest first, and a spent deadline leaves the newer one for tomorrow', async () => {
  const bank = (subject) => makeBank(subject).slice(0, 5).map((row) => ({ ...row, created_at: OLD, live_at: OLD }));
  const [physics, history] = [bank('physics'), bank('history')];
  const index = [...indexRows(physics, 'physics', '2026-10-01T00:00:00.000Z'), ...indexRows(history, 'history', '2026-10-05T00:00:00.000Z')];
  const tables = () => ({ questions: [...physics, ...history], nta_question_index: index.map((row) => ({ ...row })), ...sideTables });
  const now = Date.parse('2026-10-14T00:00:00.000Z'); // physics index is 13 days old, history 9 days old
  const order = [];
  const rebuild = async (client, subject, options) => { order.push(subject); return rebuildNtaIndexSubject(client, subject, { ...options, now: new Date(now) }); };
  const out = await refreshStaleNtaIndexes(fakeDb(tables()), { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['history', 'physics'], rebuild, now: () => now });
  assert.deepEqual(order, ['physics', 'history'], 'oldest first');
  assert.deepEqual(out.subjects.map((entry) => entry.reason), ['max_age', 'max_age']);
  // A clock that runs out after the first subject: the newer index waits for the next day.
  let reads = 0;
  const limited = await refreshStaleNtaIndexes(fakeDb(tables()), {
    secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['history', 'physics'], deadlineMs: 240000,
    // The first reads (start, then per-subject checks) happen at the starting time; after the first rebuild the clock is far ahead.
    now: () => now + (reads++ > 2 ? 300000 : 0),
  });
  assert.deepEqual(limited.subjects.map((entry) => [entry.subject, entry.reason || entry.skipped]), [['physics', 'max_age'], ['history', 'out_of_time']]);
  // Seven days is the line: a younger index is left alone.
  const young = await refreshStaleNtaIndexes(fakeDb(tables()), { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['history'], now: () => Date.parse('2026-10-10T00:00:00.000Z') });
  assert.deepEqual(young.subjects.map((entry) => entry.skipped), ['fresh']);
});

test('a forced run (maxAgeMs below zero) rebuilds every built subject, and a repeat writes the same rows', async () => {
  const { questions, indexed } = setup({ published: OLD });
  const db = fakeDb({ questions, nta_question_index: indexRows(indexed, 'chemistry'), ...sideTables });
  const run = (at) => refreshStaleNtaIndexes(db, { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], maxAgeMs: -1, now: () => at, rebuild: rebuildAt(at) });
  const out = await run(CLOCK);
  assert.equal(out.subjects[0].reason, 'max_age');
  assert.equal(db.tables.nta_question_index.length, questions.length);
  const stable = () => db.tables.nta_question_index.map(({ verified_at, signature, ...rest }) => rest).sort((a, b) => a.question_id.localeCompare(b.question_id));
  const rowsAfter = stable();
  const again = await run(CLOCK + 1000);
  assert.equal(again.subjects[0].removed, 0);
  assert.deepEqual(stable(), rowsAfter, 'a repeat writes the same rows (the signature covers verified_at, so only it and verified_at differ)');
});

test('two rebuilds of one subject at once: the second waits for the first and runs once more, so it sees what was published meanwhile; later callers share that run', async () => {
  const { questions } = setup({ published: OLD });
  const late = questions[questions.length - 1];
  const db = fakeDb({ questions: questions.slice(0, -1).map((row) => ({ ...row })), nta_question_index: [], ...sideTables });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  // The first rebuild has read the subject and is about to write; its write waits on the gate.
  let held = false;
  const slowDb = {
    ...db,
    from(table) {
      const query = db.from(table);
      if (table === 'nta_question_index') {
        const upsert = query.upsert.bind(query);
        query.upsert = (rows) => {
          const out = upsert(rows);
          if (!held) {
            held = true;
            const run = out.then.bind(out);
            out.then = (resolve, reject) => gate.then(() => run(resolve, reject));
          }
          return out;
        };
      }
      return query;
    },
  };
  const options = { secret: FIXTURE_SECRET, now: new Date(CLOCK) };
  const first = rebuildNtaIndexSubject(slowDb, 'chemistry', options);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(held, true, 'the first rebuild reached its write');
  // A question is published after the first build read the subject.
  db.tables.questions.push({ ...late });
  const second = rebuildNtaIndexSubject(slowDb, 'chemistry', options);
  const third = rebuildNtaIndexSubject(slowDb, 'chemistry', options);
  assert.equal(second, third, 'callers during the same wait share one follow-up');
  release();
  const [one, two] = await Promise.all([first, second]);
  assert.notEqual(one, two, 'the second caller does not get the first (stale) result');
  assert.equal(one.indexed, questions.length - 1);
  assert.equal(two.indexed, questions.length, 'the follow-up read sees the question published meanwhile');
  assert.ok(db.tables.nta_question_index.some((row) => row.question_id === late.id));
  // Nothing stays in flight: the next call starts a plain new build.
  const later = rebuildNtaIndexSubject(db, 'chemistry', { ...options, now: new Date(CLOCK + DAY) });
  assert.notEqual(later, second);
  await later;
});

test('a failed rebuild does not wedge the subject: the next call runs', async () => {
  const { questions, indexed } = setup({ published: OLD });
  const db = fakeDb({ questions, nta_question_index: indexRows(indexed, 'chemistry'), ...sideTables }, { failOn: (table, op) => table === 'nta_question_index' && op === 'upsert' });
  await assert.rejects(rebuildNtaIndexSubject(db, 'chemistry', { secret: FIXTURE_SECRET, now: new Date(CLOCK) }));
  const healthy = fakeDb({ questions, nta_question_index: indexRows(indexed, 'chemistry'), ...sideTables });
  const result = await rebuildNtaIndexSubject(healthy, 'chemistry', { secret: FIXTURE_SECRET, now: new Date(CLOCK) });
  assert.ok(result.indexed > 0);
});

test('the touch queue rebuilds a subject at most once per interval, at once when forced, retries a failure, and never throws', async () => {
  const calls = [];
  let clock = 0;
  const lines = [];
  const outcomes = [];
  const queue = createNtaIndexTouchQueue({
    getSecret: () => 'k', minIntervalMs: 1000, now: () => clock, log: (line) => lines.push(line),
    rebuild: async (db, subjects, options) => {
      calls.push({ db: db.name, subjects, secret: options.secret });
      return outcomes.shift() || { status: 'rebuilt', subjects: subjects.map((subject) => ({ subject, indexed: 1 })) };
    },
  });
  const dbA = { name: 'a' };
  queue.touch(dbA, ['chemistry', 'chemistry', 'physics']);
  assert.deepEqual(queue.pendingSubjects().sort(), ['chemistry', 'physics']);
  assert.equal((await queue.flush()).status, 'rebuilt');
  assert.deepEqual(calls, [{ db: 'a', subjects: ['chemistry', 'physics'], secret: 'k' }]);
  assert.deepEqual(queue.pendingSubjects(), []);
  // Another publish 10 ms later: noted, not rebuilt until the interval has passed.
  clock = 10;
  queue.touch(dbA, ['chemistry']);
  assert.equal((await queue.flush()).status, 'nothing_to_do');
  assert.equal(calls.length, 1);
  assert.deepEqual(queue.pendingSubjects(), ['chemistry']);
  // A forced flush (end of a batch) ignores the interval.
  assert.equal((await queue.flush({ force: true })).status, 'rebuilt');
  assert.equal(calls.length, 2);
  // A subject that was never rebuilt in this process is due at once.
  clock = 20;
  queue.touch(dbA, ['history']);
  assert.equal((await queue.flush()).status, 'rebuilt');
  assert.deepEqual(calls[2].subjects, ['history']);
  // A failed rebuild stays pending and is retried at the next due flush.
  clock = 5000;
  queue.touch(dbA, ['physics']);
  outcomes.push({ status: 'failed', subjects: [{ subject: 'physics', error: 'boom' }] });
  assert.equal((await queue.flush()).status, 'failed');
  assert.deepEqual(queue.pendingSubjects(), ['physics']);
  clock = 5100;
  assert.equal((await queue.flush()).status, 'nothing_to_do', 'not retried before the interval');
  clock = 7000;
  assert.equal((await queue.flush()).status, 'rebuilt');
  assert.deepEqual(queue.pendingSubjects(), []);
  // A skip (no key, no table) clears the subject: the pool falls back to the full read and the daily run covers the rest.
  clock = 9000;
  queue.touch(dbA, ['gat']);
  outcomes.push({ status: 'skipped', reason: 'no_signing_key', subjects: [{ subject: 'gat', skipped: 'no_signing_key' }] });
  await queue.flush();
  assert.deepEqual(queue.pendingSubjects(), []);
  // A rebuild that throws is reported, not raised.
  clock = 20000;
  queue.touch(dbA, ['economics']);
  const throwing = createNtaIndexTouchQueue({ getSecret: () => 'k', log: (line) => lines.push(line), rebuild: async () => { throw new Error('network down'); } });
  throwing.touch(dbA, ['economics']);
  const result = await throwing.flush({ force: true });
  assert.equal(result.status, 'failed');
  assert.deepEqual(throwing.pendingSubjects(), ['economics']);
  // Switched off: nothing is rebuilt and nothing waits.
  const off = createNtaIndexTouchQueue({ enabled: () => false, rebuild: async () => { throw new Error('must not run'); } });
  off.touch(dbA, ['chemistry']);
  assert.deepEqual(await off.flush({ force: true }), { status: 'skipped', reason: 'disabled', subjects: [] });
  assert.deepEqual(off.pendingSubjects(), []);
  // Unknown subject ids and a missing database are ignored.
  const quiet = createNtaIndexTouchQueue({ rebuild: async () => ({ status: 'rebuilt', subjects: [] }) });
  quiet.touch(null, ['chemistry']);
  quiet.touch(dbA, [undefined, '']);
  assert.deepEqual(quiet.pendingSubjects(), []);
});

test('the default queue the factory paths call: a publish is noted and rebuilt through the signing key in the environment, and a forced flush covers the throttle', async () => {
  const previous = { key: process.env.CUET_EVIDENCE_SIGNING_KEY, off: process.env.NTA_INDEX_REBUILD };
  process.env.CUET_EVIDENCE_SIGNING_KEY = FIXTURE_SECRET;
  delete process.env.NTA_INDEX_REBUILD;
  try {
    const { questions, indexed } = setup({ published: OLD });
    const db = fakeDb({ questions, nta_question_index: indexRows(indexed, 'chemistry'), ...sideTables });
    const first = await noteNtaIndexPublish(db, ['chemistry']);
    assert.equal(first.status, 'rebuilt');
    assert.equal(db.tables.nta_question_index.length, indexed.length + 1, 'the question that was missing from the index is in it');
    // Inside the interval a second publish only notes the subject...
    const second = await noteNtaIndexPublish(db, ['chemistry']);
    assert.equal(second.status, 'nothing_to_do');
    // ...and the end-of-batch flush rebuilds it now.
    const writesBefore = upsertCalls(db).length;
    const flushed = await flushNtaIndexRebuilds();
    assert.equal(flushed.status, 'rebuilt');
    assert.ok(upsertCalls(db).length > writesBefore);
    assert.equal((await flushNtaIndexRebuilds()).status, 'nothing_to_do');
    // NTA_INDEX_REBUILD=off: the paths publish as before and the index is not touched.
    process.env.NTA_INDEX_REBUILD = 'off';
    const quiet = fakeDb({ questions, nta_question_index: indexRows(indexed, 'chemistry'), ...sideTables });
    assert.equal((await noteNtaIndexPublish(quiet, ['chemistry'])).reason, 'disabled');
    assert.equal(quiet.calls.length, 0);
  } finally {
    if (previous.key === undefined) delete process.env.CUET_EVIDENCE_SIGNING_KEY; else process.env.CUET_EVIDENCE_SIGNING_KEY = previous.key;
    if (previous.off === undefined) delete process.env.NTA_INDEX_REBUILD; else process.env.NTA_INDEX_REBUILD = previous.off;
  }
});

test('the log line says what the run did, per reason, with counts and subject ids only', () => {
  const result = {
    status: 'partial',
    rebuilt: 2,
    subjects: [
      { subject: 'chemistry', written: 41, indexed: 41, reason: 'newer_questions' },
      { subject: 'physics', written: 38, indexed: 38, reason: 'content_changed' },
      { subject: 'history', skipped: 'fresh' },
      { subject: 'gat', skipped: 'never_built' },
      { subject: 'economics', skipped: 'out_of_time' },
      { subject: 'english', error: 'write refused' },
    ],
  };
  const line = describeNtaIndexRun(result, { ms: 1234 });
  assert.equal(line, '[nta-index] daily refresh partial in 1234 ms: rebuilt 2 (chemistry newer_questions 41 rows, physics content_changed 38 rows), fresh 1, never built 1, left for tomorrow 1 (economics), FAILED 1 (english: write refused)');
  assert.equal(describeNtaIndexRun({ status: 'skipped', reason: 'no_signing_key', subjects: [] }, { ms: 3 }), '[nta-index] daily refresh skipped in 3 ms: no_signing_key');
  assert.equal(describeNtaIndexRun({ status: 'ok', rebuilt: 0, subjects: [{ subject: 'history', skipped: 'fresh' }] }), '[nta-index] daily refresh ok: rebuilt 0, fresh 1');
});

// Every way a question becomes visible to the NTA pool, or changes in a way the content-hash check can see,
// must lead to a rebuild of its subject. The behaviour of each hook is tested where the code can be loaded
// (authored_publish.test.mjs, question_reorder.test.mjs, the queue above); this pins that none was left out.
test('every publish path calls the rebuild', () => {
  const source = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  const hookAfter = (text, anchor, hook) => {
    const at = text.indexOf(anchor);
    assert.ok(at >= 0, `anchor: ${anchor}`);
    assert.ok(text.indexOf(hook, at) > at, `${hook} comes after ${anchor}`);
  };
  // The worker and the offline import: one question at a time, noted after the insert succeeded.
  hookAfter(source('scripts/pipeline/lib/publish.mjs'), "console.log(`✅ Published", 'noteNtaIndexPublish(supabase, [questionInsert.subject])');
  // The factory (the RPC publishes a question or a whole passage group): noted after the RPC succeeded.
  const core = source('scripts/pipeline/lib/factoryCore.mjs');
  hookAfter(core, "p_job:jobId", 'noteNtaIndexPublish(db,[row.subject])');
  hookAfter(core, "p_jobs:questions.map", 'noteNtaIndexPublish(db,[group.subject])');
  // Batch ends flush at once.
  assert.match(source('scripts/pipeline/factory.mjs'), /flushNtaIndexRebuilds\(\)/);
  assert.match(source('scripts/pipeline/tools/publishProductionCohort.mjs'), /flushNtaIndexRebuilds\(\)/);
  assert.match(source('scripts/pipeline/lib/offlineBatchFactory.mjs'), /flushNtaIndexRebuilds\(\)/);
  // The owner's scripts that change what is live or what a live question says.
  assert.match(source('scripts/question-publish-authored.mjs'), /rebuildNtaIndexForSubjects/);
  assert.match(source('scripts/question-republish.mjs'), /rebuildNtaIndexForSubjects\(sb, \[\.\.\.touched\]/);
  assert.match(source('scripts/question-reorder.mjs'), /rebuildNtaIndexForSubjects\(sb, touchedSubjects/);
  assert.match(source('scripts/question-hold.mjs'), /rebuildNtaIndexForSubjects\(sb, \[\.\.\.touched\]/);
  // The website's routes publish nothing the index can hold: the moderation pass and uploads work on questions
  // without signed evidence and do not set status live, and the factory admin route only flips pause/phase flags.
  for (const file of ['src/app/api/internal/moderation/process/route.js', 'src/app/api/questions/upload/route.js', 'src/app/api/admin/question-factory/route.js']) {
    assert.doesNotMatch(source(file), /status:\s*['"]live['"]/, `${file} must not publish a live question; if it starts to, it needs a rebuild`);
  }
});
