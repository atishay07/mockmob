// Pure helpers for the agent-authored question waves (wave 1: 14 Oct 2026, claude-authored-2026-10-14).
// A candidate in docs/brain/reports/authored/wave1-candidates-2026-10-14.json goes in, the exact rows the
// live bank would hold come out: a `questions` row per candidate and a `passage_groups` row per English set.
// No database, no network, no model. scripts/question-publish-authored.mjs writes these rows;
// scripts/authored-scores-merge.mjs hashes them (the NTA score tables are bound to this exact mapping).
//
// How the rows are shaped (all of it mirrors the live, verified rows that were exported on 13 Oct 2026):
//  - body / correct_answer / options [{ key, text }]; `question` and `correct_index` stay null, as on 5,324 of
//    the 5,339 live rows (the other 15 are the old seeds).
//  - status live, verification_state verified, exploration_state active: the state the NTA pool index and
//    the practice reader both read (VISIBLE_QUESTION_FILTER in data/db.js, idx_questions_nta_pool).
//  - evidence, provenance and legacy_screening stay NULL on purpose. data/question_factory_policy.mjs
//    isEvidenceManaged() treats any row with provenance as factory-managed, and data/practice_availability.js
//    then hides it from practice unless it carries a full signed evidence record. Where these questions
//    came from is recorded in `source`, in `tags`, in the NTA score tables and in the restore file instead.
//  - the DB `content_hash` column stays NULL (it is body + key only and unique among undeleted rows; many
//    English passage questions share a generic stem and key). The NTA content hash (data/content_evidence.js
//    contentHash) is computed from this very row by contentHashOf() below.
//  - English passage sets: one passage_groups row per set (id pg_<32 hex>, derived from the set id so a
//    re-run produces the same id), every child carries passage_group_id, passage_id, passage_text and a
//    1-based order_index.
import { createHash } from 'node:crypto';
import { contentHash } from '../../data/content_evidence.js';
import { getNtaBlueprint } from '../../data/nta_engine.js';
import { isNtaQuestionId } from '../../data/nta_item_checks.js';

export const AUTHORED_SOURCE = 'claude-authored-2026-10-14';
export const AUTHORED_WAVE = 1;
export const PUBLISH_VERSION = 'authored-publish-1';
export const AUTHORED_SUBJECTS = Object.freeze(['chemistry', 'english', 'history', 'political_science', 'psychology', 'sociology']);

const DIFFICULTY_WEIGHT = Object.freeze({ easy: 1, medium: 2, hard: 3 });
// The authored type names to the question_type vocabulary already in the live bank (data/nta_blueprints/_types.json dbTypes).
export const QUESTION_TYPE = Object.freeze({
  single_mcq: 'conceptual_mcq',
  statement_based: 'statement_based',
  sequence_ordering: 'sequence_ordering',
  match_the_following: 'match_the_following',
  assertion_reason: 'assertion_reason',
  passage_set_item: 'reading_comprehension',
});
export const PASSAGE_KIND = Object.freeze({ 'Factual Passage': 'factual', 'Narrative Passage': 'narrative', 'Literary Passage': 'literary' });
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const MIN_SET_CHILDREN = 2;

const text = (value) => (value === null || value === undefined ? '' : String(value));

/** The deterministic id of a passage group: the same set id always gives the same group id. */
export function passageGroupIdOf(setId) {
  return `pg_${createHash('sha256').update(`${AUTHORED_SOURCE}|${text(setId)}`).digest('hex').slice(0, 32)}`;
}

function tagsOf(candidate) {
  const ncert = text(candidate.ncert_ref).trim();
  return [
    'cuet',
    'source_kind:claude_authored',
    `authored_run:${AUTHORED_SOURCE}`,
    `authored_wave:${AUTHORED_WAVE}`,
    `question_type:${QUESTION_TYPE[candidate.type] || candidate.type}`,
    ...(text(candidate.unit) ? [`unit:${text(candidate.unit)}`] : []),
    ...(candidate._verdict ? [`expert_review:${candidate._verdict}`] : []),
    ...(candidate._reworded ? ['authored_revision:reworded'] : []),
    ...(ncert ? [`ncert:${ncert.slice(0, 240)}`] : []),
  ];
}

/**
 * One candidate as the questions row it becomes. groupId and orderIndex are set for passage children
 * (planPublication supplies them); liveAt is stamped at apply time and stays null in a plan.
 */
export function toQuestionRow(candidate, { groupId = null, orderIndex = null, liveAt = null } = {}) {
  const passage = candidate.type === 'passage_set_item';
  return {
    id: candidate.id,
    subject: candidate.subject,
    chapter: candidate.chapter,
    question: null,
    body: candidate.stem,
    options: (candidate.options || []).map((option) => ({ key: option.key, text: option.text })),
    correct_index: null,
    correct_answer: candidate.correct_key,
    explanation: candidate.explanation,
    difficulty: candidate.difficulty_label,
    difficulty_weight: DIFFICULTY_WEIGHT[candidate.difficulty_label] ?? 2,
    source: AUTHORED_SOURCE,
    status: 'live',
    verification_state: 'verified',
    exploration_state: 'active',
    exploration_lane: 'none',
    ai_tier: 'PENDING',
    quality_band: 'unrated',
    uploaded_by: null,
    author_id: null,
    tags: tagsOf(candidate),
    topic: text(candidate.unit) || null,
    question_type: QUESTION_TYPE[candidate.type] || null,
    passage_group_id: passage ? groupId : null,
    passage_id: passage ? groupId : null,
    passage_type: passage ? (PASSAGE_KIND[candidate.chapter] || null) : null,
    passage_text: passage ? candidate.passage_text : null,
    order_index: passage ? orderIndex : null,
    is_deleted: false,
    live_at: liveAt,
  };
}

/** The passage_groups row of one English set (children share the passage text and chapter). */
export function toPassageGroupRow(setId, children) {
  const first = children[0];
  return {
    id: passageGroupIdOf(setId),
    subject: first.subject,
    chapter: first.chapter,
    passage_type: PASSAGE_KIND[first.chapter] || null,
    title: first.chapter,
    passage_text: first.passage_text,
    source: AUTHORED_SOURCE,
    difficulty: null,
    status: 'live',
    discoverable: true,
    mode_visibility: ['full_mock', 'nta_mode'],
  };
}

/** Columns a questions insert writes (the dry run probes that each exists in the target table). */
export const QUESTION_COLUMNS = Object.freeze(Object.keys(toQuestionRow({ type: 'single_mcq', options: [] })));
export const GROUP_COLUMNS = Object.freeze(Object.keys(toPassageGroupRow('x', [{}])));

/**
 * The content hash the NTA score tables bind to (data/content_evidence.js contentHash): the hash of the row exactly
 * as the bank will hold it. `overlay` swaps in other text fields of the candidate (the pre-repair text the judges saw).
 */
export function contentHashOf(candidate, { overlay = null, groupId = null, orderIndex = null } = {}) {
  return contentHash(toQuestionRow({ ...candidate, ...(overlay || {}) }, { groupId, orderIndex }));
}

// ---------------------------------------------------------------------------------------------
// Validation: a candidate that fails any of this is never mapped
// ---------------------------------------------------------------------------------------------

function chaptersOf(subject) {
  const blueprint = getNtaBlueprint(subject);
  if (!blueprint) return null;
  const names = new Set();
  for (const variant of blueprint.variants) for (const section of variant.sections) for (const unit of section.units) {
    for (const chapter of unit.chapters) { names.add(chapter.name); for (const alias of chapter.aliases || []) names.add(alias); }
  }
  const excluded = new Set((blueprint.excludedChapters || []).map((entry) => entry.name));
  return { names, excluded, setMin: blueprint.sets?.size?.min ?? 2, setMax: blueprint.sets?.size?.max ?? 10 };
}

/**
 * Structural problems of a candidate list: [{ id, problem }]. Empty means every candidate can be mapped.
 * Subject and chapter must exist in the blueprint (an unknown chapter is "chapter_not_in_this_paper" in the
 * engine and never served), keys and options must be well formed, and a passage set must be complete.
 */
export function validateCandidates(candidates) {
  const problems = [];
  const add = (id, problem) => problems.push({ id, problem });
  if (!Array.isArray(candidates) || !candidates.length) return [{ id: null, problem: 'no_candidates' }];
  const seen = new Set();
  const sets = new Map();
  const stems = new Map();
  const chapterCache = new Map();
  for (const c of candidates) {
    const id = c?.id ?? null;
    if (!isNtaQuestionId(id)) add(id, 'id_not_uuid');
    if (seen.has(id)) add(id, 'duplicate_id');
    seen.add(id);
    if (c.source !== AUTHORED_SOURCE) add(id, 'source_not_authored_run');
    if (!AUTHORED_SUBJECTS.includes(c.subject)) add(id, 'subject_not_in_wave');
    if (!chapterCache.has(c.subject)) chapterCache.set(c.subject, chaptersOf(c.subject));
    const chapters = chapterCache.get(c.subject);
    if (!chapters) add(id, 'no_blueprint_for_subject');
    else if (chapters.excluded.has(c.chapter)) add(id, 'chapter_excluded_by_blueprint');
    else if (!chapters.names.has(c.chapter)) add(id, 'chapter_not_in_blueprint');
    if (!QUESTION_TYPE[c.type]) add(id, 'unknown_type');
    if (text(c.stem).trim().length < 10) add(id, 'stem_missing_or_too_short');
    if (!text(c.explanation).trim()) add(id, 'explanation_missing');
    if (!DIFFICULTY_WEIGHT[c.difficulty_label]) add(id, 'difficulty_label_invalid');
    if (!['ready', 'repaired'].includes(c._verdict)) add(id, 'expert_verdict_not_ready_or_repaired');
    const options = Array.isArray(c.options) ? c.options : [];
    if (options.length !== 4 || options.some((option, i) => option?.key !== OPTION_KEYS[i] || !text(option?.text).trim())) add(id, 'options_not_four_keyed_A_to_D');
    else if (new Set(options.map((option) => text(option.text).trim().toLowerCase())).size < 4) add(id, 'duplicate_option_text');
    if (!OPTION_KEYS.includes(c.correct_key)) add(id, 'correct_key_invalid');
    const stemKey = `${c.subject}|${text(c.stem).toLowerCase().replace(/\s+/g, ' ').trim()}|${text(c.passage_text).slice(0, 80)}`;
    if (stems.has(stemKey)) add(id, `same_stem_as_${stems.get(stemKey)}`); else stems.set(stemKey, id);
    if (c.type === 'passage_set_item') {
      if (!text(c.passage_text).trim()) add(id, 'passage_text_missing');
      if (!text(c.set_id).trim()) add(id, 'set_id_missing');
      if (c.subject !== 'english') add(id, 'passage_set_outside_english');
      if (!PASSAGE_KIND[c.chapter]) add(id, 'passage_chapter_unknown');
      if (text(c.set_id)) sets.set(c.set_id, [...(sets.get(c.set_id) || []), c]);
    } else {
      if (text(c.passage_text).trim()) add(id, 'passage_text_on_standalone_item');
      if (text(c.set_id).trim()) add(id, 'set_id_on_standalone_item');
    }
  }
  const { setMax } = chapterCache.get('english') || { setMax: 5 };
  for (const [setId, children] of sets) {
    if (new Set(children.map((child) => child.passage_text)).size !== 1) add(setId, 'set_children_disagree_on_passage');
    if (new Set(children.map((child) => child.chapter)).size !== 1) add(setId, 'set_children_disagree_on_chapter');
    // A set of fewer than two questions is not a set. Fewer than the blueprint's minimum (4) is allowed but reported: the NTA
    // engine does not serve it (passage_set_too_small); practice and full mock still show it.
    if (children.length < MIN_SET_CHILDREN) add(setId, `set_has_${children.length}_children_below_minimum_${MIN_SET_CHILDREN}`);
    if (children.length > setMax) add(setId, `set_has_${children.length}_children_above_blueprint_maximum_${setMax}`);
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// The plan: every row and group this run would write
// ---------------------------------------------------------------------------------------------

const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
// Line endings are normalised first: a Windows checkout with autocrlf turns the committed LF files into CRLF, and the hash must not change with it.
export const sha256OfFile = (buffer) => createHash('sha256').update(Buffer.from(buffer).toString('utf8').replace(/\r\n/g, '\n')).digest('hex');

/** Sets with fewer children than the English blueprint's minimum: [{ setId, groupId, children, ntaMinimum }]. Warnings, not errors. */
export function smallSets(candidates) {
  const minimum = getNtaBlueprint('english')?.sets?.size?.min ?? 4;
  const bySet = new Map();
  for (const c of candidates) if (c.type === 'passage_set_item' && c.set_id) bySet.set(c.set_id, (bySet.get(c.set_id) || 0) + 1);
  return [...bySet.entries()].filter(([, n]) => n < minimum).map(([setId, children]) => ({ setId, groupId: passageGroupIdOf(setId), children, ntaMinimum: minimum }));
}

/**
 * { rows, groups, problems, summary } for a candidate list. Rows keep the candidate order; passage children
 * are numbered 1..n in that order within their set. Nothing is read from or written to any database.
 */
export function planPublication(candidates) {
  const problems = validateCandidates(candidates);
  if (problems.length) return { rows: [], groups: [], problems, summary: null, planHash: null };
  const bySet = new Map();
  for (const c of candidates) if (c.type === 'passage_set_item') bySet.set(c.set_id, [...(bySet.get(c.set_id) || []), c]);
  const groups = [...bySet.entries()].map(([setId, children]) => toPassageGroupRow(setId, children));
  const position = new Map();
  const rows = candidates.map((c) => {
    if (c.type !== 'passage_set_item') return toQuestionRow(c);
    const order = (position.get(c.set_id) || 0) + 1;
    position.set(c.set_id, order);
    return toQuestionRow(c, { groupId: passageGroupIdOf(c.set_id), orderIndex: order });
  });
  const count = (items, key) => items.reduce((by, item) => { const k = key(item); by[k] = (by[k] || 0) + 1; return by; }, {});
  const summary = {
    questions: rows.length,
    passageGroups: groups.length,
    bySubject: count(rows, (row) => row.subject),
    byType: count(rows, (row) => row.question_type),
    byDifficulty: count(rows, (row) => row.difficulty),
    byExpertReview: count(candidates, (c) => c._verdict),
    passageChildrenBySet: Object.fromEntries(groups.map((group) => [group.id, rows.filter((row) => row.passage_group_id === group.id).length])),
    passageSetsBelowNtaMinimum: smallSets(candidates),
    chapters: Object.keys(count(rows, (row) => `${row.subject}/${row.chapter}`)).length,
  };
  return { rows, groups, problems: [], summary, planHash: sha256({ rows, groups }) };
}

// ---------------------------------------------------------------------------------------------
// The final candidate list: the wave-1 candidates with the questions that failed the fresh pass dropped and the engine-refused
// ones reworded (same ids). Pure: nothing is read from or written to disk here.
// ---------------------------------------------------------------------------------------------

/** The fields a rewording may change. Identity (id, subject, chapter, type, set, passage) must stay as it was. */
export const REWORD_FIELDS = Object.freeze(['unit', 'stem', 'options', 'correct_key', 'explanation', 'difficulty_label', 'ncert_ref']);
const IDENTITY_FIELDS = Object.freeze(['subject', 'chapter', 'type', 'set_id', 'passage_text']);

/**
 * { candidates, dropped, problems }. drops: [{ id, reason }]; reworded: candidates with the same ids as the ones they replace.
 * A reworded question keeps its expert verdict and gets _reworded: true; a dropped one is listed with its reason.
 */
export function buildFinalCandidates(base, reworded, drops) {
  const problems = [];
  const baseById = new Map(base.map((c) => [c.id, c]));
  const dropIds = new Set(drops.map((d) => d.id));
  const rewordById = new Map(reworded.map((c) => [c.id, c]));
  for (const id of dropIds) if (!baseById.has(id)) problems.push({ id, problem: 'dropped_id_not_in_base' });
  for (const drop of drops) if (!text(drop.reason).trim()) problems.push({ id: drop.id, problem: 'dropped_without_reason' });
  for (const [id, c] of rewordById) {
    const original = baseById.get(id);
    if (!original) { problems.push({ id, problem: 'reworded_id_not_in_base' }); continue; }
    if (dropIds.has(id)) problems.push({ id, problem: 'reworded_and_dropped' });
    for (const field of IDENTITY_FIELDS) if (JSON.stringify(c[field] ?? null) !== JSON.stringify(original[field] ?? null)) problems.push({ id, problem: `reworded_${field}_differs` });
  }
  const candidates = [];
  for (const c of base) {
    if (dropIds.has(c.id)) continue;
    const r = rewordById.get(c.id);
    if (!r) { candidates.push(c); continue; }
    const changed = { ...c };
    for (const field of REWORD_FIELDS) if (field in r) changed[field] = r[field];
    changed._reworded = true;
    candidates.push(changed);
  }
  const dropped = drops.map((d) => ({ ...d, subject: baseById.get(d.id)?.subject ?? null, set_id: baseById.get(d.id)?.set_id ?? null }));
  return { candidates, dropped, problems };
}
