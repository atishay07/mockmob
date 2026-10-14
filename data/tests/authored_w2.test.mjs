import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contentHash } from '../content_evidence.js';
import { ntaEligibility } from '../nta_engine.js';
import {
  AUTHORED_QUESTION_TYPE, AUTHORED_SOURCE, AUTHORED_SOURCE_W2, AUTHORED_SUBJECTS, QUESTION_TYPE, VERBAL_QUESTION_TYPE, WAVES, groupIdOfCandidate, isPassageChild, passageGroupIdOf, planPublication,
  smallSets, toPassageGroupRow, toQuestionRow, validateCandidates, waveOf,
} from '../../scripts/lib/authored-wave.mjs';
import { positionsOf } from '../../scripts/lib/authored-scores.mjs';
import { parseArgs as parseMergeArgs, runCheck, runMerge } from '../../scripts/authored-scores-merge.mjs';
import { agentTablesFrom, dryRun, loadCandidates, scoreCoverage } from '../../scripts/question-publish-authored.mjs';
import { runFinal, parseArgs as parseAcceptArgs } from '../../scripts/authored-w2-accept.mjs';

// Wave 2 (claude-authored-2026-10-14-w2): the committed final candidates, entries, drops and merged tables. No network, no model.
const DIR = 'docs/brain/reports/authored-w2';
const CANDIDATES_FILE = `${DIR}/wave2-candidates-final-2026-10-14.json`;
const ENTRIES_FILE = `${DIR}/wave2-score-entries-final-2026-10-14.json`;
const DROPPED_FILE = `${DIR}/wave2-dropped-2026-10-14.json`;
const DECISIONS_FILE = `${DIR}/wave2-drop-decisions-2026-10-14.json`;
const ACCEPTANCE_FILE = `${DIR}/wave2-acceptance-2026-10-14.json`;
const WAVE1_FILE = 'docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json';
const NOW = '2026-10-14T12:10:00.000Z';
const SUBJECTS = ['biology', 'computer_science', 'english', 'general_test', 'geography', 'mathematics', 'political_science'];
const COUNTS = { biology: 56, computer_science: 76, english: 55, general_test: 77, geography: 44, mathematics: 65, political_science: 9 };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const wave2 = () => readJson(CANDIDATES_FILE);
const wave1 = () => readJson(WAVE1_FILE);
const tmpDir = (name = 'authored-w2-') => fs.mkdtempSync(path.join(os.tmpdir(), name));

// ---------------------------------------------------------------------------------------------
// The wave definition
// ---------------------------------------------------------------------------------------------

test('a wave is its source key: wave 1 stays the default, wave 2 adds five subjects and Geography case sets', () => {
  assert.equal(AUTHORED_SOURCE, 'claude-authored-2026-10-14');
  assert.equal(AUTHORED_SOURCE_W2, 'claude-authored-2026-10-14-w2');
  assert.equal(waveOf(AUTHORED_SOURCE_W2).wave, 2);
  assert.equal(waveOf({ source: AUTHORED_SOURCE }).wave, 1);
  assert.equal(waveOf({ source: 'something-else' }).wave, 1, 'an unknown source falls back to wave 1 (the validator refuses it by name)');
  assert.deepEqual(WAVES[1].subjects, ['chemistry', 'english', 'history', 'political_science', 'psychology', 'sociology']);
  for (const subject of ['biology', 'computer_science', 'general_test', 'geography', 'mathematics']) assert.ok(AUTHORED_SUBJECTS.includes(subject), subject);
  assert.ok(!WAVES[1].subjects.includes('biology'));
  assert.deepEqual(WAVES[2].caseSetSubjects, ['geography']);
  // The wave-1 vocabulary is untouched; the verbal types are added next to it.
  assert.equal(Object.keys(QUESTION_TYPE).length, 6);
  for (const type of Object.keys(VERBAL_QUESTION_TYPE)) assert.equal(AUTHORED_QUESTION_TYPE[type], VERBAL_QUESTION_TYPE[type]);
  assert.equal(AUTHORED_QUESTION_TYPE.fill_in_blank, 'correct_word_usage');
  assert.equal(AUTHORED_QUESTION_TYPE.sentence_rearrangement, 'para_jumble');
});

test('a publication list holds one wave, and each wave holds only its own subjects', () => {
  const [a] = wave1();
  const [b] = wave2();
  assert.ok(validateCandidates([a, { ...b, id: b.id }]).some((p) => p.problem === 'source_differs_from_the_rest_of_the_list'));
  const wrongSubject = { ...b, subject: 'chemistry' };
  assert.ok(validateCandidates([wrongSubject]).some((p) => p.problem === 'subject_not_in_wave'), 'chemistry is not a wave-2 subject');
  const wave1Biology = { ...a, subject: 'biology' };
  assert.ok(validateCandidates([wave1Biology]).some((p) => p.problem === 'subject_not_in_wave'), 'biology is not a wave-1 subject');
  assert.ok(validateCandidates([{ ...b, source: 'x' }]).some((p) => p.problem === 'source_not_authored_run'));
});

// ---------------------------------------------------------------------------------------------
// The final candidates and their plan
// ---------------------------------------------------------------------------------------------

test('wave 2 final: 382 candidates validate and plan into 382 rows and one new passage group', () => {
  const candidates = wave2();
  assert.equal(candidates.length, 382);
  const plan = planPublication(candidates);
  assert.deepEqual(plan.problems, []);
  assert.deepEqual(plan.summary.bySubject, COUNTS);
  assert.equal(plan.summary.questions, 382);
  assert.equal(plan.summary.passageGroups, 1, 'the Geography case set; the English question completes a wave-1 group that is already in the bank');
  assert.deepEqual(plan.summary.byExpertReview, { ready: 345, repaired: 37 });
  assert.deepEqual(plan.summary.passageSetsBelowNtaMinimum, []);
  assert.equal(plan.rows.filter((row) => row.tags.includes('authored_revision:reworded')).length, 9);
  assert.ok(candidates.every((c) => c.source === AUTHORED_SOURCE_W2 && ['ready', 'repaired'].includes(c._verdict)));
  assert.ok(plan.rows.every((row) => row.source === AUTHORED_SOURCE_W2 && row.tags.includes('authored_wave:2') && row.tags.includes(`authored_run:${AUTHORED_SOURCE_W2}`)));
  assert.equal(new Set(plan.rows.map((row) => row.id)).size, 382);
  assert.equal(planPublication(structuredClone(candidates)).planHash, plan.planHash, 'same candidates, same plan hash');
});

test('wave 2 does not repeat a wave-1 question: no shared id or stem', () => {
  const ones = wave1();
  const ids = new Set(ones.map((c) => c.id));
  const stems = new Set(ones.map((c) => `${c.subject}|${c.stem.toLowerCase().replace(/\s+/g, ' ').trim()}`));
  for (const c of wave2()) {
    assert.ok(!ids.has(c.id), c.id);
    assert.ok(!stems.has(`${c.subject}|${c.stem.toLowerCase().replace(/\s+/g, ' ').trim()}`), c.id);
  }
});

test('the English verbal item types map to the question_type vocabulary of the live English rows', () => {
  const rows = planPublication(wave2()).rows.filter((row) => row.subject === 'english');
  const byAuthored = new Map(wave2().filter((c) => c.subject === 'english').map((c) => [c.id, c.type]));
  const seen = new Set();
  for (const row of rows) {
    const authored = byAuthored.get(row.id);
    seen.add(authored);
    assert.equal(row.question_type, authored === 'passage_set_item' ? 'reading_comprehension' : (AUTHORED_QUESTION_TYPE[authored] || null), authored);
    assert.ok(row.tags.includes(`question_type:${row.question_type}`), authored);
  }
  for (const type of Object.keys(VERBAL_QUESTION_TYPE)) assert.ok(seen.has(type), `${type} is in wave 2`);
});

test('a Geography case set is stored like a passage set: group, passage, 1-based order, case_based, and a hash that includes the passage', () => {
  const candidates = wave2();
  const children = candidates.filter((c) => c.set_id === 'geo-b3-settlement-set-1');
  assert.equal(children.length, 4);
  assert.ok(children.every((c) => c.type === 'single_mcq' && isPassageChild(c)), 'typed single_mcq in the candidates, stored as passage children');
  const plan = planPublication(candidates);
  const group = plan.groups.find((g) => g.subject === 'geography');
  assert.ok(group);
  assert.equal(group.id, passageGroupIdOf('geo-b3-settlement-set-1', AUTHORED_SOURCE_W2));
  assert.deepEqual([group.status, group.discoverable, group.source, group.chapter, group.title, group.passage_type], ['live', true, AUTHORED_SOURCE_W2, 'Human Settlements', 'Human Settlements', null]);
  const rows = plan.rows.filter((row) => row.passage_group_id === group.id);
  assert.deepEqual(rows.map((row) => row.order_index), [1, 2, 3, 4]);
  for (const row of rows) {
    assert.equal(row.question_type, 'case_based');
    assert.equal(row.passage_text, group.passage_text);
    assert.equal(row.passage_id, group.id);
    assert.equal(row.passage_type, null);
  }
  // Without its passage the row would hash differently: the hash the score tables bind to includes it.
  const bare = { ...rows[0], passage_text: null };
  assert.notEqual(contentHash(bare), contentHash(rows[0]));
  // A case set outside Geography is not a set: the passage on a standalone item is refused.
  const chemistry = { ...candidates.find((c) => c.subject === 'mathematics'), set_id: 'x', passage_text: 'A passage that has no business here.' };
  const problems = validateCandidates([chemistry]).map((p) => p.problem);
  assert.ok(problems.includes('passage_text_on_standalone_item') && problems.includes('set_id_on_standalone_item'));
});

test('a question that completes a wave-1 set joins its group and writes no group row', () => {
  const candidates = wave2();
  const child = candidates.find((c) => c.set_id === 'english__p1__set3');
  assert.deepEqual(child._extends_set, { source: AUTHORED_SOURCE, existing_children: 3 });
  const wave1Plan = planPublication(wave1());
  const wave1Group = wave1Plan.groups.find((g) => g.id === passageGroupIdOf('english__p1__set3'));
  assert.ok(wave1Group, 'wave 1 wrote this group');
  assert.equal(groupIdOfCandidate(child), wave1Group.id, 'the same group id as wave 1, not a wave-2 id');
  assert.equal(child.passage_text, wave1Group.passage_text);
  assert.equal(child.chapter, wave1Group.chapter);
  const plan = planPublication(candidates);
  assert.ok(!plan.groups.some((g) => g.id === wave1Group.id), 'no group row is written for it');
  const row = plan.rows.find((r) => r.id === child.id);
  assert.equal(row.passage_group_id, wave1Group.id);
  assert.equal(row.order_index, 4, 'after the 3 children wave 1 left in the set');
  assert.deepEqual(plan.summary.topUpSets, [{ setId: 'english__p1__set3', groupId: wave1Group.id, existingChildren: 3, added: 1, source: AUTHORED_SOURCE }]);
  assert.equal(row.source, AUTHORED_SOURCE_W2);
  // The set is no longer below the engine's minimum of 4.
  assert.deepEqual(smallSets(candidates), []);
  assert.deepEqual(smallSets([{ ...child, _extends_set: { source: AUTHORED_SOURCE, existing_children: 2 } }]).map((s) => [s.setId, s.children]), [['english__p1__set3', 3]]);
  // A top-up on its own, in a list that is not told how many children the set already has, is refused as a set of one.
  const alone = { ...child };
  delete alone._extends_set;
  assert.ok(validateCandidates([alone]).some((p) => p.problem === 'set_has_1_children_below_minimum_2'));
  assert.ok(validateCandidates([{ ...child, _extends_set: { source: 'nope', existing_children: 3 } }]).some((p) => p.problem === 'extends_set_malformed'));
  assert.ok(validateCandidates([{ ...candidates.find((c) => c.subject === 'biology'), _extends_set: { source: AUTHORED_SOURCE, existing_children: 3 } }]).some((p) => p.problem === 'extends_set_on_a_standalone_item'));
});

test('toPassageGroupRow and toQuestionRow keep the wave-1 shape for wave-1 input', () => {
  const [c] = wave1();
  const row = toQuestionRow(c);
  assert.equal(row.source, AUTHORED_SOURCE);
  assert.ok(row.tags.includes('authored_wave:1'));
  const english = wave1().filter((x) => x.set_id === 'english__p1__set1');
  assert.equal(toPassageGroupRow('english__p1__set1', english).id, passageGroupIdOf('english__p1__set1'));
  assert.equal(toPassageGroupRow('english__p1__set1', english).source, AUTHORED_SOURCE);
});

// ---------------------------------------------------------------------------------------------
// Entries, tables and the engine
// ---------------------------------------------------------------------------------------------

test('the final entries file covers every final candidate, is bound to the final candidates file, and carries the wave-2 provenance', () => {
  const file = readJson(ENTRIES_FILE);
  const { candidates, sha256 } = loadCandidates(CANDIDATES_FILE);
  assert.equal(file.source, AUTHORED_SOURCE_W2);
  assert.equal(file.wave, 2);
  assert.equal(file.candidates_sha256, sha256);
  assert.equal(Object.keys(file.entries).length, 382);
  assert.equal(file.counts.entries, 382);
  for (const c of candidates) {
    const record = file.entries[c.id];
    assert.ok(record, c.id);
    assert.equal(record.text.expert_verdict, c._verdict);
    assert.equal(record.quality.length, 2);
    assert.equal(record.fit.length, 3);
    assert.ok(record.quality.every((j) => j.blind_answer === c.correct_key && j.quality_score >= 7 && j.flags.length === 0), c.id);
    assert.ok(record.fit.filter((j) => j.fit_flags.length).length < 2, c.id);
    const solvers = record.blind_solvers;
    // Solver evidence is on the final blind text, or the repair came with its own re-solve (2 of 3 on the key).
    if (solvers.on === 'final') assert.ok(solvers.matched_key >= 4, c.id);
    else assert.ok(record.blind_resolve_on_final_text?.matched_key >= 2, c.id);
  }
  const records = Object.values(file.entries);
  assert.equal(records.filter((r) => r.text.reworded_after_acceptance).length, 9);
  assert.ok(records.filter((r) => r.text.reworded_after_acceptance).every((r) => r.text.judged === 'final' && r.blind_solvers.on === 'final' && r.blind_solvers.matched_key >= 4 && r.quality.every((j) => j.on_final_text === true) && r.fit.every((j) => j.on_final_text === true)));
  assert.equal(file.counts.rewordedAfterAcceptance, 9);
  assert.equal(records.filter((r) => r.text.supplementary_review).length, 17);
});

test('the committed tables hold a wave-2 entry bound to the hash of every final row, and the engine defaults admit all 382', () => {
  const rows = planPublication(wave2()).rows;
  const refused = rows.map((row) => [row.id, ntaEligibility({ ...row, evidence: null }, { subject: row.subject }).reasons]).filter(([, reasons]) => reasons.length);
  assert.deepEqual(refused, []);
  const coverage = scoreCoverage(rows, { fitDir: 'data/nta_fit_scores', agentScores: agentTablesFrom('data/nta_agent_scores') });
  assert.deepEqual([coverage.agent.bound, coverage.agent.missing.length, coverage.agent.hashMismatch.length], [382, 0, 0]);
  assert.deepEqual([coverage.fit.checked, coverage.fit.bound, coverage.fit.missing.length, coverage.fit.hashMismatch.length], [true, 382, 0, 0]);
  for (const subject of SUBJECTS) {
    const table = readJson(`data/nta_agent_scores/${subject}.json`);
    const mine = Object.values(table.questions).filter((entry) => entry.provenance?.kind === AUTHORED_SOURCE_W2);
    assert.equal(mine.length, COUNTS[subject], subject);
    assert.ok(mine.every((entry) => entry.provenance.wave === 2 && entry.judges.length === 2), subject);
    assert.equal(table.authored[AUTHORED_SOURCE_W2].questions, COUNTS[subject]);
  }
});

test('merging wave 2 again reproduces the committed tables byte for byte and touches no other entry', () => {
  const dir = tmpDir('authored-w2-tables-');
  const agentDir = path.join(dir, 'agent');
  const fitDir = path.join(dir, 'fit');
  fs.mkdirSync(agentDir);
  fs.mkdirSync(fitDir);
  for (const subject of SUBJECTS) {
    fs.copyFileSync(`data/nta_agent_scores/${subject}.json`, path.join(agentDir, `${subject}.json`));
    fs.copyFileSync(`data/nta_fit_scores/${subject}.json`, path.join(fitDir, `${subject}.json`));
  }
  const args = parseMergeArgs(['--repaired-text=admit', `--candidates=${CANDIDATES_FILE}`, `--entries=${ENTRIES_FILE}`, `--agent-dir=${agentDir}`, `--fit-base=${fitDir}`, `--agent-out=${dir}/agent-out`, `--fit-out=${dir}/fit-out`, `--now=${NOW}`]);
  const result = runMerge(args);
  assert.deepEqual(Object.keys(result.report.bySubject).sort(), SUBJECTS, 'only the wave-2 subjects are read and written');
  assert.equal(result.report.planned, 382);
  assert.equal(result.report.engineEligible, 382);
  assert.equal(result.report.engineIneligible, 0);
  assert.equal(result.report.fitGate.pass, 382);
  assert.equal(result.report.hashChangedByRepair, 25);
  assert.equal(result.report.heldForFreshPass, 0);
  assert.deepEqual(result.report.passageSets.sets.map((set) => [set.subject, set.children, set.eligibleChildren, set.servable]), [['english', 4, 4, true], ['geography', 4, 4, true]]);
  const written = fs.readdirSync(`${dir}/agent-out`).sort();
  assert.deepEqual(written, SUBJECTS.map((s) => `${s}.json`).sort());
  for (const subject of SUBJECTS) {
    assert.equal(fs.readFileSync(`${dir}/agent-out/${subject}.json`, 'utf8'), fs.readFileSync(`data/nta_agent_scores/${subject}.json`, 'utf8'), `agent ${subject}`);
    assert.equal(fs.readFileSync(`${dir}/fit-out/${subject}.json`, 'utf8'), fs.readFileSync(`data/nta_fit_scores/${subject}.json`, 'utf8'), `fit ${subject}`);
  }
});

test('wave 2 entries do not disturb wave 1: the six wave-1 subjects keep their wave-1 entries, and English holds both waves', () => {
  const ones = new Set(wave1().map((c) => c.id));
  const twos = new Set(wave2().map((c) => c.id));
  const english = readJson('data/nta_agent_scores/english.json');
  const kinds = Object.values(english.questions).map((entry) => entry.provenance?.kind).filter(Boolean);
  assert.equal(kinds.filter((kind) => kind === AUTHORED_SOURCE).length, 58);
  assert.equal(kinds.filter((kind) => kind === AUTHORED_SOURCE_W2).length, 55);
  assert.ok(Object.keys(english.questions).every((id) => !(ones.has(id) && twos.has(id))));
  assert.deepEqual(Object.keys(english.authored).sort(), [AUTHORED_SOURCE, AUTHORED_SOURCE_W2].sort());
  for (const subject of ['chemistry', 'history', 'psychology', 'sociology']) {
    const table = readJson(`data/nta_agent_scores/${subject}.json`);
    assert.ok(!Object.values(table.questions).some((entry) => entry.provenance?.kind === AUTHORED_SOURCE_W2), subject);
  }
});

test('runCheck refuses entries of another wave than the candidates', () => {
  const args = parseMergeArgs(['--repaired-text=admit', `--candidates=${WAVE1_FILE}`, `--entries=${ENTRIES_FILE}`]);
  assert.throws(() => runCheck(args), /sha256|source/);
});

// ---------------------------------------------------------------------------------------------
// The publish script on wave 2 (offline: no database)
// ---------------------------------------------------------------------------------------------

test('dry-run offline on the wave-2 candidates: 382 rows, 1 group, all score-bound, no blockers, the wave-1 group named as a top-up', async () => {
  const out = tmpDir('authored-w2-plan-');
  const args = { mode: 'dry-run', candidates: CANDIDATES_FILE, outDir: out, offline: true, fixtures: 'tmp/nta-fixtures', fitDir: 'data/nta_fit_scores', agentDir: null, now: NOW };
  const report = await dryRun(args);
  assert.equal(report.source, AUTHORED_SOURCE_W2);
  assert.deepEqual(report.blockers, []);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.summary.questions, 382);
  assert.equal(report.summary.passageGroups, 1);
  assert.deepEqual(report.summary.topUpSets.map((s) => [s.setId, s.groupId, s.existingChildren]), [['english__p1__set3', passageGroupIdOf('english__p1__set3'), 3]]);
  assert.deepEqual(report.checks.agentScores, { bound: 382, missing: 0, hashMismatch: 0 });
  assert.deepEqual(report.checks.fitScores, { bound: 382, missing: 0, hashMismatch: 0 });
  const plan = readJson(report.planFile);
  assert.equal(plan.rows.length, 382);
  assert.equal(plan.groups.length, 1);
  assert.equal(plan.candidatesSha256, loadCandidates(CANDIDATES_FILE).sha256);
});

test('a fake database: the dry run blocks when the wave-1 group a question completes is missing, and passes when it is there', async () => {
  const groupId = passageGroupIdOf('english__p1__set3');
  const fake = (present) => ({
    from(table) {
      const state = { table, ids: [] };
      const query = {
        select() { return query; },
        in(_column, ids) { state.ids = ids; return query; },
        limit() { return Promise.resolve({ data: [], error: null }); },
        eq() { return query; },
        then(resolve) {
          if (state.table === 'passage_groups') return resolve({ data: state.ids.filter((id) => present.includes(id)).map((id) => ({ id })), error: null });
          return resolve({ data: [], error: null });
        },
      };
      return query;
    },
  });
  const run = (present) => dryRun({ mode: 'dry-run', candidates: CANDIDATES_FILE, outDir: tmpDir('authored-w2-db-'), offline: false, fixtures: null, fitDir: 'data/nta_fit_scores', agentDir: null, now: NOW }, { sb: fake(present), target: { host: 'test.supabase.co', ref: 'test' } });
  const missing = await run([]);
  assert.ok(missing.blockers.some((b) => /completes are not in the target/.test(b)), JSON.stringify(missing.blockers));
  const found = await run([groupId]);
  assert.deepEqual(found.blockers, []);
  assert.equal(found.checks.topUpGroupsMissing, 0);
});

// ---------------------------------------------------------------------------------------------
// The acceptance, the drops and the ledger
// ---------------------------------------------------------------------------------------------

test('the drop ledger gives every drop a category and a reason, names no published question, and lists every hand decision', () => {
  const dropped = readJson(DROPPED_FILE);
  const decisions = readJson(DECISIONS_FILE).decisions;
  const finalIds = new Set(wave2().map((c) => c.id));
  assert.equal(dropped.length, 35);
  assert.equal(new Set(dropped.map((d) => d.id)).size, dropped.length);
  for (const d of dropped) {
    assert.ok(d.category && String(d.reason).trim().length > 10, d.id);
    assert.ok(!finalIds.has(d.id), `${d.id} is both dropped and published`);
  }
  for (const decision of decisions) {
    assert.ok(decision.reason.trim() && decision.category && decision.who, decision.id);
    assert.equal(dropped.find((d) => d.id === decision.id)?.category, decision.category, decision.id);
  }
  const by = dropped.reduce((acc, d) => ({ ...acc, [d.category]: (acc[d.category] || 0) + 1 }), {});
  assert.deepEqual(by, {
    identical_to_live_question: 2, near_duplicate: 4, spot_check_practice_grade: 3, geography_ncert_recheck_hdi_banding: 1,
    expert_verdict_not_publishable: 3, spot_check_probable_reject: 1, same_concept_repeat: 3, duplicate: 3,
    geography_ncert_recheck_practice: 9, geography_ncert_recheck_reject: 4, second_reviewer_practice: 1, held_key_correct_solvers_disagree: 1,
  });
  // The 12 questions that were held for a blind re-solve all came back (2 or 3 of 3 on the key); nothing is held for that reason any more.
  assert.equal(dropped.filter((d) => d.category === 'held_repaired_text_needs_blind_resolve').length, 0);
  // 87c9264b is held, not rejected: the key is right by computation, the fresh solvers did not reach 4 of 5, and the rule stands.
  const matrix = dropped.find((d) => d.id.startsWith('87c9264b'));
  assert.equal(matrix.category, 'held_key_correct_solvers_disagree');
  assert.ok(/4 of 5/.test(matrix.reason));
  // The two repeats of the questions that came back were dropped by the duplicate screen (it keeps the first accepted copy).
  const dupes = dropped.filter((d) => d.category === 'duplicate').map((d) => d.id.slice(0, 8)).sort();
  assert.deepEqual(dupes, ['06298513', '26feae72', '66c40b7a']);
});

test('the acceptance file carries the final summary and per-question outcome', () => {
  const acceptance = readJson(ACCEPTANCE_FILE);
  assert.equal(acceptance.final.final, 382);
  assert.equal(acceptance.final.dropped, 35);
  assert.deepEqual(acceptance.final.problems, []);
  assert.deepEqual(Object.fromEntries(Object.entries(acceptance.final.bySubject).map(([s, v]) => [s, v.final])), COUNTS);
  assert.equal(acceptance.questions.filter((q) => q.final === 'published').length, 382);
  assert.equal(acceptance.final_pass_inputs.fresh_pass_ids, 10);
  assert.deepEqual(acceptance.final_pass_inputs.fresh_pass_partial, []);
  assert.deepEqual(acceptance.final_pass_inputs.expert_conflicts, []);
});

// ---------------------------------------------------------------------------------------------
// The final pass itself, on the raw files (these exist only on the machine that holds tmp/authored-w2)
// ---------------------------------------------------------------------------------------------

const RAW = 'tmp/authored-w2';
const haveRaw = fs.existsSync(`${RAW}/biology`) && fs.existsSync(`${RAW}/reword`);

function finalArgs(extra = []) {
  const out = tmpDir('authored-w2-final-');
  return { out, args: { ...parseAcceptArgs([`--out=${out}`, `--now=${NOW}`, '--mode=final', ...extra]) } };
}

test('the final pass reproduces the committed final candidates, entries and ledger', { skip: !haveRaw }, async () => {
  const { out, args } = finalArgs();
  const result = await runFinal(args);
  assert.deepEqual(result.problems, []);
  for (const name of ['wave2-candidates-final-2026-10-14.json', 'wave2-dropped-2026-10-14.json']) {
    assert.equal(fs.readFileSync(path.join(out, name), 'utf8'), fs.readFileSync(`${DIR}/${name}`, 'utf8'), name);
  }
  // The entries file names the candidates file by a path relative to where it was written; everything else is the same.
  const entries = readJson(path.join(out, 'wave2-score-entries-final-2026-10-14.json'));
  const committed = readJson(ENTRIES_FILE);
  delete entries.candidates_file;
  delete committed.candidates_file;
  assert.deepEqual(entries, committed);
});

// The 12 repaired questions were brought back by the re-solve files in tmp/authored-w2/resolve. To test the rule itself these tests run the final pass
// with an empty re-solve folder (the 12 are held again), then with a re-solve folder they build.
async function heldBaseline() {
  const { args } = finalArgs([`--resolve=${tmpDir('authored-w2-rv-none-')}`]);
  const base = await runFinal(args);
  const held = base.dropped.filter((d) => d.category === 'held_repaired_text_needs_blind_resolve');
  assert.equal(held.length, 12);
  return { held, base: base.final.length };
}

test('a repaired question whose blind text changed is published only with a blind re-solve of 2 of 3 on the key', { skip: !haveRaw }, async () => {
  const { held: dropped, base: BASE } = await heldBaseline();
  const keys = new Map();
  for (const subject of fs.readdirSync(RAW, { withFileTypes: true }).filter((d) => d.isDirectory() && !['reword', 'expert', 'resolve'].includes(d.name))) {
    for (const file of fs.readdirSync(path.join(RAW, subject.name)).filter((n) => n.endsWith('.json') && !n.endsWith('-blind.json'))) {
      for (const q of readJson(path.join(RAW, subject.name, file)).questions) keys.set(q.id, { key: q.correct_key, q });
    }
  }
  const blindOf = (q) => ({ id: q.id, subject: q.subject, chapter: q.chapter, type: q.type, stem: q.stem, options: q.options, passage_text: q.passage_text ?? null });
  const resolveDir = tmpDir('authored-w2-rv-');
  fs.writeFileSync(path.join(resolveDir, 'rv-w2-blind.json'), JSON.stringify({ batch: 'rv-w2', questions: dropped.map((d) => blindOf(keys.get(d.id).q)) }));
  const wrongOf = (key) => ['A', 'B', 'C', 'D'].find((letter) => letter !== key);
  // All twelve: s1 and s2 on the key, s3 wrong (2 of 3). One of them: only s1 on the key (1 of 3), which is not enough.
  const loser = dropped[0].id;
  const answer = (role) => dropped.map((d) => ({ id: d.id, answer: d.id === loser && role !== 's1' ? wrongOf(keys.get(d.id).key) : (role === 's3' ? wrongOf(keys.get(d.id).key) : keys.get(d.id).key) }));
  for (const role of ['s1', 's2', 's3']) fs.writeFileSync(path.join(resolveDir, `rv-w2__${role}.json`), JSON.stringify(answer(role)));
  const { out, args } = finalArgs([`--resolve=${resolveDir}`]);
  const result = await runFinal(args);
  assert.deepEqual(result.problems, []);
  // Eleven of the twelve have their re-solve. Two of those eleven repeat a question that is published already (the 'since 2015' item and the sin 3x / x continuity item,
  // each a restatement of a held one), so the duplicate screen, which keeps the first accepted copy, now drops those two later copies instead.
  const stillHeld = result.dropped.filter((d) => d.category === 'held_repaired_text_needs_blind_resolve').map((d) => d.id);
  assert.deepEqual(stillHeld, [], 'a re-solve that exists but does not reach 2 of 3 is a failed re-solve, not a missing one');
  assert.deepEqual(result.dropped.filter((d) => d.category === 'blind_resolve_failed').map((d) => d.id), [loser]);
  const displaced = result.dropped.filter((d) => d.category === 'duplicate').map((d) => d.id.slice(0, 8)).sort();
  assert.ok(displaced.includes('06298513') && displaced.includes('66c40b7a'), displaced.join(','));
  assert.equal(displaced.length, 3, 'the two displaced copies and 26feae72, which was already a duplicate');
  assert.equal(result.final.length, BASE + 11 - 2, 'eleven return and the two displaced copies leave');
  const entries = readJson(path.join(out, 'wave2-score-entries-final-2026-10-14.json'));
  const returned = dropped.filter((d) => d.id !== loser);
  for (const d of returned) {
    const record = entries.entries[d.id];
    assert.equal(record.blind_solvers.on, 'as_authored');
    assert.deepEqual([record.blind_resolve_on_final_text.n, record.blind_resolve_on_final_text.matched_key], [3, 2]);
    assert.ok(record.text.pre_repair, 'the text the five solvers saw is recorded');
  }
  // A question that is back changes the plan, so the plan still validates.
  assert.deepEqual(planPublication(readJson(path.join(out, 'wave2-candidates-final-2026-10-14.json'))).problems, []);
});

test('a stale re-solve (another wording than the final one) is ignored and the question stays held', { skip: !haveRaw }, async () => {
  const { held: dropped, base: BASE } = await heldBaseline();
  const resolveDir = tmpDir('authored-w2-rv-stale-');
  const [first] = dropped;
  let key = null;
  let blind = null;
  for (const subject of fs.readdirSync(RAW, { withFileTypes: true }).filter((d) => d.isDirectory() && !['reword', 'expert', 'resolve'].includes(d.name))) {
    for (const file of fs.readdirSync(path.join(RAW, subject.name)).filter((n) => n.endsWith('.json') && !n.endsWith('-blind.json'))) {
      const q = readJson(path.join(RAW, subject.name, file)).questions.find((x) => x.id === first.id);
      if (q) { key = q.correct_key; blind = { id: q.id, subject: q.subject, chapter: q.chapter, type: q.type, stem: `${q.stem} (older wording)`, options: q.options, passage_text: q.passage_text ?? null }; }
    }
  }
  fs.writeFileSync(path.join(resolveDir, 'rv-w2-blind.json'), JSON.stringify({ batch: 'rv-w2', questions: [blind] }));
  for (const role of ['s1', 's2', 's3']) fs.writeFileSync(path.join(resolveDir, `rv-w2__${role}.json`), JSON.stringify([{ id: first.id, answer: key }]));
  const { args } = finalArgs([`--resolve=${resolveDir}`]);
  const result = await runFinal(args);
  assert.equal(result.final.length, BASE);
  assert.ok(result.dropped.some((d) => d.id === first.id && d.category === 'held_repaired_text_needs_blind_resolve'));
});
