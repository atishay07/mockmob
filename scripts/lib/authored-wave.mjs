// Pure helpers for the agent-authored question waves (wave 1: 14 Oct 2026, claude-authored-2026-10-14; wave 2: the same
// day, claude-authored-2026-10-14-w2, docs/brain/reports/authored-w2). The wave a candidate belongs to is its `source`, and one
// publication list holds one wave. Wave 2 adds five subjects, the English verbal item types, Geography case sets (a stem with a
// case passage, stored like a passage child) and one question that completes a wave-1 passage set (`_extends_set`).
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
//  - subject: a candidate names its subject by the PUBLIC id (blueprints, score table files, WAVES), the bank stores the INTERNAL one.
//    The two differ for one paper only: General Test is `general_test` in a candidate and `gat` in every live row (data/cuet_controls.js
//    toInternalSubjectId / toPublicSubjectId). toQuestionRow and toPassageGroupRow map to the internal id, so the rows, the plan hash,
//    the content hash (which covers `subject`, and so the hash the score tables are bound to) and every read of the target use `gat`.
//    The score tables and their files stay keyed by the public id; the engine and data/nta_*_scores.js map `gat` to it.
import { createHash } from 'node:crypto';
import { contentHash } from '../../data/content_evidence.js';
import { toInternalSubjectId } from '../../data/cuet_controls.js';
import { getNtaBlueprint } from '../../data/nta_engine.js';
import { isNtaQuestionId } from '../../data/nta_item_checks.js';

export const AUTHORED_SOURCE = 'claude-authored-2026-10-14';
export const AUTHORED_SOURCE_W2 = 'claude-authored-2026-10-14-w2';
export const AUTHORED_SOURCE_W3 = 'claude-authored-2026-10-17-w3';
export const AUTHORED_WAVE = 1;
export const PUBLISH_VERSION = 'authored-publish-1';
// What a wave is: its source key and the subjects it may hold. Wave 1 behaves exactly as it always did (an unknown source falls back to it).
// verdicts: the `_verdict` values a candidate may carry. Waves 1 and 2 passed an expert pass (ready or repaired). Wave 3 (17 Oct 2026) did not: its
// rows passed one blind Haiku verification (`haiku_blind_verified`), and the rows a second, stronger auditor solved itself carry `opus_audited`.
// The verdict goes into the row tags as expert_review:<verdict>, so the stored rows say which check a question actually had.
// passageSubjects: subjects other than English whose `passage_set_item` candidates are stored as passage sets (Hindi unseen passages, wave 3).
export const WAVES = Object.freeze({
  1: Object.freeze({ wave: 1, source: AUTHORED_SOURCE, subjects: Object.freeze(['chemistry', 'english', 'history', 'political_science', 'psychology', 'sociology']), caseSetSubjects: Object.freeze([]), passageSubjects: Object.freeze([]), verdicts: Object.freeze(['ready', 'repaired']) }),
  2: Object.freeze({ wave: 2, source: AUTHORED_SOURCE_W2, subjects: Object.freeze(['biology', 'computer_science', 'english', 'general_test', 'geography', 'mathematics', 'political_science']), caseSetSubjects: Object.freeze(['geography']), passageSubjects: Object.freeze([]), verdicts: Object.freeze(['ready', 'repaired']) }),
  3: Object.freeze({ wave: 3, source: AUTHORED_SOURCE_W3, subjects: Object.freeze(['chemistry', 'general_test', 'hindi', 'physics']), caseSetSubjects: Object.freeze([]), passageSubjects: Object.freeze(['hindi']), verdicts: Object.freeze(['haiku_blind_verified', 'opus_audited']) }),
});
export const AUTHORED_SOURCES = Object.freeze(Object.values(WAVES).map((entry) => entry.source));
/** Every subject any wave publishes (wave 1's six, then wave 2's additions). */
export const AUTHORED_SUBJECTS = Object.freeze([...WAVES[1].subjects, 'biology', 'computer_science', 'general_test', 'geography', 'mathematics', 'physics', 'hindi']);
/** The wave definition of a source key, or of a candidate (its `source`); wave 1 when unknown. */
export const waveOf = (sourceOrCandidate) => {
  const source = typeof sourceOrCandidate === 'string' ? sourceOrCandidate : sourceOrCandidate?.source;
  return Object.values(WAVES).find((entry) => entry.source === source) || WAVES[1];
};

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
// English verbal item types (wave 2), as the live English rows name them where they exist (correct_word_usage, para_jumble) and
// otherwise as data/nta_blueprints/_types.json dbTypes lists them. QUESTION_TYPE stays the wave-1 vocabulary; every wave reads AUTHORED_QUESTION_TYPE.
export const VERBAL_QUESTION_TYPE = Object.freeze({
  synonym: 'synonym',
  antonym: 'antonym',
  idiom_phrase: 'idiom',
  one_word_substitution: 'one_word_substitution',
  error_detection: 'error_detection',
  fill_in_blank: 'correct_word_usage',
  sentence_rearrangement: 'para_jumble',
});
export const AUTHORED_QUESTION_TYPE = Object.freeze({ ...QUESTION_TYPE, ...VERBAL_QUESTION_TYPE });
// A case-set child of a non-English subject (Geography) is stored like a passage child; its question_type says so (_types.json dbTypes of passage_set_item).
const CASE_SET_QUESTION_TYPE = 'case_based';
export const PASSAGE_KIND = Object.freeze({ 'Factual Passage': 'factual', 'Narrative Passage': 'narrative', 'Literary Passage': 'literary' });
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const MIN_SET_CHILDREN = 2;

const text = (value) => (value === null || value === undefined ? '' : String(value));

/** The deterministic id of a passage group: the same set id always gives the same group id. A wave-2 child that completes a wave-1 set names the wave-1 source. */
export function passageGroupIdOf(setId, source = AUTHORED_SOURCE) {
  return `pg_${createHash('sha256').update(`${source}|${text(setId)}`).digest('hex').slice(0, 32)}`;
}

/** A candidate stored as a child of a passage group: an English passage item, or a case-set item of a subject that has case sets (wave 2: Geography). */
export function isPassageChild(candidate) {
  if (candidate?.type === 'passage_set_item') return true;
  return Boolean(text(candidate?.set_id).trim() && text(candidate?.passage_text).trim() && waveOf(candidate).caseSetSubjects.includes(candidate?.subject));
}

/** The group a set child belongs to: its own set's, or the existing wave-1 group that it completes (`_extends_set: { source, existing_children }`). */
export function groupIdOfCandidate(candidate) {
  return passageGroupIdOf(candidate.set_id, candidate._extends_set?.source || waveOf(candidate).source);
}

function tagsOf(candidate) {
  const ncert = text(candidate.ncert_ref).trim();
  const wave = waveOf(candidate);
  return [
    'cuet',
    'source_kind:claude_authored',
    `authored_run:${wave.source}`,
    `authored_wave:${wave.wave}`,
    `question_type:${AUTHORED_QUESTION_TYPE[candidate.type] || candidate.type}`,
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
  const passage = isPassageChild(candidate);
  return {
    id: candidate.id,
    subject: toInternalSubjectId(candidate.subject),
    chapter: candidate.chapter,
    question: null,
    body: candidate.stem,
    options: (candidate.options || []).map((option) => ({ key: option.key, text: option.text })),
    correct_index: null,
    correct_answer: candidate.correct_key,
    explanation: candidate.explanation,
    difficulty: candidate.difficulty_label,
    difficulty_weight: DIFFICULTY_WEIGHT[candidate.difficulty_label] ?? 2,
    source: waveOf(candidate).source,
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
    question_type: passage && candidate.type !== 'passage_set_item' ? CASE_SET_QUESTION_TYPE : (AUTHORED_QUESTION_TYPE[candidate.type] || null),
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
    id: passageGroupIdOf(setId, first._extends_set?.source || waveOf(first).source),
    subject: toInternalSubjectId(first.subject),
    chapter: first.chapter,
    passage_type: PASSAGE_KIND[first.chapter] || null,
    title: first.chapter,
    passage_text: first.passage_text,
    source: waveOf(first).source,
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
  const listSource = candidates[0]?.source;
  for (const c of candidates) {
    const id = c?.id ?? null;
    const wave = waveOf(c);
    if (!isNtaQuestionId(id)) add(id, 'id_not_uuid');
    if (seen.has(id)) add(id, 'duplicate_id');
    seen.add(id);
    if (!AUTHORED_SOURCES.includes(c.source)) add(id, 'source_not_authored_run');
    else if (c.source !== listSource) add(id, 'source_differs_from_the_rest_of_the_list');
    if (!wave.subjects.includes(c.subject)) add(id, 'subject_not_in_wave');
    if (c._extends_set !== undefined) {
      const extended = c._extends_set;
      if (!AUTHORED_SOURCES.includes(extended?.source) || !Number.isInteger(extended?.existing_children) || extended.existing_children < 1) add(id, 'extends_set_malformed');
      else if (!isPassageChild(c)) add(id, 'extends_set_on_a_standalone_item');
    }
    if (!chapterCache.has(c.subject)) chapterCache.set(c.subject, chaptersOf(c.subject));
    const chapters = chapterCache.get(c.subject);
    if (!chapters) add(id, 'no_blueprint_for_subject');
    else if (chapters.excluded.has(c.chapter)) add(id, 'chapter_excluded_by_blueprint');
    else if (!chapters.names.has(c.chapter)) add(id, 'chapter_not_in_blueprint');
    if (!AUTHORED_QUESTION_TYPE[c.type]) add(id, 'unknown_type');
    if (text(c.stem).trim().length < 10) add(id, 'stem_missing_or_too_short');
    if (!text(c.explanation).trim()) add(id, 'explanation_missing');
    if (!DIFFICULTY_WEIGHT[c.difficulty_label]) add(id, 'difficulty_label_invalid');
    if (!wave.verdicts.includes(c._verdict)) add(id, wave.wave >= 3 ? `verdict_not_one_of_${wave.verdicts.join('_or_')}` : 'expert_verdict_not_ready_or_repaired');
    const options = Array.isArray(c.options) ? c.options : [];
    if (options.length !== 4 || options.some((option, i) => option?.key !== OPTION_KEYS[i] || !text(option?.text).trim())) add(id, 'options_not_four_keyed_A_to_D');
    else if (new Set(options.map((option) => text(option.text).trim().toLowerCase())).size < 4) add(id, 'duplicate_option_text');
    if (!OPTION_KEYS.includes(c.correct_key)) add(id, 'correct_key_invalid');
    const stemKey = `${c.subject}|${text(c.stem).toLowerCase().replace(/\s+/g, ' ').trim()}|${text(c.passage_text).slice(0, 80)}`;
    if (stems.has(stemKey)) add(id, `same_stem_as_${stems.get(stemKey)}`); else stems.set(stemKey, id);
    if (c.type === 'passage_set_item') {
      if (!text(c.passage_text).trim()) add(id, 'passage_text_missing');
      if (!text(c.set_id).trim()) add(id, 'set_id_missing');
      if (c.subject !== 'english' && !wave.caseSetSubjects.includes(c.subject) && !wave.passageSubjects.includes(c.subject)) add(id, 'passage_set_outside_english');
      if (c.subject === 'english' && !PASSAGE_KIND[c.chapter]) add(id, 'passage_chapter_unknown');
      if (text(c.set_id)) sets.set(c.set_id, [...(sets.get(c.set_id) || []), c]);
    } else if (isPassageChild(c)) {
      // A case-set item (Geography, wave 2): a stem of its own type with the case passage and a set id, stored as a passage child.
      if (text(c.set_id)) sets.set(c.set_id, [...(sets.get(c.set_id) || []), c]);
    } else {
      if (text(c.passage_text).trim()) add(id, 'passage_text_on_standalone_item');
      if (text(c.set_id).trim()) add(id, 'set_id_on_standalone_item');
    }
  }
  for (const [setId, children] of sets) {
    const setMax = (chapterCache.get(children[0].subject) || chapterCache.get('english') || { setMax: 5 }).setMax;
    // A wave-2 child that completes a wave-1 set counts the children that set already has in the bank.
    const existing = children[0]._extends_set?.existing_children || 0;
    const total = children.length + existing;
    if (new Set(children.map((child) => child.passage_text)).size !== 1) add(setId, 'set_children_disagree_on_passage');
    if (new Set(children.map((child) => child.chapter)).size !== 1) add(setId, 'set_children_disagree_on_chapter');
    if (new Set(children.map((child) => JSON.stringify(child._extends_set ?? null))).size !== 1) add(setId, 'set_children_disagree_on_extends_set');
    // A set of fewer than two questions is not a set. Fewer than the blueprint's minimum (4) is allowed but reported: the NTA
    // engine does not serve it (passage_set_too_small); practice and full mock still show it.
    if (total < MIN_SET_CHILDREN) add(setId, `set_has_${total}_children_below_minimum_${MIN_SET_CHILDREN}`);
    if (total > setMax) add(setId, `set_has_${total}_children_above_blueprint_maximum_${setMax}`);
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
  const bySet = new Map();
  for (const c of candidates) if (isPassageChild(c) && c.set_id) bySet.set(c.set_id, { first: bySet.get(c.set_id)?.first || c, n: (bySet.get(c.set_id)?.n || 0) + 1 });
  return [...bySet.entries()]
    .map(([setId, { first, n }]) => ({ setId, groupId: groupIdOfCandidate(first), children: n + (first._extends_set?.existing_children || 0), ntaMinimum: getNtaBlueprint(first.subject)?.sets?.size?.min ?? 4 }))
    .filter((set) => set.children < set.ntaMinimum);
}

/**
 * { rows, groups, problems, summary } for a candidate list. Rows keep the candidate order; passage children
 * are numbered 1..n in that order within their set. Nothing is read from or written to any database.
 */
export function planPublication(candidates) {
  const problems = validateCandidates(candidates);
  if (problems.length) return { rows: [], groups: [], problems, summary: null, planHash: null };
  const bySet = new Map();
  for (const c of candidates) if (isPassageChild(c)) bySet.set(c.set_id, [...(bySet.get(c.set_id) || []), c]);
  // A set that completes a wave-1 set has no group row to write: the group is already in the bank (the dry run checks it is).
  const topUpSets = [...bySet.entries()].filter(([, children]) => children[0]._extends_set).map(([setId, children]) => ({
    setId, groupId: groupIdOfCandidate(children[0]), existingChildren: children[0]._extends_set.existing_children, added: children.length, source: children[0]._extends_set.source,
  }));
  const groups = [...bySet.entries()].filter(([, children]) => !children[0]._extends_set).map(([setId, children]) => toPassageGroupRow(setId, children));
  const position = new Map();
  const rows = candidates.map((c) => {
    if (!isPassageChild(c)) return toQuestionRow(c);
    const order = (position.get(c.set_id) ?? (c._extends_set?.existing_children || 0)) + 1;
    position.set(c.set_id, order);
    return toQuestionRow(c, { groupId: groupIdOfCandidate(c), orderIndex: order });
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
    ...(topUpSets.length ? { topUpSets } : {}),
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
