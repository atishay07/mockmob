import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createFactoryTransport, responseJSON } from '../lib/factoryTransport.mjs';
import { applyCohort010Recovery, COHORT010_ALLOWLIST, COHORT010_BATCH_ID, COHORT010_CAMPAIGN_SHA256, COHORT010_V62_CONTRACT_HASH, planCohort010Recovery, rowSha256, sha256 } from '../lib/cohort010Recovery.mjs';

function fakeReceiptDb(entries) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE requests(id TEXT PRIMARY KEY,model TEXT,reserved INTEGER,actual INTEGER,state TEXT,receipt_json TEXT);
    CREATE TABLE provider_batches(id TEXT PRIMARY KEY,provider TEXT,provider_id TEXT,reservation_id TEXT,state TEXT,request_json TEXT,response_json TEXT,created_at TEXT);
    CREATE TABLE provider_requests(id TEXT PRIMARY KEY,reservation_id TEXT,provider TEXT,state TEXT,request_json TEXT,response_json TEXT);
    CREATE TABLE cache(id TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE conservative_holds(reservation_id TEXT PRIMARY KEY,maximum_micro INTEGER,proof_json TEXT);`);
  for (const entry of entries) {
    const body = { model: entry.model, max_output_tokens: 128, input: [{ role: 'user', content: `fixture ${entry.candidate_id}` }] };
    const config = { provider: 'openai', model: entry.model, key: entry.request_key, reserved: 1000, stage: 'authoring', purpose: 'candidate', candidate_id: entry.candidate_id };
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?)').run(entry.reservation_id, entry.model, 1000, 10, 'settled', null);
    db.prepare('INSERT INTO provider_batches VALUES(?,?,?,?,?,?,?,?)').run(entry.request_key, 'openai', COHORT010_BATCH_ID, entry.reservation_id,
      'complete', JSON.stringify({ body, config }), JSON.stringify({ output_text: JSON.stringify({ id: entry.candidate_id, ok: true }) }), 'fixture');
  }
  return db;
}

function baseInput(allowlist = COHORT010_ALLOWLIST) {
  const jobsById = new Map(allowlist.map(entry => [entry.candidate_id, { id: entry.candidate_id, state: 'waiting_authoring', pending: entry.request_key }]));
  const receiptsByKey = new Map(allowlist.map(entry => [entry.request_key, {
    request_key: entry.request_key, reservation_id: entry.reservation_id, provider: entry.provider, model: entry.model,
    provider_id: entry.provider_id, provider_state: entry.provider_state, request_state: 'settled', candidate_id: entry.candidate_id,
    stage: 'authoring', purpose: 'candidate', body_sha256: entry.body_sha256, response: { ok: true },
    ...(entry.provider_state === 'rejected' ? { http_status: 429, receipt_error: { type: 'insufficient_quota', code: 'credit_balance_exhausted' } } : {})
  }]));
  // Planning tests inject the frozen expected digest; ledger-backed transport
  // tests below independently exercise the actual request-body digest check.
  return { campaign: { id: 'cost-native-cohort-010', denominator: 100, no_regeneration: true }, campaignSha256: COHORT010_CAMPAIGN_SHA256,
    registration: { contract_hash: COHORT010_V62_CONTRACT_HASH }, jobsById, receiptsByKey };
}

test('all six allowlisted completed native responses replay without fetch or new reservations', async () => {
  const complete = COHORT010_ALLOWLIST.filter(entry => entry.provider_state === 'complete');
  const db = fakeReceiptDb(complete); let fetches = 0;
  const ledger = { db, getCache: key => { const row = db.prepare('SELECT value FROM cache WHERE id=?').get(key); return row ? JSON.parse(row.value) : null; },
    assertHistoryReconciled() { throw new Error('unexpected prepare'); } };
  const transport = createFactoryTransport({ ledger, env: {}, prices: () => { throw new Error('pricing should not be read'); }, fetchImpl: async () => { fetches++; throw Error('network forbidden'); } });
  try {
    const before = db.prepare('SELECT count(*) n FROM requests').get().n;
    for (const entry of complete) {
      const body = JSON.parse(db.prepare('SELECT request_json FROM provider_batches WHERE id=?').get(entry.request_key).request_json).body;
      const result = await transport.generate('openai', body, { key: entry.request_key, cacheOnly: true, batch: true });
      assert.equal(responseJSON(result).id, entry.candidate_id);
    }
    assert.equal(fetches, 0); assert.equal(db.prepare('SELECT count(*) n FROM requests').get().n, before);
  } finally { db.close(); }
});

test('unknown keys and changed request bodies fail closed under cache-only replay', async () => {
  const entry = COHORT010_ALLOWLIST.find(x => x.provider_state === 'complete');
  const db = fakeReceiptDb([entry]); let fetches = 0;
  const ledger = { db, getCache: () => null, assertHistoryReconciled() { throw new Error('unexpected prepare'); } };
  const transport = createFactoryTransport({ ledger, env: {}, prices: () => { throw new Error('pricing should not be read'); }, fetchImpl: async () => { fetches++; throw Error('network forbidden'); } });
  try {
    const body = JSON.parse(db.prepare('SELECT request_json FROM provider_batches WHERE id=?').get(entry.request_key).request_json).body;
    await assert.rejects(transport.generate('openai', body, { key: 'unknown-unallowlisted-key', cacheOnly: true }), /calibration_cache_miss/);
    await assert.rejects(transport.generate('openai', { ...body, max_output_tokens: 129 }, { key: entry.request_key, cacheOnly: true }), /saved_request_content_mismatch/);
    assert.equal(fetches, 0);
  } finally { db.close(); }
});

test('recovery planner rejects keys outside the fixed allowlist and changed saved-body digests', async () => {
  const entry = COHORT010_ALLOWLIST.find(x => x.provider_state === 'complete');
  const input = baseInput([entry]);
  await assert.rejects(planCohort010Recovery({ ...input, allowlist: [{ ...entry, request_key: 'not-in-frozen-recovery-set' }], materialize: async () => null }), /allowlisted_key_missing/);
  const changed = baseInput([entry]); changed.receiptsByKey.get(entry.request_key).body_sha256 = '0'.repeat(64);
  await assert.rejects(planCohort010Recovery({ ...changed, allowlist: [entry], materialize: async () => null }), /saved_request_body_digest_mismatch/);
});

test('typed credit refusals quarantine with an explicit pre-inference reason and never materialize', async () => {
  const refusals = COHORT010_ALLOWLIST.filter(entry => entry.provider_state === 'rejected');
  const input = baseInput(refusals); let materialized = 0;
  for (const entry of refusals) input.receiptsByKey.get(entry.request_key).body_sha256 = entry.body_sha256;
  const plan = await planCohort010Recovery({ ...input, allowlist: refusals, materialize: async () => { materialized++; throw Error('must not run'); } });
  assert.equal(materialized, 0); assert.equal(plan.length, 3);
  assert.ok(plan.every(row => row.action === 'quarantine_typed_refusal' && row.next_value.state === 'quarantined' && row.reason === 'authoring_preinference_credit_refused'));
});

test('restart is idempotent and refuses to overwrite a changed recovered job', async () => {
  const entry = COHORT010_ALLOWLIST.find(x => x.provider_state === 'complete');
  const input = baseInput([entry]); input.receiptsByKey.get(entry.request_key).body_sha256 = entry.body_sha256;
  const first = await planCohort010Recovery({ ...input, allowlist: [entry], materialize: async job => ({ id: job.id, answer: 'A' }) });
  const recovered = new Map([[entry.candidate_id, first[0].next_value]]);
  const restart = await planCohort010Recovery({ ...input, jobsById: recovered, allowlist: [entry], materialize: async () => { throw Error('must not replay'); } });
  assert.equal(restart[0].action, 'already_recovered');
  const changed = structuredClone(first[0].next_value); changed.candidate.answer = 'B';
  await assert.rejects(planCohort010Recovery({ ...input, jobsById: new Map([[entry.candidate_id, changed]]), allowlist: [entry], materialize: async () => null }), /recovery_marker_mismatch/);
});

test('apply refuses live worker/controller and commits only the frozen row snapshot', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE factory_candidates(id TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE factory_worker(id INTEGER PRIMARY KEY,owner TEXT,expires INTEGER);
    CREATE TABLE factory_campaign_controller(id INTEGER PRIMARY KEY,owner TEXT,expires INTEGER);
    CREATE TABLE factory_measurement_leases_vnext(campaign_id TEXT PRIMARY KEY,owner TEXT,owner_pid INTEGER,candidate_ids_json TEXT,
      contract_hash TEXT,state TEXT,expires INTEGER,updated_at INTEGER);`);
  const old = { id: 'fixture', state: 'waiting_authoring', pending: 'key' };
  db.prepare('INSERT INTO factory_candidates VALUES(?,?)').run(old.id, JSON.stringify(old));
  const action = { candidate_id: old.id, request_key: 'key', action: 'quarantine_typed_refusal', expected_local_sha256: rowSha256(old),
    next_value: { ...old, state: 'quarantined', recovery_marker: { request_key: 'key', terminal: 'preinference_credit_refused' } } };
  try {
    // A live PID remains a blocker after expiry; timestamps cannot prove death.
    db.prepare('INSERT INTO factory_worker VALUES(1,?,?)').run(`${process.pid}:live`, Date.now() - 60000);
    assert.throws(() => applyCohort010Recovery(db, [action]), /factory_worker_active/);
    db.prepare('DELETE FROM factory_worker').run();
    db.prepare('INSERT INTO factory_campaign_controller VALUES(1,?,?)').run(`${process.pid}:live`, Date.now() + 60000);
    assert.throws(() => applyCohort010Recovery(db, [action]), /campaign_controller_active/);
    db.prepare('DELETE FROM factory_campaign_controller').run();
    db.prepare('INSERT INTO factory_measurement_leases_vnext VALUES(?,?,?,?,?,?,?,?)')
      .run('unrelated-live-campaign', `${process.pid}:scoped`, process.pid, JSON.stringify(['unrelated-candidate']), 'contract', 'active', Date.now() - 60000, Date.now());
    assert.throws(() => applyCohort010Recovery(db, [action]), /measurement_lease_active/);
    db.prepare('DELETE FROM factory_measurement_leases_vnext').run();
    assert.deepEqual(applyCohort010Recovery(db, [action]), { applied: 1, replayed: 0, quarantined: 1 });
    assert.equal(JSON.parse(db.prepare('SELECT value FROM factory_candidates WHERE id=?').get(old.id).value).state, 'quarantined');
    const changedPlan = { ...action, expected_local_sha256: 'wrong' };
    assert.throws(() => applyCohort010Recovery(db, [changedPlan]), /apply_local_job_changed/);
  } finally { db.close(); }
});
