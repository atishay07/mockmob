import { createHash } from 'node:crypto';
import { canonicalJSON } from '../../../data/canonical_json.mjs';
import { contentHash } from '../../../data/content_evidence.js';
import { FACTORY_VERIFIER_VERSION, sourceMaterial } from './factoryEvidence.mjs';
import { presentationLint, quotesInReferences } from './factoryCore.mjs';

export const COHORT010_CAMPAIGN_SHA256 = '15414c96852e72bee298f2d0085ca95feba3a160ebd2e398c581d8ffcebeac62';
export const COHORT010_LEGACY_EXPORT_SHA256 = '3f1e38f5f989d573a7cc8832f0b10a13599d0b9af3f09c09949decacdb5cf784';
export const COHORT010_V62_CONTRACT_HASH = 'd80135b0271f350a1864c9d107b078f07fbefa54419c4615a8891aa096308399';
export const COHORT010_BATCH_ID = 'batch_6ac6311aa79481909d9e257151b0078c';

// The recovery surface is intentionally immutable and candidate-specific. A
// campaign refresh cannot silently expand this set.
export const COHORT010_ALLOWLIST = Object.freeze([
  ['1cca5e2888f366ce9fc773668b8d6570','9309793ab93c518accd6b41d674700480e7f5723cba8cf2806bc9527e8504bf7','5752aeadf5425d0a99658eaacf455f8e01c8f8e2145dca76900429c1dc0d0e42','d64e788e-92da-4696-a01e-bb5a7be7f754','complete'],
  ['19fa0c9e74d76d9d0977f1786973aed1','212ff0fac36d6723bcad8e4ff7e8e6dfe34455cbace0bc436e6d65487c10d528','a8fcc6b0fb9103842514c42c776b6adcdd60104090c5531888b7e897c389859c','cf6fbac0-f103-403f-9a52-e8da792209d8','complete'],
  ['0b00f3879fb1571e8321e3c225ed2691','787234dd6d9e18494df122435abf57aad540ff5129e0a1266f1b601c0d3f89ac','1dc87dcf4fa697f67bc23e1bd9120a8ccf81d5857c7c0d4ea2f4823f56bc90a7','71ee22c6-2c1f-4036-93a2-7e53524d772f','complete'],
  ['eb61c3e41b93642355ca898af68c18ae','50b605c5ec60ee29849d7613a7c07bd155fa6ee909adfe1b0d41fc7e762a0f13','870a7b739fec17b3680e04f947b8c1f626f029331ffb6eae62370571aed37ad8','39a37319-6b8f-48a8-9bb0-932f03a91806','rejected'],
  ['d1a72724634b8252bc27746877423d75','6af07de07da480a23c3acc9aef9bbbccbd96d22844837a88427d5a3de149be5b','b58d70643c2cfd7162f97161e4f29881401ce92919a7bf708a0730346d9f1fa1','ff391352-67dd-448f-9816-4e4ad154220d','complete'],
  ['55135835f6f1ee881f28e92430319ca9','71783be95cf633660908b970eeb9bcf4397ed3b5f7099b98fcbb55df83c904bc','9b3652ebcb5c682b9643c77a88cf7d1a9314926e8f631ba56a28bee4e383560e','79602143-a1a1-4a1e-935a-382eb6d04151','complete'],
  ['b72d533b26df4a321b9c74d6736443b2','8e8b73e956fee0ec6beb92ba0238c692824c88c498c396d58fbe55a789bd2fbc','74798198b050dd92501d06ddc148a5d91b8e4ae2b321015d283c01999f962187','69b71a99-5443-4c80-b510-24f1935646fc','rejected'],
  ['0a16d82c4a67d12d48b8941cba10d1a6','8a3f0545d4b2b063e620a714ce6ac0e61bdfbbab8c62d2c03fb4f885389448c0','866d54d5f816b17f37bd1dd195fa9b6dbd3756091bfa5439befd1d575b7b0102','d85556cc-9290-4637-adc8-9fbcd5bbb6be','complete'],
  ['f37c23d208dea14c39a49ca1f948a5a9','ff9aacc2e13ff7c9a55e14037686373026ea829689b1e1798f3fb9e69550e5bc','63edbb4626367c863c6902a3e9982fcb8ed228dc032c0a4beb3d089b2b230621','2c150529-2c17-4dc5-8ea3-fc86d888cbe3','rejected']
].map(([candidate_id,request_key,body_sha256,reservation_id,provider_state])=>Object.freeze({candidate_id,request_key,body_sha256,reservation_id,provider_state,provider:'openai',model:'gpt-6-luna',provider_id:COHORT010_BATCH_ID})));

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const rowSha256 = value => sha256(canonicalJSON(value));

// Mirrors the post-response transformation in authorOriginal. Recovery uses
// the exact saved provider request body rather than re-creating a prompt under
// potentially newer code; only the deterministic candidate envelope is built
// here, with the same registered references and presentation/source checks.
export function materializeCohort010Candidate(job, registry, authored) {
  const references = sourceMaterial(registry, job.source_refs || []);
  if (!references.length) throw new Error('original_decisive_references_required');
  const candidate = { ...authored, id: job.id, subject: job.subject, chapter: job.chapter, topic: job.topic, branch: job.branch,
    family_id: job.family_id,
    provenance: { kind: 'original_practice', anchor_id: null, adaptation_family: job.family_id, adaptation_type: null,
      syllabus_version: registry.exam_specs[job.subject].syllabus_version, pattern_version: registry.exam_specs[job.subject].pattern_version,
      source_pack_id: job.source_pack_id, source_pack_version: job.source_pack_version },
    source_refs: job.source_refs, passage_text: job.passage_text || '', generator_version: FACTORY_VERIFIER_VERSION,
    ...(job.passage_group_id ? { passage_group_id: job.passage_group_id, order_index: job.order_index } : {}) };
  const lint = presentationLint(candidate);
  if (!quotesInReferences(authored.evidence_quotes, references).length) lint.push('author_evidence_quote_not_in_sources');
  if (lint.length) { const error = new Error(`author_presentation_lint:${lint.join(',')}`); error.candidate = candidate; throw error; }
  return candidate;
}

export async function planCohort010Recovery({ campaign, campaignSha256, registration, jobsById, receiptsByKey, materialize, allowlist = COHORT010_ALLOWLIST }) {
  if (campaignSha256 !== COHORT010_CAMPAIGN_SHA256) throw new Error('cohort010_campaign_hash_mismatch');
  if (registration?.contract_hash !== COHORT010_V62_CONTRACT_HASH) throw new Error('cohort010_v62_contract_hash_mismatch');
  if (campaign.id !== 'cost-native-cohort-010' || campaign.no_regeneration !== true || campaign.denominator !== 100) throw new Error('cohort010_frozen_registration_contract_mismatch');
  const planned = [];
  for (const expected of allowlist) {
    const job = jobsById.get(expected.candidate_id);
    if (!job) throw new Error(`cohort010_job_missing:${expected.candidate_id}`);
    const marker = job.recovery_marker;
    if (marker?.request_key === expected.request_key) {
      if (job.candidate && marker.candidate_sha256 === sha256(canonicalJSON(job.candidate)) && job.state === 'generated' ||
          !job.candidate && marker.terminal === 'preinference_credit_refused' && job.state === 'quarantined' && job.result?.reasons?.includes('authoring_preinference_credit_refused')) {
        planned.push({ ...expected, action: 'already_recovered', expected_local_sha256: rowSha256(job), old_value: job, next_value: job });
        continue;
      }
      throw new Error(`cohort010_recovery_marker_mismatch:${expected.candidate_id}`);
    }
    const prior = receiptsByKey.get(expected.request_key);
    if (!prior) throw new Error(`cohort010_allowlisted_key_missing:${expected.request_key}`);
    if (prior.request_key !== expected.request_key || prior.reservation_id !== expected.reservation_id || prior.provider !== expected.provider || prior.model !== expected.model || prior.provider_id !== expected.provider_id)
      throw new Error(`cohort010_saved_request_identity_mismatch:${expected.candidate_id}`);
    if (prior.candidate_id !== expected.candidate_id || prior.stage !== 'authoring' || prior.purpose !== 'candidate') throw new Error(`cohort010_saved_request_scope_mismatch:${expected.candidate_id}`);
    if (prior.body_sha256 !== expected.body_sha256) throw new Error(`cohort010_saved_request_body_digest_mismatch:${expected.candidate_id}`);
    if (job.pending !== expected.request_key) {
      throw new Error(`cohort010_local_pending_key_mismatch:${expected.candidate_id}`);
    }
    if (job.candidate || job.state !== 'waiting_authoring') throw new Error(`cohort010_local_job_changed:${expected.candidate_id}`);
    if (prior.provider_state !== expected.provider_state) throw new Error(`cohort010_provider_state_mismatch:${expected.candidate_id}`);
    if (expected.provider_state === 'complete') {
      if (prior.request_state !== 'settled' || !prior.response) throw new Error(`cohort010_complete_receipt_unavailable:${expected.candidate_id}`);
      let candidate;
      try { candidate = await materialize(job, expected, prior); }
      catch (error) {
        if (error?.candidate?.id === expected.candidate_id) {
          const candidateSha = sha256(canonicalJSON(error.candidate));
          const next = { ...job, candidate: error.candidate, state: 'generated', author_failure: error.message,
            result: { state: 'quarantined', reasons: [error.message] },
            recovery_marker: { request_key: expected.request_key, candidate_sha256: candidateSha, body_sha256: expected.body_sha256, terminal: 'saved_response_candidate_quarantined', recovered_at: null } };
          planned.push({ ...expected, action: 'quarantine_saved_response_candidate', reason: error.message, old_value: job,
            candidate_sha256: candidateSha, candidate_content_hash: contentHash(error.candidate), candidate: error.candidate,
            expected_local_sha256: rowSha256(job), next_value: next });
          continue;
        }
        planned.push({ ...expected, action: 'retain_pending', reason: error?.message || 'authoring_replay_failed', expected_local_sha256: rowSha256(job), old_value: job, next_value: job });
        continue;
      }
      if (!candidate || candidate.id !== expected.candidate_id) throw new Error(`cohort010_decoded_candidate_identity_mismatch:${expected.candidate_id}`);
      const candidateSha = sha256(canonicalJSON(candidate));
      const next = { ...job, candidate, state: 'generated', recovery_marker: { request_key: expected.request_key, candidate_sha256: candidateSha, body_sha256: expected.body_sha256, recovered_at: null } };
      planned.push({ ...expected, action: 'replay_saved_response', candidate_sha256: candidateSha, candidate_content_hash: contentHash(candidate), candidate, old_value: job,
        expected_local_sha256: rowSha256(job), next_value: next });
    } else {
      const error = prior.receipt_error;
      if (prior.request_state !== 'settled' || prior.http_status !== 429 || error?.type !== 'insufficient_quota' || error?.code !== 'credit_balance_exhausted')
        throw new Error(`cohort010_refusal_not_typed_preinference:${expected.candidate_id}`);
      const next = { ...job, state: 'quarantined', result: { state: 'quarantined', reasons: ['authoring_preinference_credit_refused'], failure_details: [{ request_key: expected.request_key, http_status: 429, code: 'credit_balance_exhausted', inference_started: false }] }, recovery_marker: { request_key: expected.request_key, body_sha256: expected.body_sha256, terminal: 'preinference_credit_refused', recovered_at: null } };
      planned.push({ ...expected, action: 'quarantine_typed_refusal', reason: 'authoring_preinference_credit_refused', expected_local_sha256: rowSha256(job), old_value: job, next_value: next });
    }
  }
  const keys = new Set(planned.map(p => p.request_key));
  if (keys.size !== allowlist.length) throw new Error('cohort010_allowlist_not_unique');
  return planned;
}

export function assertNoLiveCohort010Leases(db, isPidAlive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }) {
  const tableExists = name => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  const ownerPid = owner => {
    const pid = Number(String(owner || '').split(':')[0]);
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  };
  const worker = tableExists('factory_worker') ? db.prepare('SELECT owner,expires FROM factory_worker WHERE id=1').get() : null;
  // A live process remains an owner even if its lease timestamp is stale.
  if (worker?.owner && ownerPid(worker.owner) && isPidAlive(ownerPid(worker.owner))) throw new Error('cohort010_recovery_factory_worker_active');
  const controller = tableExists('factory_campaign_controller') ? db.prepare('SELECT owner FROM factory_campaign_controller WHERE id=1').get() : null;
  if (controller?.owner && ownerPid(controller.owner) && isPidAlive(ownerPid(controller.owner))) throw new Error('cohort010_recovery_campaign_controller_active');
  if (tableExists('factory_measurement_leases_vnext')) {
    for (const lease of db.prepare("SELECT campaign_id,owner,owner_pid FROM factory_measurement_leases_vnext WHERE state='active'").all()) {
      // Recovery writes shared factory_candidates rows. Any live scoped worker
      // can be affected, so do not limit this check to candidate overlap.
      if (lease.owner && Number.isSafeInteger(lease.owner_pid) && lease.owner_pid > 0 && isPidAlive(lease.owner_pid)) {
        throw new Error('cohort010_recovery_measurement_lease_active');
      }
    }
  }
  return true;
}

export function applyCohort010Recovery(db, plan, { now = new Date().toISOString(), isPidAlive } = {}) {
  db.exec('BEGIN IMMEDIATE');
  try {
    assertNoLiveCohort010Leases(db, isPidAlive);
    for (const action of plan) {
      if (!['replay_saved_response','quarantine_saved_response_candidate','quarantine_typed_refusal'].includes(action.action)) continue;
      const currentRow = db.prepare('SELECT value FROM factory_candidates WHERE id=?').get(action.candidate_id);
      if (!currentRow) throw new Error(`cohort010_apply_local_job_missing:${action.candidate_id}`);
      const current = JSON.parse(currentRow.value);
      if (rowSha256(current) !== action.expected_local_sha256) {
        if (current.recovery_marker?.request_key === action.request_key && ['replay_saved_response','quarantine_saved_response_candidate'].includes(action.action) && current.recovery_marker.candidate_sha256 === action.candidate_sha256) continue;
        throw new Error(`cohort010_apply_local_job_changed:${action.candidate_id}`);
      }
      const next = structuredClone(action.next_value);
      next.recovery_marker = { ...next.recovery_marker, recovered_at: now };
      db.prepare('UPDATE factory_candidates SET value=? WHERE id=?').run(JSON.stringify(next), action.candidate_id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { applied: plan.filter(p => ['replay_saved_response','quarantine_saved_response_candidate','quarantine_typed_refusal'].includes(p.action)).length,
    replayed: plan.filter(p => p.action === 'replay_saved_response').length,
    quarantined: plan.filter(p => ['quarantine_saved_response_candidate','quarantine_typed_refusal'].includes(p.action)).length };
}
