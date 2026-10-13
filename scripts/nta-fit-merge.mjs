// NTA CUET-fit pass: merges the three fit judges' result files into the committed fit tables.
// OFFLINE: reads tmp/nta-pass/fit (built by tmp/nta-pass/fit/build/build-fit.mjs and scored by the judges
// under docs/brain/NTA-CUET-FIT-RUBRIC.md) and writes only data/nta_fit_scores/<subject>.json.
// No database, no network, no model. Sibling of scripts/nta-pass-merge.mjs (the quality pass).
//
//   node scripts/nta-fit-merge.mjs [--dir tmp/nta-pass/fit] [--hashes tmp/nta-pass/hashes.json] [--out data]
//                                  [--model claude-haiku-5-5]
//
// Inputs (under --dir):
//   batches/*.json, calibration/*.json   the batch files the judges scored
//   results/<batch>__h1|h2|h3.json       one JSON array per judge per batch (rubric section 9)
//   judges.json (optional)               { h1: { model, date }, h2: {...}, h3: {...} }
// Per question it records (data/nta_fit_scores.js reads these):
//   - the three judges' cuet_type, unit, chapter, pyq_closeness, ten_route, fit_score, fit_flags, note;
//   - the majority (2 of 3) cuet_type, passage_skill, unit and chapter, or null with the votes when
//     there is no majority;
//   - pyq_closeness: the median of the judges';
//   - fit_scores and fit_median; a 10 stands only when two judges name the same ten_route
//     (CALIBRATION.md: Haiku claim a route about four times as often as the reference), else 9;
//   - flagged_by: how many judges raised any fit flag; blocking when 2 or more did;
//   - the content hash the judges saw (tmp/nta-pass/hashes.json) and the engine's own type guess.
// A question whose result is missing or invalid for a judge keeps the judges it has; the engine needs
// all three (data/nta_fit_scores.js), so such a question stays out of NTA mode until it is re-judged.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const { CUET_PUBLIC_ALLOWED_SUBJECTS, toPublicSubjectId } = await import('../data/cuet_controls.js');
const { NTA_FIT_RUBRIC_VERSION, NTA_FIT_JUDGES, NTA_FIT_FLAGS, NTA_MIN_FIT_SCORE, ntaFitGateReasons } = await import('../data/nta_fit_scores.js');

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const dir = path.resolve(arg('dir', 'tmp/nta-pass/fit'));
const hashesFile = path.resolve(arg('hashes', 'tmp/nta-pass/hashes.json'));
const DATA = path.resolve(arg('out', 'data'));
const defaultModel = arg('model', 'claude-haiku-5-5');
const RUBRIC = 'docs/brain/NTA-CUET-FIT-RUBRIC.md';

const readJson = (file, fallback = null) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const listJson = (sub) => { try { return fs.readdirSync(path.join(dir, sub)).filter((f) => f.endsWith('.json')).sort(); } catch { return []; } };
const text = (value) => (value === null || value === undefined ? '' : String(value));
const FLAGS = new Set(NTA_FIT_FLAGS);
const ROUTES = new Set(['pyq', 'board', 'cbt_staple', 'key_aspect']);
const SKILLS = new Set(['central_idea', 'detail', 'not_mentioned', 'inference', 'tone_attitude', 'vocabulary_in_context', 'title', 'application', 'calculation', 'other']);
const int = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi;

const rubricSha = fs.existsSync(RUBRIC) ? createHash('sha256').update(fs.readFileSync(RUBRIC)).digest('hex') : null;
const hashes = readJson(hashesFile, {});
const judgesInfo = readJson(path.join(dir, 'judges.json'), {});

// ---- batches (scoring batches win over calibration batches for an id in both) ----
const batches = new Map(); // name -> { kind, allowed, questions }
for (const [sub, kind] of [['batches', 'scoring'], ['calibration', 'calibration']]) {
  for (const file of listJson(sub)) {
    const batch = readJson(path.join(dir, sub, file));
    if (!Array.isArray(batch?.questions)) continue;
    batches.set(file.replace(/\.json$/, ''), { kind, allowed: batch.allowed || {}, questions: batch.questions });
  }
}

// One judge's result for one question: the fields the merge keeps, or the list of problems.
function check(result, question, allowed) {
  const problems = [];
  if (!result || typeof result !== 'object') return { problems: ['not an object'] };
  if (result.id !== question.id) problems.push('id');
  const card = allowed?.[question.subject];
  const types = new Set([...(card?.types || []), 'single_mcq', 'assertion_reason']);
  if (!types.has(result.cuet_type)) problems.push('cuet_type');
  const chapters = new Set([...(card?.units || []).flatMap((unit) => unit.chapters), ...(card?.excluded_chapters || [])]);
  if (!chapters.has(result.chapter)) problems.push('chapter');
  if (result.unit !== null && !(card?.units || []).some((unit) => unit.unit === result.unit)) problems.push('unit');
  if (!int(result.pyq_closeness, 0, 3)) problems.push('pyq_closeness');
  if (result.ten_route !== null && !ROUTES.has(result.ten_route)) problems.push('ten_route');
  if (!int(result.fit_score, 0, 10)) problems.push('fit_score');
  if (!Array.isArray(result.fit_flags) || result.fit_flags.some((flag) => !FLAGS.has(flag))) problems.push('fit_flags');
  if (problems.length) return { problems };
  return {
    value: {
      cuet_type: result.cuet_type,
      passage_skill: SKILLS.has(result.passage_skill) ? result.passage_skill : null,
      unit: result.unit,
      chapter: result.chapter,
      pyq_closeness: result.pyq_closeness,
      ten_route: result.ten_route,
      est_seconds: Number.isFinite(result.est_seconds) ? result.est_seconds : null,
      fit_score: result.fit_score,
      fit_flags: [...new Set(result.fit_flags.map(String))],
      note: text(result.note).slice(0, 200),
    },
  };
}

const judged = new Map(); // id -> { question, batch, kind, results: [] }
const missing = [];
const invalidFiles = [];
const invalidResults = [];
const resultFiles = new Set(listJson('results'));
const usedFiles = new Set();
for (const [name, batch] of batches) {
  for (const judge of NTA_FIT_JUDGES) {
    const file = `${name}__${judge}.json`;
    if (!resultFiles.has(file)) { missing.push(file); continue; }
    usedFiles.add(file);
    const results = readJson(path.join(dir, 'results', file));
    if (!Array.isArray(results)) { invalidFiles.push({ file, problem: 'not a JSON array' }); continue; }
    const byId = new Map(results.map((result) => [result?.id, result]));
    const info = judgesInfo[judge] || {};
    const date = text(info.date) || fs.statSync(path.join(dir, 'results', file)).mtime.toISOString().slice(0, 10);
    for (const question of batch.questions) {
      const existing = judged.get(question.id);
      if (existing && existing.kind === 'scoring' && batch.kind === 'calibration') continue;
      if (existing && existing.batch !== name) judged.delete(question.id);
      const { value, problems } = check(byId.get(question.id), question, batch.allowed);
      if (!value) { invalidResults.push({ file, id: question.id, problems }); continue; }
      if (!judged.has(question.id)) judged.set(question.id, { question, batch: name, kind: batch.kind, results: [] });
      judged.get(question.id).results.push({ judge, model: text(info.model) || defaultModel, date, ...value });
    }
  }
}
const orphans = [...resultFiles].filter((file) => /__h[123]\.json$/.test(file) && !usedFiles.has(file));

// ---- per question ----
function majority(values) {
  const counts = new Map();
  for (const value of values) if (value !== null && value !== undefined && value !== '') counts.set(value, (counts.get(value) || 0) + 1);
  let best = null;
  for (const [value, n] of counts) if (n >= 2 && (!best || n > best[1])) best = [value, n];
  return best ? best[0] : null;
}
const votes = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(String(value), (map.get(String(value)) || 0) + 1), new Map())]);
function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function entryFor(id, { question, batch, results }) {
  const ordered = results.slice().sort((a, b) => a.judge.localeCompare(b.judge));
  const pick = (key) => ordered.map((result) => result[key]);
  const type = majority(pick('cuet_type'));
  const unit = majority(pick('unit'));
  const chapter = majority(pick('chapter'));
  const scores = pick('fit_score');
  const route = majority(pick('ten_route'));
  const rawMedian = median(scores);
  const flagCounts = {};
  for (const result of ordered) for (const flag of result.fit_flags) flagCounts[flag] = (flagCounts[flag] || 0) + 1;
  const flaggedBy = ordered.filter((result) => result.fit_flags.length).length;
  return {
    question_id: id,
    batch,
    db_chapter: question.chapter ?? null,
    content_hash: hashes[id]?.content_hash || null,
    engine_type_guess: question.engine_type_guess ?? null,
    judges: ordered,
    cuet_type: type,
    cuet_type_votes: type ? null : votes(pick('cuet_type')),
    passage_skill: majority(pick('passage_skill')),
    unit,
    unit_votes: unit ? null : votes(pick('unit')),
    chapter,
    chapter_votes: chapter ? null : votes(pick('chapter')),
    pyq_closeness: median(pick('pyq_closeness')),
    ten_route: route,
    fit_scores: scores,
    fit_median: rawMedian === 10 && !route ? 9 : rawMedian,
    fit_median_raw: rawMedian,
    fit_flags: flagCounts,
    flagged_by: flaggedBy,
    blocking: flaggedBy >= 2,
  };
}

const tables = {};
const summary = [];
for (const subject of CUET_PUBLIC_ALLOWED_SUBJECTS) {
  const questions = {};
  const batchNames = [...batches].filter(([, batch]) => batch.kind === 'scoring' && batch.questions.some((q) => toPublicSubjectId(text(q.subject)) === subject)).map(([name]) => name);
  for (const [id, record] of judged) {
    if (toPublicSubjectId(text(record.question.subject)) !== subject) continue;
    questions[id] = entryFor(id, record);
  }
  const entries = Object.values(questions);
  const three = entries.filter((entry) => entry.judges.length === 3);
  const inBatches = [...batches.values()].filter((batch) => batch.kind === 'scoring').flatMap((batch) => batch.questions)
    .filter((q) => toPublicSubjectId(text(q.subject)) === subject).length;
  const passAt = (bar) => entries.filter((entry) => !ntaFitGateReasons(entry, { minFit: bar }).length).length;
  const disagree = three.filter((entry) => entry.cuet_type && entry.engine_type_guess && entry.engine_type_guess !== entry.cuet_type).length;
  const withType = three.filter((entry) => entry.cuet_type).length;
  const missingForSubject = missing.filter((file) => batchNames.some((name) => file.startsWith(`${name}__`)));
  const table = {
    note: 'CUET-fit judgements for NTA mode (data/nta_fit_scores.js). Written by scripts/nta-fit-merge.mjs from three independent judges per question under docs/brain/NTA-CUET-FIT-RUBRIC.md. Majority (2 of 3) type, unit and chapter override the engine\'s heuristic; NTA mode admits a question only when all three judged the current content, fewer than two raised a fit flag and the median fit score is at or above NTA_MIN_FIT_SCORE. A judge-dependent label, not evidence.',
    subject,
    rubric_version: NTA_FIT_RUBRIC_VERSION,
    rubric: RUBRIC,
    rubric_sha256: rubricSha,
    merged_at: entries.length ? new Date().toISOString() : null,
    models: [...new Set(entries.flatMap((entry) => entry.judges.map((judge) => judge.model)))].sort(),
    status: !inBatches ? 'empty' : missingForSubject.length || three.length < inBatches ? 'partial' : 'complete',
    measures: {
      questions_in_fit_batches: inBatches,
      judged: entries.length,
      judged_by_three: three.length,
      missing_result_files: missingForSubject.length,
      fit_pass_at_8: passAt(8),
      fit_pass_at_9: passAt(9),
      blocking_flagged: entries.filter((entry) => entry.blocking).length,
      majority_type: withType,
      no_majority_type: three.length - withType,
      engine_type_disagrees_with_majority: disagree,
      engine_type_disagreement_pct: withType ? Math.round((disagree / withType) * 1000) / 10 : null,
      no_majority_chapter: three.filter((entry) => !entry.chapter).length,
      ten_route_agreed: three.filter((entry) => entry.ten_route).length,
      tens_capped_without_agreed_route: three.filter((entry) => entry.fit_median_raw === 10 && !entry.ten_route).length,
    },
    questions,
  };
  tables[subject] = table;
  summary.push({ subject, status: table.status, ...table.measures });
}

// ---- write ----
fs.mkdirSync(path.join(DATA, 'nta_fit_scores'), { recursive: true });
for (const [subject, table] of Object.entries(tables)) {
  fs.writeFileSync(path.join(DATA, 'nta_fit_scores', `${subject}.json`), `${JSON.stringify(table, null, 1)}\n`);
}

console.log(JSON.stringify({
  dir: path.relative(process.cwd(), dir) || dir,
  bar: NTA_MIN_FIT_SCORE,
  batches: batches.size,
  resultFiles: resultFiles.size,
  missing: missing.length,
  missingSample: missing.slice(0, 5),
  invalidFiles,
  invalidResults: invalidResults.length,
  invalidSample: invalidResults.slice(0, 5),
  orphans,
  questionsJudged: judged.size,
  perSubject: summary,
}, null, 1));
