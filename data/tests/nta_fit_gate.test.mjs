// NTA CUET-fit pass: the fit gate, the stored type before the heuristic, the recency preference and the
// offline merge (scripts/nta-fit-merge.mjs). Synthetic fixtures prove the plumbing and the rules only,
// never academic quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  NTA_MIN_FIT_SCORE, NTA_RECENCY_BUCKET_MS, assembleNtaPaper, classifyNtaType, heuristicNtaType, ntaEligibility, ntaPreferenceOrder,
} from '../nta_engine.js';
import { NTA_FIT_RUBRIC_VERSION, ntaFitMedian } from '../nta_fit_scores.js';
import { contentHash } from '../content_evidence.js';
import { fitEntryFor, makeBank, signEvidence, withFit } from './ntaEngineFixtures.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const plainRows = (subject) => makeBank(subject, { copies: 1 }).filter((row) => !row.passage_group_id);
const first = (subject = 'economics') => plainRows(subject)[0];
const verdict = (row, fit, context = {}) => {
  withFit(row, fit);
  return ntaEligibility(row, { subject: row.subject, ...context });
};

test('the fit bar is one named constant, 8, and a median at the bar admits', () => {
  assert.equal(NTA_MIN_FIT_SCORE, 8);
  const row = first();
  assert.equal(verdict(row, { score: 8 }).eligible, true);
  assert.equal(verdict(row, { score: 9 }).eligible, true);
  assert.equal(verdict(row, { score: 10, route: 'board' }).eligible, true);
  const low = verdict(row, { score: 7 });
  assert.equal(low.eligible, false);
  assert.deepEqual(low.reasons, ['fit_below_bar']);
  assert.equal(low.fitScore, 7);
});

test('the fit gate reads the median of three, not the best or the mean', () => {
  const row = first();
  assert.equal(verdict(row, { scores: [10, 8, 4] }).eligible, true, 'median 8');
  assert.deepEqual(verdict(row, { scores: [10, 10, 7] }).reasons, [], 'median 10 capped to 9 without a route, still admitted');
  assert.deepEqual(verdict(row, { scores: [10, 7, 6] }).reasons, ['fit_below_bar'], 'one 10 does not lift a 7');
  assert.equal(ntaFitMedian(fitEntryFor(row, { scores: [10, 10, 9] })), 9, 'a 10 without a named route is stored as 9');
  assert.equal(ntaFitMedian(fitEntryFor(row, { scores: [10, 10, 9], route: 'pyq' })), 10);
});

test('a fit flag from one judge does not block; from two it blocks at any score', () => {
  const row = first();
  assert.equal(verdict(row, { score: 10, route: 'pyq', flaggedBy: [1] }).eligible, true);
  const two = verdict(row, { score: 10, route: 'pyq', flaggedBy: [0, 2] });
  assert.equal(two.eligible, false);
  assert.ok(two.reasons.includes('fit_flagged'));
  assert.equal(verdict(row, { score: 9, flaggedBy: [0, 1, 2], flag: 'too_slow' }).reasons.includes('fit_flagged'), true);
});

test('the fit gate fails closed: unjudged, fewer than three judges, changed content, outdated rubric', () => {
  const row = first();
  assert.deepEqual(verdict(row, false).reasons, ['fit_not_judged']);
  assert.ok(verdict(row, { judges: 2 }).reasons.includes('fit_needs_three_judges'));
  assert.ok(verdict(row, { judges: 1 }).reasons.includes('fit_needs_three_judges'));
  assert.ok(verdict(row, { hash: 'f'.repeat(64) }).reasons.includes('fit_question_changed'));
  withFit(row, {});
  assert.ok(ntaEligibility({ ...row, explanation: `${row.explanation} Edited.` }, { subject: row.subject }).reasons.includes('fit_question_changed'));
  // A table written under another rubric version admits nothing.
  const table = { subject: row.subject, rubric_version: 'nta-cuet-fit-rubric-0', questions: { [row.id]: fitEntryFor(row, {}) } };
  const old = ntaEligibility(row, { subject: row.subject, fitScores: { [row.subject]: table } });
  assert.ok(old.reasons.includes('fit_rubric_outdated'));
  const current = ntaEligibility(row, { subject: row.subject, fitScores: { [row.subject]: { ...table, rubric_version: NTA_FIT_RUBRIC_VERSION } } });
  assert.deepEqual(current.reasons, []);
});

test('the engine bar can be raised per call (the report asks for 9)', () => {
  const row = first();
  assert.equal(verdict(row, { score: 8 }, { minFitScore: 9 }).eligible, false);
  assert.equal(verdict(row, { score: 9 }, { minFitScore: 9 }).eligible, true);
});

test('the stored majority type comes before the heuristic', () => {
  const row = plainRows('economics').find((entry) => heuristicNtaType(entry, 'economics') === 'single_mcq');
  assert.equal(heuristicNtaType(row, 'economics'), 'single_mcq', 'the fixture reads as a plain single-answer item');
  withFit(row, { type: 'statement_based' });
  assert.equal(classifyNtaType(row, 'economics'), 'statement_based', 'the stored type wins over the heuristic');
  assert.equal(verdict(row, { type: 'statement_based' }).type, 'statement_based');
  // No majority (null) falls back to the heuristic.
  withFit(row, { type: null });
  assert.equal(classifyNtaType(row, 'economics'), 'single_mcq');
  // A stored type the subject's paper never asks is not used by the classifier and keeps the row out.
  withFit(row, { type: 'synonym' });
  assert.equal(classifyNtaType(row, 'economics', ['single_mcq', 'match_the_following']), 'single_mcq');
  assert.ok(ntaEligibility(row, { subject: 'economics' }).reasons.includes('fit_type_not_in_pattern'));
  // Content edited after the judges saw it: the stored type no longer applies.
  withFit(row, { type: 'statement_based', hash: contentHash({ ...row, body: 'other', question: 'other' }) });
  assert.equal(classifyNtaType(row, 'economics'), 'single_mcq');
  // A passage child is always a passage item; a stored passage type on a row with no passage is ignored.
  const [child] = makeBank('economics', { copies: 1 }).filter((entry) => entry.passage_group_id);
  withFit(child, { type: 'single_mcq' });
  assert.equal(classifyNtaType(child, 'economics'), 'passage_set_item');
  withFit(row, { type: 'passage_set_item' });
  assert.equal(classifyNtaType(row, 'economics'), 'single_mcq');
});

test('recency: a newer 8 beats an older 9, the same day falls back to score, undated rows come last', () => {
  const day = NTA_RECENCY_BUCKET_MS;
  const item = (extra) => ({ id: 'x', createdAt: 100 * day, score: 8, fitScore: 8, rank: 0.5, ...extra });
  const newer8 = item({ createdAt: 101 * day, score: 8 });
  const older9 = item({ createdAt: 100 * day, score: 9.5, fitScore: 10 });
  assert.ok(ntaPreferenceOrder(newer8, older9) < 0, 'newest first, before the score');
  assert.ok(ntaPreferenceOrder(older9, newer8) > 0);
  const sameDayHigh = item({ createdAt: 100 * day + 3_600_000, score: 9 });
  const sameDayLow = item({ createdAt: 100 * day + 60_000, score: 8.5 });
  assert.ok(ntaPreferenceOrder(sameDayHigh, sameDayLow) < 0, 'one day counts as equally new, then the higher score');
  const fitHigh = item({ fitScore: 9 });
  const fitLow = item({ fitScore: 8 });
  assert.ok(ntaPreferenceOrder(fitHigh, fitLow) < 0, 'then the higher fit median');
  const undated = item({ createdAt: null, score: 10, fitScore: 10 });
  assert.ok(ntaPreferenceOrder(newer8, undated) < 0 && ntaPreferenceOrder(undated, newer8) > 0, 'a row with no date is after every dated row');
  assert.ok(ntaPreferenceOrder(item({ rank: 0.1 }), item({ rank: 0.9 })) < 0, 'last, the seed');
  const sorted = [older9, undated, newer8].sort(ntaPreferenceOrder);
  assert.deepEqual(sorted, [newer8, older9, undated]);
});

test('a paper takes the newer questions when the bank has more than the blueprint needs', () => {
  const bank = makeBank('economics', { copies: 3 });
  const stamp = (row, index) => ({ ...row, created_at: new Date(Date.UTC(2026, 8, 1) + (row.passage_group_id ? 0 : index % 2) * 40 * NTA_RECENCY_BUCKET_MS).toISOString() });
  // Even rows are old (1 September), odd rows new (11 October). Old rows carry the higher quality score.
  const rows = bank.map((row, index) => {
    const dated = stamp(row, index);
    const old = !row.passage_group_id && index % 2 === 0;
    return signEvidence(dated, old ? { luna: 10, gemini: 10 } : { luna: 8, gemini: 8 });
  });
  const result = assembleNtaPaper(rows, { subject: 'economics', seed: 'recency-1', now: () => Date.now() });
  assert.equal(result.paper.length, 50, JSON.stringify(result.deviations || result.status));
  const standalone = result.paper.filter((entry) => entry.setIndex === null);
  const fresh = standalone.filter((entry) => Date.parse(entry.row.created_at) > Date.UTC(2026, 9, 1));
  assert.ok(fresh.length > standalone.length * 0.8, `${fresh.length} of ${standalone.length} standalone questions are the newer ones, not the higher-scored old ones`);
});

test('rows the fit judges did not pass never reach a paper', () => {
  const bank = makeBank('economics', { copies: 3, fitFor: (row) => (row.fixture_label.endsWith('-0') ? { score: 6 } : {}) });
  const held = new Set(bank.filter((row) => row.fixture_label.endsWith('-0')).map((row) => row.id));
  assert.ok(held.size > 0);
  const result = assembleNtaPaper(bank, { subject: 'economics', seed: 'fit-1' });
  assert.ok(result.paper.length > 0);
  for (const entry of result.paper) assert.equal(held.has(entry.id), false, 'a fit-6 question is never served');
});

// ---- the offline merge ----

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function mergeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nta-fit-merge-'));
  const allowed = { economics: { types: ['single_mcq', 'match_the_following', 'statement_based'], units: [{ unit: 'Introductory Macroeconomics', chapters: ['Income Determination', 'Money and Banking'] }], excluded_chapters: [], seconds_per_question: 72 } };
  const questions = ['q1', 'q2', 'q3', 'q4'].map((id) => ({ id, subject: 'economics', chapter: 'Income Determination', engine_type_guess: 'single_mcq' }));
  writeJson(path.join(root, 'fit', 'batches', 'economics__a__01.json'), { batch: 'economics__a__01', allowed, questions });
  writeJson(path.join(root, 'fit', 'batches', 'economics__a__02.json'), { batch: 'economics__a__02', allowed, questions: [{ id: 'q5', subject: 'economics', chapter: 'Money and Banking', engine_type_guess: 'single_mcq' }] });
  const result = (id, over = {}) => ({
    id, cuet_type: 'single_mcq', passage_skill: null, unit: 'Introductory Macroeconomics', chapter: 'Income Determination', pyq_closeness: 1,
    ten_route: null, est_seconds: 50, fit_score: 9, fit_flags: [], note: 'x', ...over,
  });
  // q1: clean 9s with the route named by two judges and a 10 from two of them. q2: 2 of 3 type, a flag from two judges.
  // q3: a 10 from two judges naming different routes. q4: all three 8, one judge says another type and chapter.
  const judgeRows = {
    h1: [result('q1', { fit_score: 10, ten_route: 'board' }), result('q2', { cuet_type: 'match_the_following', fit_flags: ['off_pattern_for_subject'] }), result('q3', { fit_score: 10, ten_route: 'pyq' }), result('q4', { fit_score: 8 })],
    h2: [result('q1', { fit_score: 10, ten_route: 'board' }), result('q2', { cuet_type: 'match_the_following', fit_flags: ['too_slow'] }), result('q3', { fit_score: 10, ten_route: 'cbt_staple' }), result('q4', { fit_score: 8, cuet_type: 'statement_based', chapter: 'Money and Banking' })],
    h3: [result('q1', { fit_score: 9 }), result('q2', { cuet_type: 'single_mcq', fit_score: 7 }), result('q3', { fit_score: 9 }), result('q4', { fit_score: 8, ten_route: false, fit_flags: ['short_passage'] })],
  };
  for (const [judge, rows] of Object.entries(judgeRows)) writeJson(path.join(root, 'fit', 'results', `economics__a__01__${judge}.json`), rows);
  // Batch 02: only h1 has answered; h2 wrote a file that does not parse; h3 is missing.
  writeJson(path.join(root, 'fit', 'results', 'economics__a__02__h1.json'), [result('q5', { chapter: 'Money and Banking' })]);
  fs.writeFileSync(path.join(root, 'fit', 'results', 'economics__a__02__h2.json'), '{ not json');
  writeJson(path.join(root, 'hashes.json'), Object.fromEntries(['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => [id, { content_hash: `hash-${id}` }])));
  return root;
}

test('the merge writes majority tags, caps an unagreed 10, blocks on two flags and records missing files', () => {
  const root = mergeFixture();
  const out = path.join(root, 'out');
  const stdout = execFileSync(process.execPath, ['scripts/nta-fit-merge.mjs', '--dir', path.join(root, 'fit'), '--hashes', path.join(root, 'hashes.json'), '--out', out], { cwd: REPO, encoding: 'utf8' });
  const summary = JSON.parse(stdout);
  assert.equal(summary.missing, 1, 'batch 02 has no h3 file; its h2 file exists but does not parse');
  const table = JSON.parse(fs.readFileSync(path.join(out, 'nta_fit_scores', 'economics.json'), 'utf8'));
  const q = table.questions;
  assert.equal(table.status, 'partial');
  assert.equal(q.q1.fit_median, 10, 'two judges named the same route: the 10 stands');
  assert.equal(q.q1.ten_route, 'board');
  assert.equal(q.q3.fit_median, 9, 'a 10 without an agreed route is capped at 9');
  assert.equal(q.q3.fit_median_raw, 10);
  assert.equal(q.q2.cuet_type, 'match_the_following', '2 of 3 type');
  assert.equal(q.q2.flagged_by, 2);
  assert.equal(q.q2.blocking, true);
  assert.equal(q.q1.blocking, false);
  assert.equal(q.q4.cuet_type, 'single_mcq');
  assert.equal(q.q4.chapter, 'Income Determination', '2 of 3 chapter');
  assert.equal(q.q4.judges.length, 3, 'a judge that wrote false for no route is still read');
  assert.equal(q.q4.blocking, false, 'a flag name outside rubric section 8 is recorded, never blocking');
  assert.deepEqual(q.q4.judges.find((judge) => judge.judge === 'h3').other_flags, ['short_passage']);
  assert.equal(q.q1.content_hash, 'hash-q1');
  assert.equal(q.q5.judges.length, 1, 'a question keeps the judges it has');
  assert.equal(q.q5.judges[0].judge, 'h1');
  // The record of what is missing.
  const report = JSON.parse(fs.readFileSync(path.join(out, 'nta_fit_scores', '_merge-report.json'), 'utf8'));
  assert.deepEqual(report.missing, ['economics__a__02__h3.json']);
  assert.equal(report.invalid_files.length, 1);
  assert.equal(report.invalid_files[0].file, 'economics__a__02__h2.json');
  assert.equal(report.questions_judged_by_three, 4);
  assert.deepEqual(report.other_flag_counts, { short_passage: 1 });
  // Other subjects exist and are empty rather than missing.
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'nta_fit_scores', 'physics.json'), 'utf8')).status, 'empty');
  fs.rmSync(root, { recursive: true, force: true });
});

test('the merged table feeds the engine: only questions with three judges at the bar and under two flags pass', () => {
  const root = mergeFixture();
  const out = path.join(root, 'out');
  execFileSync(process.execPath, ['scripts/nta-fit-merge.mjs', '--dir', path.join(root, 'fit'), '--hashes', path.join(root, 'hashes.json'), '--out', out], { cwd: REPO, encoding: 'utf8' });
  const table = JSON.parse(fs.readFileSync(path.join(out, 'nta_fit_scores', 'economics.json'), 'utf8'));
  const gate = (id) => {
    const row = { ...first(), id };
    const entry = { ...table.questions[id], content_hash: contentHash(row) };
    return ntaEligibility(row, { subject: 'economics', fitScores: { economics: { ...table, questions: { [id]: entry } } } }).reasons.filter((reason) => reason.startsWith('fit_'));
  };
  assert.deepEqual(gate('q1'), []);
  assert.deepEqual(gate('q3'), []);
  assert.deepEqual(gate('q4'), []);
  assert.ok(gate('q2').includes('fit_flagged'));
  assert.ok(gate('q5').includes('fit_needs_three_judges'));
  fs.rmSync(root, { recursive: true, force: true });
});
