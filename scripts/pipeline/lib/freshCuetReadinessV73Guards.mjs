// Pure safety checks for the prospective v7.3 measurement runner.
export const FRESH_V73_PROVIDERS = Object.freeze(['openai', 'gemini', 'anthropic']);
export const REGRESSION_V73_PROVIDERS = Object.freeze(['openai', 'gemini']);
export function providersForEvidenceRoleV73(classification) {
  if (classification === 'fresh') return FRESH_V73_PROVIDERS;
  if (classification === 'regression') return REGRESSION_V73_PROVIDERS;
  throw new Error('registered_evidence_classification_required');
}
export function haikuRoleForEvidenceV73(classification) {
  providersForEvidenceRoleV73(classification);
  return classification === 'fresh'
    ? 'Fresh blinded key and CUET-fit comparison only; never substituted into publication topology.'
    : 'Not evaluated on regression cases; Luna and Gemini retain every publication-validation stage.';
}
export const FRESH_V73_PROVENANCE_NOTICE = 'Fresh benchmark cases are original or adapted practice derived from their cited sources; source papers are not authenticated CUET PYQs.';

// Reporting owns only the supplied read-only database handle. It must never
// construct BudgetLedger, whose startup can reconcile reservations.
export function reportLedgerV73(db) {
  if (!db || typeof db.prepare !== 'function' || typeof db.close !== 'function') throw new Error('read_only_report_database_required');
  return { db, close() { db.close(); } };
}

export function assertReleaseEvidenceRoleV73(evidence) {
  if (!evidence?.preregistration_id) throw new Error('preregistered_evidence_role_required');
  if (evidence.classification === 'fresh' && evidence.scope === 'full_cuet_release' &&
      evidence.approved_before_evaluation === true && evidence.previously_read === false && evidence.tuned_on === false) return true;
  // Regression evidence may have been read or tuned. Preserve those diagnostic fields as registered.
  if (evidence.classification === 'regression' && evidence.scope === 'regression') return true;
  throw new Error('preregistered_evidence_role_required');
}

export function assertBenchmarkProvenanceV73(fixtures, classification) {
  if (!Array.isArray(fixtures) || !['fresh', 'regression'].includes(classification)) throw new Error('benchmark_provenance_role_invalid');
  for (const fixture of fixtures) {
    const kind = fixture?.candidate?.provenance?.kind;
    if (classification === 'fresh' && !['original_practice', 'pyq_adapted'].includes(kind)) {
      throw new Error('fresh_practice_cannot_claim_authentic_pyq');
    }
    if (classification === 'regression' && !['original_practice', 'pyq_adapted', 'authentic_pyq'].includes(kind)) {
      throw new Error('regression_provenance_kind_invalid');
    }
  }
  return true;
}

export function assertCustodySetV73({ fixtureIds, positiveIds, custody }) {
  const unique = xs => Array.isArray(xs) && new Set(xs).size === xs.length;
  if (!unique(fixtureIds) || !unique(positiveIds) || !unique(custody?.positive_ids)) throw new Error('custody_ids_must_be_unique');
  const expected = new Set(positiveIds);
  if (expected.size !== positiveIds.length || custody?.complete !== true || custody?.problems?.length ||
      custody.positive_ids.length !== expected.size || custody.positive_ids.some(id => !expected.has(id))) {
    throw new Error('complete_independent_source_key_custody_required');
  }
  return true;
}

export function reservePendingCostV73({ committedMicro, pendingMicro, maximumMicro, capUsd, assertBudget }) {
  if (typeof assertBudget !== 'function') throw new Error('campaign_budget_guard_required');
  assertBudget(committedMicro + pendingMicro, maximumMicro, capUsd);
  return pendingMicro + maximumMicro;
}

export function inspectBlindCaptureV73({ fixtureId, provider, phase, raw, body, inputLimitTokens }) {
  const expectedPhase = provider === 'openai' ? 'blind_solution' : provider === 'gemini' ? 'independent_evaluation' : provider === 'anthropic' ? 'independent_evaluation' : null;
  if (!expectedPhase || phase !== expectedPhase) throw new Error('blinded_preflight_phase_mismatch');
  if (typeof raw !== 'string' || !body || !Number.isSafeInteger(inputLimitTokens) || inputLimitTokens <= 0) throw new Error('blinded_preflight_capture_invalid');
  if (/["']?(?:correct_answer|oracle|proposed_explanation|final_key_source_id)["']?\s*[:=]/i.test(raw) || raw.includes('FRESH_BLIND_KEY_CANARY')) throw new Error('validator_answer_leak');
  if (!raw.includes(fixtureId)) throw new Error('blinded_preflight_candidate_identity_missing');
  const bytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
  // UTF-8 bytes conservatively bound text-only provider input without claiming a token measurement.
  if (bytes > inputLimitTokens) throw new Error('input_request_size_bound_exceeded');
  return { fixture_id: fixtureId, provider, phase, bytes, provider_input_limit_tokens: inputLimitTokens, request_size_bound: 'utf8_bytes_at_most_input_token_limit', key_canary_absent: true };
}

export function evaluationResumeActionV73(record, acceptedNativeRequest, allowGuardRetry = false) {
  if (!record) return acceptedNativeRequest ? 'stop_accepted_request_without_result' : 'dispatch_new_key';
  if (record.status === 'judged') return 'reuse_saved_judgment';
  if (record.status === 'error') return 'keep_terminal_error';
  if (record.status === 'guard_blocked') return acceptedNativeRequest ? 'promote_to_terminal_error' : allowGuardRetry ? 'retry_same_key' : 'keep_terminal_error';
  return 'stop_unknown_saved_state';
}

export function evaluationFailureStatusV73(error, acceptedNativeRequest) {
  if (acceptedNativeRequest || error?.dispatchState === 'accepted') return 'error';
  return error?.dispatchState === 'guard_blocked' ? 'guard_blocked' : 'error';
}

export function retainedAcceptedEvaluationV73(prior, action) {
  if (!['promote_to_terminal_error', 'stop_accepted_request_without_result'].includes(action)) return null;
  return { ...prior, status: 'error', error: 'accepted_provider_request_exists_no_resubmit' };
}

// A saved terminal dual-blind verdict is immutable. This path can only finish
// Haiku's comparison record; it never recomputes Luna/Gemini or the topology.
export async function resumeTerminalFixtureHaikuV73({ verdict, evaluations, acceptedNativeRequest, evaluateProvider, validateTopology, save = () => {} }) {
  if (!['eligible', 'quarantined'].includes(verdict?.state)) return { handled: false };
  const prior = evaluations?.anthropic;
  const accepted = Boolean(prior?.native_key && acceptedNativeRequest(prior.native_key));
  const action = evaluationResumeActionV73(prior, accepted, true);
  if (action === 'promote_to_terminal_error') {
    evaluations.anthropic = { ...prior, status: 'error', error: 'accepted_provider_request_exists_no_resubmit' };
    save();
    return { handled: true, verdict, comparison: 'accepted_request_held' };
  }
  if (action === 'stop_unknown_saved_state') {
    evaluations.anthropic = { status: 'error', error: 'unknown_saved_evaluation_state_requires_manual_reconciliation' };
    save();
    return { handled: true, verdict, comparison: 'unknown_state_held' };
  }
  if (action === 'dispatch_new_key' || action === 'retry_same_key') {
    try {
      evaluations.anthropic = { status: 'judged', ...await evaluateProvider('anthropic') };
    } catch (error) {
      const isAccepted = error?.nativeKey && acceptedNativeRequest(error.nativeKey);
      evaluations.anthropic = { status: evaluationFailureStatusV73(error, isAccepted), error: error.message,
        ...(error.nativeKey ? { native_key: error.nativeKey } : {}) };
    }
    save();
    return { handled: true, verdict, comparison: 'haiku_attempted' };
  }
  // Deliberately leave validateTopology unused: a terminal verdict is already saved.
  void validateTopology;
  return { handled: true, verdict, comparison: action };
}

export function assertExecutionPlanV73(plan, { id, binding, inputHashes, registryHash, denominator, validRoots, controlledDefects, classification = 'fresh' }) {
  if (plan?.id !== id || plan.publication !== 'never' || plan.maximum_content_repairs !== 0 || plan.regeneration !== false ||
      plan.cap_usd !== 4 || plan.topology !== 'dual_blind' || plan.denominator !== denominator || plan.valid_roots !== validRoots ||
      plan.controlled_defects !== controlledDefects || JSON.stringify(plan.contract_binding) !== JSON.stringify(binding) ||
      JSON.stringify(plan.input_hashes) !== JSON.stringify(inputHashes) || plan.source_registry_hash !== registryHash ||
      JSON.stringify(plan.providers) !== JSON.stringify(providersForEvidenceRoleV73(classification))) throw new Error('registered_inputs_or_runner_changed');
  if (plan.haiku_role !== haikuRoleForEvidenceV73(classification)) throw new Error('registered_provider_role_changed');
  return true;
}

export function acceptedNativeRequestV73(db, key) {
  if (!key) return false;
  const realtime=db.prepare('SELECT state FROM provider_requests WHERE id=?').get(key);
  if(realtime)return !['credit_refused','flex_unavailable','complete'].includes(realtime.state);
  const batch=db.prepare('SELECT state FROM provider_batches WHERE id=?').get(key);
  return Boolean(batch&&!['complete'].includes(batch.state));
}

export function providerOutcomeSummaryV73({ fixtureIds, positiveIds, evaluations, providers = FRESH_V73_PROVIDERS }) {
  const providerOutcomes = {};
  for (const provider of providers) {
    const statuses = fixtureIds.map(id => evaluations?.[id]?.[provider]?.status || 'missing');
    const counts = Object.fromEntries(['judged', 'error', 'guard_blocked', 'missing', 'other'].map(status => [status, statuses.filter(s => s === status).length]));
    counts.other = statuses.filter(s => !['judged', 'error', 'guard_blocked', 'missing'].includes(s)).length;
    const positiveStatuses = positiveIds.map(id => evaluations?.[id]?.[provider]?.status || 'missing');
    providerOutcomes[provider] = {
      denominator: fixtureIds.length,
      counts,
      complete: statuses.length === fixtureIds.length && statuses.every(s => s === 'judged'),
      positive_denominator: positiveIds.length,
      positive_judged: positiveStatuses.filter(s => s === 'judged').length,
      positive_comparison_complete: positiveStatuses.length === positiveIds.length && positiveStatuses.every(s => s === 'judged')
    };
  }
  return providerOutcomes;
}

export function validatePreflightManifestV73({ manifest, fixtureIds, providers = FRESH_V73_PROVIDERS, limits }) {
  if (!Array.isArray(manifest) || manifest.length !== fixtureIds.length * providers.length) throw new Error('offline_preflight_capture_matrix_incomplete');
  const expected = new Set(fixtureIds.flatMap(fixture_id => providers.map(provider => `${fixture_id}\0${provider}`)));
  for (const capture of manifest) {
    const key = `${capture.fixture_id}\0${capture.provider}`;
    if (!expected.delete(key)) throw new Error('offline_preflight_capture_matrix_duplicate_or_extra');
    const phase = capture.provider === 'openai' ? 'blind_solution' : 'independent_evaluation';
    if (capture.phase !== phase || capture.key_canary_absent !== true || !Number.isSafeInteger(capture.bytes) || capture.bytes <= 0 ||
        capture.provider_input_limit_tokens !== limits[capture.provider] || capture.bytes > limits[capture.provider] ||
        capture.request_size_bound !== 'utf8_bytes_at_most_input_token_limit') throw new Error('offline_preflight_capture_contract_invalid');
  }
  if (expected.size) throw new Error('offline_preflight_capture_matrix_incomplete');
  return true;
}
