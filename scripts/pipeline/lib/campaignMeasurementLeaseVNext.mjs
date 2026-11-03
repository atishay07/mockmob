import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

const TABLE = 'factory_measurement_leases_vnext';
const flag = (args, value) => args.includes(value);
const alive = pid => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
};

export function parallelMeasurementStopRequested(stopFile) {
  return typeof stopFile === 'string' && existsSync(stopFile);
}

function normalizeIds(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.some(x => typeof x !== 'string' || !x.trim())) throw Error('measurement_lease_candidate_ids_required');
  const sorted = [...ids].sort();
  if (new Set(sorted).size !== sorted.length) throw Error('measurement_lease_candidate_ids_duplicate');
  return sorted;
}

export function measurementLeaseContractHash(profile, args, candidateIds = []) {
  if (profile?.measurement_only !== true || profile?.publication_policy !== 'never') throw Error('measurement_lease_profile_mismatch');
  for (const required of ['--realtime-all', '--staging', '--measurement-only', '--parallel-measurement']) if (!flag(args, required)) throw Error(`measurement_lease_flag_required:${required}`);
  if (flag(args, '--publish')) throw Error('measurement_lease_publication_forbidden');
  return createHash('sha256').update(JSON.stringify({ profile, candidate_ids: normalizeIds(candidateIds), mode: ['realtime-all', 'staging', 'measurement-only', 'parallel-measurement'], publish: false })).digest('hex');
}

/*
 * This is deliberately separate from factory_worker. A legacy global owner may
 * coexist only when the caller verifies its live process identity and derives
 * the exact candidate scope from a hash-pinned registered campaign.
 */
export function claimCampaignMeasurementLease(ledger, {
  campaignId, candidateIds, profile, args = [], publish = false,
  legacyGlobalScopeProof = null, verifyLegacyGlobalScopeProof = null, now = Date.now(), isPidAlive = alive
}) {
  if (typeof campaignId !== 'string' || !campaignId.trim()) throw Error('measurement_lease_campaign_required');
  if (publish) throw Error('measurement_lease_publication_forbidden');
  const ids = normalizeIds(candidateIds);
  const contractHash = measurementLeaseContractHash(profile, args, ids);
  const db = ledger.db;
  db.exec(`CREATE TABLE IF NOT EXISTS factory_worker(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,expires INTEGER);
    CREATE TABLE IF NOT EXISTS factory_candidates(id TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ${TABLE} (
    campaign_id TEXT PRIMARY KEY, owner TEXT, owner_pid INTEGER, candidate_ids_json TEXT NOT NULL,
    contract_hash TEXT NOT NULL, state TEXT NOT NULL, expires INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`);
  return ledger.transaction(() => {
    const queued = db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state IN ('queued','dispatching')").get().n;
    if (queued) throw Error('measurement_lease_provider_batch_work_pending');

    const requested = new Set(ids);
    for (const row of db.prepare(`SELECT * FROM ${TABLE}`).all()) {
      const ownerAlive = row.owner_pid && isPidAlive(row.owner_pid);
      const previous = JSON.parse(row.candidate_ids_json);
      if (row.campaign_id === campaignId && ownerAlive && row.owner) throw Error('measurement_lease_campaign_already_owned');
      if (ownerAlive && previous.some(id => requested.has(id))) throw Error('measurement_lease_candidate_overlap');
      if (row.campaign_id !== campaignId && previous.some(id => requested.has(id))) throw Error('measurement_lease_candidate_overlap');
    }

    const global = db.prepare('SELECT owner,expires FROM factory_worker WHERE id=1').get();
    if (global?.owner) {
      const pid = Number(global.owner.split(':')[0]);
      if (isPidAlive(pid)) {
        const proof = legacyGlobalScopeProof;
        if (!proof || proof.owner !== global.owner || proof.pid !== pid || typeof proof.campaignId !== 'string' ||
            typeof verifyLegacyGlobalScopeProof !== 'function' || verifyLegacyGlobalScopeProof(proof, global) !== true) throw Error('measurement_lease_legacy_worker_scope_proof_required');
        const scope = normalizeIds(proof.candidateIds);
        if (scope.some(id => requested.has(id))) throw Error('measurement_lease_candidate_overlap');
      }
    }

    const old = db.prepare(`SELECT * FROM ${TABLE} WHERE campaign_id=?`).get(campaignId);
    if (old && (old.candidate_ids_json !== JSON.stringify(ids) || old.contract_hash !== contractHash)) throw Error('measurement_lease_campaign_contract_changed');
    // IDs already present without this campaign's durable lease mapping cannot
    // safely be assigned: factory_candidates is a global primary-key namespace.
    const existing = db.prepare('SELECT id FROM factory_candidates WHERE id=?');
    if (!old && ids.some(id => existing.get(id))) throw Error('measurement_lease_candidate_id_already_saved');
    const owner = `${process.pid}:${randomUUID()}`;
    db.prepare(`INSERT INTO ${TABLE}(campaign_id,owner,owner_pid,candidate_ids_json,contract_hash,state,expires,updated_at)
      VALUES(?,?,?,?,?,'active',?,?) ON CONFLICT(campaign_id) DO UPDATE SET owner=excluded.owner,
      owner_pid=excluded.owner_pid,state='active',expires=excluded.expires,updated_at=excluded.updated_at`)
      .run(campaignId, owner, process.pid, JSON.stringify(ids), contractHash, now + 300000, now);
    return { campaignId, owner, candidateIds: ids, contractHash };
  });
}

export function releaseCampaignMeasurementLease(ledger, lease, now = Date.now()) {
  if (!lease?.campaignId || !lease?.owner) throw Error('measurement_lease_owner_required');
  const db = ledger.db;
  const result = db.prepare(`UPDATE ${TABLE} SET owner=NULL,owner_pid=NULL,state='released',expires=?,updated_at=?
    WHERE campaign_id=? AND owner=?`).run(now, now, lease.campaignId, lease.owner);
  if (Number(result.changes) !== 1) throw Error('measurement_lease_release_owner_mismatch');
  return true;
}

export function assertNoLiveMeasurementLease(ledger, candidateIds, { isPidAlive: checkAlive = alive } = {}) {
  const ids = candidateIds == null ? null : new Set(normalizeIds(candidateIds));
  const exists = ledger.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(TABLE);
  if (!exists) return true;
  for (const row of ledger.db.prepare(`SELECT * FROM ${TABLE} WHERE state='active'`).all()) {
    if (row.owner_pid && checkAlive(row.owner_pid) && (ids === null || JSON.parse(row.candidate_ids_json).some(id => ids.has(id)))) throw Error('measurement_lease_active_scope_conflict');
  }
  return true;
}
