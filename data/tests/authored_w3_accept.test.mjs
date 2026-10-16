import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { W2_SOURCE, W3_SOURCE, WAVE_CONFIGS, categoryOf, explainRefusal, parseArgs, runAccept, runCheck, runFinal } from '../../scripts/authored-w2-accept.mjs';
import { AUTHORED_SOURCE_W3, WAVES, validateCandidates } from '../../scripts/lib/authored-wave.mjs';

// Wave 3 acceptance (claude-authored-2026-10-17-w3): the wave-2 wrapper run with --wave=w3 on the raw files under tmp/authored-w3s.
// Offline: files only. No network, no database, no model.
const RAW = 'tmp/authored-w3s';
const OUT = 'docs/brain/reports/authored-w3';
const NOW = '2026-10-17T12:00:00.000Z';
const ROLES = ['s1', 's2', 's3', 's4', 's5', 'j1', 'j2', 'h1', 'h2', 'h3'];
const SUBJECTS = ['chemistry', 'general_test', 'physics'];
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const median3 = (values) => values.slice().sort((a, b) => a - b)[1];
const args = (extra = []) => parseArgs(['--wave=w3', `--now=${NOW}`, ...extra]);

let memo = null;
async function baseline() {
  memo ||= await runAccept(args(), { write: false });
  return memo;
}

const batchesOf = () => SUBJECTS.flatMap((subject) => fs.readdirSync(`${RAW}/${subject}`)
  .filter((name) => name.endsWith('.json') && !name.endsWith('-blind.json') && !name.endsWith('-fitaids.json')).map((name) => ({ subject, batch: name.slice(0, -5) }))).sort((a, b) => a.batch.localeCompare(b.batch, 'en', { numeric: true }));

test('the wave config: wave 3 has its own source, files and settings, wave 2 keeps every default it had', () => {
  assert.equal(W3_SOURCE, AUTHORED_SOURCE_W3);
  assert.equal(WAVE_CONFIGS.w3.source, AUTHORED_SOURCE_W3);
  assert.equal(WAVE_CONFIGS.w2.source, W2_SOURCE);
  const w3 = parseArgs(['--wave=w3']);
  assert.deepEqual([w3.wave, w3.raw, w3.out, w3.date, w3.expert, w3.asjudged, w3.fresh, w3.resolve, w3.decisions, w3.spotcheck], ['w3', 'tmp/authored-w3s', 'docs/brain/reports/authored-w3', '2026-10-17', null, null, [], null, null, null]);
  assert.equal(w3.candidates, 'docs/brain/reports/authored-w3/wave3-candidates-2026-10-17.json');
  assert.equal(w3.manifest, 'tmp/authored-w3s/manifest.json');
  const w2 = parseArgs([]);
  assert.deepEqual([w2.wave, w2.raw, w2.out, w2.date, w2.mode, w2.expert, w2.fresh, w2.resolve, w2.candidates, w2.manifest], ['w2', 'tmp/authored-w2', 'docs/brain/reports/authored-w2', '2026-10-14', 'accept', 'docs/brain/reports/authored-w2/expert', ['tmp/authored-w2/reword'], 'tmp/authored-w2/resolve', null, null]);
  assert.equal(w2.asjudged, 'docs/brain/reports/authored-w2/wave2-candidates-asjudged-2026-10-14.json');
  assert.equal(w2.decisions, 'docs/brain/reports/authored-w2/wave2-drop-decisions-2026-10-14.json');
  assert.throws(() => parseArgs(['--wave=w9']), /unknown --wave=w9/);
  // an explicit option wins over the wave default
  assert.equal(parseArgs(['--wave=w3', '--date=2026-10-18', '--raw=x']).date, '2026-10-18');
  assert.equal(parseArgs(['--wave=w3', '--raw=x']).raw, 'x');
});

test('wave 3 has no final mode: the expert pass, the fresh pass and the hand decisions are wave 2 things', async () => {
  await assert.rejects(() => runFinal(args(['--mode=final'])), /wave-2 mode/);
  await assert.rejects(() => runCheck(args(['--final'])), /wave-2 flag/);
});

test('the raw files are 13 batches of 10 role files, laid out as the manifest says, and every one is read', async () => {
  const { acceptance } = await baseline();
  assert.equal(batchesOf().length, 13);
  assert.deepEqual(batchesOf().map((b) => b.batch), ['chemistry__w3b1', 'chemistry__w3b2', 'chemistry__w3b3', 'chemistry__w3b4', 'general_test__w3b1', 'general_test__w3b2', 'general_test__w3b3', 'general_test__w3b4', 'general_test__w3b5', 'physics__w3b1', 'physics__w3b2', 'physics__w3b3', 'physics__w3b4'].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  assert.equal(acceptance.files.batches, 13);
  assert.equal(acceptance.files.expectedResultFiles, 130);
  assert.equal(acceptance.files.presentResultFiles, 130);
  assert.deepEqual([acceptance.files.missing, acceptance.files.malformed, acceptance.files.recordIssues, acceptance.files.batchLevelProblems, acceptance.files.unexpectedFiles], [[], [], [], [], []]);
  // The fit-aids files and the verify folder's .gitkeep are not batches and not strays.
  assert.deepEqual(acceptance.files.sourceCandidates.problems, []);
  assert.deepEqual(acceptance.files.sourceCandidates.candidatesNotLaidOut, { hindi: 49 });
  assert.equal(acceptance.files.sourceCandidates.candidatesInFile, 294);
  assert.equal(acceptance.kind, 'authored_w3_acceptance');
  assert.equal(acceptance.source, AUTHORED_SOURCE_W3);
  assert.equal(acceptance.wave, 3);
});

test('245 questions, the counts per subject and batch', async () => {
  const { acceptance, rows } = await baseline();
  assert.equal(rows.length, 245);
  assert.equal(acceptance.total.written, 245);
  const by = (subject, key) => rows.filter((r) => r.subject === subject).reduce((m, r) => { m[r[key]] = (m[r[key]] || 0) + 1; return m; }, {});
  assert.deepEqual(Object.fromEntries(SUBJECTS.map((s) => [s, rows.filter((r) => r.subject === s).length])), { chemistry: 74, general_test: 97, physics: 74 });
  assert.deepEqual(by('chemistry', 'batch'), { chemistry__w3b1: 18, chemistry__w3b2: 19, chemistry__w3b3: 18, chemistry__w3b4: 19 });
  assert.deepEqual(by('general_test', 'batch'), { general_test__w3b1: 19, general_test__w3b2: 20, general_test__w3b3: 19, general_test__w3b4: 20, general_test__w3b5: 19 });
  assert.deepEqual(by('physics', 'batch'), { physics__w3b1: 18, physics__w3b2: 19, physics__w3b3: 18, physics__w3b4: 19 });
  assert.equal(new Set(rows.map((r) => r.id)).size, 245);
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
  // The duplicate screen is the only further step: it removes passers, it never adds one.
  assert.ok(candidates.length <= passed);
  assert.ok(rows.every((row) => (row.accepted ? row.passed_rule_before_duplicate_screen : true)));
  assert.equal(rows.filter((r) => r.passed_rule_before_duplicate_screen && !r.accepted).every((r) => r.reasons.every((reason) => categoryOf(reason) === 'duplicate')), true);
});

test('the result: 219 of 245 accepted (chemistry 69, general_test 83, physics 67), and every rejection has a named reason', async () => {
  const { acceptance, rows, candidates } = await baseline();
  assert.deepEqual([acceptance.total.written, acceptance.total.acceptedByJudgesAndSolvers, acceptance.total.accepted, acceptance.total.rejected], [245, 221, 219, 26]);
  assert.deepEqual(Object.fromEntries(SUBJECTS.map((s) => [s, acceptance.bySubject[s].accepted])), { chemistry: 69, general_test: 83, physics: 67 });
  assert.equal(candidates.length, 219);
  for (const row of rows.filter((r) => !r.accepted)) assert.ok(row.reasons.length > 0, row.id);
  // The two duplicates are of wave 2's final candidates, which the screen now reads.
  const duplicates = rows.filter((r) => r.reasons.some((reason) => categoryOf(reason) === 'duplicate'));
  assert.equal(duplicates.length, 2);
  assert.ok(duplicates.every((r) => r.reasons.some((reason) => reason.includes('_wave2_'))));
  // Nothing was held back for a missing or invalid record, a structural fault or a text drift.
  for (const category of ['verification_incomplete', 'structural', 'blind_text', 'solvers']) assert.equal(acceptance.total.rejectedByReason[category], 0, category);
});

test('what is written: three files, the wave-3 names, the candidates carry the authoring verdict, the entries are bound to the candidates file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w3-accept-'));
  try {
    const run = await runAccept(args([`--out=${dir}`]));
    assert.deepEqual(fs.readdirSync(dir).sort(), ['wave3-acceptance-2026-10-17.json', 'wave3-candidates-scored-2026-10-17.json', 'wave3-score-entries-2026-10-17.json']);
    assert.deepEqual(Object.keys(run.out).filter((key) => typeof run.out[key] === 'string').sort(), ['acceptance', 'candidates', 'dir', 'entries']);
    const candidates = readJson(`${dir}/wave3-candidates-scored-2026-10-17.json`);
    const entries = readJson(`${dir}/wave3-score-entries-2026-10-17.json`);
    assert.equal(candidates.length, 219);
    assert.deepEqual(validateCandidates(candidates), []);
    assert.ok(candidates.every((c) => c.source === AUTHORED_SOURCE_W3 && WAVES[3].verdicts.includes(c._verdict) && c.subject !== 'hindi'));
    const source = new Map(readJson(`${OUT}/wave3-candidates-2026-10-17.json`).map((c) => [c.id, c]));
    // the three rows the audit repaired and that were scored keep their mark (and the tag it becomes), the other 25 repaired rows are Hindi
    assert.deepEqual(candidates.filter((c) => c._reworded).map((c) => c.id.slice(0, 8)).sort(), ['13acff28', '3d3a5b97', '4d609f5a']);
    for (const c of candidates) assert.deepEqual(c, { ...source.get(c.id) }, c.id);
    assert.deepEqual([entries.source, entries.wave, entries.counts], [AUTHORED_SOURCE_W3, 3, { candidates: 219, entries: 219 }]);
    assert.ok(Object.keys(entries.entries).every((id) => source.has(id)));
    for (const [id, record] of Object.entries(entries.entries)) assert.equal(record.text.authoring_verdict, source.get(id)._verdict, id);
    // the committed files are what this code writes from these raw files
    assert.deepEqual(candidates, readJson(`${OUT}/wave3-candidates-scored-2026-10-17.json`));
    assert.deepEqual(entries.entries, readJson(`${OUT}/wave3-score-entries-2026-10-17.json`).entries);
    assert.equal(entries.candidates_sha256, readJson(`${OUT}/wave3-score-entries-2026-10-17.json`).candidates_sha256);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// A copy of one chemistry batch with all its role files, to break one thing at a time.
function copyBatch(batch = 'chemistry__w3b1') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w3-raw-'));
  fs.mkdirSync(`${dir}/chemistry/verify`, { recursive: true });
  for (const name of [`${batch}.json`, `${batch}-blind.json`, `${batch}-fitaids.json`]) fs.copyFileSync(`${RAW}/chemistry/${name}`, `${dir}/chemistry/${name}`);
  for (const role of ROLES) fs.copyFileSync(`${RAW}/chemistry/verify/${batch}__${role}.json`, `${dir}/chemistry/verify/${batch}__${role}.json`);
  const file = (name) => `${dir}/chemistry/${name}`;
  const role = (r) => file(`verify/${batch}__${r}.json`);
  const edit = (target, fn) => fs.writeFileSync(target, JSON.stringify(fn(readJson(target)), null, 1));
  return { dir, file, role, edit, batch, rows: async () => (await runAccept(args([`--raw=${dir}`]), { write: false })).rows, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('an untouched copy of a batch behaves exactly as in the full run (the batch is judged on its own)', async () => {
  const copy = copyBatch();
  try {
    const rows = await copy.rows();
    const base = (await baseline()).rows.filter((r) => r.batch === copy.batch);
    assert.equal(rows.length, 18);
    assert.deepEqual(rows.map((r) => [r.id, r.accepted, r.reasons]), base.map((r) => [r.id, r.accepted, r.reasons]));
  } finally { copy.done(); }
});

test('a missing or malformed role file means those questions are NOT accepted, and nothing is invented', async () => {
  const copy = copyBatch();
  try {
    fs.rmSync(copy.role('j2'));
    fs.writeFileSync(copy.role('s3'), '[ { "id": "x", "answer": ');
    const run = await runAccept(args([`--raw=${copy.dir}`]), { write: false });
    assert.equal(run.rows.length, 18);
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
    // a judge whose blind answer is not the key stops it
    copy.edit(copy.role('j2'), (list) => list.map((r) => (r.id === ok ? { ...r, blind_answer: wrong(key[r.id]), key_matches: false } : r)));
    assert.deepEqual((await copy.rows()).find((r) => r.id === ok).reasons, [`j2_blind_answer_${wrong(key[ok])}`]);
  } finally { copy.done(); }
});

test('text that is not the assembled candidate (a stem edited after layout), a blind file that drifted and a wrong source are each refused', async () => {
  const copy = copyBatch();
  try {
    const ids = (await copy.rows()).map((r) => r.id);
    copy.edit(copy.file(`${copy.batch}.json`), (batch) => ({ ...batch, questions: batch.questions.map((q, i) => (i === 0 ? { ...q, stem: `${q.stem} (edited)` } : i === 1 ? { ...q, source: W2_SOURCE } : i === 2 ? { ...q, explanation: `${q.explanation} (edited)` } : q)) }));
    const rows = await copy.rows();
    const [r0, r1, r2] = ids.map((id) => rows.find((r) => r.id === id));
    assert.ok(r0.reasons.includes('structural_text_differs_from_source_candidates') && r0.reasons.some((reason) => reason.startsWith('blind_text_differs_stem')), r0.reasons.join());
    assert.ok(r1.reasons.includes('structural_source_not_this_wave') && r1.reasons.includes('structural_text_differs_from_source_candidates'), r1.reasons.join());
    assert.deepEqual(r2.reasons, ['structural_text_differs_from_source_candidates'], 'an edited explanation: the solvers did not see it, the candidates file did');
    assert.ok(rows.slice(3).every((r) => r.accepted || r.reasons.every((reason) => !reason.startsWith('structural_'))));
  } finally { copy.done(); }
});

test('a fit-aids file is not a batch, and a batch that is not named <subject>__w3b<n> is not scored', async () => {
  const copy = copyBatch();
  try {
    fs.copyFileSync(copy.file(`${copy.batch}.json`), copy.file('chemistry__other1.json'));
    const run = await runAccept(args([`--raw=${copy.dir}`]), { write: false });
    assert.equal(run.acceptance.files.batches, 1);
    assert.deepEqual(run.acceptance.files.unexpectedFiles.map((f) => f.problem), ['batch name is not <subject>__w3b<n>; not scored']);
  } finally { copy.done(); }
});

test('the engine check on the accepted set: 219 planned, 211 eligible, 8 refused by the engine for their format, every refusal explained', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w3-check-'));
  try {
    await runAccept(args([`--out=${dir}`]));
    const { report, out } = await runCheck(args([`--out=${dir}`, '--label=working']));
    assert.ok(out.endsWith('wave3-engine-check-working-2026-10-17.json'), out);
    assert.equal(report.kind, 'authored_w3_engine_check');
    assert.equal(report.source, AUTHORED_SOURCE_W3);
    assert.deepEqual([report.planned, report.engineEligible, report.engineIneligible], [219, 211, 8]);
    assert.deepEqual(Object.fromEntries(Object.entries(report.bySubject).map(([s, v]) => [s, [v.planned, v.eligible, v.ineligible]])), { chemistry: [69, 69, 0], general_test: [83, 79, 4], physics: [67, 63, 4] });
    assert.deepEqual(report.engineIneligibleReasons, {
      sequence_options_not_orderings_of_stem_items: 4, statement_options_use_labels_not_in_stem: 1, answer_guard_options_invalid: 1, answer_guard_near_duplicate_options: 1, options_invalid: 1, orphan_passage_question: 1, match_options_not_pairings: 1,
    });
    assert.deepEqual(report.ineligibleByGate, { veto: 8 });
    assert.equal(report.placementProblems.length, 0);
    assert.deepEqual(report.passageSets, []);
    assert.equal(report.refused.length, 8);
    for (const refusal of report.refused) assert.ok(refusal.cause.length > 0, `${refusal.id} has a plain-language cause`);
    // The committed engine-check file lists the same refusals.
    const committed = readJson(`${OUT}/wave3-engine-check-working-2026-10-17.json`);
    assert.deepEqual(report.refused.map((r) => [r.id, r.reasons]), committed.refused.map((r) => [r.id, r.reasons]));
    // No score table was touched: the engine check merges in memory only.
    assert.deepEqual(fs.readdirSync(dir).sort(), ['wave3-acceptance-2026-10-17.json', 'wave3-candidates-scored-2026-10-17.json', 'wave3-engine-check-working-2026-10-17.json', 'wave3-score-entries-2026-10-17.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the engine check refuses a candidates file that is not the one the entries were built from', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w3-check-'));
  try {
    await runAccept(args([`--out=${dir}`]));
    const file = `${dir}/wave3-candidates-scored-2026-10-17.json`;
    fs.writeFileSync(file, JSON.stringify(readJson(file).slice(1), null, 2));
    await assert.rejects(() => runCheck(args([`--out=${dir}`])), /sha256 differs/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('explainRefusal: the wave-2 explanations stay as they were, wave 3 adds the three it was missing', () => {
  const candidate = { stem: 'Arrange: Tab, Table, Tablet.', options: [{ key: 'A', text: 'Tab, Table, Tablet' }, { key: 'B', text: 'Table, Tab, Tablet' }, { key: 'C', text: 'Tablet, Tab, Table' }, { key: 'D', text: 'Tab, Tablet, Table' }] };
  assert.deepEqual(explainRefusal(candidate, ['sequence_options_not_orderings_of_stem_items']), []);
  assert.equal(explainRefusal(candidate, ['sequence_options_not_orderings_of_stem_items'], () => ({ all: new Set() })).length, 1);
  assert.equal(explainRefusal({ stem: 'According to the author', options: [] }, ['orphan_passage_question']).length, 1);
});
