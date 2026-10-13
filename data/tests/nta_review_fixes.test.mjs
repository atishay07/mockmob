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
import { buildNtaPaper, clearNtaPoolCache, recordNtaShortfall } from '../nta_pool.js';
import { conflictReason, headwordsOf, isNumericalItem, itemFeatures, ntaQuarantine } from '../nta_item_checks.js';
import { contentHash } from '../content_evidence.js';
import { FIXTURE_SECRET, makeBank, signEvidence, word } from './ntaEngineFixtures.mjs';

const options = (texts) => texts.map((text, i) => ({ key: 'ABCD'[i], text }));
const types = (subject) => Object.keys(getNtaBlueprint(subject).typeQuotas);

function item(subject, chapter, body, optionTexts, extra = {}) {
  return signEvidence({
    id: extra.id || `t-${Math.random().toString(36).slice(2)}`,
    subject, chapter, body, question: body, options: options(optionTexts), correct_answer: 'A', correct_index: 0,
    explanation: extra.explanation || 'Because the rule in the chapter says so.', difficulty: 'medium', status: 'live',
    is_deleted: false, verification_state: 'verified', quality_score: 0, family_id: extra.family_id || `fam-${extra.id || Math.random()}`,
    question_type: extra.question_type ?? null, concept_id: extra.concept_id ?? '', score: 0, order_index: 0, ...extra,
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
    assert.ok(!(ids.has('dup-a') && ids.has('dup-b')), `seed ${seed}: never both`);
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
      eq(column, value) { filters.push((row) => row[column] === value); return query; },
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
