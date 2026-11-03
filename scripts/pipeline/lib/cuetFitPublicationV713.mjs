import { assertFactoryProfileV713 } from './factoryProfileV713.mjs';
import { evaluateEvidenceV7 } from '../../../data/cuet_fit_evidence.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { factoryPassageGroup } from './factoryCore.mjs';
import { inspectBeforeBulkPublish, publishInspectedUnit } from './publishTimeInspection.mjs';

export const publicationPayloadHashV713 = jobs => hashJSON(jobs.map(({ id, candidate, result }) => ({ id, candidate, result })));

export function assertCuetFitPublicationQualificationV713({ profile, campaign, report, run, jobs = report?.jobs, manifest, registry,
  evidenceEligibility = evaluateEvidenceV7 } = {}) {
  if (!campaign || campaign.measurement_only === true || campaign.publication_policy !== 'released_staging_only' ||
      profile?.measurement_only === true || profile?.publication_policy === 'never') throw Error('cuet_fit_v713_staging_profile_required');
  assertFactoryProfileV713(profile, { manifest, registry });
  if (campaign.id !== profile.campaign_id || report?.id !== campaign.id) throw Error('cuet_fit_v713_campaign_profile_mismatch');
  if (!report || report.complete !== true || report.publication_accounting?.ready !== true ||
      report.cost?.held_usd !== 0 || run?.execution_finished !== true || run.receipt_complete !== true || run.held_usd !== 0) {
    throw Error('cuet_fit_v713_complete_settled_qualification_required');
  }
  if (!Array.isArray(jobs) || !jobs.length || jobs.some(job => !['eligible', 'published'].includes(job.state)) ||
      new Set(jobs.map(job => job.id)).size !== jobs.length) throw Error('cuet_fit_v713_qualified_jobs_required');
  if (!Array.isArray(campaign.jobs) || new Set(campaign.jobs.map(job => job.id)).size !== campaign.jobs.length ||
      report.denominator !== campaign.jobs.length || report.approved_unique !== jobs.length ||
      jobs.some(job => !campaign.jobs.some(registered => registered.id === job.id))) throw Error('cuet_fit_v713_campaign_candidate_binding_required');
  if (run.campaign_id !== campaign.id || run.profile_sha256 !== profile.profile_sha256 ||
      run.candidate_payload_hash !== publicationPayloadHashV713(jobs)) throw Error('cuet_fit_v713_settled_run_binding_required');
  for (const job of jobs) {
    const record = job.candidate?.evidence?.record;
    if (job.candidate?.id !== job.id || record?.candidate_id !== job.id || record?.validation_topology !== profile.topology ||
        record?.verifier_version !== profile.verifier_version || record?.validation_contract_hash !== profile.validation_contract_hash ||
        ['blind_solution', 'independent_evaluation', 'explanation_support'].some(stage => {
          const check = record?.checks?.[stage];
          return check?.prompt_version !== profile.verifier_version || check?.evaluation_prompt !== profile.prompt_hash ||
            check?.validation_contract_hash !== profile.validation_contract_hash;
        }) || !evidenceEligibility(job.candidate, registry).eligible) {
      throw Error(`cuet_fit_v713_publication_evidence_required:${job.id}`);
    }
  }
  for (const groupId of new Set(jobs.map(job => job.candidate.passage_group_id).filter(Boolean))) {
    factoryPassageGroup(jobs.filter(job => job.candidate.passage_group_id === groupId).map(job => job.candidate), registry);
  }
  return jobs;
}

export async function publishQualifiedCuetFitCampaignV713(options = {}) {
  const rows = assertCuetFitPublicationQualificationV713(options);
  const { readInventory, registry, eligible, directory, publish, prepareTarget, cleanupTarget, now } = options;
  if (typeof readInventory !== 'function' || typeof publish !== 'function' || typeof prepareTarget !== 'function' ||
      typeof cleanupTarget !== 'function' || !directory) throw Error('cuet_fit_v713_publication_dependencies_required');
  const inspection = await inspectBeforeBulkPublish({ rows, readInventory, registry, eligible, directory, now });
  let receipt;
  try {
    await prepareTarget(rows, inspection);
    const outcome = await publishInspectedUnit({ rows, readInventory, registry, eligible, publish });
    if (outcome.status !== 'published') throw Error(`cuet_fit_v713_publish_time_${outcome.status}`);
    receipt = outcome.receipt;
  }
  finally { await cleanupTarget(); }
  return { status: 'published', rows, inspection, receipt };
}

// Read the complete pre-existing row before mutations. Restore exactly those values,
// including phase/timestamps, even when preparing or publishing throws.
export async function stagingControlLifecycleV713(db) {
  const { data: snapshot, error } = await db.from('question_factory_control').select('*').eq('id', 1).single();
  if (error || !snapshot) throw Error('cuet_fit_v713_staging_control_snapshot_required');
  let attempted = false;
  return {
    enable: async () => {
      attempted = true;
      const { error } = await db.from('question_factory_control').update({ paused: false, phase: '1000', publication_enabled: true }).eq('id', 1);
      if (error) throw Error(`cuet_fit_v713_staging_control:${error.code || 'unknown'}`);
    },
    restore: async () => {
      if (!attempted) return;
      const { id, ...values } = snapshot;
      const { error } = await db.from('question_factory_control').update(values).eq('id', id);
      if (error) throw Error(`cuet_fit_v713_staging_restore_failed:${error.code || 'unknown'}`);
      attempted = false;
    },
  };
}
