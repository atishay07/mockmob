import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { W2_SOURCE, W3_SOURCE, W4_SOURCE, WAVE_CONFIGS, categoryOf, parseArgs, runAccept, runCheck } from '../../scripts/authored-w2-accept.mjs';
import { AUTHORED_SOURCE_W4, WAVES, validateCandidates } from '../../scripts/lib/authored-wave.mjs';
import { ntaAgentThreshold } from '../nta_agent_scores.js';

// Wave 4 acceptance (claude-authored-2026-10-17-w4): the wave-2 wrapper run with --wave=w4 on the raw files under tmp/authored-w4s.
// Offline: files only. No network, no database, no model.
const RAW = 'tmp/authored-w4s';
const OUT = 'docs/brain/reports/authored-w4';
const NOW = '2026-10-17T12:00:00.000Z';
const ROLES = ['s1', 's2', 's3', 's4', 's5', 'j1', 'j2', 'h1', 'h2', 'h3'];
const SUBJECTS = ['biology', 'chemistry', 'general_test', 'mathematics', 'physics'];
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const median3 = (values) => values.slice().sort((a, b) => a - b)[1];
const args = (extra = []) => parseArgs(['--wave=w4', `--now=${NOW}`, ...extra]);

let memo = null;
async function baseline() {
  memo ||= await runAccept(args(), { write: false });
  return memo;
}

const batchesOf = () => SUBJECTS.flatMap((subject) => fs.readdirSync(`${RAW}/${subject}`)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-blind.json') && !name.endsWith('-fitaids.json')).map((name) => ({ subject, batch: name.slice(0, -5) }))).sort((a, b) => a.batch.localeCompare(b.batch, 'en', { numeric: true }));

test('the wave config: wave 4 has its own source, files and settings, waves 2 and 3 keep every default they had', () => {
  assert.equal(W4_SOURCE, AUTHORED_SOURCE_W4);
  assert.equal(WAVE_CONFIGS.w4.source, AUTHORED_SOURCE_W4);
  assert.equal(WAVE_CONFIGS.w3.source, W3_SOURCE);
  assert.equal(WAVE_CONFIGS.w2.source, W2_SOURCE);
  const w4 = parseArgs(['--wave=w4']);
  assert.deepEqual([w4.wave, w4.raw, w4.out, w4.date, w4.expert, w4.asjudged, w4.fresh, w4.resolve, w4.decisions, w4.spotcheck], ['w4', 'tmp/authored-w4s', 'docs/brain/reports/authored-w4', '2026-10-17', null, null, [], null, null, null]);
  assert.equal(w4.candidates, 'docs/brain/reports/authored-w4/wave4-candidates-2026-10-17.json');
  assert.equal(w4.manifest, 'tmp/authored-w4s/manifest.json');
  assert.equal(WAVE_CONFIGS.w4.finalInputs, null);
  assert.equal(WAVE_CONFIGS.w4.finalMode, false);
  assert.deepEqual(WAVE_CONFIGS.w4.priorFiles.map((entry) => entry.from), ['wave2', 'wave3']);
  const w3 = parseArgs(['--wave=w3']);
  assert.deepEqual([w3.raw, w3.out, w3.candidates], ['tmp/authored-w3s', 'docs/brain/reports/authored-w3', 'docs/brain/reports/authored-w3/wave3-candidates-2026-10-17.json']);
  const w2 = parseArgs([]);
  assert.deepEqual([w2.wave, w2.raw, w2.out, w2.date, w2.mode, w2.candidates, w2.manifest], ['w2', 'tmp/authored-w2', 'docs/brain/reports/authored-w2', '2026-10-14', 'accept', null, null]);
  assert.throws(() => parseArgs(['--wave=w9']), /unknown --wave=w9 \(w2, w3 or w4\)/);
  assert.equal(parseArgs(['--wave=w4', '--date=2026-10-18', '--raw=x']).date, '2026-10-18');
  // the wave definition in the publisher library agrees with this config
  assert.deepEqual([WAVES[4].subjects.slice().sort(), WAVES[4].verdicts], [SUBJECTS, ['claude_audited']]);
});

test('the raw files are 14 batches of 10 role files, laid out as the manifest says, and every one is read', async () => {
  const { acceptance } = await baseline();
  assert.equal(batchesOf().length, 14);
  assert.deepEqual(batchesOf().map((b) => b.batch), [
    'biology__w4b1', 'biology__w4b2', 'biology__w4b3', 'chemistry__w4b1', 'chemistry__w4b2', 'chemistry__w4b3', 'general_test__w4b1', 'general_test__w4b2', 'general_test__w4b3',
    'mathematics__w4b1', 'mathematics__w4b2', 'mathematics__w4b3', 'physics__w4b1', 'physics__w4b2',
  ].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  assert.equal(acceptance.files.batches, 14);
  assert.equal(acceptance.files.expectedResultFiles, 140);
  assert.equal(acceptance.files.presentResultFiles, 140);
  assert.deepEqual([acceptance.files.missing, acceptance.files.malformed, acceptance.files.recordIssues, acceptance.files.batchLevelProblems, acceptance.files.unexpectedFiles], [[], [], [], [], []]);
  assert.deepEqual(acceptance.files.sourceCandidates.problems, []);
  assert.deepEqual(acceptance.files.sourceCandidates.candidatesNotLaidOut, {});
  assert.equal(acceptance.files.sourceCandidates.candidatesInFile, 279);
  assert.deepEqual(acceptance.files.sourceCandidates.excludedSubjects, ['hindi']);
  assert.equal(acceptance.kind, 'authored_w4_acceptance');
  assert.equal(acceptance.source, AUTHORED_SOURCE_W4);
  assert.equal(acceptance.wave, 4);
});

test('279 questions, the counts per subject and batch (the unaudited physics draft w4-phys-01 is not among them)', async () => {
  const { acceptance, rows } = await baseline();
  assert.equal(rows.length, 279);
  assert.equal(acceptance.total.written, 279);
  const by = (subject, key) => rows.filter((r) => r.subject === subject).reduce((m, r) => { m[r[key]] = (m[r[key]] || 0) + 1; return m; }, {});
  assert.deepEqual(Object.fromEntries(SUBJECTS.map((s) => [s, rows.filter((r) => r.subject === s).length])), { biology: 59, chemistry: 60, general_test: 60, mathematics: 60, physics: 40 });
  assert.deepEqual(by('biology', 'batch'), { biology__w4b1: 20, biology__w4b2: 19, biology__w4b3: 20 });
  assert.deepEqual(by('physics', 'batch'), { physics__w4b1: 20, physics__w4b2: 20 });
  assert.equal(new Set(rows.map((r) => r.id)).size, 279);
});

test('the acceptance rule, recomputed from the raw role files by hand, agrees with the wrapper on every question', async () => {
  const { rows, candidates } = await baseline();
  const text = new Map();
  for (const { subject, batch } of batchesOf()) for (const q of readJson(`${RAW}/${subject}/${batch}.json`).questions) text.set(q.id, { q, batch, subject });
  const roles = new Map();
  for (const { subject, batch } of batchesOf()) for (const role of ROLES) roles.set(`${batch}|${role}`, new Map(readJson(`${RAW}/${subject}/verify/${batch}__${role}.json`).map((r) => [r.id, r])));
  let passed = 0;
  for (const row of rows) {
    const { q, batch } = text.get(row.id);
    const rec = (role) => roles.get(`${batch}|${role}`).get(row.id);
    const solverOk = ['s1', 's2', 's3', 's4', 's5'].filter((role) => String(rec(role).answer).toUpperCase() === q.correct_key).length >= 4;
    const qualityOk = ['j1', 'j2'].every((role) => rec(role).quality_score >= 7 && rec(role).flags.length === 0 && String(rec(role).blind_answer).toUpperCase() === q.correct_key);
    const fits = ['h1', 'h2', 'h3'].map((role) => rec(role));
    const fitOk = median3(fits.map((f) => f.fit_score)) >= 8 && fits.filter((f) => f.fit_flags.length).length < 2;
    const byHand = solverOk && qualityOk && fitOk;
    assert.equal(row.passed_rule_before_duplicate_screen, byHand, `${row.id} ${row.reasons.join(',')}`);
    if (byHand) passed += 1;
  }
  assert.ok(candidates.length <= passed);
  assert.ok(rows.every((row) => (row.accepted ? row.passed_rule_before_duplicate_screen : true)));
});

test('the result: 259 of 279 accepted, every rejection has a named reason, none for a missing record, structure, text drift or a duplicate', async () => {
  const { acceptance, rows, candidates } = await baseline();
  assert.deepEqual([acceptance.total.written, acceptance.total.acceptedByJudgesAndSolvers, acceptance.total.accepted, acceptance.total.rejected], [279, 259, 259, 20]);
  assert.deepEqual(Object.fromEntries(SUBJECTS.map((s) => [s, [acceptance.bySubject[s].written, acceptance.bySubject[s].accepted, acceptance.bySubject[s].rejected]])),
    { biology: [59, 55, 4], chemistry: [60, 57, 3], general_test: [60, 51, 9], mathematics: [60, 58, 2], physics: [40, 38, 2] });
  assert.equal(candidates.length, 259);
  for (const row of rows.filter((r) => !r.accepted)) assert.ok(row.reasons.length > 0, row.id);
  assert.deepEqual(acceptance.total.rejectedByReason, {
    solvers: 2, quality_score: 9, quality_flag: 5, judge_blind_answer: 1, fit_median: 8, fit_flags: 0, verification_incomplete: 0, structural: 0, blind_text: 0, duplicate: 0,
    repaired_without_resolve: 0, resolve: 0, expert_verdict: 0, other: 0,
  });
  // the eight Current Affairs rows whose answer is a peripheral name, venue or date (the fit rubric caps them at 6)
  const fitRows = rows.filter((r) => r.reasons.some((reason) => categoryOf(reason) === 'fit_median'));
  assert.equal(fitRows.length, 8);
  assert.ok(fitRows.every((r) => r.subject === 'general_test' && r.fit.median === 6));
});

test('the two-judge mean: written to the acceptance file, 211 of 279 written and 202 of 259 accepted are at 8 or more', async () => {
  const { acceptance, rows } = await baseline();
  const dist = acceptance.qualityMeanDistribution;
  assert.deepEqual(dist.total, { written: 279, accepted: 259, atLeast8All: 211, atLeast8Accepted: 202, below8Accepted: 57 });
  assert.deepEqual(Object.fromEntries(Object.entries(dist.bySubject).map(([s, v]) => [s, [v.written, v.accepted, v.atLeast8Accepted, v.below8Accepted]])),
    { biology: [59, 55, 37, 18], chemistry: [60, 57, 42, 15], general_test: [60, 51, 39, 12], mathematics: [60, 58, 51, 7], physics: [40, 38, 33, 5] });
  // recomputed from the rows themselves
  const mean = (row) => (row.quality[0].score + row.quality[1].score) / 2;
  assert.equal(rows.filter((r) => mean(r) >= 8).length, 211);
  assert.equal(rows.filter((r) => r.accepted && mean(r) >= 8).length, 202);
  assert.equal(Object.values(dist.bySubject).reduce((n, v) => n + v.noTwoScores, 0), 0);
  // waves 2 and 3 do not get the new block
});

test('what is written: three files, the wave-4 names, the candidates carry claude_audited, the entries are bound to the candidates file, and the committed files are what this code writes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w4-accept-'));
  try {
    const run = await runAccept(args([`--out=${dir}`]));
    assert.deepEqual(fs.readdirSync(dir).sort(), ['wave4-acceptance-2026-10-17.json', 'wave4-candidates-scored-2026-10-17.json', 'wave4-score-entries-2026-10-17.json']);
    assert.deepEqual([run.out.acceptance, run.out.candidates, run.out.entries], ['wave4-acceptance-2026-10-17.json', 'wave4-candidates-scored-2026-10-17.json', 'wave4-score-entries-2026-10-17.json']);
    const candidates = readJson(`${dir}/wave4-candidates-scored-2026-10-17.json`);
    const entries = readJson(`${dir}/wave4-score-entries-2026-10-17.json`);
    assert.equal(candidates.length, 259);
    assert.deepEqual(validateCandidates(candidates), []);
    assert.ok(candidates.every((c) => c.source === AUTHORED_SOURCE_W4 && c._verdict === 'claude_audited' && c.subject !== 'hindi'));
    const source = new Map(readJson(`${OUT}/wave4-candidates-2026-10-17.json`).map((c) => [c.id, c]));
    for (const c of candidates) assert.deepEqual(c, source.get(c.id), c.id);
    assert.deepEqual([entries.source, entries.wave, entries.counts], [AUTHORED_SOURCE_W4, 4, { candidates: 259, entries: 259 }]);
    assert.ok(Object.keys(entries.entries).every((id) => source.has(id)));
    for (const [id, record] of Object.entries(entries.entries)) assert.equal(record.text.authoring_verdict, 'claude_audited', id);
    assert.deepEqual(candidates, readJson(`${OUT}/wave4-candidates-scored-2026-10-17.json`));
    assert.deepEqual(entries.entries, readJson(`${OUT}/wave4-score-entries-2026-10-17.json`).entries);
    assert.equal(entries.candidates_sha256, readJson(`${OUT}/wave4-score-entries-2026-10-17.json`).candidates_sha256);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// A copy of one batch with all its role files, to break one thing at a time.
function copyBatch(subject = 'chemistry', batch = 'chemistry__w4b1') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w4-raw-'));
  fs.mkdirSync(`${dir}/${subject}/verify`, { recursive: true });
  for (const name of [`${batch}.json`, `${batch}-blind.json`, `${batch}-fitaids.json`]) fs.copyFileSync(`${RAW}/${subject}/${name}`, `${dir}/${subject}/${name}`);
  for (const role of ROLES) fs.copyFileSync(`${RAW}/${subject}/verify/${batch}__${role}.json`, `${dir}/${subject}/verify/${batch}__${role}.json`);
  const file = (name) => `${dir}/${subject}/${name}`;
  const role = (r) => file(`verify/${batch}__${r}.json`);
  const edit = (target, fn) => fs.writeFileSync(target, JSON.stringify(fn(readJson(target)), null, 1));
  return { dir, subject, file, role, edit, batch, rows: async () => (await runAccept(args([`--raw=${dir}`]), { write: false })).rows, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('an untouched copy of a batch behaves exactly as in the full run (the batch is judged on its own)', async () => {
  const copy = copyBatch();
  try {
    const rows = await copy.rows();
    const base = (await baseline()).rows.filter((r) => r.batch === copy.batch);
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.map((r) => [r.id, r.accepted, r.reasons]), base.map((r) => [r.id, r.accepted, r.reasons]));
  } finally { copy.done(); }
});

test('a missing or malformed role file means those questions are NOT accepted, and nothing is invented', async () => {
  const copy = copyBatch();
  try {
    fs.rmSync(copy.role('j2'));
    fs.writeFileSync(copy.role('s3'), '[ { "id": "x", "answer": ');
    const run = await runAccept(args([`--raw=${copy.dir}`]), { write: false });
    assert.equal(run.rows.length, 20);
    assert.ok(run.rows.every((r) => !r.accepted));
    assert.ok(run.rows.every((r) => r.reasons.includes('incomplete_missing_j2') && r.reasons.includes('incomplete_malformed_s3')));
    assert.deepEqual(run.acceptance.files.missing.map((m) => m.role), ['j2']);
    assert.deepEqual(run.acceptance.files.malformed.map((m) => m.role), ['s3']);
    assert.equal(run.candidates.length, 0);
    assert.equal(run.records.size, 0);
    assert.ok(run.rows.every((r) => r.provisional));
  } finally { copy.done(); }
});

test('a record that is missing for one question, a bad answer letter and a record for a stranger id are each refused', async () => {
  const copy = copyBatch();
  try {
    const base = await copy.rows();
    const [a, b, c] = base.filter((r) => r.accepted).map((r) => r.id);
    copy.edit(copy.role('s1'), (list) => list.filter((r) => r.id !== a));
    copy.edit(copy.role('s2'), (list) => list.map((r) => (r.id === b ? { ...r, answer: 'E' } : r)));
    copy.edit(copy.role('j1'), (list) => [...list, { ...list[0], id: '00000000-0000-4000-8000-000000000000' }]);
    const rows = await copy.rows();
    const of = (id) => rows.find((r) => r.id === id);
    assert.ok(!of(a).accepted && of(a).reasons.includes('incomplete_not_in_file_s1'), of(a).reasons.join());
    assert.ok(!of(b).accepted && of(b).reasons.some((reason) => reason.startsWith('incomplete_invalid_s2')), of(b).reasons.join());
    assert.equal(of(c).accepted, true, 'the others are untouched');
  } finally { copy.done(); }
});

test('the rule thresholds: 3 of 5 solvers, a quality score of 6, a blocking flag, a fit median of 7 and two fit flags each stop a question that otherwise passes', async () => {
  const copy = copyBatch();
  try {
    const ids = (await copy.rows()).filter((r) => r.accepted).map((r) => r.id);
    assert.ok(ids.length >= 7);
    const [solvers3, solvers4, quality6, flagged, fit7, fitFlags, ok] = ids;
    const wrong = (key) => (key === 'A' ? 'B' : 'A');
    const key = Object.fromEntries(readJson(copy.file(`${copy.batch}.json`)).questions.map((q) => [q.id, q.correct_key]));
    for (const role of ['s1', 's2']) copy.edit(copy.role(role), (list) => list.map((r) => (r.id === solvers3 ? { ...r, answer: wrong(key[r.id]) } : r)));
    copy.edit(copy.role('s1'), (list) => list.map((r) => (r.id === solvers4 ? { ...r, answer: wrong(key[r.id]) } : r)));
    copy.edit(copy.role('s3'), (list) => list.map((r) => (r.id === solvers3 ? { ...r, answer: wrong(key[r.id]) } : r)));
    copy.edit(copy.role('j1'), (list) => list.map((r) => (r.id === quality6 ? { ...r, quality_score: 6 } : r.id === flagged ? { ...r, flags: ['factual_error'] } : r)));
    copy.edit(copy.role('h1'), (list) => list.map((r) => (r.id === fit7 ? { ...r, fit_score: 7 } : r.id === fitFlags ? { ...r, fit_flags: ['too_slow'] } : r)));
    copy.edit(copy.role('h2'), (list) => list.map((r) => (r.id === fit7 ? { ...r, fit_score: 7 } : r.id === fitFlags ? { ...r, fit_flags: ['level_above_cbt'] } : r)));
    const rows = await copy.rows();
    const of = (id) => rows.find((r) => r.id === id);
    assert.deepEqual(of(solvers3).reasons, ['solvers_2_of_5']);
    assert.equal(of(solvers4).accepted, true, '4 of 5 is enough');
    assert.deepEqual(of(quality6).reasons, ['j1_quality_6']);
    assert.deepEqual(of(flagged).reasons, ['j1_flags_factual_error']);
    assert.deepEqual(of(fit7).reasons, ['fit_median_7']);
    assert.deepEqual(of(fitFlags).reasons, ['fit_flagged_by_two']);
    assert.equal(of(ok).accepted, true);
    copy.edit(copy.role('j2'), (list) => list.map((r) => (r.id === ok ? { ...r, blind_answer: wrong(key[r.id]), key_matches: false } : r)));
    assert.deepEqual((await copy.rows()).find((r) => r.id === ok).reasons, [`j2_blind_answer_${wrong(key[ok])}`]);
  } finally { copy.done(); }
});

test('text that is not the assembled candidate (a stem edited after layout), a blind file that drifted and a wrong source are each refused', async () => {
  const copy = copyBatch('mathematics', 'mathematics__w4b1');
  try {
    const ids = (await copy.rows()).map((r) => r.id);
    copy.edit(copy.file(`${copy.batch}.json`), (batch) => ({ ...batch, questions: batch.questions.map((q, i) => (i === 0 ? { ...q, stem: `${q.stem} (edited)` } : i === 1 ? { ...q, source: W3_SOURCE } : i === 2 ? { ...q, explanation: `${q.explanation} (edited)` } : q)) }));
    const rows = await copy.rows();
    const [r0, r1, r2] = ids.map((id) => rows.find((r) => r.id === id));
    assert.ok(r0.reasons.includes('structural_text_differs_from_source_candidates') && r0.reasons.some((reason) => reason.startsWith('blind_text_differs_stem')), r0.reasons.join());
    assert.ok(r1.reasons.includes('structural_source_not_this_wave') && r1.reasons.includes('structural_text_differs_from_source_candidates'), r1.reasons.join());
    assert.deepEqual(r2.reasons, ['structural_text_differs_from_source_candidates'], 'an edited explanation: the solvers did not see it, the candidates file did');
    assert.ok(rows.slice(3).every((r) => r.accepted || r.reasons.every((reason) => !reason.startsWith('structural_'))));
  } finally { copy.done(); }
});

test('a fit-aids file is not a batch, and a batch that is not named <subject>__w4b<n> is not scored', async () => {
  const copy = copyBatch();
  try {
    fs.copyFileSync(copy.file(`${copy.batch}.json`), copy.file('chemistry__other1.json'));
    fs.copyFileSync(copy.file(`${copy.batch}.json`), copy.file('chemistry__w3b1.json'));
    const run = await runAccept(args([`--raw=${copy.dir}`]), { write: false });
    assert.equal(run.acceptance.files.batches, 1);
    assert.deepEqual(run.acceptance.files.unexpectedFiles.map((f) => f.problem), ['batch name is not <subject>__w4b<n>; not scored', 'batch name is not <subject>__w4b<n>; not scored']);
  } finally { copy.done(); }
});

test('a wave-4 question that repeats an accepted wave-2 or wave-3 question is a duplicate of it, named with its wave', async () => {
  const w3Final = readJson('docs/brain/reports/authored-w3/wave3-candidates-final-2026-10-17.json');
  const w2Final = readJson('docs/brain/reports/authored-w2/wave2-candidates-final-2026-10-14.json');
  const priorW3 = w3Final.find((c) => c.subject === 'chemistry');
  const priorW2 = w2Final.find((c) => c.subject === 'mathematics');
  assert.ok(priorW3 && priorW2);
  const chem = copyBatch();
  const math = copyBatch('mathematics', 'mathematics__w4b1');
  try {
    chem.edit(chem.file(chem.batch + '.json'), (batch) => ({ ...batch, questions: batch.questions.map((q, i) => (i === 0 ? { ...q, stem: priorW3.stem } : q)) }));
    math.edit(math.file(math.batch + '.json'), (batch) => ({ ...batch, questions: batch.questions.map((q, i) => (i === 0 ? { ...q, stem: priorW2.stem } : q)) }));
    const chemRows = await chem.rows();
    const mathRows = await math.rows();
    assert.ok(chemRows[0].reasons.includes('duplicate_stem_of_wave3_' + priorW3.id), chemRows[0].reasons.join());
    assert.ok(mathRows[0].reasons.includes('duplicate_stem_of_wave2_' + priorW2.id), mathRows[0].reasons.join());
    assert.ok(!chemRows[0].accepted && !mathRows[0].accepted);
  } finally { chem.done(); math.done(); }
});

test('the engine check on the accepted set: 259 planned, 259 eligible, no engine refusal, case sets placed, nothing in data/ written', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w4-check-'));
  try {
    await runAccept(args([`--out=${dir}`]));
    const { report, out } = await runCheck(args([`--out=${dir}`, '--label=working']));
    assert.ok(out.endsWith('wave4-engine-check-working-2026-10-17.json'), out);
    assert.equal(report.kind, 'authored_w4_engine_check');
    assert.equal(report.source, AUTHORED_SOURCE_W4);
    assert.deepEqual([report.planned, report.engineEligible, report.engineIneligible], [259, 259, 0]);
    assert.deepEqual(Object.fromEntries(Object.entries(report.bySubject).map(([s, v]) => [s, [v.planned, v.eligible, v.ineligible]])), { biology: [55, 55, 0], chemistry: [57, 57, 0], general_test: [51, 51, 0], mathematics: [58, 58, 0], physics: [38, 38, 0] });
    assert.deepEqual(report.engineIneligibleReasons, {});
    assert.deepEqual(report.ineligibleByGate, {});
    assert.equal(report.placementProblems.length, 0);
    assert.deepEqual(report.refused, []);
    // the four case sets: the biology and chemistry sets are servable (at least 4 distinct eligible children, passage in range); the General Test set is
    // eligible question by question but General Test's blueprint serves no sets (count target 0), so it is stored as a set and served as standalone questions.
    assert.deepEqual(report.passageSets.map((s) => [s.set_id, s.wave4_children, s.wave4_children_eligible, s.distinct_eligible_children, s.servable]), [
      ['w4-bio-02-set-1', 4, 4, 4, true], ['w4-bio-03-set-1', 5, 5, 5, true], ['w4-chem-02-set-1', 4, 4, 4, true], ['w4-gat-03-set-1', 5, 5, 5, false],
    ]);
    const committed = readJson(`${OUT}/wave4-engine-check-working-2026-10-17.json`);
    assert.deepEqual(report.refused, committed.refused);
    assert.deepEqual(report.passageSets, committed.passageSets);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['wave4-acceptance-2026-10-17.json', 'wave4-candidates-scored-2026-10-17.json', 'wave4-engine-check-working-2026-10-17.json', 'wave4-score-entries-2026-10-17.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the engine check refuses a candidates file that is not the one the entries were built from', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w4-check-'));
  try {
    await runAccept(args([`--out=${dir}`]));
    const file = `${dir}/wave4-candidates-scored-2026-10-17.json`;
    fs.writeFileSync(file, JSON.stringify(readJson(file).slice(1), null, 2));
    await assert.rejects(() => runCheck(args([`--out=${dir}`])), /sha256 differs/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('no calibration data had to be added for Mathematics and Biology: all five committed agent tables are calibrated at the same Haiku threshold, and their fit tables exist', () => {
  for (const subject of SUBJECTS) {
    const table = readJson(`data/nta_agent_scores/${subject}.json`);
    assert.equal(table.calibration.status, 'calibrated', subject);
    assert.equal(ntaAgentThreshold(table), 7, subject);
    assert.equal(table.calibration.owner_bar, 8, subject);
    assert.equal(table.rubric_version, 'nta-agent-rubric-1', subject);
    assert.ok(fs.existsSync(`data/nta_fit_scores/${subject}.json`), subject);
  }
  assert.deepEqual(readJson('data/nta_agent_scores/mathematics.json').calibration, readJson('data/nta_agent_scores/physics.json').calibration);
  assert.deepEqual(readJson('data/nta_agent_scores/biology.json').calibration, readJson('data/nta_agent_scores/physics.json').calibration);
});
