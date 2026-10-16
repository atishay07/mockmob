import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeSubjectSelection } from '../cuet_controls.js';
import { getNtaBlueprint, listNtaBlueprintSubjects, ntaEligibility } from '../nta_engine.js';
import { hasRealPassageBlock } from '../nta_question_selector.js';
import { listedOrderKeyReasons, structuralReasons } from '../nta_item_checks.js';
import {
  AUTHORED_SOURCE, AUTHORED_SOURCE_W2, AUTHORED_SOURCE_W3, AUTHORED_SUBJECTS, WAVES, planPublication, toQuestionRow, validateCandidates, waveOf,
} from '../../scripts/lib/authored-wave.mjs';
import { dryRun, loadCandidates } from '../../scripts/question-publish-authored.mjs';
import { applyRepairs, assemble, loadVerified } from '../../scripts/authored-w3-assemble.mjs';
import { signEvidence } from './ntaEngineFixtures.mjs';

// Wave 3 (claude-authored-2026-10-17-w3): general_test, physics, chemistry and hindi. The committed candidates, the raw verified drafts and the audit. No network, no model.
const DIR = 'docs/brain/reports/authored-w3';
const CANDIDATES_FILE = `${DIR}/wave3-candidates-2026-10-17.json`;
const AUDIT_FILE = `${DIR}/wave3-audit-2026-10-17.json`;
const RAW = `${DIR}/raw`;
const NOW = '2026-10-17T03:00:00.000Z';
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const candidates = () => readJson(CANDIDATES_FILE);
const tmpDir = (name = 'authored-w3-') => fs.mkdtempSync(path.join(os.tmpdir(), name));

test('wave 3 is a wave of its own: source, four subjects, its own verdict words, Hindi passages', () => {
  assert.equal(AUTHORED_SOURCE_W3, 'claude-authored-2026-10-17-w3');
  assert.equal(waveOf(AUTHORED_SOURCE_W3).wave, 3);
  assert.deepEqual(WAVES[3].subjects, ['chemistry', 'general_test', 'hindi', 'physics']);
  assert.deepEqual(WAVES[3].passageSubjects, ['hindi']);
  assert.deepEqual(WAVES[3].verdicts, ['haiku_blind_verified', 'opus_audited']);
  for (const subject of WAVES[3].subjects) assert.ok(AUTHORED_SUBJECTS.includes(subject), subject);
  // Waves 1 and 2 are untouched.
  assert.equal(waveOf(AUTHORED_SOURCE).wave, 1);
  assert.equal(waveOf(AUTHORED_SOURCE_W2).wave, 2);
  assert.deepEqual(WAVES[1].verdicts, ['ready', 'repaired']);
  assert.deepEqual(WAVES[2].verdicts, ['ready', 'repaired']);
  assert.deepEqual(WAVES[1].passageSubjects, []);
  assert.deepEqual(WAVES[2].passageSubjects, []);
});

test('a verdict that is not one of the wave\'s own words is refused, and the old wave-1 message stays', () => {
  const [c] = candidates();
  assert.deepEqual(validateCandidates([c]), []);
  assert.ok(validateCandidates([{ ...c, _verdict: 'ready' }]).some((p) => p.problem === 'verdict_not_one_of_haiku_blind_verified_or_opus_audited'), 'ready is a wave 1 and 2 word');
  assert.ok(validateCandidates([{ ...c, _verdict: undefined }]).some((p) => /^verdict_not_one_of/.test(p.problem)));
  const w1 = readJson('docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json')[0];
  assert.deepEqual(validateCandidates([w1]), []);
  assert.ok(validateCandidates([{ ...w1, _verdict: 'haiku_blind_verified' }]).some((p) => p.problem === 'expert_verdict_not_ready_or_repaired'));
});

test('the committed candidates are the 294 verified drafts plus the audit repairs, and they validate', () => {
  const list = candidates();
  assert.equal(list.length, 294);
  assert.deepEqual(validateCandidates(list), []);
  const by = (key) => list.reduce((m, c) => { m[key(c)] = (m[key(c)] || 0) + 1; return m; }, {});
  assert.deepEqual(by((c) => c.subject), { chemistry: 74, general_test: 97, hindi: 49, physics: 74 });
  assert.deepEqual(by((c) => c.source), { [AUTHORED_SOURCE_W3]: 294 });
  assert.deepEqual(by((c) => c._verdict), { haiku_blind_verified: 187, opus_audited: 107 });
  assert.equal(new Set(list.map((c) => c.id)).size, 294);
});

test('assembling the raw drafts and the audit reproduces the committed candidates exactly', () => {
  const audit = readJson(AUDIT_FILE);
  const { candidates: rebuilt, summary } = assemble(loadVerified(RAW), audit);
  assert.deepEqual(rebuilt, candidates());
  assert.equal(summary.questions, 294);
  assert.equal(summary.repairsApplied, audit.repairs.length);
  const raw = loadVerified(RAW).flatMap((b) => b.questions);
  assert.equal(raw.length, 294);
  assert.ok(raw.every((q) => q.source === AUTHORED_SOURCE_W3), 'the raw drafts are not edited');
});

test('a repair that does not match what the audit saw stops the run', () => {
  const base = [{ id: 'a', explanation: 'one two', chapter: 'X', options: [{ key: 'A', text: 'x' }] }];
  assert.throws(() => applyRepairs(base, [{ id: 'a', field: 'chapter', expect: 'Y', set: 'Z' }]), /not what the audit saw/);
  assert.throws(() => applyRepairs(base, [{ id: 'a', field: 'explanation', find: 'three', replace: 'x' }]), /not once/);
  assert.throws(() => applyRepairs([{ id: 'a', explanation: 'x x' }], [{ id: 'a', field: 'explanation', find: 'x', replace: 'y' }]), /not once/);
  assert.throws(() => applyRepairs(base, [{ id: 'nope', field: 'chapter', expect: 'X', set: 'Z' }]), /not a candidate/);
  assert.throws(() => applyRepairs(base, [{ id: 'a', field: 'options', expect: [{ key: 'A', text: 'y' }], set: [] }]), /not what the audit saw/);
  const { candidates: out, applied } = applyRepairs(base, [{ id: 'a', field: 'options', expect: [{ key: 'A', text: 'x' }], set: [{ key: 'A', text: 'z' }], defect: 'D5' }]);
  assert.deepEqual(out[0].options, [{ key: 'A', text: 'z' }]);
  assert.equal(out[0]._reworded, true);
  assert.deepEqual(applied, [{ id: 'a', field: 'options', defect: 'D5' }]);
  assert.equal(base[0]._reworded, undefined, 'the input is not changed');
});

test('the audit: 45 sampled, every batch and every question type present, the defect rate and the full re-checks recorded', () => {
  const audit = readJson(AUDIT_FILE);
  const list = candidates();
  assert.equal(audit.sample.size, 45);
  assert.equal(audit.sample.rows.length, 45);
  assert.equal(new Set(audit.sample.rows.map((r) => r.id)).size, 45);
  const byId = new Map(list.map((c) => [c.id, c]));
  for (const row of audit.sample.rows) assert.ok(byId.has(row.id), row.id);
  const batches = ['chem-01', 'chem-02', 'chem-03', 'gat-01', 'gat-02', 'gat-03', 'gat-04', 'hin-01', 'hin-02', 'phys-01', 'phys-02', 'phys-03'];
  assert.deepEqual(Object.keys(audit.sample.byBatch).sort(), batches.sort());
  assert.ok(Object.values(audit.sample.byBatch).every((n) => n >= 3));
  assert.deepEqual(Object.keys(audit.sample.byType).sort(), ['assertion_reason', 'match_the_following', 'passage_set_item', 'sequence_ordering', 'single_mcq', 'statement_based']);
  assert.equal(audit.keys_wrong, 0);
  assert.equal(audit.defects_in_sample.questions, audit.sample.rows.filter((r) => r.defects.length).length);
  assert.ok(audit.defects_in_sample.rate > 0.03, 'above 3 percent, so the defective batches were re-checked in full');
  assert.deepEqual(audit.full_recheck.batches, ['gat-02', 'hin-02', 'hin-01']);
  assert.equal(audit.full_recheck.questions, 74);
  for (const id of audit.audited_ids) assert.equal(byId.get(id)._verdict, 'opus_audited', id);
  assert.equal(audit.audited_ids.length, list.filter((c) => c._verdict === 'opus_audited').length);
  // Every repair belongs to a listed defect.
  const codes = new Set(audit.defects.map((d) => d.code));
  for (const repair of audit.repairs) assert.ok(codes.has(repair.defect), repair.defect);
});

test('every repaired row is marked reworded, and nothing else is', () => {
  const audit = readJson(AUDIT_FILE);
  const repaired = new Set(audit.repairs.map((r) => r.id));
  for (const c of candidates()) assert.equal(c._reworded === true, repaired.has(c.id), c.id);
  assert.equal(repaired.size, 28);
});

test('the plan: 294 rows, 5 Hindi passage groups, subject ids as the bank stores them', () => {
  const plan = planPublication(candidates());
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.rows.length, 294);
  assert.equal(plan.groups.length, 5);
  assert.deepEqual(plan.summary.bySubject, { chemistry: 74, gat: 97, hindi: 49, physics: 74 });
  assert.deepEqual(plan.summary.byType, { conceptual_mcq: 217, match_the_following: 14, sequence_ordering: 10, statement_based: 20, assertion_reason: 9, reading_comprehension: 24 });
  assert.deepEqual(Object.values(plan.summary.passageChildrenBySet).sort(), [4, 5, 5, 5, 5]);
  assert.deepEqual(plan.summary.passageSetsBelowNtaMinimum, []);
  assert.deepEqual(plan.summary.byExpertReview, { haiku_blind_verified: 187, opus_audited: 107 });
  for (const group of plan.groups) {
    assert.equal(group.subject, 'hindi');
    assert.ok(['Apathit Gadyansh', 'Apathit Padyansh'].includes(group.chapter));
    assert.equal(group.passage_type, null, 'the English passage kinds do not apply to Hindi');
    assert.deepEqual(group.mode_visibility, ['full_mock', 'nta_mode']);
  }
  const hindi = plan.rows.filter((r) => r.subject === 'hindi');
  assert.ok(hindi.filter((r) => r.passage_group_id).every((r) => r.question_type === 'reading_comprehension' && r.order_index >= 1 && r.passage_text));
  assert.ok(hindi.filter((r) => !r.passage_group_id).every((r) => r.chapter === 'Vyakaran'));
  assert.ok(!hindi.some((r) => ['Gadya Khand', 'Kavya Khand'].includes(r.chapter)), 'the unseen passages are not set-text literature');
  assert.ok(plan.rows.every((r) => r.tags.includes('authored_wave:3') && r.tags.some((t) => /^expert_review:(haiku_blind_verified|opus_audited)$/.test(t))));
  assert.ok(plan.rows.every((r) => r.status === 'live' && r.provenance === undefined && r.source === AUTHORED_SOURCE_W3));
  const again = planPublication(candidates());
  assert.equal(again.planHash, plan.planHash, 'the plan is deterministic');
});

test('a Hindi passage set must stay inside the wave\'s Hindi allowance', () => {
  const list = candidates();
  const child = list.find((c) => c.type === 'passage_set_item');
  // The same row as a wave-1 candidate would be refused: only wave 3 stores Hindi sets.
  const asWave1 = { ...child, source: AUTHORED_SOURCE, _verdict: 'ready' };
  assert.ok(validateCandidates([asWave1]).some((p) => p.problem === 'subject_not_in_wave'));
  assert.ok(validateCandidates([{ ...child, subject: 'physics' }]).some((p) => p.problem === 'passage_set_outside_english'));
  // A set of one is not a set.
  assert.ok(validateCandidates([child]).some((p) => /^set_has_1_children_below_minimum/.test(p.problem)));
});

test('the dry run, offline: wave 3 plans cleanly and its only blocker is the missing score entries', async () => {
  const report = await dryRun({ mode: 'dry-run', candidates: CANDIDATES_FILE, outDir: tmpDir(), offline: true, fixtures: null, fitDir: 'data/nta_fit_scores', agentDir: null, now: NOW });
  assert.equal(report.source, AUTHORED_SOURCE_W3);
  assert.equal(report.summary.questions, 294);
  assert.equal(report.summary.passageGroups, 5);
  assert.equal(report.blockers.length, 1);
  assert.match(report.blockers[0], /without an agent score entry/);
  assert.deepEqual(report.checks.agentScores, { bound: 0, missing: 294, hashMismatch: 0 });
  assert.equal(report.candidatesSha256, loadCandidates(CANDIDATES_FILE).sha256);
});

// ---------------------------------------------------------------------------------------------
// Hindi in the NTA engine
// ---------------------------------------------------------------------------------------------

test('Hindi has a blueprint and is not public: the engine knows it, no route serves it', () => {
  const bp = getNtaBlueprint('hindi');
  assert.equal(bp.ntaCode, '102');
  assert.ok(listNtaBlueprintSubjects().includes('hindi'));
  assert.equal(normalizeSubjectSelection('hindi').valid, false);
  assert.deepEqual(bp.excludedChapters.map((e) => e.name).sort(), ['Anuvad', 'Gadya Khand', 'Kavya Khand', 'Rachnatmak Lekhan']);
  const chapters = bp.variants[0].sections[0].units.flatMap((u) => u.chapters.map((c) => c.name));
  assert.deepEqual(chapters, ['Apathit Gadyansh', 'Apathit Padyansh', 'Vyakaran']);
  assert.equal(bp.sets.distinctKindsMin, 2);
});

test('a Devanagari passage counts as a real passage block, a prose stub and an English stub do not', () => {
  const prose = 'गाँव के बाहर एक पुराना बरगद खड़ा है। उसकी जड़ें दूर तक फैली हैं। सुबह ग्वाले रुकते हैं। दोपहर में राहगीर छाँव तलाशते हैं। शाम को बुज़ुर्ग चौपाल जमाते हैं। '.repeat(3);
  assert.equal(hasRealPassageBlock({ passage_text: prose }), true);
  assert.equal(hasRealPassageBlock({ passage_text: 'गाँव के बाहर एक बरगद है। वह पुराना है।' }), false, 'too short');
  const verseLines = Array.from({ length: 12 }, (_, i) => `पंक्ति संख्या ${i + 1} में कुएँ का सूखा मौन गूँजता है और पानी की याद आती है`);
  assert.equal(hasRealPassageBlock({ passage_text: verseLines.join('\n') }), true, 'verse without full stops, kept in lines');
  assert.equal(hasRealPassageBlock({ passage_text: verseLines.join(' ') }), false, 'the same words with the line breaks lost have no sentence ends');
  const english = 'word '.repeat(90);
  assert.equal(hasRealPassageBlock({ passage_text: `${english}.` }), false, 'one sentence of English is still not a passage');
  assert.equal(hasRealPassageBlock({ passage_text: `${english}. Two. Three.` }), true);
});

test('a Hindi match item is read as a match: सूची-I and सूची-II, and the closing instruction', () => {
  const list = candidates();
  const match = list.find((c) => c.subject === 'hindi' && c.type === 'match_the_following');
  const row = toQuestionRow(match);
  assert.deepEqual(structuralReasons(row, 'match_the_following'), []);
  const broken = { ...row, body: row.body.replace(/सूची/g, 'तालिका') };
  assert.ok(structuralReasons(broken, 'match_the_following').includes('match_list_two_missing'));
});

test('no wave 3 key is the stem\'s listed order', () => {
  const plan = planPublication(candidates());
  const offenders = plan.rows
    .filter((r) => ['sequence_ordering', 'match_the_following'].includes(r.question_type))
    .filter((r) => listedOrderKeyReasons(r, r.question_type).length)
    .map((r) => r.id);
  assert.deepEqual(offenders, []);
});

test('with scores supplied by fixtures, the engine\'s own content gates refuse only the 8 format cases the audit lists', () => {
  const audit = readJson(AUDIT_FILE);
  const plan = planPublication(candidates());
  const refused = [];
  plan.rows.forEach((row, i) => {
    const signed = signEvidence({ ...row, family_id: `fam-w3-${i}`, quality_score: 0 });
    const result = ntaEligibility(signed, { subject: row.subject });
    if (!result.eligible) refused.push(row.id);
  });
  const expected = audit.engine_gates_all_294.refused.filter((r) => r.note !== 'D5, repaired').map((r) => r.id);
  assert.equal(expected.length, 8);
  assert.deepEqual(refused.map((id) => id.slice(0, 8)).sort(), expected.sort());
  const hindiRefused = refused.filter((id) => plan.rows.find((r) => r.id === id).subject === 'hindi');
  assert.deepEqual(hindiRefused, [], 'every Hindi row passes the content gates');
});
