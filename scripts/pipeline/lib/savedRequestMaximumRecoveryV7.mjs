import { createHash } from 'node:crypto';

const HOSTS = Object.freeze({
  openai: 'api.openai.com',
  gemini: 'generativelanguage.googleapis.com',
  anthropic: 'api.anthropic.com'
});
const MODELS = Object.freeze({
  openai: new Set(['gpt-6-luna']),
  gemini: new Set(['gemini-3.8-flash']),
  anthropic: new Set(['claude-haiku-5-5'])
});
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');

function outputBound(provider, body) {
  if (provider === 'openai') return body?.max_output_tokens;
  if (provider === 'gemini') return body?.generationConfig?.maxOutputTokens;
  if (provider === 'anthropic') return body?.max_tokens;
  return null;
}

/**
 * Derive a conservative spending proof from the exact persisted request before
 * dispatch. This intentionally never treats a missing usage receipt as zero.
 */
export function buildSavedRequestMaximumProof({
  request,
  native,
  nativeTable,
  expectedOwnerPid,
  isPidAlive = pid => {
    try { process.kill(pid, 0); return true; }
    catch (error) { if (error.code === 'EPERM') return true; if (error.code === 'ESRCH') return false; throw error; }
  }
}) {
  if (!request || !native || !['provider_requests', 'provider_batches'].includes(nativeTable)) throw new Error('saved_request_pair_required');
  if (!Number.isSafeInteger(expectedOwnerPid) || expectedOwnerPid <= 0 || request.owner_pid !== expectedOwnerPid || isPidAlive(expectedOwnerPid)) {
    throw new Error('saved_request_owner_not_proven_dead');
  }
  if (!['reserved', 'unresolved'].includes(request.state) || !Number.isSafeInteger(request.reserved) || request.reserved <= 0 ||
      request.actual !== null && request.actual > request.reserved) throw new Error('saved_request_not_held');
  if (native.reservation_id !== request.id || native.response_json !== null || !['dispatching', 'unresolved'].includes(native.state)) {
    throw new Error('saved_request_receipt_or_state_mismatch');
  }

  let saved;
  try { saved = JSON.parse(native.request_json); } catch { throw new Error('saved_request_json_invalid'); }
  const { body, config } = saved || {};
  const provider = native.provider;
  if (!body || !config || config.provider !== provider || config.key !== native.id || config.model !== request.model ||
      !MODELS[provider]?.has(config.model) || !HOSTS[provider] || !config.pricing?.source_url ||
      config.pricing.models?.[config.model]?.provider_host !== HOSTS[provider] || config.reserved !== request.reserved ||
      config.execution_mode !== (nativeTable === 'provider_batches' ? 'batch' : 'realtime')) {
    throw new Error('saved_request_identity_or_config_mismatch');
  }
  if (body.stream || body.background || body.previous_response_id || body.conversation || body.file || body.cachedContent ||
      (Array.isArray(body.tools) && body.tools.length) || !Number.isSafeInteger(config.toolCalls) || config.toolCalls !== 0) {
    throw new Error('saved_request_not_bounded_text_only');
  }

  const price = config.pricing.models[config.model];
  const rates = nativeTable === 'provider_batches' ? price.batch : price;
  const inputBound = price.max_input_tokens;
  const outputLimit = outputBound(provider, body);
  if (!Number.isSafeInteger(inputBound) || inputBound <= 0 || !Number.isSafeInteger(outputLimit) || outputLimit <= 0 ||
      bytes(body) > inputBound || !rates || config.rates?.input_per_million !== rates.input_per_million ||
      config.rates?.output_per_million !== rates.output_per_million ||
      (rates.cache_write_per_million ?? null) !== (config.rates.cache_write_per_million ?? null) ||
      ![rates.input_per_million, rates.output_per_million, rates.cache_write_per_million ?? 0].every(n => Number.isFinite(n) && n >= 0)) {
    throw new Error('saved_request_bound_rates_unproven');
  }
  const toolRate = config.pricing.web_search_per_call_usd ?? 0;
  if (!Number.isFinite(toolRate) || toolRate < 0) throw new Error('saved_request_tool_rate_unproven');
  const inputRate = Math.max(rates.input_per_million, rates.cache_write_per_million ?? 0);
  const maximum = Math.ceil(inputBound * inputRate + outputLimit * rates.output_per_million + config.toolCalls * toolRate * 1e6);
  if (maximum !== request.reserved) throw new Error('saved_request_maximum_does_not_match_reservation');

  const providerRequestId = nativeTable === 'provider_batches' && native.provider_id
    ? native.provider_id
    : `unconfirmed-client-key:${config.key}`;
  const proof = {
    model: config.model,
    input_bound: inputBound,
    output_bound: outputLimit,
    input_rate: inputRate,
    output_rate: rates.output_per_million,
    tool_calls: config.toolCalls,
    tool_rate: toolRate,
    pricing_source: config.pricing.source_url,
    contract_hash: digest({ body, config }),
    provider_request_id: providerRequestId,
    basis: 'Reconstructed only from the exact saved native request body, provider configuration, dispatch-time price snapshot and matching reservation. Usage is unknown; the full verified maximum remains held. No settlement or resubmission is implied.'
  };
  return { reservation_id: request.id, maximum_micro: maximum, proof };
}

/** Read and prove all requested records before any persistent change. */
export function planSavedRequestMaximumRecovery(db, { reservationIds, expectedOwnerPid, isPidAlive }) {
  if (!Array.isArray(reservationIds) || !reservationIds.length || new Set(reservationIds).size !== reservationIds.length ||
      !Number.isSafeInteger(expectedOwnerPid) || expectedOwnerPid <= 0) throw new Error('saved_request_recovery_scope_required');
  if (isPidAlive(expectedOwnerPid)) throw new Error('saved_request_owner_not_proven_dead');
  const plans = reservationIds.map(id => {
    const request = db.prepare('SELECT id,model,reserved,actual,state,owner_pid FROM requests WHERE id=?').get(id);
    if (!request) throw new Error('saved_request_reservation_missing');
    const rows = [
      ...db.prepare('SELECT id,reservation_id,provider,state,request_json,response_json,provider_id,\'provider_batches\' AS native_table FROM provider_batches WHERE reservation_id=?').all(id),
      ...db.prepare('SELECT id,reservation_id,provider,state,request_json,response_json,NULL AS provider_id,\'provider_requests\' AS native_table FROM provider_requests WHERE reservation_id=?').all(id)
    ];
    if (rows.length !== 1) throw new Error('saved_request_native_row_not_unique');
    const native = rows[0], nativeTable = native.native_table;
    if (db.prepare('SELECT 1 AS present FROM conservative_holds WHERE reservation_id=?').get(id)) throw new Error('saved_request_hold_already_exists');
    return { ...buildSavedRequestMaximumProof({ request, native, nativeTable, expectedOwnerPid, isPidAlive }), native_table: nativeTable };
  });
  return { expectedOwnerPid, plans };
}

/** Apply a fully validated plan in one transaction. Only new proof rows are written. */
export function applySavedRequestMaximumRecovery(db, plan, { isPidAlive } = {}) {
  if (!plan?.plans?.length || !Number.isSafeInteger(plan.expectedOwnerPid) || isPidAlive?.(plan.expectedOwnerPid)) throw new Error('saved_request_recovery_plan_invalid');
  const beforeHolds = db.prepare('SELECT reservation_id,maximum_micro,proof_json FROM conservative_holds ORDER BY reservation_id').all();
  const ids = plan.plans.map(item => item.reservation_id);
  const beforeRequests = new Map(ids.map(id => [id, db.prepare('SELECT id,model,reserved,actual,state,owner_pid,receipt_json FROM requests WHERE id=?').get(id)]));
  if (new Set(ids).size !== ids.length || ids.some(id => beforeHolds.some(row => row.reservation_id === id))) throw new Error('saved_request_hold_already_exists');
  db.exec('BEGIN IMMEDIATE');
  try {
    if (isPidAlive?.(plan.expectedOwnerPid)) throw new Error('saved_request_owner_not_proven_dead');
    for (const item of plan.plans) {
      const current = db.prepare('SELECT model,reserved,actual,state,owner_pid FROM requests WHERE id=?').get(item.reservation_id);
      if (!current || current.owner_pid !== plan.expectedOwnerPid || !['reserved', 'unresolved'].includes(current.state) ||
          current.reserved !== item.maximum_micro || current.actual !== null && current.actual > current.reserved ||
          db.prepare('SELECT 1 AS present FROM conservative_holds WHERE reservation_id=?').get(item.reservation_id)) {
        throw new Error('saved_request_changed_after_proof');
      }
      const { input_bound, output_bound, input_rate, output_rate, tool_calls, tool_rate } = item.proof;
      const verifiedMaximum = Math.ceil(input_bound * input_rate + output_bound * output_rate + tool_calls * tool_rate * 1e6);
      if (verifiedMaximum !== item.maximum_micro || item.proof.model !== current.model) throw new Error('saved_request_plan_proof_mismatch');
      const nativeRows = [
        ...db.prepare('SELECT id,reservation_id,provider,state,request_json,response_json,provider_id,\'provider_batches\' AS native_table FROM provider_batches WHERE reservation_id=?').all(item.reservation_id),
        ...db.prepare('SELECT id,reservation_id,provider,state,request_json,response_json,NULL AS provider_id,\'provider_requests\' AS native_table FROM provider_requests WHERE reservation_id=?').all(item.reservation_id)
      ];
      if (nativeRows.length !== 1 || nativeRows[0].native_table !== item.native_table) throw new Error('saved_request_native_row_changed_after_proof');
      const recomputed = buildSavedRequestMaximumProof({ request: { ...current, id: item.reservation_id }, native: nativeRows[0],
        nativeTable: nativeRows[0].native_table, expectedOwnerPid: plan.expectedOwnerPid, isPidAlive });
      if (recomputed.maximum_micro !== item.maximum_micro || JSON.stringify(recomputed.proof) !== JSON.stringify(item.proof)) {
        throw new Error('saved_request_native_contract_changed_after_proof');
      }
    }
    for (const item of plan.plans) {
      db.prepare('INSERT INTO conservative_holds(reservation_id,maximum_micro,proof_json) VALUES(?,?,?)')
        .run(item.reservation_id, item.maximum_micro, JSON.stringify(item.proof));
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }

  const afterHolds = db.prepare('SELECT reservation_id,maximum_micro,proof_json FROM conservative_holds ORDER BY reservation_id').all();
  if (afterHolds.length !== beforeHolds.length + plan.plans.length || beforeHolds.some(old => JSON.stringify(afterHolds.find(row => row.reservation_id === old.reservation_id)) !== JSON.stringify(old))) {
    throw new Error('unrelated_conservative_holds_changed');
  }
  for(const id of ids) if(JSON.stringify(db.prepare('SELECT id,model,reserved,actual,state,owner_pid,receipt_json FROM requests WHERE id=?').get(id))!==JSON.stringify(beforeRequests.get(id))) throw new Error('request_row_changed_during_proof_recovery');
  return { recovered: plan.plans.map(({ reservation_id, maximum_micro }) => ({ reservation_id, maximum_micro })),
    preserved_existing_holds: beforeHolds.length, global_limit_micro: db.prepare('SELECT limit_micro FROM budget WHERE id=1').get().limit_micro };
}
