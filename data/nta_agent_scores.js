// Agent scores for NTA mode: the third score source, next to the factory's signed evidence (and its
// signed index rows). Two independent Claude judges score each live question with the rubric in
// docs/brain/NTA-AGENT-RUBRIC.md; scripts/nta-pass-merge.mjs merges their result files into
// data/nta_agent_scores/<subject>.json with provenance. Nothing here calls a model or a database.
//
// An agent score admits a question only while all of this holds (agentScoreIntegrity):
//  - the subject's table is calibrated: the calibration pass compared the judges with the factory's
//    judges and recorded the agent threshold that maps the owner's bar (8 out of 10);
//  - the table was written under the rubric version this code accepts, with the model and the date;
//  - two different judges scored the question, each 0-10, both at or above the calibrated threshold;
//  - both judges' blind answers equal the stored key, and neither raised a blocking flag;
//  - the entry names this question and the question's content hash is the one that was scored.
// Anything missing fails closed. The tables are reviewed in git; they are not signed, so they are
// never an evidence record and never a publication decision (rubric section 8).
import { contentHash } from './content_evidence.js';
import english from './nta_agent_scores/english.json' with { type: 'json' };
import generalTest from './nta_agent_scores/general_test.json' with { type: 'json' };
import accountancy from './nta_agent_scores/accountancy.json' with { type: 'json' };
import businessStudies from './nta_agent_scores/business_studies.json' with { type: 'json' };
import economics from './nta_agent_scores/economics.json' with { type: 'json' };
import mathematics from './nta_agent_scores/mathematics.json' with { type: 'json' };
import physics from './nta_agent_scores/physics.json' with { type: 'json' };
import chemistry from './nta_agent_scores/chemistry.json' with { type: 'json' };
import biology from './nta_agent_scores/biology.json' with { type: 'json' };
import history from './nta_agent_scores/history.json' with { type: 'json' };
import politicalScience from './nta_agent_scores/political_science.json' with { type: 'json' };
import geography from './nta_agent_scores/geography.json' with { type: 'json' };
import psychology from './nta_agent_scores/psychology.json' with { type: 'json' };
import sociology from './nta_agent_scores/sociology.json' with { type: 'json' };
import computerScience from './nta_agent_scores/computer_science.json' with { type: 'json' };

// The rubric version these tables must be written under. Bump it when the rubric's scale, flags or
// result format change, and re-run the pass: old scores then stop admitting questions.
export const NTA_AGENT_RUBRIC_VERSION = 'nta-agent-rubric-1';
// The owner's bar on the factory scale that the calibrated agent threshold maps (NTA_MIN_SCORE).
export const NTA_AGENT_OWNER_BAR = 8;

// Rubric section 3. Any one of these from either judge keeps the question out at any score.
export const NTA_AGENT_BLOCKING_FLAGS = Object.freeze([
  'wrong_key', 'doubtful_key', 'multiple_defensible', 'answer_in_stem', 'hedge_wording', 'cites_source_text',
  'factual_error', 'off_syllabus', 'broken_layout', 'passage_defect', 'duplicate_options', 'garbled_text',
]);
const BLOCKING = new Set(NTA_AGENT_BLOCKING_FLAGS);
const KEYS = new Set(['A', 'B', 'C', 'D']);

const FILE_TABLES = Object.freeze({
  english, general_test: generalTest, accountancy, business_studies: businessStudies, economics,
  mathematics, physics, chemistry, biology, history, political_science: politicalScience,
  geography, psychology, sociology, computer_science: computerScience,
});

const text = (value) => (value === null || value === undefined ? '' : String(value));
const publicSubject = (subject) => (text(subject) === 'gat' ? 'general_test' : text(subject));

function indexTables(tables) {
  const byId = new Map();
  for (const [subject, table] of Object.entries(tables || {})) {
    for (const [id, entry] of Object.entries(table?.questions || {})) byId.set(id, { subject, table, entry });
  }
  return byId;
}

const FILE_INDEX = indexTables(FILE_TABLES);
const lookupCache = new WeakMap();

/** The tables in use: the committed files, or a test's own tables ({ [subject]: table }). */
function lookup(tables) {
  if (!tables) return FILE_INDEX;
  if (!lookupCache.has(tables)) lookupCache.set(tables, indexTables(tables));
  return lookupCache.get(tables);
}

export function ntaAgentTable(subject, tables = FILE_TABLES) {
  return tables?.[publicSubject(subject)] || null;
}

/** { subject, table, entry } for a question id, or null when no agent scored it. */
export function ntaAgentScoreEntry(id, { agentScores } = {}) {
  return lookup(agentScores).get(text(id)) || null;
}

function judgeScores(entry) {
  return (Array.isArray(entry?.judges) ? entry.judges : [])
    .map((judge) => Number(judge?.quality_score))
    .filter((score) => Number.isInteger(score) && score >= 0 && score <= 10);
}

/** The mean of the judges' scores (half points), or null. */
export function ntaAgentMean(entry) {
  const scores = judgeScores(entry);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

/**
 * The agent threshold for a bar on the factory scale: the calibrated threshold at the owner's bar,
 * shifted by the same amount when a report asks about another bar. Null while uncalibrated.
 */
export function ntaAgentThreshold(table, minScore = NTA_AGENT_OWNER_BAR) {
  const calibration = table?.calibration;
  const threshold = Number(calibration?.threshold);
  if (calibration?.status !== 'calibrated' || !Number.isFinite(threshold)) return null;
  const ownerBar = Number.isFinite(Number(calibration.owner_bar)) ? Number(calibration.owner_bar) : NTA_AGENT_OWNER_BAR;
  return threshold + (minScore - ownerBar);
}

/** Why the table itself cannot admit anything (empty when it can). */
export function ntaAgentTableReasons(table) {
  const reasons = [];
  if (!table) return ['agent_score_table_missing'];
  if (ntaAgentThreshold(table) === null) reasons.push('agent_score_uncalibrated');
  if (table.rubric_version !== NTA_AGENT_RUBRIC_VERSION) reasons.push('agent_score_rubric_outdated');
  return reasons;
}

/**
 * The blocking flags any judge raised on an entry (rubric section 3). A blocking flag vetoes the
 * question for NTA mode whatever its score source, factory evidence included (review of 13 Oct 2026:
 * factory items flagged factual_error, answer_in_stem or broken_layout were still served).
 */
export function ntaAgentBlockingFlags(entry) {
  const judges = Array.isArray(entry?.judges) ? entry.judges : [];
  // "Wrong_Key" and "factual error" are the same flag as wrong_key and factual_error.
  const canonical = (flag) => String(flag ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return [...new Set(judges.flatMap((judge) => (Array.isArray(judge?.flags) ? judge.flags : []).map(canonical).filter((flag) => BLOCKING.has(flag))))];
}

/**
 * Provenance and key checks for one row's agent score, given its lookup result. Score-bar reasons
 * (agent_score_below_threshold) are included so the caller needs no second rule for this source.
 */
export function ntaAgentScoreIntegrity(row, found, { minScore = NTA_AGENT_OWNER_BAR } = {}) {
  if (!found?.entry) return ['no_score'];
  const { table, entry } = found;
  const reasons = ntaAgentTableReasons(table);
  if (text(entry.question_id || row?.id) !== text(row?.id)) reasons.push('score_for_another_question');
  if (!entry.content_hash || entry.content_hash !== contentHash(row)) reasons.push('question_changed_since_scored');
  const judges = Array.isArray(entry.judges) ? entry.judges : [];
  const valid = judges.filter((judge) => Number.isInteger(Number(judge?.quality_score)) && text(judge?.judge) && text(judge?.model) && text(judge?.date));
  if (valid.length < 2 || new Set(valid.map((judge) => text(judge.judge))).size < 2) reasons.push('score_needs_both_judges');
  if (judges.some((judge) => !text(judge?.model) || !text(judge?.date))) reasons.push('agent_score_provenance_missing');
  const key = text(entry.key).toUpperCase();
  if (!KEYS.has(key)) reasons.push('agent_score_key_missing');
  else if (judges.some((judge) => text(judge?.blind_answer).toUpperCase() !== key)) reasons.push('agent_blind_key_mismatch');
  if (ntaAgentBlockingFlags(entry).length) reasons.push('agent_blocking_flag');
  const threshold = ntaAgentThreshold(table, minScore);
  if (threshold !== null && valid.length >= 2 && valid.some((judge) => Number(judge.quality_score) < threshold)) reasons.push('score_below_threshold');
  return [...new Set(reasons)];
}

/**
 * Ids worth loading for a subject: entries whose table and judges already pass every check that does
 * not need the live row (calibration, rubric, two judges at the threshold, keys, flags). The row's
 * content hash is checked by the engine once the row is read.
 */
export function ntaAgentAdmissibleIds(subject, { agentScores } = {}) {
  const table = ntaAgentTable(subject, agentScores || FILE_TABLES);
  if (!table || ntaAgentTableReasons(table).length) return [];
  return Object.entries(table.questions || {})
    .filter(([id, entry]) => ntaAgentScoreIntegrity({ id }, { table, entry: { ...entry, content_hash: null } })
      .every((reason) => reason === 'question_changed_since_scored'))
    .map(([id]) => id);
}
