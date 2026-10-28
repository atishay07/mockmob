import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { C_POLL_POLICY, cPollDelay, cProgressSummary, runCContinuation } from './candidateCSupervisor.mjs';

export const PROGRESS_AWARE_C_POLICY_VERSION = 'candidate-c-progress-aware-backoff-v1';
const ACTIVE_C_CAMPAIGN_ID = 'cuet-readiness-cost-source-c-100-2026-10-08';
const ACTIVE_C_CAMPAIGN_DIR = `cuet-readiness-cost-source-c-100-2026-10-08`;

function assertFutureCampaign({ campaignId, campaignDir }) {
  if (campaignId === ACTIVE_C_CAMPAIGN_ID || String(campaignDir || '').replaceAll('\\', '/').split('/').includes(ACTIVE_C_CAMPAIGN_DIR)) {
    throw Error('progress_aware_supervisor_future_campaigns_only');
  }
}

function readPolicyState(path, campaignId) {
  if (!path || !existsSync(path)) return { campaign_id: campaignId, policy_version: PROGRESS_AWARE_C_POLICY_VERSION,
    unchanged_intervals: 0, progress_resets: 0, last_snapshot: null, last_progress_reason: null, next_delay_ms: null };
  let state;
  try { state = JSON.parse(readFileSync(path, 'utf8')); } catch { throw Error('progress_aware_policy_state_unreadable'); }
  if (state.campaign_id !== campaignId || state.policy_version !== PROGRESS_AWARE_C_POLICY_VERSION) throw Error('progress_aware_policy_state_identity_mismatch');
  return { unchanged_intervals: 0, progress_resets: 0, last_snapshot: null, last_progress_reason: null, next_delay_ms: null, ...state };
}

function persistPolicyState(path, state) {
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, path);
}

function snapshot(report) {
  const summary = cProgressSummary(report);
  const blocked = report?.publication_accounting?.blocked_requests;
  return { terminal: summary.terminal, pending_provider_requests: summary.pending_provider_requests,
    provider_processing_complete: summary.provider_processing_complete,
    blocked_request_ids: Array.isArray(blocked) ? [...new Set(blocked.filter(id => typeof id === 'string'))].sort() : null };
}

function progressReason(previous, current) {
  if (!previous) return null;
  if (current.terminal > previous.terminal) return 'terminal_count_increased';
  if (previous.provider_processing_complete !== true && current.provider_processing_complete === true) return 'provider_processing_completed';
  if (previous.blocked_request_ids && current.blocked_request_ids &&
      previous.blocked_request_ids.some(id => !current.blocked_request_ids.includes(id))) return 'accepted_provider_request_completed';
  if (Number.isFinite(previous.pending_provider_requests) && Number.isFinite(current.pending_provider_requests) &&
      current.pending_provider_requests < previous.pending_provider_requests) return 'accepted_provider_request_completed';
  return null;
}

/**
 * Future-campaign wrapper for the frozen supervisor. It keeps launch/identity/drain
 * behavior intact while basing the delay exponent on unchanged intervals since
 * the last observed terminal progress or accepted-provider completion.
 * `policyStatePath` is optional and, when supplied, must be outside campaignDir.
 */
export async function runProgressAwareCContinuation(options) {
  const { campaignId, campaignDir, readReport, sleep, policy = C_POLL_POLICY, policyStatePath } = options || {};
  assertFutureCampaign({ campaignId, campaignDir });
  if (typeof readReport !== 'function' || typeof sleep !== 'function') throw Error('progress_aware_supervisor_io_required');
  if (policyStatePath) {
    const sidecar = resolve(policyStatePath), campaign = resolve(campaignDir || '.');
    const inside = relative(campaign, sidecar);
    const outsideCampaign = inside === '..' || inside.startsWith(`..${sep}`);
    if (!isAbsolute(policyStatePath) || !outsideCampaign) {
      throw Error('progress_aware_policy_state_must_be_outside_campaign_dir');
    }
  }
  const state = readPolicyState(policyStatePath, campaignId);
  let previous = state.last_snapshot;
  let progressSinceSleep = false;

  const wrappedReadReport = async () => {
    const report = await readReport();
    const current = snapshot(report);
    const reason = progressReason(previous, current);
    if (reason) {
      state.unchanged_intervals = 0;
      state.progress_resets++;
      state.last_progress_reason = reason;
      progressSinceSleep = true;
    }
    state.last_snapshot = current;
    previous = current;
    persistPolicyState(policyStatePath, state);
    return report;
  };

  const wrappedSleep = async () => {
    if (progressSinceSleep) state.unchanged_intervals = 0;
    else state.unchanged_intervals++;
    progressSinceSleep = false;
    const exponent = Math.max(0, state.unchanged_intervals - 1 + (state.progress_resets > 0 ? 1 : 0));
    state.next_delay_ms = cPollDelay(exponent, policy);
    persistPolicyState(policyStatePath, state);
    await sleep(state.next_delay_ms);
  };

  const result = await runCContinuation({ ...options, readReport: wrappedReadReport, sleep: wrappedSleep });
  const progressPolicy = { version: PROGRESS_AWARE_C_POLICY_VERSION, unchanged_intervals: state.unchanged_intervals,
    progress_resets: state.progress_resets, last_progress_reason: state.last_progress_reason, next_delay_ms: state.next_delay_ms };
  persistPolicyState(policyStatePath, { ...state, campaign_id: campaignId, policy_version: PROGRESS_AWARE_C_POLICY_VERSION });
  return { ...result, progress_policy: progressPolicy };
}

