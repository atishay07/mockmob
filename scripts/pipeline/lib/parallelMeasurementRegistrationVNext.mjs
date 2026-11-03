import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const repoPath = (...parts) => resolve(...parts);
const freezePath = 'artifacts/question-factory/cuet-readiness-2026-10-08/parallel-measurement-registration.json';
const frozenRegistrationSha256 = 'bef6fd6ca2c80b57f5d173d908b3bb115449b277709f33c245c6ff5d44ebb8fc';
const campaignDir = arm => `artifacts/question-factory/cuet-readiness-${arm === 'baseline' ? 'baseline' : 'improved'}-100-2026-10-08`;

export function readParallelMeasurementRegistration() {
  const bytes = readFileSync(freezePath, 'utf8');
  if (sha256(bytes) !== frozenRegistrationSha256) throw Error('parallel_measurement_registration_hash_mismatch');
  const registration = JSON.parse(bytes);
  if (registration.format !== 'parallel-measurement-registration-v1' || registration.publish !== false ||
      registration.provider_batch_queue_must_be_empty !== true || registration.maximum_wave_iterations !== 30 ||
      registration.cooperative_stop_file_prefix !== 'STOP_AFTER_WAVE-' || registration.stop_behavior !== 'finish all awaited work in the current wave; retain receipts and jobs; never kill the worker') throw Error('parallel_measurement_registration_invalid');
  return registration;
}

export function verifyRegisteredCampaign(arm, { directory = campaignDir(arm), args = process.argv } = {}) {
  const registration = readParallelMeasurementRegistration();
  const frozen = registration.arms[arm];
  if (!frozen || resolve(directory) !== repoPath(campaignDir(arm))) throw Error('parallel_measurement_campaign_directory_mismatch');
  const campaignBytes = readFileSync(`${directory}/campaign.json`), profileBytes = readFileSync(`${directory}/verification-profile.json`);
  if (sha256(campaignBytes) !== frozen.campaign_sha256 || sha256(profileBytes) !== frozen.verification_profile_sha256) throw Error('parallel_measurement_frozen_input_hash_mismatch');
  const campaign = JSON.parse(campaignBytes), profile = JSON.parse(profileBytes);
  const ids = campaign.jobs?.map(job => job.id);
  const sorted = Array.isArray(ids) ? [...ids].sort() : [];
  if (campaign.id !== frozen.campaign_id || sorted.length !== frozen.candidate_count || new Set(sorted).size !== sorted.length ||
      sha256(JSON.stringify(sorted)) !== frozen.candidate_ids_sha256_sorted_json || profile.measurement_only !== true ||
      profile.publication_policy !== 'never' || profile.arm !== arm || campaign.measurement_only !== true || campaign.publication_policy !== 'never') throw Error('parallel_measurement_registration_content_mismatch');
  if (arm === 'improved') {
    const infrastructureFiles = [
      ['worker_script_sha256', 'scripts/pipeline/tools/cuetFitFactory.mjs', 'scripts/pipeline/tools/cuetFitFactory.mjs'],
      ['factory_store_sha256', 'scripts/pipeline/lib/factoryStore.mjs', 'scripts/pipeline/lib/factoryStore.mjs'],
      ['measurement_lease_helper_sha256', 'scripts/pipeline/lib/campaignMeasurementLeaseVNext.mjs', 'scripts/pipeline/lib/campaignMeasurementLeaseVNext.mjs']
    ];
    const baselineRoot = 'artifacts/question-factory/cuet-readiness-2026-10-08/baseline-code/';
    for (const [field, rootFile, baselineFile] of infrastructureFiles) {
      if (sha256(readFileSync(rootFile)) !== registration[field] || sha256(readFileSync(baselineRoot + baselineFile)) !== registration[field]) throw Error('parallel_measurement_infrastructure_hash_mismatch');
    }
    for (const required of registration.worker_mode) if (!args.includes(required)) throw Error(`parallel_measurement_flag_required:${required}`);
    if (args.includes('--publish')) throw Error('parallel_measurement_publish_forbidden');
  }
  return { registration, campaign, profile, candidateIds: sorted, campaignSha256: frozen.campaign_sha256, profileSha256: frozen.verification_profile_sha256 };
}

function windowsCommandLine(pid) {
  // The command line is held only in memory and is never returned in errors or logs.
  const script = `$p=Get-CimInstance -ClassName Win32_Process -Filter \"ProcessId = ${pid}\"; if($p){$p.CommandLine}`;
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 5000 }).trim();
}

export function verifiedBaselineGlobalWorkerProof(ledger, { getCommandLine = windowsCommandLine, isPidAlive = pid => {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
} } = {}) {
  const registered = verifyRegisteredCampaign('baseline', { args: [] });
  const global = ledger.db.prepare('SELECT owner,expires FROM factory_worker WHERE id=1').get();
  if (!global?.owner) return null;
  const pid = Number(global.owner.split(':')[0]);
  if (!Number.isSafeInteger(pid) || !isPidAlive(pid)) return null;
  let command;
  try { command = getCommandLine(pid); } catch { throw Error('parallel_measurement_legacy_worker_commandline_unavailable'); }
  const normalized = String(command).replaceAll('\\', '/').toLowerCase();
  const validNode = /^"[a-z]:\/program files\/nodejs\/node\.exe"/.test(normalized);
  const validRunner = normalized.includes('/artifacts/question-factory/cuet-readiness-2026-10-08/baseline-code/scripts/pipeline/tools/cuetfitfactory.mjs');
  const validArgs = normalized.includes('worker') && normalized.includes(registered.campaign.id) && normalized.includes('--realtime-all') &&
    normalized.includes('--staging') && normalized.includes('--measurement-only') && !normalized.includes('--parallel-measurement') && !normalized.includes('--publish');
  if (!validNode || !validRunner || !validArgs) throw Error('parallel_measurement_legacy_worker_identity_unverified');
  const proof = { owner: global.owner, pid, campaignId: registered.campaign.id, candidateIds: registered.candidateIds, campaignSha256: registered.campaignSha256, commandVerified: true };
  return { proof, verify(candidate, current) {
    return current.owner === proof.owner && candidate.owner === proof.owner && candidate.pid === proof.pid && candidate.commandVerified === true &&
      candidate.campaignId === proof.campaignId && candidate.campaignSha256 === proof.campaignSha256 &&
      JSON.stringify(candidate.candidateIds) === JSON.stringify(proof.candidateIds);
  } };
}

export function parallelMeasurementLeaseProfile(profile, registration) {
  return { ...profile, registration_format: registration.format, arm: 'improved', campaign_sha256: registration.arms.improved.campaign_sha256,
    profile_sha256: registration.arms.improved.verification_profile_sha256, worker_mode: registration.worker_mode,
    max_waves: registration.maximum_wave_iterations };
}

export function parallelMeasurementCampaignDirectory() { return campaignDir('improved'); }
