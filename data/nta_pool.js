// Loads one subject's NTA candidate pool and builds a paper with data/nta_engine.js. Shared by the
// website runtime (data/db.js, with the service-role client) and the read-only production run
// (scripts/nta-engine-run.mjs), so both apply exactly the same gates. Every query here is a select,
// except recordNtaShortfall, which only the runtime calls.
import { assembleNtaPaper, NTA_TIME_BUDGET_MS } from './nta_engine.js';

// Columns the engine, the hard gates and the session snapshot (questionOut in data/db.js) read.
export const NTA_POOL_COLUMNS = [
  'id', 'subject', 'chapter', 'topic', 'concept', 'concept_id', 'body', 'question', 'options', 'correct_answer',
  'correct_index', 'explanation', 'difficulty', 'difficulty_weight', 'status', 'is_deleted', 'verification_state',
  'question_type', 'tags', 'passage_group_id', 'passage_id', 'passage_type', 'passage_text', 'order_index',
  'family_id', 'duplicate_group_id', 'quality_score', 'score', 'upvotes', 'downvotes', 'evidence', 'provenance',
  'pyq_anchor_id', 'anchor_tier', 'source', 'ai_tier', 'ai_score', 'quality_band', 'uploaded_by', 'author_id', 'created_at',
].join(',');

const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const PAGE = 1000;

function withSignal(query, signal) {
  return signal && typeof query.abortSignal === 'function' ? query.abortSignal(signal) : query;
}

/** Live, undeleted questions of one subject that carry a score source (evidence record or quality_score). */
export async function loadNtaPool(db, subject, { signal } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await withSignal(db.from('questions')
      .select(NTA_POOL_COLUMNS)
      .eq('subject', subject)
      .eq('status', 'live')
      .eq('is_deleted', false)
      .or('evidence.not.is.null,quality_score.gt.0')
      .order('id')
      .range(from, from + PAGE - 1), signal);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Copies live passage text onto passage children, as the practice reader does. */
export async function attachPassages(db, rows, { signal } = {}) {
  const ids = [...new Set(rows.map((row) => row.passage_group_id).filter(Boolean))];
  if (!ids.length) return rows;
  const { data, error } = await withSignal(db.from('passage_groups')
    .select('id, title, passage_text, passage_type, status, discoverable')
    .in('id', ids), signal);
  if (error) {
    if (MISSING_TABLE.has(error.code) || error.code === '42703') return rows;
    throw error;
  }
  const byId = new Map((data || []).filter((group) => group.status === 'live' && group.discoverable !== false).map((group) => [group.id, group]));
  return rows.map((row) => {
    const group = byId.get(row.passage_group_id);
    if (!group) return row;
    return {
      ...row,
      passage_id: row.passage_id || group.id,
      passage_text: row.passage_text || group.passage_text,
      passage_title: row.passage_title || group.title,
      passage_type: row.passage_type || group.passage_type,
    };
  });
}

/** Questions with an open key dispute. A missing table means no dispute workflow is deployed. */
export async function loadOpenDisputes(db, { signal } = {}) {
  const { data, error } = await withSignal(db.from('question_content_disputes').select('question_id').eq('state', 'open'), signal);
  if (error) {
    if (MISSING_TABLE.has(error.code)) return new Set();
    throw new Error('dispute_lookup_required');
  }
  return new Set((data || []).map((row) => row.question_id));
}

/** Families on hold. Any lookup failure stops the paper: a held family must never reach a student. */
export async function loadHeldFamilies(db, rows, { signal } = {}) {
  const families = [...new Set(rows.map((row) => row.family_id || row.evidence?.record?.family_id).filter(Boolean))];
  const held = new Set();
  for (let i = 0; i < families.length; i += 300) {
    const { data, error } = await withSignal(db.from('recovery_family_holds').select('family_id').in('family_id', families.slice(i, i + 300)), signal);
    if (error) throw new Error('family_hold_lookup_required');
    for (const row of data || []) held.add(row.family_id);
  }
  return held;
}

/** Questions this student has answered in this subject. Lookup failures degrade to "nothing seen". */
export async function loadSeenQuestionIds(db, userId, subject, { signal } = {}) {
  const seen = new Set();
  if (!userId) return seen;
  const [progress, attempts] = await Promise.all([
    withSignal(db.from('user_question_progress').select('question_id').eq('user_id', userId).eq('subject', subject).gt('attempt_count', 0).limit(5000), signal),
    withSignal(db.from('attempts').select('questions_snapshot').eq('user_id', userId).eq('subject', subject).order('completed_at', { ascending: false }).limit(40), signal),
  ]);
  for (const row of progress.data || []) seen.add(row.question_id);
  for (const attempt of attempts.data || []) for (const question of attempt.questions_snapshot || []) if (question?.id) seen.add(question.id);
  return seen;
}

/**
 * Reads the pool and builds one paper. options: { userId, seenIds, variant, seed, timeBudgetMs }.
 * Returns the engine result with timings for each stage added.
 */
export async function buildNtaPaper(db, subject, options = {}) {
  const startedAt = Date.now();
  const budget = Math.min(options.timeBudgetMs || NTA_TIME_BUDGET_MS, NTA_TIME_BUDGET_MS);
  const deadline = startedAt + budget;
  const controller = new AbortController();
  // Reads may use most of the budget; the engine keeps the rest.
  const timer = setTimeout(() => controller.abort(), Math.max(1000, budget - 3000));
  const signal = controller.signal;
  try {
    const [pool, disputedIds, seenIds] = await Promise.all([
      loadNtaPool(db, subject, { signal }),
      loadOpenDisputes(db, { signal }),
      options.seenIds ? Promise.resolve(options.seenIds) : loadSeenQuestionIds(db, options.userId, subject, { signal }),
    ]);
    const readMs = Date.now() - startedAt;
    const rows = await attachPassages(db, pool, { signal });
    const heldFamilies = await loadHeldFamilies(db, rows, { signal });
    const loadMs = Date.now() - startedAt;
    const result = assembleNtaPaper(rows, { subject, variant: options.variant, seed: options.seed, seenIds, disputedIds, heldFamilies, deadline });
    result.timings = { ...result.timings, readMs, loadMs, endToEndMs: Date.now() - startedAt, budgetMs: budget };
    result.pool.loaded = pool.length;
    return result;
  } catch (error) {
    if (signal.aborted) throw new Error('NTA_TIME_BUDGET_EXCEEDED');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keeps what the bank lacked for the content team. The table comes from a saved migration
 * (supabase/migrations/20261013170000_nta_paper_shortfalls.sql); until it is applied the record
 * goes to the server log only.
 */
export async function recordNtaShortfall(db, result) {
  if (!result?.shortfall) return false;
  const row = {
    subject: result.shortfall.subject,
    variant: result.shortfall.variant,
    status: result.shortfall.status,
    reason: result.shortfall.reason,
    built: result.shortfall.built,
    min_score: result.shortfall.minScore,
    eligible_pool: result.shortfall.eligiblePool,
    detail: result.shortfall,
  };
  console.warn('[nta-shortfall]', JSON.stringify(row));
  try {
    const { error } = await db.from('nta_paper_shortfalls').insert(row);
    if (error && !MISSING_TABLE.has(error.code)) console.warn('[nta-shortfall] not stored:', error.message);
    return !error;
  } catch (error) {
    console.warn('[nta-shortfall] not stored:', error?.message);
    return false;
  }
}
