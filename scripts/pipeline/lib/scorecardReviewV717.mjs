import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { createFactoryEvidenceV76, blindViewV76 } from './factoryEvidenceV76.mjs';
import { lunaBody } from './factoryEvidence.mjs';
import { completeJSON } from './factoryTransport.mjs';
import { effortsFor } from '../../../data/cuet_fit_evidence.mjs';
import { canonicalQuestion } from '../../../data/content_evidence.js';
import { scorecardFormatIssuesV717,blindKeyDefectsV717 } from './scorecardPolicyV717.mjs';
import { BLIND_PROMPT_V717,AUDIT_PROMPT_V717,scorecardSchemaV717 } from './scorecardPromptV717.mjs';
import { FACTORY_VERIFIER_VERSION_V717,validationContractV717 } from './contractV717.mjs';
import { DEMAND_ANCHORS_V717 } from './difficultyPolicyV717.mjs';
export const SCORECARD_OUTPUT_CAPS_V717 = Object.freeze({blind_solution:16000,independent_evaluation:6000,explanation_support:8000});
export function scorecardPromptHashV717() { return hashJSON({blind:BLIND_PROMPT_V717,audit:AUDIT_PROMPT_V717,contract:validationContractV717(),caps:SCORECARD_OUTPUT_CAPS_V717}); }
export function createScorecardReviewV717({ registry,ledger,transport,efforts,exemplarExclude } = {}) {
 if (!registry || !ledger || typeof ledger.getCache !== 'function' || typeof ledger.setCache !== 'function' || typeof transport?.generate !== 'function') throw Error('v717_guarded_review_configuration_required');
 // The context builder is reused, but none of its old validators are called.
 const contextBuilder = createFactoryEvidenceV76({registry,ledger,transport,exemplarExclude});
 const contract = validationContractV717(), prompt = scorecardPromptHashV717();
 async function call(candidate, input, stage, provider) {
  const effortPolicy = efforts || effortsFor(candidate), effort = provider === 'gemini' ? effortPolicy.gemini : stage === 'explanation_support' ? effortPolicy.explanation : effortPolicy.blind;
  const system = stage === 'explanation_support' ? AUDIT_PROMPT_V717 : BLIND_PROMPT_V717;
  const schema = scorecardSchemaV717(input.evidence_catalog.map(row => row.id), stage === 'explanation_support');
  schema.properties.candidate_id = { type:'string', enum:[input.candidate_id] }; schema.properties.content_hash = { type:'string', enum:[input.content_hash] };
  const cap = SCORECARD_OUTPUT_CAPS_V717[stage];
  const body = provider === 'openai' ? lunaBody(system,input,effort,cap,schema) : {
   systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],
   generationConfig:{maxOutputTokens:cap,thinkingConfig:{thinkingLevel:effort.toUpperCase()},responseFormat:{text:{mimeType:'APPLICATION_JSON',schema}}}
  };
  const key = hashJSON({contract,prompt,stage,provider,body});
  const cacheKey = 'v717-scorecard:' + key, cached = ledger.getCache(cacheKey);
  const stamped = raw => ({...raw,candidate_id:raw.candidate_id,content_hash:raw.content_hash,provider,model:provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.8-flash',effort,stage,
   prompt_version:FACTORY_VERIFIER_VERSION_V717,validation_contract_hash:contract,evaluation_prompt:prompt,request_key:key});
  if (cached) {
   if (cached.candidate_id !== input.candidate_id || cached.content_hash !== input.content_hash || cached.validation_contract_hash !== contract || cached.evaluation_prompt !== prompt || cached.prompt_version!==FACTORY_VERIFIER_VERSION_V717 || cached.stage !== stage || cached.provider !== provider || cached.model!==(provider==='openai'?'gpt-6-luna':'gemini-3.8-flash') || cached.effort!==effort || cached.request_key!==key) throw Error('v717_cached_report_binding_invalid');
   return structuredClone(cached);
  }
  // completeJSON has exactly one paid completion retry with a distinct durable key; unknown accepted requests are never replayed.
  const raw = await completeJSON(transport,provider,body,{key,stage,purpose:'candidate',candidate_id:input.candidate_id});
  if (raw.candidate_id !== input.candidate_id || raw.content_hash !== input.content_hash) throw Error('v717_report_identity_mismatch');
  const report = stamped(raw); ledger.setCache(cacheKey,report); return structuredClone(report);
 }
 return {
  context(candidate) { return {...contextBuilder.__context(blindViewV76(candidate,candidate.source_refs || [])),demand_anchors:DEMAND_ANCHORS_V717}; },
  async review(candidate, { onBlindFrozen = async () => {} } = {}) {
   const input = this.context(candidate);
   for (const field of ['correct_answer','correct_index','answer','key','explanation','proposed_explanation','expected_valid','oracle','regression_role']) if (Object.hasOwn(input,field)) throw Error('v717_blind_payload_contains_answer');
   const first = await call(candidate,input,'blind_solution','openai');
   const second = await call(candidate,input,'independent_evaluation','gemini');
   const reports = structuredClone([first,second]);
   // Durable caller checkpoint happens before key/explanation are revealed to the audit.
   await onBlindFrozen({candidate_id:input.candidate_id,content_hash:input.content_hash,reports:structuredClone(reports),sha256:hashJSON(reports)});
   if (scorecardFormatIssuesV717(candidate,reports,null,{blindOnly:true,exemplarIds:input.calibration_exemplars.map(e=>e.id)}).length || blindKeyDefectsV717(candidate,reports).length) return {reports,audit:null,context:input};
   const q=canonicalQuestion(candidate);
   const supplied = {...input,proposed_explanation:q.explanation,proposed_key:q.key,
    frozen_reports:reports.map(report => ({provider:report.provider,solved_key:report.solved_key,answer_set:report.answer_set,derivation:report.derivation,options:report.options,issues:report.issues}))};
   const audit = await call(candidate,supplied,'explanation_support','openai');
   return {reports,audit,context:input};
  }
 };
}
