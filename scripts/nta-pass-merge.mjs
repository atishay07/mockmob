// NTA agent pass: merges the two judges' result files into the committed agent score tables.
// OFFLINE: reads tmp/nta-pass (written by scripts/nta-pass-export.mjs and the judges) and writes only
// data/ files. No database, no network, no model.
//
//   node scripts/nta-pass-merge.mjs [--dir tmp/nta-pass] [--calibration <file>] [--judges <file>] [--out data]
//
// Inputs (all under --dir unless given):
//   batches/*.json, calibration/*.json    the batch files the judges scored (rubric docs/brain/NTA-AGENT-RUBRIC.md)
//   results/<batch>__<judge>.json         j1/j2 for scoring batches, cal-j1/cal-j2 for calibration batches
//   hashes.json                           { [id]: { subject, content_hash, key } } from the export
//   judges.json                           { j1: { model, date }, j2: {...}, cal-j1: {...}, cal-j2: {...} }
//   calibration.json                      { status: 'calibrated', threshold, owner_bar, model, measures, source }
//                                         written after the calibration comparison; absent = pending, and
//                                         then no agent score admits anything (data/nta_agent_scores.js)
// Outputs:
//   data/nta_agent_scores/<subject>.json  per question: both judges (score, blind answer, key match,
//                                         difficulty, tag, flags, note, model, date), mean, agreement;
//                                         per subject: rubric version and hash, calibration, measures
//   data/nta_key_disputes.json            every question where a judge's blind answer differs from the key
//                                         (scoring and calibration passes); entries under "resolved" stay out
//   data/nta_objectives.json              agent_questions: one objective tag per judged question
//   data/nta_difficulty.json              corrections where both judges agree on a level other than the label
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const { CUET_PUBLIC_ALLOWED_SUBJECTS, toPublicSubjectId } = await import('../data/cuet_controls.js');
const { NTA_AGENT_RUBRIC_VERSION, NTA_AGENT_OWNER_BAR, NTA_AGENT_BLOCKING_FLAGS, ntaAgentAdmissibleIds } = await import('../data/nta_agent_scores.js');

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const dir = path.resolve(arg('dir', 'tmp/nta-pass'));
const calibrationFile = path.resolve(arg('calibration', path.join(dir, 'calibration.json')));
const judgesFile = path.resolve(arg('judges', path.join(dir, 'judges.json')));
const RUBRIC = 'docs/brain/NTA-AGENT-RUBRIC.md';
const DATA = path.resolve(arg('out', 'data'));

const readJson = (file, fallback = null) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const listJson = (sub) => { try { return fs.readdirSync(path.join(dir, sub)).filter((f) => f.endsWith('.json')).sort(); } catch { return []; } };
const text = (value) => (value === null || value === undefined ? '' : String(value));
const today = new Date().toISOString().slice(0, 10);
const BLOCKING = new Set(NTA_AGENT_BLOCKING_FLAGS);
const KNOWN_FLAGS = BLOCKING;
const LEVELS = new Set(['easy', 'medium', 'hard']);
const ANSWERS = new Set(['A', 'B', 'C', 'D', '?']);
const TAG = /^[a-z0-9_]+\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+){1,5}$/;

const rubricSha = fs.existsSync(RUBRIC) ? createHash('sha256').update(fs.readFileSync(RUBRIC)).digest('hex') : null;
const calibrationInput = readJson(calibrationFile);
const calibration = calibrationInput?.status === 'calibrated' && Number.isFinite(Number(calibrationInput.threshold))
  ? { status: 'calibrated', threshold: Number(calibrationInput.threshold), owner_bar: Number(calibrationInput.owner_bar ?? NTA_AGENT_OWNER_BAR), model: calibrationInput.model ?? null, date: calibrationInput.date ?? null, source: calibrationInput.source ?? null, measures: calibrationInput.measures ?? null }
  : { status: 'pending', threshold: null, owner_bar: NTA_AGENT_OWNER_BAR, model: null, date: null, source: null, measures: null, why: calibrationInput ? 'calibration.json has no calibrated threshold' : `no calibration decision at ${path.relative(process.cwd(), calibrationFile)}` };
const judgesInfo = readJson(judgesFile, {});
const hashes = readJson(path.join(dir, 'hashes.json'), {});

// ---- batches ----
const batches = new Map(); // name -> { kind, subject, questions }
for (const [sub, kind] of [['batches', 'scoring'], ['calibration', 'calibration']]) {
  for (const file of listJson(sub)) {
    const batch = readJson(path.join(dir, sub, file));
    if (!batch?.questions) continue;
    batches.set(file.replace(/\.json$/, ''), { kind, subject: batch.subject, questions: batch.questions });
  }
}

// ---- results ----
const missing = [];
const invalid = [];
const orphans = [];
const judged = new Map(); // id -> { question, results: [] }   (scoring pass)
const calJudged = new Map(); // id -> { question, results: [] } (calibration pass)
const resultFiles = listJson('results');
const seenResultFiles = new Set();

function validate(result, question) {
  const problems = [];
  if (!result || typeof result !== 'object') return ['not an object'];
  if (result.id !== question.id) problems.push('id');
  if (!ANSWERS.has(text(result.blind_answer).toUpperCase())) problems.push('blind_answer');
  if (typeof result.key_matches !== 'boolean') problems.push('key_matches');
  if (!Number.isInteger(result.quality_score) || result.quality_score < 0 || result.quality_score > 10) problems.push('quality_score');
  if (!LEVELS.has(result.difficulty_check)) problems.push('difficulty_check');
  if (typeof result.objective_tag !== 'string' || !result.objective_tag) problems.push('objective_tag');
  if (!Array.isArray(result.flags)) problems.push('flags');
  return problems;
}

for (const [name, batch] of batches) {
  const judges = batch.kind === 'scoring' ? ['j1', 'j2'] : ['cal-j1', 'cal-j2'];
  for (const judge of judges) {
    const file = `${name}__${judge}.json`;
    if (!resultFiles.includes(file)) { missing.push(file); continue; }
    seenResultFiles.add(file);
    const results = readJson(path.join(dir, 'results', file));
    if (!Array.isArray(results)) { invalid.push({ file, problem: 'not a JSON array' }); continue; }
    const byId = new Map(results.map((result) => [result?.id, result]));
    const ids = batch.questions.map((q) => q.id);
    if (results.length !== ids.length || ids.some((id) => !byId.has(id))) { invalid.push({ file, problem: `ids do not match the batch (${results.length} results, ${ids.length} questions)` }); continue; }
    const bad = [];
    for (const question of batch.questions) {
      const problems = validate(byId.get(question.id), question);
      if (problems.length) bad.push(`${question.id}: ${problems.join(', ')}`);
    }
    if (bad.length) { invalid.push({ file, problem: `invalid fields in ${bad.length} results`, detail: bad.slice(0, 5) }); continue; }
    const info = judgesInfo[judge] || {};
    const date = text(info.date) || fs.statSync(path.join(dir, 'results', file)).mtime.toISOString().slice(0, 10);
    const target = batch.kind === 'scoring' ? judged : calJudged;
    for (const question of batch.questions) {
      const result = byId.get(question.id);
      if (!target.has(question.id)) target.set(question.id, { question, batch: name, results: [] });
      target.get(question.id).results.push({
        judge, model: text(info.model) || null, date, batch: name,
        quality_score: result.quality_score,
        blind_answer: text(result.blind_answer).toUpperCase(),
        key_matches: result.key_matches,
        difficulty_check: result.difficulty_check,
        objective_tag: result.objective_tag.trim(),
        flags: result.flags.map(String),
        unknown_flags: result.flags.map(String).filter((flag) => !KNOWN_FLAGS.has(flag)),
        note: text(result.note).slice(0, 240),
      });
    }
  }
}
for (const file of resultFiles) if (!seenResultFiles.has(file)) orphans.push(file);

// ---- helpers ----
const publicSubject = (subject) => toPublicSubjectId(text(subject));
const keyOf = (question) => text(hashes[question.id]?.key || question.correct_key).toUpperCase();
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? Math.round((sxy / Math.sqrt(sxx * syy)) * 1000) / 1000 : null;
}
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const round2 = (value) => (value === null ? null : Math.round(value * 100) / 100);

// ---- key disputes (scoring and calibration passes) ----
const disputesPath = path.join(DATA, 'nta_key_disputes.json');
const previousDisputes = readJson(disputesPath, {});
const resolved = previousDisputes.resolved || {};
const disputes = {};
function addDisputes(map, pass) {
  for (const [id, { question, results }] of map) {
    const key = keyOf(question);
    const off = results.filter((result) => result.blind_answer !== key);
    if (!off.length) continue;
    const hash = hashes[id]?.content_hash || null;
    if (resolved[id] && resolved[id].content_hash && resolved[id].content_hash === hash) continue;
    const entry = disputes[id] || {
      subject: publicSubject(question.subject), chapter: question.chapter ?? null, key, content_hash: hash,
      since: today, judges: [], source: 'scripts/nta-pass-merge.mjs',
    };
    for (const result of results) {
      entry.judges.push({ pass, judge: result.judge, model: result.model, blind_answer: result.blind_answer, flags: result.flags, note: result.note });
    }
    entry.reason = entry.judges.some((judge) => judge.flags.includes('wrong_key')) ? 'judge_flagged_wrong_key'
      : entry.judges.filter((judge) => judge.blind_answer !== key).length >= 2 ? 'both_blind_answers_differ' : 'one_blind_answer_differs';
    disputes[id] = entry;
  }
}
addDisputes(judged, 'scoring');
addDisputes(calJudged, 'calibration');

// ---- objective tags: agreed, else the spelling used more often in the subject, else j1 ----
const tagUse = new Map();
for (const { results } of judged.values()) for (const result of results) tagUse.set(result.objective_tag, (tagUse.get(result.objective_tag) || 0) + 1);
function chooseTag(results) {
  const tags = results.map((result) => result.objective_tag).filter((tag) => TAG.test(tag));
  if (!tags.length) return null;
  if (tags.every((tag) => tag === tags[0])) return tags[0];
  return tags.slice().sort((a, b) => (tagUse.get(b) || 0) - (tagUse.get(a) || 0))[0];
}

// ---- per subject tables ----
const tables = {};
const difficulty = {};
const agentObjectives = {};
const summary = [];
for (const subject of CUET_PUBLIC_ALLOWED_SUBJECTS) {
  const questions = {};
  const pairs = [];
  let oneJudge = 0;
  let keyBoth = 0; let keyOne = 0; let keyNone = 0; let blindAgree = 0; let tagAgree = 0; let diffAgree = 0; let blocking = 0;
  const flagCounts = {};
  const models = new Set();
  for (const [id, { question, results }] of judged) {
    if (publicSubject(question.subject) !== subject) continue;
    const key = keyOf(question);
    const ordered = results.slice().sort((a, b) => a.judge.localeCompare(b.judge));
    for (const result of ordered) if (result.model) models.add(result.model);
    const scores = ordered.map((result) => result.quality_score);
    const matches = ordered.filter((result) => result.blind_answer === key).length;
    const flags = [...new Set(ordered.flatMap((result) => result.flags))];
    for (const flag of flags) flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    const isBlocking = flags.some((flag) => BLOCKING.has(flag));
    if (isBlocking) blocking += 1;
    const levels = ordered.map((result) => result.difficulty_check);
    const label = text(question.difficulty_label).toLowerCase() || null;
    const agreedLevel = levels.length === 2 && levels[0] === levels[1] ? levels[0] : null;
    const tag = chooseTag(ordered);
    if (ordered.length === 2) {
      pairs.push(scores);
      if (matches === 2) keyBoth += 1; else if (matches === 1) keyOne += 1; else keyNone += 1;
      if (ordered[0].blind_answer === ordered[1].blind_answer) blindAgree += 1;
      if (ordered[0].objective_tag === ordered[1].objective_tag) tagAgree += 1;
      if (agreedLevel) diffAgree += 1;
    } else oneJudge += 1;
    if (tag) agentObjectives[id] = tag;
    if (agreedLevel && label && LEVELS.has(label) && agreedLevel !== label) {
      difficulty[id] = { subject, from: label, to: agreedLevel, source: `agent pass ${today}, both judges` };
    }
    questions[id] = {
      question_id: id,
      batch: results[0].batch,
      chapter: question.chapter ?? null,
      key,
      content_hash: hashes[id]?.content_hash || null,
      judges: ordered.map(({ unknown_flags: _u, batch: _b, ...result }) => result),
      mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      min: scores.length ? Math.min(...scores) : null,
      spread: scores.length === 2 ? Math.abs(scores[0] - scores[1]) : null,
      key_agreement: ordered.length < 2 ? 'one_judge' : matches === 2 ? 'both' : matches === 1 ? 'one' : 'none',
      blind_answers_agree: ordered.length === 2 ? ordered[0].blind_answer === ordered[1].blind_answer : null,
      flags,
      blocking: isBlocking,
      unknown_flags: [...new Set(ordered.flatMap((result) => result.unknown_flags))],
      objective_tag: tag,
      tag_agreement: ordered.length === 2 ? ordered[0].objective_tag === ordered[1].objective_tag : null,
      difficulty: { label, judges: levels, agreed: agreedLevel, corrected: difficulty[id]?.to ?? null },
      key_dispute: Boolean(disputes[id]),
    };
  }
  const n = pairs.length;
  const diffs = pairs.map(([a, b]) => Math.abs(a - b));
  const measures = {
    judged_by_both: n,
    judged_by_one: oneJudge,
    score_mean_abs_diff: n ? round2(diffs.reduce((a, b) => a + b, 0) / n) : null,
    score_exact_agreement_pct: pct(diffs.filter((d) => d === 0).length, n),
    score_within_1_pct: pct(diffs.filter((d) => d <= 1).length, n),
    score_pearson_r: pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1])),
    key_both_match: keyBoth,
    key_one_match: keyOne,
    key_none_match: keyNone,
    blind_answers_agree_pct: pct(blindAgree, n),
    tag_agreement_pct: pct(tagAgree, n),
    difficulty_agreement_pct: pct(diffAgree, n),
    blocking_flagged: blocking,
    flags: flagCounts,
    mean_of_means: n ? round2(pairs.reduce((sum, [a, b]) => sum + (a + b) / 2, 0) / n) : null,
  };
  const table = {
    note: 'Agent scores for NTA mode (data/nta_agent_scores.js). Written by scripts/nta-pass-merge.mjs from two independent judges per question under docs/brain/NTA-AGENT-RUBRIC.md. A judge-dependent label, not evidence: it admits a question only while the table is calibrated, both judges are at or above the calibrated threshold, both blind answers equal the key, neither judge raised a blocking flag, and the question content still has the scored hash. Factory evidence, where present, always takes precedence.',
    subject,
    rubric_version: NTA_AGENT_RUBRIC_VERSION,
    rubric_sha256: rubricSha,
    merged_at: Object.keys(questions).length ? new Date().toISOString() : null,
    models: [...models].sort(),
    calibration,
    measures,
    questions,
  };
  table.measures.admissible_before_row_checks = ntaAgentAdmissibleIds(subject, { agentScores: { [subject]: table } }).length;
  tables[subject] = table;
  summary.push({ subject, judged: Object.keys(questions).length, both: n, admissible: table.measures.admissible_before_row_checks, disputes: Object.values(disputes).filter((d) => d.subject === subject).length, corrections: Object.values(difficulty).filter((d) => d.subject === subject).length });
}

// ---- write ----
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;
fs.mkdirSync(path.join(DATA, 'nta_agent_scores'), { recursive: true });
for (const [subject, table] of Object.entries(tables)) fs.writeFileSync(path.join(DATA, 'nta_agent_scores', `${subject}.json`), stable(table));

fs.writeFileSync(disputesPath, stable({
  note: previousDisputes.note,
  version: Object.keys(disputes).length ? `agent-pass-${today}` : 'none',
  resolved,
  questions: Object.fromEntries(Object.entries(disputes).sort(([a], [b]) => a.localeCompare(b))),
}));

const objectivesPath = path.join(DATA, 'nta_objectives.json');
const objectives = readJson(objectivesPath, { questions: {} });
objectives.agent_questions = Object.fromEntries(Object.entries(agentObjectives).sort(([a], [b]) => a.localeCompare(b)));
objectives.agent_note = 'agent_questions: one tag per question from the agent pass (scripts/nta-pass-merge.mjs; the tag both judges gave, else the spelling used more often in the subject). Hand-assigned tags in questions take precedence.';
objectives.agent_version = Object.keys(agentObjectives).length ? `agent-pass-${today}` : 'none';
fs.writeFileSync(objectivesPath, stable(objectives));

const difficultyPath = path.join(DATA, 'nta_difficulty.json');
const difficultyFile = readJson(difficultyPath, {});
fs.writeFileSync(difficultyPath, stable({
  note: difficultyFile.note,
  version: Object.keys(difficulty).length ? `agent-pass-${today}` : 'none',
  questions: Object.fromEntries(Object.entries(difficulty).sort(([a], [b]) => a.localeCompare(b))),
}));

console.log(JSON.stringify({
  dir: path.relative(process.cwd(), dir) || dir,
  batches: batches.size,
  resultFiles: resultFiles.length,
  missing: missing.length,
  missingFiles: missing,
  invalid,
  orphans,
  calibration: calibration.status === 'calibrated' ? `calibrated, threshold ${calibration.threshold}` : `pending (${calibration.why})`,
  questionsJudged: judged.size,
  keyDisputes: Object.keys(disputes).length,
  difficultyCorrections: Object.keys(difficulty).length,
  objectiveTags: Object.keys(agentObjectives).length,
  perSubject: summary,
}, null, 1));
