// Pre-deploy review of engine r5 (14 Oct): a student's next paper is never refused because seen questions
// were held back (repeats are allowed, and said), and a pool with no eligible question is refused with the
// gate that kept most questions out, not always "quality". Plus the refusal detail the website reads.
// Synthetic fixtures prove the engine's behaviour only, never academic quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as h from './nta_e2e_harness.mjs'; // registers the '@/' and 'server-only' hooks ntaPaper.js needs
import { NTA_MIN_SERVE_QUESTIONS, assembleNtaPaper, ntaEligibility, ntaGateOf } from '../nta_engine.js';
import { makeBank, signEvidence } from './ntaEngineFixtures.mjs';

const { assertNtaPaperServable, NTA_BANK_REFUSALS } = await import(pathToFileURL(path.join(h.ROOT, 'src', 'lib', 'server', 'ntaPaper.js')).href);

const SUBJECT = 'accountancy';
const ids = (result) => result.paper.map((entry) => entry.id);

/**
 * A student's first paper, then a pool for the second one in which the seen-first build falls short:
 * the first paper's standalone questions plus `extra` new ones, each new one repeating two questions of
 * the first paper (one by family, one by duplicate group). Holding the earlier questions back lets
 * every new question in first, and each one shuts out two earlier ones.
 */
function secondPaperPool(extra, firstSeed = 'repeat-1') {
  const bank = makeBank(SUBJECT);
  const first = assembleNtaPaper(bank, { subject: SUBJECT, seed: firstSeed });
  const previous = new Set(ids(first));
  const earlier = first.paper.map((entry) => entry.row).filter((row) => !row.passage_group_id).map((row) => ({ ...row }));
  const fresh = [];
  for (let i = 0; i < extra; i += 1) {
    const [a, b] = [earlier[2 * i], earlier[2 * i + 1]];
    b.duplicate_group_id = `dup-repeat-${i}`;
    const base = bank.find((row) => !previous.has(row.id) && !row.passage_group_id && row.chapter === a.chapter && !fresh.some((other) => other.id === row.id));
    fresh.push({ ...base, family_id: a.family_id, duplicate_group_id: `dup-repeat-${i}` });
  }
  const pool = [...earlier, ...fresh].map((row) => signEvidence(row));
  return { first, previous, pool, earlier };
}

function assertServedWithRepeats(result, { previous, used, subject = SUBJECT, disputedIds }) {
  assert.notEqual(result.status, 'refused', result.notice.summary);
  assert.ok(result.paper.length >= NTA_MIN_SERVE_QUESTIONS, `${result.paper.length} questions`);
  assert.equal(result.structure.repeatFallback.builds.seen_first.status, 'refused', 'the seen-first build alone would have refused');
  assert.equal(result.structure.repeatFallback.used, used);
  assert.equal(result.structure.seenPolicy, used);
  // Every gate and every structure check still holds.
  assert.deepEqual(result.deviations.filter((deviation) => deviation.severity === 'structure'), []);
  for (const entry of result.paper) assert.ok(ntaEligibility(entry.row, { subject, disputedIds }).eligible, entry.id);
  if (previous) {
    const repeated = result.paper.filter((entry) => previous.has(entry.id)).length;
    assert.ok(repeated > 0);
    assert.equal(result.structure.crossPaper.repeated, repeated);
    assert.equal(result.structure.crossPaper.repeatsAllowed, true);
    assert.ok(result.notice.items.includes(`${repeated} questions repeat from your earlier NTA papers: there are not enough new questions that fit the pattern.`), JSON.stringify(result.notice.items));
  }
}

// ---- 1. repeats instead of refusals --------------------------------------------------------------

test('a second paper the seen-first build cannot serve is built with repeats allowed, and the notice says so', () => {
  // Six new questions: the seen-first build places 44 (refused); letting a seen question give way only to
  // an equally useful new one is enough.
  const six = secondPaperPool(6);
  const relaxed = assembleNtaPaper(six.pool, { subject: SUBJECT, seed: 'repeat-2', previousPaperIds: six.previous });
  assertServedWithRepeats(relaxed, { previous: six.previous, used: 'relaxed' });
  assert.equal(relaxed.structure.crossPaper.fallback, true);
  assert.equal(relaxed.structure.crossPaper.withoutPrevious.status, 'refused');
  assert.equal(relaxed.shortfall.crossPaper.repeatsAllowed, true);
  // Same inputs, same paper (the website retries with the same key).
  assert.deepEqual(ids(assembleNtaPaper(six.pool, { subject: SUBJECT, seed: 'repeat-2', previousPaperIds: six.previous })), ids(relaxed));

  // Eight, on another first paper: even the relaxed build falls short (43), so the paper is built as if
  // nothing had been seen.
  const eight = secondPaperPool(8, 'p1');
  const none = assembleNtaPaper(eight.pool, { subject: SUBJECT, seed: 'p2', previousPaperIds: eight.previous });
  assertServedWithRepeats(none, { previous: eight.previous, used: 'none' });
  assert.equal(none.structure.repeatFallback.builds.relaxed.status, 'refused');
  // Seen questions are still counted when nothing holds them back.
  assert.equal(none.structure.seenUsed, none.structure.crossPaper.repeated);
});

test('repeats keep every gate: a disputed earlier question is never served again', () => {
  const { pool, previous, earlier } = secondPaperPool(6);
  const disputedIds = new Set([earlier[earlier.length - 1].id, earlier[earlier.length - 2].id]);
  const result = assembleNtaPaper(pool, { subject: SUBJECT, seed: 'repeat-2', previousPaperIds: previous, disputedIds });
  assert.notEqual(result.status, 'refused');
  for (const id of disputedIds) assert.ok(!ids(result).includes(id), `${id} is disputed`);
  assertServedWithRepeats(result, { previous, used: result.structure.seenPolicy, disputedIds });
});

test('questions answered in practice never cause a refusal either, and are named as answered before', () => {
  const { pool, earlier } = secondPaperPool(6);
  const seenIds = new Set(earlier.map((row) => row.id));
  const result = assembleNtaPaper(pool, { subject: SUBJECT, seed: 'practice-seen', seenIds });
  assertServedWithRepeats(result, { used: result.structure.seenPolicy });
  const seen = result.paper.filter((entry) => seenIds.has(entry.id)).length;
  assert.equal(result.structure.seenUsed, seen);
  assert.ok(result.notice.items.includes(`${seen} questions are ones you have answered before: there are not enough new questions that fit the pattern.`), JSON.stringify(result.notice.items));
  assert.ok(!result.notice.items.some((item) => /earlier NTA papers/.test(item)), 'no earlier paper here');
});

test('a paper the seen-first build serves is unchanged, and a thin bank without seen questions is not rebuilt', () => {
  const bank = makeBank(SUBJECT);
  const plain = assembleNtaPaper(bank, { subject: SUBJECT, seed: 'unchanged' });
  assert.equal(plain.structure.seenPolicy, 'seen_first');
  assert.equal(plain.structure.repeatFallback, undefined);
  const tiny = assembleNtaPaper(makeBank('history', { copies: 1, sets: 0 }).slice(0, 30), { subject: 'history', seed: 'tiny', seenIds: new Set() });
  assert.equal(tiny.refusal.reason, 'too_few_questions');
  assert.equal(tiny.structure.repeatFallback, undefined, 'nothing seen, nothing to relax');
});

// ---- 2. a refused paper is not described as if it existed ------------------------------------------

test('a refusal lists what the bank is short of, never positions, layout or repeats of a paper nobody sees', () => {
  // History asks for two case-based sets; this bank has none, so a served paper would say which
  // positions are standalone instead. A refused one must not.
  const tiny = assembleNtaPaper(makeBank('history', { copies: 1, sets: 0 }).slice(0, 30), { subject: 'history', seed: 'tiny' });
  assert.equal(tiny.status, 'refused');
  assert.ok(tiny.deviations.some((deviation) => deviation.kind === 'sets_substituted'), 'the shortfall still records the missing sets');
  assert.ok(tiny.notice.items.length > 0, 'what the bank lacks is still listed');
  for (const item of tiny.notice.items) {
    assert.doesNotMatch(item, /\bQ\d+|standalone|This paper has|Difficulty mix|next to each other|answered before|earlier NTA papers/, item);
  }
});

// ---- 3. the refusal names the gate that kept most questions out ------------------------------------

test('every eligibility reason belongs to one gate', () => {
  for (const reason of ['fit_not_judged', 'fit_below_bar', 'fit_flagged', 'fit_question_changed', 'fit_type_not_in_pattern']) assert.equal(ntaGateOf(reason), 'fit', reason);
  for (const reason of ['no_score', 'score_below_threshold', 'score_unsigned', 'score_unverifiable_no_signing_key', 'score_signature_invalid', 'question_changed_since_scored', 'score_needs_both_judges', 'blind_solver_key_missing', 'agent_score_uncalibrated', 'agent_score_provenance_missing']) assert.equal(ntaGateOf(reason), 'quality', reason);
  for (const reason of ['key_disputed', 'family_held', 'nta_quarantined', 'agent_blocking_flag', 'agent_key_dispute', 'agent_blind_key_mismatch', 'blind_solver_key_mismatch', 'match_options_not_pairings', 'wording_corrupted_connective', 'community_voted_down']) assert.equal(ntaGateOf(reason), 'veto', reason);
  for (const reason of ['not_published', 'id_not_uuid', 'seed_or_demo_row']) assert.equal(ntaGateOf(reason), 'other', reason);
});

function refused(rows, options = {}) {
  const result = assembleNtaPaper(rows, { subject: 'history', seed: 'cause', ...options });
  assert.equal(result.status, 'refused');
  assert.equal(result.refusal.reason, 'no_scored_questions');
  assert.equal(result.shortfall.cause, result.refusal.cause);
  return result;
}

test('no eligible question: the sentence names the dominant gate, and blames quality only when quality is it', () => {
  const unjudged = refused(makeBank('history', { copies: 1, fitFor: () => false }));
  assert.equal(unjudged.refusal.cause, 'fit_not_judged');
  assert.match(unjudged.notice.summary, /^NTA mode is not ready for History yet: no question passes every check, and most have not yet been checked against the real CUET paper\. Try a Full Mock for History instead/);
  assert.doesNotMatch(unjudged.notice.summary, /quality score/);

  const lowFit = refused(makeBank('history', { copies: 1, fitFor: () => ({ score: 6 }) }));
  assert.equal(lowFit.refusal.cause, 'fit_below_bar');
  assert.match(lowFit.notice.summary, /most were judged not close enough to real CUET questions/);

  const lowScore = refused(makeBank('history', { copies: 1, scoreFor: () => 7 }));
  assert.equal(lowScore.refusal.cause, 'quality');
  assert.match(lowScore.notice.summary, /most do not have a checked quality score of 8 or more out of 10/);

  const bank = makeBank('history', { copies: 1 });
  const vetoed = refused(bank, { disputedIds: new Set(bank.map((row) => row.id)) });
  assert.equal(vetoed.refusal.cause, 'veto');
  assert.match(vetoed.notice.summary, /most are held back by checks on their answer key, wording or format/);
  assert.deepEqual(vetoed.shortfall.excludedRows, { quality: 0, fit: 0, veto: bank.length, other: 0, fitNotJudged: 0 });

  const offSyllabus = refused(makeBank('history', { copies: 1 }).map(({ evidence, ...row }) => signEvidence({ ...row, chapter: 'A chapter this paper does not ask' })));
  assert.equal(offSyllabus.refusal.cause, 'syllabus');
  assert.match(offSyllabus.notice.summary, /the questions that pass every check are from chapters this paper does not cover/);

  const empty = refused([]);
  assert.equal(empty.refusal.cause, 'unscored');
  assert.match(empty.notice.summary, /have not been quality-scored/);
  for (const result of [unjudged, lowFit, lowScore, vetoed, offSyllabus, empty]) {
    assert.doesNotMatch(result.notice.summary, /[!—]/, 'owner copy rules: no exclamation marks or em dashes');
    assert.deepEqual(result.notice.items, []);
  }
});

test('with several gates at work, the one that kept out the most questions decides', () => {
  // Seven in ten were never fit-judged (good scores); three in ten score 7 (fit-judged): fit decides.
  const fitMostly = makeBank('history', { copies: 1, fitFor: (row) => (Number(row.fixture_label.split('-').at(-1)) % 10 < 7 ? false : {}), scoreFor: (row) => (Number(row.fixture_label.split('-').at(-1)) % 10 < 7 ? 9 : 7) });
  assert.equal(refused(fitMostly).refusal.cause, 'fit_not_judged');
  // The reverse: quality decides, and the sentence says so.
  const qualityMostly = makeBank('history', { copies: 1, fitFor: (row) => (Number(row.fixture_label.split('-').at(-1)) % 10 < 3 ? false : {}), scoreFor: (row) => (Number(row.fixture_label.split('-').at(-1)) % 10 < 3 ? 9 : 7) });
  const quality = refused(qualityMostly);
  assert.equal(quality.refusal.cause, 'quality');
  assert.ok(quality.shortfall.excludedRows.quality > quality.shortfall.excludedRows.fit);
});

// ---- the refusal detail the website reads ---------------------------------------------------------

test('a refusal the bank decides is marked not retryable; a slow or failed build stays retryable', () => {
  const thrown = (meta) => { try { assertNtaPaperServable([], meta); } catch (error) { return error; } assert.fail('not refused'); };
  for (const reason of ['no_scored_questions', 'no_passage_sets', 'too_few_questions']) {
    assert.ok(NTA_BANK_REFUSALS.has(reason));
    const error = thrown({ ntaPaper: { status: 'refused', refusal: { reason, cause: reason === 'no_scored_questions' ? 'fit_not_judged' : undefined }, notice: { summary: 'The engine sentence.', items: ['A shortage.'] } } });
    assert.equal(error.message, 'INSUFFICIENT_PRACTICE_CONTENT');
    assert.equal(error.publicMessage, 'The engine sentence.');
    assert.equal(error.publicDetail.reason, reason);
    assert.equal(error.publicDetail.retryable, false);
    assert.deepEqual(error.publicDetail.items, ['A shortage.']);
    if (reason === 'no_scored_questions') assert.equal(error.publicDetail.cause, 'fit_not_judged');
    else assert.equal('cause' in error.publicDetail, false);
  }
  for (const reason of ['time_budget', 'engine_error']) {
    assert.equal(thrown({ ntaPaper: { status: 'refused', refusal: { reason }, notice: { summary: 'Try again.' } } }).publicDetail.retryable, true, reason);
  }
  assert.equal(thrown(null).publicDetail.retryable, true, 'no paper at all: a retry may help');
  // The engine's own refusal reaches the detail as it is.
  const engine = assembleNtaPaper(makeBank('history', { copies: 1, fitFor: () => false }), { subject: 'history', seed: 'detail' });
  const error = thrown({ ntaPaper: { status: engine.status, refusal: engine.refusal, notice: engine.notice } });
  assert.equal(error.publicDetail.retryable, false);
  assert.equal(error.publicDetail.cause, 'fit_not_judged');
  assert.equal(error.publicMessage, engine.notice.summary);
});
