import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { pinNewJobsToFactoryProfileV73 } from './factoryProfileV73.mjs';
import { assertFactoryProfileV73 } from './factoryProfileV73.mjs';
import { FACTORY_PROFILE_V74, assertFactoryProfileV74 } from './factoryProfileV74.mjs';

export function assertQueueStagingTarget({ staging = false, url, key, productionUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL } = {}) {
  if (!staging) throw new Error('explicit_staging_target_required');
  if (!url || !key) throw new Error('staging_credentials_required');
  if (url !== 'https://onwkqxmjqjrhfbjjdydu.supabase.co' || url === productionUrl) throw new Error('unapproved_factory_target');
  return true;
}

export function validationPathForQueueJob(job) {
  const profile = job?.generation_brief?.validation_profile;
  if (profile !== undefined) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile) || !profile.campaign_id || !profile.profile_sha256) {
      throw new Error('factory_validation_profile_malformed');
    }
    if (profile.profile_version === FACTORY_PROFILE_V74) return 'v74';
    if (profile.profile_version === 'factory-validation-profile-v1') return 'v73';
    throw new Error('factory_validation_profile_unknown_version');
  }
  return 'legacy';
}

export function hasValidationProfilePinV73(job) {
  return Object.prototype.hasOwnProperty.call(job?.generation_brief ?? {}, 'validation_profile');
}

export function filterProfiledQueueInventoryV73(query) {
  if (!query || typeof query.not !== 'function') throw new Error('factory_profiled_inventory_query_required');
  return query.not('generation_brief->validation_profile', 'is', null);
}

export async function routeQueueValidation(job, candidate, { validateV73, validateLegacy, ...profileContext } = {}) {
  const route = validationPathForQueueJob(job);
  if (route === 'v73' || route === 'v74') {
    const profile = route === 'v74' ? assertPinnedQueueJobV74(job, profileContext) : assertPinnedQueueJobV73(job, profileContext);
    const validate = route === 'v74' ? profileContext.validateV74 : validateV73;
    if (typeof validate !== 'function') throw new Error(`factory_${route}_validator_required`);
    return validate(candidate, profile);
  }
  if (typeof validateLegacy !== 'function') throw new Error('factory_legacy_validator_required');
  return validateLegacy(candidate);
}

export function assertPinnedQueueJobV73(job, { manifest, registry, assertProfile } = {}) {
  if (validationPathForQueueJob(job) !== 'v73') throw new Error('factory_validation_profile_missing');
  const profile = job.generation_brief.validation_profile;
  const validate = assertProfile || ((value, context) => {
    if (!context?.manifest || !context?.registry) throw new Error('factory_validation_profile_context_required');
    return assertFactoryProfileV73(value, context);
  });
  const validated = validate(profile, { manifest, registry });
  if (!validated || validated.campaign_id !== profile.campaign_id || validated.profile_sha256 !== profile.profile_sha256) {
    throw new Error('factory_validation_profile_stale');
  }
  if (!job.id || job.kind !== 'original_practice' || job.anchor_id !== null) throw new Error('factory_profiled_original_job_required');
  return profile;
}

export function assertPinnedQueueJobV74(job, { manifest, registry, assertProfile } = {}) {
  if (validationPathForQueueJob(job) !== 'v74') throw new Error('factory_validation_profile_missing');
  const profile = job.generation_brief.validation_profile;
  const validate = assertProfile || ((value, context) => {
    if (!context?.manifest || !context?.registry) throw new Error('factory_validation_profile_context_required');
    return assertFactoryProfileV74(value, context);
  });
  const validated = validate(profile, { manifest, registry });
  if (!validated || validated.campaign_id !== profile.campaign_id || validated.profile_sha256 !== profile.profile_sha256) {
    throw new Error('factory_validation_profile_stale');
  }
  if (!job.id || job.kind !== 'original_practice' || job.anchor_id !== null) throw new Error('factory_profiled_original_job_required');
  return profile;
}

export function assertPinnedProfiledQueueJob(job, options = {}) {
  const version = validationPathForQueueJob(job);
  if (version === 'v73') return assertPinnedQueueJobV73(job, options);
  if (version === 'v74') return assertPinnedQueueJobV74(job, options);
  throw new Error('factory_validation_profile_missing');
}

export function refIsCurrent(ref, registry) {
  const source = registry.sources?.[ref?.id];
  const text = source?.facts?.[ref?.locator]?.text;
  return Boolean(source && typeof text === 'string' && source.state === 'active' && source.reuse_permitted === true &&
    source.version === ref.version && ref.support_hash && source.supports?.[ref.locator] === ref.support_hash &&
    hashJSON(text) === ref.support_hash);
}

function validateBrief(job, registry) {
  const id = job?.id, familyId = job?.family_id, packId = job?.source_pack_id;
  if (!id || !/^[a-z0-9][a-z0-9-]{2,127}$/i.test(id)) throw new Error('factory_campaign_candidate_id_required');
  if (job.kind !== 'original_practice' || job.candidate) throw new Error('factory_original_practice_brief_required');
  if (job.state && job.state !== 'queued' || job.repair_count !== undefined && job.repair_count !== 0) throw new Error('factory_new_job_state_required');
  if (!job.subject || !job.chapter || !job.topic || !job.format || !job.difficulty) throw new Error('factory_focused_coverage_brief_required');
  if (!familyId || !packId || !Number.isSafeInteger(job.source_pack_version)) throw new Error('factory_source_family_brief_required');
  const family = registry.families?.[familyId], pack = registry.packs?.[packId];
  if (!family || family.state !== 'active' || family.source_pack_id !== packId ||
      !pack || pack.state !== 'active' || pack.version !== job.source_pack_version || pack.subject && pack.subject !== job.subject) {
    throw new Error(`factory_family_or_pack_not_current:${id}`);
  }
  const spec = registry.exam_specs?.[job.subject];
  if (spec?.state !== 'verified' || !spec.included_topics?.length || !Array.isArray(spec.excluded_topics) || !spec.pattern_version) {
    throw new Error(`factory_exam_spec_not_current:${id}`);
  }
  const refs = job.source_refs;
  if (!Array.isArray(refs) || !refs.length || refs.some(ref => !refIsCurrent(ref, registry))) throw new Error(`factory_source_refs_not_current:${id}`);
  if (Array.isArray(pack.document_ids) && refs.some(ref => !pack.document_ids.includes(ref.id))) throw new Error(`factory_source_ref_outside_pack:${id}`);
  if (job.provenance && (job.provenance.kind !== 'original_practice' || job.provenance.anchor_id !== null || job.provenance.adaptation_family !== familyId)) {
    throw new Error(`factory_original_provenance_mismatch:${id}`);
  }
  return true;
}

export function prepareProfiledQueueRowsV73(campaign, profile, { registry, existingIds = [], reservedIds = [] } = {}) {
  if (!campaign || typeof campaign !== 'object' || campaign.id !== profile?.campaign_id) throw new Error('factory_campaign_profile_id_mismatch');
  if (!Array.isArray(campaign.jobs) || campaign.jobs.length === 0 || campaign.jobs.length > 100) throw new Error('factory_campaign_denominator_required');
  const fixedIds = campaign.jobs.map(job => job.id);
  if (campaign.denominator !== fixedIds.length || !Array.isArray(campaign.fixed_candidate_ids) ||
      campaign.fixed_candidate_ids.length !== fixedIds.length || campaign.fixed_candidate_ids.some((id, index) => id !== fixedIds[index])) {
    throw new Error('factory_campaign_fixed_denominator_mismatch');
  }
  if (!Number.isFinite(campaign.cap_usd) || campaign.cap_usd <= 0 || campaign.cap_usd > 50) throw new Error('factory_campaign_budget_bound_required');
  if (campaign.maximum_repairs_per_candidate !== undefined && campaign.maximum_repairs_per_candidate !== 1) throw new Error('factory_campaign_repair_bound_invalid');
  if (campaign.regeneration === true || campaign.no_regeneration === false) throw new Error('factory_campaign_regeneration_forbidden');
  const occupied = new Set([...existingIds, ...reservedIds].map(String));
  const seen = new Set();
  const jobs = campaign.jobs.map(job => {
    validateBrief(job, registry || {});
    if (seen.has(job.id) || occupied.has(job.id)) throw new Error(`factory_campaign_candidate_id_exists:${job.id}`);
    seen.add(job.id);
    return { ...structuredClone(job), anchor_id: null, state: 'queued', candidate: null, result: null,
      generation_brief: { ...structuredClone(job), campaign_cap_usd: campaign.cap_usd,
        campaign_denominator: campaign.denominator, campaign_candidate_ids: [...fixedIds] } };
  });
  const groupMap = new Map();
  for (const job of jobs) if (job.passage_group_id) {
    const group = registry.passage_groups?.[job.passage_group_id];
    if (!group || group.state !== 'active' || group.kind !== 'original_practice' || !Array.isArray(group.candidate_ids)) {
      throw new Error(`factory_passage_group_not_current:${job.passage_group_id}`);
    }
    const members = groupMap.get(job.passage_group_id) || [];
    members.push(job.id); groupMap.set(job.passage_group_id, members);
  }
  for (const [groupId, memberIds] of groupMap) {
    const expected = registry.passage_groups[groupId].candidate_ids;
    const members = jobs.filter(job => job.passage_group_id === groupId), group = registry.passage_groups[groupId];
    const pack = registry.packs?.[group.source_pack_id];
    if (expected.length > 10) throw new Error(`factory_passage_group_wave_size_exceeded:${groupId}`);
    if (expected.length < 2 || expected.length !== memberIds.length || expected.some(id => !memberIds.includes(id)) ||
        !pack || pack.state !== 'active' || group.source_pack_id !== members[0].source_pack_id ||
        members.some(job => job.passage_text !== group.passage_text || job.subject !== members[0].subject || job.chapter !== members[0].chapter)) {
      throw new Error(`factory_passage_group_campaign_mismatch:${groupId}`);
    }
  }
  return pinNewJobsToFactoryProfileV73(jobs, profile).map(job => ({
    id: job.id, subject: job.subject, chapter: job.chapter, kind: 'original_practice', anchor_id: null,
    generation_brief: job.generation_brief, state: 'queued', stage: 'authoring', attempt: 0,
    candidate: null, result: null, passage_group_id: job.passage_group_id || null,
  }));
}

export function reconstructProfiledOriginalBrief(row, currentProfile) {
  if (!['v73','v74'].includes(validationPathForQueueJob(row))) throw new Error('factory_validation_profile_missing');
  const profile = row.generation_brief.validation_profile;
  if (profile.campaign_id !== currentProfile?.campaign_id || profile.profile_sha256 !== currentProfile?.profile_sha256) {
    throw new Error('factory_validation_profile_stale');
  }
  const { validation_profile: _profile, v73_worker_state: _workerState, ...brief } = row.generation_brief;
  return { ...structuredClone(brief), id: row.id, subject: row.subject, chapter: row.chapter, kind: 'original_practice', anchor_id: null };
}

export function assertProfiledPublicationV73(candidate, profile, { assertProfile, manifest, registry } = {}) {
  const validate = assertProfile || ((value, context) => {
    if (!context?.manifest || !context?.registry) throw new Error('factory_validation_profile_context_required');
    return assertFactoryProfileV73(value, context);
  });
  validate(profile, { manifest, registry });
  const record = candidate?.evidence?.record;
  if (!record || !candidate.evidence?.signature || record.state !== 'eligible' ||
      record.verifier_version !== profile.verifier_version ||
      record.validation_contract_hash !== profile.validation_contract_hash ||
      record.validation_topology !== profile.topology || record.provenance?.kind !== 'original_practice' ||
      candidate.provenance?.kind !== 'original_practice' || candidate.provenance?.anchor_id !== null ||
      candidate.provenance?.adaptation_family !== candidate.family_id) {
    throw new Error('factory_profiled_publication_evidence_mismatch');
  }
  return profile.profile_sha256;
}

export function selectProfiledWaveV73(rows, maxCandidates = 10) {
  const candidates = rows.filter(row => ['queued', 'waiting', 'validating', 'repairing'].includes(row.state));
  const groups = new Map();
  for (const row of candidates) {
    const key = row.passage_group_id ? `group:${row.passage_group_id}` : `single:${row.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const selected = [];
  for (const members of groups.values()) {
    if (members.length > maxCandidates) throw new Error(`factory_passage_group_wave_size_exceeded:${members[0].passage_group_id}`);
    if (selected.length && selected.length + members.length > maxCandidates) continue;
    selected.push(...members);
  }
  return selected;
}

export function oversizedProfiledPassageGroupsV73(rows, registry, maxCandidates = 10) {
  const ids = new Set(rows.map(row => row.passage_group_id).filter(Boolean));
  const oversized = new Map();
  for (const groupId of ids) {
    const members = rows.filter(row => row.passage_group_id === groupId);
    const expected = registry?.passage_groups?.[groupId]?.candidate_ids;
    if (members.length > maxCandidates || Array.isArray(expected) && expected.length > maxCandidates) {
      oversized.set(groupId, members);
    }
  }
  return oversized;
}

export function requiresProfiledQueueLeaseV73({ authoringCount = 0, invalidCount = 0, eligibleCount = 0 } = {}) {
  return authoringCount > 0 || invalidCount > 0 || eligibleCount > 0;
}

export function passagePublicationState(rows, allCampaignRows, groupId, expectedIds = []) {
  const expected = new Set(expectedIds);
  const registered = allCampaignRows.filter(row => row.passage_group_id === groupId);
  const memberIds = new Set(registered.map(row => row.id));
  if (registered.some(row => row.state === 'quarantined')) return { state: 'quarantined', rows: registered };
  if (expected.size < 2 || [...expected].some(id => !memberIds.has(id))) return { state: 'waiting', rows: registered };
  if (registered.some(row => !['eligible', 'published'].includes(row.state))) return { state: 'waiting', rows: registered };
  if (expected.size !== memberIds.size || [...memberIds].some(id => !expected.has(id))) return { state: 'blocked', rows: registered };
  return { state: 'ready', rows: registered };
}

export function assertProfiledPassageGroupV73(rows, profile, options = {}) {
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('factory_profiled_passage_group_incomplete');
  const expected = profile.profile_sha256;
  for (const row of rows) {
    const pinned = assertPinnedProfiledQueueJob(row, options);
    if (pinned.profile_sha256 !== expected) throw new Error('factory_passage_group_profile_mismatch');
    assertProfiledPublicationV73(row.candidate, pinned, options);
    if (row.candidate?.passage_group_id !== rows[0].candidate?.passage_group_id) throw new Error('factory_passage_group_profile_mismatch');
  }
  return expected;
}
