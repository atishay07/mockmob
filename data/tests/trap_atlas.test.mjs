// The trap atlas, the trap tag, the key-quality loop and Traps you meet (data/trap_atlas.js, src/lib/server/trapAtlas.js,
// src/lib/server/keyQuality.js; spec tmp/mistake-lab-v4/SPEC.md 4.7, 4.11, "Slice 4").
// Fixtures: scripts/mistake-lab/build-s4-fixtures.mjs  (regenerate with: node scripts/mistake-lab/build-s4-fixtures.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  atlasRecordFor, indexAtlas, cleanAtlasRow, questionFormat, formatTrapFor, keyQualityFlag, keyQualityFlags, buildTrapTags,
  buildTrapsMeet, trapStatus, trapForOption, trapOptions, TRAP_RULES, TRAPS_VERSION, bothTrueLink,
} from '../trap_atlas.js';
import { optionHash as pureHash, sha256Hex } from '../option_hash.js';
import { optionHash as nodeHash } from '../cohort_picks.js';
import { createHash } from 'node:crypto';
import { LAB_COPY } from '../mistake_lab.js';
import { buildLabSlice4 } from '../lab_loop.js';
import { resultHistory } from '../mock_swot.js';
import { buildMissedBefore } from '../../src/components/recovery/repairRun.js';
import { runRepair } from '../../src/services/recovery/repairFlow.js';
import { readAtlasRows, recordTrap, atlasForAttempt, doubtedQuestionIds } from '../../src/lib/server/trapAtlas.js';
import { recheckFlaggedKey } from '../../src/lib/server/keyQuality.js';
import { fakeDb } from '../../scripts/mistake-lab/fake-db.mjs';
import { buildS4, buildPaperContracts, buildSheetContracts, labPaper, labAtlasRows, labCohort, sheetInputs, T0 } from '../../scripts/mistake-lab/build-s4-fixtures.mjs';
import { FIXTURE_DIR } from '../../scripts/mistake-lab/build-fixtures.mjs';

const load = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'));
const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out)); return out; };
const q = (id, options, key, extra = {}) => ({ id, question: `Stem of ${id}`, options, correctIndex: key, ...extra });
const FOUR = (id) => [`${id} a`, `${id} b`, `${id} c`, `${id} d`];
const AR = ['Both A and R are true and R is the correct explanation of A.', 'Both A and R are true but R is not the correct explanation of A.', 'A is true but R is false.', 'A is false but R is true.'];

test('the contracts on disk equal what the code builds today', async () => {
  const { contracts } = await buildS4();
  for (const name of ['contract_traps_v1', 'contract_later_v1']) assert.deepEqual(load(name), JSON.parse(JSON.stringify(contracts[name])), name);
});

test('the option hash in the pure module is the cohort snapshot hash, and sha256 is right', () => {
  const samples = ['', 'a', 'Both A and R are true', '  Mixed   CASE\ttext ', 'नमस्ते दुनिया', 'x'.repeat(200), 'é 😀 ok', 'y'.repeat(55), 'y'.repeat(56), 'y'.repeat(64), { text: 'Object form' }];
  for (const s of samples) assert.equal(pureHash(s), nodeHash(s), JSON.stringify(s).slice(0, 30));
  for (const s of ['abc', '', 'z'.repeat(1000)]) assert.equal(sha256Hex(s), createHash('sha256').update(s).digest('hex'));
});

test('a v3 repair writes its trap on the option the student chose; "other", a missing type or the key itself write nothing', () => {
  const question = q('a1', FOUR('a1'), 2);
  const rec = atlasRecordFor({ question, chosenIndex: 1, keyIndex: 2, trapType: 'look_alike_term' });
  assert.deepEqual(rec, { qid: 'a1', optionHash: pureHash('a1 b'), trapType: 'look_alike_term' });
  for (const bad of [{ trapType: 'other' }, { trapType: 'made_up' }, { trapType: undefined }, { chosenIndex: 2 }, { chosenIndex: 9 }, { chosenIndex: -1 }, { keyIndex: 7 }]) {
    assert.equal(atlasRecordFor({ question, chosenIndex: 1, keyIndex: 2, trapType: 'reversed', ...bad }), null, JSON.stringify(bad));
  }
  const twin = q('a2', ['same', 'same ', 'c', 'd'], 0);
  assert.equal(atlasRecordFor({ question: twin, chosenIndex: 1, keyIndex: 0, trapType: 'reversed' }), null, 'an option that reads as the key is no trap');
});

test('a row shows only while every repair of that option agrees', () => {
  const base = { qid: 'x', option_hash: 'a'.repeat(16), trap_type: 'reversed', repairs_agreeing: 2, repairs_disagreeing: 0 };
  assert.equal(cleanAtlasRow(base), true);
  assert.equal(cleanAtlasRow({ ...base, repairs_disagreeing: 1 }), false);
  assert.equal(cleanAtlasRow({ ...base, trap_type: 'other' }), false);
  assert.equal(cleanAtlasRow({ ...base, repairs_agreeing: 0 }), false);
  assert.equal(cleanAtlasRow(null), false);
  const idx = indexAtlas([base, { ...base, qid: 'y', repairs_disagreeing: 2 }, { qid: 3 }, null]);
  assert.deepEqual([...idx.keys()], ['x']);
});

test('the trap is found by option text: a shuffled NTA paper reads the same row and tags the served letter', () => {
  const stored = q('s1', ['Debit the asset', 'Credit the asset', 'Debit the capital', 'Credit the capital'], 1);
  const order = [2, 0, 3, 1]; // served position -> stored option
  const served = { ...stored, options: order.map((i) => stored.options[i]), correctIndex: order.indexOf(1) };
  const atlas = indexAtlas([{ qid: 's1', option_hash: pureHash('Debit the capital'), trap_type: 'wrong_rule', repairs_agreeing: 1, repairs_disagreeing: 0 }]);
  for (const [paper, pick, letter] of [[stored, 2, 'C'], [served, 0, 'A']]) {
    const attempt = { questionsSnapshot: [paper], details: [{ qid: 's1', givenIndex: pick, isCorrect: false }] };
    const tags = buildTrapTags({ attempt, atlas })?.tags;
    assert.equal(tags.s1.letter, letter);
    assert.equal(tags.s1.trapType, 'wrong_rule');
    assert.equal(tags.s1.text, 'Trap: the wrong rule applied');
    assert.equal(tags.s1.sourceText, 'Named by Mistake Repair');
  }
});

test('assertion-reason: only a link-only difference makes the format trap; the sentence is the spec\'s', () => {
  const question = q('ar', AR, 0, { questionType: 'assertion_reason' });
  assert.equal(questionFormat(question), 'assertion_reason');
  assert.deepEqual(formatTrapFor(question, 1), { trapType: 'assertion_reason_link', detail: 'This option and the key agree on both statements; only the link differs.', format: 'assertion_reason' });
  assert.equal(formatTrapFor(question, 2), null, 'a different truth value is not a link difference');
  assert.equal(formatTrapFor(question, 3), null);
  assert.equal(formatTrapFor(question, 0), null, 'the key is no trap');
  assert.equal(bothTrueLink(AR[0]), true);
  assert.equal(bothTrueLink(AR[1]), false);
  assert.equal(bothTrueLink(AR[2]), undefined);
  // The same shape without a question type, and the key being the "not explanation" option.
  const keyed = q('ar2', AR, 1, { question: 'Assertion (A): x. Reason (R): y.' });
  assert.equal(questionFormat(keyed), 'assertion_reason');
  assert.equal(formatTrapFor(keyed, 0)?.trapType, 'assertion_reason_link');
  // A question that only mentions an assertion in passing is not an assertion-reason question.
  assert.equal(questionFormat(q('np', FOUR('np'), 0, { question: 'Which assertion about the reason for the change is true?' })), null);
});

test('match-the-list and sequence: a partly right option is a partly true trap with its own count; none or all is no trap', () => {
  const match = q('m', ['A-II, B-I, C-IV, D-III', 'A-II, B-I, C-III, D-IV', 'A-I, B-II, C-III, D-IV', 'A-III, B-IV, C-I, D-II'], 0, { questionType: 'match_the_following' });
  assert.equal(questionFormat(match), 'match_list');
  assert.deepEqual(formatTrapFor(match, 1), { trapType: 'partly_true', detail: 'This option matches 2 of the 4 pairs as the key does.', format: 'match_list' });
  assert.equal(formatTrapFor(match, 3), null, 'no pair in common');
  const seq = q('o', ['B-A-D-C', 'B-A-C-D', 'A-B-C-D', 'D-C-B-A'], 0, { question: 'Arrange the events in the correct order.' });
  assert.equal(questionFormat(seq), 'sequence');
  assert.equal(formatTrapFor(seq, 1).detail, 'This option puts 2 of the 4 items in the same place as the key.');
  assert.equal(formatTrapFor(seq, 3), null);
  // Numeric answers that only look like orders are not sequences without the stem or type to say so.
  assert.equal(questionFormat(q('n', ['1, 2, 3', '1, 3, 2', '2, 1, 3', '3, 2, 1'], 0, { question: 'What is the value?' })), null);
  assert.equal(questionFormat(q('few', ['A', 'B'], 0)), null);
});

test('the key-quality loop: a wrong option picked by 20 or more and by more than the key', () => {
  const read = (counts, keyIndex = 0) => ({ n: counts.reduce((s, c) => s + c, 0), counts, keyIndex });
  assert.deepEqual(keyQualityFlag(read([10, 32, 10, 8])), { index: 1, picks: 32, keyPicks: 10, n: 60 });
  assert.equal(keyQualityFlag(read([10, 19, 10, 8])), null, '19 is under 20');
  assert.equal(keyQualityFlag(read([40, 30, 10, 8])), null, 'the key leads');
  assert.equal(keyQualityFlag(read([30, 30, 5, 5])), null, 'a tie is not more than the key');
  assert.equal(keyQualityFlag(read([0, 20, 0, 0])).picks, 20);
  assert.equal(keyQualityFlag(null), null);
  assert.equal(keyQualityFlag({ counts: [1, 2], keyIndex: null }), null);
  const snapshot = {
    questions: {
      a: { n: 70, keyHash: 'k1', picks: { k1: 10, w1: 45, w2: 15 } },
      b: { n: 40, keyHash: 'k2', picks: { k2: 25, w3: 15 } },
      c: { n: 30, keyHash: 'k3', picks: { k3: 5, w4: 20, w5: 5 } },
      d: { n: 10, keyHash: 'k4', picks: { w6: 10 } },
    },
  };
  assert.deepEqual(keyQualityFlags(snapshot).map((f) => [f.qid, f.topPicks, f.keyPicks]), [['a', 45, 10], ['c', 20, 5]]);
  assert.equal(TRAP_RULES.keyLoopMin, 20);
});

test('the committed cohort snapshot is read by the loop: every flag has a wrong option over the key and 20 picks', () => {
  const snapshot = JSON.parse(readFileSync(join(FIXTURE_DIR, '..', '..', '..', 'cohort', 'question_picks.v1.json'), 'utf8'));
  const flags = keyQualityFlags(snapshot);
  assert.ok(flags.length > 0 && flags.length < Object.keys(snapshot.questions).length);
  for (const f of flags) { assert.ok(f.topPicks >= 20); assert.ok(f.topPicks > f.keyPicks); assert.match(f.topHash, /^[0-9a-f]{16}$/); }
});

test('lab.traps: tags only on clean wrong answers; held, flagged, disagreeing, blank, right and unnamed ones stay bare', () => {
  const { slice4, lab, paper } = buildPaperContracts();
  assert.deepEqual(Object.keys(slice4.traps.tags), ['p1-q1', 'p1-q2', 'p1-q3', 'p1-q4']);
  // The flagged question (q6) has a clean atlas row but the key loses to its option; q7 is held; q5's repairs disagree.
  assert.ok(lab.byQuestion['p1-q6'].others.counts[1] > lab.byQuestion['p1-q6'].others.counts[0]);
  for (const id of ['p1-q5', 'p1-q6', 'p1-q7', 'p1-q8', 'p1-q9', 'p1-q10']) assert.equal(slice4.traps.tags[id], undefined, id);
  // Without an atlas only the formats tag; without any tag the part is null.
  const formatOnly = buildTrapTags({ attempt: paper, answerReviews: {}, lab, atlas: null });
  assert.deepEqual(Object.keys(formatOnly.tags), ['p1-q2', 'p1-q3', 'p1-q4']);
  assert.equal(buildTrapTags({ attempt: { questionsSnapshot: [q('z', FOUR('z'), 0)], details: [{ qid: 'z', givenIndex: 1, isCorrect: false }] } }), null);
  assert.equal(TRAPS_VERSION, 1);
});

test('a key that was corrected onto the stored trap option shows no tag', () => {
  const question = q('k1', FOUR('k1'), 1); // the key is now option b
  const atlas = indexAtlas([{ qid: 'k1', option_hash: pureHash('k1 b'), trap_type: 'reversed', repairs_agreeing: 1, repairs_disagreeing: 0 }]);
  assert.equal(trapForOption({ question, index: 0, atlasByHash: atlas.get('k1') }), null);
  assert.equal(trapForOption({ question, index: 1, atlasByHash: atlas.get('k1') }), null, 'the key is never a trap');
});

test('Traps you meet: chances, caught, the split, Catching you less and Still catching you, and the 3-chance floor', () => {
  const { sheet, empty } = buildSheetContracts();
  assert.equal(sheet.state, 'ready');
  assert.deepEqual(sheet.rows.map((r) => [r.trapType, r.caught, r.of, r.status]), [['look_alike_term', 5, 10, 'falling'], ['wrong_rule', 4, 6, 'still'], ['assertion_reason_link', 2, 3, null]]);
  assert.equal(sheet.rows[0].text, 'A look-alike term: caught 5 of 10 times.');
  assert.equal(sheet.rows[0].periods.text, 'Before 8 Oct: 4 of 5. Since: 1 of 5.');
  assert.equal(sheet.rows[0].statusLabel, 'Catching you less');
  assert.equal(sheet.rows[1].statusLabel, 'Still catching you');
  assert.ok(!sheet.rows.some((r) => r.trapType === 'partly_true'), 'two chances show no row');
  assert.equal(sheet.basis, 'A chance is a question you answered where one wrong option carries this trap.');
  assert.deepEqual([empty.state, empty.rows, empty.message], ['empty', [], LAB_COPY.traps.empty]);
});

test('Catching you less needs 5 chances in each period and a drop of 30 points; Still catching you needs 4, half caught and a rate not lower', () => {
  const p = (k, n) => ({ k, n });
  assert.equal(trapStatus(p(4, 5), p(1, 5)), 'falling');
  assert.equal(trapStatus(p(4, 5), p(2, 5)), 'falling', '80% to 40% is a 40 point drop');
  assert.equal(trapStatus(p(4, 5), p(3, 5)), null, '80% to 60% is a 20 point drop, and the later rate is lower, so it is not Still catching you either');
  assert.equal(trapStatus(p(3, 5), p(1, 5)), 'falling', 'exactly 60% to 20%');
  assert.equal(trapStatus(p(3, 5), p(2, 5)), null, '20 points');
  assert.equal(trapStatus(p(4, 4), p(0, 5)), null, 'the earlier period has 4 chances');
  assert.equal(trapStatus(p(4, 5), p(0, 4)), null, 'the later period has 4 chances');
  assert.equal(trapStatus(p(1, 2), p(3, 4)), 'still');
  assert.equal(trapStatus(p(2, 4), p(2, 4)), 'still', 'half caught and not lower');
  assert.equal(trapStatus(p(2, 4), p(1, 4)), null, 'under half');
  assert.equal(trapStatus(p(3, 3), p(2, 4)), null, 'half caught but the rate is lower');
  assert.equal(trapStatus(p(1, 2), p(2, 3)), null, 'the later period has 3 chances');
  assert.equal(trapStatus(null, p(4, 4)), null);
});

test('the 30 point gate is exact: 7 of 10 to 4 of 10 and 9 of 10 to 6 of 10 are Falling, 7 of 10 to 5 of 10 is not (no decimal rounding)', () => {
  const p = (k, n) => ({ k, n });
  assert.equal(0.7 - 0.4 < 0.3, true, 'the decimal subtraction really is a hair under 0.3');
  assert.equal(trapStatus(p(7, 10), p(4, 10)), 'falling');
  assert.equal(trapStatus(p(9, 10), p(6, 10)), 'falling');
  assert.equal(trapStatus(p(6, 10), p(3, 10)), 'falling');
  assert.equal(trapStatus(p(7, 10), p(5, 10)), null, '20 points');
  assert.equal(trapStatus(p(7, 10), p(4, 5)), 'still', '70% to 80%: the rate rose and 4 of 5 is over half');
  assert.equal(trapStatus(p(5, 10), p(3, 5)), 'still', '60% is not lower than 50%');
});

test('Traps you meet leaves out questions held for re-check or flagged by the key-quality loop', () => {
  const trap = (id) => q(id, [`${id} key`, `${id} trap`, `${id} c`, `${id} d`], 0);
  const qs = ['u1', 'u2', 'u3', 'u4'].map(trap);
  const attempt = { id: 'two', completedAt: T0, questionsSnapshot: qs, details: qs.map((x) => ({ qid: x.id, givenIndex: 1, isCorrect: false })) };
  const atlas = indexAtlas(qs.map((x) => ({ qid: x.id, option_hash: pureHash(x.options[1]), trap_type: 'extreme_word', repairs_agreeing: 1, repairs_disagreeing: 0 })));
  assert.equal(buildTrapsMeet({ attempts: [attempt], atlas }).rows[0].of, 4);
  assert.equal(buildTrapsMeet({ attempts: [attempt], atlas, skip: new Set(['u4']) }).rows[0].of, 3);
  assert.equal(buildTrapsMeet({ attempts: [attempt], atlas, skip: new Set(['u3', 'u4']) }).state, 'empty', 'two chances are under the floor');
});

test('with every chance on one day there is no split, only the counts', () => {
  const trap = (id) => q(id, [`${id} key`, `${id} trap`, `${id} c`, `${id} d`], 0);
  const qs = ['t1', 't2', 't3'].map(trap);
  const attempt = { id: 'one', completedAt: T0, questionsSnapshot: qs, details: qs.map((x) => ({ qid: x.id, givenIndex: 1, isCorrect: false })) };
  const atlas = indexAtlas(qs.map((x) => ({ qid: x.id, option_hash: pureHash(x.options[1]), trap_type: 'extreme_word', repairs_agreeing: 1, repairs_disagreeing: 0 })));
  const sheet = buildTrapsMeet({ attempts: [attempt], atlas });
  assert.equal(sheet.rows[0].text, 'An extreme word: caught 3 of 3 times.');
  assert.equal(sheet.rows[0].periods, null);
  assert.equal(sheet.rows[0].status, null);
  assert.equal(buildTrapsMeet({ attempts: [{ ...attempt, questionsSnapshot: qs.slice(0, 2), details: attempt.details.slice(0, 2) }], atlas }).state, 'empty');
});

test('trapOptions reads atlas rows by hash and formats by shape, never the key', () => {
  const question = q('to', AR, 0, { questionType: 'assertion_reason' });
  const atlas = indexAtlas([
    { qid: 'to', option_hash: pureHash(AR[2]), trap_type: 'reversed', repairs_agreeing: 1, repairs_disagreeing: 0 },
    { qid: 'to', option_hash: pureHash(AR[0]), trap_type: 'wrong_rule', repairs_agreeing: 1, repairs_disagreeing: 0 },
  ]);
  const map = trapOptions(question, atlas.get('to'));
  assert.deepEqual([...map].map(([t, s]) => [t, [...s]]).sort(), [['assertion_reason_link', [1]], ['reversed', [2]]]);
});

test('copy rules: no "!", em dash or middle dot in the trap, later and revise copy or in any slice 4 contract; no cause words', () => {
  const all = [...strings(LAB_COPY.traps), ...strings(LAB_COPY.later), ...strings(LAB_COPY.revise), ...strings(load('contract_traps_v1')), ...strings(load('contract_later_v1'))];
  for (const s of all) {
    assert.doesNotMatch(s, /[!—·]/, s);
    assert.doesNotMatch(s, /\byou (?:rushed|overthink|overthought|fell for|panicked|guessed|forgot|misread)\b/i, s);
    assert.doesNotMatch(s, /\b(?:would have|could have|potential|recoverable|predict|forecast)\b/i, s);
  }
});

// ---------- The route's history block ----------
test('the result route adds lab.traps and lab.prove.later only with labSlice4, and every part fails on its own', async () => {
  const { paper, answerReviews } = buildPaperContracts();
  const base = { attempt: paper, answerReviews, answerReviewState: 'ready', loadAttempts: async () => [paper], recapOf: () => null, missedBeforeOf: buildMissedBefore, cohortOf: async () => labCohort, now: T0 + 3_600_000 };
  const plain = await resultHistory(base);
  assert.equal('traps' in plain.lab, false);
  assert.equal(plain.lab.prove, undefined);
  const warned = [];
  const on = await resultHistory({ ...base, labSlice4: { atlasOf: async () => indexAtlasFor(paper), cardsOf: async () => null }, warn: (n) => warned.push(n) });
  assert.deepEqual(Object.keys(on.lab.traps.tags), ['p1-q1', 'p1-q2', 'p1-q3', 'p1-q4']);
  assert.equal(on.lab.prove.later.line, '7 of these come back tomorrow, Fri 16 Oct.');
  const { traps, prove, ...rest } = on.lab;
  assert.deepEqual(rest, plain.lab, 'the slice 1 to 3 contract is unchanged');
  assert.deepEqual(warned, []);
  // A failed atlas read leaves the format tags; a failed card read speaks only of a recent paper.
  const failed = await resultHistory({ ...base, labSlice4: { atlasOf: async () => { throw new Error('db down'); }, cardsOf: async () => { throw new Error('db down'); } }, warn: (n) => warned.push(n) });
  assert.deepEqual(warned, ['atlas', 'reviseCards']);
  assert.deepEqual(Object.keys(failed.lab.traps.tags), ['p1-q2', 'p1-q3', 'p1-q4']);
  assert.equal(failed.lab.prove.later.when, 'tomorrow');
  const stale = await resultHistory({ ...base, now: T0 + 5 * 86_400_000, labSlice4: { atlasOf: async () => null, cardsOf: async () => null } });
  assert.equal(stale.lab.prove, undefined, 'an old paper with no card read says nothing about when it comes back');
  // buildLabSlice4 names a part that throws and nulls it.
  const heard = [];
  const out = buildLabSlice4({ attempt: { questionsSnapshot: 'nope' }, allAttempts: [], warn: (n) => heard.push(n) });
  assert.deepEqual(out, { traps: null, later: null });
  const nothing = await resultHistory({ ...base, answerReviewState: 'loading', labSlice4: { atlasOf: async () => null } });
  assert.equal(nothing.lab, null);
});
function indexAtlasFor(paper) { return indexAtlas(labAtlasRows(paper)); }

// ---------- The server pieces ----------
test('the atlas read batches question ids and treats a missing table as no atlas', async () => {
  const rows = labAtlasRows();
  const db = fakeDb({ atlas: rows.map((r) => ({ ...r })) });
  const got = await readAtlasRows(['p1-q1', 'p1-q5', 'p1-q1', '', null, 7], { db });
  assert.deepEqual(got.map((r) => r.qid).sort(), ['p1-q1', 'p1-q5']);
  const many = await readAtlasRows(Array.from({ length: 300 }, (_, i) => `n${i}`).concat(['p1-q6']), { db });
  assert.equal(many.length, 1);
  assert.ok(db.calls.filter((c) => c.table === 'trap_atlas').length >= 3, 'in batches of 120');
  assert.deepEqual(await readAtlasRows([], { db }), []);
  assert.deepEqual(await readAtlasRows(['x'], { db: fakeDb({}) }), [], 'no table: no atlas');
  await assert.rejects(readAtlasRows(['x'], { db: fakeDb({ atlas: [], failures: { 'trap_atlas:select': { code: '500', message: 'boom' } } }) }), /ATLAS_UNAVAILABLE/);
  const idx = await atlasForAttempt(labPaper(), { db });
  assert.ok(idx.get('p1-q1').size === 1 && !idx.has('p1-q5'), 'a disagreeing row is not indexed');
});

test('doubted questions: held for re-check or flagged by the loop, and a failed read leaves that part out', async () => {
  const db = fakeDb({ questions: [{ id: 'h1', verification_state: 'disputed' }, { id: 'ok1', verification_state: 'verified' }, { id: 'h2', verification_state: 'disputed' }] });
  const snapshot = { questions: { f1: { n: 60, keyHash: 'k', picks: { k: 10, x: 32 } }, f2: { n: 60, keyHash: 'k', picks: { k: 30, x: 30 } } } };
  const got = await doubtedQuestionIds(['h1', 'ok1', 'ok1', 'f1', 'f2', null], { db, snapshot });
  assert.deepEqual([...got].sort(), ['f1', 'h1'], 'f2: the wrong option does not beat the key; h2 was not asked about');
  assert.deepEqual([...(await doubtedQuestionIds(['h1'], { db: fakeDb({ questions: [], failures: { 'questions:select': { message: 'x' } } }), snapshot }))], ['f1']);
  assert.equal((await doubtedQuestionIds([], { db })).size, 0);
});

test('recordTrap counts agreeing and disagreeing repairs, and never throws', async () => {
  const db = fakeDb({ atlas: [] });
  const rec = { qid: 'q1', optionHash: 'b'.repeat(16), trapType: 'reversed' };
  assert.equal((await recordTrap(rec, { db })).row.repairs_agreeing, 1);
  assert.equal((await recordTrap(rec, { db })).row.repairs_agreeing, 2);
  const other = await recordTrap({ ...rec, trapType: 'wrong_rule' }, { db });
  assert.deepEqual([other.row.trap_type, other.row.repairs_agreeing, other.row.repairs_disagreeing], ['reversed', 2, 1]);
  assert.deepEqual(await recordTrap(null, { db }), { ok: false, reason: 'no_record' });
  assert.deepEqual(await recordTrap(rec, { db: fakeDb({}) }), { ok: false, reason: 'missing' });
  assert.deepEqual(await recordTrap(rec, { db: { rpc: async () => { throw new Error('x'); } } }), { ok: false, reason: 'failed' });
});

test('the loop holds a live flagged question and leaves any other as it is', async () => {
  const row = (id, status) => ({ id, status, verification_state: 'verified', exploration_state: 'active' });
  const db = fakeDb({ questions: [row('a', 'live'), row('b', 'pending'), row('c', 'rejected')] });
  assert.deepEqual(await recheckFlaggedKey(db, { qid: 'a' }), { held: true });
  assert.deepEqual(db.tables.questions.find((x) => x.id === 'a'), { id: 'a', status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review', updated_at: db.tables.questions[0].updated_at });
  assert.deepEqual(await recheckFlaggedKey(db, { qid: 'b' }), { held: false, reason: 'not_live' });
  assert.deepEqual(await recheckFlaggedKey(db, { qid: 'c' }), { held: false, reason: 'not_live' });
  assert.deepEqual(await recheckFlaggedKey(db, { qid: 'zzz' }), { held: false, reason: 'not_found' });
  assert.equal(db.tables.questions.find((x) => x.id === 'c').status, 'rejected');
  await assert.rejects(recheckFlaggedKey(fakeDb({ questions: [row('a', 'live')], failures: { 'questions:update': { message: 'boom' } } }), { qid: 'a' }));
});

// ---------- The atlas fill in a committed repair ----------
const REQ = 'req_0123456789abcdef';
const ROUTE = { provider: 'openai', model: 'gpt-6-luna' };
const SNAP = { id: 'q1', subject: 'accountancy', chapter: 'Journal', question: 'Which entry records the purchase?', options: [{ key: 'A', text: 'Debit the asset' }, { key: 'B', text: 'Credit the asset' }, { key: 'C', text: 'Debit the capital' }, { key: 'D', text: 'Credit the capital' }], correctIndex: 1 };
const GOOD = {
  solved_index: 1, agrees_with_key: true, trap_type: 'look_alike_term',
  trap: 'Debit and credit look alike on first reading.', why_wrong: 'A purchase of an asset is a debit to the asset, not to capital.',
  why_right: 'The asset account is debited when an asset is bought.', contrast: 'If capital were brought in, option C would fit. The asset is bought, so option B.',
  others: [{ index: 2, why: 'Capital is not the account that changes here.' }, { index: 3, why: 'This credits capital, which is not touched.' }],
  rule: 'Debit the asset when you buy it.', memory_hook: 'Buy it, debit it.', another_way: 'Ask which account grows. The asset grows, so it is debited, and the other side is credited.',
};
function repairHarness({ trapType = 'look_alike_term', commitOk = true, recordTrapFn, chosenIndex = 0 } = {}) {
  const calls = [];
  const live = { id: 'q1', status: 'live', verification_state: 'verified', options: SNAP.options.map((o) => ({ ...o })), correct_answer: 'B' };
  const deps = {
    now: () => T0,
    loadAttempt: async () => ({ id: 'a1', userId: 'u1', subject: 'accountancy', questionsSnapshot: [SNAP], details: [{ qid: 'q1', isCorrect: false, givenIndex: chosenIndex }] }),
    loadQuestion: async () => ({ data: live, error: null }), evidenceEligible: () => false, findStored: async () => null, findOpenReservations: async () => [],
    gateOpen: () => true, reserve: async () => ({ ok: true, state: 'reserved', balance: 9 }), markExecuting: async () => ({ ok: true }),
    commit: async (k, receipt) => { calls.push(['commit', receipt]); return { ok: commitOk }; }, release: async (k, why) => { calls.push(['release', why]); return { ok: true }; },
    generate: async () => ({ ok: true, data: { ...GOOD, trap_type: trapType }, usage: { provider: 'openai', model: 'gpt-6-luna', inputTokens: 1, outputTokens: 1 }, fallbackUsed: false, failure: null }),
    withhold: async () => {}, readWallet: async () => ({ total: 8, state: 'ok' }), log: () => {},
    ...(recordTrapFn ? { recordTrap: async (r) => { calls.push(['atlas', r]); return recordTrapFn(r); } } : {}),
  };
  return { calls, run: (config = {}) => runRepair({ user: { id: 'u1' }, attemptId: 'a1', questionId: 'q1', requestId: REQ, startedAt: T0, deps, config: { route: ROUTE, effort: { repair: 'low', secondOpinion: 'high' }, fallbackRoute: null, ...config } }) };
}

test('a committed v3 repair fills the atlas with its trap on the option chosen, after the commit', async () => {
  const h = repairHarness({ recordTrapFn: async () => ({ ok: true }) });
  const { body } = await h.run();
  assert.equal(body.status, 'explained');
  assert.deepEqual(h.calls.map((c) => c[0]), ['commit', 'atlas']);
  assert.deepEqual(h.calls[1][1], { qid: 'q1', optionHash: pureHash('Debit the asset'), trapType: 'look_alike_term' });
});

test('no atlas row for "other", an uncommitted repair, a v1 repair, or a failing or slow atlas; the repair is unharmed', async () => {
  const other = repairHarness({ trapType: 'other', recordTrapFn: async () => ({ ok: true }) });
  assert.equal((await other.run()).body.status, 'explained');
  assert.deepEqual(other.calls.map((c) => c[0]), ['commit']);
  const uncommitted = repairHarness({ commitOk: false, recordTrapFn: async () => ({ ok: true }) });
  assert.equal((await uncommitted.run()).body.charged, 0);
  assert.ok(!uncommitted.calls.some((c) => c[0] === 'atlas'));
  const v1 = repairHarness({ recordTrapFn: async () => ({ ok: true }) });
  await v1.run({ promptVersion: 1 }).catch(() => null);
  assert.ok(!v1.calls.some((c) => c[0] === 'atlas'));
  const throwing = repairHarness({ recordTrapFn: async () => { throw new Error('db down'); } });
  const out = await throwing.run();
  assert.equal(out.http, 200);
  assert.equal(out.body.status, 'explained');
  assert.equal(out.body.charged, 1);
  const slow = repairHarness({ recordTrapFn: () => new Promise(() => {}) });
  const t0 = Date.now();
  const late = await slow.run();
  assert.equal(late.body.status, 'explained', 'an atlas write that never answers is cut off');
  assert.ok(Date.now() - t0 < 5000);
  const without = repairHarness();
  assert.equal((await without.run()).body.status, 'explained', 'a harness without recordTrap (the older wiring) still works');
});
