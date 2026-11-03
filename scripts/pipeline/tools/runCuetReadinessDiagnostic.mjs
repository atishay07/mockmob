// Preregistered, source-certified diagnostic; never a topology release or bank
// publication. Provider judgments are completed once and reused only under this
// exact frozen content, source and verification contract.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createHash} from 'node:crypto';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {createFactoryEvidenceV7,TOPOLOGIES} from '../lib/factoryEvidenceV7.mjs';
import {validateFactoryCandidateV7} from '../lib/verifyV7.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
import {expectedReleaseBinding} from '../lib/releaseEvidenceV7.mjs';
import {payloadHash} from '../lib/cuetFitBenchmark.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {effortsFor} from '../../../data/cuet_fit_evidence.mjs';
import {bodyCandidateId,scopedAccounting} from '../lib/scopedAccounting.mjs';
import {maximumRequestMicro,assertCampaignBudget,requestNeedsReservation} from '../lib/campaignExecutionV7.mjs';

const id='cuet-readiness-diagnostic72-v2',prefix=id+':',root='artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4',dir=root+'/diagnostic72-v2';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n'),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const action=process.argv[2]||'report',arg=(n,d)=>{const i=process.argv.indexOf(n);return i<0?d:process.argv[i+1];},cap=Number(arg('--cap-usd',4));
const subjects=['english','accountancy','business_studies','economics'],providers=['openai','gemini','anthropic'];
const prepared=root+'/pipeline-view.json',frozenPath=dir+'/frozen.json',resultsPath=dir+'/results.json';
mkdirSync(dir,{recursive:true});
function select(fixtures){
 const sorted=[...fixtures].sort((a,b)=>a.id.localeCompare(b.id)),selected=sorted.filter(f=>f.expected_valid);
 for(const category of ['wrong_key','overlapping_options','unsupported_explanation'])for(const subject of subjects){
  const candidates=sorted.filter(f=>f.category===category&&f.candidate.subject===subject);
  // One development and one sealed-root case per subject and defect category.
  for(const partition of ['development','release']){
   const picked=candidates.find(f=>f.partition===partition||partition==='release'&&f.partition==='release-sealed');
   if(!picked)throw Error('diagnostic_stratum_missing:'+subject+':'+category+':'+partition);selected.push(picked);
  }
 }
 selected.push(...sorted.filter(f=>['missing_decisive_condition','syllabus_mismatch'].includes(f.category)),...sorted.filter(f=>f.category==='numeric_error').slice(0,4));
 if(selected.length!==72||new Set(selected.map(f=>f.id)).size!==72)throw Error('diagnostic_denominator_mismatch');
 return selected.sort((a,b)=>a.id.localeCompare(b.id));
}
if(action==='prepare'){
 if(existsSync(frozenPath))throw Error('diagnostic_already_frozen_no_overwrite');
 const original=read(prepared),fixtures=select(original.fixtures),registry=read('data/source_registry.json'),binding=expectedReleaseBinding();
 if(JSON.stringify(original.frozen.contract_binding)!==JSON.stringify(binding))throw Error('benchmark_contract_changed');
 const audit=read(root+'/key-audit/audit-report.json');
 if(audit.review_mode!=='blind-first-pass-then-programmatic-unblind'||audit.comparison?.independent_record_count!==40||audit.comparison?.oracle_mismatches?.length!==0)throw Error('independent_blinded_key_audit_required');
 const frozen={...original.frozen,id,fixtures,additions:original.additions,registry,fixture_count:72,parent_payload_hash:original.frozen.payload_hash,payload_hash:payloadHash(fixtures),audit_sha256:sha(root+'/key-audit/audit-report.json'),independent_keys_sha256:sha(root+'/key-audit/independent-keys.json'),contract_binding:binding,cap_usd:cap,providers,preregistered_at:new Date().toISOString(),maximum_repairs:0,publication_policy:'never',release_eligibility:{scope:'diagnostic',classification:'diagnostic',preregistration_id:id,approved_before_evaluation:true,previously_read:false,tuned_on:false},
  contested_positive_roots:['AC-05'],audit_disclosure:audit,limitation:'40 valid root questions, including one contested wording case; shared source documents and correlated controls. A separate Luna agent keyed the 40 roots before unblinding. This is diagnostic evidence, not a full topology release, statistical proof of perfection or measured student timing.'};
 if(!Number.isFinite(cap)||cap<=0||cap>6)throw Error('bounded_diagnostic_cap_required');save(frozenPath,frozen);
 save(dir+'/PREREGISTRATION.json',{id,at:frozen.preregistered_at,payload_hash:frozen.payload_hash,parent_payload_hash:frozen.parent_payload_hash,fixture_count:72,valid:40,defects:32,providers,expected_blind_judgments:216,contract_binding:binding,cap_usd:cap,publication:'never',controls:'8 wrong keys, 8 overlaps, 8 unsupported explanations, 1 missing assumption, 3 syllabus mismatches, 4 numerical faults; all retained. No fixture repair, replacement or answer-based selection.',contested_positive_roots:frozen.contested_positive_roots,source_key_audit_sha256:frozen.audit_sha256});
 console.log(JSON.stringify({prepared:true,fixtures:72,expected_judgments:216,cap_usd:cap,payload_hash:frozen.payload_hash}));
}else{
 const frozen=read(frozenPath);
 if(payloadHash(frozen.fixtures)!==frozen.payload_hash||JSON.stringify(frozen.contract_binding)!==JSON.stringify(expectedReleaseBinding())||sha(root+'/key-audit/audit-report.json')!==frozen.audit_sha256)throw Error('diagnostic_frozen_contract_changed');
 if(cap!==frozen.cap_usd)throw Error('diagnostic_cap_changed');
 try{loadEnvFile('.env.local');}catch{}
 const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),registry={...frozen.registry,sources:{...frozen.registry.sources,...frozen.additions.sources},families:{...frozen.registry.families,...frozen.additions.families},packs:{...frozen.registry.packs,...frozen.additions.packs}};
 let pending=0,stop=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
 const results=existsSync(resultsPath)?read(resultsPath):{tag:'v7.2-diagnostic',set:'diagnostic72',benchmark:{id,payload_hash:frozen.payload_hash},contract_binding:frozen.contract_binding,verifier_version:frozen.verifier_version,release_eligibility:frozen.release_eligibility,evaluations:{},topologies:{dual_blind:[]},started_at:new Date().toISOString()};
 if(results.benchmark.payload_hash!==frozen.payload_hash)throw Error('diagnostic_progress_changed');
 const native=createFactoryTransport({ledger,realtimeStages:['blind_solution','independent_evaluation','explanation_support']});
 const transport={generate:async(provider,body,opts)=>{
  const key=hashJSON({study:id,parent:opts.key});if(!requestNeedsReservation(ledger,key))return native.generate(provider,body,{...opts,key});
  if(stop||existsSync(dir+'/STOP_AFTER_ITEM'))throw Error('diagnostic_stopping_after_current_request');
  const candidate=bodyCandidateId(provider,body);if(!candidate)throw Error('diagnostic_candidate_id_required');
  const maximum=maximumRequestMicro(provider,body,read('data/pipeline-prices.json'));assertCampaignBudget(scopedAccounting(ledger,prefix).committed_micro+pending,maximum,cap);pending+=maximum;
  try{return await native.generate(provider,body,{...opts,key,batch:false,purpose:'calibration',candidate_id:prefix+candidate});}finally{pending-=maximum;}
 }};
 const summarize=()=>{
  const rows=results.topologies.dual_blind,cost=scopedAccounting(ledger,prefix),primary=frozen.fixtures.filter(f=>f.expected_valid&&!frozen.contested_positive_roots.includes(f.candidate.concept_id)),map=new Map(rows.map(r=>[r.id,r]));
  return {at:new Date().toISOString(),scope:'diagnostic',complete:rows.length===72&&frozen.fixtures.every(f=>providers.every(p=>results.evaluations[f.id]?.[p]?.status==='judged'))&&rows.every(r=>r.state!=='error'),denominator:72,topology_completed:rows.length,judgments:Object.values(results.evaluations).reduce((n,ev)=>n+Object.values(ev).filter(v=>v.status==='judged').length,0),provider_errors:Object.values(results.evaluations).reduce((n,ev)=>n+Object.values(ev).filter(v=>v.status==='error').length,0),valid_eligible:rows.filter(r=>r.expected_valid&&r.state==='eligible').length,valid_denominator:40,primary_valid_denominator:primary.length,primary_valid_eligible:primary.filter(f=>map.get(f.id)?.state==='eligible').length,controlled_false_accepts:rows.filter(r=>!r.expected_valid&&r.state==='eligible').map(r=>r.id),unresolved_topology_errors:rows.filter(r=>r.state==='error').map(r=>r.id),settled_usd:cost.settled_micro/1e6,held_usd:cost.held_micro/1e6,gross_usd:cost.committed_micro/1e6,receipt_complete:cost.receipt_complete,publication_writes:0,release:false};
 };
 try{
  if(action==='preflight'){
   const captures=[],limits=read('data/pipeline-prices.json').models;
   for(const fixture of frozen.fixtures)for(const provider of providers){
    const captured={generate:async(p,body)=>{const raw=p==='openai'?body.input.find(r=>r.role==='user').content:p==='anthropic'?body.messages[0].content:body.contents[0].parts[0].text;
     const input=JSON.parse(raw);if('proposed_explanation' in input||'correct_answer' in input||'oracle' in input||raw.includes('BLIND_PREFLIGHT_CANARY'))throw Error('diagnostic_blind_leak');
     const model=p==='openai'?'gpt-6-luna':p==='anthropic'?'claude-haiku-5-5':'gemini-3.8-flash',bytes=Buffer.byteLength(JSON.stringify(body));
     captures.push({id:fixture.id,provider:p,bytes,limit:limits[model].max_input_tokens,within_bound:bytes<=limits[model].max_input_tokens});throw Error('offline_capture_complete');}};
    const adapters=createFactoryEvidenceV7({registry,ledger:{getCache:()=>null,setCache:()=>{throw Error('offline_cache_write');}},transport:captured,calibrationPurpose:true,efforts:{...effortsFor(fixture.candidate),haiku:'medium'}});
    try{await adapters.__evaluation(blindView({...fixture.candidate,explanation:'BLIND_PREFLIGHT_CANARY'},fixture.candidate.source_refs),provider);}catch(e){if(e.message!=='offline_capture_complete')throw e;}
   }
   const out={at:new Date().toISOString(),captures:captures.length,expected:216,blind:true,maximum_bytes:Math.max(...captures.map(c=>c.bytes)),over_bound:captures.filter(c=>!c.within_bound),paid_provider_calls:0};save(dir+'/preflight.json',out);console.log(JSON.stringify(out));if(out.over_bound.length)throw Error('diagnostic_input_bound_exceeded_before_dispatch');
  }
  else if(action==='report'){console.log(JSON.stringify(summarize()));save(dir+'/summary.json',summarize());}
  else if(action==='execute'){
   if(!process.argv.includes('--approved'))throw Error('explicit_paid_execution_required');ledger.assertHistoryReconciled();
   let i=0;await Promise.all(Array.from({length:4},async()=>{for(;;){if(stop||existsSync(dir+'/STOP_AFTER_ITEM'))return;const fixture=frozen.fixtures[i++];if(!fixture)return;
    const adapters=createFactoryEvidenceV7({registry,ledger,transport,topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,efforts:{...effortsFor(fixture.candidate),haiku:'medium'}});
    results.evaluations[fixture.id]||={};
    for(const provider of providers){if(results.evaluations[fixture.id][provider]?.status)continue;
     try{const evaluation=await adapters.__evaluation(blindView(fixture.candidate,fixture.candidate.source_refs),provider);results.evaluations[fixture.id][provider]={status:'judged',...evaluation};}
     catch(e){results.evaluations[fixture.id][provider]={status:'error',error:e.message};if(/budget|pricing|credit|stopping/.test(e.message))stop=true;}
     save(resultsPath,results);
    }
    if(!results.topologies.dual_blind.some(r=>r.id===fixture.id)){
     let result;try{result=await validateFactoryCandidateV7(fixture.candidate,{registry,ledger,transport,topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,seen:new Set()});}
     catch(e){result={state:'error',reasons:[e.message]};if(/budget|pricing|credit|stopping/.test(e.message))stop=true;}
     results.topologies.dual_blind.push({id:fixture.id,group:fixture.group,category:fixture.category,expected_valid:fixture.expected_valid,...result});
    }
    save(resultsPath,results);save(dir+'/summary.json',summarize());console.log(JSON.stringify({case:fixture.id,...summarize()}));
   }}));save(resultsPath,results);save(dir+'/summary.json',summarize());console.log(JSON.stringify(summarize()));
  }else throw Error('unknown_diagnostic_action');
 }finally{ledger.close();}
}
