import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentHash } from '../content_evidence.js';
import { ntaAgentScoreEntry, ntaAgentScoreIntegrity } from '../nta_agent_scores.js';
import { ntaEligibility } from '../nta_engine.js';
import { attachPassages, loadNtaAgentRows } from '../nta_pool.js';
import {
  AUTHORED_SOURCE, GROUP_COLUMNS, QUESTION_COLUMNS, QUESTION_TYPE, buildFinalCandidates, contentHashOf, passageGroupIdOf, planPublication, smallSets, toPassageGroupRow, toQuestionRow, validateCandidates,
} from '../../scripts/lib/authored-wave.mjs';
import {
  acceptanceReasons, agentEntryFor, buildEntries, fitEntryFor, fitGateReasons, hashesOf, mergeAgentTable, mergeFitTable, positionsOf, preRepairDiff, qualityProblems, sameHashedText,
} from '../../scripts/lib/authored-scores.mjs';
import { parseArgs as parseMergeArgs, runCheck, runEntries, runFinalCandidates, runMerge, runRejudgeList } from '../../scripts/authored-scores-merge.mjs';
import {
  agentTablesFrom, apply, bankLookalikes, dryRun, loadCandidates, missingColumns, parseArgs, restore, scoreCoverage, targetOf,
} from '../../scripts/question-publish-authored.mjs';

// No network anywhere in this file: the database is an in-memory fake, the judge files are written to a temp directory.

// The final candidates (what is published) and the wave-1 candidates as first built (kept for history; 4 questions failed the fresh pass, 19 were reworded).
const CANDIDATES_FILE = 'docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json';
const ENTRIES_FILE = 'docs/brain/reports/authored/wave1-score-entries-final-2026-10-14.json';
const DROPPED_FILE = 'docs/brain/reports/authored/wave1-dropped-2026-10-14.json';
const FIRST_CANDIDATES_FILE = 'docs/brain/reports/authored/wave1-candidates-2026-10-14.json';
const FIRST_ENTRIES_FILE = 'docs/brain/reports/authored/wave1-score-entries-2026-10-14.json';
const FIRST_BUILD_ARGS = [`--candidates=${FIRST_CANDIDATES_FILE}`, `--original-candidates=${FIRST_CANDIDATES_FILE}`, `--entries=${FIRST_ENTRIES_FILE}`];
const SUBJECTS = ['chemistry', 'english', 'history', 'political_science', 'psychology', 'sociology'];
const tmpDir = (name = 'authored-') => fs.mkdtempSync(path.join(os.tmpdir(), name));
const wave1 = () => JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
const firstBuild = () => JSON.parse(fs.readFileSync(FIRST_CANDIDATES_FILE, 'utf8'));

// ---------------------------------------------------------------------------------------------
// The mapping
// ---------------------------------------------------------------------------------------------

test('a standalone candidate becomes a live, visible row shaped like the verified live rows', () => {
  const c = wave1().find((x) => x.type === 'single_mcq');
  const row = toQuestionRow(c);
  assert.equal(row.id, c.id, 'the authored uuid is kept');
  assert.equal(row.body, c.stem);
  assert.equal(row.question, null);
  assert.equal(row.correct_answer, c.correct_key);
  assert.equal(row.correct_index, null);
  assert.deepEqual(row.options, c.options.map(({ key, text }) => ({ key, text })));
  assert.deepEqual([row.status, row.verification_state, row.exploration_state, row.is_deleted], ['live', 'verified', 'active', false]);
  assert.equal(row.source, AUTHORED_SOURCE);
  assert.equal(row.question_type, 'conceptual_mcq');
  assert.equal(row.difficulty, c.difficulty_label);
  assert.equal(row.difficulty_weight, { easy: 1, medium: 2, hard: 3 }[c.difficulty_label]);
  assert.ok(row.tags.includes(`authored_run:${AUTHORED_SOURCE}`) && row.tags.includes('source_kind:claude_authored'));
  assert.equal(row.passage_group_id, null);
  assert.equal(row.passage_text, null);
});

test('provenance, evidence and the DB content_hash are never written: a provenance row is evidence-managed and hidden from practice', async () => {
  for (const column of ['provenance', 'evidence', 'legacy_screening', 'content_hash', 'family_id', 'concept_id']) assert.ok(!QUESTION_COLUMNS.includes(column), column);
  const { legacyPracticeVisible } = await import('../practice_availability.js');
  const row = toQuestionRow(wave1()[0]);
  assert.equal(legacyPracticeVisible(row), true, 'visible to the practice reader');
  assert.equal(legacyPracticeVisible({ ...row, provenance: { kind: AUTHORED_SOURCE } }), false, 'the reason provenance stays null');
});

test('passage children carry the group id, the passage, a 1-based order and the kind; the group row matches', () => {
  const candidates = wave1();
  const plan = planPublication(candidates);
  assert.equal(plan.groups.length, 12);
  const english = plan.rows.filter((r) => r.subject === 'english');
  assert.equal(english.length, 58);
  for (const group of plan.groups) {
    const children = plan.rows.filter((r) => r.passage_group_id === group.id);
    assert.ok(children.length >= 3 && children.length <= 5, `${group.id} has ${children.length}`);
    assert.deepEqual(children.map((r) => r.order_index), children.map((_, i) => i + 1));
    for (const child of children) {
      assert.equal(child.passage_text, group.passage_text);
      assert.equal(child.passage_id, group.id);
      assert.equal(child.chapter, group.chapter);
      assert.equal(child.passage_type, group.passage_type);
      assert.equal(child.question_type, 'reading_comprehension');
    }
    assert.match(group.id, /^pg_[0-9a-f]{32}$/);
    assert.deepEqual([group.status, group.discoverable, group.source, group.subject], ['live', true, AUTHORED_SOURCE, 'english']);
    assert.deepEqual(group.mode_visibility, ['full_mock', 'nta_mode']);
  }
  assert.ok(['factual', 'narrative', 'literary'].every((kind) => plan.groups.some((g) => g.passage_type === kind)));
});

test('the group id depends only on the set id, so a re-run writes the same group', () => {
  assert.equal(passageGroupIdOf('english__p1__set1'), passageGroupIdOf('english__p1__set1'));
  assert.notEqual(passageGroupIdOf('english__p1__set1'), passageGroupIdOf('english__p1__set2'));
  const [first] = wave1().filter((c) => c.set_id);
  const children = wave1().filter((c) => c.set_id === first.set_id);
  assert.equal(toPassageGroupRow(first.set_id, children).id, passageGroupIdOf(first.set_id));
});

test('the final plan: 475 rows, 12 groups, the subject counts, one short set reported, and it is stable', () => {
  const candidates = wave1();
  const plan = planPublication(candidates);
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.rows.length, 475);
  assert.deepEqual(plan.summary.bySubject, { chemistry: 95, english: 58, history: 81, political_science: 81, psychology: 79, sociology: 81 });
  assert.deepEqual(plan.summary.byExpertReview, { ready: 341, repaired: 134 });
  assert.equal(new Set(plan.rows.map((r) => r.id)).size, 475);
  assert.deepEqual(plan.summary.passageSetsBelowNtaMinimum.map((set) => [set.setId, set.children, set.ntaMinimum]), [['english__p1__set3', 3, 4]]);
  assert.equal(plan.rows.filter((r) => r.tags.includes('authored_revision:reworded')).length, 19);
  assert.equal(planPublication(structuredClone(candidates)).planHash, plan.planHash, 'same candidates, same plan hash');
  const changed = structuredClone(candidates);
  changed[0].explanation += ' ';
  assert.notEqual(planPublication(changed).planHash, plan.planHash, 'any change to a row changes the plan hash');
  for (const type of Object.keys(QUESTION_TYPE)) assert.ok(plan.rows.some((r) => r.question_type === QUESTION_TYPE[type]), type);
});

test('the content hash of a planned row is the engine content hash, and a repair overlay changes it', () => {
  const candidates = wave1();
  const plan = planPublication(candidates);
  const positions = positionsOf(plan.rows);
  for (const c of candidates.slice(0, 40)) {
    const row = plan.rows.find((r) => r.id === c.id);
    assert.equal(contentHashOf(c, positions.get(c.id)), contentHash(row));
  }
  const c = candidates[0];
  assert.notEqual(contentHashOf(c, { overlay: { stem: `${c.stem} (older wording)` } }), contentHashOf(c));
  assert.equal(contentHashOf(c, { overlay: { difficulty_label: 'hard', ncert_ref: 'older reference' } }), contentHashOf(c), 'the label and the NCERT reference are not in the hash');
  const child = candidates.find((x) => x.set_id);
  assert.notEqual(contentHashOf(child, { overlay: { passage_text: 'another passage' } }), contentHashOf(child), 'the passage is in the hash');
});

test('validateCandidates names every structural problem and plans nothing while any remains', () => {
  const ok = wave1();
  assert.deepEqual(validateCandidates(ok), []);
  const make = (fn) => { const list = structuredClone(ok); fn(list); return validateCandidates(list).map((p) => p.problem); };
  assert.ok(make((l) => { l[1].id = l[0].id; }).includes('duplicate_id'));
  assert.ok(make((l) => { l[0].id = 'not-a-uuid'; }).includes('id_not_uuid'));
  assert.ok(make((l) => { l[0].correct_key = 'E'; }).includes('correct_key_invalid'));
  assert.ok(make((l) => { l[0].chapter = 'Nonexistent Chapter'; }).includes('chapter_not_in_blueprint'));
  assert.ok(make((l) => { l[0].options = l[0].options.slice(0, 3); }).includes('options_not_four_keyed_A_to_D'));
  assert.ok(make((l) => { l[0].options[1].text = l[0].options[0].text; }).includes('duplicate_option_text'));
  assert.ok(make((l) => { l[0].source = 'something-else'; }).includes('source_not_authored_run'));
  assert.ok(make((l) => { l[0]._verdict = 'reject'; }).includes('expert_verdict_not_ready_or_repaired'));
  assert.ok(make((l) => { l[0].passage_text = 'a passage on a standalone item'; }).includes('passage_text_on_standalone_item'));
  const setId = ok.find((c) => c.set_id).set_id;
  const thin = make((l) => { for (const c of l.filter((x) => x.set_id === setId).slice(1)) c.set_id = `${setId}-other`; });
  assert.ok(thin.some((p) => p.startsWith('set_has_1_children')), thin.join(','));
  assert.ok(make((l) => { l.find((x) => x.set_id === setId).passage_text += ' extra'; }).includes('set_children_disagree_on_passage'));
  const bad = structuredClone(ok);
  bad[0].correct_key = 'E';
  assert.deepEqual(planPublication(bad).rows, []);
  assert.equal(planPublication(bad).planHash, null);
});

// ---------------------------------------------------------------------------------------------
// Raw judge files to entries (synthetic raw tree)
// ---------------------------------------------------------------------------------------------

const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };

/** A raw tree for three real candidates: one ready, one repaired in its options, one repaired in its label only. */
function syntheticWave() {
  const real = wave1().filter((c) => c.subject === 'chemistry' && c.type === 'single_mcq').slice(0, 3).map((c) => structuredClone(c));
  const [ready, optionRepair, labelRepair] = real;
  optionRepair._verdict = 'repaired';
  labelRepair._verdict = 'repaired';
  const finalTexts = [ready, optionRepair, labelRepair];
  // The text the judges saw: the repaired ones differ from the final text.
  const asAuthored = structuredClone(finalTexts);
  asAuthored[1].options[2].text = `${asAuthored[1].options[2].text} (older wording)`;
  asAuthored[1].explanation = 'An older explanation.';
  asAuthored[2].difficulty_label = asAuthored[2].difficulty_label === 'hard' ? 'easy' : 'hard';
  const raw = tmpDir('authored-raw-');
  const batch = 'chemistry__a1';
  writeJson(path.join(raw, 'chemistry', `${batch}.json`), { batch, subject: 'chemistry', questions: asAuthored });
  const quality = (judge, tag) => finalTexts.map((c) => ({ id: c.id, blind_answer: c.correct_key, key_matches: true, quality_score: judge === 'j1' ? 8 : 9, difficulty_check: 'medium', objective_tag: tag(c), flags: [], note: `${judge} note` }));
  const fit = (judge) => finalTexts.map((c) => ({
    id: c.id, cuet_type: 'single_mcq', passage_skill: null, unit: c.unit, chapter: c.chapter, pyq_closeness: 0, pyq_anchor: null, ten_route: judge === 'h3' ? 'cbt_staple' : null,
    est_seconds: 50, fit_score: judge === 'h1' ? 10 : 9, fit_flags: [], note: `${judge} note`,
  }));
  const same = (c) => 'chemistry.solutions.henry-law-kh-inverse-solubility';
  writeJson(path.join(raw, 'chemistry', 'verify', `${batch}__j1.json`), quality('j1', same));
  writeJson(path.join(raw, 'chemistry', 'verify', `${batch}__j2.json`), quality('j2', (c) => `chemistry.solutions.${c.id.slice(0, 4)}-different-spelling`));
  for (const judge of ['h1', 'h2', 'h3']) writeJson(path.join(raw, 'chemistry', 'verify', `${batch}__${judge}.json`), fit(judge));
  for (const solver of ['s1', 's2', 's3', 's4', 's5']) writeJson(path.join(raw, 'chemistry', 'verify', `${batch}__${solver}.json`), finalTexts.map((c) => ({ id: c.id, answer: c.correct_key, confidence: 'high' })));
  writeJson(path.join(raw, 'expert', 'chemistry__x1__verdict.json'), finalTexts.map((c) => ({ id: c.id, verdict: c._verdict, issue: c._verdict === 'repaired' ? `repair of ${c.id.slice(0, 4)}` : '', question: c })));
  writeJson(path.join(raw, 'expert', 'rv-01-blind.json'), { batch: 'rv-01', questions: [optionRepair, labelRepair].map((c) => ({ id: c.id })) });
  for (const s of ['s1', 's2', 's3']) writeJson(path.join(raw, 'expert', `rv-01__${s}.json`), [optionRepair, labelRepair].map((c) => ({ id: c.id, answer: c.correct_key })));
  return { raw, finalTexts, asAuthored };
}

const MODELS = { quality: 'model-q', fit: 'model-f', solver: 'model-s' };

test('buildEntries keeps every judge, the expert verdict, the re-solve and the pre-repair fields', () => {
  const { raw, finalTexts } = syntheticWave();
  const { entries, problems, counts } = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  assert.deepEqual(problems, []);
  assert.equal(counts.entries, 3);
  const [ready, optionRepair, labelRepair] = finalTexts.map((c) => entries[c.id]);
  assert.equal(ready.text.pre_repair, null);
  assert.deepEqual(Object.keys(optionRepair.text.pre_repair).sort(), ['explanation', 'options']);
  assert.deepEqual(Object.keys(labelRepair.text.pre_repair), ['difficulty_label']);
  assert.equal(optionRepair.text.expert_verdict, 'repaired');
  assert.match(optionRepair.text.expert_issue, /^repair of /);
  assert.deepEqual(optionRepair.blind_resolve_on_final_text, { n: 3, matched_key: 3, answers: [finalTexts[1].correct_key, finalTexts[1].correct_key, finalTexts[1].correct_key] });
  assert.equal(ready.blind_resolve_on_final_text, null);
  assert.equal(ready.blind_solvers.matched_key, 5, 'the original solvers are read from the verify folders, not from the re-solve files');
  assert.equal(ready.quality.length, 2);
  assert.equal(ready.fit.length, 3);
});

test('buildEntries refuses a question with a missing or invalid judge result, or a verdict that disagrees', () => {
  const { raw, finalTexts } = syntheticWave();
  fs.rmSync(path.join(raw, 'chemistry', 'verify', 'chemistry__a1__h2.json'));
  let result = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  assert.equal(Object.keys(result.entries).length, 0);
  assert.ok(result.problems.every((p) => p.problem === 'missing_judge_results:h2'));

  const broken = syntheticWave();
  const file = path.join(broken.raw, 'chemistry', 'verify', 'chemistry__a1__j1.json');
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  rows[0].quality_score = 11;
  writeJson(file, rows);
  result = buildEntries(broken.finalTexts, { rawDir: broken.raw, models: MODELS, date: '2026-10-14' });
  assert.ok(result.problems.some((p) => p.problem.startsWith('invalid_j1_result:quality_score')));

  const wrongVerdict = syntheticWave();
  wrongVerdict.finalTexts[0]._verdict = 'repaired';
  result = buildEntries(wrongVerdict.finalTexts, { rawDir: wrongVerdict.raw, models: MODELS, date: '2026-10-14' });
  assert.ok(result.problems.some((p) => p.problem.startsWith('expert_verdict_ready_but_candidate_marked_repaired')));
});

test('a question marked ready whose text differs from the judged text is a problem, not an entry', () => {
  const { raw, finalTexts } = syntheticWave();
  const file = path.join(raw, 'chemistry', 'chemistry__a1.json');
  const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
  batch.questions[0].stem += ' (older)';
  writeJson(file, batch);
  const { problems } = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  assert.ok(problems.some((p) => p.problem.startsWith('ready_but_text_differs_from_judged_text:stem')));
});

test('qualityProblems follows the rubric result format', () => {
  const good = { id: 'x', blind_answer: 'A', key_matches: true, quality_score: 8, difficulty_check: 'easy', objective_tag: 't', flags: [] };
  assert.deepEqual(qualityProblems(good, 'x'), []);
  assert.deepEqual(qualityProblems({ ...good, blind_answer: 'E', flags: 'none', quality_score: 7.5 }, 'x').sort(), ['blind_answer', 'flags', 'quality_score']);
});

test('hashesOf: the repair overlay is the only thing that separates the final and the judged hash', () => {
  const { raw, finalTexts } = syntheticWave();
  const { entries } = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  const [ready, optionRepair, labelRepair] = finalTexts.map((c) => hashesOf(c, entries[c.id], {}));
  assert.equal(ready.hashChanged, false);
  assert.equal(optionRepair.hashChanged, true);
  assert.equal(labelRepair.hashChanged, false, 'a label change leaves the hashed content alone');
  assert.deepEqual(preRepairDiff({ stem: 'a', options: [1] }, { stem: 'a', options: [2] }), { options: [1] });
});

test('the admit policy binds repaired scores to the final hash, hold to the pre-repair hash, and both say what was scored', () => {
  const { raw, finalTexts } = syntheticWave();
  const { entries } = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  const header = { models: MODELS, date: '2026-10-14' };
  const repaired = finalTexts[1];
  const row = toQuestionRow(repaired);
  const admit = agentEntryFor(repaired.id, repaired, entries[repaired.id], { policy: 'admit', header });
  const hold = agentEntryFor(repaired.id, repaired, entries[repaired.id], { policy: 'hold', header });
  assert.equal(admit.content_hash, contentHash(row));
  assert.notEqual(hold.content_hash, contentHash(row));
  assert.equal(admit.provenance.hash_changed_by_repair, true);
  assert.equal(admit.provenance.judged_text, 'pre_repair');
  assert.deepEqual(admit.provenance.repaired_fields.sort(), ['explanation', 'options']);
  assert.equal(admit.provenance.engine_acceptance, 'admitted_on_expert_verdict_and_blind_resolve');
  assert.equal(hold.provenance.engine_acceptance, 'held_until_fresh_judge_pass_on_final_text');
  assert.equal(admit.provenance.expert_verdict, 'repaired');
  assert.equal(admit.provenance.blind_resolve_on_final_text.matched_key, 3);
  // Whatever the policy, every judge records the hash of the text it actually scored.
  for (const entry of [admit, hold]) for (const judge of entry.judges) assert.equal(judge.scored_content_hash, hold.content_hash);
  // The engine's own integrity check: admit passes, hold is "changed since scored".
  const table = (entry) => ({ chemistry: { rubric_version: 'nta-agent-rubric-1', calibration: { status: 'calibrated', threshold: 7, owner_bar: 8 }, questions: { [repaired.id]: entry } } });
  const found = (entry) => ntaAgentScoreEntry(repaired.id, { agentScores: table(entry) });
  assert.deepEqual(ntaAgentScoreIntegrity(row, found(admit)), []);
  assert.deepEqual(ntaAgentScoreIntegrity(row, found(hold)), ['question_changed_since_scored']);
  // A ready question is the same under both policies.
  const readyAdmit = agentEntryFor(finalTexts[0].id, finalTexts[0], entries[finalTexts[0].id], { policy: 'admit', header });
  const readyHold = agentEntryFor(finalTexts[0].id, finalTexts[0], entries[finalTexts[0].id], { policy: 'hold', header });
  assert.equal(readyAdmit.content_hash, readyHold.content_hash);
  assert.equal(readyAdmit.provenance.judged_text, 'final');
  // The label-only repair is not a text repair: both policies bind it to the (identical) hash.
  const labelHold = agentEntryFor(finalTexts[2].id, finalTexts[2], entries[finalTexts[2].id], { policy: 'hold', header });
  assert.equal(labelHold.content_hash, contentHash(toQuestionRow(finalTexts[2])));
});

test('agent and fit entries follow the committed formats (nta-pass-merge and nta-fit-merge)', () => {
  const { raw, finalTexts } = syntheticWave();
  const { entries } = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  const header = { models: MODELS, date: '2026-10-14' };
  const c = finalTexts[0];
  const agent = agentEntryFor(c.id, c, entries[c.id], { policy: 'admit', header });
  assert.deepEqual(agent.judges.map((j) => [j.judge, j.model, j.date, j.quality_score, j.key_matches]), [['j1', 'model-q', '2026-10-14', 8, true], ['j2', 'model-q', '2026-10-14', 9, true]]);
  assert.equal(agent.mean, 8.5);
  assert.equal(agent.key, c.correct_key);
  assert.equal(agent.key_agreement, 'both');
  assert.equal(agent.blocking, false);
  assert.equal(agent.objective_tag, null, 'the two judges spelled the tag differently');
  const fit = fitEntryFor(c.id, c, entries[c.id], { policy: 'admit', header, engineTypeGuess: 'single_mcq' });
  assert.deepEqual(fit.judges.map((j) => [j.judge, j.model, j.fit_score]), [['h1', 'model-f', 10], ['h2', 'model-f', 9], ['h3', 'model-f', 9]]);
  assert.equal(fit.cuet_type, 'single_mcq');
  assert.equal(fit.fit_median, 9);
  assert.equal(fit.fit_median_raw, 9);
  assert.equal(fit.ten_route, null, 'one judge naming a route is not two');
  assert.deepEqual(fitGateReasons(fit, fit.content_hash), []);
  assert.deepEqual(fitGateReasons(fit, 'another hash'), ['fit_question_changed']);
  assert.deepEqual(fitGateReasons({ ...fit, judges: fit.judges.slice(0, 2) }, fit.content_hash), ['fit_needs_three_judges']);
  assert.deepEqual(fitGateReasons({ ...fit, fit_median: 7 }, fit.content_hash), ['fit_below_bar']);
  assert.deepEqual(fitGateReasons(null, 'x'), ['fit_not_judged']);
  // A 10 stands only when two judges name the same route.
  const tens = { ...entries[c.id], fit: entries[c.id].fit.map((j) => ({ ...j, fit_score: 10, ten_route: null })) };
  assert.equal(fitEntryFor(c.id, c, tens, { policy: 'admit', header }).fit_median, 9);
  const routed = { ...entries[c.id], fit: entries[c.id].fit.map((j, i) => ({ ...j, fit_score: 10, ten_route: i < 2 ? 'board' : null })) };
  assert.equal(fitEntryFor(c.id, c, routed, { policy: 'admit', header }).fit_median, 10);
});

// ---------------------------------------------------------------------------------------------
// Merging into the tables
// ---------------------------------------------------------------------------------------------

function baseAgentTable(extra = {}) {
  return {
    note: 'n', subject: 'chemistry', rubric_version: 'nta-agent-rubric-1', rubric_sha256: 'x', merged_at: '2026-10-13T00:00:00.000Z', models: ['claude-haiku-5-5'],
    calibration: { status: 'calibrated', threshold: 7, owner_bar: 8, model: 'claude-haiku-5-5' }, measures: { judged_by_both: 1 },
    questions: { 'old-id': { question_id: 'old-id', judges: [] } }, ...extra,
  };
}

test('merging adds the authored entries, leaves every other entry as it is, and is idempotent', () => {
  const { raw, finalTexts } = syntheticWave();
  const { entries } = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  const header = { models: MODELS, date: '2026-10-14' };
  const agent = Object.fromEntries(finalTexts.map((c) => [c.id, agentEntryFor(c.id, c, entries[c.id], { policy: 'admit', header })]));
  const base = baseAgentTable();
  const once = mergeAgentTable(base, agent, { subject: 'chemistry', now: 'T1', header, policy: 'admit' });
  assert.deepEqual(base, baseAgentTable(), 'the base table object is not modified');
  assert.deepEqual(once.questions['old-id'], base.questions['old-id']);
  assert.equal(Object.keys(once.questions).length, 4);
  assert.deepEqual(once.models, ['claude-haiku-5-5', 'model-q']);
  assert.equal(once.authored[AUTHORED_SOURCE].questions, 3);
  assert.equal(once.measures.judged_by_both, 1, 'the base measures are not rewritten');
  assert.equal(once.measures.admissible_before_row_checks, 3);
  assert.deepEqual(once.calibration, base.calibration);
  const twice = mergeAgentTable(once, agent, { subject: 'chemistry', now: 'T1', header, policy: 'admit' });
  assert.deepEqual(twice, once);
  // The same ids under the other policy replace the authored entries in place.
  const held = Object.fromEntries(finalTexts.map((c) => [c.id, agentEntryFor(c.id, c, entries[c.id], { policy: 'hold', header })]));
  const switched = mergeAgentTable(once, held, { subject: 'chemistry', now: 'T2', header, policy: 'hold' });
  assert.deepEqual(Object.keys(switched.questions), Object.keys(once.questions));
  assert.equal(switched.authored[AUTHORED_SOURCE].held_for_fresh_judge_pass, 1);
});

test('merging refuses to replace an entry that is not from the authored run, and a table under another rubric', () => {
  const { raw, finalTexts } = syntheticWave();
  const { entries } = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  const header = { models: MODELS, date: '2026-10-14' };
  const c = finalTexts[0];
  const entry = { [c.id]: agentEntryFor(c.id, c, entries[c.id], { policy: 'admit', header }) };
  const collides = baseAgentTable({ questions: { [c.id]: { question_id: c.id, judges: [] } } });
  assert.throws(() => mergeAgentTable(collides, entry, { subject: 'chemistry', now: 'T', header, policy: 'admit' }), /not from claude-authored-2026-10-14/);
  assert.throws(() => mergeAgentTable(baseAgentTable({ rubric_version: 'nta-agent-rubric-0' }), entry, { subject: 'chemistry', now: 'T', header, policy: 'admit' }), /rubric/);
  assert.throws(() => mergeAgentTable(null, entry, { subject: 'chemistry', now: 'T', header, policy: 'admit' }), /missing/);
});

test('a missing fit base gives an authored-only table marked partial; an existing base keeps its entries and measures', () => {
  const { raw, finalTexts } = syntheticWave();
  const { entries } = buildEntries(finalTexts, { rawDir: raw, models: MODELS, date: '2026-10-14' });
  const header = { models: MODELS, date: '2026-10-14' };
  const fit = Object.fromEntries(finalTexts.map((c) => [c.id, fitEntryFor(c.id, c, entries[c.id], { policy: 'admit', header })]));
  const fresh = mergeFitTable(null, fit, { subject: 'chemistry', now: 'T', header, policy: 'admit' });
  assert.equal(fresh.status, 'partial');
  assert.equal(fresh.rubric_version, 'nta-cuet-fit-rubric-1');
  assert.equal(Object.keys(fresh.questions).length, 3);
  const base = { ...fresh, status: 'complete', questions: { 'old-id': { question_id: 'old-id' } }, measures: { judged: 1 }, authored: undefined };
  const merged = mergeFitTable(base, fit, { subject: 'chemistry', now: 'T', header, policy: 'admit' });
  assert.equal(merged.status, 'complete');
  assert.deepEqual(merged.measures, { judged: 1 });
  assert.deepEqual(merged.questions['old-id'], { question_id: 'old-id' });
  assert.equal(merged.authored[AUTHORED_SOURCE].fit_pass_at_8, 3);
  assert.throws(() => mergeFitTable({ ...base, rubric_version: 'nta-cuet-fit-rubric-0' }, fit, { subject: 'chemistry', now: 'T', header, policy: 'admit' }), /rubric/);
});

// ---------------------------------------------------------------------------------------------
// The wave-1 entries against the committed tables and the real engine (offline)
// ---------------------------------------------------------------------------------------------

function mergedWave1(policy, extra = []) {
  const dir = tmpDir('authored-tables-');
  const agentDir = path.join(dir, 'agent');
  const fitDir = path.join(dir, 'fit');
  fs.mkdirSync(agentDir);
  for (const subject of SUBJECTS) fs.copyFileSync(`data/nta_agent_scores/${subject}.json`, path.join(agentDir, `${subject}.json`));
  const args = parseMergeArgs([`--repaired-text=${policy}`, `--agent-dir=${agentDir}`, `--fit-base=${fitDir}`, `--fit-out=${fitDir}`, '--now=2026-10-14T00:00:00.000Z', ...extra]);
  return { ...runMerge(args), agentDir, fitDir, args };
}

test('wave 1 final: all 475 are bound to their hash and the engine admits every one; 11 of 12 English sets are servable', () => {
  const { report, agentDir, fitDir } = mergedWave1('admit');
  assert.equal(report.planned, 475);
  assert.equal(report.agentEntries, 475);
  assert.equal(report.hashChangedByRepair, 0, 'every repaired text was re-judged, so no entry binds scores to other text');
  assert.equal(report.heldForFreshPass, 0);
  assert.equal(report.fitGate.pass, 475, 'every question passes the fit gate (mirror of data/nta_fit_scores.js)');
  assert.equal(report.engineEligible, 475);
  assert.equal(report.engineIneligible, 0);
  assert.deepEqual(report.engineIneligibleReasons, {});
  assert.deepEqual(report.bySubject.english, { planned: 58, eligible: 58, fitPass: 58, both: 58 });
  assert.equal(report.passageSets.servable, 11);
  assert.equal(report.passageSets.of, 12);
  assert.deepEqual(report.passageSets.sets.filter((set) => !set.servable).map((set) => [set.children, set.eligibleChildren]), [[3, 3]], 'the set that lost a child to the fresh pass has 3 questions, below the 4 the engine needs');
  // The publish script's own coverage check sees every row bound in both tables.
  const rows = planPublication(wave1()).rows;
  const coverage = scoreCoverage(rows, { fitDir, agentScores: agentTablesFrom(agentDir) });
  assert.deepEqual([coverage.agent.bound, coverage.agent.missing.length, coverage.agent.hashMismatch.length], [475, 0, 0]);
  assert.deepEqual([coverage.fit.checked, coverage.fit.bound, coverage.fit.missing.length, coverage.fit.hashMismatch.length], [true, 475, 0, 0]);
});

test('wave 1 as first built (479 candidates, original judges): admit gives 460 and names the 19 content refusals', () => {
  const { report, agentDir, fitDir } = mergedWave1('admit', FIRST_BUILD_ARGS);
  assert.equal(report.planned, 479);
  assert.equal(report.hashChangedByRepair, 60);
  assert.equal(report.heldForFreshPass, 0);
  assert.equal(report.fitGate.pass, 479);
  assert.equal(report.engineEligible, 460);
  assert.equal(report.engineIneligible, 19);
  assert.deepEqual(report.engineIneligibleReasons, {
    answer_guard_options_invalid: 3, answer_guard_near_duplicate_options: 3, options_invalid: 3, wording_corrupted_connective: 1, orphan_passage_question: 15,
  });
  assert.equal(report.passageSets.servable, 12);
  const rows = planPublication(firstBuild()).rows;
  const coverage = scoreCoverage(rows, { fitDir, agentScores: agentTablesFrom(agentDir) });
  assert.deepEqual([coverage.agent.bound, coverage.fit.bound], [479, 479]);
  assert.equal(planPublication(firstBuild()).planHash, '9b81a3af7302f4190752e4cef910825fe8a07428690c6e8f64e0cb3e34e3f223');
});

test('wave 1 as first built, hold: the 60 repaired-text questions stay out of the engine until a fresh pass', () => {
  const { report, agentDir } = mergedWave1('hold', FIRST_BUILD_ARGS);
  assert.equal(report.heldForFreshPass, 60);
  assert.equal(report.engineIneligibleReasons.question_changed_since_scored, 60);
  assert.equal(report.fitGate.reasons.fit_question_changed, 60);
  assert.equal(report.engineEligible, 402);
  assert.equal(report.passageSets.servable < 12, true, 'English sets lose children');
  const rows = planPublication(firstBuild()).rows;
  const coverage = scoreCoverage(rows, { fitDir: path.join(agentDir, '..', 'no-fit'), agentScores: agentTablesFrom(agentDir) });
  assert.equal(coverage.agent.hashMismatch.length, 60);
});

test('wave 1 final, hold: nothing is held, because every question judged on a different text was re-judged on the final one', () => {
  const admit = mergedWave1('admit').report;
  const hold = mergedWave1('hold').report;
  assert.equal(hold.heldForFreshPass, 0);
  assert.equal(hold.engineEligible, admit.engineEligible);
  assert.deepEqual(hold.bySubject, admit.bySubject);
});

test('the merge only touches the six wave subjects and leaves their existing entries byte for byte', () => {
  const { agentDir } = mergedWave1('admit');
  for (const subject of SUBJECTS) {
    const before = JSON.parse(fs.readFileSync(`data/nta_agent_scores/${subject}.json`, 'utf8'));
    const after = JSON.parse(fs.readFileSync(path.join(agentDir, `${subject}.json`), 'utf8'));
    const authored = Object.entries(after.questions).filter(([, entry]) => entry.provenance?.kind === AUTHORED_SOURCE);
    assert.equal(Object.keys(after.questions).length, Object.keys(before.questions).length + authored.length - Object.values(before.questions).filter((e) => e.provenance?.kind === AUTHORED_SOURCE).length);
    for (const [id, entry] of Object.entries(before.questions)) if (!entry.provenance) assert.deepEqual(after.questions[id], entry);
    assert.deepEqual(after.calibration, before.calibration);
    assert.equal(after.rubric_version, before.rubric_version);
  }
});

test('entries file: committed, covers all 475 final ids, and its candidates hash is the committed final candidates file', () => {
  const file = JSON.parse(fs.readFileSync(ENTRIES_FILE, 'utf8'));
  const { candidates, sha256 } = loadCandidates(CANDIDATES_FILE);
  assert.equal(file.candidates_sha256, sha256);
  assert.equal(Object.keys(file.entries).length, 475);
  for (const c of candidates) {
    const record = file.entries[c.id];
    assert.equal(record.text.expert_verdict, c._verdict);
    assert.equal(record.quality.length, 2);
    assert.equal(record.fit.length, 3);
    assert.ok(record.quality.every((j) => j.blind_answer === c.correct_key && j.quality_score >= 7 && j.flags.length === 0), c.id);
    assert.ok(record.fit.every((j) => j.fit_flags.length === 0) || record.fit.filter((j) => j.fit_flags.length).length < 2, c.id);
  }
  const all = Object.values(file.entries);
  const repaired = all.filter((r) => r.text.expert_verdict === 'repaired');
  assert.equal(repaired.length, 134);
  // Where the expert's blind re-solve covers the final text it was 3 of 3; the 6 repaired questions reworded afterwards have fresh solvers instead.
  assert.equal(repaired.filter((r) => r.blind_resolve_on_final_text?.matched_key === 3).length, 128);
  assert.equal(repaired.filter((r) => r.blind_resolve_on_earlier_text).length, 6);
  // Fresh judges on the final text: the 56 repaired-text questions that passed plus the 19 reworded ones, 2 of them in both groups.
  assert.equal(all.filter((r) => r.text.judged === 'final').length, 73);
  assert.equal(all.filter((r) => r.text.reworded_after_wave1).length, 19);
  assert.ok(all.filter((r) => r.text.reworded_after_wave1).every((r) => r.text.judged === 'final' && r.blind_solvers.on === 'final' && r.blind_solvers.matched_key >= 4 && r.text.expert_reviewed_text === 'earlier_text'));
  // No entry is bound to text its judges did not see, except where only the label or the NCERT reference changed (outside the hash).
  const hashed = ['stem', 'options', 'correct_key', 'explanation', 'passage_text', 'chapter', 'subject'];
  assert.ok(all.every((r) => !r.text.pre_repair || Object.keys(r.text.pre_repair).every((field) => !hashed.includes(field))));
  assert.deepEqual(file.models, { quality: 'claude-haiku-5-5', fit: 'claude-haiku-5-5', solver: 'claude-haiku-5-5' });
  assert.deepEqual(file.fresh_passes.map((dir) => path.basename(dir)), ['fresh']);
});

test('the first-build entries file still matches the first-build candidates (kept for history)', () => {
  const file = JSON.parse(fs.readFileSync(FIRST_ENTRIES_FILE, 'utf8'));
  const { sha256 } = loadCandidates(FIRST_CANDIDATES_FILE);
  assert.equal(file.candidates_sha256, sha256);
  assert.equal(Object.keys(file.entries).length, 479);
  assert.equal(Object.values(file.entries).filter((r) => r.text.pre_repair && Object.keys(r.text.pre_repair).some((f) => ['stem', 'options', 'explanation'].includes(f))).length, 60);
});

test('the final candidates are exactly the first-build candidates, minus the dropped ones, with the reworded ones replaced', () => {
  const first = firstBuild();
  const finalList = wave1();
  const dropped = JSON.parse(fs.readFileSync(DROPPED_FILE, 'utf8'));
  assert.deepEqual(dropped.map((d) => d.id).sort(), [
    '2aeac152-79f9-4bc3-b24d-a4fe11c51c3b', '5417fab7-c777-435a-851d-c06d92c7480a', '7620ca67-81e1-4155-8b15-c0f56c847aff', 'bfe02c5b-46a2-478e-a826-fc0392cdff7f',
  ]);
  assert.ok(dropped.every((d) => d.reason.length > 20));
  const reworded = finalList.filter((c) => c._reworded);
  assert.equal(reworded.length, 19);
  const rebuilt = buildFinalCandidates(first, reworded, dropped);
  assert.deepEqual(rebuilt.problems, []);
  assert.deepEqual(rebuilt.candidates, finalList);
  assert.equal(finalList.length, first.length - 4);
  const firstById = new Map(first.map((c) => [c.id, c]));
  for (const c of finalList) {
    const before = firstById.get(c.id);
    for (const field of ['id', 'subject', 'chapter', 'type', 'set_id', 'passage_text', 'source', '_verdict']) assert.deepEqual(c[field], before[field], `${c.id} ${field}`);
    if (!c._reworded) assert.deepEqual(c, before);
  }
});

test('runEntries asks who judged and refuses a candidates file with missing judge results', () => {
  assert.throws(() => runEntries(parseMergeArgs(['--mode=entries'])), /--quality-model is required/);
  const { raw, finalTexts } = syntheticWave();
  fs.rmSync(path.join(raw, 'chemistry', 'verify', 'chemistry__a1__s1.json'));
  const dir = tmpDir();
  const candidates = path.join(dir, 'c.json');
  writeJson(candidates, finalTexts);
  const result = runEntries(parseMergeArgs(['--mode=entries', `--candidates=${candidates}`, `--raw=${raw}`, `--out=${path.join(dir, 'e.json')}`, '--quality-model=q', '--fit-model=f', '--solver-model=s']), { write: true });
  assert.equal(result.ok, true, 'a missing solver file does not stop the judges\' entries');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'e.json'), 'utf8')).entries[finalTexts[0].id].blind_solvers.n, 4);
  fs.rmSync(path.join(raw, 'chemistry', 'verify', 'chemistry__a1__j2.json'));
  const bad = runEntries(parseMergeArgs(['--mode=entries', `--candidates=${candidates}`, `--raw=${raw}`, `--out=${path.join(dir, 'e2.json')}`, '--quality-model=q', '--fit-model=f', '--solver-model=s']));
  assert.equal(bad.ok, false);
  assert.equal(fs.existsSync(path.join(dir, 'e2.json')), false, 'nothing is written while problems remain');
});

test('runCheck requires an explicit repaired-text policy and the candidates the entries were built from', () => {
  assert.throws(() => runCheck(parseMergeArgs([])), /--repaired-text=admit\|hold is required/);
  const dir = tmpDir();
  const other = path.join(dir, 'other.json');
  writeJson(other, wave1().slice(0, 5));
  assert.throws(() => runCheck(parseMergeArgs(['--repaired-text=admit', `--candidates=${other}`])), /not the one the entries were built from/);
});

// ---------------------------------------------------------------------------------------------
// The publish script against an in-memory database
// ---------------------------------------------------------------------------------------------

/** A tiny PostgREST-shaped fake: select/insert/update/delete with in/eq/limit, count/head, a column list per table. */
function fakeDb({ questions = [], groups = [], questionColumns = null, failInsertOnCall = null } = {}) {
  const tables = { questions: questions.map((r) => structuredClone(r)), passage_groups: groups.map((r) => structuredClone(r)) };
  const columns = { questions: questionColumns, passage_groups: null };
  const log = [];
  let insertCalls = 0;
  const from = (table) => {
    const state = { filters: [], op: 'select', payload: null, cols: '*', head: false, count: false, limit: null, returning: false };
    const api = {
      select(cols = '*', opts = {}) { if (state.op !== 'select') state.returning = true; else { state.cols = cols; state.head = !!opts.head; state.count = !!opts.count; } return api; },
      in(col, values) { state.filters.push((r) => values.includes(r[col])); return api; },
      eq(col, value) { state.filters.push((r) => r[col] === value); return api; },
      is(col, value) { state.filters.push((r) => (r[col] ?? null) === value); return api; },
      limit(n) { state.limit = n; return api; },
      insert(rows) { state.op = 'insert'; state.payload = rows; return api; },
      update(patch) { state.op = 'update'; state.payload = patch; return api; },
      delete() { state.op = 'delete'; return api; },
      then(resolve) {
        const rows = tables[table];
        if (state.op === 'select') {
          const wanted = state.cols === '*' ? null : state.cols.split(',').map((c) => c.trim());
          if (wanted && columns[table]) {
            const bad = wanted.find((c) => !columns[table].includes(c));
            if (bad) return resolve({ data: null, error: { code: '42703', message: `column ${table}.${bad} does not exist` } });
          }
          let hit = rows.filter((r) => state.filters.every((f) => f(r)));
          if (state.limit !== null) hit = hit.slice(0, state.limit);
          if (state.head) return resolve({ data: null, count: hit.length, error: null });
          return resolve({ data: hit.map((r) => (wanted ? Object.fromEntries(wanted.map((c) => [c, r[c]])) : structuredClone(r))), error: null });
        }
        if (state.op === 'insert') {
          insertCalls += 1;
          if (failInsertOnCall === insertCalls) return resolve({ data: null, error: { message: 'simulated insert failure' } });
          for (const row of state.payload) if (rows.some((r) => r.id === row.id)) return resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
          log.push({ op: 'insert', table, ids: state.payload.map((r) => r.id) });
          rows.push(...state.payload.map((r) => structuredClone(r)));
          return resolve({ data: state.returning ? state.payload.map((r) => ({ id: r.id })) : null, error: null });
        }
        const hit = rows.filter((r) => state.filters.every((f) => f(r)));
        if (state.op === 'update') {
          log.push({ op: 'update', table, ids: hit.map((r) => r.id), patch: state.payload });
          hit.forEach((r) => Object.assign(r, structuredClone(state.payload)));
        } else {
          log.push({ op: 'delete', table, ids: hit.map((r) => r.id) });
          tables[table] = rows.filter((r) => !hit.includes(r));
        }
        return resolve({ data: state.returning ? hit.map((r) => ({ id: r.id })) : null, error: null });
      },
    };
    return api;
  };
  return { tables, log, from, columns };
}

const ALL_COLUMNS = Object.freeze([...QUESTION_COLUMNS, 'created_at', 'updated_at']);
const dbWithColumns = (extra = {}) => fakeDb({ questionColumns: ALL_COLUMNS, ...extra });
const GROUP_ALL = Object.freeze([...GROUP_COLUMNS]);

let tables = null;
function publishArgs(extra = []) {
  const out = tmpDir('authored-publish-');
  return { out, args: parseArgs([`--out=${out}`, `--agent-dir=${tables.agentDir}`, `--fit-dir=${tables.fitDir}`, '--fixtures=none', '--now=2026-10-14T07:00:00.000Z', ...extra]) };
}
tables = mergedWave1('admit');

test('parseArgs and targetOf', () => {
  const args = parseArgs(['--mode=apply', '--plan=p.json', '--reason=why', '--expect-project=abc', '--allow-unscored', '--hard-delete', '--offline', '--candidates=c.json']);
  assert.deepEqual([args.mode, args.plan, args.reason, args.expectProject, args.allowUnscored, args.hardDelete, args.offline, args.candidates], ['apply', 'p.json', 'why', 'abc', true, true, true, 'c.json']);
  assert.equal(parseArgs([]).mode, 'dry-run');
  assert.deepEqual(targetOf('https://isrxrxzjocewrdureyhp.supabase.co'), { host: 'isrxrxzjocewrdureyhp.supabase.co', ref: 'isrxrxzjocewrdureyhp' });
});

test('dry-run offline writes a plan file and reads nothing: 475 rows, 12 groups, every row score-bound, one short set warned about', async () => {
  const { out, args } = publishArgs(['--offline']);
  const result = await dryRun(args, { sb: null });
  assert.deepEqual(result.blockers, []);
  assert.equal(result.summary.questions, 475);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /english__p1__set3 has 3 questions, below the NTA minimum of 4/);
  assert.equal(result.summary.passageGroups, 12);
  assert.match(result.checks.note, /NOT checked/);
  assert.deepEqual(result.checks.agentScores, { bound: 475, missing: 0, hashMismatch: 0 });
  assert.deepEqual(result.checks.fitScores, { bound: 475, missing: 0, hashMismatch: 0 });
  const plan = JSON.parse(fs.readFileSync(result.planFile, 'utf8'));
  assert.equal(plan.kind, 'authored_publish_plan');
  assert.equal(plan.rows.length, 475);
  assert.equal(plan.groups.length, 12);
  assert.equal(plan.planHash, planPublication(wave1()).planHash);
  assert.equal(plan.rows.every((r) => r.live_at === null), true, 'live_at is stamped at apply time, not planned');
  assert.deepEqual(fs.readdirSync(out), [path.basename(result.planFile)]);
});

test('dry-run against a database reads only: it reports existing ids, missing columns and live counts, and writes no row', async () => {
  const candidates = wave1();
  const existing = [toQuestionRow(candidates[3])];
  const db = dbWithColumns({ questions: existing });
  db.columns.passage_groups = GROUP_ALL;
  const { args } = publishArgs();
  const result = await dryRun(args, { sb: db, target: { host: 'x.supabase.co', ref: 'x' } });
  assert.equal(result.checks.existingQuestionIds, 1);
  assert.equal(result.checks.existingGroupIds, 0);
  assert.equal(result.checks.questionColumnsMissing, 0);
  assert.deepEqual(result.checks.liveBefore.chemistry >= 0, true);
  assert.ok(result.blockers.some((b) => /already exist/.test(b)));
  assert.equal(db.log.length, 0, 'a dry run never writes');
  assert.equal(db.tables.questions.length, 1);

  const lacking = dbWithColumns({ questionColumns: ALL_COLUMNS.filter((c) => c !== 'passage_group_id') });
  lacking.columns.passage_groups = GROUP_ALL;
  const second = await dryRun(publishArgs().args, { sb: lacking });
  assert.equal(second.checks.questionColumnsMissing, 1);
  assert.ok(second.blockers.some((b) => /lacks columns/.test(b)));
  assert.deepEqual((await missingColumns(lacking, 'questions', QUESTION_COLUMNS)).map((c) => c.column), ['passage_group_id']);
});

test('dry-run blocks when the score tables are not merged yet', async () => {
  const { args } = publishArgs(['--offline', `--agent-dir=${tmpDir()}`]);
  const result = await dryRun(args, { sb: null });
  assert.ok(result.blockers.some((b) => /agent score entry/.test(b)));
  assert.equal(result.checks.agentScores.missing, 475);
});

async function approvedPlan(extra = []) {
  const { out, args } = publishArgs(extra);
  const plan = await dryRun({ ...args, offline: true }, { sb: null });
  return { out, args, plan };
}

test('apply inserts the groups first, then the questions as live and visible rows, and writes the restore file before the first insert', async () => {
  const db = dbWithColumns();
  db.columns.passage_groups = GROUP_ALL;
  const { out, args, plan } = await approvedPlan(['--mode=apply', '--reason=test run']);
  args.plan = plan.planFile;
  const result = await apply(args, { sb: db, target: { host: 'x.supabase.co', ref: 'x' } });
  assert.equal(result.inserted, 475);
  assert.equal(result.groupsInserted, 12);
  assert.deepEqual([result.missing, result.notVisible, result.hashMismatch, result.groupsMissing], [[], [], [], []]);
  assert.equal(db.log[0].table, 'passage_groups', 'groups first');
  assert.ok(db.log.slice(1).every((entry) => entry.table === 'questions' && entry.op === 'insert'));
  assert.equal(db.tables.questions.length, 475);
  assert.ok(db.tables.questions.every((r) => r.status === 'live' && r.verification_state === 'verified' && r.exploration_state === 'active' && r.is_deleted === false && r.live_at === '2026-10-14T07:00:00.000Z'));
  assert.ok(db.tables.questions.every((r) => r.source === AUTHORED_SOURCE && r.provenance === undefined && r.evidence === undefined));
  assert.deepEqual(result.liveAfter, { chemistry: 95, english: 58, history: 81, political_science: 81, psychology: 79, sociology: 81 });
  const saved = JSON.parse(fs.readFileSync(result.restoreFile, 'utf8'));
  assert.equal(saved.kind, 'authored_publish_restore');
  assert.equal(saved.questionIds.length, 475);
  assert.equal(saved.groupIds.length, 12);
  assert.equal(saved.rows.length, 475);
  assert.equal(path.dirname(result.restoreFile), out);
});

test('apply refuses ids that already exist and writes nothing', async () => {
  const candidates = wave1();
  const db = dbWithColumns({ questions: [{ ...toQuestionRow(candidates[10]) }] });
  db.columns.passage_groups = GROUP_ALL;
  const { args, plan } = await approvedPlan(['--mode=apply', '--reason=r']);
  args.plan = plan.planFile;
  await assert.rejects(() => apply(args, { sb: db }), /refusing: 1 question ids and 0 passage group ids already exist/);
  assert.equal(db.log.length, 0);
  assert.equal(db.tables.questions.length, 1);
  assert.equal(fs.readdirSync(args.outDir).some((f) => f.startsWith('authored-publish-restore')), false, 'no restore file for a run that never started');

  const groupId = planPublication(candidates).groups[0].id;
  const withGroup = dbWithColumns({ groups: [{ id: groupId, source: 'someone-else' }] });
  withGroup.columns.passage_groups = GROUP_ALL;
  await assert.rejects(() => apply(args, { sb: withGroup }), /0 question ids and 1 passage group ids already exist/);
});

test('apply needs an approved plan that still matches the candidates and the rows', async () => {
  const db = dbWithColumns();
  db.columns.passage_groups = GROUP_ALL;
  const { args, plan } = await approvedPlan(['--mode=apply']);
  await assert.rejects(() => apply({ ...args, plan: plan.planFile, reason: '' }, { sb: db }), /need --plan and --reason/);
  const tampered = JSON.parse(fs.readFileSync(plan.planFile, 'utf8'));
  tampered.planHash = 'f'.repeat(64);
  const tamperedFile = path.join(args.outDir, 'tampered.json');
  fs.writeFileSync(tamperedFile, JSON.stringify(tampered));
  await assert.rejects(() => apply({ ...args, plan: tamperedFile, reason: 'r' }, { sb: db }), /plan hash differs/);
  tampered.planHash = plan.planHash;
  tampered.candidatesSha256 = '0'.repeat(64);
  fs.writeFileSync(tamperedFile, JSON.stringify(tampered));
  await assert.rejects(() => apply({ ...args, plan: tamperedFile, reason: 'r' }, { sb: db }), /candidates file changed/);
  const blocked = JSON.parse(fs.readFileSync(plan.planFile, 'utf8'));
  blocked.blockers = ['something'];
  fs.writeFileSync(tamperedFile, JSON.stringify(blocked));
  await assert.rejects(() => apply({ ...args, plan: tamperedFile, reason: 'r' }, { sb: db }), /listed blockers/);
  assert.equal(db.log.length, 0);
});

test('apply refuses rows the NTA engine could not admit unless told to', async () => {
  const db = dbWithColumns();
  db.columns.passage_groups = GROUP_ALL;
  const { args, plan } = await approvedPlan(['--mode=apply']);
  const unscored = { ...args, plan: plan.planFile, reason: 'r', agentDir: tmpDir() };
  await assert.rejects(() => apply(unscored, { sb: db }), /475 rows have no agent score entry/);
  assert.equal(db.log.length, 0);
  const forced = await apply({ ...unscored, allowUnscored: true }, { sb: db });
  assert.equal(forced.inserted, 475);
});

test('a failed insert leaves a restore file that names every intended id, and restore withdraws what was written', async () => {
  const db = dbWithColumns({ failInsertOnCall: 4 });
  db.columns.passage_groups = GROUP_ALL;
  const { args, plan } = await approvedPlan(['--mode=apply']);
  let restoreFile = null;
  await assert.rejects(() => apply({ ...args, plan: plan.planFile, reason: 'r' }, { sb: db }), (error) => { restoreFile = error.restoreFile; return /insert failed after 12 groups and 100 questions/.test(error.message) && /--mode=restore/.test(error.message); });
  assert.ok(fs.existsSync(restoreFile));
  assert.equal(db.tables.questions.length, 100);
  const result = await restore({ restore: restoreFile, hardDelete: false }, { sb: db });
  assert.equal(result.hidden, 100);
  assert.equal(result.skipped.length, 375, 'ids that were never written are skipped, not invented');
  assert.ok(db.tables.questions.every((r) => r.is_deleted === true && r.status === 'pending' && r.verification_state === 'disputed' && r.exploration_state === 'pending_review'));
});

test('restore hides the rows and their groups, touching only rows from this source', async () => {
  const db = dbWithColumns({ questions: [{ id: 'other-1', source: 'seed', status: 'live', is_deleted: false }] });
  db.columns.passage_groups = GROUP_ALL;
  const { args, plan } = await approvedPlan(['--mode=apply']);
  const applied = await apply({ ...args, plan: plan.planFile, reason: 'r' }, { sb: db });
  const saved = JSON.parse(fs.readFileSync(applied.restoreFile, 'utf8'));
  saved.questionIds.push('other-1');
  const widened = path.join(args.outDir, 'widened.json');
  fs.writeFileSync(widened, JSON.stringify(saved));
  const result = await restore({ restore: widened, hardDelete: false }, { sb: db });
  assert.equal(result.hidden, 475);
  assert.equal(result.groupsHidden, 12);
  assert.deepEqual(result.skipped, [{ id: 'other-1', why: 'not_found_or_not_from_this_source' }]);
  assert.equal(db.tables.questions.find((r) => r.id === 'other-1').status, 'live', 'a row of another source is untouched');
  assert.ok(db.tables.passage_groups.every((g) => g.status === 'hidden' && g.discoverable === false));
  await assert.rejects(() => restore({ restore: plan.planFile }, { sb: db }), /not an authored_publish_restore/);
});

test('restore --hard-delete removes unedited rows and their groups, and skips a row that was edited since apply', async () => {
  const db = dbWithColumns();
  db.columns.passage_groups = GROUP_ALL;
  const { args, plan } = await approvedPlan(['--mode=apply']);
  const applied = await apply({ ...args, plan: plan.planFile, reason: 'r' }, { sb: db });
  const edited = db.tables.questions.find((r) => r.subject === 'chemistry');
  edited.explanation += ' Edited later by someone.';
  const result = await restore({ restore: applied.restoreFile, hardDelete: true }, { sb: db });
  assert.equal(result.deleted, 474);
  assert.equal(result.groupsDeleted, 12);
  assert.deepEqual(result.skipped, [{ id: edited.id, why: 'edited_since_apply' }]);
  assert.deepEqual(db.tables.questions.map((r) => r.id), [edited.id]);
  assert.equal(db.tables.passage_groups.length, 0);
});

test('bankLookalikes finds the same question in a local export and a near copy of its stem, and skips a missing export', () => {
  const rows = planPublication(wave1()).rows;
  const target = rows.find((r) => r.subject === 'history' && r.body.length > 80);
  const dir = tmpDir('fixtures-');
  writeJson(path.join(dir, 'history.json'), [
    { id: 'dup', subject: 'history', status: 'live', is_deleted: false, body: target.body, options: target.options.map((o) => o.text).reverse() },
    { id: 'near', subject: 'history', status: 'live', is_deleted: false, body: `${target.body} Choose carefully.`, options: ['p', 'q', 'r', 's'] },
    { id: 'held', subject: 'history', status: 'pending', is_deleted: false, body: target.body, options: target.options.map((o) => o.text) },
  ]);
  writeJson(path.join(dir, 'manifest.json'), {});
  const result = bankLookalikes([target], dir);
  assert.deepEqual(result.exact, [{ id: target.id, existingId: 'dup' }]);
  assert.deepEqual(result.near, [{ id: target.id, existingId: 'near' }]);
  assert.deepEqual(bankLookalikes([target], path.join(dir, 'missing')), { checked: false, exact: [], near: [] });
});

// ---------------------------------------------------------------------------------------------
// The fit gate mirror against the real module, when a checkout that has it is available
// ---------------------------------------------------------------------------------------------

const FIT_CHECKOUT = process.env.NTA_FIT_CHECKOUT || path.resolve('..', 'mockmob-fit');
const fitModule = path.join(FIT_CHECKOUT, 'data', 'nta_fit_scores.js');

test('the fit gate mirror agrees with data/nta_fit_scores.js on wip/cuet-fit for every wave-1 entry, final and first build', { skip: !fs.existsSync(fitModule) && 'no checkout with data/nta_fit_scores.js (set NTA_FIT_CHECKOUT)' }, async () => {
  const real = await import(pathToFileURL(fitModule).href);
  const mirror = await import('../../scripts/lib/authored-scores.mjs');
  assert.equal(mirror.FIT_RUBRIC_VERSION, real.NTA_FIT_RUBRIC_VERSION);
  assert.equal(mirror.NTA_MIN_FIT_SCORE, real.NTA_MIN_FIT_SCORE);
  assert.deepEqual([...mirror.FIT_FLAGS], [...real.NTA_FIT_FLAGS]);
  assert.deepEqual([...mirror.FIT_JUDGES], [...real.NTA_FIT_JUDGES]);
  const rows = planPublication(wave1()).rows;
  const scenarios = [['admit', [], rows], ['hold', [], rows], ['hold', FIRST_BUILD_ARGS, planPublication(firstBuild()).rows]];
  for (const [policy, extra, scenarioRows] of scenarios) {
    const { fitDir } = mergedWave1(policy, extra);
    const fitTables = {};
    for (const subject of SUBJECTS) fitTables[subject] = JSON.parse(fs.readFileSync(path.join(fitDir, `${subject}.json`), 'utf8'));
    for (const row of scenarioRows) {
      const verdict = real.ntaFitVerdict(row, { fitScores: fitTables });
      const entry = fitTables[row.subject].questions[row.id];
      assert.deepEqual(mirror.fitGateReasons(entry, contentHash(row), { table: fitTables[row.subject] }).sort(), verdict.reasons.slice().sort(), `${policy} ${row.id}`);
    }
  }
});

test('the engine refuses nothing about the first-build rows that the scores can fix: every refusal is a content check', () => {
  const { report } = mergedWave1('admit', FIRST_BUILD_ARGS);
  assert.ok(Object.keys(report.engineIneligibleReasons).length > 0, 'the first build has the 19 content refusals');
  const scoreReasons = ['no_score', 'score_below_threshold', 'question_changed_since_scored', 'agent_blocking_flag', 'agent_blind_key_mismatch', 'score_needs_both_judges', 'agent_score_uncalibrated', 'agent_score_rubric_outdated', 'seed_or_demo_row', 'id_not_uuid', 'not_published', 'key_disputed', 'nta_quarantined', 'agent_key_dispute'];
  for (const reason of Object.keys(report.engineIneligibleReasons)) assert.ok(!scoreReasons.includes(reason), reason);
  // And one row end to end, through the engine's own gate.
  const row = planPublication(wave1()).rows.find((r) => r.subject === 'history');
  assert.equal(ntaEligibility({ ...row, evidence: null }, { subject: 'history', agentScores: agentTablesFrom(tables.agentDir) }).eligible, true);
});

test('the NTA pool reads the published rows through the agent-score path: every subject rows come back, English with their passages', async () => {
  const { agentDir } = tables;
  const agentScores = agentTablesFrom(agentDir);
  const plan = planPublication(wave1());
  const db = fakeDb({ questions: plan.rows, groups: plan.groups });
  const counts = {};
  for (const subject of SUBJECTS) {
    const rows = await loadNtaAgentRows(db, subject, new Set(), { agentScores });
    counts[subject] = rows.filter((row) => row.source === AUTHORED_SOURCE).length;
  }
  assert.deepEqual(counts, { chemistry: 95, english: 58, history: 81, political_science: 81, psychology: 79, sociology: 81 }, 'the agent score entries of all 475 pass every row-free check');
  const english = await loadNtaAgentRows(db, 'english', new Set(), { agentScores });
  const withPassages = await attachPassages(db, english.filter((row) => row.source === AUTHORED_SOURCE));
  assert.ok(withPassages.every((row) => row.passage_text && row.passage_group_id));
  // A held-back (is_deleted) row, or one that gained evidence, is not read.
  const hidden = fakeDb({ questions: plan.rows.map((row, i) => (i === 0 ? { ...row, is_deleted: true } : row)), groups: plan.groups });
  const chemistry = await loadNtaAgentRows(hidden, 'chemistry', new Set(), { agentScores });
  assert.equal(chemistry.filter((row) => row.source === AUTHORED_SOURCE).length, 94);
});

test('--impact builds papers from a local export without and with the authored rows, and skips a subject without an export file', () => {
  const dir = tmpDir('impact-');
  writeJson(path.join(dir, 'chemistry.json'), []);
  const out = tmpDir('impact-tables-');
  const { agentDir } = tables;
  const args = parseMergeArgs(['--repaired-text=admit', `--agent-dir=${agentDir}`, `--fit-base=${path.join(out, 'fit')}`, `--impact=${dir}`, '--now=2026-10-14T00:00:00.000Z']);
  const { report } = runCheck(args);
  const chemistry = report.impact.subjects.chemistry;
  assert.deepEqual([chemistry.exportRows, chemistry.faithful, chemistry.eligibleWithout], [0, true, 0]);
  assert.equal(chemistry.eligibleWith, 95, 'the engine admits all 95 authored chemistry questions');
  assert.equal(chemistry.papersWithout.length, 3);
  assert.equal(chemistry.papersWithout[0].status, 'refused');
  assert.ok(chemistry.papersWith.every((paper) => typeof paper.status === 'string'));
  assert.deepEqual(report.impact.subjects.history, { skipped: 'no export file' });
  assert.equal('english' in report.impact.subjects, false);
});

test('a fresh judge pass on the final text replaces the original results and clears the hold', () => {
  const { raw, finalTexts } = syntheticWave();
  const repaired = finalTexts[1];
  const fresh = tmpDir('fresh-');
  const q = (judge, score) => [{ id: repaired.id, blind_answer: repaired.correct_key, key_matches: true, quality_score: score, difficulty_check: 'medium', objective_tag: 'chemistry.solutions.fresh-pass-tag', flags: [], note: 'fresh' }];
  writeJson(path.join(fresh, 'chemistry__fresh1.json'), { batch: 'chemistry__fresh1', questions: [repaired] });
  writeJson(path.join(fresh, `chemistry__fresh1__j1.json`), q('j1', 9));
  writeJson(path.join(fresh, `chemistry__fresh1__j2.json`), q('j2', 9));
  for (const judge of ['h1', 'h2', 'h3']) writeJson(path.join(fresh, `chemistry__fresh1__${judge}.json`), [{ id: repaired.id, cuet_type: 'single_mcq', passage_skill: null, unit: repaired.unit, chapter: repaired.chapter, pyq_closeness: 0, ten_route: null, est_seconds: 40, fit_score: 9, fit_flags: [], note: 'fresh' }]);
  const { entries, problems } = buildEntries(finalTexts, { rawDir: raw, freshDirs: [fresh], models: MODELS, date: '2026-10-15' });
  assert.deepEqual(problems, []);
  const record = entries[repaired.id];
  assert.equal(record.text.judged, 'final');
  assert.equal(record.text.pre_repair, null);
  assert.deepEqual(record.quality.map((j) => j.quality_score), [9, 9]);
  const header = { models: MODELS, date: '2026-10-15' };
  const entry = agentEntryFor(repaired.id, repaired, record, { policy: 'hold', header });
  assert.equal(entry.content_hash, contentHash(toQuestionRow(repaired)), 'a re-judged question is bound to the final text under either policy');
  assert.equal(entry.provenance.judged_text, 'final_after_fresh_pass');
  assert.equal(entry.provenance.engine_acceptance, 'judged_text_is_final_text');
  // A fresh pass that lacks one role is refused: the judges of one entry must have seen the same text.
  fs.rmSync(path.join(fresh, 'chemistry__fresh1__h3.json'));
  assert.ok(buildEntries(finalTexts, { rawDir: raw, freshDirs: [fresh], models: MODELS, date: '2026-10-15' }).problems.some((p) => /fresh_pass_covers_only_some_judges/.test(p.problem)));
});

test('rejudge-list names exactly the questions whose hashed text the judges did not see', () => {
  const { raw, finalTexts } = syntheticWave();
  const dir = tmpDir();
  const candidates = path.join(dir, 'c.json');
  const entries = path.join(dir, 'e.json');
  writeJson(candidates, finalTexts);
  assert.equal(runEntries(parseMergeArgs(['--mode=entries', `--candidates=${candidates}`, `--raw=${raw}`, `--out=${entries}`, '--quality-model=q', '--fit-model=f', '--solver-model=s'])).ok, true);
  const result = runRejudgeList(parseMergeArgs([`--entries=${entries}`, `--candidates=${candidates}`, `--out=${path.join(dir, 'list.json')}`]));
  assert.equal(result.count, 1);
  assert.equal(result.list[0].id, finalTexts[1].id);
  assert.deepEqual(result.list[0].repaired_fields.sort(), ['explanation', 'options']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'list.json'), 'utf8')).map((x) => x.id), [finalTexts[1].id]);
  // On the first-build entries: the 60. On the final entries: none, every one was re-judged on its final text.
  const first = runRejudgeList(parseMergeArgs([...FIRST_BUILD_ARGS, `--out=${path.join(dir, 'first.json')}`]), { write: false });
  assert.equal(first.count, 60);
  assert.equal(runRejudgeList(parseMergeArgs([`--out=${path.join(dir, 'final.json')}`]), { write: false }).count, 0);
});

test('merge writes the agent tables only when the checkout has no fit tables, and the fit tables too once there is a base or --fit-out', () => {
  const dir = tmpDir('merge-out-');
  const agentDir = path.join(dir, 'agent');
  fs.mkdirSync(agentDir);
  for (const subject of SUBJECTS) fs.copyFileSync(`data/nta_agent_scores/${subject}.json`, path.join(agentDir, `${subject}.json`));
  const fitBase = path.join(dir, 'no-fit-here');
  const only = runMerge(parseMergeArgs(['--repaired-text=admit', `--agent-dir=${agentDir}`, `--fit-base=${fitBase}`]));
  assert.equal(only.fitTablesWritten, false);
  assert.match(only.fitNote, /not written/);
  assert.equal(fs.existsSync(fitBase), false);
  const both = runMerge(parseMergeArgs(['--repaired-text=admit', `--agent-dir=${agentDir}`, `--fit-base=${fitBase}`, `--fit-out=${fitBase}`]));
  assert.equal(both.fitTablesWritten, true);
  assert.deepEqual(fs.readdirSync(fitBase).sort(), SUBJECTS.map((s) => `${s}.json`));
});

/** A fresh pass directory for one chemistry question: its batch text file and five judges, with the given quality scores and fit scores. */
function freshPass(question, { dir = tmpDir('fresh-'), batch = 'fr-01', quality = [9, 9], fit = [9, 9, 9], flags = [], solvers = null } = {}) {
  writeJson(path.join(dir, `${batch}.json`), { batch, questions: [question] });
  quality.forEach((score, i) => writeJson(path.join(dir, `${batch}__j${i + 1}.json`), [{ id: question.id, blind_answer: question.correct_key, key_matches: true, quality_score: score, difficulty_check: 'medium', objective_tag: 'chemistry.solutions.fresh-tag', flags: i === 1 ? flags : [], note: 'fresh' }]));
  fit.forEach((score, i) => writeJson(path.join(dir, `${batch}__h${i + 1}.json`), [{ id: question.id, cuet_type: 'single_mcq', passage_skill: null, unit: question.unit, chapter: question.chapter, pyq_closeness: 0, ten_route: null, est_seconds: 40, fit_score: score, fit_flags: [], note: 'fresh' }]));
  (solvers || []).forEach((answer, i) => writeJson(path.join(dir, `${batch}__s${i + 1}.json`), [{ id: question.id, answer, confidence: 'high' }]));
  return dir;
}

test('a question that fails the acceptance rule gets no entry, so it cannot be published without being dropped first', () => {
  const { raw, finalTexts } = syntheticWave();
  const target = finalTexts[0];
  const build = (options) => buildEntries(finalTexts, { rawDir: raw, freshDirs: [freshPass(target, options)], models: MODELS, date: '2026-10-14' });
  assert.deepEqual(build({}).problems, [], 'a passing fresh pass is accepted');
  for (const [options, expected] of [
    [{ quality: [9, 6] }, /fails_acceptance:j2_quality_6/],
    [{ flags: ['duplicate_options'] }, /fails_acceptance:j2_flags_duplicate_options/],
    [{ fit: [8, 6, 4] }, /fails_acceptance:fit_median_6/],
  ]) {
    const result = build(options);
    assert.ok(result.problems.some((p) => p.id === target.id && expected.test(p.problem)), JSON.stringify(result.problems));
    assert.equal(result.entries[target.id], undefined);
  }
  // Fresh solvers on the final text must reach the key 4 times in 5; the original 5 of 5 on the old text do not stand in for them.
  const wrong = ['A', 'B', 'C', 'D'].find((letter) => letter !== target.correct_key);
  const shortOfKey = build({ solvers: [target.correct_key, target.correct_key, target.correct_key, wrong, wrong] });
  assert.ok(shortOfKey.problems.some((p) => /fails_acceptance:solvers_3_of_5/.test(p.problem)));
  assert.deepEqual(build({ solvers: [target.correct_key, target.correct_key, target.correct_key, target.correct_key, wrong] }).problems, []);
  // A repaired question whose text changed and that has no blind solver evidence on the final text is refused too.
  const noResolve = syntheticWave();
  for (const solver of ['s1', 's2', 's3']) fs.rmSync(path.join(noResolve.raw, 'expert', `rv-01__${solver}.json`));
  const refused = buildEntries(noResolve.finalTexts, { rawDir: noResolve.raw, models: MODELS, date: '2026-10-14' });
  assert.ok(refused.problems.some((p) => /fails_acceptance:no_blind_solver_evidence_on_final_text/.test(p.problem)));
});

test('a fresh result is used only where its batch text is the candidate text; results on an older wording are ignored', () => {
  const { raw, finalTexts } = syntheticWave();
  const target = finalTexts[1];
  const older = { ...target, stem: `${target.stem} (older wording)` };
  const dir = freshPass(older, { quality: [9, 9], fit: [9, 9, 9] });
  const result = buildEntries(finalTexts, { rawDir: raw, freshDirs: [dir], models: MODELS, date: '2026-10-14' });
  assert.deepEqual(result.problems, []);
  assert.equal(result.counts.staleFreshResultsIgnored, 5, 'five judges judged another wording');
  assert.equal(result.entries[target.id].text.judged, 'as_authored', 'the question falls back to its original judges');
  assert.ok(result.entries[target.id].text.pre_repair, 'and says what it was scored on');
  assert.equal(sameHashedText(target, { ...target, difficulty_label: 'hard', ncert_ref: 'x' }), true, 'the label and the NCERT reference are not part of the hashed text');
  assert.equal(sameHashedText(target, older), false);
});

test('a reworded question is judged on its new text, and the expert pass and re-solve are marked as being about the earlier text', () => {
  const { raw, finalTexts } = syntheticWave();
  const repaired = finalTexts[1];
  const reworded = { ...repaired, stem: `${repaired.stem} Choose one.`, _reworded: true };
  const originals = new Map([[repaired.id, repaired]]);
  const dir = tmpDir('fresh-rw-');
  writeJson(path.join(dir, 'rw-01.json'), { batch: 'rw-01', questions: [{ ...reworded, _engine_reasons: ['orphan_passage_question'] }] });
  freshPass(reworded, { dir, batch: 'rw-01-final', solvers: Array(5).fill(repaired.correct_key) });
  const candidates = [finalTexts[0], reworded, finalTexts[2]];
  const { entries, problems, counts } = buildEntries(candidates, { rawDir: raw, freshDirs: [dir], originals, models: MODELS, date: '2026-10-14' });
  assert.deepEqual(problems, []);
  const record = entries[repaired.id];
  assert.equal(record.text.expert_reviewed_text, 'earlier_text');
  assert.deepEqual(record.text.reworded_after_wave1, ['stem']);
  assert.deepEqual(record.text.reworded_engine_reasons, ['orphan_passage_question']);
  assert.equal(record.blind_resolve_on_final_text, null);
  assert.equal(record.blind_resolve_on_earlier_text.matched_key, 3);
  assert.deepEqual([record.blind_solvers.on, record.blind_solvers.matched_key], ['final', 5]);
  assert.equal(counts.rewordedAfterWave1, 1);
  const header = { models: MODELS, date: '2026-10-14' };
  const entry = agentEntryFor(repaired.id, reworded, record, { policy: 'hold', header });
  assert.equal(entry.content_hash, contentHash(toQuestionRow(reworded)));
  assert.equal(entry.provenance.judged_text, 'final_after_fresh_pass');
  assert.equal(entry.provenance.expert_reviewed_text, 'earlier_text');
  assert.deepEqual(entry.provenance.reworded_after_wave1, ['stem']);
  assert.equal(entry.provenance.blind_resolve_on_earlier_text.matched_key, 3);
  assert.ok(toQuestionRow(reworded).tags.includes('authored_revision:reworded'));
});

test('buildFinalCandidates drops, rewords, keeps the identity of a question, and refuses inconsistent inputs', () => {
  const base = firstBuild().slice(0, 12);
  const target = base[3];
  const drop = [{ id: base[0].id, reason: 'fresh quality judge scored 6' }];
  const reword = [{ ...target, stem: `${target.stem} (reworded)`, _verdict: 'something-else' }];
  const { candidates, dropped, problems } = buildFinalCandidates(base, reword, drop);
  assert.deepEqual(problems, []);
  assert.equal(candidates.length, 11);
  assert.equal(candidates.find((c) => c.id === base[0].id), undefined);
  const changed = candidates.find((c) => c.id === target.id);
  assert.equal(changed.stem, `${target.stem} (reworded)`);
  assert.equal(changed._verdict, target._verdict, 'the expert verdict is the original one');
  assert.equal(changed._reworded, true);
  assert.deepEqual(candidates.filter((c) => !c._reworded), base.filter((c) => c.id !== base[0].id && c.id !== target.id));
  assert.equal(dropped[0].subject, base[0].subject);
  const codes = (list) => list.map((p) => p.problem);
  assert.deepEqual(codes(buildFinalCandidates(base, [], [{ id: 'missing', reason: 'x' }]).problems), ['dropped_id_not_in_base']);
  assert.deepEqual(codes(buildFinalCandidates(base, [], [{ id: base[0].id, reason: ' ' }]).problems), ['dropped_without_reason']);
  assert.deepEqual(codes(buildFinalCandidates(base, [{ ...target, id: 'missing' }], []).problems), ['reworded_id_not_in_base']);
  assert.deepEqual(codes(buildFinalCandidates(base, [{ ...target, chapter: 'Another Chapter' }], []).problems), ['reworded_chapter_differs']);
  assert.ok(codes(buildFinalCandidates(base, [target], [{ id: target.id, reason: 'r' }]).problems).includes('reworded_and_dropped'));
});

test('runFinalCandidates writes the final candidates file and reports a set that fell below the NTA minimum', () => {
  const dir = tmpDir('final-');
  const out = path.join(dir, 'final.json');
  const english = firstBuild().filter((c) => c.set_id === 'english__p1__set3');
  assert.equal(english.length, 4);
  const rest = firstBuild().filter((c) => c.set_id !== 'english__p1__set3').slice(0, 10);
  const base = path.join(dir, 'base.json');
  writeJson(base, [...rest, ...english]);
  const dropFile = path.join(dir, 'drop.json');
  writeJson(dropFile, [{ id: english[0].id, reason: 'fresh fit judges 8/6/4' }]);
  const result = runFinalCandidates(parseMergeArgs([`--original-candidates=${base}`, `--drop=${dropFile}`, `--out=${out}`]));
  assert.equal(result.ok, true);
  assert.equal(result.count, 13);
  assert.deepEqual(result.passageSetsBelowNtaMinimum.map((set) => [set.setId, set.children]), [['english__p1__set3', 3]]);
  assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).length, 13);
  // Down to one question a set is not a set: refused, nothing written.
  writeJson(dropFile, english.slice(0, 3).map((c) => ({ id: c.id, reason: 'x' })));
  const refused = runFinalCandidates(parseMergeArgs([`--original-candidates=${base}`, `--drop=${dropFile}`, `--out=${path.join(dir, 'never.json')}`]));
  assert.equal(refused.ok, false);
  assert.ok(refused.problems.some((p) => /^set_has_1_children_below_minimum_2/.test(p.problem)));
  assert.equal(fs.existsSync(path.join(dir, 'never.json')), false);
});

test('a passage set of three is published with a warning; a set of one is refused', () => {
  const list = wave1();
  assert.deepEqual(validateCandidates(list), []);
  assert.deepEqual(smallSets(list).map((set) => [set.setId, set.children]), [['english__p1__set3', 3]]);
  const keep = list.find((c) => c.set_id === 'english__p1__set1').id;
  const trimmed = list.filter((c) => c.set_id !== 'english__p1__set1' || c.id === keep);
  assert.ok(validateCandidates(trimmed).some((p) => p.problem.startsWith('set_has_1_children')));
});

test('a fresh pass holding two wordings of one question uses the one that is the final text, whatever the file order', () => {
  const { raw, finalTexts } = syntheticWave();
  const target = finalTexts[1];
  const older = { ...target, stem: `${target.stem} (older wording)` };
  for (const [olderBatch, finalBatch] of [['aa-older', 'zz-final'], ['zz-older', 'aa-final']]) {
    const dir = tmpDir('fresh-two-');
    freshPass(older, { dir, batch: olderBatch, quality: [9, 9], fit: [3, 3, 3] });
    freshPass(target, { dir, batch: finalBatch, quality: [8, 8], fit: [9, 9, 9] });
    const { entries, problems, counts } = buildEntries(finalTexts, { rawDir: raw, freshDirs: [dir], models: MODELS, date: '2026-10-14' });
    assert.deepEqual(problems, [], `${olderBatch} / ${finalBatch}`);
    assert.deepEqual(entries[target.id].quality.map((j) => [j.quality_score, j.batch]), [[8, finalBatch], [8, finalBatch]]);
    assert.deepEqual(entries[target.id].fit.map((j) => j.batch), [finalBatch, finalBatch, finalBatch]);
    assert.equal(counts.staleFreshResultsIgnored, 5, 'the five results on the older wording are ignored, and counted once');
  }
});
