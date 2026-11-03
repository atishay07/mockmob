import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createFactoryTransport, FACTORY_MODELS } from './factoryTransport.mjs';
import { assertCampaignBudget, campaignCommittedMicro, maximumRequestMicro, requestNeedsReservation } from './campaignExecutionV7.mjs';

export const C_TRANSPORT_PROFILE_VNEXT = Object.freeze({
  policy_name: 'cuet-c-luna-realtime-flex-gemini-native-batch-wave10-v1',
  waves: 10,
  providers: Object.freeze({
    openai: Object.freeze({ model: FACTORY_MODELS.openai, mode: 'realtime', flex: 'preferred_with_standard_fallback' }),
    gemini: Object.freeze({ model: FACTORY_MODELS.gemini, mode: 'native_batch' })
  }),
  luna_flex_stages: Object.freeze(['authoring', 'blind_solution', 'independent_evaluation', 'explanation_support', 'repair']),
  tools: 'disabled'
});
const canonicalProfile = JSON.stringify(C_TRANSPORT_PROFILE_VNEXT);
export const C_TRANSPORT_PROFILE_VNEXT_HASH = createHash('sha256').update(canonicalProfile).digest('hex');

function storedMode(ledger, key) {
  const batch = ledger.db.prepare('SELECT provider,request_json FROM provider_batches WHERE id=?').get(key);
  if (batch) {
    const saved = JSON.parse(batch.request_json);
    const mode = saved.config?.execution_mode || 'batch';
    if (saved.config?.provider !== batch.provider || mode !== 'batch') throw new Error('saved_request_mode_mismatch');
    const state = ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(key).state;
    return { provider: batch.provider, mode, batch: true, saved, state };
  }
  const realtime = ledger.db.prepare('SELECT provider,request_json,state FROM provider_requests WHERE id=?').get(key);
  if (realtime) {
    const saved = JSON.parse(realtime.request_json);
    const mode = saved.config?.execution_mode || 'realtime';
    if (saved.config?.provider !== realtime.provider || mode !== 'realtime') throw new Error('saved_request_mode_mismatch');
    return { provider: realtime.provider, mode, batch: false, saved, state: realtime.state };
  }
  return null;
}

function replayBody(body, saved, provider, state) {
  if (JSON.stringify(body) === JSON.stringify(saved.body)) return saved.body;
  // factoryTransport adds service_tier=flex to a Luna request at dispatch.
  // Permit precisely this transport-owned field during replay; every authored
  // body byte and property otherwise remains bound to the saved request.
  if (provider === 'openai' && body?.service_tier === undefined && saved.body?.service_tier === 'flex') {
    const withoutTier = structuredClone(saved.body);
    delete withoutTier.service_tier;
    if (JSON.stringify(body) === JSON.stringify(withoutTier)) return state === 'flex_unavailable' ? withoutTier : saved.body;
  }
  throw new Error('saved_request_content_mismatch');
}

/**
 * Isolated draft wrapper for prospective C only. It owns two stateless
 * factoryTransport views over the same durable ledger: Luna realtime/flex and
 * Gemini native batch. The worker must hold its normal single-writer lease.
 */
export function createCandidateTransportProfileVNext({
  ledger,
  profileName,
  profileHash,
  candidateIds,
  phaseCapUsd,
  fetchImpl = fetch,
  prices,
  env = process.env,
  geminiModel = FACTORY_MODELS.gemini,
  now = Date.now
}) {
  if (profileName !== C_TRANSPORT_PROFILE_VNEXT.policy_name || profileHash !== C_TRANSPORT_PROFILE_VNEXT_HASH) {
    throw new Error('transport_profile_identity_mismatch');
  }
  if (!ledger || typeof ledger.reserve !== 'function' || !Array.isArray(candidateIds) || candidateIds.length === 0 ||
      new Set(candidateIds).size !== candidateIds.length || !Number.isFinite(phaseCapUsd) || phaseCapUsd <= 0) {
    throw new Error('transport_profile_campaign_scope_required');
  }
  if (geminiModel !== FACTORY_MODELS.gemini) throw new Error('transport_profile_gemini_model_mismatch');
  const priceSource = prices || (() => JSON.parse(readFileSync(resolve('data/pipeline-prices.json'), 'utf8')));
  const scopedCandidates = new Set(candidateIds);
  const priceContext = new AsyncLocalStorage();
  const dispatchPrices = () => priceContext.getStore() || priceSource();
  const common = { ledger, fetchImpl, prices: dispatchPrices, env, geminiModel, now };
  const lunaRealtime = createFactoryTransport({
    ...common,
    queueOpenAI: false,
    queueGemini: false,
    realtimeStages: [],
    flexStages: [...C_TRANSPORT_PROFILE_VNEXT.luna_flex_stages]
  });
  const geminiBatch = createFactoryTransport({
    ...common,
    queueOpenAI: false,
    queueGemini: true,
    realtimeStages: [],
    flexStages: []
  });

  function expectedMode(provider) {
    if (provider === 'openai') return 'realtime';
    if (provider === 'gemini') return 'batch';
    throw new Error('transport_profile_provider_unsupported');
  }

  function selectedTransport(provider, isBatch) {
    if (provider === 'openai') return lunaRealtime;
    if (provider === 'gemini') return geminiBatch;
    throw new Error('transport_profile_provider_unsupported');
  }

  function candidateKey(provider, body, options) {
    const id = options.candidate_id || options.candidateId || bodyCandidateId(provider, body);
    if (typeof id !== 'string' || !id || !scopedCandidates.has(id)) throw new Error('transport_profile_candidate_outside_campaign');
    return id;
  }

  function bodyCandidateId(provider, body) {
    const text = provider === 'openai'
      ? body?.input?.find(row => row?.role === 'user')?.content
      : body?.contents?.[0]?.parts?.[0]?.text;
    try {
      const parsed = JSON.parse(text || '{}');
      return parsed.candidate_id || parsed.job_id || parsed.candidate?.id || null;
    } catch { return null; }
  }

  function assertModeRequest(options, selectedMode, isSaved) {
    if (isSaved) return;
    if (options.noFlex === true && selectedMode === 'realtime' && options.provider === 'openai') {
      throw new Error('transport_profile_flex_policy_mismatch');
    }
    const explicitlyRequested = options.mode || options.execution_mode ||
      (typeof options.batch === 'boolean' ? (options.batch ? 'batch' : 'realtime') : null);
    const normalized = explicitlyRequested === 'native_batch' ? 'batch' : explicitlyRequested;
    if (normalized && normalized !== selectedMode) throw new Error('transport_profile_mode_mismatch');
  }

  async function generate(provider, body, options = {}) {
    if (!['openai', 'gemini'].includes(provider)) throw new Error('transport_profile_provider_unsupported');
    if ((body?.tools || []).length || (options.toolCalls || 0) !== 0) throw new Error('transport_profile_tools_disabled');
    const id = candidateKey(provider, body, options);
    const embeddedId = bodyCandidateId(provider, body);
    if (embeddedId && embeddedId !== id) throw new Error('transport_profile_candidate_body_mismatch');
    const key = options.key;
    if (!key) throw new Error('transport_profile_idempotency_key_required');
    const saved = storedMode(ledger, key);
    if (saved && saved.provider !== provider) throw new Error('saved_request_provider_mismatch');
    if (!saved && ledger.getCache(`response:${key}`)) throw new Error('saved_request_contract_missing');
    const dispatchBody = saved ? replayBody(body, saved.saved, provider, saved.state) : body;
    const selectedMode = saved?.mode || expectedMode(provider);
    assertModeRequest({ ...options, provider }, selectedMode, Boolean(saved));
    const isBatch = saved ? saved.batch : selectedMode === 'batch';

    if (requestNeedsReservation(ledger, key)) {
      const currentPrices = priceSource();
      const maximum = maximumRequestMicro(provider, dispatchBody, currentPrices, { batch: isBatch });
      const committed = campaignCommittedMicro(ledger, candidateIds);
      assertCampaignBudget(committed, maximum, phaseCapUsd);
      // generate() persists its reservation before its first network await. Thus
      // the next concurrent call sees the exact maximum in the durable ledger.
      const call = priceContext.run(currentPrices, () => selectedTransport(provider, isBatch).generate(provider, dispatchBody, {
          ...options,
          ...(saved?.state === 'flex_unavailable' ? { noFlex: true } : {}),
          candidate_id: id,
          batch: isBatch
        }));
      return await call;
    }
    // Saved complete/rejected/submitted requests are delegated without a new
    // cap reservation. factoryTransport validates the original body/model,
    // pricing snapshot and exact saved reservation before replaying a receipt.
    return selectedTransport(provider, isBatch).generate(provider, dispatchBody, {
      ...options,
      ...(saved?.state === 'flex_unavailable' ? { noFlex: true } : {}),
      candidate_id: id,
      batch: isBatch
    });
  }

  async function flush() {
    const legacyOpenAiQueued = ledger.db.prepare("SELECT COUNT(*) AS n FROM provider_batches WHERE provider='openai' AND state='queued'").get().n;
    if (legacyOpenAiQueued) throw new Error('queued_openai_batch_requires_original_profile_recovery');
    const queued = ledger.db.prepare("SELECT id,request_json FROM provider_batches WHERE provider='gemini' AND state='queued' ORDER BY id").all();
    if (queued.length > C_TRANSPORT_PROFILE_VNEXT.waves) throw new Error('transport_profile_wave_size_exceeded');
    for (const row of queued) {
      const saved = JSON.parse(row.request_json);
      if (saved.config?.provider !== 'gemini' || (saved.config.execution_mode || 'batch') !== 'batch') {
        throw new Error('queued_gemini_mode_mismatch');
      }
      if (!scopedCandidates.has(saved.config.candidate_id)) throw new Error('queued_gemini_candidate_outside_profile');
    }
    return geminiBatch.flush();
  }

  async function reconcile(key) {
    const saved = storedMode(ledger, key);
    if (!saved) return null;
    return selectedTransport(saved.provider, saved.batch).reconcile(key);
  }

  async function attachAcceptedBatch(key, providerId) {
    const saved = storedMode(ledger, key);
    if (!saved || !saved.batch) throw new Error('saved_batch_request_required');
    return selectedTransport(saved.provider, saved.batch).attachAcceptedBatch(key, providerId);
  }

  return Object.freeze({
    generate,
    flush,
    reconcile,
    attachAcceptedBatch,
    profile: Object.freeze({ name: C_TRANSPORT_PROFILE_VNEXT.policy_name, hash: C_TRANSPORT_PROFILE_VNEXT_HASH, phase_cap_usd: phaseCapUsd })
  });
}
