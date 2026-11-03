import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FACTORY_MODELS = Object.freeze({ openai: 'gpt-6-luna', gemini: 'gemini-3.8-flash' });
export const BENCHMARK_GEMINI_MODELS = Object.freeze(['gemini-3.1-flash-lite','gemini-3.5-flash-lite']);
const hosts = { openai: 'api.openai.com', gemini: 'generativelanguage.googleapis.com' };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class BatchPending extends Error { constructor(id,stage) { super('provider_batch_pending'); this.batchId = id;this.stage=stage; } }

// No SDK retries, alternative providers, implicit free tiers or unbounded tools.
export function createFactoryTransport({ ledger, fetchImpl = fetch, prices = () => JSON.parse(readFileSync(resolve('data/pipeline-prices.json'), 'utf8')), env = process.env,geminiModel=FACTORY_MODELS.gemini,queueOpenAI=false,queueGemini=false,realtimeStages=[],now=Date.now }) {
  const terminalBatches=new Map(),outputFiles=new Map();
  if(![FACTORY_MODELS.gemini,...BENCHMARK_GEMINI_MODELS].includes(geminiModel))throw new Error('unapproved_gemini_model');
  function prepare(provider, body, batch, toolCalls = 0) {
    ledger.assertHistoryReconciled();
    if (env.MOCK_AI === 'true') throw new Error('mock_mode_cannot_dispatch');
    const pricing = prices();
    const model = provider==='gemini'?geminiModel:FACTORY_MODELS[provider];
    const price = pricing.models?.[model];
    const rates = batch ? price?.batch : price;
    const output = provider === 'openai' ? body.max_output_tokens : body.generationConfig?.maxOutputTokens;
    if (!model || body.model && body.model !== model || price?.provider_host !== hosts[provider] ||
        !pricing.source_url || !(Date.parse(pricing.expires_at) > Date.now()) ||
        !Number.isSafeInteger(price?.max_input_tokens) || price.max_input_tokens <= 0 ||
        !Number.isSafeInteger(output) || output <= 0 || body.stream ||
        !Number.isFinite(rates?.input_per_million) || rates.input_per_million < 0 ||
        !Number.isFinite(rates?.output_per_million) || rates.output_per_million < 0 ||
        ['cached_input_per_million','cache_write_per_million'].some(k=>rates[k]!==undefined && (!Number.isFinite(rates[k]) || rates[k]<0))) throw new Error('verified_pricing_and_token_limits_required');
    // UTF-8 byte count is a conservative bound for these text-only requests.
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > price.max_input_tokens) throw new Error('input_bound_exceeded');
    const tools = body.tools || [];
    if (tools.some(t => t.type !== 'web_search') || (tools.length && (!Number.isSafeInteger(toolCalls) || toolCalls < 1 || body.max_tool_calls !== toolCalls)) ||
        (batch && tools.length) || body.background || body.previous_response_id || body.conversation || body.file || body.cachedContent) throw new Error('unbounded_provider_request');
    if (tools.length && (!Number.isFinite(pricing.web_search_per_call_usd) || pricing.web_search_per_call_usd < 0)) throw new Error('tool_pricing_required');
    const reserved = Math.ceil(price.max_input_tokens * Math.max(rates.input_per_million,rates.cache_write_per_million || 0) + output * rates.output_per_million + toolCalls * (pricing.web_search_per_call_usd || 0) * 1e6);
    return { provider, model, rates, reserved, pricing, toolCalls, execution_mode:batch?'batch':'realtime' };
  }
  function headers(provider) {
    const key = provider === 'openai' ? env.CUET_FACTORY_OPENAI_KEY || env.OPENAI_API_KEY : env.CUET_FACTORY_GEMINI_KEY || env.GEMINI_API_KEY;
    if (!key) throw new Error(`${provider}_factory_key_required`);
    return provider === 'openai' ? { Authorization: `Bearer ${key}` } : { 'x-goog-api-key': key };
  }
  async function request(provider, path, init = {}) {
    if (!path.startsWith('/') || path.includes('..') || path.includes('://')) throw new Error('invalid_provider_path');
    const response = await fetchImpl(`https://${hosts[provider]}${path}`, { ...init, headers: { ...headers(provider), ...init.headers }, redirect: 'error', signal: AbortSignal.timeout(300000) });
    if (!response.ok) {
      let detail={};try{detail=(await response.json())?.error || {};}catch{ /* Keep an uncertain hold when the provider supplies no structured rejection. */ }
      const error=new Error(`provider_http_${response.status}`);
      const scrub=value=>String(value || '').replace(/sk-[\w-]+|AIza[\w-]+/g,'[redacted]').slice(0,1600);
      error.providerReceipt={http_status:response.status,provider,provider_request_id:response.headers.get('x-request-id'),
        code:scrub(detail.code),type:scrub(detail.type),param:scrub(detail.param),message:scrub(detail.message)};
      // A typed schema/parameter rejection happens before inference. Other errors keep their spending hold.
      // Quota/credit refusals are also refused before any tokens are processed.
      error.rejectedBeforeInference=provider==='openai' && (response.status===400 && detail.type==='invalid_request_error' ||
        response.status===429 && detail.type==='insufficient_quota' && ['credit_balance_exhausted','insufficient_quota'].includes(detail.code));
      throw error;
    }
    return response;
  }
  function settle(reservation, config, payload) {
    const usage = payload?.usage || payload?.usageMetadata;
    const input = usage?.input_tokens ?? usage?.promptTokenCount;
    // Gemini candidates + thoughts, not candidates alone. OpenAI output includes reasoning.
    const output = usage?.output_tokens ?? (Number.isInteger(usage?.candidatesTokenCount) ? usage.candidatesTokenCount + (usage.thoughtsTokenCount || 0) : null);
    const searches = (payload?.output || []).filter(v => v.type === 'web_search_call').length;
    const details=usage?.input_tokens_details || {},cached=details.cached_tokens || 0,writes=details.cache_write_tokens || 0;
    const partsValid=[cached,writes].every(n=>Number.isSafeInteger(n)&&n>=0) && cached+writes<=input;
    let readRate=Number.isFinite(config.rates.cached_input_per_million)?config.rates.cached_input_per_million:config.rates.input_per_million;
    let writeRate=config.rates.cache_write_per_million;
    // Accepted legacy batches keep their IDs and reservations. Fill omitted cache rates only
    // from current verified pricing with exactly matching saved base rates and execution mode.
    if(writes && !Number.isFinite(writeRate) && config.provider==='openai') {
      const verified=prices(),profile=verified.models?.[config.model];
      const mode=config.execution_mode || (config.input_file_id?'batch':'realtime');
      const current=mode==='batch'?profile?.batch:profile;
      if(Date.parse(verified.expires_at)>Date.now() && profile?.provider_host===hosts.openai && verified.source_url &&
        current?.input_per_million===config.rates.input_per_million && current?.output_per_million===config.rates.output_per_million && Number.isFinite(current.cache_write_per_million) && current.cache_write_per_million>=0 && (!Number.isFinite(current.cached_input_per_million) || current.cached_input_per_million>=0)) {
        config.rates={...config.rates,cache_write_per_million:current.cache_write_per_million,cached_input_per_million:current.cached_input_per_million};
        writeRate=current.cache_write_per_million;config.cache_rate_reconciliation={source_url:verified.source_url,verified_at:verified.verified_at};
      }
    }
    readRate=Number.isFinite(config.rates.cached_input_per_million)?config.rates.cached_input_per_million:readRate;
    const valid = Number.isSafeInteger(input) && input >= 0 && Number.isSafeInteger(output) && output >= 0 && searches <= config.toolCalls && partsValid && (!writes || Number.isFinite(writeRate));
    const inputCost=(input-cached-writes)*config.rates.input_per_million+cached*readRate+writes*(writeRate || 0);
    const actual = valid ? Math.ceil(inputCost + output * config.rates.output_per_million + searches * (config.pricing.web_search_per_call_usd || 0) * 1e6) : null;
    ledger.settle(reservation, actual, { provider: config.provider, model: config.model, cache_rate_reconciliation:config.cache_rate_reconciliation || null,execution_mode:config.execution_mode || (config.input_file_id?'batch':'unknown'), usage, searches,stage:config.stage, purpose:config.purpose || 'candidate',candidate_id:config.candidate_id || null,idempotency_key:config.key || null, source_url: config.pricing.source_url, rates: config.rates, provider_request_id: payload?.id || payload?.responseId || null,...config.failure_receipt });
    if (actual === null || actual > config.reserved) throw new Error('provider_usage_unresolved');
  }
  function unresolved(reservation, error) {
    const row = ledger.db.prepare('SELECT state,receipt_json FROM requests WHERE id=?').get(reservation);
    if (row && !['settled', 'unresolved'].includes(row.state)) ledger.settle(reservation, null, { error: error.message,...error.providerReceipt });
    if(row?.state==='unresolved'&&error.providerReceipt?.provider_batch_record){
      const prior=row.receipt_json?JSON.parse(row.receipt_json):null;
      if(!prior?.provider_batch_record||digest(prior.provider_batch_record)!==digest(error.providerReceipt.provider_batch_record))
        ledger.db.prepare('UPDATE requests SET receipt_json=? WHERE id=?').run(JSON.stringify({error:error.message,...error.providerReceipt,prior_failure_receipt:prior}),reservation);
    }
    const saved=ledger.db.prepare('SELECT request_json,provider_id FROM provider_batches WHERE reservation_id=?').get(reservation)
      || ledger.db.prepare('SELECT request_json,NULL AS provider_id FROM provider_requests WHERE reservation_id=?').get(reservation);
    if(saved) {
      const {body,config}=JSON.parse(saved.request_json),price=config.pricing.models[config.model];
      const proof={model:config.model,input_bound:price.max_input_tokens,
        output_bound:config.provider==='openai'?body.max_output_tokens:body.generationConfig.maxOutputTokens,
        input_rate:Math.max(config.rates.input_per_million,config.rates.cache_write_per_million||0),output_rate:config.rates.output_per_million,
        tool_calls:config.toolCalls||0,tool_rate:config.pricing.web_search_per_call_usd||0,pricing_source:config.pricing.source_url,
        contract_hash:digest({body,config}),provider_request_id:error.providerReceipt?.provider_request_id||saved.provider_id||'unconfirmed-client-key:'+config.key,
        basis:'Persisted text-only request, guarded input/output/tool bounds and verified rates at dispatch. Full maximum remains committed; unknown acceptance is never resubmitted and this is not a usage receipt.'};
      try {ledger.retainConservativeHold(reservation,proof);}catch { /* An overrun or invalid bound must remain a global block. */ }
    }
  }
  async function generate(provider, body, { cacheOnly = false, batch = true, key = digest({ provider, model:provider==='gemini'?geminiModel:FACTORY_MODELS[provider], body }), toolCalls = 0, purpose='candidate',stage='unspecified' } = {}) {
    if(provider==='gemini' && geminiModel!==FACTORY_MODELS.gemini && purpose!=='calibration')throw new Error('cheaper_model_requires_calibration_only');
    const existing = ledger.db.prepare('SELECT * FROM provider_batches WHERE id=?').get(key);
    const savedModel=existing?JSON.parse(existing.request_json).config.model:ledger.getCache(`response-model:${key}`);
    if(savedModel && savedModel!==(provider==='gemini'?geminiModel:FACTORY_MODELS[provider]))throw new Error('response_model_mismatch');
    const cached = ledger.getCache(`response:${key}`);
    if (cached) return cached;
    const realtime=ledger.db.prepare('SELECT * FROM provider_requests WHERE id=?').get(key);
    if(realtime){
      if(JSON.parse(realtime.request_json).config.model!==(provider==='gemini'?geminiModel:FACTORY_MODELS[provider]))throw new Error('response_model_mismatch');
      if(realtime.state==='complete')return JSON.parse(realtime.response_json);
      if(realtime.state==='rejected')throw new Error('provider_request_rejected_before_inference');
      throw new Error('provider_request_unresolved_do_not_resubmit');
    }
    if (existing) {
      if (existing.state === 'complete') return JSON.parse(existing.response_json);
      if (existing.state === 'rejected') throw new Error('provider_batch_request_failed_receipt_retained');
      if (['submitted','queued'].includes(existing.state)) throw new BatchPending(key,JSON.parse(existing.request_json).config.stage);
      throw new Error('batch_submission_unresolved');
    }
    if(cacheOnly)throw new Error('calibration_cache_miss');
    if(realtimeStages.includes(stage))batch=false;
    const config = prepare(provider, body, batch, toolCalls);
    config.purpose=purpose;
    config.stage=stage;
    config.key=key;
    let input={};try{input=JSON.parse(provider==='openai'?body.input?.find(row=>row.role==='user')?.content || '{}':body.contents?.[0]?.parts?.[0]?.text || '{}');}catch{ /* Optional accounting metadata; raw probe prompts are allowed. */ }
    config.candidate_id=input.candidate_id || input.job_id || input.candidate?.id || null;
    headers(provider); // Missing credentials cannot consume a reservation.
    const reservation = ledger.reserve(config.model, config.reserved);
    if (!batch) {
      ledger.db.prepare("INSERT INTO provider_requests VALUES(?,?,?,'dispatching',?,NULL)").run(key,reservation,provider,JSON.stringify({body,config}));
      try {
        const endpoint = provider === 'openai' ? '/v1/responses' : `/v1beta/models/${config.model}:generateContent`;
        const payload = await (await request(provider, endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
        settle(reservation, config, payload);ledger.db.prepare("UPDATE provider_requests SET state='complete',response_json=? WHERE id=?").run(JSON.stringify(payload),key); ledger.setCache(`response-model:${key}`,config.model);ledger.setCache(`response:${key}`, payload); return payload;
      } catch (error) {
        if(error.rejectedBeforeInference)ledger.settle(reservation,0,{...error.providerReceipt,error:error.message,
          billing_basis:'Explicit invalid_request_error rejected before inference',candidate_id:config.candidate_id,stage,purpose,idempotency_key:key});
        else unresolved(reservation,error);
        ledger.db.prepare("UPDATE provider_requests SET state=? WHERE id=?").run(error.rejectedBeforeInference?'rejected':'unresolved',key);
        if(error.providerReceipt)error.message += `:${error.providerReceipt.message}`;
        throw error;
      }
    }
    ledger.db.prepare("INSERT INTO provider_batches(id,provider,reservation_id,state,request_json) VALUES(?,?,?,'dispatching',?)").run(key, provider, reservation, JSON.stringify({ body, config }));
    if(provider==='openai' && queueOpenAI || provider==='gemini' && queueGemini){
      ledger.transaction(()=>{
        ledger.db.prepare("UPDATE provider_batches SET state='queued' WHERE id=?").run(key);
        ledger.db.prepare("UPDATE requests SET state='submitted' WHERE id=?").run(reservation);
      });
      throw new BatchPending(key,stage);
    }
    try {
      let submission;
      if (provider === 'openai') {
        const form = new FormData(); form.append('purpose', 'batch');
        form.append('file', new Blob([JSON.stringify({ custom_id: key, method: 'POST', url: '/v1/responses', body }) + '\n'], { type: 'application/jsonl' }), 'factory.jsonl');
        const file = await (await request(provider, '/v1/files', { method: 'POST', body: form })).json();
        if (!file.id) throw new Error('batch_file_id_missing');
        config.input_file_id=file.id;
        ledger.db.prepare('UPDATE provider_batches SET request_json=? WHERE id=?').run(JSON.stringify({body,config}),key);
        submission = await (await request(provider, '/v1/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input_file_id: file.id, endpoint: '/v1/responses', completion_window: '24h', metadata: { factory_key: key } }) })).json();
      } else {
        submission = await (await request(provider, `/v1beta/models/${config.model}:batchGenerateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch: { displayName: key, inputConfig: { requests: { requests: [{ request: {...body,model:`models/${config.model}`}, metadata: { key } }] } } } }) })).json();
      }
      const id = submission.id || submission.name;
      if (!id || provider === 'openai' && !/^batch_[\w-]+$/.test(id) || provider === 'gemini' && !/^batches\/[\w-]+$/.test(id)) throw new Error('batch_provider_id_missing');
      ledger.transaction(() => {
        ledger.db.prepare("UPDATE provider_batches SET provider_id=?,state='submitted' WHERE id=?").run(id, key);
        ledger.db.prepare("UPDATE requests SET state='submitted' WHERE id=?").run(reservation);
      });
      throw new BatchPending(key,stage);
    } catch (error) {
      if (error instanceof BatchPending) throw error;
      unresolved(reservation, error);
      ledger.db.prepare("UPDATE provider_batches SET state='unresolved' WHERE id=?").run(key);
      throw error;
    }
  }
  async function reconcile(key) {
    const row = ledger.db.prepare('SELECT * FROM provider_batches WHERE id=?').get(key);
    if (!row || !['submitted','unresolved'].includes(row.state) || !row.provider_id) return null;
    try {
    const { config } = JSON.parse(row.request_json);
    const path = row.provider === 'openai' ? `/v1/batches/${row.provider_id}` : `/v1beta/${row.provider_id}`;
    const saved=terminalBatches.get(path);
    const batch = saved && (saved.terminal||now()-saved.at<15000) ? saved.payload : await (await request(row.provider, path)).json();
    const state=(batch.metadata?.state||batch.state||'').replace(/^BATCH_STATE_/,'JOB_STATE_');
    const terminal=row.provider==='openai'?['completed','failed','expired','cancelled'].includes(batch.status):batch.done||['JOB_STATE_SUCCEEDED','JOB_STATE_FAILED','JOB_STATE_CANCELLED','JOB_STATE_EXPIRED'].includes(state);
    terminalBatches.set(path,{payload:batch,at:now(),terminal:Boolean(terminal)});
    let payload;
    if (row.provider === 'openai') {
      if (!['completed', 'failed', 'expired', 'cancelled'].includes(batch.status)) return null;
      const fileIds=[...new Set([batch.output_file_id,batch.error_file_id].filter(id=>/^file-[\w-]+$/.test(id||'')))];
      if (!fileIds.length) {
        unresolved(row.reservation_id, new Error('batch_terminal_usage_missing'));
        ledger.db.prepare("UPDATE provider_batches SET state='unresolved' WHERE id=?").run(key);
        throw new Error('batch_terminal_usage_missing');
      }
      const records=[];
      for(const fileId of fileIds){let saved=outputFiles.get(fileId);if(!saved){const text=await(await request(row.provider,`/v1/files/${fileId}/content`)).text();saved=text.trim()?text.trim().split('\n').map(v=>JSON.parse(v)):[];outputFiles.set(fileId,saved);}records.push(...saved);}
      const matches=records.filter(r=>r.custom_id===key);
      if(matches.length!==1)throw Error('batch_record_mismatch');
      const record=matches[0],status=record.response?.status_code,detail=record.response?.body?.error||record.error;
      if(status!==200||record.error){
        const failure={provider_batch_id:row.provider_id,provider_batch_status:batch.status,provider_request_id:record.response?.request_id||record.id||null,http_status:status??null,error:detail||null,provider_batch_record:record};
        const rejected=status===400&&detail?.type==='invalid_request_error'||status===429&&detail?.type==='insufficient_quota'&&['insufficient_quota','credit_balance_exhausted'].includes(detail.code);
        const unexecuted=record.response===null&&detail?.code==='batch_expired'&&batch.status==='expired';
        if(rejected||unexecuted){
          ledger.settle(row.reservation_id,0,{provider:config.provider,model:config.model,execution_mode:config.execution_mode||'batch',stage:config.stage,purpose:config.purpose||'candidate',candidate_id:config.candidate_id,idempotency_key:key,source_url:config.pricing.source_url,rates:config.rates,...failure,billing_basis:unexecuted?'Provider explicitly reports this request could not execute before batch expiry; completed requests are billed separately.':'Typed parameter/schema or exhausted-quota rejection before inference; not an uncertain-call zero estimate.'});
        }else if(record.response?.body?.usage){settle(row.reservation_id,{...config,failure_receipt:failure},record.response.body);}
        else{const error=Error('batch_failed_usage_missing');error.providerReceipt=failure;throw error;}
        ledger.db.prepare("UPDATE provider_batches SET state='rejected',response_json=? WHERE id=?").run(JSON.stringify(record),key);
        return {failed:true,receipt_settled:true,record};
      }
      payload = record.response.body;
    } else {
      const state = (batch.metadata?.state || batch.state || '').replace(/^BATCH_STATE_/,'JOB_STATE_');
      if (state !== 'JOB_STATE_SUCCEEDED' && !batch.done && !['JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'].includes(state)) return null;
      const inline=batch.response?.inlinedResponses || batch.response?.output?.inlinedResponses || batch.metadata?.output?.inlinedResponses || batch.output?.inlinedResponses || batch.dest?.inlinedResponses;
      const records = Array.isArray(inline)?inline:inline?.inlinedResponses;
      const matches=records?.filter(r=>r.metadata?.key===key);
      if(records?.length && matches?.length!==1)throw Error('batch_record_mismatch');
      if (matches?.length !== 1 || matches[0].error || !matches[0].response) {
        unresolved(row.reservation_id, new Error('batch_terminal_usage_missing'));
        ledger.db.prepare("UPDATE provider_batches SET state='unresolved' WHERE id=?").run(key);
        throw new Error('batch_terminal_usage_missing');
      }
      payload = matches[0].response;
    }
    if(ledger.db.prepare('SELECT state FROM requests WHERE id=?').get(row.reservation_id)?.state!=='settled')settle(row.reservation_id, config, payload);
    ledger.db.prepare("UPDATE provider_batches SET state='complete',response_json=? WHERE id=?").run(JSON.stringify(payload), key);
    ledger.setCache(`response:${key}`, payload); return payload;
    } catch(error) {
      unresolved(row.reservation_id,error);
      ledger.db.prepare("UPDATE provider_batches SET state='unresolved' WHERE id=?").run(key);
      throw error;
    }
  }
  async function attachAcceptedBatch(key,providerId) {
    const row=ledger.db.prepare('SELECT * FROM provider_batches WHERE id=?').get(key);
    if(!row || row.state!=='unresolved' || row.provider_id)throw new Error('unresolved_batch_without_identity_required');
    if(row.provider==='openai'?!/^batch_[\w-]+$/.test(providerId):!/^batches\/[\w-]+$/.test(providerId))throw new Error('invalid_provider_batch_id');
    const batch=await (await request(row.provider,row.provider==='openai'?`/v1/batches/${providerId}`:`/v1beta/${providerId}`)).json();
    const {config}=JSON.parse(row.request_json);
    if(row.provider==='openai'?((config.group_key?batch.metadata?.factory_group!==config.group_key:batch.metadata?.factory_key!==key) || !config.input_file_id || batch.input_file_id!==config.input_file_id):
      (batch.metadata?.displayName || batch.displayName)!==(config.group_key||key))throw new Error('recovered_batch_identity_mismatch');
    const cohort=ledger.db.prepare("SELECT id,request_json FROM provider_batches WHERE provider=? AND state='unresolved' AND provider_id IS NULL").all(row.provider)
      .filter(r=>r.id===key||config.group_key&&JSON.parse(r.request_json).config?.group_key===config.group_key&&
       (row.provider!=='openai'||JSON.parse(r.request_json).config?.input_file_id===config.input_file_id));
    ledger.transaction(()=>{for(const item of cohort)ledger.db.prepare("UPDATE provider_batches SET provider_id=?,state='submitted' WHERE id=?").run(providerId,item.id);});
    // Keep the unresolved spending hold until final provider usage is obtained.
    return reconcile(key);
  }
  async function flush() {
    const geminiRows=ledger.transaction(()=>{
      const rows=ledger.db.prepare("SELECT * FROM provider_batches WHERE provider='gemini' AND state='queued' ORDER BY id").all();
      for(const row of rows)ledger.db.prepare("UPDATE provider_batches SET state='dispatching' WHERE id=?").run(row.id);
      return rows;
    });
    let geminiSubmission=null;
    if(geminiRows.length){
      const groupKey=digest(geminiRows.map(r=>r.id));
      try{
        for(const row of geminiRows){const saved=JSON.parse(row.request_json);saved.config.group_key=groupKey;ledger.db.prepare('UPDATE provider_batches SET request_json=? WHERE id=?').run(JSON.stringify(saved),row.id);}
        const requests=geminiRows.map(row=>({request:{...JSON.parse(row.request_json).body,model:`models/${geminiModel}`},metadata:{key:row.id}}));
        const batch=await(await request('gemini',`/v1beta/models/${geminiModel}:batchGenerateContent`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({batch:{displayName:groupKey,inputConfig:{requests:{requests}}}})})).json();
        const id=batch.name||batch.id;if(!/^batches\/[\w-]+$/.test(id||''))throw Error('batch_provider_id_missing');
        ledger.transaction(()=>{for(const row of geminiRows){const saved=JSON.parse(row.request_json);saved.config.group_key=groupKey;ledger.db.prepare("UPDATE provider_batches SET provider_id=?,state='submitted',request_json=? WHERE id=?").run(id,JSON.stringify(saved),row.id);}});
        geminiSubmission={provider_id:id,requests:geminiRows.length};
      }catch(error){for(const row of geminiRows){unresolved(row.reservation_id,error);ledger.db.prepare("UPDATE provider_batches SET state='unresolved' WHERE id=?").run(row.id);}throw error;}
    }
    const rows=ledger.transaction(()=>{
      const claimed=ledger.db.prepare("SELECT * FROM provider_batches WHERE provider='openai' AND state='queued' ORDER BY id").all();
      for(const row of claimed)ledger.db.prepare("UPDATE provider_batches SET state='dispatching' WHERE id=?").run(row.id);
      return claimed;
    });
    if(!rows.length)return geminiSubmission;
    const groupKey=digest(rows.map(r=>r.id));
    // Claim before upload. A lost acceptance is held, never silently resubmitted.
    try{
      const jsonl=rows.map(row=>JSON.stringify({custom_id:row.id,method:'POST',url:'/v1/responses',body:JSON.parse(row.request_json).body})).join('\n')+'\n';
      const form=new FormData();form.append('purpose','batch');form.append('file',new Blob([jsonl],{type:'application/jsonl'}),'factory.jsonl');
      const file=await(await request('openai','/v1/files',{method:'POST',body:form})).json();
      if(!file.id)throw new Error('batch_file_id_missing');
      for(const row of rows){const saved=JSON.parse(row.request_json);saved.config.input_file_id=file.id;saved.config.group_key=groupKey;
        ledger.db.prepare('UPDATE provider_batches SET request_json=? WHERE id=?').run(JSON.stringify(saved),row.id);}
      const batch=await(await request('openai','/v1/batches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input_file_id:file.id,endpoint:'/v1/responses',completion_window:'24h',metadata:{factory_group:groupKey}})})).json();
      if(!/^batch_[\w-]+$/.test(batch.id || ''))throw new Error('batch_provider_id_missing');
      ledger.transaction(()=>{for(const row of rows)ledger.db.prepare("UPDATE provider_batches SET provider_id=?,state='submitted' WHERE id=?").run(batch.id,row.id);});
      return {provider_id:batch.id,requests:rows.length};
    }catch(error){for(const row of rows){unresolved(row.reservation_id,error);ledger.db.prepare("UPDATE provider_batches SET state='unresolved' WHERE id=?").run(row.id);}throw error;}
  }
  // A restart can retain only a reconstructible guarded maximum. Missing or
  // malformed contracts retain the global block; no request is dispatched here.
  for(const row of ledger.db.prepare("SELECT r.id FROM requests r LEFT JOIN conservative_holds h ON h.reservation_id=r.id WHERE r.state='unresolved' AND h.reservation_id IS NULL").all()){
    try {unresolved(row.id,new Error('restart_usage_receipt_missing'));}catch { /* No proven bound means no continuation. */ }
  }
  return { generate, reconcile, attachAcceptedBatch,flush };
}

export function responseJSON(payload) {
  const text = payload.output_text || (payload.output || []).flatMap(v => v.content || []).filter(v => v.type === 'output_text').map(v => v.text).join('') ||
    payload.candidates?.[0]?.content?.parts?.filter(v => !v.thought).map(v => v.text || '').join('');
  if (payload.status === 'incomplete' || payload.candidates?.[0]?.finishReason && payload.candidates[0].finishReason !== 'STOP') throw new Error('provider_output_incomplete');
  try { return JSON.parse(text); } catch { throw new Error('invalid_provider_json'); }
}

// A completed, billed but truncated response is a transport defect, not a
// second academic edit. Exactly one continuation attempt uses the same input
// and a durable, distinct key. Accepted batches still reconcile before retry.
export async function completeJSON(transport,provider,body,options) {
  try{return responseJSON(await transport.generate(provider,body,options));}
  catch(error){
    if(!['provider_output_incomplete','invalid_provider_json'].includes(error.message))throw error;
    if(!options.key)throw error;
    const retry=structuredClone(body),cap=provider==='openai'?body.max_output_tokens:body.generationConfig.maxOutputTokens;
    if(provider==='openai')retry.max_output_tokens=cap*2;else retry.generationConfig.maxOutputTokens=cap*2;
    return responseJSON(await transport.generate(provider,retry,{...options,key:digest({parent:options.key,contract:'bounded-completion-retry-v1',cap:cap*2})}));
  }
}
