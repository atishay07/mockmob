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
export const NTA_ENGINE_VERSION = 'nta-engine-2026.10.13';
// Two stems at or above this token overlap are the same question for the student.
const NEAR_DUPLICATE_JACCARD = 0.8;
const PAPER_SIZE = 50;

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
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'which', 'what', 'when', 'where', 'does', 'into',
  'only', 'following', 'correct', 'option', 'options', 'choose', 'select', 'given', 'below', 'answer',
  'are', 'was', 'were', 'has', 'have', 'its', 'not', 'one', 'list', 'statement', 'statements',
]);

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
  return text(bp.officialName).split(' / ')[0] || bp.subject;
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
 * The question's score out of 10, read from the database. Two sources exist:
 *  - evidence: the signed factory record's two judge scores, averaged (half points);
 *  - quality_score: the column, stored 0-1 (the code reads it that way), multiplied by 10.
 * Zero in quality_score is the column default and means "no score", not a score of 0.
 */
export function ntaScoreOf(row) {
  const record = row?.evidence?.record;
  const luna = judgeScore(record, 'exam_fit');
  const gemini = judgeScore(record, 'independent_evaluation');
  if (luna !== null || gemini !== null) {
    const score = luna !== null && gemini !== null ? (luna + gemini) / 2 : (luna ?? gemini);
    return { score, source: 'evidence_judges', luna, gemini };
  }
  const column = Number(row?.quality_score ?? row?.qualityScore);
  if (Number.isFinite(column) && column > 0) return { score: Math.round(column * 1000) / 100, source: 'quality_score' };
  return { score: null, source: null };
}

function signatureMatches(envelope, secret) {
  const actual = Buffer.from(String(envelope?.signature || ''));
  for (const body of [canonicalJSON(envelope.record), JSON.stringify(envelope.record)]) {
    const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'));
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
  }
  return false;
}

/**
 * An evidence score counts only while it is provably about this exact question and its key: the
 * record is signed by the backend, names this row, matches the current content hash, was not a mock
 * run, and both blind solvers reached the stored key. Expiry, source registry and calibration state
 * are publication rules, not score rules, and are not checked here.
 */
export function ntaScoreIntegrity(row, { secret = process.env.CUET_EVIDENCE_SIGNING_KEY } = {}) {
  const { source } = ntaScoreOf(row);
  if (source !== 'evidence_judges') return [];
  const envelope = row.evidence;
  const record = envelope?.record;
  if (!secret) return ['score_unverifiable_no_signing_key'];
  const reasons = [];
  if (!envelope?.signature || !signatureMatches(envelope, secret)) reasons.push('score_signature_invalid');
  if (record.candidate_id !== row.id) reasons.push('score_for_another_question');
  if (record.content_hash !== contentHash(row)) reasons.push('question_changed_since_scored');
  if (record.mock === true || record.verifier_version === 'mock') reasons.push('score_from_mock_run');
  const key = canonicalQuestion(row).key;
  if (record.solved_key !== undefined && record.solved_key !== key) reasons.push('blind_solver_key_mismatch');
  const independentKey = record.checks?.independent_evaluation?.solved_key;
  if (independentKey !== undefined && independentKey !== null && independentKey !== key) reasons.push('independent_solver_key_mismatch');
  return reasons;
}

/**
 * Hard gates for one row. Context: { subject, minScore, disputedIds:Set, heldFamilies:Set, secret }.
 */
export function ntaEligibility(row, context = {}) {
  const subject = toInternalSubjectId(text(context.subject || row?.subject));
  const minScore = Number.isFinite(context.minScore) ? context.minScore : NTA_MIN_SCORE;
  const reasons = [];
  const status = text(row?.status).toLowerCase();
  if (row?.is_deleted === true || status !== 'live') reasons.push('not_published');
  if (text(row?.verification_state).toLowerCase() === 'disputed') reasons.push('key_disputed');
  if (context.disputedIds?.has(row?.id)) reasons.push('key_disputed');
  const family = row?.family_id || row?.template_id || row?.evidence?.record?.family_id;
  if (family && context.heldFamilies?.has(family)) reasons.push('family_held');
  if (Number(row?.score ?? 0) < -2) reasons.push('community_voted_down');
  const { score, source } = ntaScoreOf(row);
  if (score === null) reasons.push('no_score');
  else if (score < minScore) reasons.push('score_below_threshold');
  if (score !== null) reasons.push(...ntaScoreIntegrity(row, { secret: context.secret }));
  const answer = verifyAnswerIntegrity(row);
  if (!answer.accepted) reasons.push(...answer.reasons);
  const content = qualityGateNtaQuestion(row, { subjectId: subject });
  if (!content.accepted) reasons.push(...content.reasons);
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], score, scoreSource: source };
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

function optionShapeType(options) {
  const texts = options.map((option) => text(option.text));
  const count = (pattern) => texts.filter((value) => pattern.test(value)).length;
  if (count(/\(?\b[A-D]\b\)?\s*[-–:]\s*\(?\b(?:I{1,3}|IV|[1-4]|i{1,3}|iv)\b\)?/) >= 3) return 'match_the_following';
  if (count(/^\s*(?:statements?\s*)?\(?[A-D]\)?(?:\s*(?:,|and)\s*\(?[A-D]\)?)*\s+only\s*$/i) >= 3
    || count(/^(?:both|all of|neither|none of)\b/i) >= 2 && count(/\bonly\b/i) >= 2) return 'statement_based';
  if (count(/^\s*\(?(?:[A-D]|I{1,3}|IV|V)\)?(?:\s*(?:,|-|–|→|->)\s*\(?(?:[A-D]|I{1,3}|IV|V)\)?){2,}\s*$/) >= 3) return 'sequence_ordering';
  return null;
}

/**
 * The CUET question type of a row, from _types.json. Passage children are 'passage_set_item'.
 * allowedTypes is the blueprint's typeQuotas keys; types outside it are never returned except
 * single_mcq.
 */
export function classifyNtaType(row, subject, allowedTypes) {
  const internal = toInternalSubjectId(text(subject));
  const publicId = toPublicSubjectId(internal);
  if (getPassageKey(row) || getPassageText(row)) return 'passage_set_item';
  const allowed = new Set([...(allowedTypes || TYPE_ORDER), 'single_mcq']);
  const fits = (entry) => allowed.has(entry.type) && appliesTo(entry, publicId);
  const stem = getQuestionText(row);
  const fromDb = (DB_TYPE_MAP.get(storedType(row)) || []).find(fits)?.type || null;
  // English stored types are reliable for vocabulary formats that the stem wording hides.
  if (publicId === 'english' && fromDb && fromDb !== 'single_mcq') return fromDb;
  const byStem = COMPILED_TYPES.find((entry) => fits(entry) && entry.patterns.some((pattern) => pattern.test(stem)))?.type;
  if (byStem) return byStem;
  const byOptions = optionShapeType(normalizeOptions(row?.options, row));
  if (byOptions && allowed.has(byOptions)) return byOptions;
  if (fromDb && fromDb !== 'single_mcq') {
    // A stored "statement" type covers one-statement items too; only labelled statements count.
    if (fromDb !== 'statement_based' || /\(A\)[\s\S]*\(B\)|\bI\.[\s\S]*\bII\./.test(stem)) return fromDb;
  }
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
    total: sections.reduce((sum, section) => sum + section.size, 0),
  };
}

// ---------------------------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------------------------

function stemTokens(stem) {
  return new Set(text(stem).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function difficultyOf(row) {
  const value = text(row?.difficulty).toLowerCase();
  return DIFFICULTIES.includes(value) ? value : 'medium';
}

function familyKeys(row) {
  const keys = [];
  const family = row?.family_id || row?.template_id || row?.evidence?.record?.family_id;
  if (family) keys.push(`family:${family}`);
  if (row?.duplicate_group_id) keys.push(`dup:${row.duplicate_group_id}`);
  return keys;
}

function prepareCandidates(rows, model, context) {
  const subject = model.bp.internalSubject;
  const seen = context.seenIds || new Set();
  const excludedReasons = {};
  const count = (reason) => { excludedReasons[reason] = (excludedReasons[reason] || 0) + 1; };
  const items = [];
  const scores = [];
  for (const row of rows) {
    const verdict = ntaEligibility(row, { ...context, subject });
    if (verdict.score !== null) scores.push(verdict.score);
    if (!verdict.eligible) {
      for (const reason of verdict.reasons) count(reason);
      continue;
    }
    const chapter = text(row.chapter);
    if (model.excluded.has(chapter)) { count('chapter_out_of_syllabus'); continue; }
    const slotIds = model.slotsByChapter.get(chapter) || [];
    if (!slotIds.length) { count('chapter_not_in_this_paper'); continue; }
    const stem = getQuestionText(row);
    items.push({
      id: row.id, row, chapter, slotIds,
      type: classifyNtaType(row, subject, model.allowedTypes),
      difficulty: difficultyOf(row),
      seen: seen.has(row.id),
      score: verdict.score,
      rank: jitter(context.seed, row.id),
      families: familyKeys(row),
      stemKey: stem.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      tokens: stemTokens(stem),
      setKey: getPassageKey(row) || null,
      order: Number(row.order_index ?? row.orderIndex ?? 0) || 0,
    });
  }

  const standalone = [];
  const groups = new Map();
  for (const item of items) {
    if (item.type === 'passage_set_item') groups.set(item.setKey, [...(groups.get(item.setKey) || []), item]);
    else standalone.push(item);
  }

  const sets = [];
  for (const [key, children] of groups) {
    const chapters = new Set(children.map((child) => child.chapter));
    if (chapters.size !== 1) { for (const _ of children) count('passage_set_spans_chapters'); continue; }
    if (!model.sets.enabled || children.length < model.sets.size.min) {
      for (const _ of children) count(model.sets.enabled ? 'passage_set_too_small' : 'passage_set_not_in_this_paper');
      continue;
    }
    // A long set is served with its best-ranked children, in the passage's own order.
    const ordered = children.slice().sort((a, b) => Number(a.seen) - Number(b.seen) || a.rank - b.rank);
    const chosen = ordered.slice(0, model.sets.size.max).sort((a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)));
    const passage = getPassageText(chosen[0].row);
    sets.push({
      key, chapter: chosen[0].chapter, slotIds: chosen[0].slotIds, children: chosen,
      size: chosen.length, seen: chosen.some((child) => child.seen), rank: jitter(context.seed, key),
      passageKey: passage.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 200),
      families: [...new Set(chosen.flatMap((child) => child.families))],
    });
  }
  return { standalone, sets, excludedReasons, scoredCount: scores.length, eligibleCount: items.length };
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

function limitsFor(model, level, setQuestions) {
  const standaloneTotal = model.total - setQuestions;
  return {
    slots: model.slots.map((slot) => rangeOf(slot, level.chapterSlack || 0)),
    units: model.units.map((unit) => rangeOf(unit, level.unitSlack || 0)),
    types: typeLimits(model, standaloneTotal),
    difficulty: difficultyLimits(model, model.total),
    difficultyFree: Boolean(level.difficultyFree),
  };
}

// ---------------------------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------------------------

function newState(model, pool) {
  return {
    pool,
    slot: new Array(model.slots.length).fill(0),
    unit: new Array(model.units.length).fill(0),
    section: new Array(model.sections.length).fill(0),
    type: {},
    difficulty: { easy: 0, medium: 0, hard: 0 },
    picks: [],          // { item, slotId }
    sets: [],           // { set, slotId }
    usedIds: new Set(),
    families: new Set(),
    passageKeys: new Set(),
    blockers: new Map(), // candidate id -> number of picked questions it would repeat
  };
}

function conflictPair(a, b) {
  if (a.id === b.id) return false;
  if (a.families.some((key) => b.families.includes(key))) return true;
  if (a.stemKey && a.stemKey === b.stemKey) return true;
  return jaccard(a.tokens, b.tokens) >= NEAR_DUPLICATE_JACCARD;
}

// Picking a question blocks every candidate that would repeat it; removing it unblocks them.
function markBlockers(state, item, sign) {
  for (const other of state.pool) {
    if (!conflictPair(item, other)) continue;
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
  return { minGain, targetGain };
}

// Unseen questions always first; seen ones fill only what unseen ones cannot, and the repair pass
// swaps in a seen question only for a minimum no unseen question can meet. Then unmet minimums,
// then targets, then the seed.
function better(a, b) {
  if (!b) return true;
  if (a.item.seen !== b.item.seen) return !a.item.seen;
  if ((a.minGain > 0) !== (b.minGain > 0)) return a.minGain > 0;
  if (a.minGain !== b.minGain) return a.minGain > b.minGain;
  if (a.targetGain !== b.targetGain) return a.targetGain > b.targetGain;
  return a.item.rank < b.item.rank;
}

function pickSets(model, state, sets, limits) {
  if (!model.sets.enabled) return;
  const want = model.sets.count.target;
  const kindsWanted = model.sets.distinctKindsMin || 1;
  const ordered = sets.slice().sort((a, b) =>
    Number(a.seen) - Number(b.seen)
    || Math.abs(a.size - model.sets.size.target) - Math.abs(b.size - model.sets.size.target)
    || a.rank - b.rank);
  for (let pass = 0; pass < 2 && state.sets.length < want; pass += 1) {
    for (const set of ordered) {
      if (state.sets.length >= want) break;
      if (state.sets.some((entry) => entry.set === set)) continue;
      if (state.passageKeys.has(set.passageKey) || set.families.some((key) => state.families.has(key))) continue;
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
        if (better(candidate, best)) best = candidate;
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
  return unmet;
}

function servesDimension(model, dimension, item, slotId) {
  const slot = model.slots[slotId];
  if (dimension.kind === 'slot') return slotId === dimension.id;
  if (dimension.kind === 'unit') return slot.unitId === dimension.id;
  if (dimension.kind === 'type') return item.type === dimension.id;
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
      incoming.sort((a, b) => Number(a.item.seen) - Number(b.item.seen) || a.item.rank - b.item.rank);
      const outgoing = state.picks.slice().sort((a, b) => Number(b.item.seen) - Number(a.item.seen) || b.item.rank - a.item.rank);
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

function runLevel(model, prepared, level, deadline) {
  const state = newState(model, prepared.standalone);
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
  while (pending.length) {
    let index = pending.findIndex((entry) =>
      (!maxChapterRun || runOf('chapter', entry.chapter) < maxChapterRun)
      && (!maxTypeRun || !typeRunApplies(entry.type) || runOf('type', entry.type) < maxTypeRun));
    if (index < 0) index = 0;
    out.push(pending.splice(index, 1)[0]);
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

  // Duplicates.
  const ids = new Set();
  const families = new Set();
  const stems = [];
  for (const entry of paper) {
    if (ids.has(entry.id)) add('duplicate', entry.id, 'unique question', 'repeated', 'structure');
    ids.add(entry.id);
    for (const key of familyKeys(entry.row)) {
      if (families.has(key) && entry.setIndex === null) add('duplicate', key, 'one question per family', 'repeated family', 'structure');
      families.add(key);
    }
    if (entry.setIndex === null) {
      const tokens = stemTokens(getQuestionText(entry.row));
      if (stems.some((other) => jaccard(tokens, other) >= NEAR_DUPLICATE_JACCARD)) add('duplicate', entry.id, 'no near-duplicate stems', 'near-duplicate', 'structure');
      stems.push(tokens);
    }
  }

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

  // Difficulty mix of the whole paper.
  const difficulty = countBy(paper.map((entry) => entry.difficulty));
  for (const key of DIFFICULTIES) {
    const range = model.difficulty[key];
    const share = total ? (difficulty[key] || 0) / total : 0;
    if (share < range.min - 1e-9 || share > range.max + 1e-9) add('difficulty', key, `${Math.round(range.min * 100)}-${Math.round(range.max * 100)}%`, `${Math.round(share * 100)}%`);
  }

  // Order: chapter and special-type runs inside the standalone block.
  const english = bp.subject === 'english';
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

function describe(deviations, model, paper, extras) {
  const lines = [];
  const subject = subjectLabel(model.bp);
  const total = paper.length;
  if (total !== model.total) lines.push(`This paper has ${total} questions instead of ${model.total}: the question bank does not have enough questions that meet the quality bar and fit the ${subject} pattern.`);
  const substituted = deviations.find((deviation) => deviation.kind === 'sets_substituted');
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
  if (deviations.some((deviation) => deviation.kind === 'difficulty')) {
    const counts = countBy(paper.map((entry) => entry.difficulty));
    const target = DIFFICULTIES.map((key) => Math.round(model.difficulty[key].target * 100));
    lines.push(`Difficulty mix: ${counts.easy || 0} easy, ${counts.medium || 0} medium and ${counts.hard || 0} hard; the CUET pattern is about ${target[0]}% easy, ${target[1]}% medium and ${target[2]}% hard.`);
  }
  if (deviations.some((deviation) => deviation.kind === 'set_kinds')) lines.push('Both reading passages are of the same kind; the real paper mixes factual, narrative and literary passages.');
  if (deviations.some((deviation) => deviation.kind === 'order_chapter_run' || deviation.kind === 'order_type_run')) lines.push('A few questions of the same kind sit next to each other more often than in the real paper.');
  if (extras.paragraphJumbles) lines.push(`The ${extras.paragraphJumbles} rearrangement question${extras.paragraphJumbles === 1 ? ' orders' : 's order'} sentences of a paragraph; the real paper rearranges parts of one sentence.`);
  if (extras.seenUsed) lines.push(`${extras.seenUsed} question${extras.seenUsed === 1 ? ' is one' : 's are ones'} you have answered before: there are not enough new questions that fit the pattern.`);
  return lines;
}

function refusal(model, reason, details) {
  const subject = subjectLabel(model.bp);
  const tryInstead = `Try a Full Mock for ${subject} instead; it uses the wider question bank.`;
  const messages = {
    no_scored_questions: details.scored
      ? `NTA mode is not ready for ${subject} yet: none of its questions has a quality score of ${details.minScore} or more out of 10. ${tryInstead}`
      : `NTA mode is not ready for ${subject} yet: its questions have not been quality-scored, and NTA mode uses only questions scoring ${details.minScore} or more out of 10. ${tryInstead}`,
    no_passage_sets: `NTA mode for ${subject} needs ${model.sets.count.min} complete reading passages with ${model.sets.size.min} to ${model.sets.size.max} questions each, as in the real paper. The bank has ${details.sets} such passage${details.sets === 1 ? '' : 's'} that meet${details.sets === 1 ? 's' : ''} the quality bar right now. ${tryInstead}`,
    too_few_questions: `NTA mode for ${subject} could place only ${details.total} of ${model.total} questions in the CUET pattern from questions that meet the quality bar, so it would not be a fair exam paper. ${tryInstead}`,
    time_budget: `Building the ${subject} paper took too long, so it was stopped. Please try again in a minute.`,
    engine_error: `The ${subject} paper could not be laid out correctly, so it was not started. Please try again; if it happens again, try a Full Mock for ${subject}.`,
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

/**
 * Builds one NTA paper. rows: the subject's candidate pool (any rows; gates are applied here).
 * options: { subject, variant, seed, seenIds:Set, disputedIds:Set, heldFamilies:Set, minScore,
 * secret, deadline (epoch ms), now }.
 * Returns { status: 'exact'|'closest'|'refused', rows (ordered), paper (annotated entries),
 * notice: { summary, items }, refusal, deviations, shortfall, structure, timings }.
 */
export function assembleNtaPaper(rows, options = {}) {
  const startedAt = Date.now();
  const bp = getNtaBlueprint(options.subject);
  if (!bp) throw new Error('NTA_BLUEPRINT_MISSING');
  const variant = resolveNtaVariant(bp, options.variant);
  const model = buildModel(bp, variant);
  const deadline = Math.min(options.deadline || Infinity, startedAt + NTA_TIME_BUDGET_MS);
  const minScore = Number.isFinite(options.minScore) ? options.minScore : NTA_MIN_SCORE;
  const seed = String(options.seed || 'nta');
  const context = { ...options, minScore, seed };

  const prepared = prepareCandidates(Array.isArray(rows) ? rows : [], model, context);
  const gatesMs = Date.now() - startedAt;

  const results = [];
  for (const level of LEVELS) {
    if (Date.now() > deadline) break;
    const result = runLevel(model, prepared, level, deadline);
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
  const extras = { seenUsed, paragraphJumbles: bp.subject === 'english' ? englishParagraphJumbles(paper) : 0 };
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
  else if (deviations.length || extras.seenUsed || extras.paragraphJumbles) status = 'closest';

  // A refusal for a thin bank still says what the bank is short of; other refusals need no list.
  const items = status !== 'refused' ? describe(deviations, model, paper, extras)
    : refusalReason === 'too_few_questions' ? describe(deviations, model, paper, {}).filter((line) => !line.startsWith('This paper has')) : [];
  const subject = subjectLabel(bp);
  const summary = status === 'exact'
    ? `${subject}: 50 questions in the CUET ${subject} pattern.`
    : status === 'closest'
      ? `This ${subject} paper follows the CUET pattern as closely as the question bank allows. What differs from the real paper:`
      : refusal(model, refusalReason, { minScore, scored: prepared.scoredCount, sets: prepared.sets.length, total: paper.length });
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
  };

  const shortfall = status === 'exact' ? null : {
    subject: bp.subject,
    variant: variant.id,
    status,
    reason: refusalReason,
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
    rows: status === 'refused' ? [] : paper.map((entry) => entry.row),
    paper,
    notice: { summary, items },
    refusal: refusalReason ? { reason: refusalReason, message: summary } : null,
    deviations,
    shortfall,
    structure,
    pool: { scored: prepared.scoredCount, eligible: prepared.eligibleCount, standalone: prepared.standalone.length, completeSets: prepared.sets.length, excluded: prepared.excludedReasons },
    timings: { gatesMs, assembleMs, totalMs, levelsTried: results.length },
    engineVersion: NTA_ENGINE_VERSION,
    blueprintVersion: bp.blueprintVersion,
  };
}

// Kept for callers that only need to know whether a row is a passage child.
export { isPassageLinkedQuestion };
