// Loads one subject's NTA candidate pool and builds a paper with data/nta_engine.js. Shared by the
// website runtime (data/db.js, with the service-role client) and the read-only production run
// (scripts/nta-engine-run.mjs), so both apply exactly the same gates. Every query here is a select,
// except recordNtaShortfall, which only the runtime calls.
//
// Two ways to read the pool:
//  - index (fast): the signed nta_question_index rows that scripts/nta-index-build.mjs writes after
//    verifying each evidence record offline, then the questions themselves without the evidence
//    column (about 95% of the bytes). The engine re-checks each index row's signature and that the
//    question's content hash is still the one that was scored.
//  - full (fallback): questions with their evidence records, verified at request time. Used while the
//    index table does not exist or holds nothing for the subject, and while the subject's index is older
//    than its newest live question (a question published after the last build must never drop out of NTA
//    papers; the publish script and the daily cron rebuild the index, this keeps the gap harmless).
// Either way, questions that only the agent pass scored (data/nta_agent_scores.js) are added: the ids
// whose committed agent scores already pass every row-free check, read without the evidence column
// and only where the question has no factory evidence (factory evidence always wins).
// Either way the subject's pool is cached in memory for NTA_POOL_CACHE_MS.
import { assembleNtaPaper, getNtaBlueprint, NTA_TIME_BUDGET_MS } from './nta_engine.js';
import { ntaAgentAdmissibleIds } from './nta_agent_scores.js';
import { builtAtOfRows, ntaIndexFreshness } from './nta_index_freshness.js';

// Columns the engine, the hard gates and the session snapshot (questionOut in data/db.js) read.
const SLIM_COLUMNS = [
  'id', 'subject', 'chapter', 'topic', 'concept', 'concept_id', 'body', 'question', 'options', 'correct_answer',
  'correct_index', 'explanation', 'difficulty', 'difficulty_weight', 'status', 'is_deleted', 'verification_state',
  'question_type', 'tags', 'passage_group_id', 'passage_id', 'passage_type', 'passage_text', 'order_index',
  'family_id', 'duplicate_group_id', 'quality_score', 'score', 'upvotes', 'downvotes',
  'pyq_anchor_id', 'anchor_tier', 'source', 'ai_tier', 'ai_score', 'quality_band', 'uploaded_by', 'author_id', 'created_at',
];
// Without the evidence and provenance records: what the index path reads.
export const NTA_SLIM_COLUMNS = SLIM_COLUMNS.join(',');
export const NTA_POOL_COLUMNS = [...SLIM_COLUMNS, 'evidence', 'provenance'].join(',');
export const NTA_INDEX_COLUMNS = 'question_id,subject,score,luna,gemini,content_hash,family_id,objective_tag,index_version,verified_at,signature';
export const NTA_POOL_CACHE_MS = 5 * 60 * 1000;

const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const PAGE = 1000;
const ID_CHUNK = 300;
const poolCache = new Map(); // subject -> { at, rows, source }
let shortfallTableMissing = false;

export function clearNtaPoolCache() {
  poolCache.clear();
  shortfallTableMissing = false;
}

function withSignal(query, signal) {
  return signal && typeof query.abortSignal === 'function' ? query.abortSignal(signal) : query;
}

/** Live, undeleted questions of one subject that carry a score source (evidence record or quality_score), evidence included. */
export async function loadNtaPoolFull(db, subject, { signal } = {}) {
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

/**
 * The subject's signed index rows and their questions without evidence. Returns null when the
 * index table is missing or has nothing for the subject, so the caller falls back to the full read.
 * Also returns null when the index is older than the subject's newest live question (a few small
 * selects, unless checkFresh is false); onStale then receives { builtAt, newestAt }.
 */
export async function loadNtaPoolFromIndex(db, subject, { signal, checkFresh = true, onStale } = {}) {
  const index = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await withSignal(db.from('nta_question_index')
      .select(NTA_INDEX_COLUMNS)
      .eq('subject', subject)
      .order('question_id')
      .range(from, from + PAGE - 1), signal);
    if (error) {
      if (MISSING_TABLE.has(error.code)) return null;
      throw error;
    }
    index.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  if (!index.length) return null;
  if (checkFresh) {
    let freshness;
    try {
      freshness = await ntaIndexFreshness(db, subject, builtAtOfRows(index), { signal });
    } catch (error) {
      // The right answer to "cannot tell" is the full read, but a spent time budget is not ours to hide.
      if (signal?.aborted) throw error;
      freshness = { stale: true, builtAt: null, newestAt: null, checkFailed: error?.message || 'check_failed' };
    }
    if (freshness.stale) {
      console.warn(`[nta-index] stale index for ${subject}: built ${freshness.builtAt}, newest live question ${freshness.newestAt}${freshness.checkFailed ? `, check failed: ${freshness.checkFailed}` : ''}. Reading the full pool.`);
      if (onStale) onStale(freshness);
      return null;
    }
  }
  const byId = new Map(index.map((entry) => [entry.question_id, entry]));
  const ids = [...byId.keys()];
  const rows = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await withSignal(db.from('questions')
      .select(NTA_SLIM_COLUMNS)
      .in('id', ids.slice(i, i + ID_CHUNK))
      .eq('status', 'live')
      .eq('is_deleted', false), signal);
    if (error) throw error;
    for (const row of data || []) rows.push({ ...row, nta_index: byId.get(row.id) });
  }
  return rows;
}

/**
 * Questions of one subject that only the agent pass scored and that are not already in `have`:
 * live, undeleted, without factory evidence, without the evidence column. Select only.
 */
export async function loadNtaAgentRows(db, subject, have = new Set(), { signal, agentScores } = {}) {
  const ids = ntaAgentAdmissibleIds(subject, { agentScores }).filter((id) => !have.has(id));
  const rows = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await withSignal(db.from('questions')
      .select(NTA_SLIM_COLUMNS)
      .in('id', ids.slice(i, i + ID_CHUNK))
      .eq('subject', subject)
      .eq('status', 'live')
      .eq('is_deleted', false)
      .is('evidence', null), signal);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

/** One subject's pool: the index when it exists and is current, else the full read; plus agent-scored rows. An array with .source and .indexStale. */
export async function loadNtaPool(db, subject, { signal, source = 'auto', agentScores } = {}) {
  let indexStale = null;
  const withAgentRows = async (rows, label) => {
    const agentRows = await loadNtaAgentRows(db, subject, new Set(rows.map((row) => row.id)), { signal, agentScores });
    return Object.assign([...rows, ...agentRows], { source: label, agentRows: agentRows.length, indexStale });
  };
  if (source !== 'full') {
    // A forced 'index' read is for measurement and tests: it never falls back, so it skips the freshness check.
    const rows = await loadNtaPoolFromIndex(db, subject, { signal, checkFresh: source !== 'index', onStale: (info) => { indexStale = info; } });
    if (rows) return withAgentRows(rows, 'index');
    if (source === 'index') return withAgentRows([], 'index');
  }
  return withAgentRows(await loadNtaPoolFull(db, subject, { signal }), 'full');
}

// The subject's pool with passages attached, from memory while it is fresh.
async function cachedPool(db, subject, { signal, cache = true, source, agentScores } = {}) {
  const hit = cache ? poolCache.get(subject) : null;
  if (hit && Date.now() - hit.at < NTA_POOL_CACHE_MS) return { rows: hit.rows, source: hit.source, indexStale: hit.indexStale, cached: true };
  const pool = await loadNtaPool(db, subject, { signal, source, agentScores });
  const rows = await attachPassages(db, pool, { signal });
  if (cache) poolCache.set(subject, { at: Date.now(), rows, source: pool.source, indexStale: pool.indexStale });
  return { rows, source: pool.source, indexStale: pool.indexStale, cached: false };
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
  const families = [...new Set(rows.map((row) => row.family_id || row.evidence?.record?.family_id || row.nta_index?.family_id).filter(Boolean))];
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
 * Questions served in this student's earlier NTA papers of this subject: submitted NTA attempts and
 * NTA sessions kept on the server. The engine leaves them out when the pool allows (data/nta_engine.js).
 * A kept session that is still open counts too: its whole paper was on the student's screen, and an
 * open session becomes a submitted attempt anyway once its time and the upload grace are over
 * (src/lib/server/sessionFinaliser.js). Counting it never refuses a paper: when too few new questions
 * are left, the engine builds with repeats allowed and says so in the notice.
 * A failed lookup degrades to "no earlier paper" but is recorded: the returned set has lookupFailed = true,
 * and buildNtaPaper copies that into structure.crossPaper so the paper's record says repeats were not guarded.
 */
export async function loadPreviousNtaPaperIds(db, userId, subject, { signal } = {}) {
  const ids = new Set();
  if (!userId) return ids;
  const settle = (query) => Promise.resolve().then(() => withSignal(query(), signal)).catch((error) => ({ data: null, error }));
  const [attempts, sessions] = await Promise.all([
    // NTA attempts only, newest first: a student with many other attempts in the subject keeps every NTA paper in view.
    settle(() => db.from('attempts').select('questions_snapshot,selection_meta').eq('user_id', userId).eq('subject', subject).eq('selection_meta->>mode', 'nta').order('completed_at', { ascending: false }).limit(40)),
    settle(() => db.from('recovery_sessions').select('questions').eq('user_id', userId).eq('subject', subject).eq('mode', 'nta').order('created_at', { ascending: false }).limit(20)),
  ]);
  if (attempts?.error || sessions?.error) ids.lookupFailed = true;
  for (const attempt of attempts?.data || []) {
    if (attempt?.selection_meta?.mode !== 'nta') continue;
    for (const question of attempt.questions_snapshot || []) if (question?.id) ids.add(question.id);
  }
  for (const session of sessions?.data || []) for (const question of session?.questions || []) if (question?.id) ids.add(question.id);
  return ids;
}

function timeBudgetError(subject) {
  const bp = getNtaBlueprint(subject);
  const label = bp?.subject === 'general_test' ? 'General Test' : String(bp?.officialName || subject).split(' / ')[0];
  const error = new Error('NTA_TIME_BUDGET_EXCEEDED');
  error.publicMessage = `Building the ${label} paper took too long, so it was stopped before it started. Please try again in a minute; if it happens again, try a Full mock for ${label}.`;
  error.publicDetail = { reason: 'time_budget', retryable: true, items: [] };
  return error;
}

/**
 * Reads the pool and builds one paper. options: { userId, seenIds, previousPaperIds, shuffleKey, variant, seed, timeBudgetMs,
 * cache (default true), source ('auto' | 'index' | 'full'), agentScores (tests: replaces the committed agent tables) }.
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
    const [pool, disputedIds, seenIds, previousPaperIds] = await Promise.all([
      cachedPool(db, subject, { signal, cache: options.cache !== false, source: options.source, agentScores: options.agentScores }),
      loadOpenDisputes(db, { signal }),
      options.seenIds ? Promise.resolve(options.seenIds) : loadSeenQuestionIds(db, options.userId, subject, { signal }),
      options.previousPaperIds ? Promise.resolve(options.previousPaperIds) : loadPreviousNtaPaperIds(db, options.userId, subject, { signal }),
    ]);
    const readMs = Date.now() - startedAt;
    const rows = pool.rows;
    const heldFamilies = await loadHeldFamilies(db, rows, { signal });
    const loadMs = Date.now() - startedAt;
    const result = assembleNtaPaper(rows, { subject, variant: options.variant, seed: options.seed, shuffleKey: options.shuffleKey, seenIds, previousPaperIds, disputedIds, heldFamilies, deadline, agentScores: options.agentScores });
    if (previousPaperIds?.lookupFailed) {
      result.structure.crossPaper = { ...result.structure.crossPaper, lookupFailed: true };
      if (result.shortfall) result.shortfall.crossPaper = result.structure.crossPaper;
    }
    result.timings = { ...result.timings, readMs, loadMs, endToEndMs: Date.now() - startedAt, budgetMs: budget, poolSource: pool.source, poolCached: pool.cached, indexStale: Boolean(pool.indexStale) };
    result.pool.loaded = rows.length;
    result.pool.source = pool.source;
    if (pool.indexStale) result.pool.indexStale = pool.indexStale;
    return result;
  } catch (error) {
    if (signal.aborted) throw timeBudgetError(subject);
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
  // Until the migration is applied, one failed insert per server process is enough.
  if (shortfallTableMissing) return false;
  try {
    const { error } = await db.from('nta_paper_shortfalls').insert(row);
    if (error && MISSING_TABLE.has(error.code)) shortfallTableMissing = true;
    else if (error) console.warn('[nta-shortfall] not stored:', error.message);
    return !error;
  } catch (error) {
    console.warn('[nta-shortfall] not stored:', error?.message);
    return false;
  }
}
