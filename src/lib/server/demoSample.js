// "Not your subject?" (round 4 H3, owner LK123, 5 Nov 2026): the server half of the home page's subject sample.
// GET /api/sample?subject=<slug>&set=<0..5> (src/app/api/sample/route.js) answers with five live questions of one subject,
// in exactly the shape the sample card plays: the stem, four option texts, the right option's place, the reason and the
// chapter. Signed past-paper provenance adds only the relationship and year. No id, family, evidence or difficulty leaves. The card already shows the right
// option and the reason once a guest answers (its own reveal); this route gives no more than that.
//
// No 'server-only' and no alias imports, so node:test loads it (data/tests/demo_sample_1105.test.mjs); the database is
// passed in. Rules:
//   * Only what Practice would serve: the same readablePracticeQuestions gate (syllabus, answer integrity, publication
//     evidence, family holds) as every student surface, on rows that are live or verified-and-active.
//   * Only what reads well on the card: no passage, no list layout, no formula markup, four plain options, a stem, options
//     and a reason that fit (DEMO_LIMITS).
//   * A bounded public window: for each subject a fixed window of DEMO_POOL_SIZE (30) questions. Stored quality and
//     known syllabus alignment lead the candidate read, with a stable hash for ties and stronger publication evidence first
//     among the rows checked together. Prefer at most DEMO_CHAPTER_CAP from one chapter, cut into six sets of five. The `set` a
//     visitor asks for picks one; it is never a page through the bank, so the questions anyone can see from this route are
//     30 a subject until the bank itself changes.
//   * Egress: one narrow read of the subject's ids (seven small columns, no text), then the window's rows in batches of
//     DEMO_BATCH by id with the columns the gate needs, stopping as soon as the window can be filled (DEMO_MAX_FULL_ROWS at
//     most). Each server keeps a subject's window DEMO_POOL_TTL_MS (an hour: the CDN in front absorbs the traffic, so the
//     memo only has to hold a burst, and a pulled question leaves a warm server within the hour), and the route lets the CDN
//     keep each answer a day, tagged so it can be purged (the runbook line in src/app/api/sample/route.js).
//   * The window is fixed and deliberately small: the same 30 a subject for every visitor until the bank changes. The
//     visitor's set is picked at random among its six, so a retry shows other questions, but never more than those 30
//     (450 in all, answers and reasons included: the accepted ceiling for a public sample). Rotating it (a new salt)
//     exposes 30 more a subject each time; that is the owner's call, not a schedule here.
import { createHash } from 'node:crypto';
import { readablePracticeQuestions } from '../../../data/practice_library.js';
import { sharedEligibilitySnapshot } from '../../../data/evidence_registry.js';
import { isPassageLinkedQuestion } from '../../../data/nta_question_selector.js';
import { formatQuestionText, presentationLint } from '../../../data/question_presentation.mjs';
import { plainOptionTexts } from '../../../data/option_text.js';
import { isServableQuestion, resolveChapter } from '../../../data/cuet_syllabus.js';
import { INVENTORY_COLUMNS, INVENTORY_VISIBLE_FILTER } from '../../../data/inventory_count.js';
import { createTtlMemo } from '../../../data/ttl_memo.js';
import { servedRow } from '../../../data/option_order.js';
import { SUBJECT_PAGES } from '../subjectPages.mjs';
import { DEMO_POOL_SIZE, DEMO_SETS, DEMO_SET_SIZE, demoPastPaperLabel, demoSubject } from '../demoSample.mjs';

export const DEMO_POOL_SALT = 'mockmob-demo-window-v1';
export const DEMO_CHAPTER_CAP = 3;
export const DEMO_BATCH = 36;
export const DEMO_MAX_FULL_ROWS = 240;
export const DEMO_POOL_TTL_MS = 60 * 60 * 1000;
const PAGE = 1000;

// The query already fixes the subject. Read quality in its place and keep text and evidence out of the candidate scan.
export const DEMO_LIGHT_COLUMNS = Object.freeze(['id', 'chapter', 'question_type', 'passage_id', 'passage_group_id', 'is_cuet_syllabus', 'quality_score']);
export const DEMO_LIGHT_SELECT = DEMO_LIGHT_COLUMNS.join(',');
// The second read: the 22 columns the Practice gate is proved on (data/inventory_count.js) and the passage columns the
// passage check reads. The signed evidence record is read only for these few rows.
export const DEMO_FULL_COLUMNS = Object.freeze([...INVENTORY_COLUMNS, 'passage_id', 'passage_group_id', 'passage_type', 'is_cuet_syllabus']);
export const DEMO_FULL_SELECT = DEMO_FULL_COLUMNS.join(',');

// What fits the card on a 360 px phone without crowding it: a stem of a few lines, options of one or two lines, a reason
// the reveal can hold.
export const DEMO_LIMITS = Object.freeze({ stem: 240, option: 90, whyMin: 12, whyMax: 420 });
const FORMULA = /\\\(|\\\[|\$[^$\s][^$]*\$|\\(?:frac|sqrt|times|div|cdot|left|right|begin|text|mathrm)\b|\^\{|_\{/;

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const stemOf = (row) => clean(row.body) || clean(row.question);

/** The visitor's query, checked before anything is read: { ok, slug, subjectId, name, set } or { ok: false, error }. */
export function parseDemoQuery(searchParams) {
  const slug = String(searchParams?.get?.('subject') ?? '');
  const rawSet = String(searchParams?.get?.('set') ?? '');
  const subject = demoSubject(slug);
  const page = SUBJECT_PAGES.find((p) => p.slug === slug);
  if (!subject || !page) return { ok: false, error: 'unknown_subject' };
  if (!new RegExp(`^[0-${DEMO_SETS - 1}]$`).test(rawSet)) return { ok: false, error: 'bad_set' };
  return { ok: true, slug, subjectId: page.id, name: subject.name, set: Number(rawSet) };
}

/** True when a gated row reads well on the sample card (see DEMO_LIMITS). */
export function demoShape(row) {
  const raw = String(row.body ?? row.question ?? '');
  const stem = stemOf(row);
  if (!stem || stem.length > DEMO_LIMITS.stem || /\n/.test(raw.trim()) || formatQuestionText(raw) !== raw || FORMULA.test(stem)) return false;
  if (isPassageLinkedQuestion(row)) return false;
  if (presentationLint(row).length) return false;
  const options = Array.isArray(row.options) ? plainOptionTexts(row.options).map(clean) : [];
  if (options.length !== 4 || options.some((o) => !o || o.length > DEMO_LIMITS.option || FORMULA.test(o))) return false;
  if (!Number.isInteger(row.correct_index) || row.correct_index < 0 || row.correct_index > 3) return false;
  const why = clean(row.explanation);
  return why.length >= DEMO_LIMITS.whyMin && why.length <= DEMO_LIMITS.whyMax && !FORMULA.test(why);
}

/** Only the current signed publication policy authenticates a question's provenance. */
export function demoPastPaper(row, registry) {
  if (row.selection_evidence_tier !== 3) return null;
  const { kind, anchor_id: anchorId, adaptation_type: adaptationType } = row.provenance || {};
  if (!anchorId || (kind !== 'authentic_pyq' && kind !== 'pyq_adapted')) return null;
  if (kind === 'pyq_adapted' && !adaptationType) return null;
  const anchor = registry?.examples?.find((example) => example.id === anchorId && example.subject === row.subject);
  if (anchor?.source_kind !== 'authentic_pyq' || anchor.final_key_matched !== true || anchor.dropped) return null;
  const pastPaper = { kind: kind === 'authentic_pyq' ? 'asked' : 'adapted', year: anchor.year };
  return demoPastPaperLabel(pastPaper) ? pastPaper : null;
}

/** The one shape that leaves the server, per question. */
export function demoQuestionOut(row, subjectId, pastPaper = null) {
  const chapter = clean(row.chapter);
  return {
    q: stemOf(row),
    options: plainOptionTexts(row.options).map(clean),
    correct: row.correct_index,
    why: clean(row.explanation),
    chapter: resolveChapter(subjectId, chapter)?.title || chapter,
    ...(pastPaper ? { pastPaper } : {}),
  };
}

const rank = (id) => createHash('sha256').update(`${DEMO_POOL_SALT}:${id}`).digest('hex');

/** Narrow, ranked candidate ids. Rows without recorded quality stay available to fill a thin subject. */
export async function readDemoCandidates(db, subjectId) {
  const rows = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await db.from('questions').select(DEMO_LIGHT_SELECT).eq('subject', subjectId).eq('is_deleted', false)
      .or(INVENTORY_VISIBLE_FILTER).order('id').range(start, start + PAGE - 1);
    if (error) throw new Error('DEMO_SAMPLE_UNAVAILABLE');
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  const ranked = rows
    .filter((row) => !row.passage_id && !row.passage_group_id && isServableQuestion({ ...row, subject: subjectId }))
    .map((row) => ({
      id: row.id,
      chapter: resolveChapter(subjectId, row.chapter)?.title || clean(row.chapter),
      aligned: Number(row.is_cuet_syllabus === true),
      quality: Number(row.quality_score) || 0,
      rank: rank(row.id),
    }))
    .sort((a, b) => b.quality - a.quality || b.aligned - a.aligned || a.rank.localeCompare(b.rank, 'en'));
  // Give each chapter's best candidate a turn before loading a second from any chapter.
  const byChapter = new Map();
  const spread = ranked.map((row) => {
    const turn = byChapter.get(row.chapter) || 0;
    byChapter.set(row.chapter, turn + 1);
    return { id: row.id, turn };
  });
  return spread.sort((a, b) => a.turn - b.turn).map(({ id }) => id);
}

/**
 * A subject's public window: up to DEMO_POOL_SIZE questions in the card's shape, the strongest eligible candidates with
 * at most DEMO_CHAPTER_CAP from one chapter (topped up from the over-cap ones when the subject has few chapters).
 * `stats`, when given, receives { candidates, fullRowsRead }.
 */
export async function readDemoPool(db, subjectId, { stats = {} } = {}) {
  const order = await readDemoCandidates(db, subjectId);
  const pool = [];
  const over = [];
  const perChapter = new Map();
  stats.candidates = order.length;
  stats.fullRowsRead = 0;
  // Reading stops once the window can be filled at all (the chapter cap spreads what was read; it never buys more reads).
  for (let i = 0; i < order.length && pool.length + over.length < DEMO_POOL_SIZE && stats.fullRowsRead < DEMO_MAX_FULL_ROWS;) {
    const batch = Math.min(DEMO_BATCH, DEMO_MAX_FULL_ROWS - stats.fullRowsRead);
    const ids = order.slice(i, i + batch);
    i += ids.length;
    const { data, error } = await db.from('questions').select(DEMO_FULL_SELECT).in('id', ids).eq('is_deleted', false).or(INVENTORY_VISIBLE_FILTER);
    if (error) throw new Error('DEMO_SAMPLE_UNAVAILABLE');
    stats.fullRowsRead += (data || []).length;
    const readable = new Map((await readablePracticeQuestions(data || [], db)).map((row) => [row.id, row]));
    const registry = sharedEligibilitySnapshot()?.registry;
    const pastPapers = new Map([...readable].map(([id, row]) => [id, demoPastPaper(row, registry)]));
    const evidenceTier = (id) => readable.get(id)?.selection_evidence_tier || 0;
    ids.sort((a, b) => Number(Boolean(pastPapers.get(b))) - Number(Boolean(pastPapers.get(a))) || evidenceTier(b) - evidenceTier(a));
    for (const id of ids) {
      // Served as every other surface serves it (data/option_order.js, LK44): the stable option order, and the key resolved
      // from correct_answer. Bank rows keep correct_index empty (7 Nov 2026: every row), so reading it raw emptied every window.
      const stored = readable.get(id);
      const row = stored ? servedRow(stored).row : null;
      if (!row || !demoShape(row)) continue;
      const out = demoQuestionOut(row, subjectId, pastPapers.get(id));
      const n = perChapter.get(out.chapter) || 0;
      if (n >= DEMO_CHAPTER_CAP) { over.push(out); continue; }
      perChapter.set(out.chapter, n + 1);
      pool.push(out);
      if (pool.length >= DEMO_POOL_SIZE) break;
    }
  }
  while (pool.length < DEMO_POOL_SIZE && over.length) pool.push(over.shift());
  return pool;
}

/** Set `set` of a window (wrapping when the window holds fewer sets), or null when it cannot fill one set of five. */
export function demoSetFrom(pool, set) {
  const sets = Math.floor((Array.isArray(pool) ? pool.length : 0) / DEMO_SET_SIZE);
  if (!sets) return null;
  const at = ((Number(set) % sets) + sets) % sets;
  return {
    set: at,
    questions: pool.slice(at * DEMO_SET_SIZE, (at + 1) * DEMO_SET_SIZE).map((q) => ({
      ...q, options: [...q.options], ...(q.pastPaper ? { pastPaper: { ...q.pastPaper } } : {}),
    })),
  };
}

/**
 * The route's service: `get(query)` answers a parsed query with { subject, name, set, questions } or null (too few
 * questions in that subject today). A subject's window is kept `ttlMs` per server and read once even when several
 * visitors ask at the same moment. `db` is a function so the client is made only when a read is needed.
 */
export function createDemoSample({ db, ttlMs = DEMO_POOL_TTL_MS, now = Date.now } = {}) {
  const memo = createTtlMemo({ ttlMs, max: SUBJECT_PAGES.length, now });
  const pending = new Map();
  const windowOf = (subjectId) => memo.get(subjectId, () => {
    if (!pending.has(subjectId)) pending.set(subjectId, readDemoPool(db(), subjectId).finally(() => pending.delete(subjectId)));
    return pending.get(subjectId);
  });
  return {
    async get({ slug, subjectId, name, set }) {
      const picked = demoSetFrom(await windowOf(subjectId), set);
      return picked ? { subject: slug, name, set: picked.set, questions: picked.questions } : null;
    },
    forget: () => memo.forget(),
  };
}
