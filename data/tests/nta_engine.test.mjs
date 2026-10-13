// NTA paper engine: every subject's paper matches its blueprint, and every way the bank can fall short
// ends in a stated difference or a stated refusal, never in padding.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NTA_MIN_SCORE,
  NTA_MIN_SERVE_QUESTIONS,
  assembleNtaPaper,
  checkNtaPaper,
  classifyNtaType,
  getNtaBlueprint,
  listNtaBlueprintSubjects,
  ntaEligibility,
  ntaScoreOf,
} from '../nta_engine.js';
import { buildNtaPaper, recordNtaShortfall } from '../nta_pool.js';
import { contentHash, evidenceSignature } from '../content_evidence.js';
import { publicSessionView } from '../../shared/recoveryContract.js';
import { fixtureId, makeBank, signEvidence, stemFor } from './ntaEngineFixtures.mjs';

const TIME_TARGET_MS = 3000;

function assertBlueprint(result, subject, variantId) {
  const bp = getNtaBlueprint(subject);
  const variant = bp.variants.find((entry) => entry.id === variantId) || bp.variants.find((entry) => entry.default);
  const paper = result.paper;
  assert.equal(result.status, 'exact', `${subject}: ${JSON.stringify(result.deviations)}`);
  assert.equal(paper.length, 50, `${subject}: 50 questions`);
  assert.deepEqual(checkNtaPaper(paper, bp, variant.id), [], `${subject}: no deviation from the blueprint`);

  // Positions and section order.
  assert.deepEqual(paper.map((entry) => entry.position), Array.from({ length: 50 }, (_, i) => i + 1));
  let position = 1;
  for (const [index, section] of variant.sections.entries()) {
    const inSection = paper.filter((entry) => entry.sectionIndex === index).map((entry) => entry.position);
    assert.equal(inSection.length, section.questions, `${subject}/${section.id}: size`);
    assert.deepEqual([inSection[0], inSection.at(-1)], [position, position + section.questions - 1], `${subject}/${section.id}: positions`);
    position += section.questions;
  }

  // No repeats: ids, families, stems.
  assert.equal(new Set(paper.map((entry) => entry.id)).size, 50);
  assert.equal(new Set(paper.map((entry) => entry.row.family_id)).size, 50);
  assert.equal(new Set(paper.filter((entry) => entry.setIndex === null).map((entry) => entry.row.body)).size, paper.filter((entry) => entry.setIndex === null).length);

  // Sets whole, together, one chapter, in the blueprint's place.
  const groups = new Map();
  for (const entry of paper) if (entry.row.passage_group_id) groups.set(entry.row.passage_group_id, [...(groups.get(entry.row.passage_group_id) || []), entry]);
  assert.ok(groups.size >= bp.sets.count.min && groups.size <= bp.sets.count.max, `${subject}: set count ${groups.size}`);
  if (bp.sets.count.target > 0) assert.equal(groups.size, bp.sets.count.target, `${subject}: target set count`);
  const setPositions = [];
  for (const [group, entries] of groups) {
    const positions = entries.map((entry) => entry.position);
    assert.ok(positions.every((value, i) => i === 0 || value === positions[i - 1] + 1), `${subject}: ${group} together`);
    assert.ok(entries.length >= bp.sets.size.min && entries.length <= bp.sets.size.max, `${subject}: ${group} size`);
    assert.equal(new Set(entries.map((entry) => entry.chapter)).size, 1, `${subject}: ${group} one chapter`);
    assert.deepEqual(entries.map((entry) => entry.row.order_index), [...entries.map((entry) => entry.row.order_index)].sort((a, b) => a - b), `${subject}: ${group} in passage order`);
    setPositions.push(...positions);
  }
  if (setPositions.length) {
    setPositions.sort((a, b) => a - b);
    if (bp.sets.placement === 'start') assert.deepEqual(setPositions, Array.from({ length: setPositions.length }, (_, i) => i + 1), `${subject}: sets first`);
    else assert.deepEqual(setPositions, Array.from({ length: setPositions.length }, (_, i) => 51 - setPositions.length + i), `${subject}: sets last`);
  }

  // Type quotas for standalone questions.
  const types = {};
  for (const entry of paper.filter((value) => value.setIndex === null)) types[entry.type] = (types[entry.type] || 0) + 1;
  for (const [type, range] of Object.entries(bp.typeQuotas)) {
    const count = types[type] || 0;
    assert.ok(count >= range.min && count <= range.max, `${subject}: ${type} ${count} in ${range.min}-${range.max}`);
  }
  for (const type of Object.keys(types)) assert.ok(bp.typeQuotas[type], `${subject}: ${type} belongs to this paper`);

  // Difficulty mix.
  for (const key of ['easy', 'medium', 'hard']) {
    const share = paper.filter((entry) => entry.difficulty === key).length / 50;
    assert.ok(share >= bp.difficulty[key].min - 1e-9 && share <= bp.difficulty[key].max + 1e-9, `${subject}: ${key} ${share}`);
  }

  // Unit weightage, counted from stored chapters (an independent recount of the engine's slots).
  for (const [index, section] of variant.sections.entries()) {
    const counts = new Map();
    for (const entry of paper.filter((value) => value.sectionIndex === index)) counts.set(entry.chapter, (counts.get(entry.chapter) || 0) + 1);
    for (const unit of section.units) {
      const names = new Set(unit.chapters.flatMap((chapter) => [chapter.name, ...(chapter.aliases || [])]));
      const count = [...counts].filter(([name]) => names.has(name)).reduce((sum, [, value]) => sum + value, 0);
      assert.ok(count >= unit.questions.min && count <= unit.questions.max, `${subject}/${section.id}/${unit.name}: ${count}`);
    }
  }

  assert.ok(result.timings.totalMs < TIME_TARGET_MS, `${subject}: ${result.timings.totalMs} ms`);
}

for (const subject of listNtaBlueprintSubjects()) {
  const bp = getNtaBlueprint(subject);
  for (const variant of bp.variants) {
    test(`${subject}/${variant.id}: three papers match the blueprint exactly`, () => {
      const bank = makeBank(subject);
      const papers = [1, 2, 3].map((n) => assembleNtaPaper(bank, { subject, variant: variant.id, seed: `paper-${n}` }));
      for (const result of papers) assertBlueprint(result, subject, variant.id);
      const [a, b] = papers.map((result) => new Set(result.paper.map((entry) => entry.id)));
      assert.ok([...a].filter((id) => b.has(id)).length < 50, `${subject}: different seeds give different papers`);
    });
  }
}

test('the score bar is 8 out of 10 and read on the 0-10 scale', () => {
  assert.equal(NTA_MIN_SCORE, 8);
  assert.equal(ntaScoreOf({ quality_score: 0.85 }).score, 8.5);
  assert.deepEqual(ntaScoreOf({ quality_score: 0 }), { score: null, source: null }, 'the column default is no score');
  assert.equal(ntaScoreOf({ evidence: { record: { checks: { exam_fit: { item_quality_score: 8 }, independent_evaluation: { item_quality_score: 9 } } } } }).score, 8.5);
  const [signed] = makeBank('economics', { copies: 1 }).filter((entry) => !entry.passage_group_id && !/₹/.test(entry.body));
  const { evidence, ...row } = signed;
  assert.equal(ntaEligibility(signEvidence(row, { luna: 8, gemini: 8 }), { subject: 'economics' }).eligible, true);
  assert.deepEqual(ntaEligibility(signEvidence(row, { luna: 8, gemini: 7 }), { subject: 'economics' }).reasons, ['score_below_threshold'], '7.5 is under the bar');
  assert.deepEqual(ntaEligibility(row, { subject: 'economics' }).reasons, ['no_score']);
  // Nothing signs the quality_score column, so it never admits a question on its own.
  assert.deepEqual(ntaEligibility({ ...row, quality_score: 0.9 }, { subject: 'economics' }).reasons, ['score_unsigned']);
});

test('an evidence score counts only while it is signed, unchanged and agrees with the key', () => {
  const secret = 'test-signing-key';
  const [base] = makeBank('accountancy', { copies: 1 }).filter((entry) => !entry.passage_group_id);
  const row = { ...base, quality_score: 0 };
  const record = {
    candidate_id: row.id,
    content_hash: contentHash(row),
    solved_key: 'A',
    checks: { exam_fit: { item_quality_score: 8 }, independent_evaluation: { item_quality_score: 9, solved_key: 'A' } },
  };
  const signed = { ...row, evidence: { record, signature: evidenceSignature(record, secret) } };
  const check = (value, key = secret) => ntaEligibility(value, { subject: 'accountancy', secret: key });
  assert.deepEqual({ ...check(signed), type: undefined }, { eligible: true, reasons: [], score: 8.5, scoreSource: 'evidence_judges', type: undefined });
  assert.ok(check(signed, '').reasons.includes('score_unverifiable_no_signing_key'));
  assert.ok(check({ ...signed, evidence: { ...signed.evidence, signature: 'f'.repeat(64) } }).reasons.includes('score_signature_invalid'));
  assert.ok(check({ ...signed, body: `${signed.body} changed`, question: `${signed.question} changed` }).reasons.includes('question_changed_since_scored'));
  const wrongKey = { ...record, checks: { ...record.checks, independent_evaluation: { item_quality_score: 9, solved_key: 'B' } } };
  assert.ok(check({ ...row, evidence: { record: wrongKey, signature: evidenceSignature(wrongKey, secret) } }).reasons.includes('independent_solver_key_mismatch'));
  const low = { ...record, checks: { exam_fit: { item_quality_score: 7 }, independent_evaluation: { item_quality_score: 8, solved_key: 'A' } } };
  assert.ok(check({ ...row, evidence: { record: low, signature: evidenceSignature(low, secret) } }).reasons.includes('score_below_threshold'), '7.5 is under the bar');
  // Missing judges or solvers fail closed: both judges and both blind solvers are required.
  const sign = (value) => ({ ...row, evidence: { record: value, signature: evidenceSignature(value, secret) } });
  const oneJudge = { ...record, checks: { exam_fit: { item_quality_score: 9 }, independent_evaluation: { solved_key: 'A' } } };
  assert.ok(check(sign(oneJudge)).reasons.includes('score_needs_both_judges'));
  const { solved_key: _omit, ...noSolver } = record;
  assert.ok(check(sign(noSolver)).reasons.includes('blind_solver_key_missing'));
  const noIndependent = { ...record, checks: { exam_fit: { item_quality_score: 8 }, independent_evaluation: { item_quality_score: 9 } } };
  assert.ok(check(sign(noIndependent)).reasons.includes('independent_solver_key_missing'));
});

test('hard gates: publication, disputes, family holds, key integrity and syllabus', () => {
  const [row] = makeBank('accountancy', { copies: 1 }).filter((entry) => !entry.passage_group_id);
  const subject = 'accountancy';
  assert.ok(ntaEligibility({ ...row, status: 'pending' }, { subject }).reasons.includes('not_published'));
  assert.ok(ntaEligibility({ ...row, is_deleted: true }, { subject }).reasons.includes('not_published'));
  assert.ok(ntaEligibility({ ...row, verification_state: 'disputed' }, { subject }).reasons.includes('key_disputed'));
  assert.ok(ntaEligibility(row, { subject, disputedIds: new Set([row.id]) }).reasons.includes('key_disputed'));
  assert.ok(ntaEligibility(row, { subject, heldFamilies: new Set([row.family_id]) }).reasons.includes('family_held'));
  assert.ok(ntaEligibility({ ...row, correct_answer: 'Z', correct_index: null }, { subject }).reasons.some((reason) => /key_unresolved|answer_missing/.test(reason)));
  assert.ok(ntaEligibility({ ...row, explanation: 'The correct answer is B.' }, { subject }).reasons.includes('answer_guard_explanation_contradicts_key'));
  const { evidence: _evidence, ...plain } = row;
  const bank = [...makeBank(subject), signEvidence({ ...plain, id: fixtureId('cas-1'), family_id: 'fam-cas-1', chapter: 'Computerized Accounting System' })];
  const result = assembleNtaPaper(bank, { subject, seed: 'syllabus' });
  assert.equal(result.pool.excluded.chapter_out_of_syllabus, 1);
  assert.ok(!result.paper.some((entry) => entry.id === fixtureId('cas-1')));
});

test('question types come from the stem, the options and the stored type', () => {
  const english = (body, questionType, chapter = 'Vocabulary') => classifyNtaType({ body, question_type: questionType, chapter, options: [] }, 'english', Object.keys(getNtaBlueprint('english').typeQuotas));
  assert.equal(english('Choose the phrase closest in meaning to "benevolent".', 'synonym'), 'synonym');
  assert.equal(english('Choose the word closest in meaning to "arrogant".', null), 'synonym');
  assert.equal(english('Arrange the following sentences to form a coherent paragraph. (A) x (B) y', 'sequence_ordering', 'Para Jumbles'), 'sentence_rearrangement');
  assert.equal(english('Choose the sentence in which "versatile" is used correctly.', 'correct_word_usage', 'Correct Word Usage'), 'fill_in_blank');
  const domain = Object.keys(getNtaBlueprint('economics').typeQuotas);
  const options = (texts) => texts.map((text, i) => ({ key: 'ABCD'[i], text }));
  assert.equal(classifyNtaType({ body: 'Consider the following statements about money: (A) one (B) two (C) three (D) four', question_type: 'statement_selection', options: options(['(A) and (B) only', '(B) and (C) only', '(A) and (C) only', '(A) and (D) only']) }, 'economics', domain), 'statement_based');
  assert.equal(classifyNtaType({ body: 'Which statement about money is correct?', question_type: 'statement_selection', options: options(['Money is a store of value.', 'Money has no use.', 'Money is a factor.', 'Money is land.']) }, 'economics', domain), 'single_mcq');
  assert.equal(classifyNtaType({ body: stemFor('match_the_following', 'm1').body, options: [] }, 'economics', domain), 'match_the_following');
  assert.equal(classifyNtaType({ body: 'A manager considers: I. alpha II. beta III. gamma IV. delta. Which order?', question_type: 'sequence_ordering', options: options(['II, IV, III, I', 'II, III, IV, I', 'IV, II, III, I', 'II, IV, I, III']) }, 'business_studies', Object.keys(getNtaBlueprint('business_studies').typeQuotas)), 'sequence_ordering');
});

test("the student's unseen questions come first; seen ones only when the bank runs out, and the paper says so", () => {
  const bank = makeBank('economics');
  const first = assembleNtaPaper(bank, { subject: 'economics', seed: 'first' });
  const seenIds = new Set(first.paper.map((entry) => entry.id));
  const second = assembleNtaPaper(bank, { subject: 'economics', seed: 'second', seenIds });
  assert.equal(second.status, 'exact');
  assert.equal(second.paper.filter((entry) => seenIds.has(entry.id)).length, 0, 'a deep bank needs no repeats');

  const thin = makeBank('economics', { copies: 1 });
  const thinFirst = assembleNtaPaper(thin, { subject: 'economics', seed: 'first' });
  const thinSeen = new Set(thinFirst.paper.map((entry) => entry.id));
  const thinSecond = assembleNtaPaper(thin, { subject: 'economics', seed: 'second', seenIds: thinSeen });
  const repeats = thinSecond.paper.filter((entry) => thinSeen.has(entry.id)).length;
  assert.ok(repeats > 0, 'a thin bank has to repeat');
  assert.equal(thinSecond.structure.seenUsed, repeats);
  assert.equal(thinSecond.status, 'closest');
  assert.ok(thinSecond.notice.items.some((item) => item.startsWith(`${repeats} question`) && item.includes('answered before')));
  const unseenLeft = thin.filter((row) => !thinSeen.has(row.id)).length;
  assert.ok(50 - repeats <= unseenLeft, 'every unseen question that fits is used before a seen one');
});

test('a domain bank without case sets gets standalone questions at Q41-50, and the student is told', () => {
  const result = assembleNtaPaper(makeBank('economics', { sets: 0 }), { subject: 'economics', seed: 'nosets' });
  assert.equal(result.status, 'closest');
  assert.equal(result.paper.length, 50);
  assert.deepEqual(result.deviations.map((deviation) => deviation.kind), ['sets_substituted']);
  assert.ok(result.paper.slice(40).every((entry) => entry.setIndex === null));
  assert.match(result.notice.items[0], /2 case-based sets of 5 questions.*Q41-50 are standalone questions instead/);
  const singles = result.paper.filter((entry) => entry.type === 'single_mcq').length;
  assert.ok(singles <= getNtaBlueprint('economics').typeQuotas.single_mcq.max + 10, 'set seats become single MCQs only as far as the set allowance');
});

test('English without two complete passages is refused, with the reason', () => {
  const result = assembleNtaPaper(makeBank('english', { sets: 1 }), { subject: 'english', seed: 'one-set' });
  assert.equal(result.status, 'refused');
  assert.equal(result.refusal.reason, 'no_passage_sets');
  assert.deepEqual(result.rows, []);
  assert.match(result.notice.summary, /needs 2 complete reading passages of 200 to 300 words with 4 to 5 different questions each.*has 1 such passage/);
  const short = assembleNtaPaper(makeBank('english', { setSize: 3 }), { subject: 'english', seed: 'short-sets' });
  assert.equal(short.refusal.reason, 'no_passage_sets', 'sets of 3 are fragments, not CUET passages');
});

test('a missing question type is reported, never padded with another type', () => {
  const result = assembleNtaPaper(makeBank('accountancy', { omitTypes: ['match_the_following'] }), { subject: 'accountancy', seed: 'nomatch' });
  assert.equal(result.status, 'closest');
  assert.equal(result.paper.length, 50);
  assert.equal(result.structure.types.match_the_following || 0, 0);
  assert.ok(result.structure.types.single_mcq <= getNtaBlueprint('accountancy').typeQuotas.single_mcq.max);
  assert.ok(result.notice.items.includes('Match-the-following questions: 0 instead of 2 to 6, because the bank is short of them.'));

  const onlySingles = assembleNtaPaper(makeBank('physics', { omitTypes: ['match_the_following', 'sequence_ordering', 'statement_based', 'assertion_reason'] }), { subject: 'physics', seed: 'singles' });
  assert.equal(onlySingles.status, 'closest');
  assert.equal(onlySingles.paper.length, 48, 'single MCQs stop at their maximum (48), so the paper is 2 short');
  assert.equal(onlySingles.notice.items[0], 'This paper has 48 questions instead of 50: the question bank does not have enough questions that meet the quality bar and fit the Physics pattern.');
  assert.ok(onlySingles.notice.items.some((item) => item.startsWith('Match-the-following questions: 0 instead of 2 to 6')));
});

test('a bank that cannot reach the serving floor is refused with what it lacks', () => {
  const result = assembleNtaPaper(makeBank('physics', { copies: 1 }).slice(0, 30), { subject: 'physics', seed: 'tiny' });
  assert.equal(result.status, 'refused');
  assert.equal(result.refusal.reason, 'too_few_questions');
  assert.ok(result.paper.length < NTA_MIN_SERVE_QUESTIONS);
  assert.match(result.notice.summary, /could place only \d+ of 50 questions/);
  assert.ok(result.notice.items.length > 0, 'the shortfall is listed');
  assert.ok(result.shortfall.deviations.length > 0, 'the content team gets the same list');
  const empty = assembleNtaPaper([], { subject: 'history', seed: 'empty' });
  assert.equal(empty.refusal.reason, 'no_scored_questions');
  assert.match(empty.notice.summary, /have not been quality-scored/);
});

test('time: a 2,000-question pool assembles well inside the target, and a spent budget refuses', () => {
  const bank = makeBank('accountancy', { copies: 25 });
  assert.ok(bank.length > 1900);
  const result = assembleNtaPaper(bank, { subject: 'accountancy', seed: 'big' });
  assert.equal(result.status, 'exact');
  assert.ok(result.timings.totalMs < TIME_TARGET_MS, `${result.timings.totalMs} ms`);
  const late = assembleNtaPaper(makeBank('accountancy'), { subject: 'accountancy', seed: 'late', deadline: Date.now() - 1 });
  assert.equal(late.status, 'refused');
  assert.equal(late.refusal.reason, 'time_budget');
});

// A stand-in for the Supabase client that answers selects from memory and fails any write.
function fakeDb(tables) {
  const calls = [];
  const builder = (table) => {
    const filters = [];
    let range = null;
    const query = {
      select() { calls.push(['select', table]); return query; },
      eq(column, value) { filters.push((row) => row[column] === value); return query; },
      is(column, value) { filters.push((row) => (row[column] ?? null) === value); return query; },
      gt(column, value) { filters.push((row) => Number(row[column]) > value); return query; },
      in(column, values) { filters.push((row) => values.includes(row[column])); return query; },
      or() { filters.push((row) => row.evidence != null || Number(row.quality_score) > 0); return query; },
      order() { return query; },
      limit() { return query; },
      range(from, to) { range = [from, to]; return query; },
      abortSignal() { return query; },
      insert() { calls.push(['insert', table]); return Promise.resolve({ error: { code: '42P01', message: 'missing' } }); },
      update() { throw new Error(`write to ${table}`); },
      delete() { throw new Error(`write to ${table}`); },
      then(resolve, reject) {
        let data = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)));
        if (range) data = data.slice(range[0], range[1] + 1);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  };
  return { calls, from: (table) => builder(table) };
}

test('the pool loader reads with selects only and builds the same paper end to end', async () => {
  const questions = makeBank('chemistry');
  const db = fakeDb({ questions, passage_groups: [], question_content_disputes: [], recovery_family_holds: [], user_question_progress: [], attempts: [] });
  const result = await buildNtaPaper(db, 'chemistry', { seed: 'loader', userId: 'user-1' });
  assertBlueprint(result, 'chemistry');
  assert.ok(db.calls.every(([kind]) => kind === 'select'), 'no writes while building');
  assert.ok(result.timings.endToEndMs < TIME_TARGET_MS);
  assert.equal(await recordNtaShortfall(db, { shortfall: null }), false);
  const refused = await buildNtaPaper(db, 'chemistry', { seed: 'none', seenIds: new Set() });
  assert.equal(refused.status, 'exact');
  await recordNtaShortfall(db, { ...refused, shortfall: { subject: 'chemistry', variant: 'default', status: 'closest', built: 50, minScore: 8, eligiblePool: 1 } });
  assert.deepEqual(db.calls.filter(([kind]) => kind === 'insert'), [['insert', 'nta_paper_shortfalls']], 'a shortfall is recorded; a missing table is tolerated');
});

test('the public session view carries what differs, for the website and the app', () => {
  const view = publicSessionView({
    id: 's1', expires_at: '2026-10-13T10:00:00Z', created_at: '2026-10-13T09:00:00Z', state: 'active', mode: 'nta',
    questions: [{ id: 'q1', options: ['a', 'b', 'c', 'd'] }],
    selection_meta: { ntaPaper: { status: 'closest', variant: 'default', notice: { summary: 'S', items: ['one', 'two'] }, structure: { seenUsed: 3 } } },
  });
  assert.deepEqual(view.meta.ntaPaper, { status: 'closest', summary: 'S', items: ['one', 'two'], seenUsed: 3, variant: 'default' });
  const plain = publicSessionView({ id: 's2', expires_at: '', created_at: '', state: 'active', mode: 'quick', questions: [], selection_meta: {} });
  assert.equal(plain.meta.ntaPaper, undefined);
});
