import {createHash} from 'node:crypto';
import {contentHash} from '../../../data/content_evidence.js';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function unresolvedReassessmentDecision(question,latest,profile,requests){
  if(latest?.state!=='provider_error'||latest.error!=='provider_request_unresolved_do_not_resubmit')return null;
  const expected=new Map(profile.content_hashes).get(question.id),hash=contentHash(question);
  if(latest.id!==question.id||latest.verifier!==profile.verifier||latest.content_hash!==hash||expected!==hash)throw Error('unresolved_reassessment_content_changed');
  const prefix='reassessment:'+profile.contract+':'+question.id;
  const unknown=requests.filter(r=>r.provider_state==='unresolved'&&r.state==='unresolved');
  if(!unknown.length)throw Error('unresolved_reassessment_native_record_required');
  const holds=unknown.map(r=>{
    const saved=JSON.parse(r.request_json),proof=JSON.parse(r.proof_json||'null'),{body,config}=saved;
    const price=config?.pricing?.models?.[config.model];
    const output=config?.provider==='openai'?body?.max_output_tokens:config?.provider==='anthropic'?body?.max_tokens:body?.generationConfig?.maxOutputTokens;
    const maximum=proof?Math.ceil(proof.input_bound*proof.input_rate+proof.output_bound*proof.output_rate+(proof.tool_calls||0)*(proof.tool_rate||0)*1e6):null;
    if(config?.candidate_id!==prefix||config.key!==r.provider_key||config.reserved!==r.reserved||r.response_json||
      !proof||proof.contract_hash!==digest(saved)||proof.model!==r.model||proof.input_bound!==price?.max_input_tokens||proof.output_bound!==output||
      proof.input_rate!==Math.max(config.rates?.input_per_million,config.rates?.cache_write_per_million||0)||proof.output_rate!==config.rates?.output_per_million||
      !Number.isSafeInteger(maximum)||maximum!==r.reserved||r.maximum_micro!==maximum||r.actual>r.reserved||
      !proof.pricing_source||!proof.basis||!proof.provider_request_id||Buffer.byteLength(JSON.stringify(body))>proof.input_bound)
      throw Error('unresolved_reassessment_bound_or_identity_invalid');
    return {request_key:r.provider_key,reservation_id:r.id,provider:r.provider,stage:config.stage,maximum_micro:maximum,provider_request_id:proof.provider_request_id,receipt_resolved:false};
  });
  return {id:question.id,verifier:profile.verifier,contract:profile.contract,content_hash:hash,state:'quarantined',
    reasons:['independent_validation_incomplete_unresolved_provider_request'],failed_stage:holds[0].stage||'provider_receipt',
    result:{state:'quarantined',independent_validation_complete:false,academic_defect_proven:false,provider_usage_resolved:false,
      reasons:['independent_validation_incomplete_unresolved_provider_request'],conservative_holds:holds,
      external_dependency:'The provider response and usage receipt were lost before a retrievable response ID was received. Resolve the original client request with provider billing/support; never resend it.'},
    new_evidence:null,unresolved_requests:holds};
}
