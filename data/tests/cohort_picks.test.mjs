// How other students answered (data/cohort_picks.js; spec tmp/mistake-lab-v4/SPEC.md 4.3): the truth guards, the
// self-exclusion, shuffled papers, the gates in the builder, and the committed production snapshot's shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_DIR } from '../../scripts/mistake-lab/build-fixtures.mjs';
import { cohortForAttempt, optionHash, optionKeyText, ownFirstAnswers, loadCohortSnapshot, readCohort } from '../cohort_picks.js';
import { buildMistakeLab } from '../mistake_lab.js';
import { parseRows, buildSnapshot } from '../../scripts/cohort/build-question-picks.mjs';

const load = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'));
const SNAP = load('cohort_snapshot_sample');
const FULL = load('full_mock_input');
const NTA = load('nta_shuffled_input');
const clone = (v) => JSON.parse(JSON.stringify(v));
const read = (input, extra = {}) => cohortForAttempt({ attempt: input.attempt, allAttempts: [], answerReviews: input.answerReviews, snapshot: SNAP, ...extra });

test('optionHash is the SQL export\'s own hash: whitespace collapsed, trimmed, lower-cased, sha256, 16 hex', () => {
  // Real option texts whose hashes the database computed in the 15 Oct export (scripts/cohort/question_picks.sql).
  assert.equal(optionHash({ key: 'A', text: 'II and III only' }), '88ca6926e13d06ab');
  assert.equal(optionHash({ key: 'D', text: '340 meters' }), '1c4b454aeffbe9a1');
  assert.equal(optionHash('340 meters'), '1c4b454aeffbe9a1');
  assert.equal(optionHash('  340\n  Meters '), '1c4b454aeffbe9a1');
  assert.equal(optionKeyText({ label: ' A  b ' }), 'a b');
  assert.match(optionHash('x'), /^[0-9a-f]{16}$/);
});

test('a shuffled NTA paper maps every count to the option as it was served', () => {
  const r = read(NTA);
  for (const q of NTA.attempt.questionsSnapshot) {
    const entry = SNAP.questions[q.id];
    if (!entry) { assert.equal(r.byQid[q.id], undefined); continue; }
    const got = r.byQid[q.id];
    assert.ok(got, q.id);
    // Served position i shows stored option optionOrder[i]; the count there is that option's picks.
    q.options.forEach((text, i) => assert.equal(got.counts[i], entry.picks[optionHash(text)] || 0, `${q.id} served ${i}`));
    assert.equal(got.keyIndex, q.correctIndex);
    assert.equal(got.right, got.counts[q.correctIndex]);
    assert.equal(got.n, entry.n);
  }
  assert.ok(Object.keys(r.byQid).length >= 3);
});

test('self-exclusion: the student\'s own first answer, counted before the cutoff, is taken out once', () => {
  const base = read(FULL).byQid.q17;
  const earlier = { id: 'earlier', completedAt: Date.parse(SNAP.builtAt) - 86400000, questionsSnapshot: [FULL.attempt.questionsSnapshot[16]], details: [{ qid: 'q17', givenIndex: 3, isCorrect: true }] };
  const later = { ...clone(earlier), id: 'later', completedAt: Date.parse(SNAP.builtAt) + 1000, details: [{ qid: 'q17', givenIndex: 1, isCorrect: false }] };
  const withEarlier = cohortForAttempt({ attempt: FULL.attempt, allAttempts: [earlier, later], answerReviews: FULL.answerReviews, snapshot: SNAP }).byQid.q17;
  assert.equal(withEarlier.n, base.n - 1);
  assert.equal(withEarlier.counts[3], base.counts[3] - 1);
  assert.equal(withEarlier.right, base.right - 1);
  // An answer after the snapshot's cutoff was never counted, so nothing is taken out.
  const onlyLater = cohortForAttempt({ attempt: FULL.attempt, allAttempts: [later], answerReviews: FULL.answerReviews, snapshot: SNAP }).byQid.q17;
  assert.deepEqual(onlyLater, base);
  // The first answer is the earliest: a later different answer does not replace it.
  assert.equal(ownFirstAnswers([later, earlier], Infinity).get('q17'), optionHash(FULL.attempt.questionsSnapshot[16].options[3]));
});

test('guards: any answer review, a moved key, an edited option and duplicate options each drop the question', () => {
  assert.ok(read(FULL).byQid.q17);
  assert.equal(read(FULL, { answerReviews: { q17: { state: 'corrected' } } }).byQid.q17, undefined, 'any review');
  assert.equal(read(FULL, { answerReviews: { q17: { state: 'key_changed_verified' } } }).byQid.q17, undefined, 'any review state at all');
  const moved = clone(FULL.attempt);
  moved.questionsSnapshot[16].correctIndex = (moved.questionsSnapshot[16].correctIndex + 1) % 4;
  assert.equal(cohortForAttempt({ attempt: moved, snapshot: SNAP }).byQid.q17, undefined, 'key moved');
  const edited = clone(FULL.attempt);
  edited.questionsSnapshot[16].options[1] = 'q17 statement two, corrected';
  assert.equal(cohortForAttempt({ attempt: edited, snapshot: SNAP }).byQid.q17, undefined, 'a counted option text is not on the paper');
  const dup = clone(FULL.attempt);
  dup.questionsSnapshot[0].options[2] = 'q1 statement one.'; // a different hash, the same text once normalised
  assert.equal(cohortForAttempt({ attempt: dup, snapshot: SNAP }).byQid.q1, undefined, 'two options read the same once normalised');
  assert.equal(cohortForAttempt({ attempt: FULL.attempt, snapshot: null }), null);
});

test('the builder\'s gates: nothing under 10, "A small group so far" from 10 to 19, "most got right" needs 20 and a Wilson low bound over 50%', () => {
  const qs = [0, 1, 2].map((i) => ({ id: `w${i}`, options: ['a', 'b', 'c', 'd'].map((o) => `${o}${i}`), correctIndex: 0 }));
  const attempt = { questionsSnapshot: qs, details: qs.map((q) => ({ qid: q.id, givenIndex: 1, isCorrect: false })), selectionMeta: {} };
  const cohort = (reads) => ({ since: '2026-04-21', until: '2026-10-15', byQid: Object.fromEntries(reads.map(([qid, counts]) => [qid, { n: counts.reduce((s, c) => s + c, 0), right: counts[0], counts, keyIndex: 0 }])) });
  // 15 of 20 right: Wilson low 53%, counted. 14 of 20: 48%, not. 19 of 19: under 20 students, not.
  const lab = buildMistakeLab({ attempt, cohort: cohort([['w0', [15, 3, 1, 1]], ['w1', [14, 4, 1, 1]], ['w2', [19, 0, 0, 0]]]) });
  assert.equal(lab.cohort.line, '1 question you lost was one most other students got right: Q1 (6 marks).');
  assert.equal(lab.byQuestion.w2.others.small, true);
  assert.match(lab.byQuestion.w2.others.line, /A small group so far\. No other student chose B\.$/);
  const few = buildMistakeLab({ attempt, cohort: cohort([['w0', [5, 2, 1, 1]]]) });
  assert.equal(few.byQuestion.w0.others, null);
  assert.equal(few.cohort.fine[0], 'No question in this paper has answers from 10 or more other students yet.');
  assert.equal(few.cohort.line, null);
  const one = buildMistakeLab({ attempt, cohort: cohort([['w0', [10, 1, 1, 1]]]) });
  assert.equal(one.cohort.fine[0], '1 of the 3 questions in this paper has answers from 10 or more other students.');
});

test('coverage counts only questions with 10 or more other students', () => {
  const r = read(FULL);
  assert.equal(r.coverage.total, 50);
  assert.equal(r.coverage.compared, Object.values(r.byQid).filter((x) => x.n >= 10).length);
  assert.equal(r.since, '2026-04-21');
  assert.equal(r.until, '2026-10-15');
});

test('the committed production snapshot: aggregates only, every question with 10 or more answers that add up', async () => {
  const snap = await loadCohortSnapshot();
  assert.ok(snap, 'data/cohort/question_picks.v1.json loads');
  assert.deepEqual(Object.keys(snap).sort(), ['builtAt', 'questions', 'since', 'source', 'until', 'version']);
  assert.equal(snap.version, 1);
  assert.ok(Date.parse(snap.builtAt) <= Date.now(), 'the cutoff is never in the future');
  const entries = Object.entries(snap.questions);
  assert.ok(entries.length > 100);
  for (const [qid, q] of entries) {
    assert.deepEqual(Object.keys(q).sort(), ['keyHash', 'n', 'picks'], qid);
    assert.ok(q.n >= 10, qid);
    assert.match(q.keyHash, /^[0-9a-f]{16}$/);
    assert.equal(Object.values(q.picks).reduce((s, c) => s + c, 0), q.n, qid);
    for (const h of Object.keys(q.picks)) assert.match(h, /^[0-9a-f]{16}$/);
  }
  assert.equal(snap.source.questions, entries.length);
  assert.equal(snap.source.answers, entries.reduce((s, [, q]) => s + q.n, 0));
  assert.doesNotMatch(JSON.stringify(snap), /user|email|"att_/i);
  // The route reader: a paper with none of the snapshot's questions gets an empty read, not an error.
  const r = await readCohort({ attempt: FULL.attempt, allAttempts: [], answerReviews: {} });
  assert.deepEqual(r.byQid, {});
});

test('the build script refuses a copying slip: a bad line, a wrong sum or a different md5', () => {
  const good = '0005bc1a-1c47-4f39-b846-d28da96685d1 10 aaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaa:7,bbbbbbbbbbbbbbbb:3';
  assert.equal(parseRows(good).questions['0005bc1a-1c47-4f39-b846-d28da96685d1'].n, 10);
  assert.throws(() => parseRows(good.replace(':7', ':6')), /add to 9/);
  assert.throws(() => parseRows(good.replace(' 10 ', ' 9 ')), /n under 10/);
  assert.throws(() => parseRows(good.replace('aaaaaaaaaaaaaaaa:', 'aaaa:')), /bad pick/);
  assert.throws(() => buildSnapshot({ text: good, cutoff: '2026-10-15T02:05:57Z', since: '2026-04-21', md5: '0'.repeat(32) }), /md5/);
  const snap = buildSnapshot({ text: good, cutoff: '2026-10-15T02:05:57Z', since: '2026-04-21' });
  assert.equal(snap.until, '2026-10-15');
  assert.equal(snap.builtAt, '2026-10-15T02:05:57.000Z');
});
