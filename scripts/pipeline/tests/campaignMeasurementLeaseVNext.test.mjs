import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { claimCampaignMeasurementLease, parallelMeasurementStopRequested, releaseCampaignMeasurementLease } from '../lib/campaignMeasurementLeaseVNext.mjs';
import { FactoryStore } from '../lib/factoryStore.mjs';
import { parallelMeasurementLeaseProfile, readParallelMeasurementRegistration, verifyRegisteredCampaign, verifiedBaselineGlobalWorkerProof } from '../lib/parallelMeasurementRegistrationVNext.mjs';

const ledgerPath = () => join(mkdtempSync(join(tmpdir(), 'mm-measurement-lease-')), 'budget.sqlite');
const profile = { measurement_only: true, publication_policy: 'never', cap_usd: 4 };
const args = ['--realtime-all', '--staging', '--measurement-only', '--parallel-measurement'];
const claim = (ledger, campaignId, ids, extra = {}) => claimCampaignMeasurementLease(ledger, { campaignId, candidateIds: ids, profile, args, ...extra });
const subprocessClaim = (path, campaignId, ids, more = {}) => {
  const code = `import {BudgetLedger} from ${JSON.stringify(new URL('../lib/budgetLedger.mjs', import.meta.url).href)};
    import {claimCampaignMeasurementLease} from ${JSON.stringify(new URL('../lib/campaignMeasurementLeaseVNext.mjs', import.meta.url).href)};
    const l=new BudgetLedger(${JSON.stringify(path)});try{const v=claimCampaignMeasurementLease(l,${JSON.stringify({ campaignId, candidateIds: ids, profile, args, ...more })});process.stdout.write('CLAIMED');}catch(e){process.stdout.write(e.message);process.exitCode=2;}finally{l.close();}`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
};

test('separate processes serialize same-campaign claims and permit disjoint campaign scopes', () => {
  const path = ledgerPath(), ledger = new BudgetLedger(path);
  try {
    const first = claim(ledger, 'campaign-a', ['a-1', 'a-2']);
    const duplicate = subprocessClaim(path, 'campaign-a', ['a-1', 'a-2']);
    assert.equal(duplicate.status, 2);
    assert.match(duplicate.stdout, /measurement_lease_campaign_already_owned/);
    const other = subprocessClaim(path, 'campaign-b', ['b-1', 'b-2']);
    assert.equal(other.status, 0, other.stdout);
    assert.match(other.stdout, /CLAIMED/);
    releaseCampaignMeasurementLease(ledger, first);
  } finally { ledger.close(); }
});

test('live owner cannot be displaced after timestamp expiry; candidate overlap blocks', () => {
  const ledger = new BudgetLedger(ledgerPath());
  try {
    claim(ledger, 'campaign-a', ['shared-id'], { now: 1000 });
    assert.throws(() => claim(ledger, 'campaign-a', ['shared-id'], { now: 9_000_000 }), /measurement_lease_campaign_already_owned/);
    assert.throws(() => claim(ledger, 'campaign-b', ['shared-id']), /measurement_lease_candidate_overlap/);
  } finally { ledger.close(); }
});

test('a restarted same-contract campaign can recover its own saved rows after the previous owner exits', () => {
  const path = ledgerPath(), ledger = new BudgetLedger(path), ids = ['restart-1'];
  try {
    const prior = claim(ledger, 'campaign-restart', ids);
    const priorStore = new FactoryStore(ledger, path, { candidateIds: ids });
    priorStore.claimMeasurement(prior);
    priorStore.set(ids[0], { state: 'waiting_validation', candidate: { body: 'persisted' } });
    ledger.db.prepare("UPDATE factory_measurement_leases_vnext SET owner_pid=2147483647 WHERE campaign_id='campaign-restart'").run();
    priorStore.measurementLease = null;
    const resumed = claim(ledger, 'campaign-restart', ids);
    const resumedStore = new FactoryStore(ledger, path, { candidateIds: ids });
    resumedStore.claimMeasurement(resumed);
    assert.equal(resumedStore.get(ids[0]).candidate.body, 'persisted');
    resumedStore.set(ids[0], { state: 'eligible', candidate: { body: 'persisted' } });
    assert.equal(resumedStore.get(ids[0]).state, 'eligible');
    resumedStore.release();
  } finally { ledger.close(); }
});

test('legacy active worker needs a verifiable disjoint scope proof and queue work blocks all providers', () => {
  const ledger = new BudgetLedger(ledgerPath());
  try {
    ledger.db.exec(`CREATE TABLE factory_worker(id INTEGER PRIMARY KEY,owner TEXT,expires INTEGER);
      CREATE TABLE factory_candidates(id TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    const owner = `${process.pid}:legacy-test`;
    ledger.db.prepare('INSERT INTO factory_worker VALUES(1,?,?)').run(owner, Date.now() - 1);
    ledger.db.prepare('INSERT INTO factory_candidates VALUES(?,?)').run('legacy-a1', '{}');
    assert.throws(() => claim(ledger, 'campaign-b', ['b1']), /measurement_lease_legacy_worker_scope_proof_required/);
    const proof = { owner, pid: process.pid, campaignId: 'campaign-a', candidateIds: ['legacy-a1'] };
    const lease = claim(ledger, 'campaign-b', ['b1'], { legacyGlobalScopeProof: proof, verifyLegacyGlobalScopeProof: () => true });
    releaseCampaignMeasurementLease(ledger, lease);
    assert.throws(() => claim(ledger, 'campaign-b', ['legacy-a1'], { legacyGlobalScopeProof: proof, verifyLegacyGlobalScopeProof: () => true }), /measurement_lease_candidate_overlap/);
    ledger.db.prepare("INSERT INTO provider_batches(id,provider,reservation_id,state,request_json) VALUES('queued-openai','openai','none','queued','{}')").run();
    assert.throws(() => claim(ledger, 'campaign-c', ['c1'], { legacyGlobalScopeProof: proof, verifyLegacyGlobalScopeProof: () => true }), /measurement_lease_provider_batch_work_pending/);
  } finally { ledger.close(); }
});

test('measurement lease does not bypass the persistent lifetime budget cap', () => {
  const ledger = new BudgetLedger(ledgerPath());
  try {
    claim(ledger, 'campaign-a', ['a1']);
    ledger.reconcileHistory({ spent_usd: 49.99, basis: 'isolated lease test fixture; no provider calls', confirmed_at: new Date().toISOString() });
    assert.throws(() => ledger.reserve('gpt-6-luna', 20_000), /budget_exhausted/);
    assert.equal(ledger.snapshot().limit_micro, 50_000_000);
  } finally { ledger.close(); }
});

test('profile, explicit mode flags, publish bit, and globally saved candidate IDs fail closed', () => {
  const ledger = new BudgetLedger(ledgerPath());
  try {
    assert.throws(() => claimCampaignMeasurementLease(ledger, { campaignId: 'x', candidateIds: ['x1'], profile: { ...profile, publication_policy: 'released_staging_only' }, args }), /measurement_lease_profile_mismatch/);
    assert.throws(() => claimCampaignMeasurementLease(ledger, { campaignId: 'x', candidateIds: ['x1'], profile, args: ['--staging', '--measurement-only'] }), /measurement_lease_flag_required/);
    assert.throws(() => claimCampaignMeasurementLease(ledger, { campaignId: 'x', candidateIds: ['x1'], profile, args: [...args, '--publish'] }), /measurement_lease_publication_forbidden/);
    ledger.db.exec('CREATE TABLE factory_candidates(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
    ledger.db.prepare('INSERT INTO factory_candidates VALUES(?,?)').run('already-used', '{}');
    assert.throws(() => claim(ledger, 'x', ['already-used']), /measurement_lease_candidate_id_already_saved/);
  } finally { ledger.close(); }
});

test('lease owner can atomically update only its registered candidate rows; future global claims reverse-check leases', () => {
  const path = ledgerPath(), ledger = new BudgetLedger(path);
  try {
    const ids = ['owned-1', 'owned-2'];
    const lease = claim(ledger, 'campaign-owned', ids);
    const scopedStore = new FactoryStore(ledger, path, { candidateIds: ids });
    scopedStore.claimMeasurement(lease);
    scopedStore.set('owned-1', { state: 'generated', candidate: { body: 'saved' } });
    scopedStore.set('owned-1', { state: 'eligible', candidate: { body: 'saved' } });
    assert.equal(scopedStore.get('owned-1').state, 'eligible');
    assert.throws(() => scopedStore.set('unknown-id', { state: 'eligible' }), /measurement_lease_candidate_scope_violation/);
    const overlappingWorker = new FactoryStore(ledger, path, { candidateIds: ['owned-2'] });
    assert.throws(() => overlappingWorker.claim(), /measurement_lease_active_scope_conflict/);
    const unscopedLegacyWorker = new FactoryStore(ledger, path);
    assert.throws(() => unscopedLegacyWorker.claim(), /measurement_lease_active_scope_conflict/);
    const disjointWorker = new FactoryStore(ledger, path, { candidateIds: ['other'] });
    disjointWorker.claim();
    disjointWorker.release();
    scopedStore.release();
    assert.equal(ledger.db.prepare("SELECT state FROM factory_measurement_leases_vnext WHERE campaign_id='campaign-owned'").get().state, 'released');
  } finally { ledger.close(); }
});

test('frozen registration binds exact A/B inputs and only proves the live baseline worker from its real Node path and frozen scope', () => {
  const registration = readParallelMeasurementRegistration();
  const b = verifyRegisteredCampaign('improved', { args: registration.worker_mode });
  const a = verifyRegisteredCampaign('baseline', { args: [] });
  assert.equal(b.candidateIds.length, 100);
  assert.equal(a.candidateIds.length, 100);
  assert.ok(!b.candidateIds.some(id => a.candidateIds.includes(id)));
  assert.equal(b.campaign.author_contract, a.campaign.author_contract);
  assert.equal(a.profile.verifier_version, 'cuet-fit-validator-v7.1');
  assert.equal(b.profile.verifier_version, 'cuet-fit-validator-v7.2');
  assert.equal(b.profile.contract_hash, '6f27a61131688db75be6686159b77894ee083f0c8abcca47d812a9a0eb20692c');
  assert.notEqual(b.campaignSha256, a.campaignSha256);

  const ledger = new BudgetLedger(ledgerPath());
  try {
    ledger.db.exec('CREATE TABLE factory_worker(id INTEGER PRIMARY KEY,owner TEXT,expires INTEGER)');
    ledger.db.prepare('INSERT INTO factory_worker VALUES(1,?,?)').run(`${process.pid}:frozen-baseline-worker`, Date.now());
    const cmd = `"C:\\Program Files\\nodejs\\node.exe" --use-system-ca "C:\\Users\\test\\mockmob\\artifacts\\question-factory\\cuet-readiness-2026-10-08\\baseline-code\\scripts\\pipeline\\tools\\cuetFitFactory.mjs" worker --staging --once --realtime-all --measurement-only --campaign-dir artifacts/question-factory/${a.campaign.id}`;
    const found = verifiedBaselineGlobalWorkerProof(ledger, { getCommandLine: () => cmd, isPidAlive: pid => pid === process.pid });
    assert.deepEqual(found.proof.candidateIds, a.candidateIds);
    const lease = claimCampaignMeasurementLease(ledger, { campaignId: b.campaign.id, candidateIds: b.candidateIds,
      profile: parallelMeasurementLeaseProfile(b.profile, registration), args: registration.worker_mode,
      legacyGlobalScopeProof: found.proof, verifyLegacyGlobalScopeProof: found.verify });
    releaseCampaignMeasurementLease(ledger, lease);
    assert.throws(() => verifiedBaselineGlobalWorkerProof(ledger, { getCommandLine: () => `powershell.exe -Command ${cmd}`, isPidAlive: () => true }), /parallel_measurement_legacy_worker_identity_unverified/);
  } finally { ledger.close(); }
});

test('cooperative STOP_AFTER_WAVE marker is observed at a boundary without deleting its evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mm-stop-marker-'));
  const marker = join(directory, 'STOP_AFTER_WAVE-test.json');
  try {
    assert.equal(parallelMeasurementStopRequested(marker), false);
    writeFileSync(marker, '{"action":"finish_current_wave_then_stop"}\n', { flag: 'wx' });
    assert.equal(parallelMeasurementStopRequested(marker), true);
    assert.equal(parallelMeasurementStopRequested(marker), true, 'the next restart must continue to see a durable stop request until the owner clears it');
  } finally { try { unlinkSync(marker); } catch {} }
});
