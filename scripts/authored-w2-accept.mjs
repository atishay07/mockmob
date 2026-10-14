#!/usr/bin/env node
// Authored wave 2 (claude-authored-2026-10-14-w2): acceptance of the raw solver and judge files, and an offline engine check.
// OFFLINE: reads files, writes files under docs/brain/reports/authored-w2. No database, no network, no model, no engine edit.
//
//   node scripts/authored-w2-accept.mjs --mode=accept [--raw=tmp/authored-w2] [--out=docs/brain/reports/authored-w2] [--date=2026-10-14]
//   node scripts/authored-w2-accept.mjs --mode=check  [--out=docs/brain/reports/authored-w2] [--root=<checkout>] [--label=<name>]
//
// accept  validates every file of tmp/authored-w2/<subject>/ (batch text, blind text, five solver files s1-s5, two quality-judge
//         files j1-j2, three CUET-fit judge files h1-h3 per batch) and applies the wave-1 acceptance rule per question
//         (docs/brain/AUTHORED-QUESTIONS-WAVE1-2026-10-14.md): at least 4 of 5 blind solvers match the key; both quality judges
//         score 7 or more with no flag and a blind answer equal to the key; the fit median is 8 or more and fewer than two fit judges
//         raise a flag. A question whose records are missing or malformed is NOT accepted (nothing is invented). Writes
//           wave2-acceptance-2026-10-14.json     per question: accepted and reasons, plus the per-subject table and the file validation
//           wave2-candidates-2026-10-14.json     accepted questions in the wave-1 candidates format (_verdict is null: no expert pass yet)
//           wave2-score-entries-2026-10-14.json  one durable record per accepted question, the wave-1 entries format
// check   reads those two files and runs the NTA engine's own eligibility check (data/nta_engine.js ntaEligibility, quality gate and
//         CUET-fit gate, the content gates included) on every accepted question with the committed agent and fit tables plus the
//         wave-2 entries merged in memory. --root names the checkout whose engine and tables are used (default: this one). Nothing in
//         data/ is written. Writes wave2-engine-check-<label>-2026-10-14.json.
//
// Why this is a wrapper and not authored-scores-merge.mjs: that script and scripts/lib/authored-wave.mjs are wave 1 specific
// (AUTHORED_SUBJECTS lists six subjects, the source must be claude-authored-2026-10-14, every candidate needs an expert verdict of
// ready or repaired, passage children must be type passage_set_item, and the batch text loader only reads <subject>__<letter><digit>.json).
// This file reuses their pure helpers (qualityProblems, fitCheck, acceptanceReasons, agentEntryFor, fitEntryFor, mergeAgentTable,
// mergeFitTable, toQuestionRow, contentHashOf) and does not change them.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const W2_SOURCE = 'claude-authored-2026-10-14-w2';
const SOLVERS = ['s1', 's2', 's3', 's4', 's5'];
const QUALITY = ['j1', 'j2'];
const FIT = ['h1', 'h2', 'h3'];
const ROLES = [...SOLVERS, ...QUALITY, ...FIT];
const ROLE_FILE = /^(.+)__(s[1-5]|j[12]|h[1-3])\.json$/;
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const LEVELS = ['easy', 'medium', 'hard'];
const MODELS = { quality: 'claude-haiku-5-5', fit: 'claude-haiku-5-5', solver: 'claude-haiku-5-5' };
const RULE = {
  solversMatchingKeyAtLeast: 4, solversRequired: 5, qualityScoreAtLeast: 7, qualityFlagsAllowed: 0, qualityBlindAnswerMustEqualKey: true,
  fitMedianAtLeast: 8, fitFlaggedByFewerThan: 2, source: 'docs/brain/AUTHORED-QUESTIONS-WAVE1-2026-10-14.md (acceptance rule), docs/brain/RUNBOOK-PUBLISH-AUTHORED-2026-10-14.md section 0',
};
const FILES = (date) => ({
  acceptance: `wave2-acceptance-${date}.json`,
  candidates: `wave2-candidates-${date}.json`,
  entries: `wave2-score-entries-${date}.json`,
  engine: (label) => `wave2-engine-check-${label}-${date}.json`,
});

export function parseArgs(argv) {
  const out = {
    mode: 'accept', raw: 'tmp/authored-w2', out: 'docs/brain/reports/authored-w2', root: path.resolve(HERE, '..'), date: '2026-10-14', label: 'working',
    wave1Final: 'docs/brain/reports/authored/wave1-candidates-final-2026-10-14.json',
    wave1Original: 'docs/brain/reports/authored/wave1-candidates-2026-10-14.json',
    fixtures: 'tmp/nta-fixtures', now: null,
  };
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (!m) continue;
    const [, name, value] = m;
    if (name === 'mode') out.mode = value;
    else if (name === 'raw') out.raw = value;
    else if (name === 'out') out.out = value;
    else if (name === 'root') out.root = path.resolve(value);
    else if (name === 'date') out.date = value;
    else if (name === 'label') out.label = value;
    else if (name === 'wave1-final') out.wave1Final = value;
    else if (name === 'wave1-original') out.wave1Original = value;
    else if (name === 'fixtures') out.fixtures = value;
    else if (name === 'now') out.now = value;
  }
  return out;
}

const text = (value) => (value === null || value === undefined ? '' : String(value));
const up = (value) => text(value).trim().toUpperCase();
const stableJson = (value, indent = 1) => `${JSON.stringify(value, null, indent)}\n`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sha256Text = (file) => sha256(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
const naturalCompare = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const median3 = (values) => values.slice().sort((x, y) => x - y)[1];
const normStem = (value) => text(value).toLowerCase().replace(/\s+/g, ' ').trim();
const stemKey = (c) => `${c.subject}|${normStem(c.stem)}|${text(c.passage_text).slice(0, 80)}`;
const rel = (file) => path.relative(process.cwd(), file).replace(/\\/g, '/');

function tryJson(file) {
  if (!fs.existsSync(file)) return { state: 'missing' };
  try { return { state: 'ok', value: JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) }; } catch (error) { return { state: 'malformed', error: text(error.message).slice(0, 200) }; }
}

async function loadLib(root) {
  const imp = (relative) => import(pathToFileURL(path.join(root, relative)).href);
  const [engine, scores, wave, evidence, items, agent] = await Promise.all([
    imp('data/nta_engine.js'), imp('scripts/lib/authored-scores.mjs'), imp('scripts/lib/authored-wave.mjs'), imp('data/content_evidence.js'), imp('data/nta_item_checks.js'), imp('data/nta_agent_scores.js'),
  ]);
  return { root, engine, scores, wave, evidence, items, agent };
}

// ---------------------------------------------------------------------------------------------
// Blueprint facts for the structural checks
// ---------------------------------------------------------------------------------------------

function blueprintFacts(lib, subject) {
  const bp = lib.engine.getNtaBlueprint(subject);
  if (!bp) return null;
  const chapterUnits = new Map();
  for (const variant of bp.variants) for (const section of variant.sections) for (const unit of section.units) {
    for (const chapter of unit.chapters) for (const name of [chapter.name, ...(chapter.aliases || [])]) chapterUnits.set(name, [...new Set([...(chapterUnits.get(name) || []), unit.name])]);
  }
  return { bp, chapterUnits, excluded: new Set((bp.excludedChapters || []).map((entry) => entry.name)), types: bp.typeQuotas, passageWords: bp.sets?.passageWords || null };
}

/** [problem codes] that make a candidate unpublishable or never servable, and [warnings] that do not. */
function structuralCheck(q, subject, facts, lib) {
  const problems = [];
  const warnings = [];
  const id = q?.id ?? null;
  if (!lib.items.isNtaQuestionId(id)) problems.push('id_not_uuid');
  if (q.subject !== subject) problems.push('subject_differs_from_folder');
  if (q.source !== W2_SOURCE) problems.push('source_not_wave2');
  if (!facts) problems.push('no_blueprint_for_subject');
  else {
    if (facts.excluded.has(q.chapter)) problems.push('chapter_excluded_by_blueprint');
    else if (!facts.chapterUnits.has(q.chapter)) problems.push('chapter_not_in_blueprint');
    else if (q.unit && !facts.chapterUnits.get(q.chapter).includes(q.unit)) warnings.push(`unit_differs_from_blueprint:${q.unit}|${facts.chapterUnits.get(q.chapter).join('/')}`);
    const allowed = new Set(Object.keys(facts.types).filter((type) => facts.types[type].max > 0));
    if (q.type !== 'passage_set_item' && !allowed.has(q.type)) problems.push(`type_not_in_paper:${q.type}`);
  }
  if (text(q.stem).trim().length < 10) problems.push('stem_missing_or_too_short');
  if (!text(q.explanation).trim()) problems.push('explanation_missing');
  if (!LEVELS.includes(q.difficulty_label)) problems.push('difficulty_label_invalid');
  const options = Array.isArray(q.options) ? q.options : [];
  if (options.length !== 4 || options.some((option, i) => option?.key !== OPTION_KEYS[i] || !text(option?.text).trim())) problems.push('options_not_four_keyed_A_to_D');
  else if (new Set(options.map((option) => text(option.text).trim().toLowerCase())).size < 4) problems.push('duplicate_option_text');
  if (!OPTION_KEYS.includes(q.correct_key)) problems.push('correct_key_invalid');
  const hasSet = Boolean(text(q.set_id).trim());
  const hasPassage = Boolean(text(q.passage_text).trim());
  if (hasSet !== hasPassage) problems.push(hasSet ? 'set_id_without_passage_text' : 'passage_text_without_set_id');
  if (q.type === 'passage_set_item' && !(hasSet && hasPassage)) problems.push('passage_item_without_passage_or_set');
  if (hasSet && q.type !== 'passage_set_item') warnings.push('case_set_item_typed_as_' + q.type + '_not_passage_set_item');
  return { problems, warnings };
}

// ---------------------------------------------------------------------------------------------
// Phase 1: discover and validate the files
// ---------------------------------------------------------------------------------------------

function discover(rawDir) {
  const batches = [];
  const unexpected = [];
  const subjects = fs.readdirSync(rawDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const subject of subjects) {
    const dir = path.join(rawDir, subject);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const names = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('-blind.json')).map((entry) => entry.name.slice(0, -5)).sort(naturalCompare);
    for (const entry of entries) {
      const file = rel(path.join(dir, entry.name));
      if (entry.isFile() && entry.name.endsWith('-blind.json')) { if (!names.includes(entry.name.slice(0, -11))) unexpected.push({ file, problem: 'blind file without a batch file' }); }
      else if (entry.isFile() && !entry.name.endsWith('.json')) unexpected.push({ file, problem: 'not a .json file' });
      else if (entry.isDirectory() && entry.name !== 'verify') unexpected.push({ file, problem: 'unexpected folder' });
    }
    const verifyDir = path.join(dir, 'verify');
    for (const name of fs.existsSync(verifyDir) ? fs.readdirSync(verifyDir) : []) {
      const m = name.match(ROLE_FILE);
      if (!m || !names.includes(m[1])) unexpected.push({ file: rel(path.join(verifyDir, name)), problem: m ? 'result file of a batch that has no batch file' : 'name is not <batch>__<role>.json' });
    }
    for (const batch of names) batches.push({ subject, batch, dir, verifyDir });
  }
  return { batches, unexpected };
}

function validSolver(result, id) {
  const problems = [];
  if (!result || typeof result !== 'object') return ['not an object'];
  if (result.id !== id) problems.push('id');
  if (!['A', 'B', 'C', 'D', '?'].includes(up(result.answer))) problems.push('answer');
  return problems;
}

/** One batch: its text, its blind text, and for every role the state of the file and of each question's record. */
function loadBatch(spec, lib) {
  const { subject, batch, dir, verifyDir } = spec;
  const fileReport = { subject, batch, batchFile: rel(path.join(dir, `${batch}.json`)), problems: [], roles: {} };
  const batchRes = tryJson(path.join(dir, `${batch}.json`));
  const blindRes = tryJson(path.join(dir, `${batch}-blind.json`));
  const out = { subject, batch, fileReport, questions: [], blind: new Map(), roleResults: new Map() };
  if (batchRes.state !== 'ok') { fileReport.problems.push(`batch file ${batchRes.state}`); return out; }
  const header = batchRes.value;
  if (header.batch !== batch) fileReport.problems.push(`batch field is "${header.batch}", file is ${batch}`);
  if (header.subject !== subject) fileReport.problems.push(`subject field is "${header.subject}", folder is ${subject}`);
  if (!Array.isArray(header.questions)) { fileReport.problems.push('questions is not an array'); return out; }
  out.questions = header.questions;
  const ids = out.questions.map((q) => q?.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) fileReport.problems.push('duplicate ids inside the batch file');
  fileReport.questions = ids.length;

  // The blind text the solvers were given must be the batch's text without the key and the explanation.
  // The blind files come in two shapes (an object with a questions array, or a bare array); both carry the same content.
  const blindList = blindRes.state === 'ok' ? (Array.isArray(blindRes.value) ? blindRes.value : blindRes.value?.questions) : null;
  if (blindRes.state !== 'ok') fileReport.problems.push(`blind file ${blindRes.state}`);
  else if (!Array.isArray(blindList)) fileReport.problems.push('blind file is neither an array nor an object with a questions array');
  else {
    fileReport.blindFormat = Array.isArray(blindRes.value) ? 'bare_array' : 'object_with_questions';
    const blind = blindList;
    if (blind.length !== ids.length) fileReport.problems.push(`blind file has ${blind.length} questions, batch has ${ids.length}`);
    for (const question of blind) out.blind.set(question.id, question);
    const leaks = blind.filter((question) => 'correct_key' in question || 'explanation' in question || 'answer' in question).length;
    if (leaks) fileReport.problems.push(`${leaks} blind questions carry correct_key, explanation or answer`);
  }

  for (const role of ROLES) {
    const file = path.join(verifyDir, `${batch}__${role}.json`);
    const res = tryJson(file);
    const info = { file: rel(file), state: res.state };
    fileReport.roles[role] = info;
    const results = new Map();
    out.roleResults.set(role, { state: res.state, results });
    if (res.state === 'malformed') { info.error = res.error; continue; }
    if (res.state !== 'ok') continue;
    if (!Array.isArray(res.value)) { info.state = 'not_array'; out.roleResults.get(role).state = 'not_array'; continue; }
    info.records = res.value.length;
    const seen = new Set();
    const issues = [];
    for (const result of res.value) {
      const id = result?.id;
      if (seen.has(id)) { issues.push(`duplicate id ${id}`); continue; }
      seen.add(id);
      if (!idSet.has(id)) { issues.push(`id ${id} is not in the batch`); continue; }
      results.set(id, result);
    }
    if (res.value.length !== ids.length) issues.push(`${res.value.length} records for ${ids.length} questions`);
    const missing = ids.filter((id) => !seen.has(id));
    if (missing.length) issues.push(`${missing.length} batch ids have no record`);
    else if (!issues.length && res.value.map((r) => r?.id).join('|') !== ids.join('|')) issues.push('same ids but a different order than the batch (harmless)');
    if (issues.length) info.issues = issues;
  }
  return out;
}

/** The state of one role's record for one question: { state: ok|missing|malformed|not_array|not_in_file|invalid, value?, problems? }. */
function roleRecord(loaded, role, q, lib, card, otherFlags) {
  const slot = loaded.roleResults.get(role);
  if (!slot || slot.state !== 'ok') return { state: slot?.state || 'missing' };
  const raw = slot.results.get(q.id);
  if (!raw) return { state: 'not_in_file' };
  if (SOLVERS.includes(role)) {
    const problems = validSolver(raw, q.id);
    return problems.length ? { state: 'invalid', problems } : { state: 'ok', value: { answer: up(raw.answer), confidence: raw.confidence ?? null } };
  }
  if (QUALITY.includes(role)) {
    const problems = lib.scores.qualityProblems(raw, q.id);
    return problems.length ? { state: 'invalid', problems } : { state: 'ok', value: raw };
  }
  const checked = lib.scores.fitCheck(raw, q.id, card, otherFlags);
  return checked.value ? { state: 'ok', value: checked.value, raw } : { state: 'invalid', problems: checked.problems, rawScore: Number.isInteger(raw.fit_score) ? raw.fit_score : null, rawFlags: Array.isArray(raw.fit_flags) ? raw.fit_flags.map(String) : [] };
}

// ---------------------------------------------------------------------------------------------
// Phase 2: acceptance per question
// ---------------------------------------------------------------------------------------------

const REASON_CATEGORY = [
  [/^incomplete_/, 'verification_incomplete'], [/^structural_/, 'structural'], [/^blind_text_/, 'blind_text'], [/^duplicate_/, 'duplicate'],
  [/^solvers_/, 'solvers'], [/^j\d_quality_/, 'quality_score'], [/^j\d_flags_/, 'quality_flag'], [/^j\d_blind_answer_/, 'judge_blind_answer'],
  [/^fit_median_/, 'fit_median'], [/^fit_flagged_by_two/, 'fit_flags'],
];
export const categoryOf = (reason) => (REASON_CATEGORY.find(([re]) => re.test(reason)) || [null, 'other'])[1];
const CATEGORIES = ['solvers', 'quality_score', 'quality_flag', 'judge_blind_answer', 'fit_median', 'fit_flags', 'verification_incomplete', 'structural', 'blind_text', 'duplicate', 'other'];

function sameBlind(blind, q) {
  if (!blind) return ['no_blind_text'];
  const diff = [];
  for (const field of ['stem', 'options', 'passage_text', 'chapter', 'type', 'subject']) if (JSON.stringify(blind[field] ?? null) !== JSON.stringify(q[field] ?? null)) diff.push(field);
  return diff;
}

function evaluateQuestion(q, loaded, lib, ctx) {
  const roles = Object.fromEntries(ROLES.map((role) => [role, roleRecord(loaded, role, q, lib, ctx.card, ctx.otherFlags)]));
  const reasons = [];
  const warnings = [];
  // 1. Structure of the question itself.
  const structure = structuralCheck(q, loaded.subject, ctx.facts, lib);
  for (const problem of structure.problems) reasons.push(`structural_${problem}`);
  warnings.push(...structure.warnings);
  // 2. The text the blind solvers saw.
  const blindDiff = sameBlind(loaded.blind.get(q.id), q);
  if (blindDiff.length) reasons.push(`blind_text_differs_${blindDiff.join('+')}`);
  // 3. Missing or malformed records: never invented, never accepted.
  const incomplete = [];
  for (const role of ROLES) {
    const r = roles[role];
    if (r.state !== 'ok') incomplete.push(r.state === 'invalid' ? `incomplete_invalid_${role}(${r.problems.join(',')})` : `incomplete_${r.state}_${role}`);
  }
  reasons.push(...incomplete);

  const answers = SOLVERS.map((role) => (roles[role].state === 'ok' ? roles[role].value.answer : null));
  const matched = answers.filter((answer) => answer === q.correct_key).length;
  const solvers = { n: answers.filter((answer) => answer !== null).length, matched_key: matched, answers };
  const quality = QUALITY.map((role) => (roles[role].state === 'ok' ? { judge: role, score: roles[role].value.quality_score, blind_answer: up(roles[role].value.blind_answer), flags: roles[role].value.flags.map(String), difficulty_check: roles[role].value.difficulty_check } : { judge: role, missing: true }));
  const fitJudges = FIT.map((role) => (roles[role].state === 'ok' ? { judge: role, score: roles[role].value.fit_score, flags: roles[role].value.fit_flags, other_flags: roles[role].value.other_flags || [], cuet_type: roles[role].value.cuet_type, chapter: roles[role].value.chapter, unit: roles[role].value.unit } : { judge: role, missing: true }));
  for (const judge of quality) for (const flag of judge.flags || []) if (!ctx.blockingFlags.has(flag)) warnings.push(`${judge.judge}_flag_outside_rubric_list:${flag}`);
  for (const judge of fitJudges) if (judge.other_flags?.length) warnings.push(`${judge.judge}_fit_flags_outside_rubric_list:${judge.other_flags.join('+')}`);

  let record = null;
  if (!incomplete.length) {
    record = {
      subject: loaded.subject, batch: loaded.batch, chapter: q.chapter, set_id: q.set_id || null,
      text: { expert_verdict: null, expert_issue: null, expert_reviewed_text: 'not_reviewed', judged: 'as_authored', pre_repair: null },
      blind_solvers: { n: solvers.n, matched_key: matched, answers, on: 'final' },
      blind_resolve_on_final_text: null,
      quality: QUALITY.map((role) => {
        const r = roles[role].value;
        return { judge: role, quality_score: r.quality_score, blind_answer: up(r.blind_answer), key_matches: r.key_matches, difficulty_check: r.difficulty_check, objective_tag: r.objective_tag.trim(), flags: r.flags.map(String), note: text(r.note).slice(0, 240), on_final_text: null, batch: loaded.batch };
      }),
      fit: FIT.map((role) => ({ judge: role, ...roles[role].value, on_final_text: null, batch: loaded.batch })),
    };
    // The wave-1 rule itself (scripts/lib/authored-scores.mjs acceptanceReasons), so wave 2 cannot drift from it.
    reasons.push(...lib.scores.acceptanceReasons(record, q));
    for (const role of QUALITY) if (roles[role].value.key_matches !== (up(roles[role].value.blind_answer) === q.correct_key)) warnings.push(`${role}_key_matches_field_disagrees_with_blind_answer`);
  } else {
    // Partial evidence is reported as it stands; the question stays unaccepted (the rule needs all ten records).
    if (solvers.n === 5 && matched < RULE.solversMatchingKeyAtLeast) reasons.push(`solvers_${matched}_of_${solvers.n}`);
    for (const judge of quality) {
      if (judge.missing) continue;
      if (judge.score < RULE.qualityScoreAtLeast) reasons.push(`${judge.judge}_quality_${judge.score}`);
      if (judge.flags.length) reasons.push(`${judge.judge}_flags_${judge.flags.join('+')}`);
      if (judge.blind_answer !== q.correct_key) reasons.push(`${judge.judge}_blind_answer_${judge.blind_answer}`);
    }
  }
  const fitScores = fitJudges.filter((judge) => !judge.missing).map((judge) => judge.score);
  const fitFlaggedBy = fitJudges.filter((judge) => !judge.missing && judge.flags.length).length;
  const invalidFit = Object.fromEntries(FIT.filter((role) => roles[role].state === 'invalid').map((role) => [role, { problems: roles[role].problems, own_score: roles[role].rawScore }]));
  const fit = { ...(Object.keys(invalidFit).length ? { invalid_records: invalidFit } : {}), scores: fitJudges.map((judge) => (judge.missing ? null : judge.score)), median: fitScores.length === 3 ? median3(fitScores) : null, flagged_by: fitFlaggedBy, flags: [...new Set(fitJudges.flatMap((judge) => judge.flags || []))] };
  const accepted = reasons.length === 0;
  const row = {
    id: q.id, subject: loaded.subject, batch: loaded.batch, chapter: q.chapter, type: q.type, difficulty_label: q.difficulty_label, set_id: q.set_id || null,
    accepted, reasons: [...new Set(reasons)],
    solvers, quality, fit,
    ...(warnings.length ? { warnings } : {}),
  };
  // For a question held back only by missing records: would it pass on what is there? (information for the owner, not an acceptance)
  if (incomplete.length && !reasons.some((reason) => !reason.startsWith('incomplete_'))) {
    // A present but format-invalid fit record counts here by its own score and flags (the builder would still refuse it).
    const presentFit = FIT.map((role) => (roles[role].state === 'ok' ? { score: roles[role].value.fit_score, flags: roles[role].value.fit_flags } : roles[role].state === 'invalid' && roles[role].rawScore !== null ? { score: roles[role].rawScore, flags: roles[role].rawFlags } : null)).filter(Boolean);
    const presentScores = presentFit.map((judge) => judge.score);
    const fitOk = presentScores.length > 0 && Math.min(...presentScores) >= RULE.fitMedianAtLeast && presentFit.filter((judge) => judge.flags.length).length < RULE.fitFlaggedByFewerThan;
    row.provisional = { would_pass_on_available_records: fitOk, note: fitOk ? 'every record that exists (a format-invalid fit record counted by its own score) meets the rule; the missing or invalid record is the only thing holding the question back' : 'a present fit score is below the bar or flagged: it would likely still fail', missing: incomplete };
  }
  return { row, record };
}

// ---------------------------------------------------------------------------------------------
// accept
// ---------------------------------------------------------------------------------------------

function liveStemIndex(fixturesDir, subjects) {
  const index = new Map();
  const names = { general_test: 'gat' };
  for (const subject of subjects) {
    const res = tryJson(path.join(fixturesDir, `${names[subject] || subject}.json`));
    if (res.state !== 'ok' || !Array.isArray(res.value)) continue;
    for (const row of res.value) {
      if (row.status !== 'live' || row.is_deleted) continue;
      const key = `${subject}|${normStem(row.body || row.question)}`;
      if (!index.has(key)) index.set(key, row.id);
    }
  }
  return index;
}

const grams = (stem) => { const t = ` ${normStem(stem)} `; const set = new Set(); for (let i = 0; i + 3 <= t.length; i += 1) set.add(t.slice(i, i + 3)); return set; };
const dice = (a, b) => { let shared = 0; for (const g of a) if (b.has(g)) shared += 1; return (2 * shared) / ((a.size + b.size) || 1); };
const alnum = (value) => text(value).toLowerCase().replace(/[^a-z0-9\u0080-\uffff]+/g, '');
const optionSet = (c) => new Set((c.options || []).map((option) => alnum(option?.text)).filter((value) => value.length >= 2));
const sharedOptions = (a, b) => { let n = 0; for (const value of a) if (b.has(value)) n += 1; return n; };
const answerText = (c) => alnum((c.options || []).find((option) => option.key === c.correct_key)?.text);
// Equal after stripping punctuation, or one is the other plus a unit word ("8" and "8 days").
const answersEquivalent = (a, b) => Boolean(a) && Boolean(b) && (a === b || (Math.min(a.length, b.length) >= 1 && (a.startsWith(b) || b.startsWith(a)) && /^[0-9]/.test(a) && /^[0-9]/.test(b)));

function liveRows(fixturesDir, subjects) {
  const names = { general_test: 'gat' };
  const out = [];
  for (const subject of subjects) {
    const res = tryJson(path.join(fixturesDir, `${names[subject] || subject}.json`));
    if (res.state !== 'ok' || !Array.isArray(res.value)) continue;
    for (const row of res.value) {
      if (row.status !== 'live' || row.is_deleted) continue;
      const option = (Array.isArray(row.options) ? row.options : []).find((o) => o?.key === row.correct_answer);
      out.push({ id: row.id, subject, stem: row.body || row.question || '', answer: option ? alnum(text(option.text).replace(new RegExp(`^${row.correct_answer}\\s+`), '')) : '' });
    }
  }
  return out;
}

export async function runAccept(args) {
  const lib = await loadLib(args.root);
  const rawDir = path.resolve(args.raw);
  const { batches, unexpected } = discover(rawDir);
  const wave1 = [args.wave1Final, args.wave1Original].filter((file) => fs.existsSync(file)).flatMap((file) => tryJson(file).value || []);
  const wave1Ids = new Set(wave1.map((c) => c.id));
  const wave1Stems = new Map(wave1.map((c) => [stemKey(c), c.id]));
  const subjects = [...new Set(batches.map((b) => b.subject))];
  const live = liveStemIndex(args.fixtures, subjects);
  const otherFlags = {};
  const blockingFlags = new Set(lib.agent.NTA_AGENT_BLOCKING_FLAGS);
  const cards = new Map();
  const facts = new Map();
  const files = [];
  const rows = [];
  const records = new Map();
  const candidates = [];
  const pool = [];

  for (const spec of batches) {
    const loaded = loadBatch(spec, lib);
    files.push(loaded.fileReport);
    if (!facts.has(spec.subject)) { facts.set(spec.subject, blueprintFacts(lib, spec.subject)); cards.set(spec.subject, facts.get(spec.subject) ? lib.scores.allowedCard(spec.subject) : null); }
    const ctx = { card: cards.get(spec.subject), facts: facts.get(spec.subject), otherFlags, blockingFlags };
    for (const q of loaded.questions) {
      const { row, record } = evaluateQuestion(q, loaded, lib, ctx);
      const liveId = live.get(`${q.subject}|${normStem(q.stem)}`);
      if (liveId) (row.warnings ||= []).push(`stem_equals_live_question_in_13_oct_export:${liveId}`);
      pool.push({ q, row, record });
    }
  }

  // Duplicates, second pass. A question is a duplicate only of a copy that is itself accepted on its merits (or already in wave 1):
  // if the earlier copy failed the rule and the later one passed, the later one stands. The first accepted copy is kept.
  //  - exact: the same id, or the same subject, stem and passage start (wave 1's validateCandidates key);
  //  - probable: same subject and passage, the same correct answer text and stems whose character trigrams overlap at least 78 percent (Dice):
  //    the same question reworded, options shuffled. Different numbers or different words in the stem fall below that. The screen is
  //    conservative (it misses typographic rewrites such as 'int_0^1' against a unicode integral); a weaker match is only a warning
  //    (possible_duplicate_of: two single-answer items, same answer text, stems at 50 percent, at least three identical option texts).
  // Against the 13 Oct export of the live bank only a warning is given.
  const claimedIds = new Map();
  const claimedStems = new Map();
  const claimed = []; // { id, subject, gram, passage, answer, from }
  for (const c of wave1) claimed.push({ id: c.id, subject: c.subject, gram: grams(c.stem), passage: text(c.passage_text).slice(0, 80), answer: answerText(c), optionSet: optionSet(c), single: c.type === 'single_mcq', from: 'wave1' });
  const liveClaims = liveRows(args.fixtures, subjects).map((r) => ({ id: r.id, subject: r.subject, gram: grams(r.stem), answer: r.answer }));
  for (const { q, row, record } of pool) {
    const key = stemKey(q);
    row.passed_rule_before_duplicate_screen = row.reasons.length === 0;
    if (wave1Ids.has(q.id)) { row.reasons.push('duplicate_id_in_wave1'); }
    if (wave1Stems.has(key)) { row.reasons.push(`duplicate_stem_of_wave1_${wave1Stems.get(key)}`); }
    if (claimedIds.has(q.id)) row.reasons.push(`duplicate_id_of_${claimedIds.get(q.id)}`);
    if (claimedStems.has(key)) row.reasons.push(`duplicate_stem_of_${claimedStems.get(key)}`);
    const mine = { gram: grams(q.stem), passage: text(q.passage_text).slice(0, 80), answer: answerText(q), optionSet: optionSet(q), single: q.type === 'single_mcq' };
    if (row.passed_rule_before_duplicate_screen && !row.reasons.length) {
      const twin = claimed.find((other) => other.subject === q.subject && other.passage === mine.passage && answersEquivalent(other.answer, mine.answer)
        && dice(other.gram, mine.gram) >= 0.78);
      if (twin) { row.reasons.push(`duplicate_probable_of_${twin.from === 'wave1' ? 'wave1_' : ''}${twin.id}`); row.near_duplicate = { of: twin.id, from: twin.from, dice: Math.round(dice(twin.gram, mine.gram) * 1000) / 1000, shared_option_texts: sharedOptions(twin.optionSet, mine.optionSet) }; }
    }
    if (row.passed_rule_before_duplicate_screen && !row.reasons.length) {
      const weak = claimed.find((other) => other.subject === q.subject && other.passage === mine.passage && other.single && mine.single && answersEquivalent(other.answer, mine.answer) && dice(other.gram, mine.gram) >= 0.5 && sharedOptions(other.optionSet, mine.optionSet) >= 3);
      if (weak) (row.warnings ||= []).push(`possible_duplicate_of:${weak.from === 'wave1' ? 'wave1_' : ''}${weak.id}:dice_${Math.round(dice(weak.gram, mine.gram) * 100) / 100}`);
    }
    row.reasons = [...new Set(row.reasons)];
    row.accepted = row.reasons.length === 0;
    if (row.accepted) {
      claimedIds.set(q.id, q.id); claimedStems.set(key, q.id);
      claimed.push({ id: q.id, subject: q.subject, gram: mine.gram, passage: mine.passage, answer: mine.answer, optionSet: mine.optionSet, single: mine.single, from: 'wave2' });
      const close = liveClaims.find((other) => other.subject === q.subject && dice(other.gram, mine.gram) >= 0.95 && (!other.answer || answersEquivalent(other.answer, mine.answer)));
      if (close) (row.warnings ||= []).push(`stem_close_to_live_question_in_13_oct_export:${close.id}`);
    }
    rows.push(row);
    if (row.accepted) {
      records.set(q.id, record);
      candidates.push({
        id: q.id, subject: q.subject, unit: q.unit ?? null, chapter: q.chapter, type: q.type, stem: q.stem, options: q.options, correct_key: q.correct_key, explanation: q.explanation,
        passage_text: q.passage_text ?? null, set_id: q.set_id ?? null, difficulty_label: q.difficulty_label, ncert_ref: q.ncert_ref ?? null, source: q.source, _verdict: null,
      });
    }
  }

  // Per subject table.
  const bySubject = {};
  const order = [];
  for (const row of rows) {
    if (!bySubject[row.subject]) { bySubject[row.subject] = { written: 0, acceptedByJudgesAndSolvers: 0, accepted: 0, rejected: 0, batches: {}, byChapter: {}, byType: {}, rejectedByReason: Object.fromEntries(CATEGORIES.map((c) => [c, 0])), rejectedOnlyBy: Object.fromEntries(CATEGORIES.map((c) => [c, 0])), keyDistributionAccepted: { A: 0, B: 0, C: 0, D: 0 } }; order.push(row.subject); }
    const s = bySubject[row.subject];
    s.written += 1;
    if (row.passed_rule_before_duplicate_screen) s.acceptedByJudgesAndSolvers += 1;
    (s.batches[row.batch] ||= { written: 0, accepted: 0 }).written += 1;
    (s.byChapter[row.chapter] ||= { written: 0, accepted: 0 }).written += 1;
    (s.byType[row.type] ||= { written: 0, accepted: 0 }).written += 1;
    if (row.accepted) { s.accepted += 1; s.batches[row.batch].accepted += 1; s.byChapter[row.chapter].accepted += 1; s.byType[row.type].accepted += 1; }
    else {
      s.rejected += 1;
      const categories = [...new Set(row.reasons.map(categoryOf))];
      for (const category of categories) s.rejectedByReason[category] += 1;
      if (categories.length === 1) s.rejectedOnlyBy[categories[0]] += 1;
    }
  }
  for (const c of candidates) bySubject[c.subject].keyDistributionAccepted[c.correct_key] += 1;
  const total = { written: rows.length, acceptedByJudgesAndSolvers: rows.filter((row) => row.passed_rule_before_duplicate_screen).length, accepted: candidates.length, rejected: rows.length - candidates.length, rejectedByReason: Object.fromEntries(CATEGORIES.map((c) => [c, order.reduce((n, subject) => n + bySubject[subject].rejectedByReason[c], 0)])) };

  // Passage / case sets: a set the engine serves needs the blueprint's minimum number of eligible children.
  const setChildren = {};
  for (const row of rows) if (row.set_id) (setChildren[row.set_id] ||= { subject: row.subject, written: 0, accepted: 0 }), (setChildren[row.set_id].written += 1), (setChildren[row.set_id].accepted += row.accepted ? 1 : 0);

  const filesSummary = {
    batches: files.length,
    expectedResultFiles: files.length * ROLES.length,
    presentResultFiles: files.reduce((n, f) => n + Object.values(f.roles).filter((r) => r.state !== 'missing').length, 0),
    missing: files.flatMap((f) => Object.entries(f.roles).filter(([, r]) => r.state === 'missing').map(([role, r]) => ({ batch: f.batch, role, file: r.file }))),
    malformed: files.flatMap((f) => Object.entries(f.roles).filter(([, r]) => ['malformed', 'not_array'].includes(r.state)).map(([role, r]) => ({ batch: f.batch, role, file: r.file, state: r.state, error: r.error || null }))),
    recordIssues: files.flatMap((f) => Object.entries(f.roles).filter(([, r]) => r.issues?.length).map(([role, r]) => ({ batch: f.batch, role, file: r.file, issues: r.issues }))),
    batchLevelProblems: files.filter((f) => f.problems.length).map((f) => ({ batch: f.batch, problems: f.problems })),
    unexpectedFiles: unexpected,
    fitFlagsOutsideRubricList: otherFlags,
  };
  const now = args.now || new Date().toISOString();
  const acceptance = {
    kind: 'authored_w2_acceptance', source: W2_SOURCE, date: args.date, built_at: now, models: MODELS,
    note: 'Wave-1 acceptance rule applied to the wave-2 raw files. Questions whose solver or judge records are missing or malformed are not accepted; no result was invented. No expert pass has been run on wave 2 (candidates carry _verdict: null).',
    rule: RULE,
    raw: rel(rawDir),
    total, bySubject, files: filesSummary, sets: setChildren,
    questions: rows,
  };
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const names = FILES(args.date);
  fs.writeFileSync(path.join(outDir, names.acceptance), stableJson(acceptance, 1));
  fs.writeFileSync(path.join(outDir, names.candidates), stableJson(candidates, 2));
  const candidatesFile = path.join(outDir, names.candidates);
  const entries = {
    kind: 'authored_score_entries', version: lib.scores.SCORES_VERSION, source: W2_SOURCE, wave: 2, built_at: now, date: args.date, models: MODELS,
    models_note: 'The raw judge files do not record the model; claude-haiku-5-5 for every solver and judge was stated by the orchestrator (14 Oct 2026).',
    note: 'One record per accepted wave-2 question, in the wave-1 entries format. Built by scripts/authored-w2-accept.mjs. No expert pass and no repair: judged text is the authored text. scripts/lib/authored-scores.mjs provenanceOf still describes the wave-1 pipeline and the wave-1 source key; it needs a wave-2 variant before these entries are merged into data/nta_agent_scores and data/nta_fit_scores.',
    candidates_file: rel(candidatesFile), candidates_sha256: sha256Text(candidatesFile),
    counts: { candidates: candidates.length, entries: records.size },
    entries: Object.fromEntries([...records.entries()]),
  };
  fs.writeFileSync(path.join(outDir, names.entries), stableJson(entries, 1));
  return { acceptance, out: { dir: rel(outDir), ...names } };
}

// ---------------------------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------------------------

function loadTable(dir, subject) {
  const res = tryJson(path.join(dir, `${subject}.json`));
  return res.state === 'ok' ? res.value : null;
}

// Plain-language diagnosis of an engine refusal. The refusal itself comes from the engine (ntaEligibility); these mirror the few rules behind the
// reasons seen in wave 2 (data/nta_question_selector.js optionsAreUsable and hasMalformedText, isPassageLinkedQuestion; data/nta_item_checks.js sequence checks)
// so a reviewer can see what to change. They are explanations, not a second check.
const comparable = (value) => text(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
export function explainRefusal(candidate, reasons) {
  const out = [];
  const options = candidate.options || [];
  const set = new Set(reasons);
  if (set.has('options_invalid') || set.has('answer_guard_options_invalid') || set.has('answer_guard_near_duplicate_options')) {
    const letters = options.filter((option) => /^(option\s*)?[a-d]$/i.test(text(option.text).trim())).map((option) => option.key);
    if (letters.length) out.push(`option text is a single letter a-d (read as a placeholder): ${letters.join(', ')}`);
    const groups = new Map();
    for (const option of options) groups.set(comparable(option.text), [...(groups.get(comparable(option.text)) || []), option.key]);
    for (const [key, keys] of groups) if (keys.length > 1) out.push(`options ${keys.join(', ')} are identical once everything except letters and digits is dropped (${key ? `"${key}"` : 'nothing left'}): they differ only by symbols, signs, superscripts or brackets`);
    if (options.some((option) => text(option.text).length > 240)) out.push('an option is longer than 240 characters');
  }
  if (set.has('malformed_question_text')) out.push(`the stem or an option contains "[[" or "]]" (nested brackets, for example matrix notation): ${/\[\[|\]\]/.test(text(candidate.stem)) ? 'in the stem' : 'in an option'}`);
  if (set.has('orphan_passage_question')) {
    const hit = text(candidate.stem).match(/\b(according to|based on|as stated in|read the passage|read the excerpt|read the extract|read the text|the passage|the paragraph|the extract|the excerpt|the author|the narrator)\b/i);
    out.push(`the stem reads as passage-linked because of "${hit ? hit[0] : '?'}" but the row has no passage`);
  }
  if (set.has('sequence_key_is_listed_order')) out.push('the correct option lists the items in the same order as the stem prints them');
  if (set.has('sequence_order_narrated_in_stem')) out.push('the stem itself narrates the order (two or more ordering cues)');
  return out;
}

// The engine's gate of a refusal reason (ntaGateOf, exported from r5.1; r5 has the same rule unexported): fit, quality, other (not a published bank row) or veto.
function gateOfReason(engine, reason) {
  if (typeof engine.ntaGateOf === 'function') return engine.ntaGateOf(reason);
  const code = String(reason || '');
  if (code.startsWith('fit_')) return 'fit';
  if (['no_score', 'question_changed_since_scored', 'blind_solver_key_missing', 'independent_solver_key_missing'].includes(code) || code.startsWith('score_') || code.startsWith('agent_score_')) return 'quality';
  if (['not_published', 'id_not_uuid', 'seed_or_demo_row'].includes(code)) return 'other';
  return 'veto';
}

export async function runCheck(args) {
  const lib = await loadLib(args.root);
  const { engine, scores, wave, evidence, items } = lib;
  const gateOf = (reason) => gateOfReason(engine, reason);
  const outDir = path.resolve(args.out);
  const names = FILES(args.date);
  const candidates = tryJson(path.join(outDir, names.candidates)).value;
  const entriesFile = tryJson(path.join(outDir, names.entries)).value;
  if (!Array.isArray(candidates) || !entriesFile?.entries) throw new Error(`run --mode=accept first: ${names.candidates} and ${names.entries} are needed in ${rel(outDir)}`);
  if (sha256Text(path.join(outDir, names.candidates)) !== entriesFile.candidates_sha256) throw new Error('the candidates file is not the one the entries were built from (sha256 differs); rebuild with --mode=accept');
  const wave1 = tryJson(path.resolve(args.wave1Final)).value || [];
  const now = args.now || new Date().toISOString();
  const header = { models: entriesFile.models, date: entriesFile.date };
  const policy = 'admit';

  // Rows exactly as the bank would hold them. A case set item typed single_mcq (geography) is mapped as a passage child, otherwise the
  // wave-1 mapping would drop its passage; its content hash then includes the passage, as the engine reads it.
  const wave1SetSizes = new Map();
  for (const c of wave1) if (c.set_id) wave1SetSizes.set(c.set_id, (wave1SetSizes.get(c.set_id) || 0) + 1);
  const nextOrder = new Map();
  const planned = candidates.map((c) => {
    const isSet = Boolean(text(c.set_id).trim() && text(c.passage_text).trim());
    const mapped = isSet ? { ...c, type: 'passage_set_item' } : c;
    let position = {};
    if (isSet) {
      const order = (nextOrder.get(c.set_id) ?? wave1SetSizes.get(c.set_id) ?? 0) + 1;
      nextOrder.set(c.set_id, order);
      position = { groupId: wave.passageGroupIdOf(c.set_id), orderIndex: order };
    }
    return { candidate: mapped, original: c, position, row: wave.toQuestionRow(mapped, position) };
  });

  const bySubjectEntries = { agent: {}, fit: {} };
  for (const item of planned) {
    const record = entriesFile.entries[item.candidate.id];
    if (!record) throw new Error(`no entry record for ${item.candidate.id}`);
    const options = { policy, header, position: item.position };
    (bySubjectEntries.agent[item.candidate.subject] ||= {})[item.candidate.id] = scores.agentEntryFor(item.candidate.id, item.candidate, record, options);
    (bySubjectEntries.fit[item.candidate.subject] ||= {})[item.candidate.id] = scores.fitEntryFor(item.candidate.id, item.candidate, record, { ...options, engineTypeGuess: scores.engineTypeOf(item.candidate, item.row) });
  }
  const agentTables = {};
  const fitTables = {};
  const baseMissing = [];
  for (const subject of Object.keys(bySubjectEntries.agent)) {
    const agentBase = loadTable(path.join(args.root, 'data/nta_agent_scores'), subject);
    const fitBase = loadTable(path.join(args.root, 'data/nta_fit_scores'), subject);
    if (!agentBase) baseMissing.push(`agent:${subject}`);
    if (!fitBase) baseMissing.push(`fit:${subject}`);
    if (!agentBase || !fitBase) continue;
    agentTables[subject] = scores.mergeAgentTable(agentBase, bySubjectEntries.agent[subject], { subject, now, header, policy });
    fitTables[subject] = scores.mergeFitTable(fitBase, bySubjectEntries.fit[subject], { subject, now, header, policy });
  }
  if (baseMissing.length) throw new Error(`committed score tables missing: ${baseMissing.join(', ')}`);

  const reasonCounts = {};
  const gateCounts = {};
  const bySubject = {};
  const refused = [];
  const eligibleIds = new Set();
  const placementProblems = [];
  const typeDisagreements = [];
  const stored = new Map(entriesFile.entries ? Object.entries(entriesFile.entries) : []);
  for (const item of planned) {
    const { row, candidate, original } = item;
    const subject = candidate.subject;
    const verdict = engine.ntaEligibility({ ...row, evidence: null }, { subject, agentScores: agentTables, fitScores: fitTables });
    const s = (bySubject[subject] ||= { planned: 0, eligible: 0, ineligible: 0, reasons: {} });
    s.planned += 1;
    const batch = stored.get(candidate.id)?.batch ?? null;
    if (verdict.eligible) { s.eligible += 1; eligibleIds.add(candidate.id); } else {
      s.ineligible += 1;
      for (const reason of verdict.reasons) { reasonCounts[reason] = (reasonCounts[reason] || 0) + 1; s.reasons[reason] = (s.reasons[reason] || 0) + 1; }
      for (const gate of new Set(verdict.reasons.map(gateOf))) gateCounts[gate] = (gateCounts[gate] || 0) + 1;
      refused.push({ id: candidate.id, subject, batch, chapter: candidate.chapter, authored_type: original.type, engine_type: verdict.type, reasons: verdict.reasons, cause: explainRefusal(candidate, verdict.reasons), stem: text(candidate.stem).slice(0, 140) });
    }
    if (verdict.type !== original.type && !(original.set_id && verdict.type === 'passage_set_item')) typeDisagreements.push({ id: candidate.id, subject, authored_type: original.type, engine_type: verdict.type });
    // Placement as the engine does it (prepareCandidates): the fit judges' chapter first, the database chapter otherwise.
    const facts = blueprintFacts(lib, subject);
    const tags = fitTables[subject].questions[candidate.id];
    const fitChapter = tags?.chapter || null;
    const place = [fitChapter, candidate.chapter].filter(Boolean).find((chapter) => facts.excluded.has(chapter) || facts.chapterUnits.has(chapter));
    if (!place) placementProblems.push({ id: candidate.id, subject, problem: 'chapter_not_in_this_paper', db_chapter: candidate.chapter, fit_chapter: fitChapter });
    else if (facts.excluded.has(place)) placementProblems.push({ id: candidate.id, subject, problem: 'chapter_out_of_syllabus', chapter: place });
    if (fitChapter && fitChapter !== candidate.chapter) typeDisagreements.push({ id: candidate.id, subject, note: 'fit judges majority chapter differs from the authored chapter', authored_chapter: candidate.chapter, fit_chapter: fitChapter });
  }

  // Sets: wave-2 sets, plus the wave-1 set that wave 2 tops up. The engine serves a set only with an in-range passage and
  // at least the blueprint's minimum of eligible, distinct children (data/nta_engine.js prepareCandidates).
  const setIds = [...new Set(planned.filter((item) => item.candidate.type === 'passage_set_item').map((item) => item.candidate.set_id))];
  const w1Plan = wave1.length ? wave.planPublication(wave1) : { rows: [] };
  const passageSets = setIds.map((setId) => {
    const subject = planned.find((item) => item.candidate.set_id === setId).candidate.subject;
    const sets = engine.getNtaBlueprint(subject).sets;
    const newRows = planned.filter((item) => item.candidate.set_id === setId).map((item) => item.row);
    const oldRows = w1Plan.rows.filter((row) => row.passage_group_id === wave.passageGroupIdOf(setId));
    const eligibleOld = oldRows.filter((row) => engine.ntaEligibility({ ...row, evidence: null }, { subject, agentScores: agentTables, fitScores: fitTables }).eligible);
    const eligibleNew = newRows.filter((row) => eligibleIds.has(row.id));
    const kept = [];
    for (const row of [...eligibleOld, ...eligibleNew]) {
      const features = items.itemFeatures(row, { english: subject === 'english', agentScores: agentTables });
      if (!kept.some((other) => items.conflictReason(features, other.features, { sameSet: true }))) kept.push({ row, features });
    }
    const words = items.passageWordCount((newRows[0] || oldRows[0]));
    return {
      set_id: setId, subject, chapter: (newRows[0] || oldRows[0]).chapter, passage_words: words, passage_words_range: sets.passageWords || null, min_children: sets.size.min,
      wave1_children: oldRows.length, wave1_children_eligible: eligibleOld.length, wave2_children: newRows.length, wave2_children_eligible: eligibleNew.length, distinct_eligible_children: kept.length,
      blueprint_serves_sets: sets.count.target > 0,
      servable: (sets.count.target > 0) && (!sets.passageWords || (words >= sets.passageWords.min && words <= sets.passageWords.max)) && kept.length >= sets.size.min,
    };
  });

  const engineFile = path.join(args.root, 'data/nta_engine.js');
  const report = {
    kind: 'authored_w2_engine_check', label: args.label, source: W2_SOURCE, at: now,
    engine: { root: args.root, file: 'data/nta_engine.js', version: engine.NTA_ENGINE_VERSION, sha256: sha256(fs.readFileSync(engineFile)), mtime: fs.statSync(engineFile).mtime.toISOString(), minScore: engine.NTA_MIN_SCORE, minFit: engine.NTA_MIN_FIT_SCORE },
    method: 'ntaEligibility (quality gate with the agent scores, content gates, CUET-fit gate) on every accepted wave-2 question with the committed agent and fit tables of the named checkout plus the wave-2 entries merged in memory (policy admit). Nothing in data/ is written. Rows are mapped like the wave-1 publisher (toQuestionRow); case-set items typed single_mcq are mapped as passage children.',
    candidatesSha256: entriesFile.candidates_sha256,
    planned: planned.length, engineEligible: eligibleIds.size, engineIneligible: refused.length,
    engineIneligibleReasons: Object.fromEntries(Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])),
    ineligibleByGate: gateCounts,
    bySubject,
    passageSets,
    placementProblems,
    informational: { authoredTypeVersusEngineType: typeDisagreements },
    refused,
  };
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, names.engine(args.label));
  fs.writeFileSync(target, stableJson(report, 1));
  return { report, out: rel(target) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'accept') {
    const { acceptance, out } = await runAccept(args);
    console.log(JSON.stringify({ out, total: acceptance.total, bySubject: Object.fromEntries(Object.entries(acceptance.bySubject).map(([s, v]) => [s, { written: v.written, accepted: v.accepted, rejected: v.rejected, byReason: Object.fromEntries(Object.entries(v.rejectedByReason).filter(([, n]) => n)) }])), files: { ...acceptance.files, recordIssues: `${acceptance.files.recordIssues.length} (see the report)` } }, null, 1));
  } else if (args.mode === 'check') {
    const { report, out } = await runCheck(args);
    console.log(JSON.stringify({ out, engine: report.engine, planned: report.planned, engineEligible: report.engineEligible, engineIneligible: report.engineIneligible, reasons: report.engineIneligibleReasons, bySubject: Object.fromEntries(Object.entries(report.bySubject).map(([s, v]) => [s, { planned: v.planned, eligible: v.eligible, ineligible: v.ineligible }])), passageSets: report.passageSets, placementProblems: report.placementProblems.length }, null, 1));
  } else throw new Error(`unknown --mode=${args.mode}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error?.stack || error); process.exit(1); });
}
