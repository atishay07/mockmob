// The daily inventory count, skipped when nothing it depends on has changed (egress item F1, 20 Oct 2026).
// No 'server-only' and no alias imports: the database is passed in, so node:test can load it.
//
// Counting reads every visible question (about 33 MB a run on 20 Oct 2026, 23.6 MB of it the signed evidence records) and the bank
// changes only when the owner asks for content. The count is a pure function of:
//   (1) the questions rows           every UPDATE bumps questions.updated_at (trigger trg_questions_updated_at, BEFORE UPDATE FOR EACH
//                                    ROW, migration 0005) and an INSERT carries now() (questions.updated_at NOT NULL DEFAULT now());
//   (2) the recovery_family_holds rows   (family_id)
//   (3) deploy files                 data/calibration_manifest.json and data/source_registry.json (sharedEligibilitySnapshot)
//   (4) the counting code            INVENTORY_LOGIC_VERSION below; data/tests/inventory_fingerprint.test.mjs pins a hash of the source
//                                    files so a change to any of them fails until the version is bumped
//   (5) environment                  MOCK_AI, NTA_LOCAL_ANSWER_CONFIDENCE_THRESHOLD, CUET_EVIDENCE_SIGNING_KEY (stored only as an HMAC)
//   (6) the clock                    evidence.record.expires_at: no row changes when a record expires.
// The fingerprint is stored inside the snapshot value (value.fingerprint; the table allows only the row id 'current') and stripped
// before the value reaches a client (inventorySnapshot.js). A run skips the full read only when EVERY probe below matches; any probe
// error, a missing fingerprint, any difference, or a full count older than seven days is the old full count (it fails closed).
import { createHash, createHmac } from 'node:crypto';
import { INVENTORY_VISIBLE_FILTER, countInventory, readInventoryRows } from './inventory_count.js';
import { sharedEligibilitySnapshot } from './evidence_registry.js';

/** Bump when any source file of the count changes (the pin test names which). */
export const INVENTORY_LOGIC_VERSION = 'inventory-logic-1';
export const FINGERPRINT_VERSION = 1;
/** Margin before the previous read: a late-committing transaction carries an older now(), and Vercel's clock is not Postgres's. */
export const SAFETY_MARGIN_MS = 15 * 60 * 1000;
/** A full recount at least this often, as a backstop for writers that bypass triggers. */
export const FORCED_RECOUNT_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE = 1000;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

/** The hash of everything deployed or configured that the count depends on, or null when it cannot be read (then no skip). */
export function deployHash(options = {}) {
  const env = options.env ?? process.env;
  // `snapshot` may be given (tests); an explicit undefined means "unreadable".
  const snapshot = 'snapshot' in options ? options.snapshot : sharedEligibilitySnapshot();
  if (!snapshot) return null;
  const key = env.CUET_EVIDENCE_SIGNING_KEY;
  return sha256(canonical({
    logic: INVENTORY_LOGIC_VERSION,
    snapshot,
    env: {
      MOCK_AI: env.MOCK_AI ?? null,
      NTA_LOCAL_ANSWER_CONFIDENCE_THRESHOLD: env.NTA_LOCAL_ANSWER_CONFIDENCE_THRESHOLD ?? null,
      signingKey: key ? createHmac('sha256', key).update('inventory-fp-v1').digest('hex') : null,
    },
  }));
}

/** sha256 of the sorted list of every held family id (a tiny table). Throws on any read error. */
export async function holdsHash(db) {
  const ids = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await db.from('recovery_family_holds').select('family_id').order('family_id').range(start, start + PAGE - 1);
    if (error) throw new Error('INVENTORY_PROBE_FAILED');
    ids.push(...(data || []).map((r) => r.family_id));
    if (!data || data.length < PAGE) break;
  }
  return sha256(ids.sort().join('\n'));
}

async function headCount(query) {
  const { count, error } = await query;
  if (error || !Number.isInteger(count)) throw new Error('INVENTORY_PROBE_FAILED');
  return count;
}

/** The cheap probes: head counts (no body) and the holds ids. `since` (ms) adds the "touched since" count. Throws on any error. */
export async function readProbes(db, { since = null } = {}) {
  const head = () => db.from('questions').select('id', { count: 'exact', head: true });
  const [candidateCount, totalRows, touched, holds] = await Promise.all([
    headCount(head().eq('is_deleted', false).or(INVENTORY_VISIBLE_FILTER)),
    headCount(head()),
    since === null ? Promise.resolve(null) : headCount(head().gte('updated_at', new Date(since - SAFETY_MARGIN_MS).toISOString())),
    holdsHash(db),
  ]);
  return { candidateCount, totalRows, touched, holdsHash: holds };
}

/** The earliest evidence expiry that is still in the future at `now` (ms), or null. A record already expired cannot become eligible again. */
export function minFutureExpiry(rows, now) {
  let min = null;
  for (const row of rows) {
    const at = Date.parse(row?.evidence?.record?.expires_at);
    if (Number.isFinite(at) && at > now && (min === null || at < min)) min = at;
  }
  return min;
}

const isFingerprint = (f) => f && f.v === FINGERPRINT_VERSION && Number.isFinite(f.readAt) && Number.isFinite(f.fullCountAt) && Number.isInteger(f.candidateCount)
  && Number.isInteger(f.totalRows) && typeof f.holdsHash === 'string' && typeof f.deployHash === 'string';

/** Why the full count must run, or null when the stored count is still exact. */
export function recountReason({ stored, probes, deploy, now }) {
  const prev = stored?.value?.fingerprint;
  if (!stored?.value || stored.value.state !== 'available') return 'no_stored_count';
  if (!isFingerprint(prev)) return 'no_fingerprint';
  if (!probes || probes.touched === null) return 'probes_unavailable';
  if (!deploy) return 'deploy_unreadable';
  if (deploy !== prev.deployHash) return 'deploy_changed';
  if (probes.candidateCount !== prev.candidateCount) return 'visible_set_changed';
  if (probes.totalRows !== prev.totalRows) return 'row_count_changed';
  if (probes.holdsHash !== prev.holdsHash) return 'holds_changed';
  if (probes.touched !== 0) return 'rows_touched';
  if (prev.minExpiresAt !== null && prev.minExpiresAt !== undefined && now >= prev.minExpiresAt) return 'evidence_expired';
  if (!(now - prev.fullCountAt < FORCED_RECOUNT_MS) || now < prev.fullCountAt) return 'forced_recount';
  return null;
}

/** The stored value without the fingerprint: what any caller outside this module may see. */
export function withoutFingerprint(value) {
  if (!value || typeof value !== 'object' || !('fingerprint' in value)) return value;
  const { fingerprint: _fingerprint, ...rest } = value;
  return rest;
}

/**
 * The daily refresh. Reads the stored row, probes, and either re-stamps the stored count (skip) or runs the full count and stores
 * it with a new fingerprint. Returns { value (no fingerprint), skipped, reason }. Throws INVENTORY_STORE_FAILED when the write fails
 * and whatever the full count throws (INVENTORY_UNAVAILABLE ...), exactly as before.
 */
export async function refreshInventory(db, { now = Date.now, env = process.env, log = console.info, ...rest } = {}) {
  const startedAt = now();
  let stored = null;
  try { stored = (await db.from('public_inventory_snapshot').select('value,computed_at').eq('id', 'current').maybeSingle()).data ?? null; } catch { stored = null; }
  const prev = stored?.value?.fingerprint;
  const deploy = deployHash('snapshot' in rest ? { env, snapshot: rest.snapshot } : { env });
  let probes = null;
  try { probes = await readProbes(db, { since: isFingerprint(prev) ? prev.readAt : null }); } catch { probes = null; }
  const reason = recountReason({ stored, probes, deploy, now: startedAt });

  const store = async (value) => {
    const { error } = await db.from('public_inventory_snapshot').upsert({ id: 'current', value, computed_at: value.checkedAt }).then((r) => r, (e) => ({ error: e }));
    if (error) throw new Error('INVENTORY_STORE_FAILED');
  };

  if (reason === null) {
    const checkedAt = new Date(now()).toISOString();
    const value = { ...stored.value, checkedAt, fingerprint: { ...prev, readAt: startedAt } };
    await store(value);
    log(`[inventory] skipped, unchanged (${probes.candidateCount} visible rows, full count of ${new Date(prev.fullCountAt).toISOString()}); no question rows read`);
    return { value: withoutFingerprint(value), skipped: true, reason: null };
  }

  // The probes before the read: a row that changes while the pages are read shows up as `touched` or a count difference next run.
  const rows = await readInventoryRows(db);
  const counted = await countInventory(rows, db);
  const fullCountAt = now();
  const fingerprint = probes && deploy ? {
    v: FINGERPRINT_VERSION, readAt: startedAt, fullCountAt, candidateCount: probes.candidateCount, totalRows: probes.totalRows, holdsHash: probes.holdsHash, deployHash: deploy,
    minExpiresAt: minFutureExpiry(rows, fullCountAt),
  } : undefined;
  const value = fingerprint ? { ...counted, fingerprint } : counted;
  await store(value);
  log(`[inventory] full count (${reason}): ${counted.bankSize} questions at ${counted.checkedAt}`);
  return { value: counted, skipped: false, reason };
}
