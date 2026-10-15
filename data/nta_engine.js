// NTA paper engine: builds one CUET UG paper for a subject from the blueprint in data/nta_blueprints.
//
// Eligibility is the owner's score rule (13 Oct 2026) plus the hard gates that protect students from
// wrong keys. Assembly is pure and in memory: the caller loads the subject's pool once, this module
// picks a paper with a seeded greedy fill, repairs unmet minimums by swaps, lays the paper out the
// way the real paper is laid out, then checks the result against the blueprint. Whatever differs is
// returned as plain sentences for the student and as structured shortfalls for the content team.
//
// Spec: docs/brain/NTA-PATTERN-SPEC.md. Data audit: docs/brain/NTA-DATA-AUDIT.md.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { canonicalJSON } from './canonical_json.mjs';
import { canonicalQuestion, contentHash } from './content_evidence.js';
import { verifyAnswerIntegrity } from './answer_integrity.js';
import { qualityGateNtaQuestion, getPassageKey, getPassageText, getQuestionText, isPassageLinkedQuestion, normalizeOptions } from './nta_question_selector.js';
import { toInternalSubjectId, toPublicSubjectId } from './cuet_controls.js';
import {
  conflictReason, corruptedWordingReasons, isNumericalItem, isPermutationOptions, isStatementItem, itemFeatures, listedOrderKeyReasons,
  ntaDifficultyOf, ntaKeyDispute, ntaQuarantine, ntaServedRow, objectiveCap, optionPairs, passageWordCount, seedOrDemoReasons,
  stemGramWeights, structuralReasons, wordingReasons,
} from './nta_item_checks.js';
import { ntaAgentBlockingFlags, ntaAgentMean, ntaAgentScoreEntry, ntaAgentScoreIntegrity } from './nta_agent_scores.js';
import { NTA_MIN_FIT_SCORE, ntaFitVerdict, ntaStoredFitTags } from './nta_fit_scores.js';
import typesFile from './nta_blueprints/_types.json' with { type: 'json' };
import english from './nta_blueprints/english.json' with { type: 'json' };
import generalTest from './nta_blueprints/general_test.json' with { type: 'json' };
import accountancy from './nta_blueprints/accountancy.json' with { type: 'json' };
import businessStudies from './nta_blueprints/business_studies.json' with { type: 'json' };
import economics from './nta_blueprints/economics.json' with { type: 'json' };
import mathematics from './nta_blueprints/mathematics.json' with { type: 'json' };
import physics from './nta_blueprints/physics.json' with { type: 'json' };
import chemistry from './nta_blueprints/chemistry.json' with { type: 'json' };
import biology from './nta_blueprints/biology.json' with { type: 'json' };
import history from './nta_blueprints/history.json' with { type: 'json' };
import politicalScience from './nta_blueprints/political_science.json' with { type: 'json' };
import geography from './nta_blueprints/geography.json' with { type: 'json' };
import psychology from './nta_blueprints/psychology.json' with { type: 'json' };
import sociology from './nta_blueprints/sociology.json' with { type: 'json' };
import computerScience from './nta_blueprints/computer_science.json' with { type: 'json' };

// Owner, 13 Oct 2026: "any question which has a score above 8 or 8.5, something like this ... it
// qualifies for NTA mode". Scores are out of 10. A factory question carries two independent judge
// scores (Luna exam_fit and Gemini independent_evaluation, integers 0-10); its score is their mean,
// the only reading in which 8.5 exists. At 8 the live bank has 564 qualifying questions, at 8.5 340
// (NTA-DATA-AUDIT.md section 1). Change this one number to move the bar.
export const NTA_MIN_SCORE = 8;
// A paper that cannot reach 50 is served as the closest valid paper only from this many questions;
// below it the student is told why and offered something else.
export const NTA_MIN_SERVE_QUESTIONS = 45;
// Owner: building the paper "should not take more than 30 seconds". The target is under 3 s.
export const NTA_TIME_BUDGET_MS = 30_000;
export const NTA_ENGINE_VERSION = 'nta-engine-2026.10.14-r5.2';
// The CUET-fit bar (data/nta_fit_scores.js): eligibility needs the quality gate above AND the median of
// the three fit judges at or above this, with fewer than two judges raising a fit flag.
export { NTA_MIN_FIT_SCORE };
// Owner, 13 Oct 2026: "always pick the latest questions that we have, because our latest questions are
// always the best quality". Among eligible questions the newest is preferred before the score; questions
// created on the same day count as equally new (then score, then the seed).
export const NTA_RECENCY_BUCKET_MS = 24 * 60 * 60 * 1000;
// Version of the signed nta_question_index rows this engine accepts (scripts/nta-index-build.mjs).
export const NTA_INDEX_VERSION = 'nta-index-1';

const BLUEPRINTS = Object.freeze({
  english, general_test: generalTest, accountancy, business_studies: businessStudies, economics,
  mathematics, physics, chemistry, biology, history, political_science: politicalScience,
  geography, psychology, sociology, computer_science: computerScience,
});
const TYPE_DEFS = typesFile.types;
const TYPE_ORDER = typesFile.order;
const COMPILED_TYPES = TYPE_ORDER.map((type) => ({
  type,
  subjects: TYPE_DEFS[type].subjects || null,
  patterns: (TYPE_DEFS[type].patterns || []).map((source) => new RegExp(source, 'i')),
}));
const DB_TYPE_MAP = new Map();
for (const type of [...TYPE_ORDER].reverse()) {
  for (const dbType of TYPE_DEFS[type].dbTypes || []) {
    const key = normalizeDbType(dbType);
    DB_TYPE_MAP.set(key, [{ type, subjects: TYPE_DEFS[type].subjects || null }, ...(DB_TYPE_MAP.get(key) || [])]);
  }
}
// English rows whose stem names no format fall back to the type their chapter is made of.
const ENGLISH_CHAPTER_TYPES = Object.freeze({
  Vocabulary: 'synonym',
  'Correct Word Usage': 'fill_in_blank',
  'Para Jumbles': 'sentence_rearrangement',
  'Match the Following': 'match_the_following',
});
const SPECIAL_TYPES = new Set(['match_the_following', 'sequence_ordering', 'statement_based', 'assertion_reason']);
const DIFFICULTIES = ['easy', 'medium', 'hard'];
// The rest of the app calls this paper "General Test".
const SUBJECT_LABELS = Object.freeze({ general_test: 'General Test' });

function normalizeDbType(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function text(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function stableHash(value) {
  let hash = 2166136261;
  const str = String(value || '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function jitter(seed, id) {
  return (stableHash(`${seed}:${id}`) % 1_000_000) / 1_000_000;
}

function subjectLabel(bp) {
  return SUBJECT_LABELS[bp.subject] || text(bp.officialName).split(' / ')[0] || bp.subject;
}

function typeLabel(type) {
  const labels = {
    single_mcq: 'single-answer questions',
    match_the_following: 'match-the-following questions',
    sequence_ordering: 'arrange-in-sequence questions',
    statement_based: 'multi-statement questions',
    assertion_reason: 'assertion-reason questions',
    sentence_rearrangement: 'sentence rearrangement questions',
    synonym: 'synonym questions',
    antonym: 'antonym questions',
    idiom_phrase: 'idiom and phrase questions',
    one_word_substitution: 'one-word substitution questions',
    error_detection: 'error detection questions',
    fill_in_blank: 'fill-in-the-blank questions',
  };
  return labels[type] || TYPE_DEFS[type]?.label || type;
}

// ---------------------------------------------------------------------------------------------
// Blueprints
// ---------------------------------------------------------------------------------------------

export function getNtaBlueprint(subject) {
  const publicId = toPublicSubjectId(toInternalSubjectId(text(subject)));
  return BLUEPRINTS[publicId] || BLUEPRINTS[text(subject)] || null;
}

export function listNtaBlueprintSubjects() {
  return Object.keys(BLUEPRINTS);
}

export function resolveNtaVariant(bp, variantId) {
  if (!bp) return null;
  return bp.variants.find((variant) => variant.id === variantId) || bp.variants.find((variant) => variant.default) || bp.variants[0];
}

// ---------------------------------------------------------------------------------------------
// Scores and eligibility
// ---------------------------------------------------------------------------------------------

function judgeScore(record, check) {
  const value = record?.checks?.[check]?.item_quality_score;
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * The question's score out of 10. Four sources exist, in this order:
 *  - evidence: the signed factory record's two judge scores, averaged (half points);
 *  - nta_index: the signed slim index row the offline job (scripts/nta-index-build.mjs) wrote after
 *    verifying that evidence record, so the runtime need not read the 38 KB record;
 *  - agent_scored: two agent judges' scores from data/nta_agent_scores/<subject>.json (averaged),
 *    admitted only under the provenance checks in data/nta_agent_scores.js. Factory evidence, where
 *    present, always wins: an agent score never replaces or rescues it;
 *  - quality_score: the column, stored 0-1, multiplied by 10. Nothing signs it, so it is reported
 *    but never admits a question (QUALITY.md: missing checks fail closed).
 * Zero in quality_score is the column default and means "no score", not a score of 0.
 * options.agentScores replaces the committed agent tables (tests).
 */
export function ntaScoreOf(row, { agentScores } = {}) {
  const record = row?.evidence?.record;
  const luna = judgeScore(record, 'exam_fit');
  const gemini = judgeScore(record, 'independent_evaluation');
  if (luna !== null || gemini !== null) {
    const score = luna !== null && gemini !== null ? (luna + gemini) / 2 : (luna ?? gemini);
    return { score, source: 'evidence_judges', luna, gemini };
  }
  const index = row?.nta_index;
  if (index && Number.isFinite(Number(index.score))) {
    return { score: Number(index.score), source: 'nta_index', luna: index.luna ?? null, gemini: index.gemini ?? null };
  }
  const agent = ntaAgentScoreEntry(row?.id, { agentScores });
  if (agent && ntaAgentMean(agent.entry) !== null) {
    return { score: ntaAgentMean(agent.entry), source: 'agent_scored', luna: null, gemini: null, agent };
  }
  const column = Number(row?.quality_score ?? row?.qualityScore);
  if (Number.isFinite(column) && column > 0) return { score: Math.round(column * 1000) / 100, source: 'quality_score' };
  return { score: null, source: null };
}

function hmacMatches(signature, bodies, secret) {
  const actual = Buffer.from(String(signature || ''));
  for (const body of bodies) {
    const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'));
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
  }
  return false;
}

function signatureMatches(envelope, secret) {
  return hmacMatches(envelope?.signature, [canonicalJSON(envelope.record), JSON.stringify(envelope.record)], secret);
}

/** The fields of an nta_question_index row that its signature covers. */
export function ntaIndexSignedBody(index) {
  return {
    question_id: index.question_id,
    subject: index.subject,
    score: Number(index.score),
    luna: index.luna ?? null,
    gemini: index.gemini ?? null,
    content_hash: index.content_hash,
    index_version: index.index_version,
    verified_at: index.verified_at,
  };
}

export function signNtaIndex(index, secret) {
  return createHmac('sha256', secret).update(canonicalJSON(ntaIndexSignedBody(index))).digest('hex');
}

/**
 * A score counts only while it is provably about this exact question and its key.
 * Evidence: signed by the backend, names this row, matches the current content hash, not a mock run,
 * both judges scored it, and both blind solvers reached the stored key. A missing judge or solver
 * fails closed. Index: signed by the backend job, names this row, the current content hash and this
 * index version (the job only indexes evidence that passed the same checks). Expiry, source registry
 * and calibration state are publication rules, not score rules, and are not checked here.
 */
export function ntaScoreIntegrity(row, { secret = process.env.CUET_EVIDENCE_SIGNING_KEY, agentScores, minScore = NTA_MIN_SCORE } = {}) {
  const { source, luna, gemini, agent } = ntaScoreOf(row, { agentScores });
  if (source === 'quality_score') return ['score_unsigned'];
  // Agent scores carry their own provenance (rubric, model, date, both judges, calibration, content
  // hash) and their own bar: both judges at or above the calibrated threshold.
  if (source === 'agent_scored') return ntaAgentScoreIntegrity(row, agent, { minScore });
  if (source !== 'evidence_judges' && source !== 'nta_index') return [];
  if (!secret) return ['score_unverifiable_no_signing_key'];
  const reasons = [];
  if (source === 'nta_index') {
    const index = row.nta_index;
    if (!hmacMatches(index.signature, [canonicalJSON(ntaIndexSignedBody(index))], secret)) reasons.push('score_signature_invalid');
    if (index.question_id !== row.id) reasons.push('score_for_another_question');
    if (index.content_hash !== contentHash(row)) reasons.push('question_changed_since_scored');
    if (index.index_version !== NTA_INDEX_VERSION) reasons.push('score_index_outdated');
    if (luna === null || gemini === null) reasons.push('score_needs_both_judges');
    return reasons;
  }
  const envelope = row.evidence;
  const record = envelope?.record;
  if (!envelope?.signature || !signatureMatches(envelope, secret)) reasons.push('score_signature_invalid');
  if (record.candidate_id !== row.id) reasons.push('score_for_another_question');
  if (record.content_hash !== contentHash(row)) reasons.push('question_changed_since_scored');
  if (record.mock === true || record.verifier_version === 'mock') reasons.push('score_from_mock_run');
  if (luna === null || gemini === null) reasons.push('score_needs_both_judges');
  const key = canonicalQuestion(row).key;
  if (record.solved_key === undefined || record.solved_key === null || record.solved_key === '') reasons.push('blind_solver_key_missing');
  else if (record.solved_key !== key) reasons.push('blind_solver_key_mismatch');
  const independentKey = record.checks?.independent_evaluation?.solved_key;
  if (independentKey === undefined || independentKey === null || independentKey === '') reasons.push('independent_solver_key_missing');
  else if (independentKey !== key) reasons.push('independent_solver_key_mismatch');
  return reasons;
}

/**
 * Hard gates for one row. Context: { subject, minScore, minFitScore, disputedIds:Set, heldFamilies:Set,
 * secret, agentScores, fitScores (tests: replaces data/nta_fit_scores/*.json) }.
 * Eligibility needs both the quality gate (score, provenance, keys, flags, content) and the CUET-fit
 * gate (data/nta_fit_scores.js). Returns { eligible, reasons, score, scoreSource, type, fitScore }.
 */
export function ntaEligibility(row, context = {}) {
  const subject = toInternalSubjectId(text(context.subject || row?.subject));
  const minScore = Number.isFinite(context.minScore) ? context.minScore : NTA_MIN_SCORE;
  const reasons = [];
  const status = text(row?.status).toLowerCase();
  if (row?.is_deleted === true || status !== 'live') reasons.push('not_published');
  // Seed and demo rows (ids such as a2, e1, g1) are not bank questions, whatever they score.
  reasons.push(...seedOrDemoReasons(row));
  if (text(row?.verification_state).toLowerCase() === 'disputed') reasons.push('key_disputed');
  if (context.disputedIds?.has(row?.id)) reasons.push('key_disputed');
  const family = row?.family_id || row?.template_id || row?.evidence?.record?.family_id || row?.nta_index?.family_id;
  if (family && context.heldFamilies?.has(family)) reasons.push('family_held');
  if (Number(row?.score ?? 0) < -2) reasons.push('community_voted_down');
  const { score, source } = ntaScoreOf(row, { agentScores: context.agentScores });
  if (score === null) reasons.push('no_score');
  // The mean bar is for the factory scale; an agent score's bar is applied in its integrity check.
  else if (source !== 'agent_scored' && score < minScore) reasons.push('score_below_threshold');
  if (score !== null) reasons.push(...ntaScoreIntegrity(row, { secret: context.secret, agentScores: context.agentScores, minScore }));
  if (ntaQuarantine(row?.id)) reasons.push('nta_quarantined');
  if (ntaKeyDispute(row?.id)) reasons.push('agent_key_dispute');
  // A blocking flag from either agent judge vetoes the question whatever its score source: factory
  // evidence admits a question, it never overrules a judge who found a wrong fact or a giveaway.
  const agent = ntaAgentScoreEntry(row?.id, { agentScores: context.agentScores });
  if (agent && ntaAgentBlockingFlags(agent.entry).length) reasons.push('agent_blocking_flag');
  const answer = verifyAnswerIntegrity(row);
  if (!answer.accepted) reasons.push(...answer.reasons);
  const content = qualityGateNtaQuestion(row, { subjectId: subject });
  if (!content.accepted) reasons.push(...content.reasons);
  // The item must read like an NTA question and its options must fit its own stem.
  const bp = getNtaBlueprint(subject);
  const allowedTypes = bp ? Object.keys(bp.typeQuotas) : undefined;
  const type = classifyNtaType(row, subject, allowedTypes, { fitScores: context.fitScores });
  reasons.push(...structuralReasons(row, type), ...wordingReasons(row, type), ...corruptedWordingReasons(row), ...listedOrderKeyReasons(row, type));
  // The CUET-fit gate: three judges, the content they saw, fewer than two flags, median at the bar.
  const minFit = Number.isFinite(context.minFitScore) ? context.minFitScore : NTA_MIN_FIT_SCORE;
  const fit = ntaFitVerdict(row, { fitScores: context.fitScores, minFit });
  reasons.push(...fit.reasons);
  // The judges' type is the question's type; one the subject's paper never asks has no place in it.
  const tags = ntaStoredFitTags(row, { fitScores: context.fitScores });
  if (tags.type && bp && tags.type !== 'passage_set_item' && !new Set([...allowedTypes, 'single_mcq']).has(tags.type)) reasons.push('fit_type_not_in_pattern');
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], score, scoreSource: source, type, fitScore: fit.median };
}

// ---------------------------------------------------------------------------------------------
// Question types
// ---------------------------------------------------------------------------------------------

function storedType(row) {
  if (row?.question_type) return normalizeDbType(row.question_type);
  const tag = (Array.isArray(row?.tags) ? row.tags : []).find((entry) => String(entry).startsWith('question_type:'));
  return tag ? normalizeDbType(String(tag).slice(14)) : '';
}

function appliesTo(def, subject) {
  return !def.subjects || def.subjects.includes(subject);
}

// What the options alone say about the type. Statement-based needs labelled statements in the stem
// and options that combine those labels; "Both / Neither / Only P" wording is a plain MCQ.
function optionShapeType(stem, options) {
  if (options.filter((option) => optionPairs(option.text)).length >= 3) return 'match_the_following';
  if (isStatementItem(stem, options)) return 'statement_based';
  if (isPermutationOptions(options)) return 'sequence_ordering';
  return null;
}

/**
 * The CUET question type of a row. The stored type comes first: the majority (2 of 3) type the CUET-fit
 * judges gave the current content (data/nta_fit_scores.js). Without one, the heuristic below decides.
 * Passage children are always 'passage_set_item' (sets are built from them); a stored
 * 'passage_set_item' on a row without a passage is ignored. allowedTypes is the blueprint's typeQuotas
 * keys; types outside it are never returned except single_mcq. options: { fitScores } (tests).
 */
export function classifyNtaType(row, subject, allowedTypes, { fitScores } = {}) {
  if (getPassageKey(row) || getPassageText(row)) return 'passage_set_item';
  const stored = ntaStoredFitTags(row, { fitScores }).type;
  const allowed = new Set([...(allowedTypes || TYPE_ORDER), 'single_mcq']);
  if (stored && stored !== 'passage_set_item' && allowed.has(stored)) return stored;
  return heuristicNtaType(row, subject, allowedTypes);
}

/** The engine's own type guess from the stem, the options and the database's type column. */
export function heuristicNtaType(row, subject, allowedTypes) {
  const internal = toInternalSubjectId(text(subject));
  const publicId = toPublicSubjectId(internal);
  if (getPassageKey(row) || getPassageText(row)) return 'passage_set_item';
  const allowed = new Set([...(allowedTypes || TYPE_ORDER), 'single_mcq']);
  const fits = (entry) => allowed.has(entry.type) && appliesTo(entry, publicId);
  const stem = getQuestionText(row);
  const options = normalizeOptions(row?.options, row);
  const fromDb = (DB_TYPE_MAP.get(storedType(row)) || []).find(fits)?.type || null;
  // English stored types are reliable for vocabulary formats that the stem wording hides.
  if (publicId === 'english' && fromDb && fromDb !== 'single_mcq') return fromDb;
  const statementItem = isStatementItem(stem, options);
  const byStem = COMPILED_TYPES.find((entry) => fits(entry) && entry.patterns.some((pattern) => pattern.test(stem))
    // The statement pattern only sees "(A) ... (B) ... (C)"; the options must combine those labels.
    && (entry.type !== 'statement_based' || statementItem))?.type;
  // "Chronological order" in a statements item does not make it a sequence item.
  if (byStem === 'sequence_ordering' && statementItem && !isPermutationOptions(options)) return 'statement_based';
  if (byStem) return byStem;
  const byOptions = optionShapeType(stem, options);
  if (byOptions && allowed.has(byOptions)) return byOptions;
  // Stored statement, sequence and match types count only with the option shape checked above (a
  // stored "statement" type covers one-statement items too); other stored types stand.
  if (fromDb && !['single_mcq', 'statement_based', 'sequence_ordering', 'match_the_following'].includes(fromDb)) return fromDb;
  if (publicId === 'english') {
    const fallback = ENGLISH_CHAPTER_TYPES[text(row?.chapter)];
    if (fallback && allowed.has(fallback)) return fallback;
  }
  return 'single_mcq';
}

// ---------------------------------------------------------------------------------------------
// Paper model
// ---------------------------------------------------------------------------------------------

function buildModel(bp, variant) {
  const slots = [];
  const units = [];
  const sections = variant.sections.map((section, sectionIndex) => {
    const unitIds = [];
    for (const unit of section.units) {
      const unitId = units.length;
      const slotIds = [];
      for (const chapter of unit.chapters) {
        const slotId = slots.length;
        slots.push({
          id: slotId, sectionIndex, unitId, name: chapter.name,
          names: new Set([chapter.name, ...(chapter.aliases || [])]),
          min: chapter.min, target: chapter.target, max: chapter.max,
        });
        slotIds.push(slotId);
      }
      units.push({ id: unitId, sectionIndex, name: unit.name, min: unit.questions.min, target: unit.questions.target, max: unit.questions.max, slotIds });
      unitIds.push(unitId);
    }
    return { index: sectionIndex, id: section.id, label: section.label, size: section.questions, positions: section.positions, unitIds };
  });
  const slotsByChapter = new Map();
  for (const slot of slots) {
    for (const name of slot.names) slotsByChapter.set(name, [...(slotsByChapter.get(name) || []), slot.id]);
  }
  const excluded = new Set((bp.excludedChapters || []).map((entry) => entry.name));
  const sets = bp.sets;
  const setsEnabled = sets.count.target > 0;
  return {
    bp, variant, sections, slots, units, slotsByChapter, excluded,
    types: bp.typeQuotas,
    allowedTypes: Object.keys(bp.typeQuotas),
    sets: { ...sets, enabled: setsEnabled, sectionIndex: 0 },
    order: bp.order,
    difficulty: bp.difficulty,
    // Share of all questions that are numerical (blueprint overlay), when the pattern sets one.
    numerical: bp.overlays?.numerical_share || null,
    total: sections.reduce((sum, section) => sum + section.size, 0),
  };
}

// ---------------------------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------------------------

// The stored label; an agent correction only for a two-level gap (data/nta_item_checks.js ntaDifficultyOf).
function difficultyOf(row) {
  const value = ntaDifficultyOf(row);
  return DIFFICULTIES.includes(value) ? value : 'medium';
}

function familyKeys(row) {
  const keys = [];
  const family = row?.family_id || row?.template_id || row?.evidence?.record?.family_id || row?.nta_index?.family_id;
  if (family) keys.push(`family:${family}`);
  if (row?.duplicate_group_id) keys.push(`dup:${row.duplicate_group_id}`);
  return keys;
}

// Children of one passage that ask the same thing are served once: the first in passage order stays.
function distinctChildren(children) {
  const kept = [];
  let dropped = 0;
  for (const child of children) {
    if (kept.some((other) => conflictReason(child.features, other.features, { sameSet: true }))) dropped += 1;
    else kept.push(child);
  }
  return { kept, dropped };
}

// Where a row goes in the paper: the fit judges' majority chapter (and unit) first, the database's
// chapter otherwise. Passage children keep the database chapter while it maps to the paper, so one
// passage's children stay in one set.
function placementOf(row, model, context) {
  const tags = ntaStoredFitTags(row, { fitScores: context.fitScores });
  const dbChapter = text(row.chapter);
  const candidates = [];
  if (getPassageKey(row) && (model.slotsByChapter.has(dbChapter) || model.excluded.has(dbChapter))) candidates.push([dbChapter, 'database']);
  if (tags.chapter) candidates.push([text(tags.chapter), 'fit']);
  candidates.push([dbChapter, 'database']);
  for (const [chapter, source] of candidates) {
    if (model.excluded.has(chapter)) return { chapter, slotIds: [], excluded: true, source };
    let slotIds = model.slotsByChapter.get(chapter) || [];
    if (!slotIds.length) continue;
    if (source === 'fit' && tags.unit) {
      const inUnit = slotIds.filter((slotId) => model.units[model.slots[slotId].unitId].name === tags.unit);
      if (inUnit.length) slotIds = inUnit;
    }
    return { chapter, slotIds, excluded: false, source };
  }
  return { chapter: dbChapter, slotIds: [], excluded: false, source: 'database' };
}

// Creation time in ms, or null when the row has none.
function createdAtOf(row) {
  const value = Date.parse(text(row?.created_at ?? row?.createdAt));
  return Number.isFinite(value) ? value : null;
}

// Selection preference (owner's recency rule): dated rows by creation day, newest first; rows without a
// date after them; then the higher quality score, the higher fit
// median, and the seed. So a newer 8 is preferred to an older 9.
export function ntaPreferenceOrder(a, b) {
  const da = a.createdAt === null || a.createdAt === undefined ? null : Math.floor(a.createdAt / NTA_RECENCY_BUCKET_MS);
  const db = b.createdAt === null || b.createdAt === undefined ? null : Math.floor(b.createdAt / NTA_RECENCY_BUCKET_MS);
  if ((da === null) !== (db === null)) return da === null ? 1 : -1;
  if (da !== null && da !== db) return db - da;
  return (Number(b.score) || 0) - (Number(a.score) || 0)
    || (Number(b.fitScore) || 0) - (Number(a.fitScore) || 0)
    || (Number(a.rank) || 0) - (Number(b.rank) || 0);
}
const preferenceOrder = ntaPreferenceOrder;

function prepareCandidates(rows, model, context) {
  const subject = model.bp.internalSubject;
  const english = model.bp.subject === 'english';
  const seen = context.seenIds || new Set();
  const excludedReasons = {};
  const count = (reason, n = 1) => { excludedReasons[reason] = (excludedReasons[reason] || 0) + n; };
  const items = [];
  const scores = [];
  const eligibleBySource = {};
  // Rows each gate kept out (a row failing two gates counts for both), and rows that passed every gate.
  const excludedRows = { quality: 0, fit: 0, veto: 0, other: 0, fitNotJudged: 0 };
  let passedGates = 0;
  // A row's verdict does not depend on the seed or on what the student has seen, so the builds of one
  // assembleNtaPaper call share it (context.verdicts).
  const verdicts = context.verdicts;
  // Stem wording is compared with 5-grams weighted by rarity in this pool (data/nta_item_checks.js).
  const gramWeights = stemGramWeights(rows);
  for (const row of rows) {
    const cacheable = verdicts && row && typeof row === 'object';
    let verdict = cacheable ? verdicts.get(row) : undefined;
    if (!verdict) {
      verdict = ntaEligibility(row, { ...context, subject });
      if (cacheable) verdicts.set(row, verdict);
    }
    if (verdict.score !== null) scores.push(verdict.score);
    if (verdict.eligible) eligibleBySource[verdict.scoreSource] = (eligibleBySource[verdict.scoreSource] || 0) + 1;
    if (!verdict.eligible) {
      for (const reason of verdict.reasons) count(reason);
      for (const gate of new Set(verdict.reasons.map(ntaGateOf))) excludedRows[gate] += 1;
      if (verdict.reasons.includes('fit_not_judged')) excludedRows.fitNotJudged += 1;
      continue;
    }
    passedGates += 1;
    const placed = placementOf(row, model, context);
    if (placed.excluded) { count('chapter_out_of_syllabus'); continue; }
    if (!placed.slotIds.length) { count('chapter_not_in_this_paper'); continue; }
    const { chapter, slotIds } = placed;
    const features = itemFeatures(row, { english, agentScores: context.agentScores, gramWeights });
    items.push({
      id: row.id, row, chapter, slotIds,
      type: verdict.type,
      difficulty: difficultyOf(row),
      numerical: isNumericalItem(row),
      seen: seen.has(row.id),
      score: verdict.score,
      fitScore: verdict.fitScore,
      createdAt: createdAtOf(row),
      placedBy: placed.source,
      // rank: the seed's order, for layout and ties; pref: the selection order (recency first), set below.
      rank: jitter(context.seed, row.id),
      pref: 0,
      families: familyKeys(row),
      features,
      objective: features.objective,
      setKey: getPassageKey(row) || null,
      order: Number(row.order_index ?? row.orderIndex ?? 0) || 0,
    });
  }

  // Owner's recency rule: newest first (by creation day), then the higher score, then the seed.
  items.sort(preferenceOrder);
  items.forEach((item, index) => { item.pref = index; });

  const standalone = [];
  const groups = new Map();
  for (const item of items) {
    if (item.type === 'passage_set_item') groups.set(item.setKey, [...(groups.get(item.setKey) || []), item]);
    else standalone.push(item);
  }

  const sets = [];
  const words = model.sets.passageWords;
  for (const [key, children] of groups) {
    const chapters = new Set(children.map((child) => child.chapter));
    if (chapters.size !== 1) { count('passage_set_spans_chapters', children.length); continue; }
    if (!model.sets.enabled) { count('passage_set_not_in_this_paper', children.length); continue; }
    // The syllabus fixes the passage length (English: at most 300 words; the blueprint's range).
    const length = passageWordCount(children[0].row);
    if (words && (length < words.min || length > words.max)) {
      count(length < words.min ? 'passage_too_short' : 'passage_too_long', children.length);
      continue;
    }
    const inOrder = children.slice().sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
    const { kept, dropped } = distinctChildren(inOrder);
    if (dropped) count('passage_child_repeats_another', dropped);
    if (kept.length < model.sets.size.min) { count('passage_set_too_small', kept.length); continue; }
    // A long set is served with its preferred (newest) children, in the passage's own order.
    const ordered = kept.slice().sort((a, b) => (context.seenPolicy === 'none' ? 0 : Number(a.seen) - Number(b.seen)) || a.pref - b.pref);
    const chosen = ordered.slice(0, model.sets.size.max).sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
    const passage = getPassageText(chosen[0].row);
    sets.push({
      key, chapter: chosen[0].chapter, slotIds: chosen[0].slotIds, children: chosen,
      size: chosen.length, seen: chosen.some((child) => child.seen), rank: jitter(context.seed, key),
      pref: Math.min(...chosen.map((child) => child.pref)),
      passageKey: passage.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 200),
      families: [...new Set(chosen.flatMap((child) => child.families))],
      words: length,
    });
  }
  return { standalone, sets, excludedReasons, excludedRows, passedGates, scoredCount: scores.length, eligibleCount: items.length, seenEligible: items.filter((item) => item.seen).length, eligibleBySource };
}

// Score reasons: the question has no score of the bar or more that the engine can trust.
const QUALITY_REASONS = new Set(['no_score', 'question_changed_since_scored', 'blind_solver_key_missing', 'independent_solver_key_missing']);
const UNPUBLISHED_REASONS = new Set(['not_published', 'id_not_uuid', 'seed_or_demo_row']);

/**
 * The gate an eligibility reason belongs to: 'fit' (the CUET-fit judges), 'quality' (the score or its
 * provenance), 'other' (not a published bank question) or 'veto' (everything that holds back a scored
 * question: key disputes and mismatches, holds, quarantine, blocking flags, answer, wording and format checks).
 */
export function ntaGateOf(reason) {
  const code = String(reason || '');
  if (code.startsWith('fit_')) return 'fit';
  if (QUALITY_REASONS.has(code) || code.startsWith('score_') || code.startsWith('agent_score_')) return 'quality';
  if (UNPUBLISHED_REASONS.has(code)) return 'other';
  return 'veto';
}

/**
 * Why a pool gave no question to place, by the gate that kept out the most rows: 'unscored' (nothing
 * carries a score), 'syllabus' (questions pass every gate but sit in chapters this paper does not
 * ask), 'quality', 'fit_not_judged', 'fit_below_bar', 'veto', or 'unpublished' (only rows that are not
 * published bank questions). Ties go to quality, then fit.
 */
function emptyPoolCause(prepared) {
  if (!prepared.scoredCount) return 'unscored';
  if (prepared.passedGates > 0) return 'syllabus';
  const { quality, fit, veto, fitNotJudged } = prepared.excludedRows;
  const top = Math.max(quality, fit, veto);
  if (!top) return 'unpublished';
  if (quality === top) return 'quality';
  if (fit === top) return fitNotJudged * 2 >= fit ? 'fit_not_judged' : 'fit_below_bar';
  return 'veto';
}

// ---------------------------------------------------------------------------------------------
// Limits per relaxation level
// ---------------------------------------------------------------------------------------------

const LEVELS = [
  { id: 0, label: 'strict' },
  { id: 1, label: 'difficulty_free', difficultyFree: true },
  { id: 2, label: 'chapters_widened', difficultyFree: true, chapterSlack: 2 },
  { id: 3, label: 'units_widened', difficultyFree: true, chapterSlack: 2, unitSlack: 3 },
];

function rangeOf(range, slack = 0) {
  return { min: Math.max(0, range.min - slack), target: range.target, max: range.max + slack };
}

function typeLimits(model, standaloneTotal) {
  const limits = {};
  for (const [type, range] of Object.entries(model.types)) limits[type] = { ...range };
  const targetSum = Object.values(limits).reduce((sum, range) => sum + range.target, 0);
  const extra = standaloneTotal - targetSum;
  // Blueprint ifUnavailable rule: missing set questions become standalone questions. Set items are
  // mostly single MCQs on a passage, so the single-MCQ allowance grows by the same number.
  if (extra > 0 && limits.single_mcq) {
    limits.single_mcq = { min: limits.single_mcq.min, target: limits.single_mcq.target + extra, max: limits.single_mcq.max + extra };
  }
  return limits;
}

function difficultyLimits(model, total) {
  const limits = {};
  for (const key of DIFFICULTIES) {
    const range = model.difficulty[key];
    limits[key] = { min: Math.round(range.min * total), target: Math.round(range.target * total), max: Math.round(range.max * total) };
  }
  return limits;
}

// The blueprint's numerical share as question counts: min rounded up, max rounded down.
function numericalLimits(model) {
  const range = model.numerical;
  if (!range) return null;
  return { min: Math.ceil(range.min * model.total - 1e-9), target: Math.round(range.target * model.total), max: Math.floor(range.max * model.total + 1e-9) };
}

function limitsFor(model, level, setQuestions) {
  const standaloneTotal = model.total - setQuestions;
  return {
    slots: model.slots.map((slot) => rangeOf(slot, level.chapterSlack || 0)),
    units: model.units.map((unit) => rangeOf(unit, level.unitSlack || 0)),
    types: typeLimits(model, standaloneTotal),
    difficulty: difficultyLimits(model, model.total),
    difficultyFree: Boolean(level.difficultyFree),
    numerical: numericalLimits(model),
  };
}

// ---------------------------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------------------------

function newState(model, pool, { seenPolicy = 'seen_first' } = {}) {
  return {
    pool,
    seenPolicy,         // how far seen questions are held back (better, assembleNtaPaper)
    slot: new Array(model.slots.length).fill(0),
    unit: new Array(model.units.length).fill(0),
    section: new Array(model.sections.length).fill(0),
    type: {},
    difficulty: { easy: 0, medium: 0, hard: 0 },
    numerical: 0,
    objectives: new Map(), // learning-objective tag -> questions in the paper
    picks: [],          // { item, slotId }
    sets: [],           // { set, slotId }
    usedIds: new Set(),
    families: new Set(),
    passageKeys: new Set(),
    blockers: new Map(), // candidate id -> number of picked questions it would repeat
  };
}

// Same family, same text, same concept or figures, same headword: one of the two is enough.
function conflictPair(a, b) {
  if (a.id === b.id) return false;
  if (a.families.some((key) => b.families.includes(key))) return true;
  return Boolean(conflictReason(a.features, b.features, { sameSet: Boolean(a.setKey && a.setKey === b.setKey) }));
}

// The standalone candidates one question conflicts with, computed once per question.
function conflictsOf(state, item) {
  if (!item.conflicts) item.conflicts = state.pool.filter((other) => conflictPair(item, other));
  return item.conflicts;
}

// Picking a question blocks every candidate that would repeat it; removing it unblocks them.
function markBlockers(state, item, sign) {
  for (const other of conflictsOf(state, item)) {
    const next = (state.blockers.get(other.id) || 0) + sign;
    if (next > 0) state.blockers.set(other.id, next);
    else state.blockers.delete(other.id);
  }
}

function available(state, item) {
  return !state.usedIds.has(item.id) && !state.blockers.has(item.id);
}

function applyDelta(model, state, entry, sign) {
  const slot = model.slots[entry.slotId];
  state.slot[slot.id] += sign * entry.items.length;
  state.unit[slot.unitId] += sign * entry.items.length;
  state.section[slot.sectionIndex] += sign * entry.items.length;
  for (const item of entry.items) {
    state.difficulty[item.difficulty] += sign;
    if (item.numerical) state.numerical += sign;
    if (item.objective) state.objectives.set(item.objective, (state.objectives.get(item.objective) || 0) + sign);
    if (item.type !== 'passage_set_item') state.type[item.type] = (state.type[item.type] || 0) + sign;
  }
}

function addPick(model, state, item, slotId) {
  state.picks.push({ item, slotId });
  applyDelta(model, state, { slotId, items: [item] }, 1);
  state.usedIds.add(item.id);
  for (const key of item.families) state.families.add(key);
  markBlockers(state, item, 1);
}

function removePick(model, state, pick) {
  state.picks.splice(state.picks.indexOf(pick), 1);
  applyDelta(model, state, { slotId: pick.slotId, items: [pick.item] }, -1);
  state.usedIds.delete(pick.item.id);
  for (const key of pick.item.families) state.families.delete(key);
  markBlockers(state, pick.item, -1);
}

function sectionFreeSeats(model, state) {
  return model.sections.map((section) => {
    const setQuestions = state.sets.filter((entry) => model.slots[entry.slotId].sectionIndex === section.index)
      .reduce((sum, entry) => sum + entry.set.size, 0);
    const standalone = state.picks.filter((pick) => model.slots[pick.slotId].sectionIndex === section.index).length;
    return section.size - setQuestions - standalone;
  });
}

function canAdd(model, state, limits, item, slotId, sectionFree) {
  const slot = model.slots[slotId];
  if (sectionFree[slot.sectionIndex] <= 0) return false;
  if (state.slot[slotId] + 1 > limits.slots[slotId].max) return false;
  if (state.unit[slot.unitId] + 1 > limits.units[slot.unitId].max) return false;
  const typeLimit = limits.types[item.type];
  if (!typeLimit || (state.type[item.type] || 0) + 1 > typeLimit.max) return false;
  if (!limits.difficultyFree && state.difficulty[item.difficulty] + 1 > limits.difficulty[item.difficulty].max) return false;
  if (item.numerical && limits.numerical && state.numerical + 1 > limits.numerical.max) return false;
  if (item.objective && (state.objectives.get(item.objective) || 0) + 1 > objectiveCap(item.objective)) return false;
  return true;
}

function gains(model, state, limits, item, slotId) {
  const slot = model.slots[slotId];
  const typeCount = state.type[item.type] || 0;
  const typeLimit = limits.types[item.type];
  let minGain = 0;
  let targetGain = 0;
  if (state.slot[slotId] < limits.slots[slotId].min) minGain += 2;
  if (state.unit[slot.unitId] < limits.units[slot.unitId].min) minGain += 2;
  if (typeCount < typeLimit.min) minGain += 3;
  if (!limits.difficultyFree && state.difficulty[item.difficulty] < limits.difficulty[item.difficulty].min) minGain += 1;
  if (state.slot[slotId] < limits.slots[slotId].target) targetGain += 1;
  if (state.unit[slot.unitId] < limits.units[slot.unitId].target) targetGain += 1;
  if (typeCount < typeLimit.target) targetGain += 1.5;
  if (state.difficulty[item.difficulty] < limits.difficulty[item.difficulty].target) targetGain += 1;
  if (item.numerical && limits.numerical) {
    if (state.numerical < limits.numerical.min) minGain += 2;
    if (state.numerical < limits.numerical.target) targetGain += 1;
  }
  return { minGain, targetGain };
}

// Seen policy 'seen_first' (the default): unseen questions always first; seen ones fill only what
// unseen ones cannot, and the repair pass swaps in a seen question only for a minimum no unseen question
// can meet. Then unmet minimums, then targets, then the seed. The repeat-allowed builds of
// assembleNtaPaper: 'relaxed', a seen question gives way only to an unseen one that is just as useful to
// the paper; 'none', the paper is built as if nothing had been seen (seen questions are still counted
// and named in the notice).
function better(a, b, seenPolicy = 'seen_first') {
  if (!b) return true;
  if (seenPolicy === 'seen_first' && a.item.seen !== b.item.seen) return !a.item.seen;
  if ((a.minGain > 0) !== (b.minGain > 0)) return a.minGain > 0;
  if (a.minGain !== b.minGain) return a.minGain > b.minGain;
  if (a.targetGain !== b.targetGain) return a.targetGain > b.targetGain;
  if (seenPolicy !== 'none' && a.item.seen !== b.item.seen) return !a.item.seen;
  return a.item.pref < b.item.pref;
}

// Orders two candidates (questions or sets) by seen, as far as the build's seen policy allows.
function seenOrder(state, a, b) {
  return state.seenPolicy === 'none' ? 0 : Number(a.seen) - Number(b.seen);
}

function pickSets(model, state, sets, limits) {
  if (!model.sets.enabled) return;
  const want = model.sets.count.target;
  const kindsWanted = model.sets.distinctKindsMin || 1;
  const seenFirst = state.seenPolicy === 'seen_first';
  const ordered = sets.slice().sort((a, b) =>
    (seenFirst ? seenOrder(state, a, b) : 0)
    || Math.abs(a.size - model.sets.size.target) - Math.abs(b.size - model.sets.size.target)
    || seenOrder(state, a, b)
    || a.pref - b.pref);
  for (let pass = 0; pass < 2 && state.sets.length < want; pass += 1) {
    for (const set of ordered) {
      if (state.sets.length >= want) break;
      if (state.sets.some((entry) => entry.set === set)) continue;
      if (state.passageKeys.has(set.passageKey) || set.families.some((key) => state.families.has(key))) continue;
      // A set never repeats a question already in the paper, inside another set or standalone.
      if (set.children.some((child) => state.blockers.has(child.id))) continue;
      if (state.sets.some((entry) => entry.set.children.some((picked) => set.children.some((child) => conflictPair(picked, child))))) continue;
      const tags = new Map();
      for (const child of set.children) if (child.objective) tags.set(child.objective, (tags.get(child.objective) || 0) + 1);
      if ([...tags].some(([tag, n]) => (state.objectives.get(tag) || 0) + n > objectiveCap(tag))) continue;
      // First pass: a new passage kind until the paper has the distinct kinds it needs.
      const kinds = new Set(state.sets.map((entry) => entry.set.chapter));
      if (pass === 0 && kinds.size < kindsWanted && kinds.has(set.chapter)) continue;
      const slotId = set.slotIds.find((id) => model.slots[id].sectionIndex === model.sets.sectionIndex);
      if (slotId === undefined) continue;
      const slot = model.slots[slotId];
      if (state.slot[slotId] + set.size > limits.slots[slotId].max) continue;
      if (state.unit[slot.unitId] + set.size > limits.units[slot.unitId].max) continue;
      if (state.sets.reduce((sum, entry) => sum + entry.set.size, 0) + set.size > model.sets.questions.max) continue;
      state.sets.push({ set, slotId });
      applyDelta(model, state, { slotId, items: set.children }, 1);
      state.passageKeys.add(set.passageKey);
      for (const key of set.families) state.families.add(key);
      for (const child of set.children) {
        state.usedIds.add(child.id);
        markBlockers(state, child, 1);
      }
    }
  }
}

function fill(model, state, limits, deadline) {
  for (;;) {
    if (Date.now() > deadline) return;
    const sectionFree = sectionFreeSeats(model, state);
    if (sectionFree.every((free) => free <= 0)) return;
    let best = null;
    for (const item of state.pool) {
      if (!available(state, item)) continue;
      for (const slotId of item.slotIds) {
        if (!canAdd(model, state, limits, item, slotId, sectionFree)) continue;
        const candidate = { item, slotId, ...gains(model, state, limits, item, slotId) };
        if (better(candidate, best, state.seenPolicy)) best = candidate;
      }
    }
    if (!best) return;
    addPick(model, state, best.item, best.slotId);
  }
}

function unmetMinimums(model, state, limits) {
  const unmet = [];
  model.slots.forEach((slot, id) => { if (state.slot[id] < limits.slots[id].min) unmet.push({ kind: 'slot', id }); });
  model.units.forEach((unit, id) => { if (state.unit[id] < limits.units[id].min) unmet.push({ kind: 'unit', id }); });
  for (const [type, range] of Object.entries(limits.types)) if ((state.type[type] || 0) < range.min) unmet.push({ kind: 'type', id: type });
  if (!limits.difficultyFree) for (const key of DIFFICULTIES) if (state.difficulty[key] < limits.difficulty[key].min) unmet.push({ kind: 'difficulty', id: key });
  if (limits.numerical && state.numerical < limits.numerical.min) unmet.push({ kind: 'numerical', id: 'numerical' });
  return unmet;
}

function servesDimension(model, dimension, item, slotId) {
  const slot = model.slots[slotId];
  if (dimension.kind === 'slot') return slotId === dimension.id;
  if (dimension.kind === 'unit') return slot.unitId === dimension.id;
  if (dimension.kind === 'type') return item.type === dimension.id;
  if (dimension.kind === 'numerical') return item.numerical;
  return item.difficulty === dimension.id;
}

// Removing this pick must not open a new deficit, unless the incoming question fills the same need.
function removable(model, state, limits, pick, incoming, incomingSlot) {
  const slot = model.slots[pick.slotId];
  const inSlot = model.slots[incomingSlot];
  if (state.slot[pick.slotId] - 1 < limits.slots[pick.slotId].min && pick.slotId !== incomingSlot) return false;
  if (state.unit[slot.unitId] - 1 < limits.units[slot.unitId].min && slot.unitId !== inSlot.unitId) return false;
  if ((state.type[pick.item.type] || 0) - 1 < limits.types[pick.item.type].min && pick.item.type !== incoming.type) return false;
  if (!limits.difficultyFree && state.difficulty[pick.item.difficulty] - 1 < limits.difficulty[pick.item.difficulty].min && pick.item.difficulty !== incoming.difficulty) return false;
  if (limits.numerical && pick.item.numerical && !incoming.numerical && state.numerical - 1 < limits.numerical.min) return false;
  return true;
}

// Would the paper accept `item` in `slotId` once `pick` is taken out? Counts only; no side effects.
function fitsAfterSwap(model, state, limits, pick, item, slotId) {
  applyDelta(model, state, { slotId: pick.slotId, items: [pick.item] }, -1);
  const sectionFree = sectionFreeSeats(model, state);
  sectionFree[model.slots[pick.slotId].sectionIndex] += 1;
  const ok = canAdd(model, state, limits, item, slotId, sectionFree);
  applyDelta(model, state, { slotId: pick.slotId, items: [pick.item] }, 1);
  return ok;
}

const REPAIR_CANDIDATES = 60;

// Swap a picked question for one that fills an unmet minimum, then refill any free seats.
function repair(model, state, limits, deadline) {
  for (let iteration = 0; iteration < 200; iteration += 1) {
    if (Date.now() > deadline) return;
    const unmet = unmetMinimums(model, state, limits);
    if (!unmet.length) return;
    let swapped = false;
    for (const dimension of unmet) {
      const incoming = [];
      for (const item of state.pool) {
        if (!available(state, item)) continue;
        for (const slotId of item.slotIds) if (servesDimension(model, dimension, item, slotId)) incoming.push({ item, slotId });
      }
      incoming.sort((a, b) => seenOrder(state, a.item, b.item) || a.item.pref - b.item.pref);
      const outgoing = state.picks.slice().sort((a, b) => seenOrder(state, b.item, a.item) || b.item.pref - a.item.pref);
      for (const { item, slotId } of incoming.slice(0, REPAIR_CANDIDATES)) {
        const pick = outgoing.find((candidate) => removable(model, state, limits, candidate, item, slotId)
          && fitsAfterSwap(model, state, limits, candidate, item, slotId));
        if (!pick) continue;
        removePick(model, state, pick);
        if (!available(state, item)) { addPick(model, state, pick.item, pick.slotId); continue; }
        addPick(model, state, item, slotId);
        swapped = true;
        break;
      }
      if (swapped) break;
    }
    if (!swapped) return;
    fill(model, state, limits, deadline);
  }
}

function runLevel(model, prepared, level, deadline, { seenPolicy = 'seen_first' } = {}) {
  const state = newState(model, prepared.standalone, { seenPolicy });
  pickSets(model, state, prepared.sets, limitsFor(model, level, 0));
  const setQuestions = state.sets.reduce((sum, entry) => sum + entry.set.size, 0);
  const limits = limitsFor(model, level, setQuestions);
  fill(model, state, limits, deadline);
  repair(model, state, limits, deadline);
  const total = setQuestions + state.picks.length;
  return { level, state, limits, total, unmet: unmetMinimums(model, state, limits) };
}

// ---------------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------------

function arrangeMixed(entries, { maxChapterRun, maxTypeRun, typeRunApplies, seed }) {
  if (!entries.length) return [];
  const byType = new Map();
  for (const entry of entries) byType.set(entry.type, [...(byType.get(entry.type) || []), entry]);
  const total = entries.length;
  const desired = [];
  for (const [type, group] of byType) {
    group.sort((a, b) => a.rank - b.rank);
    const offset = jitter(seed, `offset:${type}`);
    group.forEach((entry, i) => desired.push({ entry, at: ((i + offset) * total) / group.length }));
  }
  desired.sort((a, b) => a.at - b.at || a.entry.rank - b.entry.rank);
  const pending = desired.map((value) => value.entry);
  const out = [];
  const runOf = (key, value) => {
    let run = 0;
    for (let i = out.length - 1; i >= 0 && out[i][key] === value; i -= 1) run += 1;
    return run;
  };
  // Run length that `entry` would sit in if placed at position `at` of `out`.
  const runAt = (at, key, value) => {
    let run = 1;
    for (let i = at - 1; i >= 0 && out[i][key] === value; i -= 1) run += 1;
    for (let i = at; i < out.length && out[i][key] === value; i += 1) run += 1;
    return run;
  };
  const fitsAt = (entry, at) => (!maxChapterRun || runAt(at, 'chapter', entry.chapter) <= maxChapterRun)
    && (!maxTypeRun || !typeRunApplies(entry.type) || runAt(at, 'type', entry.type) <= maxTypeRun);
  while (pending.length) {
    const index = pending.findIndex((entry) =>
      (!maxChapterRun || runOf('chapter', entry.chapter) < maxChapterRun)
      && (!maxTypeRun || !typeRunApplies(entry.type) || runOf('type', entry.type) < maxTypeRun));
    if (index >= 0) { out.push(pending.splice(index, 1)[0]); continue; }
    // Nothing fits at the end: put the next entry at the latest earlier place where it breaks no run.
    const entry = pending.shift();
    let at = out.length;
    while (at > 0 && !fitsAt(entry, at)) at -= 1;
    out.splice(at > 0 || fitsAt(entry, 0) ? at : out.length, 0, entry);
  }
  return out;
}

function layout(model, state, seed) {
  const english = model.bp.subject === 'english';
  const order = model.order || {};
  const arrangeOptions = {
    maxChapterRun: order.maxSameChapterRun,
    maxTypeRun: order.maxSameTypeRun,
    typeRunApplies: (type) => english || SPECIAL_TYPES.has(type),
    seed,
  };
  const entry = (item, slotId, extra = {}) => ({
    item, row: item.row, id: item.id, chapter: item.chapter, type: item.type, difficulty: item.difficulty,
    rank: item.rank, slotId, sectionIndex: model.slots[slotId].sectionIndex, setIndex: null, ...extra,
  });
  const setBlocks = state.sets
    .slice()
    .sort((a, b) => a.set.rank - b.set.rank)
    .map(({ set, slotId }, setIndex) => set.children.map((child) => entry(child, slotId, { setIndex, setKey: set.key })));
  const placement = model.sets.placement;
  const ordered = [];
  for (const section of model.sections) {
    const standalone = arrangeMixed(
      state.picks.filter((pick) => model.slots[pick.slotId].sectionIndex === section.index).map((pick) => entry(pick.item, pick.slotId)),
      arrangeOptions,
    );
    const blocks = section.index === model.sets.sectionIndex ? setBlocks.flat() : [];
    if (placement === 'start') ordered.push(...blocks, ...standalone);
    else ordered.push(...standalone, ...blocks);
  }
  return ordered.map((value, index) => ({ ...value, position: index + 1 }));
}

// ---------------------------------------------------------------------------------------------
// Check against the blueprint
// ---------------------------------------------------------------------------------------------

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return counts;
}

/**
 * Compares an assembled paper with its blueprint and lists every difference. Each deviation:
 * { kind, key, expected, actual, severity } where severity 'structure' would be an engine bug
 * (never acceptable) and 'content' means the bank could not supply what the pattern asks for.
 */
export function checkNtaPaper(paper, bp, variantId) {
  const variant = resolveNtaVariant(bp, variantId);
  const model = buildModel(bp, variant);
  const deviations = [];
  const add = (kind, key, expected, actual, severity = 'content') => deviations.push({ kind, key, expected, actual, severity });
  const total = paper.length;
  if (total !== model.total) add('total', 'questions', model.total, total);

  // Sections in order, each within its size.
  let previousSection = -1;
  for (const entry of paper) {
    if (entry.sectionIndex < previousSection) { add('section_order', entry.id, 'sections in paper order', 'out of order', 'structure'); break; }
    previousSection = entry.sectionIndex;
  }
  for (const section of model.sections) {
    const size = paper.filter((entry) => entry.sectionIndex === section.index).length;
    if (size !== section.size) add('section_size', section.id, section.size, size);
  }

  // Duplicates: ids, families, and the same question in other words (passage children included).
  const ids = new Set();
  const families = new Set();
  const english = bp.subject === 'english';
  const seenFeatures = [];
  const objectives = new Map();
  for (const entry of paper) {
    if (ids.has(entry.id)) add('duplicate', entry.id, 'unique question', 'repeated', 'structure');
    ids.add(entry.id);
    for (const key of familyKeys(entry.row)) {
      if (families.has(key) && entry.setIndex === null) add('duplicate', key, 'one question per family', 'repeated family', 'structure');
      families.add(key);
    }
    const features = entry.item?.features || itemFeatures(entry.row, { english });
    for (const other of seenFeatures) {
      const reason = conflictReason(features, other.features, { sameSet: entry.setIndex !== null && entry.setIndex === other.setIndex });
      if (reason) { add('duplicate', `${other.id}~${entry.id}`, 'each question tests something different', reason, 'structure'); break; }
    }
    seenFeatures.push({ id: entry.id, features, setIndex: entry.setIndex });
    if (features.objective) objectives.set(features.objective, (objectives.get(features.objective) || 0) + 1);
  }
  for (const [tag, n] of objectives) if (n > objectiveCap(tag)) add('objective_repeated', tag, objectiveCap(tag), n, 'structure');

  // Sets: whole, contiguous, placed, sized.
  const setIndexes = [...new Set(paper.filter((entry) => entry.setIndex !== null).map((entry) => entry.setIndex))];
  const setQuestions = paper.filter((entry) => entry.setIndex !== null).length;
  if (model.sets.enabled) {
    if (setIndexes.length < model.sets.count.min) add('sets', 'count', `${model.sets.count.min}-${model.sets.count.max}`, setIndexes.length);
    else if (setIndexes.length < model.sets.count.target) add('sets_substituted', 'count', model.sets.count.target, setIndexes.length);
    if (setIndexes.length > model.sets.count.max) add('sets', 'count', `${model.sets.count.min}-${model.sets.count.max}`, setIndexes.length, 'structure');
    for (const setIndex of setIndexes) {
      const positions = paper.filter((entry) => entry.setIndex === setIndex).map((entry) => entry.position);
      const contiguous = positions.every((position, i) => i === 0 || position === positions[i - 1] + 1);
      if (!contiguous) add('set_split', setIndex, 'set served whole and together', 'split', 'structure');
      if (positions.length < model.sets.size.min || positions.length > model.sets.size.max) add('set_size', setIndex, `${model.sets.size.min}-${model.sets.size.max}`, positions.length, 'structure');
      const chapters = new Set(paper.filter((entry) => entry.setIndex === setIndex).map((entry) => entry.chapter));
      if (chapters.size !== 1) add('set_chapters', setIndex, 'one chapter per set', chapters.size, 'structure');
    }
    if (setQuestions) {
      const setPositions = paper.filter((entry) => entry.setIndex !== null).map((entry) => entry.position);
      const atStart = Math.min(...setPositions) === 1 && Math.max(...setPositions) === setQuestions;
      const atEnd = Math.max(...setPositions) === total && Math.min(...setPositions) === total - setQuestions + 1;
      if (model.sets.placement === 'start' && !atStart) add('set_placement', 'start', 'sets first', 'not first', 'structure');
      if (model.sets.placement === 'end' && !atEnd) add('set_placement', 'end', 'sets last', 'not last', 'structure');
    }
    if (model.sets.distinctKindsMin) {
      const kinds = new Set(paper.filter((entry) => entry.setIndex !== null).map((entry) => entry.chapter));
      if (setIndexes.length >= model.sets.distinctKindsMin && kinds.size < model.sets.distinctKindsMin) add('set_kinds', 'distinct', model.sets.distinctKindsMin, kinds.size);
    }
  } else if (setIndexes.length) {
    add('sets', 'count', 0, setIndexes.length, 'structure');
  }

  // Types (standalone only), with the blueprint's set-substitution allowance.
  const types = typeLimits(model, model.total - setQuestions);
  const typeCounts = countBy(paper.filter((entry) => entry.setIndex === null).map((entry) => entry.type));
  for (const [type, count] of Object.entries(typeCounts)) if (!types[type]) add('type', type, 'not in this paper', count, 'structure');
  for (const [type, range] of Object.entries(types)) {
    const count = typeCounts[type] || 0;
    if (count < range.min) add('type_short', type, `${range.min}-${range.max}`, count);
    if (count > range.max) add('type_over', type, `${range.min}-${range.max}`, count, 'structure');
  }

  // Units and chapters, by the slot each question filled.
  const slotCounts = new Array(model.slots.length).fill(0);
  for (const entry of paper) if (Number.isInteger(entry.slotId)) slotCounts[entry.slotId] += 1;
  model.units.forEach((unit) => {
    const count = unit.slotIds.reduce((sum, id) => sum + slotCounts[id], 0);
    if (count < unit.min || count > unit.max) add('unit', `${model.sections[unit.sectionIndex].id}:${unit.name}`, `${unit.min}-${unit.max}`, count);
  });
  model.slots.forEach((slot) => {
    const count = slotCounts[slot.id];
    if (count < slot.min || count > slot.max) add('chapter', `${model.sections[slot.sectionIndex].id}:${slot.name}`, `${slot.min}-${slot.max}`, count);
  });

  // Numerical share, where the pattern sets one.
  const numericalRange = numericalLimits(model);
  if (numericalRange) {
    const numerical = paper.filter((entry) => entry.item?.numerical ?? isNumericalItem(entry.row)).length;
    if (numerical > numericalRange.max) add('numerical_over', 'numerical', `${numericalRange.min}-${numericalRange.max}`, numerical, 'structure');
    else if (numerical < numericalRange.min) add('numerical_short', 'numerical', `${numericalRange.min}-${numericalRange.max}`, numerical);
  }

  // Difficulty mix of the whole paper.
  const difficulty = countBy(paper.map((entry) => entry.difficulty));
  for (const key of DIFFICULTIES) {
    const range = model.difficulty[key];
    const share = total ? (difficulty[key] || 0) / total : 0;
    if (share < range.min - 1e-9 || share > range.max + 1e-9) add('difficulty', key, `${Math.round(range.min * 100)}-${Math.round(range.max * 100)}%`, `${Math.round(share * 100)}%`);
  }

  // Order: chapter and special-type runs inside the standalone block.
  const maxChapterRun = model.order?.maxSameChapterRun;
  const maxTypeRun = model.order?.maxSameTypeRun;
  let chapterRun = 0;
  let typeRun = 0;
  for (let i = 0; i < paper.length; i += 1) {
    const entry = paper[i];
    const previous = paper[i - 1];
    if (entry.setIndex !== null) { chapterRun = 0; typeRun = 0; continue; }
    chapterRun = previous && previous.setIndex === null && previous.chapter === entry.chapter && previous.sectionIndex === entry.sectionIndex ? chapterRun + 1 : 1;
    typeRun = previous && previous.setIndex === null && previous.type === entry.type ? typeRun + 1 : 1;
    if (maxChapterRun && chapterRun > maxChapterRun) add('order_chapter_run', entry.chapter, maxChapterRun, chapterRun);
    if (maxTypeRun && (english || SPECIAL_TYPES.has(entry.type)) && typeRun > maxTypeRun) add('order_type_run', entry.type, maxTypeRun, typeRun);
  }
  return deviations;
}

// ---------------------------------------------------------------------------------------------
// Student-facing notice and content-team shortfall
// ---------------------------------------------------------------------------------------------

function unitLabel(key) {
  return String(key).replace(/^[^:]*:/, '');
}

// The differences of a served paper, or (refused) only what the bank is short of: a refused paper is
// never shown, so nothing that names its positions, its layout or its repeats is said about it.
function describe(deviations, model, paper, extras, { refused = false } = {}) {
  const lines = [];
  const subject = subjectLabel(model.bp);
  const total = paper.length;
  if (!refused && total !== model.total) lines.push(`This paper has ${total} questions instead of ${model.total}: the question bank does not have enough questions that meet the quality bar and fit the ${subject} pattern.`);
  const substituted = !refused && deviations.find((deviation) => deviation.kind === 'sets_substituted');
  if (substituted) {
    const setCount = Number(substituted.actual) || 0;
    const missing = model.sets.questions.target - paper.filter((entry) => entry.setIndex !== null).length;
    const start = total - missing + 1;
    lines.push(setCount
      ? `The real paper has ${model.sets.count.target} case-based sets of ${model.sets.size.target} questions; this one has ${setCount}, and ${missing} of those questions are standalone instead.`
      : `The real paper ends with ${model.sets.count.target} case-based sets of ${model.sets.size.target} questions. The bank has no complete sets for ${subject} yet, so Q${Math.max(1, start)}-${total} are standalone questions instead.`);
  }
  const typeShort = deviations.filter((deviation) => deviation.kind === 'type_short');
  for (const deviation of typeShort) lines.push(`${typeLabel(deviation.key)[0].toUpperCase()}${typeLabel(deviation.key).slice(1)}: ${deviation.actual} instead of ${deviation.expected.replace('-', ' to ')}, because the bank is short of them.`);
  const units = deviations.filter((deviation) => deviation.kind === 'unit');
  for (const deviation of units.slice(0, 4)) lines.push(`${unitLabel(deviation.key)}: ${deviation.actual} questions; the real paper has ${deviation.expected.replace('-', ' to ')}.`);
  if (units.length > 4) lines.push(`${units.length - 4} more units differ from the real weightage.`);
  const chapters = deviations.filter((deviation) => deviation.kind === 'chapter');
  if (chapters.length) {
    const named = chapters.slice(0, 3).map((deviation) => `${unitLabel(deviation.key)} ${deviation.actual} (real paper ${deviation.expected.replace('-', ' to ')})`);
    lines.push(`Chapter weightage differs in ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}: ${named.join('; ')}${chapters.length > 3 ? '; and others' : ''}.`);
  }
  const numericalShort = deviations.find((deviation) => deviation.kind === 'numerical_short');
  if (refused) {
    if (numericalShort) lines.push(`Numerical questions: ${numericalShort.actual} instead of ${numericalShort.expected.replace('-', ' to ')}, because the bank is short of them.`);
    return lines;
  }
  if (deviations.some((deviation) => deviation.kind === 'difficulty')) {
    const counts = countBy(paper.map((entry) => entry.difficulty));
    const target = DIFFICULTIES.map((key) => Math.round(model.difficulty[key].target * 100));
    lines.push(`Difficulty mix: ${counts.easy || 0} easy, ${counts.medium || 0} medium and ${counts.hard || 0} hard; the CUET pattern is about ${target[0]}% easy, ${target[1]}% medium and ${target[2]}% hard.`);
  }
  if (numericalShort) lines.push(`Numerical questions: ${numericalShort.actual} instead of ${numericalShort.expected.replace('-', ' to ')}, because the bank is short of them.`);
  if (deviations.some((deviation) => deviation.kind === 'set_kinds')) lines.push('Both reading passages are of the same kind; the real paper mixes factual, narrative and literary passages.');
  if (deviations.some((deviation) => deviation.kind === 'order_chapter_run' || deviation.kind === 'order_type_run')) lines.push('A few questions of the same kind sit next to each other more often than in the real paper.');
  if (extras.paragraphJumbles) lines.push(`The ${extras.paragraphJumbles} rearrangement question${extras.paragraphJumbles === 1 ? ' orders' : 's order'} sentences of a paragraph; the real paper rearranges parts of one sentence.`);
  const repeats = extras.previousRepeats || 0;
  if (repeats) lines.push(`${repeats} question${repeats === 1 ? ' repeats' : 's repeat'} from your earlier NTA papers: there are not enough new questions that fit the pattern.`);
  if (extras.seenUsed) {
    lines.push(repeats
      ? `${extras.seenUsed} other question${extras.seenUsed === 1 ? ' is one' : 's are ones'} you have answered before.`
      : `${extras.seenUsed} question${extras.seenUsed === 1 ? ' is one' : 's are ones'} you have answered before: there are not enough new questions that fit the pattern.`);
  }
  return lines;
}

function refusal(model, reason, details) {
  const subject = subjectLabel(model.bp);
  const tryInstead = `Try a Full mock for ${subject} instead; it uses the wider question bank.`;
  const notReady = `NTA mode is not ready for ${subject} yet`;
  // No question to place: the sentence names the gate that kept out the most questions (emptyPoolCause).
  const emptyPool = {
    unscored: `${notReady}: its questions have not been quality-scored, and NTA mode uses only questions scoring ${details.minScore} or more out of 10. ${tryInstead}`,
    quality: `${notReady}: no question passes every check, and most do not have a checked quality score of ${details.minScore} or more out of 10. ${tryInstead}`,
    fit_not_judged: `${notReady}: no question passes every check, and most have not yet been checked against the real CUET paper. ${tryInstead}`,
    fit_below_bar: `${notReady}: no question passes every check, and most were judged not close enough to real CUET questions. ${tryInstead}`,
    veto: `${notReady}: no question passes every check, and most are held back by checks on their answer key, wording or format. ${tryInstead}`,
    syllabus: `${notReady}: the questions that pass every check are from chapters this paper does not cover. ${tryInstead}`,
    unpublished: `${notReady}: it has no published questions that NTA mode can use. ${tryInstead}`,
  };
  const messages = {
    no_scored_questions: emptyPool[details.cause] || emptyPool.unscored,
    no_passage_sets: `NTA mode for ${subject} needs ${model.sets.count.min} complete reading passages${model.sets.passageWords ? ` of ${model.sets.passageWords.min} to ${model.sets.passageWords.max} words` : ''} with ${model.sets.size.min} to ${model.sets.size.max} different questions each, as in the real paper. The bank has ${details.sets} such passage${details.sets === 1 ? '' : 's'} that meet${details.sets === 1 ? 's' : ''} the quality bar right now. ${tryInstead}`,
    too_few_questions: `NTA mode for ${subject} could place only ${details.total} of ${model.total} questions in the CUET pattern from questions that meet the quality bar, so it would not be a fair exam paper. ${tryInstead}`,
    time_budget: `Building the ${subject} paper took too long, so it was stopped. Please try again in a minute.`,
    engine_error: `The ${subject} paper could not be laid out correctly, so it was not started. Please try again; if it happens again, try a Full mock for ${subject}.`,
  };
  return messages[reason];
}

function englishParagraphJumbles(paper) {
  return paper.filter((entry) => entry.type === 'sentence_rearrangement'
    && /\b(coherent|paragraph|following sentences|these sentences)\b/i.test(getQuestionText(entry.row))).length;
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

// One assembly from one pool with one seed (assembleNtaPaper decides how often and with what).
function assembleSeeded(rows, options = {}) {
  const startedAt = Date.now();
  const bp = getNtaBlueprint(options.subject);
  if (!bp) throw new Error('NTA_BLUEPRINT_MISSING');
  const variant = resolveNtaVariant(bp, options.variant);
  const model = buildModel(bp, variant);
  const deadline = Math.min(options.deadline || Infinity, startedAt + NTA_TIME_BUDGET_MS);
  const minScore = Number.isFinite(options.minScore) ? options.minScore : NTA_MIN_SCORE;
  const seed = String(options.seed || 'nta');
  const seenPolicy = SEEN_POLICIES.includes(options.seenPolicy) ? options.seenPolicy : 'seen_first';
  const context = { ...options, minScore, seed, seenPolicy };

  const prepared = prepareCandidates(Array.isArray(rows) ? rows : [], model, context);
  const gatesMs = Date.now() - startedAt;

  const results = [];
  for (const level of LEVELS) {
    if (Date.now() > deadline) break;
    const result = runLevel(model, prepared, level, deadline, { seenPolicy });
    results.push(result);
    if (result.total === model.total && result.unmet.length === 0) break;
  }
  const best = results.slice().sort((a, b) =>
    Number(b.total === model.total && !b.unmet.length) - Number(a.total === model.total && !a.unmet.length)
    || b.total - a.total || a.unmet.length - b.unmet.length || a.level.id - b.level.id)[0];
  const assembleMs = Date.now() - startedAt - gatesMs;

  const paper = best ? layout(model, best.state, seed) : [];
  const deviations = checkNtaPaper(paper, bp, variant.id);
  const seenUsed = paper.filter((entry) => entry.item.seen).length;
  // Questions from the student's earlier NTA papers are named as such; other seen ones as answered before.
  const previous = options.previousPaperIds instanceof Set ? options.previousPaperIds : new Set(options.previousPaperIds || []);
  const previousRepeats = paper.filter((entry) => previous.has(entry.id)).length;
  const extras = { seenUsed: seenUsed - paper.filter((entry) => entry.item.seen && previous.has(entry.id)).length, previousRepeats, paragraphJumbles: bp.subject === 'english' ? englishParagraphJumbles(paper) : 0 };
  const setCount = best ? best.state.sets.length : 0;
  const structureBroken = deviations.filter((deviation) => deviation.severity === 'structure');

  let status = 'exact';
  let refusalReason = null;
  if (Date.now() > deadline) refusalReason = 'time_budget';
  else if (prepared.eligibleCount === 0) refusalReason = 'no_scored_questions';
  else if (model.sets.enabled && setCount < model.sets.count.min) refusalReason = 'no_passage_sets';
  else if (paper.length < NTA_MIN_SERVE_QUESTIONS) refusalReason = 'too_few_questions';
  // A broken structure is an engine fault, never something to hand a student.
  else if (structureBroken.length) refusalReason = 'engine_error';
  if (refusalReason) status = 'refused';
  else if (deviations.length || extras.seenUsed || extras.previousRepeats || extras.paragraphJumbles) status = 'closest';
  // No question to place: which gate kept them out decides the sentence (and is kept for the content team).
  const cause = refusalReason === 'no_scored_questions' ? emptyPoolCause(prepared) : null;

  // A refusal for a thin bank still says what the bank is short of; other refusals need no list.
  const items = status !== 'refused' ? describe(deviations, model, paper, extras)
    : refusalReason === 'too_few_questions' ? describe(deviations, model, paper, {}, { refused: true }) : [];
  const subject = subjectLabel(bp);
  const summary = status === 'exact'
    ? `${subject}: 50 questions in the CUET ${subject} pattern.`
    : status === 'closest'
      ? `This ${subject} paper follows the CUET pattern as closely as the question bank allows. What differs from the real paper:`
      : refusal(model, refusalReason, { minScore, scored: prepared.scoredCount, sets: prepared.sets.length, total: paper.length, cause });
  const totalMs = Date.now() - startedAt;

  const typeCounts = countBy(paper.filter((entry) => entry.setIndex === null).map((entry) => entry.type));
  const structure = {
    variant: variant.id,
    sections: model.sections.map((section) => ({ id: section.id, questions: paper.filter((entry) => entry.sectionIndex === section.index).length, expected: section.size })),
    sets: best ? best.state.sets.map(({ set }) => {
      const positions = paper.filter((entry) => entry.setKey === set.key).map((entry) => entry.position);
      return { chapter: set.chapter, size: set.size, positions: positions.length ? [positions[0], positions.at(-1)] : [] };
    }) : [],
    types: typeCounts,
    difficulty: countBy(paper.map((entry) => entry.difficulty)),
    units: model.units.map((unit) => ({ section: model.sections[unit.sectionIndex].id, unit: unit.name, questions: unit.slotIds.reduce((sum, id) => sum + paper.filter((entry) => entry.slotId === id).length, 0), range: `${unit.min}-${unit.max}` })),
    relaxation: best ? best.level.label : null,
    seenUsed,
    // 'seen_first': seen questions fill only what new ones cannot; 'relaxed' and 'none': repeat-allowed builds.
    seenPolicy,
  };

  const shortfall = status === 'exact' ? null : {
    subject: bp.subject,
    variant: variant.id,
    status,
    reason: refusalReason,
    ...(cause ? { cause } : {}),
    excludedRows: prepared.excludedRows,
    minScore,
    built: paper.length,
    eligiblePool: prepared.eligibleCount,
    unseenPool: prepared.standalone.filter((item) => !item.seen).length + prepared.sets.filter((set) => !set.seen).reduce((sum, set) => sum + set.size, 0),
    completeSets: prepared.sets.length,
    deviations: deviations.map(({ kind, key, expected, actual }) => ({ kind, key, expected, actual })),
    excluded: prepared.excludedReasons,
    seenUsed,
    engineVersion: NTA_ENGINE_VERSION,
    blueprintVersion: bp.blueprintVersion,
  };

  return {
    status,
    refusalReason,
    rows: status === 'refused' ? [] : paper.map((entry) => entry.row),
    paper,
    notice: { summary, items },
    refusal: refusalReason ? { reason: refusalReason, ...(cause ? { cause } : {}), message: summary } : null,
    deviations,
    shortfall,
    structure,
    pool: { scored: prepared.scoredCount, eligible: prepared.eligibleCount, seenEligible: prepared.seenEligible, eligibleBySource: prepared.eligibleBySource, standalone: prepared.standalone.length, completeSets: prepared.sets.length, excluded: prepared.excludedReasons },
    timings: { gatesMs, assembleMs, totalMs, levelsTried: results.length },
    engineVersion: NTA_ENGINE_VERSION,
    blueprintVersion: bp.blueprintVersion,
  };
}

// The seed a refusal is worked out with (assembleNtaPaper), so it reads the same on every retry.
const NTA_REFUSAL_SEED = 'nta-refusal';
// Refusals that holding back seen questions can cause: the paper falls short of the serving floor or of
// its reading passages. Only these are worth a repeat-allowed build.
const REPEATABLE_REFUSALS = new Set(['too_few_questions', 'no_passage_sets']);
// How far seen questions are held back in one build (better): the default, then the repeat-allowed builds in turn.
const SEEN_POLICIES = ['seen_first', 'relaxed', 'none'];

/**
 * Builds one NTA paper. rows: the subject's candidate pool (any rows; gates are applied here).
 * options: { subject, variant, seed, seenIds:Set, previousPaperIds:Set, shuffleKey, disputedIds:Set,
 * heldFamilies:Set, minScore, secret, deadline (epoch ms), now, agentScores (tests: replaces
 * data/nta_agent_scores/*.json) }.
 *
 * previousPaperIds: questions served in this student's earlier NTA papers. They are left out of the
 * pool whenever the rest of the pool still gives a paper that can be served; otherwise the paper is
 * built from the whole pool with them treated as seen (used only where nothing new fits), and
 * structure.crossPaper records why.
 * Seen questions (seenIds, and earlier papers in that fallback) are first held back to fill only what
 * new ones cannot. When that leaves a paper below the serving floor, it is built again with repeats
 * allowed, with the same gates, quotas and structure checks: first a seen question gives way only to an
 * equally useful new one ('relaxed'), then, if that is still short, the paper is built as if nothing
 * had been seen ('none'). The notice says how many questions repeat from earlier NTA papers, and
 * structure.repeatFallback (and crossPaper.repeatsAllowed) records every build. So holding back seen
 * questions never causes a refusal on its own.
 * shuffleKey (default: the seed, which the website derives from the session's generation key): the
 * options of each served row are put in an order seeded by this key and the question id, with the key
 * remapped (data/nta_item_checks.js ntaServedRow). result.rows are the served rows; result.paper
 * entries keep the stored row in entry.row and the served row in entry.served.
 *
 * Returns { status: 'exact'|'closest'|'refused', rows (ordered, served), paper (annotated entries),
 * notice: { summary, items }, refusal, deviations, shortfall, structure, timings }.
 */
export function assembleNtaPaper(rows, options = {}) {
  const pool = Array.isArray(rows) ? rows : [];
  // Every build of this call shares each row's gate verdict (prepareCandidates).
  const verdicts = new WeakMap();
  // A paper the bank cannot supply is refused the same way whatever the session's seed: the refusal
  // is worked out once more with a fixed seed, so a student who retries reads the same sentence (and
  // gets that paper if the fixed seed happens to fit it).
  const assembleOnce = (subset, opts) => {
    const result = assembleSeeded(subset, { ...opts, verdicts });
    if (result.status !== 'refused' || result.refusalReason === 'time_budget' || String(opts.seed || '') === NTA_REFUSAL_SEED) return result;
    const again = assembleSeeded(subset, { ...opts, verdicts, seed: NTA_REFUSAL_SEED });
    return again.refusalReason === 'time_budget' ? result : again;
  };
  // Seen questions held back first; while that cannot reach the serving floor, again with repeats allowed.
  const assembleAllowingRepeats = (subset, opts) => {
    let chosen = assembleOnce(subset, { ...opts, seenPolicy: 'seen_first' });
    if (chosen.status !== 'refused' || !REPEATABLE_REFUSALS.has(chosen.refusalReason) || !chosen.pool.seenEligible) return chosen;
    const tried = { seen_first: chosen };
    for (const seenPolicy of SEEN_POLICIES.slice(1)) {
      const built = assembleOnce(subset, { ...opts, seenPolicy });
      tried[seenPolicy] = built;
      // A served paper wins; between short papers, the larger one (its sentence names the most the bank allows).
      if (built.status !== 'refused' || (REPEATABLE_REFUSALS.has(built.refusalReason) && built.paper.length > chosen.paper.length)) chosen = built;
      if (chosen.status !== 'refused' || built.refusalReason === 'time_budget') break;
    }
    chosen.structure.repeatFallback = {
      used: chosen.structure.seenPolicy,
      builds: Object.fromEntries(Object.entries(tried).map(([policy, built]) => [policy, { status: built.status, refusal: built.refusalReason, built: built.paper.length }])),
    };
    return chosen;
  };
  const previous = options.previousPaperIds instanceof Set ? options.previousPaperIds : new Set(options.previousPaperIds || []);
  const seenIds = options.seenIds instanceof Set ? options.seenIds : new Set(options.seenIds || []);
  let result;
  let crossPaper = { previousPaperQuestions: previous.size, leftOut: 0, repeated: 0, fallback: false, reason: null, repeatsAllowed: false };
  if (!previous.size) {
    result = assembleAllowingRepeats(pool, { ...options, seenIds });
  } else {
    const fresh = pool.filter((row) => !previous.has(row?.id));
    const leftOut = pool.length - fresh.length;
    const strict = assembleAllowingRepeats(fresh, { ...options, seenIds });
    if (strict.status !== 'refused' || strict.refusalReason === 'time_budget' || !leftOut) {
      result = strict;
      crossPaper = { ...crossPaper, leftOut };
      if (leftOut) {
        result.pool.excluded = { ...result.pool.excluded, served_in_previous_nta_paper: leftOut };
        if (result.shortfall) result.shortfall.excluded = { ...result.shortfall.excluded, served_in_previous_nta_paper: leftOut };
      }
    } else {
      result = assembleAllowingRepeats(pool, { ...options, seenIds: new Set([...seenIds, ...previous]) });
      crossPaper = {
        ...crossPaper,
        leftOut: 0,
        repeated: result.paper.filter((entry) => previous.has(entry.id)).length,
        fallback: true,
        reason: 'pool_too_small_without_previous_papers',
        repeatsAllowed: result.structure.seenPolicy !== 'seen_first',
        withoutPrevious: { status: strict.status, refusal: strict.refusalReason, built: strict.paper.length },
      };
    }
  }
  result.structure.crossPaper = crossPaper;
  if (result.shortfall) result.shortfall.crossPaper = crossPaper;

  // Served rows: options in a per-session order, key remapped (finding 1 of the 13 Oct review).
  const shuffleKey = String(options.shuffleKey || options.seed || 'nta');
  const shuffle = { shuffled: 0, keptInPlace: 0, reasons: {} };
  for (const entry of result.paper) {
    const served = ntaServedRow(entry.row, shuffleKey);
    entry.served = served.row;
    if (served.shuffled) shuffle.shuffled += 1;
    else {
      shuffle.keptInPlace += 1;
      for (const reason of served.reasons) shuffle.reasons[reason] = (shuffle.reasons[reason] || 0) + 1;
    }
  }
  result.structure.optionShuffle = shuffle;
  result.rows = result.status === 'refused' ? [] : result.paper.map((entry) => entry.served);
  delete result.refusalReason;
  return result;
}

// Kept for callers that only need to know whether a row is a passage child.
export { isPassageLinkedQuestion };
