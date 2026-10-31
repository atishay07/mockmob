// CUET-fit judgements for NTA mode. Three independent judges read each question that passed the
// quality pass and judged how well it fits the real CUET paper (docs/brain/NTA-CUET-FIT-RUBRIC.md):
// its CUET item type, unit and chapter, closeness to a PYQ, and a fit score 0-10.
// scripts/nta-fit-merge.mjs merges their result files into data/nta_fit_scores/<subject>.json.
// Nothing here calls a model or a database.
//
// Owner, 13 Oct 2026: a question can be a really good question and still not be right for NTA mode
// "because it is not exactly according to the exam pattern"; NTA mode wants 9 or 10 questions; a 10
// is a PYQ with minor changes, a board question, a question that tests a key aspect of a chapter, or a
// CBT staple, not an extremely hard one. So NTA eligibility needs the quality gate (nta_engine.js)
// AND this fit gate:
//  - all three judges judged the question, and its content is the content they saw;
//  - fewer than two judges raised a fit flag (rubric section 8; a flag from 2 of 3 blocks);
//  - the median fit score is at or above NTA_MIN_FIT_SCORE.
// Anything missing fails closed. The majority (2 of 3) type, unit and chapter are the question's
// stored tags: the engine uses them before its own heuristic (data/nta_engine.js classifyNtaType).
import { contentHashMatch, contentHashMatches } from './content_evidence.js';
import english from './nta_fit_scores/english.json' with { type: 'json' };
import generalTest from './nta_fit_scores/general_test.json' with { type: 'json' };
import accountancy from './nta_fit_scores/accountancy.json' with { type: 'json' };
import businessStudies from './nta_fit_scores/business_studies.json' with { type: 'json' };
import economics from './nta_fit_scores/economics.json' with { type: 'json' };
import mathematics from './nta_fit_scores/mathematics.json' with { type: 'json' };
import physics from './nta_fit_scores/physics.json' with { type: 'json' };
import chemistry from './nta_fit_scores/chemistry.json' with { type: 'json' };
import biology from './nta_fit_scores/biology.json' with { type: 'json' };
import history from './nta_fit_scores/history.json' with { type: 'json' };
import politicalScience from './nta_fit_scores/political_science.json' with { type: 'json' };
import geography from './nta_fit_scores/geography.json' with { type: 'json' };
import psychology from './nta_fit_scores/psychology.json' with { type: 'json' };
import sociology from './nta_fit_scores/sociology.json' with { type: 'json' };
import computerScience from './nta_fit_scores/computer_science.json' with { type: 'json' };

// The rubric version the tables must be written under. Bump it when the rubric's scale, flags or result
// format change, and re-run the pass: old judgements then stop admitting questions.
export const NTA_FIT_RUBRIC_VERSION = 'nta-cuet-fit-rubric-1';
// The fit bar: the median of the three judges' fit scores must be at or above this. The owner asked for
// 9 or 10; 8 is the starting bar while the bank is thin (reports show the yield at 8 and at 9).
export const NTA_MIN_FIT_SCORE = 8;
// The three judges every question needs.
export const NTA_FIT_JUDGES = Object.freeze(['h1', 'h2', 'h3']);
// Rubric section 8. Two judges raising any of these keep the question out at any score.
export const NTA_FIT_FLAGS = Object.freeze(['syllabus_not_entitled', 'not_cuet_format', 'off_pattern_for_subject', 'level_above_cbt', 'too_slow']);

const FILE_TABLES = Object.freeze({
  english, general_test: generalTest, accountancy, business_studies: businessStudies, economics,
  mathematics, physics, chemistry, biology, history, political_science: politicalScience,
  geography, psychology, sociology, computer_science: computerScience,
});

const text = (value) => (value === null || value === undefined ? '' : String(value));

function indexTables(tables) {
  const byId = new Map();
  for (const [subject, table] of Object.entries(tables || {})) {
    for (const [id, entry] of Object.entries(table?.questions || {})) byId.set(id, { subject, table, entry });
  }
  return byId;
}

const FILE_INDEX = indexTables(FILE_TABLES);
let defaultTables = null; // set by useNtaFitTables (tests and offline reports only)
const lookupCache = new WeakMap();

function lookup(tables) {
  const source = tables || defaultTables;
  if (!source) return FILE_INDEX;
  if (typeof source.get === 'function') return source; // a live Map(id -> { subject, table, entry })
  if (!lookupCache.has(source)) lookupCache.set(source, indexTables(source));
  return lookupCache.get(source);
}

/**
 * Replaces the committed tables for every later lookup that does not pass its own fitScores, or
 * restores them with null. For tests and offline reports; the website never calls it. Accepts
 * { [subject]: table } or a Map(id -> { subject, table, entry }) that the caller keeps filling.
 */
export function useNtaFitTables(tables) {
  defaultTables = tables || null;
}

export function ntaFitTable(subject, tables = FILE_TABLES) {
  return tables?.[text(subject) === 'gat' ? 'general_test' : text(subject)] || null;
}

/** { subject, table, entry } for a question id, or null when no fit judge saw it. */
export function ntaFitEntry(id, { fitScores } = {}) {
  return lookup(fitScores).get(text(id)) || null;
}

function judgeScores(entry) {
  return (Array.isArray(entry?.judges) ? entry.judges : [])
    .map((judge) => Number(judge?.fit_score))
    .filter((score) => Number.isInteger(score) && score >= 0 && score <= 10);
}

/** The median fit score as stored (a 10 without two judges naming the route is stored as 9). */
export function ntaFitMedian(entry) {
  const stored = Number(entry?.fit_median);
  if (entry?.fit_median !== null && entry?.fit_median !== undefined && Number.isFinite(stored)) return stored;
  const scores = judgeScores(entry).sort((a, b) => a - b);
  return scores.length === 3 ? scores[1] : null;
}

/**
 * Reasons the entry itself fails the fit gate (no row needed): three distinct judges with provenance,
 * the rubric version, fewer than two flagging judges, the median at the bar. Empty when it passes.
 */
export function ntaFitGateReasons(entry, { minFit = NTA_MIN_FIT_SCORE, table } = {}) {
  if (!entry) return ['fit_not_judged'];
  const reasons = [];
  if (table && table.rubric_version !== NTA_FIT_RUBRIC_VERSION) reasons.push('fit_rubric_outdated');
  const judges = Array.isArray(entry.judges) ? entry.judges : [];
  const valid = judges.filter((judge) => Number.isInteger(Number(judge?.fit_score)) && text(judge?.judge) && text(judge?.model) && text(judge?.date));
  if (valid.length < 3 || new Set(valid.map((judge) => text(judge.judge))).size < 3) reasons.push('fit_needs_three_judges');
  const flaggedBy = judges.filter((judge) => Array.isArray(judge?.fit_flags) && judge.fit_flags.length).length;
  if (flaggedBy >= 2 || entry.blocking === true) reasons.push('fit_flagged');
  const median = ntaFitMedian(entry);
  if (median === null || median < minFit) reasons.push('fit_below_bar');
  return reasons;
}

/**
 * The fit gate for one row: the entry's own reasons plus the content check (the judges must have seen
 * this content). Returns { reasons, entry, median }.
 */
export function ntaFitVerdict(row, { fitScores, minFit = NTA_MIN_FIT_SCORE } = {}) {
  const found = ntaFitEntry(row?.id, { fitScores });
  if (!found?.entry) return { reasons: ['fit_not_judged'], entry: null, median: null };
  const { entry, table } = found;
  const reasons = ntaFitGateReasons(entry, { minFit, table });
  if (text(entry.question_id || row?.id) !== text(row?.id)) reasons.push('fit_for_another_question');
  if (!contentHashMatches(row, entry.content_hash)) reasons.push('fit_question_changed');
  return { reasons: [...new Set(reasons)], entry, median: ntaFitMedian(entry) };
}

/**
 * The stored tags for a row: the judges' majority type, unit and chapter (null where the judges had no
 * majority or the content changed since they judged it). The engine uses them before its heuristic.
 * A question the syllabus v2 re-tag moved keeps the judges' type, but not their unit and chapter: they
 * judged it under its old (retired or split) chapter, and the re-tag's chapter places it now.
 */
export function ntaStoredFitTags(row, { fitScores } = {}) {
  const found = ntaFitEntry(row?.id, { fitScores });
  const entry = found?.entry;
  const match = entry ? contentHashMatch(row, entry.content_hash) : null;
  if (!match) return { type: null, unit: null, chapter: null };
  if (match === 'retag') return { type: entry.cuet_type || null, unit: null, chapter: null };
  return { type: entry.cuet_type || null, unit: entry.unit || null, chapter: entry.chapter || null };
}
