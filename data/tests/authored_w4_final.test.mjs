import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WAVE_CONFIGS, parseArgs, runCheck, runFinal } from '../../scripts/authored-w2-accept.mjs';
import { applyExpertRepair, parseTextRepair } from '../../scripts/lib/authored-w3-repair.mjs';
import { AUTHORED_SOURCE_W4, planPublication, validateCandidates } from '../../scripts/lib/authored-wave.mjs';
import { ntaEligibility } from '../nta_engine.js';

// Wave 4 final acceptance (17 Oct 2026): expert verdicts and their repairs, the blind re-solve, the owner's publish rule (quality mean 8 or more, fit median 8 or more),
// the stranded case-set children and the merged score tables. Offline: files only.
const OUT = 'docs/brain/reports/authored-w4';
const RAW = 'tmp/authored-w4s';
const NOW = '2026-10-17T12:00:00.000Z';
const SUBJECTS = ['biology', 'chemistry', 'general_test', 'mathematics', 'physics'];
const RESOLVED = '01d16929-b579-401b-9a88-81ff84f82232';
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const args = (extra = []) => parseArgs(['--wave=w4', '--mode=final', `--now=${NOW}`, ...extra]);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w4-final-'));
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

let memo = null;
async function baseline() {
  if (!memo) {
    const dir = tmp();
    memo = { dir, ...(await runFinal(args([`--out=${dir}`]))) };
  }
  return memo;
}
process.on('exit', () => { if (memo) fs.rmSync(memo.dir, { recursive: true, force: true }); });

const verdictsOf = () => Object.fromEntries(SUBJECTS.map((s) => [s, readJson(`${OUT}/expert/${s}.json`).verdicts]));
const sourceById = () => new Map(readJson(`${OUT}/wave4-candidates-2026-10-17.json`).map((c) => [c.id, c]));

test('the repair parser reads one reworded statement of a statement-based stem and refuses an old sentence that is not in the stem exactly once', () => {
  const q = { stem: 'Consider:\n(A) first.\n(C) The letter D refers to the carbon farthest away.\n(D) last.', ncert_ref: 'n' };
  const ok = parseTextRepair(q, 'Statement (C) changed from "The letter D refers to the carbon farthest away." to "The letter D refers to the chiral carbon farthest away." (one word added: chiral). Options, key and explanation unchanged.');
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.fields.stem, 'Consider:\n(A) first.\n(C) The letter D refers to the chiral carbon farthest away.\n(D) last.');
  assert.equal(parseTextRepair(q, 'Statement (C) changed from "not in the stem" to "x".').problems.length, 1);
  assert.equal(parseTextRepair({ stem: 'a a a' }, 'Statement (A) changed from "a" to "b".').problems.length, 1, 'three occurrences');
  const dollar = parseTextRepair({ stem: 'cost x' }, 'Statement (A) changed from "x" to "$& y".');
  assert.equal(dollar.fields.stem, 'cost $& y', 'the new text is inserted literally');
  // the wave-3 sentences still parse the way they did
  assert.deepEqual(parseTextRepair({ difficulty_label: 'hard' }, 'difficulty_label changed from hard to medium.').fields, { difficulty_label: 'medium' });
});

test('every expert repair of the five subjects applies cleanly to the authored text; exactly one changes what a solver sees, and the re-solvers saw the repaired text', () => {
  const source = sourceById();
  const blind = new Map(readJson(`${RAW}/resolve/rv-w4-blind.json`).questions.map((q) => [q.id, q]));
  let repaired = 0;
  let verdicts = 0;
  const solverVisible = [];
  for (const [subject, list] of Object.entries(verdictsOf())) {
    for (const verdict of list) {
      verdicts += 1;
      const text = source.get(verdict.id);
      assert.ok(text, `${verdict.id} is in the source candidates`);
      const result = applyExpertRepair(text, verdict);
      assert.deepEqual(result.problems, [], `${subject} ${verdict.id}`);
      if (verdict.verdict === 'repaired') repaired += 1;
      if (result.solverVisible) {
        solverVisible.push(verdict.id);
        const seen = blind.get(verdict.id);
        assert.ok(seen, `${verdict.id} was re-solved`);
        assert.deepEqual([seen.stem, seen.options], [result.q.stem, result.q.options], `${verdict.id}: the re-solvers saw the repaired text`);
      }
    }
  }
  assert.deepEqual([verdicts, repaired, solverVisible], [259, 62, [RESOLVED]]);
});

test('the result: 279 scored, 259 pass the rule, 200 are published at 8 or more, 57 are held at 7 to 7.9, 22 are out with a reason each; no problems', async () => {
  const { acceptance, final, held, dropped, problems } = await baseline();
  assert.deepEqual(problems, []);
  assert.deepEqual([final.length, held.length, dropped.length], [200, 57, 22]);
  assert.equal(acceptance.questions.length, 279);
  assert.equal(final.length + held.length + dropped.length, 279);
  const by = acceptance.final.bySubject;
  assert.deepEqual(Object.fromEntries(Object.entries(by).map(([s, v]) => [s, [v.drafted, v.scored, v.accepted_first_pass, v.expert.ready, v.expert.repaired, v.expert.drop, v.resolve_or_fresh_pass_held, v.publish_8_plus, v.held_7_to_7_9]])), {
    biology: [59, 59, 55, 32, 23, 0, 0, 35, 18],
    chemistry: [60, 60, 57, 43, 14, 0, 0, 42, 15],
    general_test: [60, 60, 51, 39, 12, 0, 0, 39, 12],
    mathematics: [60, 60, 58, 52, 6, 0, 0, 51, 7],
    physics: [40, 40, 38, 31, 7, 0, 0, 33, 5],
  });
  assert.deepEqual(acceptance.final.droppedByCategory, { not_accepted_by_the_rule: 20, set_left_with_fewer_than_2_children: 2 });
  assert.ok(dropped.every((d) => d.reason && d.category && d.subject), 'every drop has a subject, a category and a reason');
  assert.deepEqual([acceptance.final.reworded_with_fresh_pass, acceptance.final.blindResolveOnFinalText], [0, 1]);
  assert.ok(![...final, ...held.map((h) => h.candidate)].some((c) => c.subject === 'hindi'), 'Hindi stays out');
});

test('the publish rule, recomputed by hand: quality mean 8 or more and fit median 8 or more publish; a mean of 7 to 7.9 is held; every question is in exactly one list', async () => {
  const { final, held, dropped, dir } = await baseline();
  const entries = readJson(`${dir}/wave4-score-entries-final-2026-10-17.json`).entries;
  const median3 = (v) => v.slice().sort((a, b) => a - b)[1];
  for (const c of final) {
    const r = entries[c.id];
    assert.ok(mean(r.quality.map((j) => j.quality_score)) >= 8, c.id);
    assert.ok(median3(r.fit.map((j) => j.fit_score)) >= 8, c.id);
    assert.ok(['ready', 'repaired'].includes(c._expert), c.id);
    assert.ok(r.quality.every((j) => j.quality_score >= 7 && j.flags.length === 0 && j.blind_answer === c.correct_key), `${c.id}: the first-pass rule holds`);
    assert.ok(r.blind_solvers.matched_key >= 4, c.id);
  }
  for (const h of held) {
    const m = mean(h.record.quality.map((j) => j.quality_score));
    assert.ok(m >= 7 && m < 8, `${h.candidate.id} mean ${m}`);
    assert.equal(entries[h.candidate.id], undefined, 'a held row has no entry in the publication entries');
  }
  const ids = new Set([...final.map((c) => c.id), ...held.map((h) => h.candidate.id), ...dropped.map((d) => d.id)]);
  assert.equal(ids.size, 279);
});

test('the 20 rejected by the rule stay rejected with their reasons, and none of them reaches either list', async () => {
  const { acceptance, final, held, dropped } = await baseline();
  const rejected = dropped.filter((d) => d.category === 'not_accepted_by_the_rule');
  assert.equal(rejected.length, 20);
  assert.deepEqual(rejected.reduce((by, d) => ({ ...by, [d.subject]: (by[d.subject] || 0) + 1 }), {}), { biology: 4, chemistry: 3, general_test: 9, mathematics: 2, physics: 2 });
  const first = readJson(`${OUT}/wave4-acceptance-2026-10-17.json`);
  assert.deepEqual(new Set(rejected.map((d) => d.id)), new Set(first.questions.filter((q) => !q.accepted).map((q) => q.id)), 'the same 20 as the first-pass acceptance');
  assert.ok(rejected.every((d) => d.first_pass === 'not_accepted_in_the_first_pass'));
  const out = new Set(dropped.map((d) => d.id));
  assert.ok(final.every((c) => !out.has(c.id)) && held.every((h) => !out.has(h.candidate.id)));
  assert.equal(acceptance.questions.filter((r) => r.final === 'publish').length, 200);
});

test('case sets: a child that passes the rule but whose siblings are held is not published alone; the ledger names the held siblings, and the sets that stay have at least two children', async () => {
  const { final, dropped } = await baseline();
  const stranded = dropped.filter((d) => d.category === 'set_left_with_fewer_than_2_children');
  assert.deepEqual(stranded.map((d) => d.id).sort(), ['89ff99c8-222d-48d8-8071-e65f3656d7cd', 'ad0c0f11-adaa-4a9b-aae2-95288ca2e8e5']);
  for (const d of stranded) {
    assert.equal(d.stranded_by_set.passes_publish_rule_alone, true);
    assert.ok(d.stranded_by_set.held_7_to_7_9_siblings.length >= 3, d.id);
    assert.ok(mean(d.stranded_by_set.quality_scores) >= 8 && d.stranded_by_set.fit_median >= 8);
  }
  const children = new Map();
  for (const c of final) if (c.set_id) children.set(c.set_id, (children.get(c.set_id) || 0) + 1);
  assert.deepEqual(Object.fromEntries(children), { 'w4-chem-02-set-1': 3, 'w4-gat-03-set-1': 4 });
});

test('the publication candidates validate as wave-4 rows and carry both verdicts: the audit and the expert pass; the repair is in the text', async () => {
  const { final } = await baseline();
  assert.deepEqual(validateCandidates(final), []);
  assert.equal(planPublication(final).problems.length, 0);
  assert.ok(final.every((c) => c.source === AUTHORED_SOURCE_W4 && c._verdict === 'claude_audited' && ['ready', 'repaired'].includes(c._expert)));
  const row = planPublication(final).rows[0];
  assert.ok(row.tags.some((t) => /^expert_pass:(ready|repaired)$/.test(t)) && row.tags.includes('expert_review:claude_audited') && row.tags.includes('authored_wave:4'));
  const chem = final.find((c) => c.id === RESOLVED);
  assert.ok(chem, 'the re-solved question is published');
  assert.match(chem.stem, /configuration at the chiral carbon farthest from the carbonyl group/);
  assert.equal(chem.correct_key, 'D');
  assert.match(chem.ncert_ref, /Ch 10 Biomolecules/);
});

test('the re-solved row carries its three D answers and its repaired fields; its judges keep their answers (the key did not move)', async () => {
  const { dir } = await baseline();
  const record = readJson(`${dir}/wave4-score-entries-final-2026-10-17.json`).entries[RESOLVED];
  assert.deepEqual(record.blind_resolve_on_final_text, { n: 3, matched_key: 3, answers: ['D', 'D', 'D'] });
  assert.equal(record.blind_solvers.on, 'as_authored');
  assert.deepEqual(record.text.expert_repaired_fields.slice().sort(), ['ncert_ref', 'stem']);
  assert.equal(record.text.judge_blind_answer_carried_over, undefined);
});

test('the committed final files are what this tool writes from the raw files (candidates, drops, the held set and the entries)', async () => {
  const { dir } = await baseline();
  const read = (file) => { const value = readJson(file); delete value.candidates_file; delete value.built_at; return value; };
  const same = (name) => assert.ok(JSON.stringify(read(`${dir}/${name}`)) === JSON.stringify(read(`${OUT}/${name}`)), `${name} differs from the committed file`);
  same('wave4-candidates-final-2026-10-17.json');
  same('wave4-dropped-2026-10-17.json');
  same('wave4-held-7-2026-10-17.json');
  same('wave4-score-entries-final-2026-10-17.json');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['wave4-candidates-final-2026-10-17.json', 'wave4-dropped-2026-10-17.json', 'wave4-final-acceptance-2026-10-17.json', 'wave4-held-7-2026-10-17.json', 'wave4-score-entries-final-2026-10-17.json'], 'the first-pass files are not rewritten');
});

test('a missing re-solve file holds the repaired row whose text a solver sees; a wrong re-solve fails it at one of three; two of three is enough', async () => {
  const dir = tmp();
  try {
    const resolve = path.join(dir, 'resolve');
    fs.cpSync(`${RAW}/resolve`, resolve, { recursive: true });
    fs.rmSync(path.join(resolve, 'rv-w4__s3.json'));
    const missing = await runFinal(args([`--out=${path.join(dir, 'a')}`, `--resolve=${resolve}`]));
    const held = missing.dropped.find((d) => d.id === RESOLVED);
    assert.equal(held.category, 'held_repaired_text_needs_blind_resolve');
    assert.deepEqual([missing.final.length + missing.held.length, missing.dropped.length], [256, 23], 'nothing else changes, nothing is invented');
    const wrongAnswers = (file) => fs.writeFileSync(path.join(resolve, file), JSON.stringify(JSON.parse(fs.readFileSync(`${RAW}/resolve/${file}`, 'utf8')).map((r) => ({ ...r, answer: 'A' }))));
    fs.cpSync(`${RAW}/resolve`, resolve, { recursive: true });
    wrongAnswers('rv-w4__s1.json');
    const one = await runFinal(args([`--out=${path.join(dir, 'b')}`, `--resolve=${resolve}`]));
    assert.ok([...one.final, ...one.held.map((h) => h.candidate)].some((c) => c.id === RESOLVED), 'two of three on the key still passes');
    wrongAnswers('rv-w4__s2.json');
    const two = await runFinal(args([`--out=${path.join(dir, 'c')}`, `--resolve=${resolve}`]));
    const failed = two.dropped.find((d) => d.id === RESOLVED);
    assert.equal(failed.category, 'blind_resolve_failed');
    assert.match(failed.reason, /resolve_1_of_3/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a malformed expert file or an unparseable repair holds the row, and a missing role file holds its batch; nothing is guessed', async () => {
  const dir = tmp();
  try {
    const expert = path.join(dir, 'expert');
    fs.cpSync(`${OUT}/expert`, expert, { recursive: true });
    const file = path.join(expert, 'chemistry.json');
    const chem = JSON.parse(fs.readFileSync(file, 'utf8'));
    const target = chem.verdicts.find((v) => v.verdict === 'repaired' && /renumbered/.test(v.repair) && v.id !== RESOLVED);
    target.repair = 'ncert_ref renumbered: "NCERT that is not the current reference" -> "NCERT other".';
    fs.writeFileSync(file, JSON.stringify(chem));
    const run = await runFinal(args([`--out=${path.join(dir, 'out')}`, `--expert=${expert}`]));
    const d = run.dropped.find((x) => x.id === target.id);
    assert.ok(d, 'the row is held');
    assert.match(d.reason, /expert_repair_/);
    assert.ok(![...run.final, ...run.held.map((h) => h.candidate)].some((c) => c.id === target.id));
    fs.writeFileSync(file, '{ not json');
    const broken = await runFinal(args([`--out=${path.join(dir, 'out2')}`, `--expert=${expert}`]));
    assert.ok(broken.final.every((c) => c.subject !== 'chemistry') && broken.held.every((h) => h.candidate.subject !== 'chemistry'), 'with no chemistry verdicts nothing in chemistry is published');
    // a missing quality-judge file of one batch: no row of that batch is published or held, every other batch is unchanged
    const raw = path.join(dir, 'raw');
    fs.cpSync(RAW, raw, { recursive: true });
    fs.rmSync(path.join(raw, 'physics', 'verify', 'physics__w4b2__j2.json'));
    const missingRole = await runFinal(args([`--out=${path.join(dir, 'out3')}`, `--raw=${raw}`]));
    const inBatch = (c) => c.batch === 'physics__w4b2';
    const physicsB2 = missingRole.dropped.filter(inBatch);
    assert.equal(physicsB2.length, 20);
    assert.ok(physicsB2.every((x) => /incomplete_missing_j2/.test(x.reason)), 'every row of the batch is held for the missing record');
    assert.ok(![...missingRole.final, ...missingRole.held.map((h) => h.candidate)].some((c) => c.subject === 'physics' && physicsB2.some((x) => x.id === c.id)));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the merged tables: every published row is bound to its final text and eligible in the engine; no held, dropped or Hindi row has an entry', async () => {
  const { final, held, dropped } = await baseline();
  const rows = new Map(planPublication(final).rows.map((r) => [r.id, r]));
  const tables = { agent: {}, fit: {} };
  for (const subject of SUBJECTS) {
    tables.agent[subject] = readJson(`data/nta_agent_scores/${subject}.json`);
    tables.fit[subject] = readJson(`data/nta_fit_scores/${subject}.json`);
  }
  const authored = (subject) => Object.entries(tables.agent[subject].questions).filter(([, e]) => e.provenance?.kind === AUTHORED_SOURCE_W4).map(([id]) => id);
  const entered = new Set(SUBJECTS.flatMap(authored));
  assert.deepEqual([...entered].sort(), final.map((c) => c.id).sort(), 'exactly the publication set has wave-4 entries');
  const fitEntered = new Set(SUBJECTS.flatMap((s) => Object.entries(tables.fit[s].questions).filter(([, e]) => e.provenance?.kind === AUTHORED_SOURCE_W4).map(([id]) => id)));
  assert.deepEqual([...fitEntered].sort(), [...entered].sort());
  for (const c of final) {
    const row = rows.get(c.id);
    const verdict = ntaEligibility({ ...row, evidence: null }, { subject: c.subject, agentScores: tables.agent, fitScores: tables.fit });
    assert.deepEqual(verdict.reasons, [], c.id);
    assert.equal(verdict.eligible, true);
    assert.equal(tables.agent[c.subject].questions[c.id].content_hash, tables.fit[c.subject].questions[c.id].content_hash);
    assert.match(tables.agent[c.subject].questions[c.id].batch, /^authored-2026-10-17-w4__/);
    assert.ok(tables.agent[c.subject].questions[c.id].provenance.pipeline.startsWith('author (Claude)'));
  }
  for (const id of [...held.map((h) => h.candidate.id), ...dropped.map((d) => d.id)]) assert.ok(!entered.has(id), `${id} has no wave-4 entry`);
});

test('the engine check on the publication set: 200 planned, 200 eligible, the two case sets placed (and said not to be served in NTA mode)', async () => {
  const dir = tmp();
  try {
    const outDir = path.join(dir, 'out');
    fs.cpSync(OUT, outDir, { recursive: true });
    const { report } = await runCheck({ ...parseArgs(['--wave=w4', '--mode=check', '--final', '--label=test', `--now=${NOW}`]), out: outDir });
    assert.deepEqual([report.planned, report.engineEligible, report.engineIneligible], [200, 200, 0]);
    assert.equal(report.placementProblems.length, 0);
    assert.deepEqual(report.passageSets.map((s) => [s.set_id, s.wave4_children, s.servable]), [['w4-chem-02-set-1', 3, false], ['w4-gat-03-set-1', 4, false]]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the config: wave 4 final settings exist, waves 2 and 3 keep theirs', () => {
  assert.equal(WAVE_CONFIGS.w4.resolvePrefix, 'rv-w4');
  assert.equal(WAVE_CONFIGS.w4.carryBlindAnswers, false);
  assert.equal(WAVE_CONFIGS.w3.resolvePrefix, 'rv-w3');
  assert.equal(WAVE_CONFIGS.w3.carryBlindAnswers, true);
  assert.equal(WAVE_CONFIGS.w2.resolvePrefix, 'rv-w2');
});
