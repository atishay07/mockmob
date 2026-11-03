import {readFileSync,writeFileSync} from 'node:fs';
import {createFactoryEvidenceV76,blindViewV76} from '../../../../../scripts/pipeline/lib/factoryEvidenceV76.mjs';
import {effortsFor} from '../../../../../data/cuet_fit_evidence.mjs';
import {maximumRequestMicro} from '../../../../../scripts/pipeline/lib/campaignExecutionV7.mjs';
import {inspectBlindCaptureV73} from '../../../../../scripts/pipeline/lib/freshCuetReadinessV73Guards.mjs';
const root='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-source-prep',read=p=>JSON.parse(readFileSync(p));
const studyAt=process.argv.indexOf('--study-dir'),study=studyAt>=0?process.argv[studyAt+1]:null;
const draft=study?{cases:read(study+'/frozen.json').fixtures}:read(root+'/draft-cases-v2-PRIVATE.json'),b=read('data/source_registry.json'),o=read(study?study+'/scratch-registry-overlay.json':root+'/source-overlay-v3.json'),prices=read('data/pipeline-prices.json');
if(study?.endsWith('-bounded-input')){const override=read('artifacts/question-factory/cuet-readiness-2026-10-09/v76-transport-input-reservation.json');if(override.max_input_tokens!==35000||override.rates_changed!==false)throw Error('registered_input_reservation_required');for(const model of ['gpt-6-luna','gemini-3.8-flash'])prices.models[model].max_input_tokens=35000;}
const registry={...b,sources:{...b.sources,...o.sources},families:{...b.families,...o.families},packs:{...b.packs,...o.packs}},captures=[];
for(const f of draft.cases){
 const transport={generate:async(provider,body,options)=>{const raw=provider==='openai'?body.input.find(x=>x.role==='user').content:body.contents[0].parts[0].text;
  if(options.stage!=='explanation_support')inspectBlindCaptureV73({fixtureId:f.id,provider,phase:options.stage,raw,body,inputLimitTokens:prices.models[provider==='openai'?'gpt-6-luna':'gemini-3.8-flash'].max_input_tokens});
  const retry=structuredClone(body);if(provider==='openai')retry.max_output_tokens*=2;else retry.generationConfig.maxOutputTokens*=2;
  captures.push({id:f.id,provider,stage:options.stage,utf8_bytes:Buffer.byteLength(JSON.stringify(body)),maximum_output_tokens:provider==='openai'?body.max_output_tokens:body.generationConfig.maxOutputTokens,maximum_reserved_micro:maximumRequestMicro(provider,body,prices),single_billed_completion_retry_maximum_micro:maximumRequestMicro(provider,retry,prices)});throw Error('offline_capture_complete');}};
 let auditMode=false;
 // Synthetic empty judgments are used ONLY to reach the audit request builder.
 // They are neither model outcomes nor qualification evidence. Full input is reserved.
 const adapters=createFactoryEvidenceV76({registry,ledger:{getCache:()=>auditMode?{provider:'offline-synthetic',model:'offline-synthetic',solved_key:null,reasons:[],evidence_ids:[]}:null,setCache:()=>{throw Error('offline_cache_write');}},transport,calibrationPurpose:true,efforts:effortsFor(f.candidate)}),view=blindViewV76(f.candidate,f.candidate.source_refs);
 for(const provider of ['openai','gemini'])try{await adapters.__evaluation(view,provider);}catch(e){if(e.message!=='offline_capture_complete')throw e;}
 auditMode=true;
 try{await adapters.explanation_support({...view,proposed_explanation:f.candidate.explanation});}catch(e){if(e.message!=='offline_capture_complete')throw e;}
}
if(captures.length!==draft.cases.length*3||draft.cases.some(f=>captures.filter(c=>c.id===f.id&&c.stage==='explanation_support').length!==1))throw Error('all_three_stage_cost_captures_required');
const out={at:new Date().toISOString(),paid_calls:0,price_expires_at:prices.expires_at,source:'Actual frozen V76 request builders; maximum FULL input/output reservations at registered rates, including cache-write bound AND existing exactly-one billed output-completion retry with doubled output ceiling; realized Flex discounts are not assumed. Audit builder uses synthetic empty cached solutions: its displayed bytes are not the final audit input size. Real audits remain guarded by full input/output reservations.',supersedes:'v2 captured duplicate blind evaluations and omitted audit requests; v3 omitted existing billed completion retries. All historical estimates are preserved. This post-result correction is not retroactive preregistration.',cases:draft.cases.length,maximum_stage_reservations_usd:Object.fromEntries([...new Set(captures.map(c=>c.stage))].map(stage=>[stage,Math.max(...captures.filter(c=>c.stage===stage).map(c=>c.maximum_reserved_micro+c.single_billed_completion_retry_maximum_micro))/1e6])),initial_requests_bound_usd:captures.reduce((s,c)=>s+c.maximum_reserved_micro,0)/1e6,all_stages_with_retries_bound_usd:captures.reduce((s,c)=>s+c.maximum_reserved_micro+c.single_billed_completion_retry_maximum_micro,0)/1e6,maximum_request_bytes:Math.max(...captures.map(c=>c.utf8_bytes)),captures};
const outAt=process.argv.indexOf('--out'),output=outAt>=0?process.argv[outAt+1]:root+'/offline-request-budget-v4-post-result.json';
writeFileSync(output,JSON.stringify(out,null,2),{flag:'wx'});console.log(JSON.stringify({...out,captures:undefined}));
