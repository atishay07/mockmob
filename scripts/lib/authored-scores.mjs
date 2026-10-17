// Pure helpers for scripts/authored-scores-merge.mjs: the authored wave's raw judge files in, the engine's agent
// score entries (data/nta_agent_scores.js) and CUET-fit entries (data/nta_fit_scores.js) out.
// Files are read from disk where a loader says so; nothing here touches a database, the network or a model.
//
// The two score tables bind a score to a content hash (data/content_evidence.js contentHash of the live row).
// For the 341 questions the expert pass left as they were, and for the 78 repaired ones where only the
// difficulty label or the NCERT reference changed, the hash the judges scored IS the hash of the final text.
// For the 60 repaired ones whose stem, options or explanation changed, the judges scored the text before the
// repair. Those entries keep the judges' scores and record, per judge, the hash of the text that judge saw
// (`scored_content_hash`) and, per entry, the expert verdict and the blind re-solve on the final text
// (`provenance`). Which hash the engine is told to trust for them is an explicit choice (policy):
//   admit  content_hash = the final text's hash. The engine accepts them; the provenance says what was scored.
//   hold   content_hash = the pre-repair hash. The engine refuses them ("question_changed_since_scored")
//          until a fresh judge pass on the final text is merged (`--fresh`), which then admits them.
import fs from 'node:fs';
import path from 'node:path';
import { getNtaBlueprint, heuristicNtaType } from '../../data/nta_engine.js';
import { NTA_AGENT_BLOCKING_FLAGS, NTA_AGENT_RUBRIC_VERSION, ntaAgentAdmissibleIds } from '../../data/nta_agent_scores.js';
import { AUTHORED_SOURCE, contentHashOf, waveOf } from './authored-wave.mjs';

export const SCORES_VERSION = 'authored-scores-1';
export const QUALITY_JUDGES = Object.freeze(['j1', 'j2']);
export const FIT_JUDGES = Object.freeze(['h1', 'h2', 'h3']);
export const SOLVERS = Object.freeze(['s1', 's2', 's3', 's4', 's5']);
// Constants of data/nta_fit_scores.js, mirrored here so the builder does not depend on the committed tables it is
// writing. The tests compare them with the module.
export const FIT_RUBRIC_VERSION = 'nta-cuet-fit-rubric-1';
export const FIT_FLAGS = Object.freeze(['syllabus_not_entitled', 'not_cuet_format', 'off_pattern_for_subject', 'level_above_cbt', 'too_slow']);
export const NTA_MIN_FIT_SCORE = 8;
// Fields of the candidate text that the judges saw and that are part of a content hash or a question's identity.
export const TEXT_FIELDS = Object.freeze(['stem', 'options', 'correct_key', 'explanation', 'passage_text', 'chapter', 'subject', 'unit', 'type', 'set_id', 'difficulty_label', 'ncert_ref']);
// The subset that the content hash covers (body, options, key, explanation, passage, chapter, subject).
export const HASHED_FIELDS = Object.freeze(['stem', 'options', 'correct_key', 'explanation', 'passage_text', 'chapter', 'subject']);

const text = (value) => (value === null || value === undefined ? '' : String(value));
const BLOCKING = new Set(NTA_AGENT_BLOCKING_FLAGS);
const LEVELS = new Set(['easy', 'medium', 'hard']);
const ANSWERS = new Set(['A', 'B', 'C', 'D', '?']);
const TAG = /^[a-z0-9_]+\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+){1,5}$/;
const ROUTES = new Set(['pyq', 'board', 'cbt_staple', 'key_aspect']);
// data/nta-fit-merge.mjs: every type of the rubric's table is a valid cuet_type, whatever the subject's own list says.
const RUBRIC_TYPES = ['passage_set_item', 'assertion_reason', 'match_the_following', 'sentence_rearrangement', 'sequence_ordering', 'statement_based', 'synonym', 'antonym', 'idiom_phrase', 'one_word_substitution', 'error_detection', 'fill_in_blank', 'single_mcq'];
const SKILLS = new Set(['central_idea', 'detail', 'not_mentioned', 'inference', 'tone_attitude', 'vocabulary_in_context', 'title', 'application', 'calculation', 'other']);
const FLAG_ALIASES = { off_pattern_for_paper: 'off_pattern_for_subject' };
const int = (value, lo, hi) => Number.isInteger(value) && value >= lo && value <= hi;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const readJson = (file, fallback = null) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };

// ---------------------------------------------------------------------------------------------
// Reading the raw files (tmp/authored/<subject>/verify, tmp/authored/<subject>/<batch>.json, tmp/authored/expert)
// ---------------------------------------------------------------------------------------------

function walk(dir) {
  const files = [];
  const visit = (current) => {
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full); else files.push(full);
    }
  };
  visit(dir);
  return files.sort();
}

/** { role -> Map(id -> { batch, file, result }) } for every `<batch>__<role>.json` result file below the directories. */
export function scanResults(dirs, { all = false } = {}) {
  const byRole = {};
  const files = [];
  for (const file of [].concat(dirs).flatMap((dir) => walk(dir))) {
    const match = path.basename(file).match(/^(.+)__(j1|j2|h1|h2|h3|s[1-5])\.json$/);
    if (!match) continue;
    const results = readJson(file);
    if (!Array.isArray(results)) { files.push({ file, problem: 'not a JSON array' }); continue; }
    const [, batch, role] = match;
    byRole[role] = byRole[role] || new Map();
    // all: keep every result of an id (a fresh pass can hold several batches that judged different wordings of it); otherwise the last one wins.
    for (const result of results) {
      if (!result?.id) continue;
      if (all) byRole[role].set(result.id, [...(byRole[role].get(result.id) || []), { batch, file, result }]);
      else byRole[role].set(result.id, { batch, file, result });
    }
  }
  return { byRole, invalidFiles: files };
}

/** The authored text of every question in the batch files (what the judges were given), by id. */
export function loadBatchTexts(rawDir) {
  const texts = new Map();
  for (const subject of fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : []) {
    const subjectDir = path.join(rawDir, subject);
    if (!fs.existsSync(subjectDir) || !fs.statSync(subjectDir).isDirectory() || subject === 'expert') continue;
    for (const file of fs.readdirSync(subjectDir).filter((name) => /^[a-z_]+__[a-z]\d+\.json$/.test(name))) {
      const batch = readJson(path.join(subjectDir, file));
      for (const question of batch?.questions || []) texts.set(question.id, { batch: file.replace(/\.json$/, ''), question });
    }
  }
  return texts;
}

/** Expert verdicts ({ verdict, issue }) and the blind re-solves of the repaired text ({ answers }), by id. */
export function loadExpertFiles(rawDir) {
  const dir = path.join(rawDir, 'expert');
  const verdicts = new Map();
  const resolves = new Map();
  if (!fs.existsSync(dir)) return { verdicts, resolves };
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('__verdict.json')) {
      for (const entry of readJson(path.join(dir, file), [])) verdicts.set(entry.id, { verdict: entry.verdict, issue: text(entry.issue), question: entry.question || null, file });
    }
    const solve = file.match(/^(rv-\d+)__(s\d)\.json$/);
    if (solve) {
      for (const result of readJson(path.join(dir, file), [])) {
        if (!resolves.has(result.id)) resolves.set(result.id, []);
        resolves.get(result.id).push({ solver: solve[2], batch: solve[1], answer: text(result.answer).toUpperCase() });
      }
    }
  }
  return { verdicts, resolves };
}

// ---------------------------------------------------------------------------------------------
// Validation of one judge's result (the same rules as scripts/nta-pass-merge.mjs and scripts/nta-fit-merge.mjs)
// ---------------------------------------------------------------------------------------------

export function qualityProblems(result, id) {
  const problems = [];
  if (!result || typeof result !== 'object') return ['not an object'];
  if (result.id !== id) problems.push('id');
  if (!ANSWERS.has(text(result.blind_answer).toUpperCase())) problems.push('blind_answer');
  if (typeof result.key_matches !== 'boolean') problems.push('key_matches');
  if (!int(result.quality_score, 0, 10)) problems.push('quality_score');
  if (!LEVELS.has(result.difficulty_check)) problems.push('difficulty_check');
  if (typeof result.objective_tag !== 'string' || !result.objective_tag) problems.push('objective_tag');
  if (!Array.isArray(result.flags)) problems.push('flags');
  return problems;
}

/** The allowed-values card the fit judges were given for a subject (units, chapters, types), from the blueprint. */
export function allowedCard(subject) {
  const blueprint = getNtaBlueprint(subject);
  const units = new Map();
  for (const variant of blueprint.variants) for (const section of variant.sections) for (const unit of section.units) {
    if (!units.has(unit.name)) units.set(unit.name, []);
    for (const chapter of unit.chapters) if (!units.get(unit.name).includes(chapter.name)) units.get(unit.name).push(chapter.name);
  }
  const quotaTypes = Object.keys(blueprint.typeQuotas).filter((type) => blueprint.typeQuotas[type].max > 0);
  return {
    types: [...quotaTypes, 'passage_set_item'],
    units: [...units.entries()].map(([unit, chapters]) => ({ unit, chapters })),
    excluded_chapters: (blueprint.excludedChapters || []).map((entry) => entry.name),
  };
}

/** One fit judge's result: { value } with the fields the fit table keeps, or { problems }. */
export function fitCheck(result, id, card, otherFlagCounts = {}) {
  const problems = [];
  if (!result || typeof result !== 'object') return { problems: ['not an object'] };
  if (result.id !== id) problems.push('id');
  const types = new Set([...(card?.types || []), ...RUBRIC_TYPES]);
  if (!types.has(result.cuet_type)) problems.push('cuet_type');
  const chapters = new Set([...(card?.units || []).flatMap((unit) => unit.chapters), ...(card?.excluded_chapters || [])]);
  if (!chapters.has(result.chapter)) problems.push('chapter');
  if (result.unit !== null && !(card?.units || []).some((unit) => unit.unit === result.unit)) problems.push('unit');
  if (!int(result.pyq_closeness, 0, 3)) problems.push('pyq_closeness');
  let routeResult = result;
  if (result.ten_route === false || result.ten_route === '') routeResult = { ...result, ten_route: null };
  if (routeResult.ten_route !== null && !ROUTES.has(routeResult.ten_route)) problems.push('ten_route');
  if (!int(result.fit_score, 0, 10)) problems.push('fit_score');
  if (!Array.isArray(result.fit_flags)) problems.push('fit_flags');
  if (problems.length) return { problems };
  const named = result.fit_flags.map((flag) => FLAG_ALIASES[String(flag)] || String(flag));
  const fitFlags = [...new Set(named.filter((flag) => FIT_FLAGS.includes(flag)))];
  const otherFlags = [...new Set(named.filter((flag) => !FIT_FLAGS.includes(flag)))];
  for (const flag of otherFlags) otherFlagCounts[flag] = (otherFlagCounts[flag] || 0) + 1;
  return {
    value: {
      cuet_type: result.cuet_type,
      passage_skill: SKILLS.has(result.passage_skill) ? result.passage_skill : null,
      unit: result.unit,
      chapter: result.chapter,
      pyq_closeness: result.pyq_closeness,
      ten_route: routeResult.ten_route,
      est_seconds: Number.isFinite(result.est_seconds) ? result.est_seconds : null,
      fit_score: result.fit_score,
      fit_flags: fitFlags,
      ...(otherFlags.length ? { other_flags: otherFlags } : {}),
      note: text(result.note).slice(0, 200),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Step 1: build the entries (raw judge files -> one record per question, independent of the table policy)
// ---------------------------------------------------------------------------------------------

const textOf = (candidate) => Object.fromEntries(TEXT_FIELDS.map((field) => [field, candidate[field] ?? null]));

/** The fields of the pre-repair (judged) text that differ from the final text, or {} when none do. */
export function preRepairDiff(judged, final) {
  const diff = {};
  for (const field of TEXT_FIELDS) if (!same(judged[field] ?? null, final[field] ?? null)) diff[field] = judged[field] ?? null;
  return diff;
}

// Fresh judge passes: a directory of result files `<batch>__j1|j2|h1|h2|h3|s1-s5.json` next to the batch text files `<batch>.json`
// the judges were given. A fresh result is used only where its batch text is the candidate's text (the hashed fields), so a pass
// that judged an older wording never speaks for a later one. Results on other text are counted as stale and ignored.
export function scanFresh(dirs) {
  return [].concat(dirs).map((dir) => {
    const scan = scanResults(dir, { all: true });
    const texts = new Map();
    for (const file of walk(dir)) {
      if (!file.endsWith('.json') || /__(j1|j2|h1|h2|h3|s[1-5])\.json$/.test(file)) continue;
      const batch = readJson(file);
      if (!Array.isArray(batch?.questions)) continue;
      texts.set(path.basename(file).replace(/\.json$/, ''), new Map(batch.questions.map((question) => [question.id, question])));
    }
    return { ...scan, texts };
  });
}

/** Whether two candidates (or a candidate and a batch question) have the same hashed text: stem, options, key, explanation, passage, chapter, subject. */
export function sameHashedText(a, b) {
  return HASHED_FIELDS.every((field) => same(a?.[field] ?? null, b?.[field] ?? null));
}

const median3 = (values) => values.slice().sort((x, y) => x - y)[1];

/**
 * Why a question's records fail the wave's acceptance rule (AUTHORED-QUESTIONS-WAVE1: at least 4 of 5 blind solvers on the key,
 * both quality judges at 7 or more with no flag and the key as their blind answer, fit median 8 or more, fewer than two fit flags).
 * Solver evidence is, in order: fresh solvers on the final text (4 of 5), the blind re-solve of the repaired final text (2 of 3),
 * the original solvers where the text is the one they solved (4 of 5). Empty when the question passes.
 */
export function acceptanceReasons(record, candidate) {
  const reasons = [];
  for (const judge of record.quality) {
    if (judge.quality_score < 7) reasons.push(`${judge.judge}_quality_${judge.quality_score}`);
    if (judge.flags.length) reasons.push(`${judge.judge}_flags_${judge.flags.join('+')}`);
    if (judge.blind_answer !== candidate.correct_key) reasons.push(`${judge.judge}_blind_answer_${judge.blind_answer}`);
  }
  const fit = median3(record.fit.map((judge) => judge.fit_score));
  if (fit < NTA_MIN_FIT_SCORE) reasons.push(`fit_median_${fit}`);
  if (record.fit.filter((judge) => judge.fit_flags.length).length >= 2) reasons.push('fit_flagged_by_two');
  const solvers = record.blind_solvers;
  const resolve = record.blind_resolve_on_final_text;
  if (solvers.on === 'final') { if (solvers.matched_key < 4) reasons.push(`solvers_${solvers.matched_key}_of_${solvers.n}`); }
  else if (resolve) { if (resolve.matched_key < 2) reasons.push(`resolve_${resolve.matched_key}_of_${resolve.n}`); }
  else if (record.text.pre_repair) reasons.push('no_blind_solver_evidence_on_final_text');
  else if (solvers.matched_key < 4) reasons.push(`solvers_${solvers.matched_key}_of_${solvers.n}`);
  return reasons;
}

/**
 * Builds the per-question records. Options: { rawDir, freshDirs, originals, models: { quality, fit, solver }, date }.
 * originals is an optional Map(id -> the wave-1 candidate) so a reworded question records what was reworded.
 * Returns { entries, problems, counts }. A question missing a judge, whose result fails validation, or that fails the
 * acceptance rule is a problem and gets no entry: the caller refuses to write anything while problems remain.
 */
export function buildEntries(candidates, { rawDir, freshDirs = [], originals = null, models, date }) {
  // The original results live in <rawDir>/<subject>/verify; <rawDir>/expert holds the repaired-text re-solves (not the original solvers).
  const verifyDirs = (fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : []).filter((name) => name !== 'expert').map((name) => path.join(rawDir, name, 'verify'));
  const base = scanResults(verifyDirs);
  const fresh = scanFresh(freshDirs);
  const texts = loadBatchTexts(rawDir);
  const { verdicts, resolves } = loadExpertFiles(rawDir);
  const problems = base.invalidFiles.concat(...fresh.map((scan) => scan.invalidFiles)).map((entry) => ({ id: null, ...entry }));
  const otherFlagCounts = {};
  const entries = {};
  const cards = new Map();
  const stale = new Set();
  for (const candidate of candidates) {
    const id = candidate.id;
    const add = (problem) => problems.push({ id, problem });
    // A fresh result (judged on the final text) replaces the original result of its role; one on other text is ignored (and counted).
    for (const scan of fresh) {
      for (const results of Object.values(scan.byRole)) {
        for (const found of results.get(id) || []) if (!sameHashedText(scan.texts.get(found.batch)?.get(id), candidate)) stale.add(`${found.file}|${id}`);
      }
    }
    const pick = (role) => {
      for (const scan of fresh.slice().reverse()) {
        for (const found of scan.byRole[role]?.get(id) || []) {
          if (sameHashedText(scan.texts.get(found.batch)?.get(id), candidate)) return { ...found, fresh: true };
        }
      }
      return base.byRole[role]?.has(id) ? { ...base.byRole[role].get(id), fresh: false } : null;
    };
    const judged = texts.get(id);
    const finalText = textOf(candidate);
    const originalText = judged ? textOf(judged.question) : null;
    const expert = verdicts.get(id);
    if (!judged) add('no_batch_text_found');
    if (!expert) add('no_expert_verdict_found');
    else if (expert.verdict !== candidate._verdict) add(`expert_verdict_${expert.verdict}_but_candidate_marked_${candidate._verdict}`);

    const quality = QUALITY_JUDGES.map((role) => ({ role, found: pick(role) }));
    const fitSet = FIT_JUDGES.map((role) => ({ role, found: pick(role) }));
    const missing = [...quality, ...fitSet].filter((entry) => !entry.found).map((entry) => entry.role);
    if (missing.length) { add(`missing_judge_results:${missing.join(',')}`); continue; }

    if (!cards.has(candidate.subject)) cards.set(candidate.subject, allowedCard(candidate.subject));
    const qualityRecords = [];
    for (const { role, found } of quality) {
      const bad = qualityProblems(found.result, id);
      if (bad.length) { add(`invalid_${role}_result:${bad.join(',')}`); continue; }
      const result = found.result;
      qualityRecords.push({
        judge: role, quality_score: result.quality_score, blind_answer: text(result.blind_answer).toUpperCase(), key_matches: result.key_matches,
        difficulty_check: result.difficulty_check, objective_tag: result.objective_tag.trim(), flags: result.flags.map(String), note: text(result.note).slice(0, 240),
        on_final_text: found.fresh || null, batch: found.batch,
      });
    }
    const fitRecords = [];
    for (const { role, found } of fitSet) {
      const { value, problems: bad } = fitCheck(found.result, id, cards.get(candidate.subject), otherFlagCounts);
      if (!value) { add(`invalid_${role}_result:${bad.join(',')}`); continue; }
      fitRecords.push({ judge: role, ...value, on_final_text: found.fresh || null, batch: found.batch });
    }
    if (qualityRecords.length !== QUALITY_JUDGES.length || fitRecords.length !== FIT_JUDGES.length) continue;

    // The text the judges saw: the batch file's, unless a fresh pass judged the final text.
    const allFresh = [...quality, ...fitSet].every((entry) => entry.found.fresh);
    const someFresh = [...quality, ...fitSet].some((entry) => entry.found.fresh);
    if (someFresh && !allFresh) add('fresh_pass_covers_only_some_judges');
    const diff = judged && !allFresh ? preRepairDiff(originalText, finalText) : {};
    if (candidate._verdict === 'ready' && Object.keys(diff).length && !allFresh) add(`ready_but_text_differs_from_judged_text:${Object.keys(diff).join(',')}`);

    // Solvers: fresh ones judged the final text; the original ones solved the text as authored.
    const freshSolvers = SOLVERS.map((role) => pick(role)).filter((found) => found?.fresh);
    const solverFound = freshSolvers.length ? freshSolvers : SOLVERS.map((role) => pick(role)).filter(Boolean);
    const matches = solverFound.filter((found) => text(found.result.answer).toUpperCase() === candidate.correct_key).length;
    // The expert's blind re-solve covered the text the expert returned; it speaks for the final text only if that is still the final text.
    const resolve = resolves.get(id) || [];
    const resolveSummary = resolve.length ? { n: resolve.length, matched_key: resolve.filter((entry) => entry.answer === candidate.correct_key).length, answers: resolve.map((entry) => entry.answer) } : null;
    const expertReviewedFinal = expert?.question ? sameHashedText(expert.question, candidate) : null;
    const original = originals?.get(id);
    const rewordedFields = original ? Object.keys(preRepairDiff(textOf(original), finalText)) : [];
    const engineReasons = fresh.map((scan) => [...scan.texts.values()].map((batch) => batch.get(id)?._engine_reasons).find(Boolean)).find(Boolean) || null;
    const record = {
      subject: candidate.subject,
      batch: judged?.batch || quality[0].found.batch,
      chapter: candidate.chapter,
      set_id: candidate.set_id || null,
      text: {
        expert_verdict: expert?.verdict ?? null,
        expert_issue: expert?.issue || null,
        expert_reviewed_text: expertReviewedFinal === false ? 'earlier_text' : 'final',
        judged: allFresh ? 'final' : 'as_authored',
        // Present only when the judged text is not the final text: the pre-repair values of the fields that were repaired.
        pre_repair: Object.keys(diff).length ? diff : null,
        ...(rewordedFields.length ? { reworded_after_wave1: rewordedFields, reworded_engine_reasons: engineReasons } : {}),
      },
      blind_solvers: { n: solverFound.length, matched_key: matches, answers: solverFound.map((found) => text(found.result.answer).toUpperCase()), on: freshSolvers.length ? 'final' : 'as_authored' },
      blind_resolve_on_final_text: expertReviewedFinal === false ? null : resolveSummary,
      ...(expertReviewedFinal === false && resolveSummary ? { blind_resolve_on_earlier_text: resolveSummary } : {}),
      quality: qualityRecords,
      fit: fitRecords,
    };
    const rejected = acceptanceReasons(record, candidate);
    if (rejected.length) { add(`fails_acceptance:${rejected.join(',')}`); continue; }
    entries[id] = record;
  }
  const counts = {
    candidates: candidates.length,
    entries: Object.keys(entries).length,
    problems: problems.length,
    repaired: Object.values(entries).filter((entry) => entry.text.expert_verdict === 'repaired').length,
    judgedTextDiffers: Object.values(entries).filter((entry) => entry.text.pre_repair).length,
    judgedOnFinalTextByFreshPass: Object.values(entries).filter((entry) => entry.text.judged === 'final').length,
    rewordedAfterWave1: Object.values(entries).filter((entry) => entry.text.reworded_after_wave1).length,
    staleFreshResultsIgnored: stale.size,
    otherFitFlags: otherFlagCounts,
  };
  return { entries, problems, counts };
}

// ---------------------------------------------------------------------------------------------
// Step 2: table entries (policy applied, content hashes bound to the final rows)
// ---------------------------------------------------------------------------------------------

/** The overlay that turns the final candidate into the text the judges saw (null when it is the final text). */
function overlayFrom(record) {
  return record.text.pre_repair ? { ...record.text.pre_repair } : null;
}

/**
 * The hashes of one question: the final text's, the judged text's, and whether the repair changed the hashed content.
 * groupId and orderIndex keep passage children's hash the same as the bank's row.
 */
export function hashesOf(candidate, record, position) {
  const finalHash = contentHashOf(candidate, position);
  const overlay = overlayFrom(record);
  const judgedHash = overlay ? contentHashOf(candidate, { ...position, overlay }) : finalHash;
  return { finalHash, judgedHash, hashChanged: finalHash !== judgedHash };
}

const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const majority = (values) => {
  const counts = new Map();
  for (const value of values) if (value !== null && value !== undefined && value !== '') counts.set(value, (counts.get(value) || 0) + 1);
  let best = null;
  for (const [value, n] of counts) if (n >= 2 && (!best || n > best[1])) best = [value, n];
  return best ? best[0] : null;
};
const votes = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(String(value), (map.get(String(value)) || 0) + 1), new Map())]);

// What the pipeline of each wave was, as the provenance of an entry states it.
export const PIPELINE_TEXT = Object.freeze({
  1: 'author, 5 blind solvers, 2 quality judges, 3 CUET-fit judges, expert pass over all accepted items, blind re-solve of every repaired item; fresh judges (and solvers, for reworded items) on the final text where it changed afterwards',
  2: 'author, 5 blind solvers, 2 quality judges, 3 CUET-fit judges, expert pass over the accepted items (repairs applied in place), independent spot-check of 60 accepted items, blind re-solve by 3 solvers of every repaired item whose solver-visible text changed (an item without it is held back, not published); fresh judges and solvers on the final text for the questions the engine refused and that were reworded afterwards',
  3: 'author, blind check of every draft (haiku_blind_verified), a stronger audit of 107 of the 294 drafts that solved them itself (opus_audited) with 28 rows repaired before scoring; then 5 blind solvers, 2 quality judges and 3 CUET-fit judges on the text as authored; then one expert review of every accepted question (ready, repaired or dropped; repairs applied to the text), a blind re-solve by 3 solvers of every repair that changed the text a solver sees, and a full fresh pass (5 solvers, 2 quality judges, 3 CUET-fit judges) on the questions the engine refused that the expert repair reworded; published only where the two quality judges average 8 or more and the fit median is 8 or more',
});

// Waves 1 and 2 keep their literal batch prefix (their tables are committed with it); wave 3 names its own run.
const batchPrefixOf = (candidate) => (waveOf(candidate).wave === 3 ? 'authored-2026-10-17-w3__' : 'authored-2026-10-14__');

function provenanceOf(record, hashes, policy, header, candidate = null) {
  const wave = waveOf(candidate);
  const acceptance = !hashes.hashChanged ? 'judged_text_is_final_text'
    : policy === 'hold' ? 'held_until_fresh_judge_pass_on_final_text'
      // Wave 2: a repair that left the blind text alone (explanation, label, NCERT reference) is admitted on the expert verdict; the blind solvers saw the final blind text.
      : wave.wave >= 2 && !record.blind_resolve_on_final_text ? 'admitted_on_expert_verdict_blind_text_unchanged'
        : 'admitted_on_expert_verdict_and_blind_resolve';
  return {
    kind: wave.source,
    wave: wave.wave,
    pipeline: PIPELINE_TEXT[wave.wave],
    expert_verdict: record.text.expert_verdict,
    expert_issue: record.text.expert_issue,
    // Wave 3 only: the check the draft had before scoring (haiku_blind_verified or opus_audited); waves 1 and 2 have an expert verdict instead.
    ...(record.text.authoring_verdict ? { authoring_verdict: record.text.authoring_verdict } : {}),
    ...(record.text.audit_repaired ? { audit_repaired: true } : {}),
    // final: the expert reviewed the final text; earlier_text: the question was reworded after the expert pass (engine content gate) and
    // only the fresh judges and solvers below have seen the reworded text.
    expert_reviewed_text: record.text.expert_reviewed_text,
    ...(record.text.reworded_after_wave1 ? { reworded_after_wave1: record.text.reworded_after_wave1, reworded_engine_reasons: record.text.reworded_engine_reasons } : {}),
    ...(record.text.reworded_after_acceptance ? { reworded_after_acceptance: record.text.reworded_after_acceptance, reworded_engine_reasons: record.text.reworded_engine_reasons } : {}),
    ...(record.text.spot_check ? { spot_check: record.text.spot_check } : {}),
    // Wave 3: the fields the expert's repair changed, and a judge's blind answer carried from the pre-repair key to the repaired key (only where the re-solvers confirmed it).
    ...(record.text.expert_repaired_fields ? { expert_repaired_fields: record.text.expert_repaired_fields } : {}),
    ...(record.text.judge_blind_answer_carried_over ? { judge_blind_answer_carried_over: record.text.judge_blind_answer_carried_over } : {}),
    ...(record.text.supplementary_review ? { supplementary_review: record.text.supplementary_review } : {}),
    // final: the judges scored the hashed content as it stands now (a repair that touched only the difficulty label or the NCERT
    // reference leaves the hashed content alone); pre_repair: they scored the text before the expert's repair;
    // final_after_fresh_pass: a later judge pass re-scored the repaired text.
    judged_text: record.text.judged === 'final' ? 'final_after_fresh_pass' : (hashes.hashChanged ? 'pre_repair' : 'final'),
    judged_content_hash: hashes.judgedHash,
    final_content_hash: hashes.finalHash,
    hash_changed_by_repair: hashes.hashChanged,
    repaired_fields: record.text.pre_repair ? Object.keys(record.text.pre_repair) : [],
    blind_solvers: record.blind_solvers,
    blind_resolve_on_final_text: record.blind_resolve_on_final_text,
    ...(record.blind_resolve_on_earlier_text ? { blind_resolve_on_earlier_text: record.blind_resolve_on_earlier_text } : {}),
    engine_acceptance: acceptance,
    repaired_text_policy: policy,
    models: header.models,
  };
}

/** One question's entry for data/nta_agent_scores/<subject>.json (the format scripts/nta-pass-merge.mjs writes, plus provenance). */
export function agentEntryFor(id, candidate, record, { policy, header, position = {} }) {
  const hashes = hashesOf(candidate, record, position);
  const key = candidate.correct_key;
  const judges = record.quality.map((judge) => ({
    judge: judge.judge, model: header.models.quality, date: header.date,
    quality_score: judge.quality_score, blind_answer: judge.blind_answer, key_matches: judge.blind_answer === key,
    difficulty_check: judge.difficulty_check, objective_tag: judge.objective_tag, flags: judge.flags, note: judge.note,
    scored_content_hash: judge.on_final_text ? hashes.finalHash : hashes.judgedHash,
  }));
  const scores = judges.map((judge) => judge.quality_score);
  const matches = judges.filter((judge) => judge.blind_answer === key).length;
  const flags = [...new Set(judges.flatMap((judge) => judge.flags))];
  const levels = judges.map((judge) => judge.difficulty_check);
  const agreedLevel = levels.length === 2 && levels[0] === levels[1] ? levels[0] : null;
  const tags = judges.map((judge) => judge.objective_tag);
  const wellFormed = tags.filter((tag) => TAG.test(tag));
  const tag = wellFormed.length === 2 && wellFormed[0] === wellFormed[1] ? wellFormed[0] : null;
  const useFinal = !hashes.hashChanged || policy === 'admit' || record.text.judged === 'final';
  return {
    question_id: id,
    batch: `${batchPrefixOf(candidate)}${record.batch}`,
    chapter: candidate.chapter,
    key,
    content_hash: useFinal ? hashes.finalHash : hashes.judgedHash,
    judges,
    mean: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    min: Math.min(...scores),
    spread: Math.abs(scores[0] - scores[1]),
    key_agreement: matches === 2 ? 'both' : matches === 1 ? 'one' : 'none',
    blind_answers_agree: judges[0].blind_answer === judges[1].blind_answer,
    flags,
    blocking: flags.some((flag) => BLOCKING.has(flag)),
    unknown_flags: flags.filter((flag) => !BLOCKING.has(flag)),
    objective_tag: tag,
    tag_agreement: tags[0] === tags[1],
    difficulty: { label: candidate.difficulty_label, judges: levels, agreed: agreedLevel, corrected: null },
    objective_tags: tags,
    key_dispute: matches < 2,
    provenance: provenanceOf(record, hashes, policy, header, candidate),
  };
}

/** One question's entry for data/nta_fit_scores/<subject>.json (the format scripts/nta-fit-merge.mjs writes, plus provenance). */
export function fitEntryFor(id, candidate, record, { policy, header, position = {}, engineTypeGuess = null }) {
  const hashes = hashesOf(candidate, record, position);
  const judges = record.fit.map(({ on_final_text: onFinal, batch: _batch, ...judge }) => ({
    ...judge, model: header.models.fit, date: header.date,
    scored_content_hash: onFinal ? hashes.finalHash : hashes.judgedHash,
  }));
  // Field order of the committed fit tables: judge, model, date first.
  const ordered = judges.map(({ judge, model, date, ...rest }) => ({ judge, model, date, ...rest }));
  const pick = (key) => ordered.map((judge) => judge[key]);
  const type = majority(pick('cuet_type'));
  const unit = majority(pick('unit'));
  const chapter = majority(pick('chapter'));
  const scores = pick('fit_score');
  const route = majority(pick('ten_route'));
  const rawMedian = median(scores);
  const flagCounts = {};
  for (const judge of ordered) for (const flag of judge.fit_flags) flagCounts[flag] = (flagCounts[flag] || 0) + 1;
  const flaggedBy = ordered.filter((judge) => judge.fit_flags.length).length;
  const useFinal = !hashes.hashChanged || policy === 'admit' || record.text.judged === 'final';
  return {
    question_id: id,
    batch: `${batchPrefixOf(candidate)}${record.batch}`,
    db_chapter: candidate.chapter,
    content_hash: useFinal ? hashes.finalHash : hashes.judgedHash,
    engine_type_guess: engineTypeGuess,
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
    provenance: provenanceOf(record, hashes, policy, header, candidate),
  };
}

// ---------------------------------------------------------------------------------------------
// Step 3: merging into the committed tables (incremental: every other question's entry is left exactly as it is)
// ---------------------------------------------------------------------------------------------

const isAuthored = (entry, source = AUTHORED_SOURCE) => entry?.provenance?.kind === source;
const clone = (value) => JSON.parse(JSON.stringify(value));

function addEntries(table, entries, label, source = AUTHORED_SOURCE) {
  const questions = table.questions || {};
  for (const id of Object.keys(entries)) {
    if (questions[id] && !isAuthored(questions[id], source)) throw new Error(`${label}: ${id} already has an entry that is not from ${source}; refusing to replace it`);
  }
  // Existing keys keep their position; new ones are appended in id order, so a re-run produces the same file.
  const result = { ...questions };
  for (const id of Object.keys(entries).sort()) result[id] = entries[id];
  return result;
}

/**
 * The agent table of a subject with the authored entries added. base is the committed table (it must be calibrated
 * and written under the rubric version this code accepts: an entry in any other table could never admit a question).
 */
export function mergeAgentTable(base, entries, { subject, now, header, policy, rubricSha256 = null, source = AUTHORED_SOURCE }) {
  if (!base) throw new Error(`agent table for ${subject} is missing`);
  if (base.rubric_version !== NTA_AGENT_RUBRIC_VERSION) throw new Error(`agent table for ${subject} is written under ${base.rubric_version}, not ${NTA_AGENT_RUBRIC_VERSION}`);
  const table = clone(base);
  table.questions = addEntries(table, entries, `agent table ${subject}`, source);
  table.models = [...new Set([...(table.models || []), header.models.quality])].sort();
  table.merged_at = now;
  table.authored = {
    ...(table.authored || {}),
    [source]: {
      note: waveOf(source).wave === 3
        ? 'Entries with provenance.kind = this key were written by scripts/authored-scores-merge.mjs from the wave-3 entries (docs/brain/reports/authored-w3/wave3-score-entries-2026-10-17.json, built by scripts/authored-w2-accept.mjs --wave=w3 from the raw judge files). Per-question provenance says which text each judge scored.'
        : waveOf(source).wave === 2
        ? 'Entries with provenance.kind = this key were written by scripts/authored-scores-merge.mjs from the final wave-2 entries (docs/brain/reports/authored-w2/wave2-score-entries-final-2026-10-14.json, built by scripts/authored-w2-accept.mjs --mode=final from the raw judge files). Per-question provenance says which text each judge scored.'
        : 'Entries with provenance.kind = this key were written by scripts/authored-scores-merge.mjs from the raw judge files of the authored wave (see docs/brain/AUTHORED-QUESTIONS-WAVE1-2026-10-14.md). Per-question provenance says which text each judge scored.',
      merged_at: now,
      questions: Object.keys(entries).length,
      judge_model: header.models.quality,
      judge_date: header.date,
      repaired_text_policy: policy,
      held_for_fresh_judge_pass: Object.values(entries).filter((entry) => entry.provenance.engine_acceptance.startsWith('held')).length,
      judged_text_differs_from_final: Object.values(entries).filter((entry) => entry.provenance.hash_changed_by_repair).length,
      rubric: 'docs/brain/NTA-AGENT-RUBRIC.md',
      rubric_sha256: rubricSha256,
    },
  };
  table.measures = { ...(table.measures || {}), admissible_before_row_checks: ntaAgentAdmissibleIds(subject, { agentScores: { [subject]: table } }).length };
  return table;
}

/**
 * The fit table of a subject with the authored entries added. base may be null (this checkout has no fit tables
 * yet): the table then holds only the authored entries and says so (status partial).
 */
export function mergeFitTable(base, entries, { subject, now, header, policy, rubricSha256 = null, source = AUTHORED_SOURCE }) {
  const table = base ? clone(base) : {
    note: 'CUET-fit judgements for NTA mode (data/nta_fit_scores.js). Written by scripts/nta-fit-merge.mjs from three independent judges per question under docs/brain/NTA-CUET-FIT-RUBRIC.md. Majority (2 of 3) type, unit and chapter override the engine\'s heuristic; NTA mode admits a question only when all three judged the current content, fewer than two raised a fit flag and the median fit score is at or above NTA_MIN_FIT_SCORE. A judge-dependent label, not evidence.',
    subject,
    rubric_version: FIT_RUBRIC_VERSION,
    rubric: 'docs/brain/NTA-CUET-FIT-RUBRIC.md',
    rubric_sha256: rubricSha256,
    merged_at: null,
    models: [],
    status: 'partial',
    measures: {},
    questions: {},
  };
  if (table.rubric_version !== FIT_RUBRIC_VERSION) throw new Error(`fit table for ${subject} is written under ${table.rubric_version}, not ${FIT_RUBRIC_VERSION}`);
  table.questions = addEntries(table, entries, `fit table ${subject}`, source);
  table.models = [...new Set([...(table.models || []), header.models.fit])].sort();
  table.merged_at = now;
  table.authored = {
    ...(table.authored || {}),
    [source]: {
      note: waveOf(source).wave === 3
        ? 'Entries with provenance.kind = this key were written by scripts/authored-scores-merge.mjs from the wave-3 entries (built by scripts/authored-w2-accept.mjs --wave=w3). The measures block above describes the base merge only.'
        : waveOf(source).wave === 2
        ? 'Entries with provenance.kind = this key were written by scripts/authored-scores-merge.mjs from the final wave-2 entries (built by scripts/authored-w2-accept.mjs --mode=final). The measures block above describes the base merge only.'
        : 'Entries with provenance.kind = this key were written by scripts/authored-scores-merge.mjs from the raw judge files of the authored wave. The measures block above describes the base merge only.',
      merged_at: now,
      questions: Object.keys(entries).length,
      judge_model: header.models.fit,
      judge_date: header.date,
      repaired_text_policy: policy,
      held_for_fresh_judge_pass: Object.values(entries).filter((entry) => entry.provenance.engine_acceptance.startsWith('held')).length,
      fit_pass_at_8: Object.values(entries).filter((entry) => entry.fit_median !== null && entry.fit_median >= NTA_MIN_FIT_SCORE && !entry.blocking).length,
      fit_pass_at_9: Object.values(entries).filter((entry) => entry.fit_median !== null && entry.fit_median >= 9 && !entry.blocking).length,
      tens_capped_without_agreed_route: Object.values(entries).filter((entry) => entry.fit_median_raw === 10 && !entry.ten_route).length,
      rubric_sha256: rubricSha256,
    },
  };
  return table;
}

/**
 * A mirror of the fit gate in data/nta_fit_scores.js (ntaFitGateReasons plus the content-hash check of ntaFitVerdict):
 * three judges with provenance, fewer than two flagging, the median at the bar, the judged content is the row's. The
 * check also runs the real gate (through ntaEligibility); the tests compare this mirror with the module.
 */
export function fitGateReasons(entry, currentHash, { minFit = NTA_MIN_FIT_SCORE, table = null } = {}) {
  if (!entry) return ['fit_not_judged'];
  const reasons = [];
  if (table && table.rubric_version !== FIT_RUBRIC_VERSION) reasons.push('fit_rubric_outdated');
  const judges = Array.isArray(entry.judges) ? entry.judges : [];
  const valid = judges.filter((judge) => Number.isInteger(Number(judge?.fit_score)) && text(judge?.judge) && text(judge?.model) && text(judge?.date));
  if (valid.length < 3 || new Set(valid.map((judge) => text(judge.judge))).size < 3) reasons.push('fit_needs_three_judges');
  const flaggedBy = judges.filter((judge) => Array.isArray(judge?.fit_flags) && judge.fit_flags.length).length;
  if (flaggedBy >= 2 || entry.blocking === true) reasons.push('fit_flagged');
  const stored = Number(entry.fit_median);
  const scores = judges.map((judge) => Number(judge?.fit_score)).filter((score) => Number.isInteger(score) && score >= 0 && score <= 10).sort((a, b) => a - b);
  const median = entry.fit_median !== null && entry.fit_median !== undefined && Number.isFinite(stored) ? stored : (scores.length === 3 ? scores[1] : null);
  if (median === null || median < minFit) reasons.push('fit_below_bar');
  if (!entry.content_hash || entry.content_hash !== currentHash) reasons.push('fit_question_changed');
  return [...new Set(reasons)];
}

/** Where each question of a plan sits (passage group id and 1-based order) so hashes match the bank's rows. */
export function positionsOf(rows) {
  return new Map(rows.map((row) => [row.id, { groupId: row.passage_group_id || null, orderIndex: row.order_index ?? null }]));
}

// engine_type_guess is the engine's own guess from the text (heuristicNtaType), as in the fit tables the CUET-fit pass
// wrote. classifyNtaType would return the judges' stored type once the entry is in the committed tables, so a second
// merge would write a different guess.
export function engineTypeOf(candidate, row) {
  const blueprint = getNtaBlueprint(candidate.subject);
  return heuristicNtaType(row, candidate.subject, blueprint ? Object.keys(blueprint.typeQuotas) : undefined);
}
