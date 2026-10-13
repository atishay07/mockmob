// NTA engine review of 13 Oct 2026: each fix has a test. Same concept twice in one paper, items that
// give their answer away or whose options do not fit the stem, the type counter, English passages and
// headwords, the numerical share, fail-closed scores, the slim index read and the student messages.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NTA_INDEX_VERSION,
  assembleNtaPaper,
  checkNtaPaper,
  classifyNtaType,
  getNtaBlueprint,
  ntaEligibility,
  signNtaIndex,
} from '../nta_engine.js';
import { buildNtaPaper, clearNtaPoolCache, loadPreviousNtaPaperIds, recordNtaShortfall } from '../nta_pool.js';
import {
  conflictReason, corruptedConnectives, headwordsOf, isNtaQuestionId, isNumericalItem, itemFeatures, listedOrderKeyReasons, ntaDifficultyOf,
  ntaQuarantine, ntaServedRow, seedOrDemoReasons, shuffleBlockers, stemGramWeights, stemWordingAlike,
} from '../nta_item_checks.js';
import committedDifficulty from '../nta_difficulty.json' with { type: 'json' };
import { contentHash } from '../content_evidence.js';
import { FIXTURE_SECRET, fixtureId, makeBank, signEvidence, word } from './ntaEngineFixtures.mjs';

const options = (texts) => texts.map((text, i) => ({ key: 'ABCD'[i], text }));
const types = (subject) => Object.keys(getNtaBlueprint(subject).typeQuotas);

function item(subject, chapter, body, optionTexts, extra = {}) {
  const label = extra.id || `t-${Math.random().toString(36).slice(2)}`;
  return signEvidence({
    subject, chapter, body, question: body, options: options(optionTexts), correct_answer: 'A', correct_index: 0,
    explanation: extra.explanation || 'Because the rule in the chapter says so.', difficulty: 'medium', status: 'live',
    is_deleted: false, verification_state: 'verified', quality_score: 0, family_id: extra.family_id || `fam-${label}`,
    question_type: extra.question_type ?? null, concept_id: extra.concept_id ?? '', score: 0, order_index: 0, ...extra,
    id: fixtureId(label),
  });
}

// ---------------------------------------------------------------------------------------------
// Type counter (P1)
// ---------------------------------------------------------------------------------------------

test('statement-based needs labelled statements and label combinations; Both/Only wording is a plain MCQ', () => {
  const bst = types('business_studies');
  const plain = { body: 'Two employees attend an induction; P occupies the post and Q does not. Which conclusion follows?', options: options(['Both have undergone orientation; placement has occurred for P only.', 'Only P has undergone orientation.', 'Neither has undergone orientation.', 'Only Q has undergone orientation.']) };
  assert.equal(classifyNtaType(plain, 'business_studies', bst), 'single_mcq', 'BST paper 1 Q4 is a plain MCQ');
  const roman = { body: 'MPC is 0.8. (I) A rise of 50 raises consumption by 40. (II) A rise of 100 raises it by 80. (III) A rise of 50 raises it by 50. (IV) Consumption is 80% of income. Choose the correct answer from the options given below:', options: options(['(I) and (III) only', '(II) and (IV) only', '(I) and (II) only', '(III) and (IV) only']) };
  assert.equal(classifyNtaType(roman, 'economics', types('economics')), 'statement_based', 'Economics paper 1 Q7 counts as statement-based');
  const chronological = { body: 'The team labels do not indicate chronological order. Consider the following statements: (A) R is first. (B) Q precedes P. (C) P is last. (D) S follows Q.', options: options(['(A), (B) and (C) only', '(A), (B) and (D) only', '(A) and (C) only', '(B), (C) and (D) only']) };
  assert.equal(classifyNtaType(chronological, 'business_studies', bst), 'statement_based');
  const lowerRoman = { body: 'Arrange from top management to the workforce: (i) Supervisors pass instructions. (ii) Top management sets goals. (iii) Middle management interprets policies.', options: options(['(i)-(ii)-(iii)', '(iii)-(ii)-(i)', '(ii)-(i)-(iii)', '(ii)-(iii)-(i)']) };
  assert.equal(classifyNtaType(lowerRoman, 'business_studies', bst), 'sequence_ordering');
});

// ---------------------------------------------------------------------------------------------
// Structural gate (P0)
// ---------------------------------------------------------------------------------------------

test('an item whose options do not fit its own stem never enters NTA mode', () => {
  const reasons = (row, subject = 'business_studies') => ntaEligibility(row, { subject }).reasons;
  const brokenSequence = item('business_studies', 'Controlling', 'Arrange the following actions in the correct sequence: (A) Set the range. (B) Identify a deviation. (C) Report it. (D) Act on it. Choose the correct answer from the options given below:',
    ['(A)-(I), (B)-(III), (C)-(II), (D)-(IV)', '(A)-(II), (B)-(I), (C)-(III), (D)-(IV)', '(A)-(I), (B)-(II), (C)-(IV), (D)-(III)', '(A)-(I), (B)-(II), (C)-(III), (D)-(IV)']);
  assert.ok(reasons(brokenSequence).includes('sequence_options_not_orderings_of_stem_items'), 'BST paper 1 Q9');
  const noListTwo = item('business_studies', 'Planning', 'Match List-I with the correct meaning. List-I (A) Policy (B) Rule (C) Method (D) Budget Choose the correct answer from the options given below:',
    ['(A)-(I), (B)-(II), (C)-(III), (D)-(IV)', '(A)-(II), (B)-(I), (C)-(IV), (D)-(III)', '(A)-(III), (B)-(IV), (C)-(I), (D)-(II)', '(A)-(IV), (B)-(III), (C)-(II), (D)-(I)']);
  assert.ok(reasons(noListTwo).includes('match_list_two_missing'));
  const repeated = item('accountancy', 'Accounting Ratios', 'Opening payables are 1,50,000 and closing payables 2,00,000; the turnover ratio is 5 times. What are purchases? A. 1,75,000 B. 6,75,000 C. 8,75,000 D. 17,50,000',
    ['1,75,000', '6,75,000', '8,75,000', '17,50,000']);
  assert.ok(reasons(repeated, 'accountancy').includes('options_repeated_in_stem'), 'Accountancy paper 2 Q9');
  const fine = item('business_studies', 'Controlling', 'Arrange the following steps of controlling in the correct sequence: (A) Measurement of actual performance (B) Setting performance standards (C) Taking corrective action (D) Comparing performance with standards',
    ['(B), (A), (D), (C)', '(A), (B), (C), (D)', '(B), (D), (A), (C)', '(D), (B), (A), (C)']);
  assert.deepEqual(reasons(fine), []);
});

// ---------------------------------------------------------------------------------------------
// Wording gate (P0)
// ---------------------------------------------------------------------------------------------

test('stems that state the rule, point at options, narrate the order or cite "the excerpt" are kept out', () => {
  const reasons = (row, subject) => ntaEligibility(row, { subject }).reasons;
  const singles = ['The answer is the first choice.', 'It is the second choice entirely.', 'It is the third choice entirely.', 'It is the fourth choice entirely.'];
  assert.ok(reasons(item('accountancy', 'Change in Profit Sharing Ratio', 'Old ratio 5:3:2, new ratio 4:2:4. For this question, the amount transferred is goodwill times the fraction gained. Which adjustment is correct?', singles), 'accountancy').includes('stem_states_rule_for_this_question'));
  assert.ok(reasons(item('business_studies', 'Consumer Protection', 'The people named in options B–D are not complainants. Which pair can file?', singles), 'business_studies').includes('stem_refers_to_options'));
  assert.ok(reasons(item('economics', 'Human Capital Formation', 'Output rose from 4,800 to 5,040 units. Is the stated condition for calling the investment unproductive met?', singles), 'economics').includes('stem_cites_unstated_condition'));
  const narrated = item('accountancy', 'Partnership Fundamentals', 'The partners first reach an agreement orally. They then record it in writing. Arrange the events in the order they occur. (A) Consent to the change. (B) The deed is written. (C) Agreement is reached. (D) The clause is changed.',
    ['(C), (B), (A), (D)', '(C), (A), (B), (D)', '(B), (C), (A), (D)', '(C), (B), (D), (A)']);
  assert.ok(reasons(narrated, 'accountancy').includes('sequence_order_narrated_in_stem'));
  const modules = item('economics', 'Environment & Sustainable Development', 'A student is arranging three modules for a unit: (A) Approaches to sustainability (B) Functions of the environment (C) State of the environment. Which sequence follows the presentation?',
    ['(B), (A), (C)', '(C), (B), (A)', '(A), (C), (B)', '(B), (C), (A)']);
  assert.ok(reasons(modules, 'economics').includes('sequence_of_study_material'));
  const excerpt = item('business_studies', 'Staffing', 'Which training method imitates job realities without the cost of real mistakes?', ['Computer modelling of the job', 'Apprenticeship on the shop floor', 'Programmed instruction units', 'Training on the actual job'],
    { explanation: 'The excerpt identifies computer modelling for sophisticated machinery.' });
  assert.ok(reasons(excerpt, 'business_studies').includes('explanation_cites_item_not_concept'));
  const english = item('english', 'Correct Word Usage', 'Choose the sentence in which "versatile" is used in the supplied sense of a person able to do many things.', singles);
  assert.ok(reasons(english, 'english').includes('stem_defines_what_is_tested'));
});

test('the two items the review found defective are quarantined for NTA mode, reversibly', () => {
  assert.equal(ntaQuarantine('40d8ffd980223cc65286a43053bf04de').reason, 'likely_wrong_key');
  assert.equal(ntaQuarantine('24ff7d610823ce693405abfbdfc938f6').reason, 'broken_item');
  const [row] = makeBank('accountancy', { copies: 1 }).filter((entry) => !entry.passage_group_id);
  const { evidence: _e, ...plain } = row;
  const quarantined = signEvidence({ ...plain, id: '40d8ffd980223cc65286a43053bf04de' });
  assert.ok(ntaEligibility(quarantined, { subject: 'accountancy' }).reasons.includes('nta_quarantined'));
});

// ---------------------------------------------------------------------------------------------
// Same question in other words (P0)
// ---------------------------------------------------------------------------------------------

test('same concept, same figures, same text and same headword are one question for the student', () => {
  const features = (row, english = false) => itemFeatures(row, { english });
  const premiumA = item('accountancy', 'Share Capital', 'A company issued shares at a premium; the premium was received before forfeiture. What happens to the premium entry?', ['Leave it unreversed', 'Reverse it', 'Transfer it to forfeiture', 'Debit calls in arrears'], { concept_id: 'company_accounts.share_forfeiture.premium_entry' });
  const premiumB = item('accountancy', 'Share Capital', 'Before shares were validly forfeited, the entire premium due had been received and recorded. What should be done with that entry?', ['Keep it unchanged', 'Reverse it now', 'Move it to Share Forfeiture', 'Debit it to Share Capital'], { concept_id: 'company_accounts_share_forfeiture_premium_entry' });
  assert.equal(conflictReason(features(premiumA), features(premiumB)), 'same_concept', 'Accountancy paper 2 Q12 and Q36');
  const shutdownA = item('economics', 'Theory of Firms under Perfect Competition', 'A price-taking firm can produce 0, 10, 15 or 20 units; minimum AVC is ₹8 at 15 units and the price is ₹6. Which output maximises profit?', ['0 units', '10 units', '15 units', '20 units']);
  const shutdownB = item('economics', 'Theory of Firms under Perfect Competition', 'A firm under perfect competition has a minimum average variable cost of ₹8 and faces a price of ₹6. Which output does it choose?', ['Zero output', 'Where price equals SMC', 'Where price equals AVC', 'Where price exceeds AVC']);
  assert.equal(conflictReason(features(shutdownA), features(shutdownB)), 'same_figures', 'Economics paper 1 Q3 and Q17');
  const wordA = item('english', 'Vocabulary', 'Her supervisor called her work “meticulous”. Which phrase is closest in meaning to “meticulous”?', ['Paying careful attention to every detail', 'Happening at irregular intervals', 'Not supporting one side', 'Showing no interest']);
  const wordB = item('english', 'Correct Word Usage', 'Choose the sentence in which "meticulous" is used correctly.', ['The clerk checked every entry.', 'The clerk ignored errors.', 'The clerk doubted the claim.', 'The clerk spoke aggressively.']);
  assert.ok(headwordsOf(wordA).has('meticulous'));
  assert.equal(conflictReason(features(wordA, true), features(wordB, true)), 'same_headword', 'English Q24 and Q32');
  const other = item('accountancy', 'Share Capital', 'What is the maximum rate of interest payable on calls in advance under Table F?', ['12% per annum', '10% per annum', '6% per annum', '5% per annum'], { concept_id: 'share_capital.calls_in_advance_interest' });
  assert.equal(conflictReason(features(premiumA), features(other)), null);
});

test('the engine never puts two conflicting questions, or two of one learning objective, in one paper', () => {
  const bank = makeBank('accountancy');
  const chapter = 'Share Capital';
  const pair = [
    item('accountancy', chapter, 'A company issued shares at a premium; the premium was received before forfeiture. What happens to the premium entry?', ['Leave it unreversed', 'Reverse it', 'Transfer it to forfeiture', 'Debit calls in arrears'], { id: 'dup-a', concept_id: 'share_forfeiture.premium_entry' }),
    item('accountancy', chapter, 'Before shares were validly forfeited, the entire premium due had been received and recorded. What should be done with that entry?', ['Keep it unchanged', 'Reverse it now', 'Move it to Share Forfeiture', 'Debit it to Share Capital'], { id: 'dup-b', concept_id: 'share_forfeiture_premium_entry' }),
  ];
  const tagged = bank.filter((row) => row.chapter === chapter && !row.passage_group_id).slice(0, 4).map((row) => ({ ...row, nta_objective: 'acc.share_capital.calls_in_advance' }));
  const taggedIds = new Set(tagged.map((row) => row.id));
  const pool = [...bank.filter((row) => !taggedIds.has(row.id)), ...tagged, ...pair];
  for (let seed = 0; seed < 8; seed += 1) {
    const result = assembleNtaPaper(pool, { subject: 'accountancy', seed: `conflict-${seed}` });
    const ids = new Set(result.paper.map((entry) => entry.id));
    assert.ok(!(ids.has(fixtureId('dup-a')) && ids.has(fixtureId('dup-b'))), `seed ${seed}: never both`);
    assert.ok(result.paper.filter((entry) => taggedIds.has(entry.id)).length <= 1, `seed ${seed}: one per objective`);
    assert.equal(result.deviations.filter((deviation) => deviation.severity === 'structure').length, 0);
  }
  // The checker sees what the engine avoids.
  const paper = assembleNtaPaper(bank, { subject: 'accountancy', seed: 'checker' }).paper;
  const forced = [...paper.slice(0, 48), ...[pair[0], pair[1]].map((row, i) => ({ ...paper[48 + i], id: row.id, row, item: undefined, chapter }))];
  assert.ok(checkNtaPaper(forced, getNtaBlueprint('accountancy')).some((deviation) => deviation.kind === 'duplicate' && deviation.actual === 'same_concept'));
});

// ---------------------------------------------------------------------------------------------
// English (P1)
// ---------------------------------------------------------------------------------------------

test('English passages: 200-300 words, distinct children, at least four of them', () => {
  const bank = makeBank('english');
  const sets = [...new Set(bank.filter((row) => row.passage_group_id).map((row) => row.passage_group_id))];
  // Short passages are not CUET passages.
  // About 150 words: a real paragraph, but shorter than the syllabus passage.
  const shortText = (id) => Array.from({ length: 17 }, (_, i) => `${Array.from({ length: 9 }, (_, j) => word(id, i * 9 + j)).join(' ')}.`).join(' ');
  const short = bank.map((row) => (row.passage_group_id ? signEvidence({ ...row, evidence: undefined, passage_text: shortText(row.passage_group_id) }) : row));
  const shortResult = assembleNtaPaper(short, { subject: 'english', seed: 'short' });
  assert.equal(shortResult.refusal.reason, 'no_passage_sets');
  assert.ok(shortResult.pool.excluded.passage_too_short > 0);
  // Two children that ask the same thing count once; a set left with three is not a passage set.
  const target = sets[0];
  const children = bank.filter((row) => row.passage_group_id === target).sort((a, b) => a.order_index - b.order_index);
  const same = 'The narrator keeps the drawing visible beside the photograph without restoring it';
  const rewritten = bank.map((row) => {
    if (row.passage_group_id !== target) return row;
    const index = children.findIndex((child) => child.id === row.id);
    if (index > 1) return row;
    const { evidence: _e, ...plain } = row;
    return signEvidence({ ...plain, options: options([same, `${word(row.id, 70)} ${word(row.id, 71)} ${word(row.id, 72)}`, `${word(row.id, 73)} ${word(row.id, 74)}`, `${word(row.id, 75)} ${word(row.id, 76)}`]) });
  });
  const result = assembleNtaPaper(rewritten, { subject: 'english', seed: 'dedupe' });
  assert.equal(result.pool.excluded.passage_child_repeats_another, 1);
  const served = result.paper.filter((entry) => entry.row.passage_group_id === target);
  assert.ok(served.length === 0 || served.length === children.length - 1, 'the repeated child is never served');
});

// ---------------------------------------------------------------------------------------------
// Numerical share (P2)
// ---------------------------------------------------------------------------------------------

test('the numerical share stays inside the blueprint overlay', () => {
  for (const subject of ['accountancy', 'economics', 'physics']) {
    const range = getNtaBlueprint(subject).overlays.numerical_share;
    const result = assembleNtaPaper(makeBank(subject), { subject, seed: `numerical-${subject}` });
    const count = result.paper.filter((entry) => isNumericalItem(entry.row)).length;
    assert.ok(count >= Math.ceil(range.min * 50) && count <= Math.floor(range.max * 50), `${subject}: ${count} numerical`);
  }
  // A bank of numericals only: the paper stops at the maximum and says what is missing.
  const numericHeavy = makeBank('economics').map((row) => {
    if (row.passage_group_id || !/^Which description/.test(row.body)) return row;
    const { evidence: _e, ...plain } = row;
    const n = (k) => 1000 + ([...`${row.id}:${k}`].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 999983, 7) % 900000);
    const body = `${plain.body} The figures are ₹${n(1)} and ₹${n(2)}.`;
    return signEvidence({ ...plain, body, question: body, options: options([3, 4, 5, 6].map((k) => `₹${n(k)}`)) });
  });
  const capped = assembleNtaPaper(numericHeavy, { subject: 'economics', seed: 'heavy' });
  assert.ok(capped.paper.filter((entry) => isNumericalItem(entry.row)).length <= Math.floor(getNtaBlueprint('economics').overlays.numerical_share.max * 50));
});

// ---------------------------------------------------------------------------------------------
// Pool read through the signed index (P1), cache, messages (P2)
// ---------------------------------------------------------------------------------------------

function fakeDb(tables, { missing = [] } = {}) {
  const calls = [];
  const builder = (table) => {
    const filters = [];
    let range = null;
    let columns = '';
    const query = {
      select(value) { columns = value; calls.push(['select', table, value]); return query; },
      // 'selection_meta->>mode' reads a key of a json column, as PostgREST does.
      eq(column, value) { filters.push((row) => column.split('->>').reduce((cell, key) => cell?.[key], row) === value); return query; },
      is(column, value) { filters.push((row) => (row[column] ?? null) === value); return query; },
      gt(column, value) { filters.push((row) => Number(row[column]) > value); return query; },
      in(column, values) { filters.push((row) => values.includes(row[column])); return query; },
      or() { filters.push((row) => row.evidence != null || Number(row.quality_score) > 0); return query; },
      order() { return query; },
      limit() { return query; },
      range(from, to) { range = [from, to]; return query; },
      abortSignal() { return query; },
      insert() { calls.push(['insert', table]); return Promise.resolve({ error: { code: '42P01', message: 'missing' } }); },
      then(resolve, reject) {
        if (missing.includes(table)) return Promise.resolve({ data: null, error: { code: '42P01', message: 'missing' } }).then(resolve, reject);
        let data = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)));
        if (range) data = data.slice(range[0], range[1] + 1);
        if (columns && columns !== '*') {
          const keep = columns.split(',').map((value) => value.trim());
          data = data.map((row) => Object.fromEntries(keep.filter((key) => key in row).map((key) => [key, row[key]])));
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  };
  return { calls, from: (table) => builder(table) };
}

function indexFor(rows, subject) {
  return rows.map((row) => {
    const record = row.evidence.record;
    const entry = {
      question_id: row.id, subject, score: 8.5, luna: record.checks.exam_fit.item_quality_score, gemini: record.checks.independent_evaluation.item_quality_score,
      content_hash: contentHash(row), family_id: null, objective_tag: null, index_version: NTA_INDEX_VERSION, verified_at: '2026-10-13T12:00:00.000Z',
    };
    return { ...entry, signature: signNtaIndex(entry, FIXTURE_SECRET) };
  });
}

const sideTables = { passage_groups: [], question_content_disputes: [], recovery_family_holds: [], user_question_progress: [], attempts: [] };

test('with the index, the pool is read without the evidence column and still verified', async () => {
  clearNtaPoolCache();
  const questions = makeBank('chemistry');
  const index = indexFor(questions, 'chemistry');
  const db = fakeDb({ questions, nta_question_index: index, ...sideTables });
  const result = await buildNtaPaper(db, 'chemistry', { seed: 'index', seenIds: new Set(), cache: false });
  assert.equal(result.status, 'exact');
  assert.equal(result.pool.source, 'index');
  const questionSelects = db.calls.filter(([kind, table]) => kind === 'select' && table === 'questions');
  assert.ok(questionSelects.length > 0 && questionSelects.every(([, , columns]) => !columns.split(',').includes('evidence')), 'no evidence column read');

  // An index row for content that has changed since scoring is refused; so is a forged signature.
  const changed = questions.map((row, i) => (i < 5 ? { ...row, explanation: `${row.explanation} Edited.` } : row));
  const forged = index.map((row, i) => (i >= 5 && i < 8 ? { ...row, score: 9.5 } : row));
  const tampered = await buildNtaPaper(fakeDb({ questions: changed, nta_question_index: forged, ...sideTables }), 'chemistry', { seed: 'index', seenIds: new Set(), cache: false });
  assert.equal(tampered.pool.excluded.question_changed_since_scored, 5);
  assert.equal(tampered.pool.excluded.score_signature_invalid, 3);

  // No index table yet: the full read with evidence, as before.
  const fallback = await buildNtaPaper(fakeDb({ questions, ...sideTables }, { missing: ['nta_question_index'] }), 'chemistry', { seed: 'index', seenIds: new Set(), cache: false });
  assert.equal(fallback.pool.source, 'full');
  assert.equal(fallback.status, 'exact');
});

test('the subject pool is cached between starts, and a spent read budget gives the student a sentence', async () => {
  clearNtaPoolCache();
  const questions = makeBank('history');
  const db = fakeDb({ questions, nta_question_index: indexFor(questions, 'history'), ...sideTables });
  await buildNtaPaper(db, 'history', { seed: 'one', seenIds: new Set() });
  const reads = db.calls.filter(([, table]) => table === 'questions').length;
  const second = await buildNtaPaper(db, 'history', { seed: 'two', seenIds: new Set() });
  assert.equal(db.calls.filter(([, table]) => table === 'questions').length, reads, 'second start reads no questions');
  assert.equal(second.timings.poolCached, true);
  clearNtaPoolCache();

  const hanging = { from: () => {
    let signal = null;
    const query = new Proxy({}, { get: (_, key) => {
      if (key === 'abortSignal') return (value) => { signal = value; return query; };
      if (key === 'then') return (resolve, reject) => new Promise((_, fail) => signal?.addEventListener('abort', () => fail(new Error('aborted')))).then(resolve, reject);
      return () => query;
    } });
    return query;
  } };
  await assert.rejects(buildNtaPaper(hanging, 'general_test', { seed: 'slow', seenIds: new Set(), timeBudgetMs: 1000, cache: false }), (error) => {
    assert.equal(error.message, 'NTA_TIME_BUDGET_EXCEEDED');
    assert.match(error.publicMessage, /^Building the General Test paper took too long/);
    return true;
  });
});

test('a missing shortfall table costs one failed insert per process, and General Test is named as elsewhere', async () => {
  clearNtaPoolCache();
  const db = fakeDb({});
  const shortfall = { shortfall: { subject: 'economics', variant: 'default', status: 'closest', built: 50, minScore: 8, eligiblePool: 1 } };
  await recordNtaShortfall(db, shortfall);
  await recordNtaShortfall(db, shortfall);
  assert.equal(db.calls.filter(([kind]) => kind === 'insert').length, 1);
  clearNtaPoolCache();
  const empty = assembleNtaPaper([], { subject: 'general_test', seed: 'gt' });
  assert.match(empty.notice.summary, /NTA mode is not ready for General Test yet/);
});

// ---------------------------------------------------------------------------------------------
// Expert review of 13 Oct 2026, papers read in full: one test per finding
// ---------------------------------------------------------------------------------------------

const agentTable = (subject, entries) => ({
  [subject]: {
    subject, rubric_version: 'nta-agent-rubric-1',
    calibration: { status: 'calibrated', threshold: 7, owner_bar: 8, model: 'judge-model', date: '2026-10-13' },
    questions: Object.fromEntries(entries.map(([row, j1 = {}, j2 = {}]) => [row.id, {
      question_id: row.id, key: 'A', content_hash: contentHash(row),
      judges: [['j1', j1], ['j2', j2]].map(([judge, extra]) => ({ judge, model: 'judge-model', date: '2026-10-13', quality_score: 9, blind_answer: 'A', key_matches: true, difficulty_check: 'medium', objective_tag: `${subject}.x.idea-${row.id.slice(0, 6)}`, flags: [], ...extra })),
    }])),
  },
});

test('finding 1: options are served in a per-session order with the key, letters and explanation remapped', () => {
  const row = item('physics', 'Ray Optics and Optical Instruments', 'Two thin lenses of powers +4 D and +2 D are placed in contact. What is the power of the combination?', ['+6 D', '+2 D', '-2 D', '+8 D'], { explanation: 'Powers in contact add, so option A is correct: the answer is (A).' });
  const first = ntaServedRow(row, 'session-1');
  const again = ntaServedRow(row, 'session-1');
  assert.equal(first.shuffled, true);
  assert.deepEqual(first.row.nta_option_order, again.row.nta_option_order, 'same session, same order');
  assert.deepEqual([...first.row.nta_option_order].sort(), [0, 1, 2, 3]);
  assert.deepEqual(first.row.options.map((option) => option.key), ['A', 'B', 'C', 'D'], 'letters follow the served order');
  assert.equal(first.row.options[first.row.correct_index].text, '+6 D', 'the key still names the right answer');
  assert.equal(first.row.correct_answer, 'ABCD'[first.row.correct_index]);
  const letter = first.row.correct_answer;
  assert.equal(first.row.explanation, `Powers in contact add, so option ${letter} is correct: the answer is (${letter}).`);
  // Across sessions the key lands on every letter.
  const positions = new Set(Array.from({ length: 40 }, (_, i) => ntaServedRow(row, `session-${i}`).row.correct_index));
  assert.equal(positions.size, 4);
  // A letter stored in front of every option is removed before the options move (two styles).
  const prefixed = { ...row, options: ['A  7/2', 'B  2/7', 'C  5', 'D  -7/2'] };
  assert.deepEqual([...ntaServedRow(prefixed, 's').row.options].sort(), ['-7/2', '2/7', '5', '7/2']);
  const single = { ...row, options: [{ key: 'A', text: 'A 36' }, { key: 'B', text: 'B 4' }, { key: 'C', text: 'C 9' }, { key: 'D', text: 'D 12' }] };
  const served = ntaServedRow(single, 's').row;
  assert.equal(served.options[served.correct_index].text, '36');
});

test('finding 1: an explanation that names an option in any common phrasing follows the key, or the row keeps its order', () => {
  const lens = (explanation) => item('physics', 'Ray Optics and Optical Instruments', 'Two thin lenses of powers +4 D and +2 D are placed in contact. What is the power of the combination?', ['+6 D', '+2 D', '-2 D', '+8 D'], { explanation });
  // {A} {B} {C} {D}: the served letter of the option that was stored under that letter.
  const phrasings = [
    ['The correct option is A because the powers add.', 'The correct option is {A} because the powers add.'],
    ['The right option is C.', 'The right option is {C}.'],
    ['Option A is correct because the powers add.', 'Option {A} is correct because the powers add.'],
    ['Option B gives the wrong total; option D is too large.', 'Option {B} gives the wrong total; option {D} is too large.'],
    ['Option A gives the sum, while options B and C subtract.', 'Option {A} gives the sum, while options {B} and {C} subtract.'],
    ['Hence the choice would be A.', 'Hence the choice would be {A}.'],
    ['Powers add, so A is correct.', 'Powers add, so {A} is correct.'],
  ];
  let moved = 0;
  for (const [explanation, template] of phrasings) {
    for (let i = 0; i < 40; i += 1) {
      const result = ntaServedRow(lens(explanation), `phrasing-${i}`);
      const order = result.row.nta_option_order;
      assert.equal(result.shuffled, true, explanation);
      const letterOf = (stored) => 'ABCD'[order.indexOf('ABCD'.indexOf(stored))];
      assert.equal(result.row.explanation, template.replace(/\{([A-D])\}/g, (_, stored) => letterOf(stored)), `${explanation} (${i})`);
      assert.equal(result.row.options[result.row.correct_index].text, '+6 D');
      if (order[0] !== 0) moved += 1;
    }
  }
  assert.ok(moved > 0, 'the shuffle moved options');
  // A reference this module cannot rewrite (letters apart from the word) keeps the stored order instead of going stale.
  for (const explanation of ['Option, as powers add, B is not the sum.', 'The second choice, B, is wrong.']) {
    const result = ntaServedRow(lens(explanation), 'stale');
    assert.equal(result.row.explanation, explanation);
    if (!result.shuffled) assert.deepEqual(result.row.nta_option_order, [0, 1, 2, 3]);
  }
  assert.ok(shuffleBlockers(lens('Option, as powers add, B is not the sum.')).includes('explanation_names_an_option'));
  // Prose that merely contains the word "option" is not an option reference.
  assert.equal(ntaServedRow(lens('An option a student might pick is the difference of the powers, which is wrong.'), 'prose').shuffled, true);
});

test('finding 1: options that name other options, error-spotting parts and a fixed last option keep their order', () => {
  const stay = (body, texts) => ntaServedRow(item('business_studies', 'Planning', body, texts), 'session-1');
  for (const [body, texts] of [
    ['Which of these is a feature of planning?', ['It is goal oriented', 'It is pervasive', 'It is continuous', 'All of the above']],
    ['Which of these is a feature of planning?', ['It is goal oriented', 'It is pervasive', 'Both A and B', 'Neither A nor B']],
    ['Identify the part of the sentence that has an error: (A) He go (B) to the market (C) every day.', ['(A)', '(B)', '(C)', 'No error']],
  ]) {
    const result = stay(body, texts);
    assert.equal(result.shuffled, false, texts.join(' | '));
    assert.deepEqual(result.row.nta_option_order, [0, 1, 2, 3]);
    assert.equal(result.row.correct_index, 0);
  }
  // Statement combinations refer to the stem's statements, not to other options: they move.
  const statements = stay('Consider the following statements: (A) Planning is pervasive. (B) Planning is rigid. (C) Planning is continuous. Choose the correct answer from the options given below.', ['(A) and (C) only', '(A) and (B) only', '(B) and (C) only', '(A), (B) and (C)']);
  assert.equal(statements.shuffled, true);
  const roman = stay('Statement I: Planning is pervasive. Statement II: Planning is rigid. Statement III: Planning is continuous. Which statements are correct?', ['I and III only', 'I and II only', 'II and III only', 'I, II and III']);
  assert.equal(roman.shuffled, true);
  assert.equal(roman.row.options[roman.row.correct_index].text, 'I and III only');
});

test('finding 1: a paper serves shuffled rows, the same seed serves the same order, and keys spread over A-D', () => {
  const bank = makeBank('economics');
  const one = assembleNtaPaper(bank, { subject: 'economics', seed: 'shuffle' });
  const two = assembleNtaPaper(bank, { subject: 'economics', seed: 'shuffle' });
  assert.deepEqual(one.rows.map((row) => row.nta_option_order), two.rows.map((row) => row.nta_option_order), 'resume and replay see the same order');
  const keys = new Set(one.rows.map((row) => row.correct_answer));
  assert.ok(keys.size >= 3, `keys ${[...keys]}`);
  for (const [i, row] of one.rows.entries()) {
    const stored = one.paper[i].row;
    assert.equal(row.id, stored.id);
    assert.equal(row.options[row.correct_index].text, stored.options[stored.correct_index].text, `key text kept for ${row.id}`);
  }
  assert.equal(one.structure.optionShuffle.shuffled + one.structure.optionShuffle.keptInPlace, one.paper.length);
  const other = assembleNtaPaper(bank, { subject: 'economics', seed: 'shuffle', shuffleKey: 'another-session' });
  assert.notDeepEqual(other.rows.map((row) => row.nta_option_order), one.rows.map((row) => row.nta_option_order));
});

test('finding 2: a blocking flag from either agent judge vetoes a factory-scored question', () => {
  const [row] = makeBank('accountancy', { copies: 1 }).filter((entry) => !entry.passage_group_id);
  // Whatever else gates the row (the CUET-fit bar has its own fixtures), the veto is its own reason.
  assert.ok(!ntaEligibility(row, { subject: 'accountancy', agentScores: {} }).reasons.includes('agent_blocking_flag'));
  for (const flag of ['factual_error', 'answer_in_stem', 'broken_layout']) {
    const verdict = ntaEligibility(row, { subject: 'accountancy', agentScores: agentTable('accountancy', [[row, {}, { flags: [flag] }]]) });
    assert.equal(verdict.scoreSource, 'evidence_judges');
    assert.ok(verdict.reasons.includes('agent_blocking_flag'), flag);
  }
  // A weakness that is not a blocking flag does not exclude.
  assert.ok(!ntaEligibility(row, { subject: 'accountancy', agentScores: agentTable('accountancy', [[row, { flags: ['weak_distractor'] }]]) }).reasons.includes('agent_blocking_flag'));
  // A judge's spelling of a blocking flag does not decide whether it vetoes.
  for (const flag of ['Wrong_Key', 'factual error', ' FACTUAL-ERROR ']) {
    assert.ok(ntaEligibility(row, { subject: 'accountancy', agentScores: agentTable('accountancy', [[row, {}, { flags: [flag] }]]) }).reasons.includes('agent_blocking_flag'), flag);
  }
});

test('finding 3: rows whose id is not a UUID, and seed or demo rows, never enter NTA mode', () => {
  assert.equal(isNtaQuestionId('05030c47-80ff-456f-ae39-20bfa069d5f3'), true);
  assert.equal(isNtaQuestionId('40d8ffd980223cc65286a43053bf04de'), true, 'factory ids are UUIDs without hyphens');
  for (const id of ['a2', 'e1', 'g1', 'm3', 'dup-a', '']) assert.equal(isNtaQuestionId(id), false, id);
  const [row] = makeBank('economics', { copies: 1 }).filter((entry) => !entry.passage_group_id);
  const { evidence: _e, ...plain } = row;
  assert.ok(ntaEligibility(signEvidence({ ...plain, id: 'e1', source: 'PYQ 2023' }), { subject: 'economics' }).reasons.includes('id_not_uuid'));
  assert.ok(ntaEligibility({ ...row, source: 'demo' }, { subject: 'economics' }).reasons.includes('seed_or_demo_row'));
  assert.ok(ntaEligibility({ ...row, tags: ['seed:2026-04'] }, { subject: 'economics' }).reasons.includes('seed_or_demo_row'));
  assert.deepEqual(seedOrDemoReasons({ ...row, source: 'PYQ 2023' }), []);
  // Marker spellings: an underscore is not a word break, a tag may be spaced, a marker may follow the real source.
  for (const marked of [{ source: 'seed_import' }, { provenance: { kind: 'demo_import' } }, { tags: ['seed 2026-04'] }, { tags: ['Seed 2026'] }, { source: 'PYQ 2023 (seed)' }, { source: 'PYQ demo' }]) {
    assert.deepEqual(seedOrDemoReasons({ ...row, ...marked }), ['seed_or_demo_row'], JSON.stringify(marked));
  }
  assert.deepEqual(seedOrDemoReasons({ ...row, source: 'Seedling Academy PYQ 2023', tags: ['seedless-grape'] }), [], 'real words that start with seed');
  // The id is the stored id: a padded one would miss every Set and Map keyed by it.
  assert.deepEqual(seedOrDemoReasons({ ...row, id: ` ${row.id} ` }), ['id_not_uuid']);
  // In a paper: the seed copies are counted out, never served.
  const bank = makeBank('economics');
  const seeds = bank.filter((entry) => !entry.passage_group_id).slice(0, 15).map((entry, i) => {
    const { evidence: _x, ...rest } = entry;
    return signEvidence({ ...rest, id: `${'gaebm'[i % 5]}${i}`, family_id: `seed-${i}`, body: `${rest.body} (seed)`, question: `${rest.question} (seed)` });
  });
  const result = assembleNtaPaper([...bank, ...seeds], { subject: 'economics', seed: 'seeds' });
  assert.ok(result.paper.every((entry) => isNtaQuestionId(entry.id)));
  assert.equal(result.pool.excluded.id_not_uuid, 15);
});

test('finding 4: the "only" to "mainly" corruption is caught; ordinary "mainly" is not', () => {
  const corrupted = [
    ['Which statements are valid? Statement I: ... Statement II: ...', ['I and III mainly', 'I and II mainly', 'II and III mainly', 'I, II and III']],
    ['If A and B are symmetric, then AB is symmetric if and mainly if AB = BA. Which is correct?', ['True', 'False', 'Sometimes', 'Never']],
    ['Assertion: Each codon codes for mainly one amino acid. Reason: The code is degenerate.', ['Both true', 'A true, R false', 'A false, R true', 'Both false']],
    ['Which is correct about the lac operon?', ['The operon is mainly partially induced because glucose is present', 'It is repressed', 'It is induced', 'It is deleted']],
    ['Which deficit shows borrowing for interest payments?', ['Revenue deficit mainly', 'Fiscal deficit mainly', 'Primary deficit mainly', 'None of these']],
    ['Which statement is correct?', ['Statement I is the mainly objective.', 'Both are correct', 'Neither is correct', 'II only']],
    ['Statement I: Total internal reflection occurs mainly when light travels from a denser to a rarer medium. Statement II: The critical angle depends on the pair of media.', ['Both statements are true', 'Only I is true', 'Only II is true', 'Neither is true']],
  ];
  for (const [body, texts] of corrupted) {
    const row = item('economics', 'Government Budget and the Economy', body, texts);
    assert.ok(corruptedConnectives(row).length > 0, body);
    assert.ok(ntaEligibility(row, { subject: 'economics' }).reasons.includes('wording_corrupted_connective'), body);
  }
  const fine = item('biology', 'Environmental Issues', 'Acid rain is mainly caused by which pair of gases released by burning fossil fuels?', ['Sulphur dioxide and nitrogen oxides', 'Carbon dioxide and methane', 'Ozone and CFCs', 'Hydrogen and helium'], { explanation: 'It is mainly due to SO2 and NOx, which form acids in rain water.' });
  assert.deepEqual(corruptedConnectives(fine), []);
  // A number or a vitamin letter after a comma is not a label list closed by "mainly".
  for (const body of ['Calculate the cost of 5 items, 2 mainly for households, if each costs Rs 40.', 'Vitamin A, B mainly supports vision and metabolism. Which is correct?']) {
    assert.deepEqual(corruptedConnectives(item('economics', 'Introduction to Macroeconomics', body, ['Rs 200', 'Rs 80', 'Rs 120', 'Rs 40'])), [], body);
  }
});

test('finding 6: one concept appears once per paper even when the judges spell its tag differently', () => {
  const features = (row, agentScores, english = false) => itemFeatures(row, { english, agentScores });
  const lenzA = item('physics', 'Electromagnetic Induction', 'A bar magnet is pushed towards a closed copper ring. What is the direction of the current induced in the ring?', ['It opposes the approach of the magnet', 'It aids the approach', 'No current flows', 'It reverses every second']);
  const lenzB = item('physics', 'Alternating Current', 'Why does a copper sheet slow down a magnet that falls past it?', ['Induced currents oppose the change that causes them', 'Copper is magnetic', 'Air resistance', 'Gravity is reduced']);
  const other = item('physics', 'Wave Optics', 'What does the fringe width in Young\'s double-slit experiment depend on?', ['Wavelength, slit separation and screen distance', 'Only the source intensity', 'Only the slit width', 'The colour of the screen']);
  const scores = agentTable('physics', [
    [lenzA, { objective_tag: 'physics.electromagnetic-induction.lenz-law-direction' }, { objective_tag: 'physics.electromagnetic-induction.induced-current-direction' }],
    [lenzB, { objective_tag: 'physics.alternating-current.eddy-current-braking' }, { objective_tag: 'physics.alternating-current.lenz-law-opposes-motion' }],
    [other, { objective_tag: 'physics.wave-optics.fringe-width-factors' }, { objective_tag: 'physics.wave-optics.ydse-fringe-width' }],
  ]);
  assert.equal(conflictReason(features(lenzA, scores), features(lenzB, scores)), 'same_concept_words', 'Lenz\'s law under two tags and two chapters');
  assert.equal(conflictReason(features(lenzA, scores), features(other, scores)), null);
  // The same short answer twice ("Directing") is one concept.
  const whichA = item('business_studies', 'Directing', 'A manager instructs, guides, motivates and leads people to achieve objectives. Which function is this?', ['Directing', 'Planning', 'Staffing', 'Controlling']);
  const whichB = item('business_studies', 'Nature and Significance of Management', 'Which function of management initiates action in an organisation through supervision and communication?', ['Directing', 'Organising', 'Planning', 'Staffing']);
  assert.equal(conflictReason(features(whichA), features(whichB)), 'same_key_answer');
  // Near-identical wording with different figures, whatever the tags say.
  const seriesA = item('physics', 'Electrostatic Potential and Capacitance', 'Two capacitors C1 = 2.0 μF and C2 = 3.0 μF are connected in series across a 100 V battery. What is the voltage across C1?', ['60 V', '40 V', '50 V', '100 V']);
  const seriesB = item('physics', 'Electrostatic Potential and Capacitance', 'Two capacitors C1 = 2.0 μF and C2 = 3.0 μF are connected in series across a 12 V battery. The total energy stored in the combination is', ['86.4 μJ', '144 μJ', '43.2 μJ', '72 μJ']);
  assert.equal(stemWordingAlike(features(seriesA), features(seriesB)), true, 'the character 5-gram guard sees the pair on its own');
  assert.ok(['near_duplicate_stem_chars', 'near_duplicate_stem', 'near_duplicate_text'].includes(conflictReason(features(seriesA), features(seriesB))), 'and the pair conflicts for wording, not by chance of figures');
  // Wording shared by many stems of the pool (a template) is weighed down: only rare 5-grams make two stems alike.
  const template = (n) => item('general_test', 'General Knowledge', `Read the following carefully and answer: in the yearly report, the auditor noted that the clerk ${word(`t${n}`, 1)} ${word(`t${n}`, 2)} ${word(`t${n}`, 3)} ${word(`t${n}`, 4)}.`, ['One', 'Two', 'Three', 'Four']);
  const templated = Array.from({ length: 12 }, (_, n) => template(n));
  const weights = stemGramWeights([...templated, ...makeBank('general_test', { copies: 1 })]);
  assert.equal(stemWordingAlike(itemFeatures(templated[0]), itemFeatures(templated[1])), true, 'unweighted, the template alone makes them alike');
  assert.equal(stemWordingAlike(itemFeatures(templated[0], { gramWeights: weights }), itemFeatures(templated[1], { gramWeights: weights })), false);
  // The engine keeps the pair apart in every paper.
  const bank = makeBank('physics');
  const twins = [lenzA, lenzB].map((row) => ({ ...row, chapter: 'Electromagnetic Induction' }));
  const twinScores = agentTable('physics', [[twins[0], { objective_tag: 'physics.electromagnetic-induction.lenz-law-direction' }], [twins[1], { objective_tag: 'physics.electromagnetic-induction.lenz-law-opposes-motion' }]]);
  for (let seed = 0; seed < 6; seed += 1) {
    const ids = new Set(assembleNtaPaper([...bank, ...twins], { subject: 'physics', seed: `lenz-${seed}`, agentScores: twinScores }).paper.map((entry) => entry.id));
    assert.ok(!(ids.has(twins[0].id) && ids.has(twins[1].id)), `seed ${seed}`);
  }
});

test('finding 7: the stored difficulty stands unless both judges put it two levels away', () => {
  const corrections = { q1: { from: 'hard', to: 'medium' }, q2: { from: 'hard', to: 'easy' }, q3: { from: 'easy', to: 'hard' }, q4: { from: 'medium', to: 'easy' } };
  assert.equal(ntaDifficultyOf({ id: 'q1', difficulty: 'hard' }, { corrections }), 'hard', 'one level: the label stands');
  assert.equal(ntaDifficultyOf({ id: 'q2', difficulty: 'hard' }, { corrections }), 'easy');
  assert.equal(ntaDifficultyOf({ id: 'q3', difficulty: 'easy' }, { corrections }), 'hard');
  assert.equal(ntaDifficultyOf({ id: 'q4', difficulty: 'medium' }, { corrections }), 'medium');
  assert.equal(ntaDifficultyOf({ id: 'q2', difficulty: 'medium' }, { corrections }), 'medium', 'a later edit wins');
  assert.equal(ntaDifficultyOf({ id: 'constructor', difficulty: 'hard' }, { corrections }), 'hard', 'an id that is an Object member is not a correction');
  for (const [id, entry] of Object.entries(committedDifficulty.questions)) {
    assert.equal(Math.abs(['easy', 'medium', 'hard'].indexOf(entry.from) - ['easy', 'medium', 'hard'].indexOf(entry.to)), 2, id);
  }
});

test('finding 8: a sequence or match key in the listed order is a giveaway and is kept out', () => {
  const sequence = (key) => item('history', 'Kings, Farmers and Towns', 'Arrange the following in chronological order: (A) Mauryan empire (B) Gupta empire (C) Delhi Sultanate (D) Mughal empire', [key, '(B), (A), (D), (C)', '(C), (A), (B), (D)', '(D), (C), (B), (A)']);
  assert.deepEqual(listedOrderKeyReasons(sequence('(A), (B), (C), (D)'), 'sequence_ordering'), ['sequence_key_is_listed_order']);
  assert.deepEqual(listedOrderKeyReasons(sequence('(A), (C), (B), (D)'), 'sequence_ordering'), []);
  assert.ok(ntaEligibility(sequence('(A), (B), (C), (D)'), { subject: 'history' }).reasons.includes('sequence_key_is_listed_order'));
  const match = (key) => item('business_studies', 'Principles of Management', 'Match List-I with List-II. List-I (A) Order (B) Equity (C) Unity of command (D) Esprit de corps List-II (I) Right place for things (II) Kindness and justice (III) One boss (IV) Team spirit', [key, '(A)-(II), (B)-(I), (C)-(IV), (D)-(III)', '(A)-(III), (B)-(IV), (C)-(I), (D)-(II)', '(A)-(IV), (B)-(III), (C)-(II), (D)-(I)']);
  assert.deepEqual(listedOrderKeyReasons(match('(A)-(I), (B)-(II), (C)-(III), (D)-(IV)'), 'match_the_following'), ['match_key_is_listed_order']);
  assert.deepEqual(listedOrderKeyReasons(match('(A)-(II), (B)-(I), (C)-(IV), (D)-(III)'), 'match_the_following'), []);
  // The giveaway in other spellings: numbered, the items' own text in printed order, or a two-pair match key.
  assert.deepEqual(listedOrderKeyReasons(sequence('1. 2. 3. 4.'), 'sequence_ordering'), ['sequence_key_is_listed_order']);
  assert.deepEqual(listedOrderKeyReasons(sequence('Mauryan empire, Gupta empire, Delhi Sultanate, Mughal empire'), 'sequence_ordering'), ['sequence_key_is_listed_order']);
  assert.deepEqual(listedOrderKeyReasons(sequence('Gupta empire, Mauryan empire, Delhi Sultanate, Mughal empire'), 'sequence_ordering'), []);
  assert.deepEqual(listedOrderKeyReasons(match('(A)-(I), (B)-(II)'), 'match_the_following'), ['match_key_is_listed_order']);
  // A stem that prints its items out of alphabetical order: only the printed order is the giveaway.
  const shuffled = (key) => item('history', 'Kings, Farmers and Towns', 'Arrange the following in chronological order: (C) Delhi Sultanate (A) Mauryan empire (D) Mughal empire (B) Gupta empire', [key, '(B), (A), (D), (C)', '(A), (C), (B), (D)', '(D), (C), (B), (A)']);
  assert.deepEqual(listedOrderKeyReasons(shuffled('(A), (B), (C), (D)'), 'sequence_ordering'), []);
  assert.deepEqual(listedOrderKeyReasons(shuffled('(C), (A), (D), (B)'), 'sequence_ordering'), ['sequence_key_is_listed_order']);
});

test('finding 9: a student\'s next paper leaves out the questions of earlier papers when the pool allows', () => {
  const bank = makeBank('accountancy');
  const first = assembleNtaPaper(bank, { subject: 'accountancy', seed: 'student-1' });
  const previous = new Set(first.paper.map((entry) => entry.id));
  const second = assembleNtaPaper(bank, { subject: 'accountancy', seed: 'student-2', previousPaperIds: previous });
  assert.notEqual(second.status, 'refused');
  assert.equal(second.paper.filter((entry) => previous.has(entry.id)).length, 0);
  assert.equal(second.structure.crossPaper.fallback, false);
  assert.ok(second.structure.crossPaper.leftOut >= 45);
  assert.equal(second.pool.excluded.served_in_previous_nta_paper, second.structure.crossPaper.leftOut);
  // A thin bank cannot: the paper is built from the whole pool, earlier questions only where nothing new fits, and the reason is recorded.
  const thinPrevious = new Set(first.paper.map((entry) => entry.id));
  const thin = [...first.paper.map((entry) => entry.row), ...bank.filter((row) => !thinPrevious.has(row.id) && !row.passage_group_id).slice(0, 8)];
  const thinSecond = assembleNtaPaper(thin, { subject: 'accountancy', seed: 'thin-2', previousPaperIds: thinPrevious });
  assert.notEqual(thinSecond.status, 'refused');
  assert.equal(thinSecond.structure.crossPaper.fallback, true);
  assert.equal(thinSecond.structure.crossPaper.reason, 'pool_too_small_without_previous_papers');
  assert.equal(thinSecond.structure.crossPaper.repeated, thinSecond.paper.filter((entry) => thinPrevious.has(entry.id)).length);
  assert.ok(thinSecond.structure.crossPaper.repeated < thinSecond.paper.length);
  assert.equal(thinSecond.shortfall.crossPaper.reason, 'pool_too_small_without_previous_papers');
});

test('finding 9: the loader reads a student\'s earlier NTA papers from attempts and kept sessions', async () => {
  const rows = { attempts: [
    { user_id: 'u1', subject: 'economics', questions_snapshot: [{ id: 'q-nta-1' }, { id: 'q-nta-2' }], selection_meta: { mode: 'nta' } },
    { user_id: 'u1', subject: 'economics', questions_snapshot: [{ id: 'q-quick' }], selection_meta: { mode: 'quick' } },
  ], recovery_sessions: [{ user_id: 'u1', subject: 'economics', mode: 'nta', questions: [{ id: 'q-open' }] }] };
  const ids = await loadPreviousNtaPaperIds(fakeDb(rows), 'u1', 'economics');
  assert.deepEqual([...ids].sort(), ['q-nta-1', 'q-nta-2', 'q-open']);
  assert.equal((await loadPreviousNtaPaperIds(fakeDb(rows), null, 'economics')).size, 0);
  const failing = { from: () => { throw new Error('down'); } };
  const failed = await loadPreviousNtaPaperIds(failing, 'u1', 'economics');
  assert.equal(failed.size, 0, 'a failed lookup means no earlier paper');
  assert.equal(failed.lookupFailed, true, 'and the failure is recorded');
  assert.equal(ids.lookupFailed, undefined);
  // Only NTA attempts are asked for, so many other attempts in the subject cannot push earlier NTA papers out of the window.
  const crowded = { attempts: [
    ...Array.from({ length: 60 }, (_, i) => ({ user_id: 'u1', subject: 'economics', questions_snapshot: [{ id: `q-other-${i}` }], selection_meta: { mode: 'quick' } })),
    { user_id: 'u1', subject: 'economics', questions_snapshot: [{ id: 'q-old-nta' }], selection_meta: { mode: 'nta' } },
  ], recovery_sessions: [] };
  assert.deepEqual([...await loadPreviousNtaPaperIds(fakeDb(crowded), 'u1', 'economics')], ['q-old-nta']);
});
