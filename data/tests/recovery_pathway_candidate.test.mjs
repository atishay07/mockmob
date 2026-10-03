// The first candidate pathway, exercised through the real engine, validator, metrics and storage.
// These are software tests. They do not establish academic validity or student outcomes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { checkPathwayContent, buildEnginePathway, pathwayDigest, claimMatches, simulate } from '../pathway_validation.js';
import { createEpisode, advanceEpisode, permittedStep, publicEpisode, learningPlan, validatePathway } from '../learning_engine.js';
import { recoveryValidationMetrics, MIN_REPORTABLE } from '../recovery_metrics.js';
import { DIFFERENTIATORS, differentiatorClaimable, CAPABILITIES } from '../capabilities.js';
import { simulatedCohort, COHORT_NOW } from './recoveryCohortFixture.mjs';

const HOUR = 3_600_000; const DAY = 24 * HOUR;
const source = () => JSON.parse(readFileSync(new URL('../recovery_candidates/sacrificing_gaining.source.json', import.meta.url), 'utf8'));
const built = JSON.parse(readFileSync(new URL('../recovery_candidates/sacrificing_gaining.pathway.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../recovery_pathways.json', import.meta.url), 'utf8'));
const failedIds = report => report.results.filter(r => !r.passed).map(r => r.id);

function answerAs(p, e, at, choose) { const s = permittedStep(p, e, at); return advanceEpisode(p, e, { itemId: s.id, type: s.type, value: choose(s) }, at); }
const byHypothesis = h => s => s.matrix[h][0];
const correctly = s => s.answer;
function repairAll(p, e, at) { while (['repairing', 'needs_repair'].includes(e.state)) e = answerAs(p, e, at, correctly); return e; }

test('candidate passes software consistency and the committed build is current', () => {
  const report = checkPathwayContent(source());
  assert.equal(report.passed, true, JSON.stringify(report.results.filter(r => !r.passed)));
  assert.deepEqual(buildEnginePathway(source()), built, 'run: node scripts/learning/validate-pathway.mjs sacrificing_gaining');
  assert.equal(validatePathway({ ...built, state: 'released' }).id, 'sacrificing_gaining');
  assert.equal(built.checks.every(c => typeof c.options[0] === 'string' && !('claim' in c) && !('scenario' in c)), true);
});

test('candidate is never served: manifest, release gates and claim ladder stay closed', () => {
  assert.equal(manifest.state, 'blocked_sources');
  assert.deepEqual(manifest.pathways, []);
  assert.equal(manifest.candidates[0].state, 'awaiting_academic_review');
  assert.equal(built.state, 'candidate');
  assert.equal(CAPABILITIES.recovery.state, 'blocked_content');
  assert.equal(DIFFERENTIATORS.repairThatHolds.role, 'primary');
  assert.equal(differentiatorClaimable('repairThatHolds'), false);
  assert.equal(differentiatorClaimable('goalAwarePreparation'), false, "'unverified' live availability is not a claim");
  assert.equal(Object.values(DIFFERENTIATORS).filter(d => d.role === 'supporting').length <= 2, true);
  assert.equal(differentiatorClaimable('x', { x: { evidence: { researchHypothesis: true, sourceImplementation: true, academicValidation: 'not_applicable', stagingVerification: true, liveAvailability: true } } }), true);
});

test('validator catches corrupted keys, matrices, families, text and derivations', () => {
  const mutate = fn => { const s = source(); fn(s); return failedIds(checkPathwayContent(s)); };
  assert.ok(mutate(s => { s.checks[0].answer = 0; }).includes('unique_key'), 'wrong check key');
  assert.ok(mutate(s => { s.probes[0].matrix.old_ratio_default = [2]; s.probes[0].matrix.new_ratio_used = [1]; }).includes('matrix_cell'), 'swapped matrix cells');
  assert.ok(mutate(s => { s.repair[1].answer = 0.25; }).includes('solver_key'), 'numeric key disagrees with solver');
  assert.ok(mutate(s => { s.repair[3].solver.newShare = 0.3; s.repair[3].answer = 0.1; }).includes('solver_inputs_match_scenario'), 'solver inputs drift from the stated ratio');
  assert.ok(mutate(s => { s.checks[1].familyId = s.checks[0].familyId; }).includes('check_families_unique'), 'shared check family');
  assert.ok(mutate(s => { s.checks[2].familyId = s.probes[0].familyId; }).includes('check_families_unique'), 'check overlaps a probe family');
  assert.ok(mutate(s => { s.probes[0].options[0].text = 'A sacrifices 1/10 and B gains 3/10'; }).includes('text_carries_claim'), 'text contradicts structured claim');
  assert.ok(mutate(s => { s.checks[3].scenario.new = { A: 2, B: 1, C: 1 }; }).length > 0, 'stated ratio no longer follows from the admission');
  assert.ok(mutate(s => { s.checks[0].options[3] = { text: '1:2', claim: { kind: 'ratio', verb: 'sacrifice', ratio: { P: 1, Q: 2 } } }; }).includes('unique_key'), 'two correct options');
  assert.ok(mutate(s => { s.checks = s.checks.slice(0, 5); }).includes('check_reserve'));
  assert.ok(mutate(s => { s.checks.find(c => c.boundary === 'old_ratio_is_correct').boundary = undefined; }).includes('boundary_old_ratio_valid'));
  assert.ok(mutate(s => { s.sourceRefs[0].sha256 = 'unknown'; }).includes('source_refs'));
  assert.ok(mutate(s => { delete s.repairPaths.direction_reversed; }).includes('repair_paths_complete'));
});

test('simulators reproduce the textbook cases independently of authored text', () => {
  const admission = { type: 'admission', old: { A: 3, B: 2 }, new: { A: 3, B: 2, C: 1 } };
  assert.equal(claimMatches({ kind: 'ratio', verb: 'sacrifice', ratio: { A: 3, B: 2 } }, simulate('secure', admission), admission), true, 'old ratio is right when shares fall proportionally');
  const retirement = { type: 'retirement', old: { X: 4, Y: 3, Z: 2 }, new: { X: 5, Z: 4 } };
  assert.equal(claimMatches({ kind: 'ratio', verb: 'gain', ratio: { X: 1, Z: 2 } }, simulate('secure', retirement), retirement), true);
  assert.equal(claimMatches({ kind: 'ratio', verb: 'gain', ratio: { X: 1, Z: 2 } }, simulate('direction_reversed', retirement), retirement), false);
});

test('each misconception is supported by two families, routed to its repair, then checked fresh on schedule', () => {
  for (const h of ['old_ratio_default', 'new_ratio_used', 'direction_reversed']) {
    let at = 0; let e = createEpisode(built, { id: h, at });
    e = answerAs(built, e, at, byHypothesis(h)); assert.equal(e.state, 'investigating', 'one observation is not a diagnosis');
    e = answerAs(built, e, at, byHypothesis(h));
    assert.equal(e.diagnosis.supported, h); assert.equal(e.state, 'repairing');
    const view = publicEpisode(built, e, at);
    assert.equal(view.explanation, built.explanations[h]); assert.match(view.diagnosisLabel, /Two distinct observations/);
    const path = built.repairPaths[h]; const seen = [];
    while (e.state === 'repairing') { seen.push(permittedStep(built, e, at).id); e = answerAs(built, e, at, correctly); }
    assert.deepEqual(seen, path);
    const repairAt = at;
    e = answerAs(built, e, at, correctly); assert.equal(e.state, 'delayed_check_1'); assert.equal(e.nextDueAt, repairAt + DAY);
    assert.equal(permittedStep(built, e, repairAt + DAY - 1), null, 'not before 24 hours');
    at = repairAt + DAY; e = answerAs(built, e, at, correctly); assert.equal(e.nextDueAt, repairAt + 3 * DAY);
    at = repairAt + 3 * DAY; e = answerAs(built, e, at, correctly);
    assert.equal(e.state, 'maintained'); assert.equal(publicEpisode(built, e, at).evidenceLabel, 'Passed two fresh checks');
    assert.equal(new Set(e.checks.map(c => c.familyId)).size, 3, 'three distinct check families');
  }
});

test('a secure learner gets no gap label and a short path; repair activity never counts as evidence', () => {
  let e = createEpisode(built, { id: 's', at: 0 });
  e = answerAs(built, e, 0, byHypothesis('secure')); e = answerAs(built, e, 0, byHypothesis('secure'));
  assert.equal(e.diagnosis.supported, 'secure');
  assert.match(publicEpisode(built, e, 0).diagnosisLabel, /No reasoning gap is labelled/);
  assert.equal(permittedStep(built, e, 0).id, built.repairPaths.secure[0]);
  e = repairAll(built, e, 0);
  assert.equal(publicEpisode(built, e, 0).sampleSize, 0);
  assert.equal(e.observations.filter(o => o.kind === 'repair').every(o => o.assisted === true), true);
});

test('conflicting probe evidence abstains and falls back to the general repair', () => {
  let e = createEpisode(built, { id: 'c', at: 0 });
  e = answerAs(built, e, 0, byHypothesis('old_ratio_default'));
  e = answerAs(built, e, 0, byHypothesis('new_ratio_used'));
  assert.equal(e.diagnosis.conflict, true); assert.equal(e.diagnosis.supported, null);
  const view = publicEpisode(built, e, 0);
  assert.match(view.diagnosisLabel, /need another check/); assert.equal(view.explanation, built.explanations.general);
  assert.equal(permittedStep(built, e, 0).id, built.repairPaths.general[0]);
  assert.equal(e.observations.filter(o => o.kind === 'probe').length, 2, 'stops probing once evidence conflicts');
});

test('repeat exposure: seen families block a start, failed checks consume families, exhaustion blocks claims', () => {
  assert.throws(() => createEpisode(built, { id: 'r', at: 0, seenFamilies: [built.checks[4].familyId] }), /FRESH_CONTENT/);
  assert.throws(() => createEpisode(built, { id: 'r', at: 0, seenIds: [built.probes[0].questionId] }), /FRESH_CONTENT/);
  let at = 0; let e = createEpisode(built, { id: 'r', at });
  e = answerAs(built, e, at, byHypothesis('old_ratio_default')); e = answerAs(built, e, at, byHypothesis('old_ratio_default'));
  e = repairAll(built, e, at);
  const used = new Set();
  while (!['blocked_content', 'maintained'].includes(e.state)) {
    const s = permittedStep(built, e, at); if (!s) { at += DAY; continue; }
    assert.equal(used.has(s.familyId), false, 'a check family is never reused'); used.add(s.familyId);
    e = advanceEpisode(built, e, { itemId: s.id, type: 'choice', value: (s.answer + 1) % 4 }, at);
    assert.throws(() => advanceEpisode(built, e, { itemId: s.id, type: 'choice', value: s.answer }, at), /STEP_CONFLICT|NO_PERMITTED_STEP|REPEATED_CHECK/);
    e = repairAll(built, e, at);
  }
  assert.equal(e.state, 'blocked_content'); assert.equal(used.size, built.checks.length);
  assert.equal(publicEpisode(built, e, at).evidenceLabel, 'More fresh content is needed');
});

test('interruption: a stale or duplicated submission after progress is rejected, never double-counted', () => {
  let e = createEpisode(built, { id: 'i', at: 0 });
  const first = permittedStep(built, e, 0);
  e = advanceEpisode(built, e, { itemId: first.id, type: 'choice', value: first.matrix.secure[0] }, 0);
  assert.throws(() => advanceEpisode(built, e, { itemId: first.id, type: 'choice', value: first.matrix.secure[0] }, 1), /STEP_CONFLICT/);
  assert.equal(e.observations.length, 1);
  // An expired check (closed tab, lost network) reopens repair without inventing an answer.
  e = answerAs(built, e, 0, byHypothesis('secure')); e = repairAll(built, e, 0);
  const check = permittedStep(built, e, 0);
  e = advanceEpisode(built, e, { itemId: check.id, type: 'choice', value: null }, 0, { incompleteCheck: 'expired' });
  assert.equal(e.state, 'needs_repair'); assert.equal(e.checks[0].incompleteReason, 'expired'); assert.equal(e.observations.at(-1).value, null);
});

test('public views never expose keys, matrices, claims or future checks', () => {
  let e = createEpisode(built, { id: 'v', at: 0 });
  const probeView = JSON.stringify(publicEpisode(built, e, 0));
  for (const leak of ['"answer"', 'matrix', 'claim', 'scenario', 'acc_sg_check_']) assert.equal(probeView.includes(leak), false, leak);
  e = answerAs(built, e, 0, byHypothesis('secure')); e = answerAs(built, e, 0, byHypothesis('secure')); e = repairAll(built, e, 0);
  const checkView = publicEpisode(built, e, 0);
  assert.equal(checkView.step.kind, 'scored_check'); assert.equal(checkView.step.prompt, undefined); assert.equal(checkView.step.options, undefined);
});

test('shared plan explains a due check with record facts and a rule, and stays deterministic', () => {
  let e = createEpisode(built, { id: 'plan-e', at: 0 });
  e = answerAs(built, e, 0, byHypothesis('secure')); e = answerAs(built, e, 0, byHypothesis('secure')); e = repairAll(built, e, 0); e = answerAs(built, e, 0, correctly);
  const view = publicEpisode(built, e, DAY);
  const plan = learningPlan({ episodes: [view], now: DAY + 1, availableConcepts: [built.id] });
  assert.equal(plan.primary.kind, 'fresh_check');
  assert.deepEqual(plan.primary.facts.map(f => f.basis), ['record', 'record', 'rule']);
  assert.match(plan.primary.facts[1].text, /^0 of 2 delayed checks passed/);
  const waiting = learningPlan({ episodes: [publicEpisode(built, e, 0)], now: 1, availableConcepts: [built.id], attempts: [{ subject: 'economics' }] });
  assert.equal(waiting.primary.kind, 'ordinary_practice');
  assert.ok(waiting.primary.facts.some(f => /next fresh check/.test(f.text)));
  assert.equal(learningPlan({}).primary.facts.at(-1).text, 'No recovery pathway has passed its release checks yet.');
});

test('validation metrics report completion, fresh checks, attrition, defects and cost with sample sizes', () => {
  const rows = simulatedCohort(built);
  const m = recoveryValidationMetrics(rows, { now: COHORT_NOW, pathways: { [built.id]: built }, costs: { paidModelCalls: 0, contentUsd: 0 } });
  const r = m.pathways['sacrificing_gaining@v1'];
  assert.equal(r.sample.episodes, 12); assert.equal(r.sample.decisionReady, false);
  assert.equal(r.completion.finishedRepair, 11); assert.equal(r.completion.passedTwoFreshChecks, 4);
  assert.equal(r.freshChecks.delayed1.n, 9); assert.equal(r.freshChecks.delayed1.k, 8);
  assert.equal(r.freshChecks.delayed2.suppressed, true, `groups under ${MIN_REPORTABLE} are suppressed`);
  assert.equal(r.attrition.stalledRepairs, 1); assert.equal(r.attrition.overdueDelayedChecks, 5);
  assert.equal(r.contentDefects.invalidated, 1); assert.equal(r.diagnosis.counts.conflict, 1);
  assert.equal(r.diagnosis.probeConcordance.n, 12); assert.equal(r.diagnosis.probeConcordance.k, 11);
  assert.equal(m.cost.paidModelCallsInCoreFlow, 0); assert.equal(m.cost.perStartedEpisodeUsd, 0);
  for (const rate of [r.freshChecks.immediate, r.freshChecks.delayed1, r.completion.finishedRepairRate]) assert.equal(rate.n > 0 && rate.low <= rate.pct && rate.pct <= rate.high, true);
  assert.deepEqual(recoveryValidationMetrics([]).pathways, {});
  assert.equal(recoveryValidationMetrics([], { costs: {} }).cost.contentUsd, null, 'unknown cost stays unknown, not zero');
});

test('storage: retries create one episode and one allowance; corrections invalidate claims', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table users(id text primary key,credit_balance int);
      create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,explanation text);
      create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb);
      create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz,last_attempted_at timestamptz,updated_at timestamptz,primary key(user_id,question_id));
      create table credit_transactions(user_id text,amount int,type text,reference text primary key,action text,credit_delta int);
      create table question_interactions(user_id text,question_id text);
      create table question_bookmarks(user_id text,question_id text);
      insert into users values('learner',100),('second',100);`);
    for (const file of ['0036_mode_aware_credits.sql', '20261001105920_score_recovery_foundations.sql', '20261002120000_connected_learning.sql', '20261002123000_answer_correction_history.sql'])
      await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    const items = [...built.probes, ...built.repair, ...built.checks];
    for (const i of items) await db.query('insert into questions(id,subject,body,options,correct_answer) values($1,$2,$3,$4,$5)', [i.questionId, 'accountancy', i.prompt, JSON.stringify(i.options || []), String(i.answer)]);
    const projection = createEpisode(built, { id: 'ep1', at: 0 });
    const row = { id: 'ep1', user_id: 'learner', request_key: 'start_request_1', concept_id: built.id, pathway: built, projection };
    // Network retry and double tap: same request key, then a new key for the same concept.
    await Promise.all([db.query('select start_learning_episode($1,$2)', [row, '2026-10-05']), db.query('select start_learning_episode($1,$2)', [row, '2026-10-05'])]);
    await db.query('select start_learning_episode($1,$2)', [{ ...row, id: 'ep1b', request_key: 'start_request_2' }, '2026-10-05']);
    assert.equal((await db.query('select count(*)::int n from learning_episodes')).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from learning_allowances where user_id='learner'")).rows[0].n, 1, 'retries never consume a second free episode');
    // The pathway's families are now exposed: the same content can never start a second, "fresh" episode.
    await db.exec(`update learning_episodes set projection=jsonb_set(projection,'{state}','"maintained"') where id='ep1'`);
    await assert.rejects(db.query('select start_learning_episode($1,$2)', [{ ...row, id: 'ep2', request_key: 'start_request_3' }, '2026-10-12']), /fresh content/);
    assert.equal((await db.query("select count(*)::int n from learning_allowances where user_id='learner'")).rows[0].n, 1, 'a refused start consumes nothing');
    // Weekly free allowance: a second concept in the same week is refused for a free learner.
    await db.query('select start_learning_episode($1,$2)', [{ ...row, id: 'ep3', user_id: 'second', request_key: 'second_start_1' }, '2026-10-05']);
    const other = { ...built, id: 'other_concept', probes: [{ ...built.probes[0], questionId: 'o1', familyId: 'of1' }], repair: [], checks: [] };
    await assert.rejects(db.query('select start_learning_episode($1,$2)', [{ id: 'ep4', user_id: 'second', request_key: 'second_start_2', concept_id: 'other_concept', pathway: other, projection }, '2026-10-05']), /weekly allowance/);
    // Idempotent response retry, then a correction to one check question invalidates the episode.
    const step = permittedStep(built, projection, 0);
    const response = { itemId: step.id, type: 'choice', value: step.matrix.secure[0] };
    const next = advanceEpisode(built, projection, response, 0);
    await Promise.all([db.query('select advance_learning_episode($1,$2,$3,$4,$5,$6)', ['ep3', 'second', 'resp_key_1', response, 0, next]), db.query('select advance_learning_episode($1,$2,$3,$4,$5,$6)', ['ep3', 'second', 'resp_key_1', response, 0, next])]);
    assert.equal((await db.query("select count(*)::int n from learning_observations where episode_id='ep3'")).rows[0].n, 1);
    await db.query('update questions set correct_answer=$1 where id=$2', ['0', built.checks[2].questionId]);
    const stored = (await db.query("select concept_id,user_id,created_at,pathway,projection from learning_episodes where id='ep3'")).rows[0];
    assert.equal(stored.projection.state, 'invalidated');
    const metrics = recoveryValidationMetrics([stored], { pathways: { [built.id]: built } });
    assert.equal(metrics.pathways['sacrificing_gaining@v1'].contentDefects.invalidated, 1);
    assert.equal(pathwayDigest(stored.pathway), pathwayDigest(built), 'stored pathway keeps its registered digest');
  } finally { await db.close(); }
});
