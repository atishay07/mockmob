// NTA agent pass: the merge of two judges' result files (scripts/nta-pass-merge.mjs) and the agent
// score source in the engine (data/nta_agent_scores.js). Synthetic fixtures prove the plumbing and the
// gates only, never academic quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assembleNtaPaper, ntaEligibility, ntaScoreOf } from '../nta_engine.js';
import { buildNtaPaper, clearNtaPoolCache } from '../nta_pool.js';
import {
  NTA_AGENT_RUBRIC_VERSION, ntaAgentAdmissibleIds, ntaAgentScoreIntegrity, ntaAgentThreshold,
} from '../nta_agent_scores.js';
import { ntaDifficultyOf, ntaKeyDispute, objectiveTagOf } from '../nta_item_checks.js';
import { contentHash } from '../content_evidence.js';
import { makeBank, signEvidence } from './ntaEngineFixtures.mjs';
import keyDisputes from '../nta_key_disputes.json' with { type: 'json' };

const plain = (row) => { const { evidence: _e, ...rest } = row; return rest; };
const CALIBRATED = { status: 'calibrated', threshold: 8, owner_bar: 8, model: 'judge-model', date: '2026-10-13', source: 'test' };

function judge(name, extra = {}) {
  return { judge: name, model: 'judge-model', date: '2026-10-13', quality_score: 9, blind_answer: 'A', key_matches: true, difficulty_check: 'medium', objective_tag: 'chemistry.x.some-idea', flags: [], note: '', ...extra };
}

function entryFor(row, j1 = {}, j2 = {}) {
  return { question_id: row.id, key: 'A', content_hash: contentHash(row), judges: [judge('j1', j1), judge('j2', j2)] };
}

function tableFor(subject, rows, { calibration = CALIBRATED, entry = entryFor, rubric = NTA_AGENT_RUBRIC_VERSION } = {}) {
  return { [subject]: { subject, rubric_version: rubric, calibration, questions: Object.fromEntries(rows.map((row) => [row.id, entry(row)])) } };
}

test('an agent score admits a question only with calibration, rubric, two judges at the threshold, both keys and no blocking flag', () => {
  const [signed] = makeBank('economics', { copies: 1 }).filter((row) => !row.passage_group_id);
  const row = plain(signed);
  const check = (agentScores) => ntaEligibility(row, { subject: 'economics', agentScores });
  const one = (entry, options = {}) => tableFor('economics', [row], { entry: () => entry, ...options });

  const good = check(one(entryFor(row)));
  assert.equal(good.eligible, true, good.reasons.join(','));
  assert.equal(good.scoreSource, 'agent_scored');
  assert.equal(good.score, 9);

  assert.ok(check(one(entryFor(row), { calibration: { status: 'pending', threshold: null } })).reasons.includes('agent_score_uncalibrated'));
  assert.ok(check(one(entryFor(row), { rubric: 'nta-agent-rubric-0' })).reasons.includes('agent_score_rubric_outdated'));
  assert.ok(check(one(entryFor(row, {}, { quality_score: 7 }))).reasons.includes('score_below_threshold'), 'both judges must reach the threshold, not just the mean');
  assert.ok(check(one(entryFor(row, {}, { blind_answer: 'C', key_matches: false }))).reasons.includes('agent_blind_key_mismatch'));
  assert.ok(check(one(entryFor(row, { blind_answer: '?' }))).reasons.includes('agent_blind_key_mismatch'));
  assert.ok(check(one(entryFor(row, { flags: ['answer_in_stem'] }))).reasons.includes('agent_blocking_flag'));
  assert.ok(check(one({ ...entryFor(row), judges: [judge('j1')] })).reasons.includes('score_needs_both_judges'));
  assert.ok(check(one({ ...entryFor(row), judges: [judge('j1'), judge('j1')] })).reasons.includes('score_needs_both_judges'), 'one judge twice is not two judges');
  assert.ok(check(one(entryFor(row, { model: '' }))).reasons.includes('agent_score_provenance_missing'));
  assert.ok(ntaEligibility({ ...row, explanation: `${row.explanation} Edited.` }, { subject: 'economics', agentScores: one(entryFor(row)) })
    .reasons.includes('question_changed_since_scored'));
  // Non-blocking weaknesses noted by a judge do not exclude.
  assert.equal(check(one(entryFor(row, { flags: [], note: 'one weak distractor' }))).eligible, true);
});

test('the calibrated threshold moves with the bar, and factory evidence always wins over an agent score', () => {
  const table = { calibration: CALIBRATED };
  assert.equal(ntaAgentThreshold(table), 8);
  assert.equal(ntaAgentThreshold(table, 8.5), 8.5);
  assert.equal(ntaAgentThreshold({ calibration: { ...CALIBRATED, threshold: 9 } }), 9, 'a generous judge gets a stricter cut');
  assert.equal(ntaAgentThreshold({ calibration: { status: 'pending', threshold: 8 } }), null);

  const [signed] = makeBank('economics', { copies: 1 }).filter((row) => !row.passage_group_id);
  const agentScores = tableFor('economics', [plain(signed)]);
  // Factory evidence present but below the bar: the agent score does not rescue it.
  const weak = signEvidence(plain(signed), { luna: 7, gemini: 7 });
  const verdict = ntaEligibility(weak, { subject: 'economics', agentScores });
  assert.equal(verdict.scoreSource, 'evidence_judges');
  assert.ok(verdict.reasons.includes('score_below_threshold'));
  // A factory blind-solver mismatch is not rescued either.
  const mismatch = signEvidence(plain(signed), { solvedKey: 'B' });
  assert.ok(ntaEligibility(mismatch, { subject: 'economics', agentScores }).reasons.includes('blind_solver_key_mismatch'));
  assert.equal(ntaScoreOf(plain(signed), { agentScores }).source, 'agent_scored');
  assert.deepEqual(ntaAgentScoreIntegrity(plain(signed), null), ['no_score']);
});

test('only agent ids that pass every row-free check are worth reading', () => {
  const rows = makeBank('economics', { copies: 1 }).filter((row) => !row.passage_group_id).slice(0, 4).map(plain);
  const agentScores = tableFor('economics', rows, { entry: (row) => (row.id === rows[0].id ? entryFor(row, { flags: ['wrong_key'] }) : entryFor(row)) });
  assert.deepEqual(ntaAgentAdmissibleIds('economics', { agentScores }).sort(), rows.slice(1).map((row) => row.id).sort());
  assert.deepEqual(ntaAgentAdmissibleIds('economics', { agentScores: tableFor('economics', rows, { calibration: { status: 'pending' } }) }), []);
  assert.deepEqual(ntaAgentAdmissibleIds('economics'), [], 'the committed tables admit nothing until calibration');
});

// ---------------------------------------------------------------------------------------------
// Pool read and paper with agent-scored questions only
// ---------------------------------------------------------------------------------------------

function fakeDb(tables) {
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
      is(column, value) { calls.push(['is', table, column]); filters.push((row) => (row[column] ?? null) === value); return query; },
      or() { filters.push((row) => row.evidence != null || Number(row.quality_score) > 0); return query; },
      order() { return query; },
      limit() { return query; },
      range(from, to) { range = [from, to]; return query; },
      abortSignal() { return query; },
      insert() { calls.push(['insert', table]); return Promise.resolve({ error: { code: '42P01', message: 'missing' } }); },
      then(resolve, reject) {
        if (table === 'nta_question_index') return Promise.resolve({ data: null, error: { code: '42P01', message: 'missing' } }).then(resolve, reject);
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

const sideTables = { passage_groups: [], question_content_disputes: [], recovery_family_holds: [], user_question_progress: [], attempts: [] };

test('a subject scored only by the agent pass builds a paper, read without evidence, and factory rows keep their evidence', async () => {
  clearNtaPoolCache();
  const questions = makeBank('chemistry').map(plain);
  const agentScores = tableFor('chemistry', questions);
  const db = fakeDb({ questions, ...sideTables });
  const result = await buildNtaPaper(db, 'chemistry', { seed: 'agent', seenIds: new Set(), cache: false, agentScores });
  assert.equal(result.status, 'exact', JSON.stringify(result.deviations.slice(0, 3)));
  assert.equal(result.pool.eligibleBySource.agent_scored, result.pool.eligible);
  const agentRead = db.calls.find(([kind, table, column]) => kind === 'is' && table === 'questions' && column === 'evidence');
  assert.ok(agentRead, 'agent rows are read only where there is no factory evidence');
  const selects = db.calls.filter(([kind, table]) => kind === 'select' && table === 'questions').map(([, , columns]) => columns.split(','));
  assert.ok(selects.some((columns) => !columns.includes('evidence')), 'the agent read omits the evidence column');

  // Uncalibrated: nothing is read for the agent path and the subject is refused as unscored.
  clearNtaPoolCache();
  const pending = await buildNtaPaper(fakeDb({ questions, ...sideTables }), 'chemistry', { seed: 'agent', seenIds: new Set(), cache: false, agentScores: tableFor('chemistry', questions, { calibration: { status: 'pending' } }) });
  assert.equal(pending.status, 'refused');
  assert.equal(pending.refusal.reason, 'no_scored_questions');

  // Mixed bank: factory-scored rows come in with evidence through the full read and keep that source.
  clearNtaPoolCache();
  const mixed = makeBank('chemistry').map((row, i) => (i % 2 ? row : plain(row)));
  const mixedScores = tableFor('chemistry', mixed.map(plain));
  const mixedResult = await buildNtaPaper(fakeDb({ questions: mixed, ...sideTables }), 'chemistry', { seed: 'agent', seenIds: new Set(), cache: false, agentScores: mixedScores });
  assert.ok(mixedResult.pool.eligibleBySource.evidence_judges > 0 && mixedResult.pool.eligibleBySource.agent_scored > 0);
  assert.equal(mixedResult.pool.loaded, mixed.length, 'each question read once');
});

// ---------------------------------------------------------------------------------------------
// Merge script
// ---------------------------------------------------------------------------------------------

test('the merge records both judges with provenance, sends key disagreements to review, and tags objectives and difficulty', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nta-merge-'));
  const dir = path.join(root, 'pass');
  const out = path.join(root, 'data');
  for (const sub of ['batches', 'calibration', 'results']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'nta_objectives.json'), JSON.stringify({ note: 'x', questions: { hand: 'acc.hand.tag' } }));

  const rows = makeBank('accountancy', { copies: 1 }).filter((row) => !row.passage_group_id).slice(0, 6).map(plain);
  const shape = (row) => ({ id: row.id, subject: 'accountancy', chapter: row.chapter, stem: row.body, options: row.options, correct_key: 'A', difficulty_label: row.difficulty });
  fs.writeFileSync(path.join(dir, 'batches', 'accountancy__x__01.json'), JSON.stringify({ batch: 'accountancy__x__01', subject: 'accountancy', questions: rows.map(shape) }));
  fs.writeFileSync(path.join(dir, 'batches', 'accountancy__y__01.json'), JSON.stringify({ batch: 'accountancy__y__01', subject: 'accountancy', questions: [] }));
  fs.writeFileSync(path.join(dir, 'hashes.json'), JSON.stringify(Object.fromEntries(rows.map((row) => [row.id, { subject: 'accountancy', content_hash: contentHash(row), key: 'A' }]))));
  fs.writeFileSync(path.join(dir, 'judges.json'), JSON.stringify({ j1: { model: 'model-one', date: '2026-10-14' }, j2: { model: 'model-two', date: '2026-10-14' } }));
  fs.writeFileSync(path.join(dir, 'calibration.json'), JSON.stringify(CALIBRATED));
  const result = (row, i, who) => {
    const other = (row.difficulty === 'hard' ? 'easy' : 'hard');
    return {
      id: row.id,
      blind_answer: i === 1 && who === 'j2' ? 'B' : 'A',
      key_matches: !(i === 1 && who === 'j2'),
      quality_score: i === 2 && who === 'j1' ? 7 : 9,
      difficulty_check: i === 3 ? other : row.difficulty,
      objective_tag: i === 4 && who === 'j2' ? 'accountancy.x.other-idea-here' : `accountancy.x.idea-number-${'abcdef'[i]}`,
      flags: i === 5 && who === 'j1' ? ['hedge_wording'] : [],
      note: '',
    };
  };
  for (const who of ['j1', 'j2']) fs.writeFileSync(path.join(dir, 'results', `accountancy__x__01__${who}.json`), JSON.stringify(rows.map((row, i) => result(row, i, who))));

  const report = JSON.parse(execFileSync(process.execPath, ['scripts/nta-pass-merge.mjs', '--dir', dir, '--out', out], { encoding: 'utf8' }));
  assert.equal(report.questionsJudged, 6);
  assert.deepEqual(report.missingFiles.sort(), ['accountancy__y__01__j1.json', 'accountancy__y__01__j2.json']);
  assert.equal(report.keyDisputes, 1);

  const table = JSON.parse(fs.readFileSync(path.join(out, 'nta_agent_scores', 'accountancy.json'), 'utf8'));
  assert.equal(table.rubric_version, NTA_AGENT_RUBRIC_VERSION);
  assert.equal(table.calibration.status, 'calibrated');
  assert.deepEqual(table.models, ['model-one', 'model-two']);
  const first = table.questions[rows[0].id];
  assert.deepEqual(first.judges.map((j) => [j.judge, j.model, j.date, j.quality_score, j.blind_answer]), [['j1', 'model-one', '2026-10-14', 9, 'A'], ['j2', 'model-two', '2026-10-14', 9, 'A']]);
  assert.equal(first.key_agreement, 'both');
  assert.equal(table.questions[rows[1].id].key_agreement, 'one');
  assert.equal(table.measures.judged_by_both, 6);
  assert.equal(table.measures.key_one_match, 1);
  // Admissible: not the key dispute (1), not the 7 (2), not the hedge (5).
  assert.equal(table.measures.admissible_before_row_checks, 3);

  const disputes = JSON.parse(fs.readFileSync(path.join(out, 'nta_key_disputes.json'), 'utf8'));
  assert.deepEqual(Object.keys(disputes.questions), [rows[1].id]);
  assert.equal(disputes.questions[rows[1].id].reason, 'one_blind_answer_differs');

  const objectives = JSON.parse(fs.readFileSync(path.join(out, 'nta_objectives.json'), 'utf8'));
  assert.equal(objectives.questions.hand, 'acc.hand.tag', 'hand tags are kept');
  assert.equal(Object.keys(objectives.agent_questions).length, 6);
  assert.equal(objectives.agent_questions[rows[0].id], 'accountancy.x.idea-number-a');

  const difficulty = JSON.parse(fs.readFileSync(path.join(out, 'nta_difficulty.json'), 'utf8'));
  assert.deepEqual(Object.keys(difficulty.questions), [rows[3].id]);
  assert.equal(difficulty.questions[rows[3].id].from, rows[3].difficulty);

  // The merged table drives the engine the same way.
  const agentScores = { accountancy: table };
  const eligible = rows.filter((row) => ntaEligibility(row, { subject: 'accountancy', agentScores }).eligible).map((row) => row.id);
  assert.deepEqual(eligible.sort(), [rows[0].id, rows[3].id, rows[4].id].sort());

  // A result file whose ids do not match its batch is rejected whole.
  fs.writeFileSync(path.join(dir, 'results', 'accountancy__x__01__j2.json'), JSON.stringify(rows.slice(1).map((row, i) => result(row, i + 1, 'j2'))));
  const broken = JSON.parse(execFileSync(process.execPath, ['scripts/nta-pass-merge.mjs', '--dir', dir, '--out', out], { encoding: 'utf8' }));
  assert.equal(broken.invalid.length, 1);
  const half = JSON.parse(fs.readFileSync(path.join(out, 'nta_agent_scores', 'accountancy.json'), 'utf8'));
  assert.equal(half.measures.judged_by_one, 6);
  assert.equal(half.measures.admissible_before_row_checks, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('committed key disputes, difficulty corrections and agent tags are read by the engine helpers', () => {
  for (const id of Object.keys(keyDisputes.questions || {})) assert.ok(ntaKeyDispute(id));
  assert.equal(ntaKeyDispute('not-a-question'), null);
  assert.equal(ntaDifficultyOf({ id: 'x', difficulty: 'HARD' }), 'hard');
  assert.equal(ntaDifficultyOf({ id: 'x', difficulty: '' }), 'medium');
  assert.equal(objectiveTagOf({ id: '5114300ab4bc8333ce6507832947954c' }), 'acc.debentures.issue_at_premium', 'hand tags still apply');
  void assembleNtaPaper;
});
