import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentRegistry } from '../../../data/evidence_registry.js';
import { RELEASE_POLICY_V7 } from '../lib/releaseEvidenceV7.mjs';
import { expectedReleaseBindingV76 } from '../lib/releaseEvidenceV76.mjs';
import { createFactoryProfileV76 } from '../lib/factoryProfileV76.mjs';
import { publishQualifiedCuetFitCampaignV76, publicationPayloadHashV76, stagingControlLifecycleV76 } from '../lib/cuetFitPublicationV76.mjs';

// Software fixture only: academic eligibility is mocked. This does not qualify a
// real release or a real campaign; the CLI always uses the trusted evaluator.
function fixture(directory) {
  const registry = currentRegistry(), binding = expectedReleaseBindingV76();
  const manifest = { cuet_fit_releases: { dual_blind: { state: 'released', topology: 'dual_blind', problems: [],
    fresh_false_accepts: [], regression_false_accepts: [], valid_survival: .9,
    valid_by_subject: Object.fromEntries(['accountancy', 'business_studies', 'economics', 'english'].map(s => [s, { n: 10, ok: 9 }])),
    release_policy: RELEASE_POLICY_V7, ...binding, source_registry_version: registry.version,
    critical_false_accepts: 0, benchmark: { state: 'completed', payload_hash: 'a'.repeat(64) } } } };
  const profile = createFactoryProfileV76({ campaignId: 'software-publication-v76', manifest, registry });
  const job = { id: 'new', state: 'eligible', candidate: { id: 'new', subject: 'economics', chapter: 'Production & Costs',
    question_type: 'direct_concept', difficulty: 'easy', concept_id: 'concept_new',
    body: 'Which cost remains unchanged as output changes in the short run?',
    options: ['Fixed cost', 'Variable cost', 'Marginal cost', 'Total cost'], correct_answer: 'A',
    evidence: { record: { candidate_id: 'new', validation_topology: profile.topology, verifier_version: profile.verifier_version,
      validation_contract_hash: profile.validation_contract_hash,
      checks: Object.fromEntries(['blind_solution', 'independent_evaluation', 'explanation_support'].map(stage => [stage, {
        prompt_version: profile.verifier_version, evaluation_prompt: profile.prompt_hash, validation_contract_hash: profile.validation_contract_hash }])) } } } };
  const jobs = [job], events = [];
  return { directory, registry, manifest, profile, jobs, events,
    campaign: { id: profile.campaign_id, jobs: [{ id: job.id }], publication_policy: 'released_staging_only', measurement_only: false },
    report: { id: profile.campaign_id, denominator: 1, approved_unique: 1, complete: true, publication_accounting: { ready: true }, cost: { held_usd: 0 }, jobs },
    run: { execution_finished: true, receipt_complete: true, held_usd: 0, campaign_id: profile.campaign_id,
      profile_sha256: profile.profile_sha256, candidate_payload_hash: publicationPayloadHashV76(jobs) },
    evidenceEligibility: () => ({ eligible: true }), eligible: () => ({ eligible: true }),
    readInventory: async () => { events.push('inventory'); return []; },
    prepareTarget: async () => events.push('prepare'), cleanupTarget: async () => events.push('cleanup'),
    publish: async rows => { events.push('publish'); return { ids: rows.map(row => row.id) }; },
  };
}
async function withFixture(fn) {
  const directory = mkdtempSync(join(tmpdir(), 'cuet-fit-v76-'));
  try { await fn(fixture(directory)); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('exact current V76 profile passes the software gate without campaign policy added to profile', () => withFixture(async f => {
  assert.equal(f.profile.publication_policy, undefined);
  const outcome = await publishQualifiedCuetFitCampaignV76(f);
  assert.deepEqual(f.events, ['inventory', 'prepare', 'inventory', 'publish', 'cleanup']);
  assert.equal(outcome.status, 'published');
  assert.deepEqual(outcome.receipt.ids, ['new']);
}));

test('measurement, missing settlement, stale candidate binding and wrong source profile fail before writes or inventory', () => withFixture(async f => {
  for (const options of [
    { campaign: { ...f.campaign, measurement_only: true } },
    { run: { ...f.run, receipt_complete: false } },
    { run: { ...f.run, held_usd: .01 } },
    { run: { ...f.run, held_usd: null } },
    { run: { ...f.run, candidate_payload_hash: 'b'.repeat(64) } },
    { registry: { ...f.registry, version: f.registry.version + '-stale' } },
  ]) await assert.rejects(publishQualifiedCuetFitCampaignV76({ ...f, ...options }));
  assert.deepEqual(f.events, []);
  assert.deepEqual(readdirSync(f.directory), []);
}));

test('changed content and missing current mandatory check fail before writes even with refreshed run hash', () => withFixture(async f => {
  f.jobs[0].candidate.evidence.record.checks.independent_evaluation.validation_contract_hash = 'old';
  f.run.candidate_payload_hash = publicationPayloadHashV76(f.jobs);
  await assert.rejects(publishQualifiedCuetFitCampaignV76(f), /publication_evidence_required:new/);
  assert.deepEqual(f.events, []);
  f.jobs[0].candidate.evidence.record.checks.independent_evaluation.validation_contract_hash = f.profile.validation_contract_hash;
  f.run.candidate_payload_hash = publicationPayloadHashV76(f.jobs);
  await assert.rejects(publishQualifiedCuetFitCampaignV76({ ...f, evidenceEligibility: () => ({ eligible: false, reasons: ['content_changed', 'stale_source'] }) }), /publication_evidence_required/);
  assert.deepEqual(f.events, []);
  assert.deepEqual(readdirSync(f.directory), []);
}));

test('current inventory duplicate withholds entire campaign before preparing target', () => withFixture(async f => {
  await assert.rejects(publishQualifiedCuetFitCampaignV76({ ...f,
    readInventory: async () => [{ ...f.jobs[0].candidate, id: 'existing' }] }), /publish_time_inspection_withheld:new/);
  assert.deepEqual(f.events, []);
}));

test('incomplete registered passage group fails before target preparation', () => withFixture(async f => {
  Object.assign(f.jobs[0].candidate, { passage_group_id: 'group', passage_text: 'Complete passage.', order_index: 0,
    provenance: { kind: 'original_practice' } });
  f.registry.passage_groups = { ...f.registry.passage_groups, group: { id: 'group', kind: 'original_practice', state: 'active',
    candidate_ids: ['new', 'missing'], passage_text: 'Complete passage.' } };
  // Registry is profile-bound; refresh the software release/profile for this registry.
  f.profile = createFactoryProfileV76({ campaignId: f.campaign.id, manifest: f.manifest, registry: f.registry });
  f.run.profile_sha256 = f.profile.profile_sha256;
  f.run.candidate_payload_hash = publicationPayloadHashV76(f.jobs);
  await assert.rejects(publishQualifiedCuetFitCampaignV76(f), /complete_passage_group_publication_required/);
  assert.deepEqual(f.events, []);
}));

test('cleanup executes when target preparation throws', () => withFixture(async f => {
  await assert.rejects(publishQualifiedCuetFitCampaignV76({ ...f, prepareTarget: async () => { f.events.push('prepare'); throw Error('partial prepare'); } }), /partial prepare/);
  assert.deepEqual(f.events, ['inventory', 'prepare', 'cleanup']);
}));

test('staging control restores complete prior snapshot on successful and failed enable', async () => {
  for (const fail of [false, true]) {
    const snapshot = { id: 1, paused: false, phase: '250', publication_enabled: false, updated_at: 'original-time', config: { retained: true } };
    const updates = [];
    const db = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: snapshot, error: null }) }) }),
      update: values => ({ eq: async (key, id) => { updates.push({ values, key, id }); return { error: fail && updates.length === 1 ? { code: 'failed' } : null }; } }) }) };
    const lifecycle = await stagingControlLifecycleV76(db);
    try { await lifecycle.enable(); } catch (error) { assert.match(error.message, /staging_control:failed/); }
    await lifecycle.restore();
    const { id, ...values } = snapshot;
    assert.deepEqual(updates[1], { values, key: 'id', id });
    await lifecycle.restore();
    assert.equal(updates.length, 2);
  }
});


test('the default trusted evaluator rejects unsigned mock evidence before inventory and writes', () => withFixture(async f => {
  const { evidenceEligibility, ...realGate } = f;
  await assert.rejects(publishQualifiedCuetFitCampaignV76(realGate), /publication_evidence_required/);
  assert.deepEqual(f.events, []);
  assert.deepEqual(readdirSync(f.directory), []);
}));

test('a bank duplicate introduced during preparation prevents the callback and restores lifecycle', () => withFixture(async f => {
  let reads = 0;
  await assert.rejects(publishQualifiedCuetFitCampaignV76({ ...f,
    readInventory: async () => { f.events.push('inventory'); return ++reads === 1 ? [] : [{ ...f.jobs[0].candidate, id: 'late-existing' }]; }
  }), /publish_time_withheld/);
  assert.deepEqual(f.events, ['inventory', 'prepare', 'inventory', 'cleanup']);
}));
