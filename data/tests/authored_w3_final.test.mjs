import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WAVE_CONFIGS, parseArgs, runFinal } from '../../scripts/authored-w2-accept.mjs';
import { applyExpertRepair, parseTextRepair } from '../../scripts/lib/authored-w3-repair.mjs';
import { AUTHORED_SOURCE_W3, planPublication, validateCandidates } from '../../scripts/lib/authored-wave.mjs';
import { ntaEligibility } from '../../data/nta_engine.js';

// Wave 3 final acceptance (17 Oct 2026): expert verdicts and their repairs, the blind re-solves, the fresh pass on the reworded rows, the owner's publish rule
// (quality mean 8 or more, fit median 8 or more) and the merged score tables. Offline: files only.
const OUT = 'docs/brain/reports/authored-w3';
const RAW = 'tmp/authored-w3s';
const NOW = '2026-10-17T12:00:00.000Z';
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const args = (extra = []) => parseArgs(['--wave=w3', '--mode=final', `--now=${NOW}`, ...extra]);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'authored-w3-final-'));
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

const verdictsOf = () => Object.fromEntries(['chemistry', 'general_test', 'physics'].map((s) => [s, readJson(`${OUT}/expert/${s}.json`).verdicts]));
const sourceById = () => new Map(readJson(`${OUT}/wave3-candidates-2026-10-17.json`).map((c) => [c.id, c]));

test('the repair parser: ncert renumbering, difficulty, unit and chapter, a stem name and four rewritten options; an old value that does not match is refused', () => {
  const q = { stem: 'What is 2-Methyl-2-methoxypropane?', ncert_ref: 'NCERT Class 12 Chemistry Part II, Ch 14 Biomolecules: Vitamins', difficulty_label: 'hard', unit: 'U', chapter: 'C', correct_key: 'D', options: [] };
  const ref = parseTextRepair(q, 'ncert_ref renumbered to the current edition: "NCERT Class 12 Chemistry Part II, Ch 14 Biomolecules: Vitamins" -> "NCERT Class 12 Chemistry Part II, Ch 10 Biomolecules: Vitamins". Stem unchanged.');
  assert.deepEqual([ref.problems, ref.fields], [[], { ncert_ref: 'NCERT Class 12 Chemistry Part II, Ch 10 Biomolecules: Vitamins' }]);
  const wrongOld = parseTextRepair(q, 'ncert_ref renumbered: "NCERT something else" -> "x".');
  assert.equal(wrongOld.problems.length, 1);
  assert.deepEqual(wrongOld.fields, {});
  const level = parseTextRepair(q, 'difficulty_label changed from hard to medium. Stem unchanged.');
  assert.deepEqual(level.fields, { difficulty_label: 'medium' });
  const move = parseTextRepair(q, 'unit changed from "U" to "V", chapter from "C" to "D"; ncert_ref set to "NCERT R".');
  assert.deepEqual(move.fields, { unit: 'V', chapter: 'D', ncert_ref: 'NCERT R' });
  const stem = parseTextRepair(q, 'Stem name "2-Methyl-2-methoxypropane" changed to "2-Methoxy-2-methylpropane" (formula unchanged).');
  assert.equal(stem.fields.stem, 'What is 2-Methoxy-2-methylpropane?');
  const options = parseTextRepair(q, 'Options rewritten; key stays D. A: "one one". B: "two two". C: "three three". D: "four four". Solver-visible text changed: yes (options).');
  assert.deepEqual(options.fields.options.map((o) => `${o.key}=${o.text}`), ['A=one one', 'B=two two', 'C=three three', 'D=four four']);
  const keyMoved = parseTextRepair({ ...q, correct_key: 'A' }, 'Options rewritten; key stays D. A: "a". B: "b". C: "c". D: "d".');
  assert.equal(keyMoved.problems.length, 1, 'the repair says the key stays D but the question is keyed A');
  assert.equal(parseTextRepair(q, 'something this parser does not know').problems.length, 1);
});

test('applying a repair: fields are applied, a chapter move is not solver-visible, and a verdict that misstates it is refused', () => {
  const q = { id: 'x', stem: 's', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }], correct_key: 'B', explanation: 'e', chapter: 'C1', unit: 'U1', difficulty_label: 'hard', ncert_ref: 'n' };
  const moved = applyExpertRepair(q, { verdict: 'repaired', fields: { chapter: 'C2', unit: 'U2' }, solver_visible_text_changed: false });
  assert.deepEqual([moved.problems, moved.changed, moved.solverVisible], [[], ['chapter', 'unit'], false]);
  const key = applyExpertRepair(q, { verdict: 'repaired', fields: { correct_key: 'D' }, solver_visible_text_changed: true });
  assert.deepEqual([key.problems, key.solverVisible, key.q.correct_key], [[], true, 'D']);
  assert.equal(applyExpertRepair(q, { verdict: 'repaired', fields: { stem: 't' }, solver_visible_text_changed: false }).problems.length, 1, 'says unchanged, is changed');
  assert.equal(applyExpertRepair(q, { verdict: 'repaired', fields: { options: [{ key: 'A', text: 'a' }] } }).problems.length, 1, 'three options missing');
  assert.equal(applyExpertRepair(q, { verdict: 'repaired', fields: { bogus: 1 } }).problems.length >= 1, true);
  assert.deepEqual(applyExpertRepair(q, { verdict: 'ready' }).changed, []);
  assert.equal(applyExpertRepair(q, { verdict: 'repaired', fields: { stem: 's' } }).problems.length, 1, 'repaired but nothing changes');
});

test('every expert repair of the three subjects applies cleanly to the authored text, and the five chemistry option sets are what the re-solvers saw', () => {
  const source = sourceById();
  const blind = new Map(readJson(`${RAW}/resolve/rv-w3-blind.json`).questions.map((q) => [q.id, q]));
  let repaired = 0;
  let solverVisible = 0;
  for (const [subject, list] of Object.entries(verdictsOf())) {
    for (const verdict of list) {
      const text = source.get(verdict.id);
      assert.ok(text, `${verdict.id} is in the source candidates`);
      const result = applyExpertRepair(text, verdict);
      assert.deepEqual(result.problems, [], `${subject} ${verdict.id}`);
      if (verdict.verdict === 'repaired') repaired += 1;
      if (result.solverVisible) {
        solverVisible += 1;
        const seen = blind.get(verdict.id);
        assert.ok(seen, `${verdict.id} was re-solved`);
        assert.deepEqual([seen.stem, seen.options], [result.q.stem, result.q.options], `${verdict.id}: the re-solvers saw the repaired text`);
      }
    }
  }
  assert.deepEqual([repaired, solverVisible], [89, 16]);
});

test('the result: 245 scored, 208 pass everything, 153 are published at 8 or more, 55 are held at 7 to 7.9, 37 are out with a reason each; no problems', async () => {
  const { acceptance, final, held, dropped, problems } = await baseline();
  assert.deepEqual(problems, []);
  assert.deepEqual([final.length, held.length, dropped.length], [153, 55, 37]);
  assert.equal(acceptance.questions.length, 245);
  assert.equal(final.length + held.length + dropped.length, 245);
  const by = acceptance.final.bySubject;
  assert.deepEqual(Object.fromEntries(Object.entries(by).map(([s, v]) => [s, [v.drafted, v.scored, v.accepted_first_pass, v.expert.ready, v.expert.repaired, v.expert.drop, v.publish_8_plus, v.held_7_to_7_9]])), {
    chemistry: [74, 74, 69, 24, 42, 3, 48, 18], general_test: [97, 97, 83, 53, 30, 0, 56, 27], physics: [74, 74, 67, 42, 17, 8, 49, 10],
  });
  assert.deepEqual(acceptance.final.droppedByCategory, { not_accepted_by_the_rule: 24, expert_drop: 11, duplicate: 2 });
  assert.ok(dropped.every((d) => d.reason && d.category && d.subject), 'every drop has a subject, a category and a reason');
  assert.ok(dropped.every((d) => d.subject !== 'hindi') && final.every((c) => c.subject !== 'hindi') && held.every((h) => h.candidate.subject !== 'hindi'), 'Hindi is out of every file');
});

test('the publish rule, recomputed by hand: quality mean 8 or more and fit median 8 or more publish; a mean of 7 to 7.9 is held; nothing else is in either list', async () => {
  const { final, held, dropped, dir } = await baseline();
  const entries = readJson(`${dir}/wave3-score-entries-final-2026-10-17.json`).entries;
  const median3 = (v) => v.slice().sort((a, b) => a - b)[1];
  for (const c of final) {
    const r = entries[c.id];
    assert.ok(mean(r.quality.map((j) => j.quality_score)) >= 8, c.id);
    assert.ok(median3(r.fit.map((j) => j.fit_score)) >= 8, c.id);
    assert.ok(['ready', 'repaired'].includes(c._expert), c.id);
    assert.ok(r.quality.every((j) => j.quality_score >= 7 && j.flags.length === 0 && j.blind_answer === c.correct_key), `${c.id}: the first-pass rule holds`);
  }
  for (const h of held) {
    const m = mean(h.record.quality.map((j) => j.quality_score));
    assert.ok(m >= 7 && m < 8, `${h.candidate.id} mean ${m}`);
    assert.equal(entries[h.candidate.id], undefined, 'a held row has no entry in the publication entries');
  }
  const ids = new Set([...final.map((c) => c.id), ...held.map((h) => h.candidate.id), ...dropped.map((d) => d.id)]);
  assert.equal(ids.size, 245, 'every scored question is in exactly one list');
});

test('the drops: the 11 expert drops, the 7 Electronic Devices ones carry the syllabus quote, and a drop never reaches the publication set', async () => {
  const { final, held, dropped } = await baseline();
  const expertDrops = dropped.filter((d) => d.category === 'expert_drop');
  assert.equal(expertDrops.length, 11);
  const electronic = ['a5de8f62', '363ac2b3', '3c52abd8', '898006b1', 'dff97aad', '7f417185', '0d5f2ae0'];
  for (const prefix of electronic) {
    const d = expertDrops.find((x) => x.id.startsWith(prefix));
    assert.ok(d, prefix);
    assert.equal(d.subject, 'physics');
    assert.match(d.reason, /Electronic Devices/);
    assert.ok(d.syllabus_check, `${prefix} carries syllabus_check`);
  }
  const out = new Set(dropped.map((d) => d.id));
  assert.ok(final.every((c) => !out.has(c.id)) && held.every((h) => !out.has(h.candidate.id)));
});

test('the publication candidates validate as wave-3 rows and carry both verdicts: the authoring check and the expert pass', async () => {
  const { final } = await baseline();
  assert.deepEqual(validateCandidates(final), []);
  assert.equal(planPublication(final).problems.length, 0);
  assert.ok(final.every((c) => c.source === AUTHORED_SOURCE_W3 && ['haiku_blind_verified', 'opus_audited'].includes(c._verdict) && ['ready', 'repaired'].includes(c._expert)));
  const row = planPublication(final).rows[0];
  assert.ok(row.tags.some((t) => /^expert_pass:(ready|repaired)$/.test(t)) && row.tags.some((t) => /^expert_review:(haiku_blind_verified|opus_audited)$/.test(t)));
  // The expert repair is in the text: a repaired chemistry NCERT reference, a repaired physics option set, a moved general-test chapter.
  const by = new Map(final.map((c) => [c.id, c]));
  const chem = [...by.values()].find((c) => c.id.startsWith('5202c447'));
  assert.equal(chem.ncert_ref, 'NCERT Class 12 Chemistry Part II, Ch 10 Biomolecules: Vitamins');
  const physics = [...by.values()].find((c) => c.id.startsWith('fc6098bd'));
  assert.equal(physics.correct_key, 'D');
});

test('the judges of a question whose options moved keep their answer only through the re-solve: c1e3486d (key B to D) carries both judges to D and says so', async () => {
  const { held } = await baseline();
  const h = held.find((x) => x.candidate.id.startsWith('c1e3486d'));
  assert.ok(h, 'its quality mean is 7.5, so it is held, not published');
  assert.equal(h.candidate.correct_key, 'D');
  assert.deepEqual(h.record.text.judge_blind_answer_carried_over, [{ judge: 'j1', judged_answer: 'B', judged_key: 'B', repaired_key: 'D' }, { judge: 'j2', judged_answer: 'B', judged_key: 'B', repaired_key: 'D' }]);
  assert.deepEqual(h.record.blind_resolve_on_final_text, { n: 3, matched_key: 3, answers: ['D', 'D', 'D'] });
  assert.deepEqual(h.record.quality.map((j) => j.blind_answer), ['D', 'D']);
});

test('the committed final files are what this tool writes from the raw files (candidates, drops, the held set and the entries)', async () => {
  const { dir } = await baseline();
  // the entries file names its candidates file by path (a temp dir here; the sha256 is what binds the two) and both carry the time they were built
  const read = (file) => { const value = readJson(file); delete value.candidates_file; delete value.built_at; return value; };
  const same = (name) => assert.ok(JSON.stringify(read(`${dir}/${name}`)) === JSON.stringify(read(`${OUT}/${name}`)), `${name} differs from the committed file`);
  same('wave3-candidates-final-2026-10-17.json');
  same('wave3-dropped-2026-10-17.json');
  same('wave3-held-7-2026-10-17.json');
  same('wave3-score-entries-final-2026-10-17.json');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['wave3-candidates-final-2026-10-17.json', 'wave3-dropped-2026-10-17.json', 'wave3-final-acceptance-2026-10-17.json', 'wave3-held-7-2026-10-17.json', 'wave3-score-entries-final-2026-10-17.json'], 'the first-pass files are not rewritten');
});

test('a missing re-solve file holds every repaired row whose text a solver sees; a wrong re-solve fails the row at one of three; two of three is enough', async () => {
  const { final: base } = await baseline();
  const nonFresh = ['0468e07c', '3d1e7c96', 'afbe82bd', 'c1e3486d', 'f526f37e', '7c42a42d', 'd8db492b', '2b8ad4d9', '8ead33c1'];
  const dir = tmp();
  try {
    const resolve = path.join(dir, 'resolve');
    fs.cpSync(`${RAW}/resolve`, resolve, { recursive: true });
    fs.rmSync(path.join(resolve, 'rv-w3__s3.json'));
    const missing = await runFinal(args([`--out=${path.join(dir, 'a')}`, `--resolve=${resolve}`]));
    const heldIds = missing.dropped.filter((d) => d.category === 'held_repaired_text_needs_blind_resolve').map((d) => d.id.slice(0, 8)).sort();
    assert.deepEqual(heldIds, nonFresh.slice().sort());
    assert.equal(missing.final.length + missing.held.length, 208 - 9, 'nothing else changes, nothing is invented');
    // one wrong answer of three: still 2 of 3
    const s1 = JSON.parse(fs.readFileSync(`${RAW}/resolve/rv-w3__s1.json`, 'utf8'));
    const target = s1.find((r) => r.id.startsWith('2b8ad4d9')).id;
    const wrong = (a) => (a === 'B' ? 'C' : 'B');
    const edit = (role, change) => fs.writeFileSync(path.join(resolve, `rv-w3__${role}.json`), JSON.stringify(JSON.parse(fs.readFileSync(`${RAW}/resolve/rv-w3__${role}.json`, 'utf8')).map((r) => (r.id === target ? { ...r, answer: wrong(r.answer) } : r))));
    fs.cpSync(`${RAW}/resolve`, resolve, { recursive: true });
    edit('s1');
    const one = await runFinal(args([`--out=${path.join(dir, 'b')}`, `--resolve=${resolve}`]));
    assert.ok([...one.final, ...one.held.map((h) => h.candidate)].some((c) => c.id === target), 'two of three on the key still passes');
    edit('s2');
    const two = await runFinal(args([`--out=${path.join(dir, 'c')}`, `--resolve=${resolve}`]));
    const failed = two.dropped.find((d) => d.id === target);
    assert.equal(failed.category, 'blind_resolve_failed');
    assert.match(failed.reason, /resolve_1_of_3/);
    assert.equal(base.length >= two.final.length, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a reworded row needs all ten records of its fresh pass: without one judge file the seven are held, even those that have a re-solve', async () => {
  const dir = tmp();
  try {
    const fresh = path.join(dir, 'reword');
    fs.cpSync(`${RAW}/reword`, fresh, { recursive: true });
    fs.rmSync(path.join(fresh, 'rw-w3__j2.json'));
    const run = await runFinal(args([`--out=${path.join(dir, 'out')}`, `--fresh=${fresh}`]));
    const reworded = ['6bbde2ac', 'f05bce07', '4650a47a', 'c397d567', 'fe0417ed', 'fc6098bd', 'd72339f5'];
    for (const prefix of reworded) {
      const d = run.dropped.find((x) => x.id.startsWith(prefix));
      assert.ok(d, `${prefix} is held`);
      assert.match(d.reason, /reworded_without_complete_fresh_pass|incomplete/);
    }
    assert.ok(![...run.final, ...run.held.map((h) => h.candidate)].some((c) => reworded.some((p) => c.id.startsWith(p))));
    assert.equal(run.final.length + run.held.length, 208 - 7);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a malformed expert verdict file or an unparseable repair holds the row; it is not guessed', async () => {
  const dir = tmp();
  try {
    const expert = path.join(dir, 'expert');
    fs.cpSync(`${OUT}/expert`, expert, { recursive: true });
    const file = path.join(expert, 'chemistry.json');
    const chem = JSON.parse(fs.readFileSync(file, 'utf8'));
    const target = chem.verdicts.find((v) => v.verdict === 'repaired' && /renumbered/.test(v.repair));
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
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the merged tables: every published row is bound to its final text and eligible in the engine; no held, dropped or Hindi row has an entry', async () => {
  const { final, held, dropped } = await baseline();
  const rows = new Map(planPublication(final).rows.map((r) => [r.id, r]));
  const tables = { agent: {}, fit: {} };
  for (const subject of ['chemistry', 'general_test', 'physics']) {
    tables.agent[subject] = readJson(`data/nta_agent_scores/${subject}.json`);
    tables.fit[subject] = readJson(`data/nta_fit_scores/${subject}.json`);
  }
  const authored = (subject) => Object.entries(tables.agent[subject].questions).filter(([, e]) => e.provenance?.kind === AUTHORED_SOURCE_W3).map(([id]) => id);
  const entered = new Set(['chemistry', 'general_test', 'physics'].flatMap(authored));
  assert.deepEqual([...entered].sort(), final.map((c) => c.id).sort(), 'exactly the publication set has wave-3 entries');
  for (const c of final) {
    const row = rows.get(c.id);
    const verdict = ntaEligibility({ ...row, evidence: null }, { subject: c.subject, agentScores: tables.agent, fitScores: tables.fit });
    assert.deepEqual(verdict.reasons, [], c.id);
    assert.equal(verdict.eligible, true);
    assert.equal(tables.agent[c.subject].questions[c.id].content_hash, tables.fit[c.subject].questions[c.id].content_hash);
  }
  for (const id of [...held.map((h) => h.candidate.id), ...dropped.map((d) => d.id)]) assert.ok(!entered.has(id), `${id} has no wave-3 entry`);
});

test('the config: wave 3 final settings exist and wave 2 final files keep their names', () => {
  assert.equal(WAVE_CONFIGS.w3.resolvePrefix, 'rv-w3');
  assert.equal(WAVE_CONFIGS.w2.resolvePrefix, 'rv-w2');
  assert.equal(WAVE_CONFIGS.w3.carryBlindAnswers, true);
});
