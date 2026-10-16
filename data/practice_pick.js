// Practice and full-mock question picking (data/db.js getQuestions), without copying the whole
// subject on every session start.
//
// Before: every start read EVERY matching question of the subject with every column, including
// the evidence record (about 38 KB each), then ranked and picked 10-50. A Commerce subject cost
// 6-8 MB per start.
//
// Now (the slim path): read the subject WITHOUT the evidence and provenance columns, which are
// 65-75% of the bytes and exist only on the 140-190 evidence-managed rows per subject. Rank with
// the light rows, then read full rows (with evidence) only for the questions that decide the
// result. The picks are identical to the full read by construction:
//
//  1. Rows without evidence or provenance ("legacy" rows) are judged on their light columns by the
//     same readablePracticeQuestions the full path uses; every verdict there is per row.
//  2. An evidence-managed row is presumed eligible (so the presumed pool is a superset of the real
//     pool) and carries its tier and family from three json-path columns. Eligibility needs the
//     signed record, so it is checked on the full row.
//  3. pickWithConstraints is greedy over the ranked rows and only picked rows change its state, so
//     if every picked row is verified eligible, removing the unverified ineligible rows would not
//     have changed a single decision. The usage meta looks at the newest N rows of the pool; those
//     rows are verified too. Each round verifies the picks and that window, drops rows that fail,
//     and re-picks, until a round verifies nothing new.
//  4. The recency trim is judged on an exact count; if the presumed and exact counts straddle the
//     threshold, or anything else is unusual (empty after verification, too many rounds, a read
//     error), the caller falls back to the full read, which is the old behaviour unchanged.
//
// Stored verdicts (16 Oct 2026, data/practice_verdicts.js): the verification in point 3 read the
// evidence record (about 35 KB) of the picks, of the newest window and of every candidate that turned
// out ineligible, round after round. A signed, input-bound verdict per evidence-managed row now settles
// eligibility without the record: an ineligible verdict removes the row up front; an eligible one makes
// it "decided", so it needs no read for the window or the recency count. A decided row that gets PICKED
// is still read in full and judged on its record exactly as before, because the returned row carries
// the record. So a wrong or forged "eligible" verdict can cost an extra round but never change a pick,
// and the only way a verdict can drop a question is a valid signature over inputs that still match.
// No verdict (table missing, row new or changed, registry changed, record expired) means the row is
// verified from its record as before.
//
// Slim records (ctx.slimRecords, data/db.js PRACTICE_SLIM_RECORD): the returned row of a managed question
// carries its evidence record (about 35 KB), which ends up in the session snapshot, the sealed ticket and the
// attempt row. Nothing reads that record from a practice snapshot (the only reader, /api/recovery, ignores
// practice attempts; recovery sessions ask for requireEvidence and keep the full record). With slimRecords a
// decided pick is not read in full: its plain columns are read again, fresh (about 2 KB), checked against its
// verdict and against the live holds, and returned with a digest in the record's place (id, content hash,
// family, policy, state, expiry and the evidence signature, flagged slim: true). So a start reads no evidence
// record, still sees a status change or an edit made within the pool's five minutes, and returns the same
// picks. A pick that no longer matches its verdict is read in full like any undecided row.
//
// This module is pure: the database is behind `source`, so tests run it over fixtures. NTA mode
// has its own engine (data/nta_pool.js) and never comes here.
import { rankCandidates, pickWithConstraints, buildSelectionUsageMeta, questionCreatedTime } from './mock_question_selector.js';
import { isPassageLinkedQuestion } from './nta_question_selector.js';
import { FACTORY_POLICY } from './question_factory_policy.mjs';
import { contentHash } from './content_evidence.js';

export const PRACTICE_POOL_CACHE_MS = 5 * 60 * 1000;
export const MAX_VERIFY_ROUNDS = 8;

// Every column of public.questions except the two heavy records (checked against the production
// schema on 15 Oct 2026; a test pins this list to the full list so a new column cannot be missed).
export const PRACTICE_QUESTION_COLUMNS = [
  'id', 'subject', 'chapter', 'question', 'options', 'correct_index', 'explanation', 'difficulty', 'source', 'status',
  'uploaded_by', 'created_at', 'body', 'correct_answer', 'author_id', 'tags', 'updated_at', 'ai_tier', 'ai_score',
  'recommended_difficulty', 'verification_state', 'quality_band', 'quality_score', 'momentum_score', 'exposure_budget',
  'exposure_used', 'exploration_lane', 'exploration_state', 'duplicate_group_id', 'content_hash', 'live_at', 'settled_at',
  'is_deleted', 'upvotes', 'downvotes', 'score', 'is_ncert_relevant', 'is_cuet_syllabus', 'validation_confidence', 'topic',
  'validated_at', 'concept', 'concept_id', 'pyq_anchor_id', 'anchor_tier', 'difficulty_weight', 'question_type',
  'passage_group_id', 'passage_id', 'passage_type', 'order_index', 'family_id', 'passage_text', 'legacy_screening',
];
export const PRACTICE_HEAVY_COLUMNS = ['evidence', 'provenance'];
// Small json-path reads of the heavy records: enough to place a managed row before it is verified.
export const PRACTICE_STUB_COLUMNS = [
  'ev_policy:evidence->record->>policy_version',
  'ev_family:evidence->record->>family_id',
  'prov_kind:provenance->>kind',
];
// Other readers (the repair check) still take the stubs as three json-path columns on every row.
export const PRACTICE_LIGHT_SELECT = [...PRACTICE_QUESTION_COLUMNS, ...PRACTICE_STUB_COLUMNS].join(',');
// The practice start reads only the plain columns. Since 16 Oct 2026 the stubs come from one small scan of the
// evidence-managed rows (PRACTICE_MANAGED_STUBS, about 140-190 rows a subject) instead of riding along as
// three json-path columns on every row (about 55 bytes each, on 500-1,500 rows).
export const PRACTICE_PLAIN_SELECT = PRACTICE_QUESTION_COLUMNS.join(',');
// ev_sig and ev_prov (the evidence signature and the provenance record, about 330 bytes) are what a stored
// verdict is bound to (data/practice_verdicts.js).
export const PRACTICE_MANAGED_STUBS = ['id', ...PRACTICE_STUB_COLUMNS, 'ev_state:evidence->record->>state', 'ev_sig:evidence->>signature', 'ev_prov:provenance'].join(',');
// What a decided pick is re-read with when slimRecords is on: its plain columns, fresh, and the managed stubs.
export const PRACTICE_PICK_SELECT = [...PRACTICE_QUESTION_COLUMNS, ...PRACTICE_STUB_COLUMNS, 'ev_state:evidence->record->>state', 'ev_sig:evidence->>signature', 'ev_prov:provenance'].join(',');
// PostgREST filter for "evidence or provenance is set": one scan instead of one per column.
export const PRACTICE_MANAGED_FILTER = 'evidence.not.is.null,provenance.not.is.null';

/**
 * Puts the managed-row stubs onto the light rows. Returns { rows, managedIds } as loadLightPool does.
 * A row without a stub is not evidence-managed (its ev_* keys stay absent); managed ids outside the pool
 * are kept, as the old id scans kept them.
 */
export function attachManagedStubs(rows, managedRows) {
  const byId = new Map((managedRows || []).map((row) => [row.id, row]));
  return {
    rows: (rows || []).map((row) => {
      const stub = byId.get(row.id);
      return stub ? { ...row, ev_policy: stub.ev_policy ?? null, ev_family: stub.ev_family ?? null, prov_kind: stub.prov_kind ?? null, ev_state: stub.ev_state ?? null, ev_sig: stub.ev_sig ?? null, ev_prov: stub.ev_prov ?? null } : row;
    }),
    managedIds: new Set(byId.keys()),
  };
}

// A decided managed row as it is returned when its record is not read: the light row, the provenance as stored,
// and a digest of the evidence record. contentHash(row) is the record's content_hash for any eligible row (the
// evidence check demands it), and the signature binds the digest to the stored record.
export function slimRecordRow(row, verdict) {
  const { ev_policy, ev_family, ev_state, ev_sig, ev_prov, prov_kind, ...rest } = row;
  void prov_kind;
  const expires = Date.parse(verdict?.expires_at);
  return {
    ...rest,
    evidence: {
      record: {
        candidate_id: row.id, content_hash: contentHash(row), family_id: ev_family ?? null, policy_version: ev_policy ?? null,
        state: ev_state ?? null, expires_at: Number.isFinite(expires) ? new Date(expires).toISOString() : null, slim: true,
      },
      signature: ev_sig ?? null,
    },
    provenance: ev_prov ?? null,
  };
}

const NO_USAGE = Symbol('fallback');
export const FALLBACK = NO_USAGE;

function applyExclusions(pool, opts) {
  if (!(opts.excludeQuestionIds || opts.excludeFamilyIds)) return pool;
  const ids = new Set(opts.excludeQuestionIds || []);
  const families = new Set(opts.excludeFamilyIds || []);
  return pool.filter((row) => !ids.has(row.id)
    && (row.family_id || row.template_id || row.evidence?.record?.family_id)
    && !families.has(row.family_id || row.template_id || row.evidence?.record?.family_id));
}

function rankPickMeta({ pool, mode, targetCount, progress, weakConcepts, recencyFilteredCount }) {
  const ranked = rankCandidates(pool, { mode, progress, weakConcepts });
  const selected = pickWithConstraints(ranked, targetCount, mode);
  const selectionUsage = buildSelectionUsageMeta({ selectedRows: selected, candidatePool: pool, progress, mode, targetCount, recencyFilteredCount });
  return { selected, selectionUsage, ranked };
}

function validateMockSet(rows, count) {
  if (!rows.length) return { ok: false, reason: 'empty_pool' };
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) return { ok: false, reason: 'duplicate_ids' };
  const subjects = new Set(rows.map((r) => r.subject));
  if (subjects.size > 1) return { ok: false, reason: 'mixed_subjects' };
  if (rows.length < Math.ceil(count * 0.7)) return { ok: false, reason: 'pool_too_thin' };
  return { ok: true };
}

const emptyResult = () => ({ selected: [], meta: { totalCandidates: 0, acceptedCandidates: 0, rejectedByReason: {} } });
const finished = ({ selected, selectionUsage }, targetCount, warn) => {
  const validation = validateMockSet(selected, targetCount);
  if (!validation.ok && validation.reason === 'pool_too_thin') warn?.({ reason: 'pool_thin', got: selected.length });
  return { selected, meta: { validation, selectionUsage } };
};

/**
 * The reference: today's behaviour. `source.loadFullPool()` returns every matching row with every
 * column, in query order. Returns { selected, meta } where meta is merged into the session meta.
 */
export async function pickFromFullPool(source, ctx) {
  const { mode, targetCount, opts } = ctx;
  let pool = await source.loadFullPool();
  if (mode.id === 'quick') pool = pool.filter((row) => !isPassageLinkedQuestion(row));
  pool = await source.attachPassages(pool);
  pool = await source.readable(pool);
  pool = applyExclusions(pool, opts);

  let recencyFilteredCount = 0;
  if (opts.userId && mode.recencyLimit > 0) {
    const recentIds = await source.recentIds();
    if (recentIds.size) {
      const trimmed = pool.filter((row) => row.selection_evidence_tier >= 2 || !recentIds.has(row.id));
      const minimumAfterRecency = Math.ceil(targetCount * 0.7);
      if (trimmed.length >= minimumAfterRecency) {
        recencyFilteredCount = pool.length - trimmed.length;
        pool = trimmed;
      }
    }
  }
  if (pool.length === 0) return emptyResult();

  const progress = opts.userId ? await source.userProgress(pool.map((row) => row.id)) : new Map();
  const weakConcepts = (mode.useWeakTopics && opts.userId)
    ? await source.weakConcepts(mode.weakAccuracyThreshold || 0.6)
    : new Set();
  return finished(rankPickMeta({ pool, mode, targetCount, progress, weakConcepts, recencyFilteredCount }), targetCount, ctx.warn);
}

/**
 * The slim path. Returns the same { selected, meta } as pickFromFullPool, or FALLBACK when the
 * result could not be proven identical (the caller then runs pickFromFullPool).
 * `source.loadLightPool()` returns { rows, managedIds }: rows in query order without the evidence
 * and provenance columns (managed rows carry ev_policy, ev_family, prov_kind, ev_sig, ev_prov, see
 * attachManagedStubs); managedIds is the set of ids whose evidence or provenance is not null.
 * `source.loadFullRows(ids)` returns full rows. `source.loadVerdicts(managedRows)` (optional) returns
 * Map(id -> { eligible, expires_at }) for the managed rows that have a valid stored verdict (data/practice_verdicts.js);
 * `source.readable(rows, known)` takes Map(id -> true) for rows whose eligibility it need not recompute.
 * `ctx.slimRecords` (default false) returns decided picks without reading their record, see the header; it needs
 * `source.loadLightRows(ids)` (fresh rows, PRACTICE_PICK_SELECT) and is ignored without it.
 * `ctx.stats`, when given, receives { rounds, fullRowsRead, lightRows, decided }.
 */
export async function pickFromLightPool(source, ctx) {
  const { mode, targetCount, opts } = ctx;
  const stats = ctx.stats || {};
  const light = await source.loadLightPool();
  let rows = light.rows;
  if (mode.id === 'quick') rows = rows.filter((row) => !isPassageLinkedQuestion(row));
  rows = await source.attachPassages(rows);
  const managed = (row) => light.managedIds.has(row.id);
  stats.lightRows = rows.length;
  stats.fullRowsRead = 0;
  stats.rounds = 0;
  stats.decided = 0;
  stats.freshRows = 0;

  const legacyVerdict = new Map((await source.readable(rows.filter((row) => !managed(row)))).map((row) => [row.id, row]));
  const finalRows = new Map(); // id -> fresh full row that passed readablePracticeQuestions (tier set)
  const rejected = new Set(); // ids that can no longer be picked: judged ineligible on their full row, or ruled out by a verdict
  const stubOf = (row) => ({
    ...row,
    evidence: { record: { family_id: row.ev_family ?? undefined, policy_version: row.ev_policy ?? undefined } },
    provenance: row.prov_kind ? { kind: row.prov_kind } : null,
    selection_evidence_tier: row.prov_kind && row.ev_policy === FACTORY_POLICY ? 3 : 2,
  });

  // Stored verdicts: an ineligible one removes the row now; an eligible one makes it decided (its other
  // checks, holds included, still run on the live row; the record is read only if it is picked).
  let verdicts = new Map();
  const managedRows = rows.filter(managed);
  if (managedRows.length && typeof source.loadVerdicts === 'function') {
    try {
      verdicts = await source.loadVerdicts(managedRows);
    } catch (error) {
      ctx.warn?.({ reason: 'verdict_error', message: error?.message });
      verdicts = new Map();
    }
  }
  const eligibleByVerdict = (row) => verdicts.get(row.id)?.eligible === true;
  const decidedStubs = managedRows.filter(eligibleByVerdict).map(stubOf);
  const decidedPass = new Map((decidedStubs.length ? await source.readable(decidedStubs, new Map(decidedStubs.map((row) => [row.id, true]))) : []).map((row) => [row.id, row]));
  let ruledOut = 0;
  for (const row of managedRows) {
    if (verdicts.get(row.id)?.eligible === false) { rejected.add(row.id); ruledOut += 1; }
    else if (eligibleByVerdict(row) && !decidedPass.has(row.id)) { rejected.add(row.id); ruledOut += 1; } // held, failed integrity or the score floor
  }
  stats.decided = decidedPass.size + ruledOut;

  const presumedPool = () => {
    const out = [];
    for (const row of rows) {
      if (rejected.has(row.id)) continue;
      if (finalRows.has(row.id)) out.push(finalRows.get(row.id));
      else if (decidedPass.has(row.id)) out.push(decidedPass.get(row.id));
      else if (managed(row)) out.push(stubOf(row));
      else if (legacyVerdict.has(row.id)) out.push(legacyVerdict.get(row.id));
    }
    return out;
  };
  const isVerified = (row) => finalRows.has(row.id); // the full row was read and judged: the only kind that is returned
  const isSettled = (row) => finalRows.has(row.id) || decidedPass.has(row.id); // eligibility is known without the record

  let recentIds = null;
  let progress = null;
  let progressIds = null;
  let weakConcepts = null;
  let recencyFilteredCount = 0;
  let rejectedLastRound = 0;

  for (let round = 1; round <= MAX_VERIFY_ROUNDS; round += 1) {
    stats.rounds = round;
    let pool = applyExclusions(presumedPool(), opts);

    recencyFilteredCount = 0;
    if (opts.userId && mode.recencyLimit > 0) {
      if (!recentIds) recentIds = await source.recentIds();
      if (recentIds.size) {
        const trimmed = pool.filter((row) => row.selection_evidence_tier >= 2 || !recentIds.has(row.id));
        const minimum = Math.ceil(targetCount * 0.7);
        // The presumed count is an upper bound; the legacy rows plus settled managed rows are exact
        // lower bounds. Straddling the threshold cannot be decided without every record.
        const exact = trimmed.filter((row) => row.selection_evidence_tier < 2 || isSettled(row)).length;
        if (exact >= minimum) {
          recencyFilteredCount = pool.length - trimmed.length;
          pool = trimmed;
        } else if (trimmed.length >= minimum) {
          return FALLBACK;
        }
      }
    }
    if (pool.length === 0) return round === 1 ? emptyResult() : FALLBACK;

    if (progress === null) {
      progressIds = new Set(pool.map((row) => row.id));
      progress = opts.userId ? await source.userProgress([...progressIds]) : new Map();
      weakConcepts = (mode.useWeakTopics && opts.userId)
        ? await source.weakConcepts(mode.weakAccuracyThreshold || 0.6)
        : new Set();
    } else if (pool.some((row) => !progressIds.has(row.id))) {
      return FALLBACK; // the pool grew between rounds; this should not happen
    }

    const picked = rankPickMeta({ pool, mode, targetCount, progress, weakConcepts, recencyFilteredCount });
    const windowSize = Math.max(picked.selected.length, Number(targetCount) || 0);
    const window = pool.slice().sort((a, b) => questionCreatedTime(b) - questionCreatedTime(a)).slice(0, windowSize);
    const need = new Set();
    const fresh = new Set();
    const slimPick = (row) => ctx.slimRecords === true && typeof source.loadLightRows === 'function' && decidedPass.has(row.id);
    for (const row of picked.selected) if (!isVerified(row)) (slimPick(row) ? fresh : need).add(row.id);
    for (const row of window) if (managed(row) && !isSettled(row)) need.add(row.id);
    if (need.size === 0 && fresh.size === 0) return finished(picked, targetCount, ctx.warn);
    // When the last round dropped rows, look as far past the picks again so the next round settles.
    let extra = rejectedLastRound;
    for (const row of picked.ranked) {
      if (extra <= 0) break;
      if (managed(row) && !isSettled(row) && !need.has(row.id)) { need.add(row.id); extra -= 1; }
    }

    if (fresh.size) {
      // Decided picks: their plain columns again, fresh, and the verdict and the holds judged on that.
      const current = await source.attachPassages(await source.loadLightRows([...fresh]));
      stats.freshRows += current.length;
      let again = new Map();
      try {
        again = current.length ? await source.loadVerdicts(current) : again;
      } catch (error) {
        ctx.warn?.({ reason: 'verdict_error', message: error?.message });
      }
      const stubs = current.filter((row) => again.get(row.id)?.eligible === true).map(stubOf);
      const passed = new Map((stubs.length ? await source.readable(stubs, new Map(stubs.map((row) => [row.id, true]))) : []).map((row) => [row.id, row]));
      for (const id of fresh) {
        if (passed.has(id)) finalRows.set(id, slimRecordRow(passed.get(id), again.get(id)));
        else decidedPass.delete(id); // changed, held or gone since the pool was read: judged on its record from here on
      }
    }
    if (need.size) {
      const fetched = await source.attachPassages(await source.loadFullRows([...need]));
      stats.fullRowsRead += fetched.length;
      const ok = new Map((await source.readable(fetched)).map((row) => [row.id, row]));
      rejectedLastRound = 0;
      for (const id of need) {
        if (ok.has(id)) finalRows.set(id, ok.get(id));
        else { rejected.add(id); rejectedLastRound += 1; }
      }
    }
  }
  return FALLBACK;
}

/** Slim path first (unless switched off), the full read when it cannot prove an identical result. */
export async function selectPracticeQuestions(source, ctx, { slim = true } = {}) {
  if (slim && typeof source.loadLightPool === 'function') {
    try {
      const result = await pickFromLightPool(source, ctx);
      if (result !== FALLBACK) return result;
      ctx.warn?.({ reason: 'slim_fallback' });
    } catch (error) {
      ctx.warn?.({ reason: 'slim_error', message: error?.message });
    }
  }
  return pickFromFullPool(source, ctx);
}
