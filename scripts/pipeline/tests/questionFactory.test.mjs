import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { FactoryStore } from '../lib/factoryStore.mjs';
import { createFactoryTransport,BatchPending,responseJSON,completeJSON } from '../lib/factoryTransport.mjs';
import { createFactoryEvidence,evidenceCatalog,resolveEvidence,sameSyllabusUnit,sameChapter,chapterMappingVerdict,conditionsComplete } from '../lib/factoryEvidence.mjs';
import { itemQualityVerdict } from '../lib/factoryEvidence.mjs';
import { formatQuestionText } from '../../../data/question_presentation.mjs';
import { blueprintSkillKey } from '../lib/factoryBlueprints.mjs';
import { verifyCandidate } from '../lib/evidencePipeline.mjs';
import { registerSourcePack } from '../lib/sourcePacks.mjs';
import { contentHash,evaluateEvidence } from '../../../data/content_evidence.js';
import { FACTORY_POLICY,hashJSON,inventoryFingerprint,provenanceReasons,screeningMatches,factoryCalibrationReady,needsNumericChecks,CALIBRATION_RELEASE } from '../../../data/question_factory_policy.mjs';
import { mechanicalScreen,reviewBundles,importSubscriptionReview,subscriptionEnvironment,assertIncludedSubscription } from '../lib/subscriptionScreening.mjs';
import { planFactoryJobs } from '../lib/factoryQueue.mjs';
import { factoryPassageGroup,repairFactoryCandidate,authorCandidate,presentationLint,quotesInReferences } from '../lib/factoryCore.mjs';
import { calibrationAccuracy,validateCalibrationManifest,officialCalibrationUnit,runFactoryCalibration } from '../lib/factoryCalibration.mjs';
import { questionContentVersion } from '../../../data/question_content_version.mjs';
import { legacyPracticeVisible } from '../../../data/practice_availability.js';
import { rankCandidates,pickWithConstraints } from '../../../data/mock_question_selector.js';
import { providerPreflight,providerBlocker } from '../tools/providerPreflight.mjs';
import { factoryCostReport } from '../lib/factoryCosts.mjs';
import { corroboratePaper,matchMirroredAnchor,omrAnswer } from '../lib/mirroredPaperEvidence.mjs';
import { localPilotStep } from '../lib/localFactoryPilot.mjs';

test('preflight makes only credential-isolated GETs and classifies invalid keys without exposing them',async()=>{
  const urls=[];
  const report=await providerPreflight({env:{OPENAI_API_KEY:'openai-secret',GEMINI_API_KEY:'google-secret'},fetchImpl:async(url,init)=>{
    urls.push(url);assert.equal(init.method,undefined);assert.equal(init.body,undefined);
    if(url.includes('googleapis')){assert.equal(init.headers.Authorization,undefined);return Response.json({error:{code:400,message:'API key not valid. google-secret',status:'INVALID_ARGUMENT'}},{status:400});}
    assert.equal(init.headers['x-goog-api-key'],undefined);return Response.json({});
  }});
  assert.equal(urls.length,4);assert.equal(providerBlocker(report),'gemini_invalid_api_key');
  assert.equal(JSON.stringify(report).includes('secret'),false);assert.equal(report.paid_generation_requests,0);
  report.gemini.model_access={accessible:true};report.gemini.batch_list_access={accessible:false};
  assert.equal(providerBlocker(report),'gemini_batch_access_unconfirmed');
});

test('raw Gemini operation response settles nested inline output without resubmission and rejects unidentified records',async()=>{
  for(const identified of [true,false]){
    const {ledger}=ledgerFixture();let submissions=0;
    const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async(url)=>{
      if(url.endsWith(':batchGenerateContent')){submissions++;return Response.json({name:'batches/raw-fixture'});}
      return Response.json({done:true,metadata:{state:'BATCH_STATE_SUCCEEDED'},response:{inlinedResponses:{inlinedResponses:[{metadata:identified?{key:'raw-key'}:{},response:{usageMetadata:{promptTokenCount:20,candidatesTokenCount:10,thoughtsTokenCount:30}}}]}}});
    }});
    try{
      await assert.rejects(transport.generate('gemini',{generationConfig:{maxOutputTokens:100},contents:[]},{key:'raw-key'}),BatchPending);
      if(identified){await transport.reconcile('raw-key');await transport.generate('gemini',{}, {key:'raw-key'});assert.equal(ledger.snapshot().committed_micro,83);}
      else{await assert.rejects(transport.reconcile('raw-key'),/record_mismatch/);await assert.rejects(transport.generate('gemini',{}, {key:'raw-key'}),/submission_unresolved/);assert.equal(ledger.snapshot().unresolved,1);}
      assert.equal(submissions,1);
    }finally{ledger.close();}
  }
});

test('cost report separates settled reasoning-inclusive usage, pending holds and preparation',()=>{
  const {ledger}=ledgerFixture();
  try{
    const done=ledger.reserve('gpt-6-luna',100);ledger.settle(done,17,{stage:'blind_solver',provider:'openai',usage:{input_tokens:20,output_tokens:30,output_tokens_details:{reasoning_tokens:25}}});
    const pending=ledger.reserve('gemini-3.8-flash',200);
    ledger.db.prepare("INSERT INTO provider_batches(id,provider,reservation_id,state,request_json) VALUES(?,?,?,'submitted',?)").run('cost-test','gemini',pending,JSON.stringify({config:{stage:'independent_evaluation',provider:'gemini'}}));
    const report=factoryCostReport(ledger),solver=report.stages.find(s=>s.stage==='blind_solver'),evaluation=report.stages.find(s=>s.stage==='independent_evaluation');
    assert.equal(solver.settled_usd,.000017);assert.equal(solver.output_tokens,30);assert.equal(solver.reasoning_tokens,25);
    assert.equal(evaluation.held_usd,.0002);assert.equal(evaluation.settled_requests,0);assert.equal(evaluation.open_requests,1);
  }finally{ledger.close();}
});

function ledgerFixture() {
  const path=join(mkdtempSync(join(tmpdir(),'mockmob-factory-')),'budget.sqlite');const ledger=new BudgetLedger(path);
  ledger.reconcileHistory({spent_usd:0,basis:'Isolated software test ledger with no actual provider calls.',confirmed_at:new Date().toISOString()});return {path,ledger};
}
const prices={source_url:'https://fixture.invalid/prices',expires_at:'2099-01-01',web_search_per_call_usd:0.01,models:{
  'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:4096,input_per_million:0.1,output_per_million:0.5,batch:{input_per_million:0.05,output_per_million:0.25}},
  'gemini-3.8-flash':{provider_host:'generativelanguage.googleapis.com',max_input_tokens:4096,input_per_million:0.75,output_per_million:3.75,batch:{input_per_million:0.375,output_per_million:1.875}}
}};
const body={model:'gpt-6-luna',max_output_tokens:100,input:[{role:'user',content:'Return JSON.'}]};
const env={OPENAI_API_KEY:'fixture',GEMINI_API_KEY:'fixture'};

test('typed pre-inference rejection retains diagnostics and counts failure; unknown failures retain spending holds',async()=>{
  for(const typed of [true,false]){
    const {ledger}=ledgerFixture();
    const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async()=>Response.json({error:{type:typed?'invalid_request_error':'server_error',message:'Invalid schema',param:'text.format.schema'}},{status:typed?400:500,headers:{'x-request-id':'req_fixture'}})});
    try{
      await assert.rejects(transport.generate('openai',body,{batch:false}),/provider_http_/);
      const row=ledger.db.prepare('SELECT * FROM requests WHERE model=?').get('gpt-6-luna');
      assert.equal(row.state,typed?'settled':'unresolved');assert.equal(ledger.snapshot().requests,2);
      if(typed){assert.equal(row.actual,0);assert.equal(JSON.parse(row.receipt_json).provider_request_id,'req_fixture');}
      else assert.ok(ledger.snapshot().committed_micro>0);
    }finally{ledger.close();}
  }
});

test('a credit-exhausted 429 settles at zero while an ordinary rate limit keeps its hold',async()=>{
  for(const [code,type,settled] of [['credit_balance_exhausted','insufficient_quota',true],['rate_limit_exceeded','requests',false]]){
    const {ledger}=ledgerFixture();
    const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async()=>Response.json({error:{type,code,message:'fixture'}},{status:429,headers:{'x-request-id':'req_429'}})});
    try{
      await assert.rejects(transport.generate('openai',body,{batch:false}),/provider_http_429/);
      const row=ledger.db.prepare('SELECT * FROM requests WHERE model=?').get('gpt-6-luna');
      assert.equal(row.state,settled?'settled':'unresolved');if(settled)assert.equal(row.actual,0);
    }finally{ledger.close();}
  }
});

test('cheaper models are calibration-only and cannot reuse another model response',async()=>{
  const {ledger}=ledgerFixture();let calls=0;
  const benchmarkPrices={...prices,models:{...prices.models,'gemini-3.5-flash-lite':{...prices.models['gemini-3.8-flash'],batch:{input_per_million:.15,output_per_million:1.25}}}};
  const fetchImpl=async()=>{calls++;return Response.json({usageMetadata:{promptTokenCount:10,candidatesTokenCount:10},candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]});};
  const common={ledger,prices:()=>benchmarkPrices,env,fetchImpl};
  const normal=createFactoryTransport(common),lite=createFactoryTransport({...common,geminiModel:'gemini-3.5-flash-lite'});
  const request={contents:[],generationConfig:{maxOutputTokens:100}};
  try {
    await assert.rejects(lite.generate('gemini',request,{batch:false}),/calibration_only/);assert.equal(calls,0);
    await normal.generate('gemini',request,{batch:false});
    await lite.generate('gemini',request,{batch:false,purpose:'calibration'});assert.equal(calls,2);
    await normal.generate('gemini',request,{batch:false,key:'explicit-profile'});
    await assert.rejects(lite.generate('gemini',request,{batch:false,key:'explicit-profile',purpose:'calibration'}),/model_mismatch/);assert.equal(calls,3);
  }finally{ledger.close();}
});

test('mirrored papers require complete independent copies and the exact official booklet key',()=>{
  const root=mkdtempSync(join(tmpdir(),'factory-mirrors-'));
  const questions=Array.from({length:20},(_,i)=>({id:String(i+1),body:`Software stem ${i+1}?`,options:['First','Second','Third','Fourth'],quotes:Array(2).fill(`${i+1}. Software stem ${i+1}? (1) First (2) Second (3) Third (4) Fourth`)}));
  const text=['309 E/A',...questions.map(q=>q.quotes[0])].join('\n');
  const file=(name,value)=>{writeFileSync(join(root,name),value);return createHash('sha256').update(value).digest('hex');};
  const sha=file('primary.txt',text),second=file('second.txt',text),catalog=file('catalog.txt','CUET 2024 Economics paper');
  const authentication={type:'corroborated_mirror',publisher_group:'fixture-one',publisher_ownership_reference:'https://fixture-one.invalid/about',
    identity:{subject_code:'309',language:'English',booklet:'A',key_date_token:'16.05.2024',year:2024},
    copies:[{url:'https://fixture-two.invalid/paper',publisher_group:'fixture-two',publisher_ownership_reference:'https://fixture-two.invalid/about',file:'second.txt',extraction_file:'second.txt',identity_sha256:second,extraction_sha256:second,extraction_checked:true}],
    catalog:{url:'https://www.ndl.gov.in/software-fixture',file:'catalog.txt',identity_sha256:catalog,quote:'CUET 2024 Economics paper',subject_quote:'Economics'},
    paper_identity_quotes:['309 E/A','309 E/A'],question_count:20,questions};
  const paper={kind:'paper',year:2024,url:'https://fixture-one.invalid/paper',file:'primary.txt',extraction_file:'primary.txt',identity_sha256:sha,extraction_sha256:sha,extraction_checked:true,authentication};
  const helpers={localFile:(root,name)=>join(root,name),fileHash:path=>createHash('sha256').update(readFileSync(path)).digest('hex'),subject:'economics'};
  assert.equal(corroboratePaper(paper,helpers,root),authentication);
  assert.throws(()=>corroboratePaper({...paper,authentication:{...authentication,copies:[{...authentication.copies[0],publisher_group:'fixture-one'}]}},helpers,root),/independent_mirror/);
  assert.throws(()=>corroboratePaper({...paper,url:'https://prepp.in/paper',authentication:{...authentication,copies:[{...authentication.copies[0],url:'https://zollege.in/paper'}]}},helpers,root),/independent_mirror/);
  assert.throws(()=>corroboratePaper({...paper,authentication:{...authentication,questions:questions.slice(1)}},helpers,root),/complete_numbered/);
  assert.throws(()=>corroboratePaper({...paper,authentication:{...authentication,questions:[{...questions[0],options:['Second','First','Third','Fourth']},...questions.slice(1)]}},helpers,root),/option_order/);
  const header='Book : A Book : A Book : B Book : B Book : C Book : C Book : D Book : D';
  const row='1 2 46 3 1 3 46 4 1 4 46 1 1 1 46 2';
  const keyText=`Subject 309 English Date 16.05.2024\n${header}\n${row}`;
  const anchor={...questions[0],official_question_id:'1',key_quote:row,key_format:'omr_section',omr_booklet:'A',key_table_header_quote:header,key_column:0,authentication:{option_order_checked:true,key_context_quote:keyText.split('\n')[0]}};
  matchMirroredAnchor(anchor,paper,{kind:'final_key'},keyText);assert.equal(omrAnswer(anchor,keyText),'2');
  assert.throws(()=>matchMirroredAnchor({...anchor,omr_booklet:'B'},paper,{kind:'final_key'},keyText),/subject_date_booklet/);
  assert.throws(()=>omrAnswer({...anchor,key_column:2},keyText),/exact_omr/);
  assert.equal(omrAnswer({...anchor,official_question_id:'46',key_column:1},keyText),'3');
  const sparse='6 1 6 2 6 3 6 4';
  assert.equal(omrAnswer({...anchor,official_question_id:'6',key_quote:sparse},`${keyText}\n${sparse}`),'1');
  assert.throws(()=>omrAnswer({...anchor,official_question_id:'6',key_quote:sparse,key_column:1},`${keyText}\n${sparse}`),/exact_omr/);
  assert.throws(()=>matchMirroredAnchor(anchor,paper,{kind:'final_key'},keyText.replace('16.05.2024','17.05.2024')),/subject_date_booklet/);
  file('second.txt',text.replace('Second','Changed'));assert.throws(()=>corroboratePaper(paper,helpers,root),/transcript_changed/);
});
test('new ledger uses the owner ceiling but paid calls require historical reconciliation',async()=>{
  const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'factory-new-')),'budget.sqlite'));
  try{assert.equal(ledger.snapshot().limit_micro,50000000);let calls=0;
    const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async()=>{calls++;return Response.json({});}});
    await assert.rejects(transport.generate('openai',body,{batch:false}),/historical/);assert.equal(calls,0);
  }finally{ledger.close();}
});
test('Responses reserves tools and all reasoning usage; missing usage retains its full bounded hold',async()=>{
  const {ledger}=ledgerFixture();let payload={usage:{input_tokens:20,output_tokens:30},output:[{type:'web_search_call'}]},calls=0;
  const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async()=>{calls++;return Response.json(payload);}});
  try{
    await transport.generate('openai',{...body,tools:[{type:'web_search'}],max_tool_calls:1},{batch:false,toolCalls:1,key:'search'});
    assert.equal(ledger.snapshot().committed_micro,10017);
    payload={};await assert.rejects(transport.generate('openai',body,{batch:false,key:'missing'}),/usage_unresolved/);
    const committed=ledger.snapshot().committed_micro;assert.equal(ledger.snapshot().unbounded_unresolved,0);
    await assert.rejects(transport.generate('openai',body,{batch:false,key:'missing'}),/do_not_resubmit/);assert.equal(calls,2);
    payload={usage:{input_tokens:20,output_tokens:30}};await transport.generate('openai',body,{batch:false,key:'other'});
    assert.equal(ledger.snapshot().committed_micro,committed+17);assert.equal(ledger.snapshot().unresolved,1);
    await assert.rejects(transport.generate('openai',{...body,tools:[{type:'code_interpreter'}]},{batch:false}),/unbounded/);
  }finally{ledger.close();}
});
test('OpenAI accepted batch survives restart and settles once without another submission',async()=>{
  const {path,ledger}=ledgerFixture();let submissions=0;
  const fetchImpl=async(url,init)=>{
    if(url.endsWith('/files'))return Response.json({id:'file-input'});
    if(url.endsWith('/batches') && init.method==='POST'){submissions++;return Response.json({id:'batch_fixture'});}
    if(url.endsWith('/batches/batch_fixture'))return Response.json({status:'completed',output_file_id:'file-result'});
    if(url.endsWith('/files/file-result/content'))return new Response(JSON.stringify({custom_id:'batch-key',response:{status_code:200,body:{usage:{input_tokens:20,output_tokens:30},output_text:'{"ok":true}'}}}));
    throw new Error('unexpected fixture request');
  };
  const first=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl});
  await assert.rejects(first.generate('openai',body,{key:'batch-key'}),BatchPending);ledger.close();
  const reopened=new BudgetLedger(path);try{
    const second=createFactoryTransport({ledger:reopened,prices:()=>prices,env,fetchImpl});
    await assert.rejects(second.generate('openai',body,{key:'batch-key'}),BatchPending);
    const response=await second.reconcile('batch-key');assert.equal(responseJSON(response).ok,true);
    assert.equal(responseJSON(await second.generate('openai',body,{key:'batch-key'})).ok,true);
    assert.equal(submissions,1);assert.equal(reopened.snapshot().committed_micro,9);
  }finally{reopened.close();}
});
test('Gemini native transport counts thinking tokens and batches only one independent evaluation',async()=>{
  const {ledger}=ledgerFixture();let submissions=0;
  const fetchImpl=async(url,init)=>{
    if(url.endsWith(':batchGenerateContent')){submissions++;const data=JSON.parse(init.body);assert.equal(data.batch.inputConfig.requests.requests.length,1);assert.equal(data.batch.inputConfig.requests.requests[0].request.model,'models/gemini-3.8-flash');return Response.json({name:'batches/gem-fixture'});}
    return Response.json({done:true,response:{inlinedResponses:[{metadata:{key:'gem-key'},response:{usageMetadata:{promptTokenCount:20,candidatesTokenCount:10,thoughtsTokenCount:30},candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}}]}});
  };
  const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl});
  try{await assert.rejects(transport.generate('gemini',{generationConfig:{maxOutputTokens:100},contents:[]},{key:'gem-key'}),BatchPending);
    await transport.reconcile('gem-key');assert.equal(ledger.snapshot().committed_micro,83);assert.equal(submissions,1);
  }finally{ledger.close();}
});
test('unknown batch acceptance is held unresolved and is never resubmitted',async()=>{
  const {ledger}=ledgerFixture();let calls=0;
  const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async()=>{calls++;throw new Error('connection lost');}});
  try{await assert.rejects(transport.generate('openai',body,{key:'unknown'}),/connection lost/);
    await assert.rejects(transport.generate('openai',body,{key:'unknown'}),/submission_unresolved/);assert.equal(calls,1);assert.equal(ledger.snapshot().unresolved,1);
  }finally{ledger.close();}
});
test('process leases prevent two workers using the same ledger',()=>{
  const {ledger,path}=ledgerFixture();try{const a=new FactoryStore(ledger,path),b=new FactoryStore(ledger,path);assert.equal(a.identity,b.identity);a.claim();assert.throws(()=>b.claim(),/already_running/);a.release();assert.equal(b.claim(),true);b.release();}finally{ledger.close();}
});

test('local pilot reconciles accepted batches while missing source gates prevent generation or site access',async()=>{
  const {ledger,path}=ledgerFixture(),store=new FactoryStore(ledger,path);let reconciled=0,reads=0;
  const reservation=ledger.reserve('gpt-6-luna',100);
  ledger.db.prepare("INSERT INTO provider_batches(id,provider,provider_id,reservation_id,state,request_json) VALUES(?,?,?,?,?,?)").run('local-pending','openai','batch_test',reservation,'submitted',JSON.stringify({config:{provider:'openai',stage:'authoring'}}));
  const transport={reconcile:async()=>{reconciled++;},generate:async()=>{throw new Error('must_not_generate');}};
  try {
    store.claim();const result=await localPilotStep({registry:{examples:[],sources:{}},calibration:{},ledger,store,transport,readInventory:async()=>{reads++;return [];}});
    assert.equal(result.blocker,'four_subject_source_coverage_required');assert.equal(result.pilot.target,800);assert.equal(result.pilot.total,0);
    assert.equal(result.production_changes,0);assert.equal(reads,0);assert.equal(reconciled,1);assert.equal(ledger.snapshot().requests,2);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM factory_local_jobs').get().n,0);
  }finally{store.release();ledger.close();}
});

test('local passage quarantine propagates through persisted jobs before any publication',async()=>{
  const {ledger,path}=ledgerFixture(),store=new FactoryStore(ledger,path);
  ledger.db.exec('CREATE TABLE factory_local_jobs(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
  for(const job of [{id:'a',state:'quarantined',passage_group_id:'g',result:{reasons:['wrong_key']}},{id:'b',state:'pilot_eligible',passage_group_id:'g'}])ledger.db.prepare('INSERT INTO factory_local_jobs VALUES(?,?)').run(job.id,JSON.stringify(job));
  try {
    const result=await localPilotStep({registry:{},calibration:{},ledger,store,transport:{reconcile:async()=>{}},readInventory:async()=>[]});
    assert.equal(result.pilot.eligible,0);assert.equal(result.jobs.quarantined,2);assert.equal(result.rejection_reasons.passage_sibling_quarantined,1);
  }finally{ledger.close();}
});
test('a pending repair resumes the same input after restart without acquiring another attempt',async()=>{
  const {ledger,path}=ledgerFixture();const candidate={id:'repair-fixture',source_refs:[],body:'Software fixture',options:['a','b','c','d'],correct_answer:'A',explanation:'Fixture'};
  let firstKey;
  await assert.rejects(repairFactoryCandidate(candidate,['fixture defect'],{registry:{sources:{}},ledger,transport:{generate:async(_provider,_body,options)=>{firstKey=options.key;throw new BatchPending(options.key,'repair');}}}),BatchPending);
  ledger.close();const reopened=new BudgetLedger(path);
  try{const result=await repairFactoryCandidate(candidate,['different caller reasons'],{registry:{sources:{}},ledger:reopened,transport:{generate:async(_provider,_body,options)=>{assert.equal(options.key,firstKey);return {output_text:JSON.stringify({...candidate,correct_answer:'B'})};}}});
    assert.equal(result.correct_answer,'B');assert.equal(reopened.claimRepair(candidate.id),false);
  }finally{reopened.close();}
});
function academicFixture(){
  const text='In this software fixture, the medium of exchange is money.';
  const candidate={id:'candidate',subject:'economics',chapter:'Money & Banking',difficulty:'medium',body:'Which is a medium of exchange?',options:['Money','A rock','A cloud','A tree'],correct_answer:'A',explanation:'Money is a medium of exchange.',family_id:'family',route:'numerical',
    source_refs:[{id:'reference',version:'1',locator:'p1',support_hash:hashJSON(text)}],
    provenance:{kind:'pyq_adapted',anchor_id:'anchor',adaptation_family:'family',adaptation_type:'wording',syllabus_version:'2026-fixture',pattern_version:'fixture',source_pack_id:'pack',source_pack_version:'1'}};
  const registry={version:1,sources:{reference:{state:'active',kind:'reference',version:'1',reuse_permitted:true,identity_sha256:'software-fixture',extraction_checked:true,facts:{p1:{text}},supports:{p1:hashJSON(text)}}},
    families:{family:{state:'active',version:'1'}},packs:{pack:{subject:'economics',state:'active',version:'1'}},exam_specs:{economics:{state:'verified',syllabus_version:'2026-fixture',pattern_version:'fixture',exam_rule_version:'fixture',included_topics:['money'],excluded_topics:[],pattern_rules:['direct recall']}},
    examples:[{id:'anchor',subject:'economics',chapter:'Money & Banking',body:'Software anchor wording',options:['Money','rock','cloud','tree'],correct_answer:'A',source_kind:'authentic_pyq',final_key_matched:true}]};
  return {candidate,registry,text};
}

test('selected evidence is exact source text; unknown IDs cannot acquire evidence',()=>{
  const input={references:[{id:'source',locator:'p4',text:'A verified source. '+ 'Exact words only. '.repeat(90)}],passage:''};
  input.evidence_catalog=evidenceCatalog(input);
  for(const e of input.evidence_catalog)assert.equal(input.references[0].text.slice(e.start,e.end),e.quote);
  const result=resolveEvidence({evidence_ids:[input.evidence_catalog[0].id]},input);
  assert.equal(result.evidence_selection_valid,true);assert.equal(result.supporting_spans[0].source_id,'source');
  const invalid=resolveEvidence({evidence_ids:['invented-key']},input);
  assert.equal(invalid.evidence_selection_valid,false);assert.deepEqual(invalid.supporting_spans,[]);
});

test('paper identity establishes format but cannot be selected as academic truth',()=>{
  const input={references:[{id:'paper',kind:'paper',locator:'q1',text:'A historic question with an ambiguous answer.'},{id:'textbook',kind:'reference',locator:'rule',text:'The supported academic rule.'}],passage:''};
  assert.deepEqual(evidenceCatalog(input).map(e=>e.source_id),['textbook']);
});

test('same-family agreement cannot bypass exact chapter, task or student presentation checks',async()=>{
  for(const defect of ['chapter','entitlement','presentation','task']){
    const {ledger}=ledgerFixture(),{candidate,registry}=academicFixture();let requests=0;
    const transport={generate:async(_provider,body)=>{
      requests++;const input=JSON.parse(body.input[1].content);
      return {output_text:JSON.stringify({candidate_id:input.candidate_id,content_hash:input.content_hash,solved_key:'A',single_defensible_answer:true,missing_assumptions:false,source_support:true,meaningfully_distinct:true,
        syllabus_chapter:defect==='chapter'?'Income Determination':input.chapter,syllabus_topic:'Money function',syllabus_entitlement:defect!=='entitlement',presentation_ready:defect!=='presentation',question_type_match:defect!=='task',defects:[],item_quality_score:10,decisive_principle_in_excerpts:true,answer_conditions:[{condition:'Fixture value',status:'explicit'}],evidence_ids:[input.evidence_catalog[0].id],reasons:[defect]})};
    }};
    try{const result=await verifyCandidate(candidate,{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport}),version:'quality-fixture',secret:'fixture-secret',policy:FACTORY_POLICY});
      assert.equal(result.state,'quarantined');assert.ok(requests<=2,'Luna samples only');
    }finally{ledger.close();}
  }
});

test('a billed truncated response permits one durable completion retry and charges both attempts',async()=>{
  const {ledger}=ledgerFixture();let requests=0;
  const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async(_url,init)=>{
    requests++;const request=JSON.parse(init.body);assert.equal(request.max_output_tokens,requests===1?100:200);
    return Response.json({status:requests===1?'incomplete':'completed',output_text:requests===1?'':JSON.stringify({complete:true}),usage:{input_tokens:20,output_tokens:30}});
  }});
  try{
    const options={batch:false,key:'completion-fixture',stage:'blind_solution'};
    assert.deepEqual(await completeJSON(transport,'openai',{...body,max_output_tokens:100},options),{complete:true});
    const spent=ledger.snapshot().committed_micro;
    assert.deepEqual(await completeJSON(transport,'openai',{...body,max_output_tokens:100},options),{complete:true});
    assert.equal(requests,2);assert.equal(ledger.snapshot().committed_micro,spent);
    assert.equal(ledger.db.prepare("SELECT count(*) n FROM requests WHERE model='gpt-6-luna' AND state='settled'").get().n,2);
  }finally{ledger.close();}
});
test('an explicit calculation cannot bypass numerical checks through author labels',()=>{
  const {candidate,registry}=academicFixture();candidate.route='conceptual';candidate.question_type='direct_concept';
  candidate.body='Calculate the total of ₹400 and ₹200.';candidate.options=['₹600','₹200','₹400','₹800'];
  assert.equal(needsNumericChecks(candidate,registry),true);
  candidate.body='Which monetary function is a store of value?';candidate.options=['Saving','Barter','Transport','Weather'];
  assert.equal(needsNumericChecks(candidate,registry),false);
});

test('only the explanation audit receives authenticated original key provenance',async()=>{
  const {ledger}=ledgerFixture(),{candidate,registry}=academicFixture();let audits=0,blind=0;
  const anchor=registry.examples[0];anchor.final_key_source_id='final-key';anchor.key_locator='q1';anchor.key_quote='1 1';anchor.official_question_id='1';
  registry.sources['final-key']={id:'final-key',kind:'final_key',state:'active',extraction_checked:true,url:'https://nta.ac.in/key.pdf',facts:{q1:{text:'1 1'}},supports:{q1:hashJSON('1 1')}};
  const transport={generate:async(provider,body)=>{
    const input=JSON.parse(provider==='openai'?body.input[1].content:body.contents[0].parts[0].text);
    const schema=provider==='openai'?body.text.format.schema:body.generationConfig.responseFormat.text.schema;
    assert.deepEqual(schema.properties.candidate_id.enum,[input.candidate_id]);
    assert.deepEqual(schema.properties.content_hash.enum,[input.content_hash]);
    if(input.proposed_explanation){audits++;assert.equal(input.authenticated_anchor_key.answer,'A');assert.match(input.authenticated_anchor_key.scope,/never establishes the adapted answer/);assert.ok(input.evidence_catalog.some(e=>e.source_id==='final-key'));}
    else{blind++;assert.equal(input.authenticated_anchor_key,undefined);assert.ok(input.evidence_catalog.every(e=>e.source_id!=='final-key'));}
    return {output_text:JSON.stringify({candidate_id:input.candidate_id,content_hash:input.content_hash,solved_key:'A',syllabus_chapter:input.chapter,syllabus_topic:'Fixture topic',syllabus_entitlement:true,presentation_ready:true,question_type_match:true,defects:[],item_quality_score:10,decisive_principle_in_excerpts:true,answer_conditions:[{condition:'Fixture value',status:'explicit'}],claims:[{claim:'Fixture claim',basis:'excerpt'}],passed:true,single_defensible_answer:true,missing_assumptions:false,source_support:true,exam_fit:true,numeric_solution:true,boundary_cases:true,meaningfully_distinct:true,evidence_ids:[input.evidence_catalog[0].id],reasons:[]})};
  }};
  try{const result=await verifyCandidate(candidate,{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport}),version:'fixture',secret:'fixture-secret',policy:FACTORY_POLICY});assert.equal(result.state,'eligible',JSON.stringify(result.reasons));assert.equal(blind,2);assert.equal(audits,1);}finally{ledger.close();}
});
test('LLM policy uses one Gemini call, checks numeric boundaries, hides keys and invalidates provenance edits',async()=>{
  const {ledger}=ledgerFixture(),{candidate,registry,text}=academicFixture();let luna=0,gemini=0,audit=0;
  const transport={generate:async(provider,request)=>{
    const input=JSON.parse(provider==='openai'?request.input[1].content:request.contents[0].parts[0].text);
    assert.equal(input.correct_answer,undefined);assert.equal(input.explanation,undefined);assert.equal(input.examples[0].correct_answer,undefined);
    if(provider==='gemini')gemini++;else if(input.proposed_explanation)audit++;else luna++;
    const result={candidate_id:input.candidate_id,content_hash:input.content_hash,solved_key:'A',syllabus_chapter:input.chapter,syllabus_topic:'Fixture topic',syllabus_entitlement:true,presentation_ready:true,question_type_match:true,defects:[],item_quality_score:10,decisive_principle_in_excerpts:true,answer_conditions:[{condition:'Fixture value',status:'explicit'}],claims:[{claim:'Fixture claim',basis:'excerpt'}],passed:true,single_defensible_answer:true,missing_assumptions:false,source_support:true,exam_fit:true,numeric_solution:true,boundary_cases:true,passage_integrity:true,passage_answerability:true,meaningfully_distinct:true,
      supporting_spans:[{source_id:'reference',locator:'p1',quote:text}],reasons:[]};
    return {output_text:JSON.stringify(result)};
  }};
  try{
    const result=await verifyCandidate(candidate,{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport}),version:'fixture-v2',secret:'fixture-secret',policy:FACTORY_POLICY});
    assert.equal(result.state,'eligible');assert.deepEqual([luna,gemini,audit],[1,1,1]);
    assert.equal(result.question.evidence.record.checks.independent_solver,undefined);
    assert.equal(result.question.evidence.record.checks.numeric_solution.provider,'openai');
    const changed={...result.question,provenance:{...candidate.provenance,kind:'authentic_pyq'}};
    assert.equal(evaluateEvidence(changed,{...registry,secret:'fixture-secret'}).eligible,false);
  }finally{ledger.close();}
});
test('screening omission stays incomplete; a changed key cannot reuse a clean legacy receipt',()=>{
  const {candidate}=academicFixture(),row={...candidate,status:'live'};delete row.provenance;
  const local=mechanicalScreen([row]),bundle=reviewBundles([row],local,{includeAll:true})[0];
  const imported=importSubscriptionReview(bundle,{bundle_id:bundle.id,findings:[]},[row],local);assert.equal(imported[0].verdict,'incomplete');
  const clean={...row,legacy_screening:local[0]};assert.equal(screeningMatches(clean),true);assert.equal(legacyPracticeVisible(clean),true);
  assert.equal(legacyPracticeVisible({...clean,correct_answer:'B'}),false);assert.equal(legacyPracticeVisible({...clean,evidence:{}}),false);
  assert.throws(()=>importSubscriptionReview(bundle,{bundle_id:bundle.id,findings:[{question_id:row.id,content_hash:'wrong',verdict:'no_issue_found',reason:'Fixture'}]},[row],local),/hash_mismatch/);
  assert.equal(inventoryFingerprint(row),inventoryFingerprint({...row,options:[...row.options].reverse()}));
});

test('numerical questions inside passages retain numerical and boundary checks',async()=>{
  const {ledger}=ledgerFixture(),{candidate,registry,text}=academicFixture();
  candidate.route='passage';candidate.passage_text='Software case with complete context.';candidate.question_type='case_application';
  registry.examples[0].question_type='numerical_one_step';
  const transport={generate:async(_provider,request)=>{const input=JSON.parse(request.input[1].content);return {output_text:JSON.stringify({candidate_id:input.candidate_id,content_hash:input.content_hash,solved_key:'A',syllabus_chapter:input.chapter,syllabus_topic:'Fixture topic',syllabus_entitlement:true,presentation_ready:true,question_type_match:true,defects:[],item_quality_score:10,decisive_principle_in_excerpts:true,answer_conditions:[{condition:'Fixture value',status:'explicit'}],single_defensible_answer:true,missing_assumptions:false,source_support:true,numeric_solution:false,boundary_cases:false,meaningfully_distinct:true,supporting_spans:[{source_id:'reference',locator:'p1',quote:text}],reasons:['Software numeric failure']})};}};
  try{const result=await verifyCandidate(candidate,{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport}),version:'fixture',secret:'fixture-secret',policy:FACTORY_POLICY});assert.equal(result.state,'quarantined');assert.deepEqual(result.reasons,['failed:numeric_solution']);}finally{ledger.close();}
});

test('abstention and nonverbatim academic quotes quarantine the item without stopping its batch',async()=>{
  for(const mode of ['abstain','abridged']) {
    const {ledger}=ledgerFixture(),{candidate,registry}=academicFixture();
    try {
      const transport={generate:async(_provider,request)=>{
        const input=JSON.parse(request.input[1].content);
        return {output_text:JSON.stringify({candidate_id:input.candidate_id,content_hash:input.content_hash,
          solved_key:mode==='abstain'?'abstain':'A',single_defensible_answer:true,missing_assumptions:false,
          source_support:true,numeric_solution:true,boundary_cases:true,meaningfully_distinct:true,
          supporting_spans:mode==='abstain'?[]:[{source_id:'reference',locator:'p1',quote:'In this...money.'}],reasons:[]})};
      }};
      const result=await verifyCandidate(candidate,{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport}),version:'fixture-v2',secret:'fixture-secret',policy:FACTORY_POLICY});
      assert.equal(result.state,'quarantined');assert.match(result.reasons[0],/failed:source_support/);
    }finally{ledger.close();}
  }
});
test('subscription environment strips API credentials and provider overrides',()=>{
  const env=subscriptionEnvironment({PATH:'fixture',OPENAI_API_KEY:'secret',ANTHROPIC_API_KEY:'secret',SUPABASE_SERVICE_ROLE_KEY:'secret',CUET_VERIFIER_MODEL:'bad',AZURE_OPENAI_ENDPOINT:'bad',OPENAI_BASE_URL:'bad'});
  assert.equal(env.PATH,'fixture');assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.ANTHROPIC_API_KEY,undefined);assert.equal(env.OPENAI_BASE_URL,undefined);
});
test('verified evidence precedence survives usage ranking and family caps',()=>{
  const mode={id:'quick',difficulty:{easy:0,medium:1,hard:0},maxPerConcept:10};
  const rows=[{id:'legacy',selection_evidence_tier:1,created_at:'2099-01-01',difficulty:'medium'},
    {id:'new',selection_evidence_tier:2,created_at:'2026-01-01',family_id:'f',difficulty:'medium'},
    {id:'nearclone',selection_evidence_tier:2,created_at:'2025-01-01',family_id:'f',difficulty:'medium'}];
  const ranked=rankCandidates(rows,{mode,progress:new Map([['new',{attempt_count:4}]])});assert.equal(ranked[0].id,'nearclone');assert.equal(ranked[1].id,'new');
  assert.deepEqual(pickWithConstraints(ranked,3,mode).map(r=>r.id),['nearclone','legacy']);
});
test('source registration refuses missing paper/key authentication and permission',()=>{
  const root=mkdtempSync(join(tmpdir(),'factory-source-'));
  writeFileSync(join(root,'doc.txt'),'software fixture');
  assert.throws(()=>registerSourcePack({subject:'economics',id:'p',version:'1',documents:[{id:'doc',file:'doc.txt',extraction_file:'doc.txt'}],anchors:[{}]},root,{version:1,sources:{},families:{}}),/identity_extraction_permission/);
});
test('migration dry run protects RLS, permanent worker binding, idempotent publication and stale screening',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table questions(id text primary key,body text,options jsonb,correct_answer text,explanation text,subject text,chapter text,family_id text,concept_id text,passage_text text,status text,verification_state text,exploration_state text,evidence jsonb,updated_at timestamptz,passage_group_id text);
      create table passage_groups(id text primary key,subject text,chapter text,passage_text text,title text,passage_type text,status text,discoverable boolean,source text);
      insert into questions(id,body,options,correct_answer,explanation,subject,chapter,status,verification_state,exploration_state,updated_at) values('legacy','Question','["a","b","c","d"]','A','Reason','economics','Money & Banking','live','verified','active',now());`);
    await db.exec(readFileSync(new URL('../../../supabase/migrations/20261005185759_question_factory.sql',import.meta.url),'utf8'));
    assert.equal((await db.query('select pilot_target from question_factory_control')).rows[0].pilot_target,800);
    await assert.rejects(db.exec('update question_factory_control set pilot_target=101'),/check constraint/);
    assert.equal((await db.query("select claim_question_factory('first') as claimed")).rows[0].claimed,true);
    assert.equal((await db.query("select claim_question_factory('other') as claimed")).rows[0].claimed,false);
    await db.exec("update question_factory_control set lease_until=now()-interval '1 minute'");
    assert.equal((await db.query("select claim_question_factory('other') as claimed")).rows[0].claimed,false);
    const expected=(await db.query("select to_jsonb(q) as value from questions q where id='legacy'")).rows[0].value;
    const receipt={question_id:'legacy',review_version:'subscription-screen-v1',verdict:'no_issue_found'};
    await db.query('select apply_factory_screening($1,$2,$3)',['legacy',expected,receipt]);
    await db.exec("update questions set correct_answer='B' where id='legacy'");
    await assert.rejects(db.query('select apply_factory_screening($1,$2,$3)',['legacy',expected,receipt]),/snapshot stale/);
    await db.query('select record_question_dispute($1,$2,$3,$4)',['dispute','legacy','version-hash',{source:'fixture'}]);
    assert.equal((await db.query("select verification_state from questions where id='legacy'")).rows[0].verification_state,'disputed');
    const row={id:'new',subject:'economics',chapter:'Money & Banking',family_id:'f',status:'live',verification_state:'verified',provenance:{kind:'pyq_adapted'},evidence:{signature:'software-only',record:{state:'published',policy_version:FACTORY_POLICY}}};
    await db.exec("insert into question_factory_jobs(id,subject,chapter,anchor_id,kind) values('new','economics','Money & Banking','fixture','pyq_adapted')");
    await assert.rejects(db.query('select publish_factory_question($1,$2,$3)',[row,'fp','new']),/paused/);
    await db.exec("update question_factory_control set paused=false,publication_enabled=true,phase='1000'");
    await db.query('select publish_factory_question($1,$2,$3)',[row,'fp','new']);await db.query('select publish_factory_question($1,$2,$3)',[row,'fp','new']);
    assert.equal((await db.query('select count(*)::int as n from question_factory_publications')).rows[0].n,1);
    await db.exec("insert into question_factory_jobs(id,subject,chapter,anchor_id,kind,passage_group_id) values('child-a','english','Reading Comprehension','a','authentic_pyq','group'),('child-b','english','Reading Comprehension','b','authentic_pyq','group')");
    const group={id:'group',subject:'english',chapter:'Reading Comprehension',passage_text:'Software passage.'};
    const children=['child-a','child-b'].map(id=>({...row,id,subject:'english',chapter:'Reading Comprehension',passage_text:group.passage_text,passage_group_id:group.id}));
    await assert.rejects(db.query('select publish_factory_question($1,$2,$3)',[children[0],'child-fp-a','child-a']),/complete passage/);
    await assert.rejects(db.query('select publish_factory_passage_group($1,$2,$3,$4)',[group,children,['fp','child-fp-b'],['child-a','child-b']]),/unique constraint/);
    assert.equal((await db.query("select count(*)::int as n from passage_groups where id='group'")).rows[0].n,0);
    assert.equal((await db.query("select count(*)::int as n from questions where id='child-a'")).rows[0].n,0);
    await db.query('select publish_factory_passage_group($1,$2,$3,$4)',[group,children,['child-fp-a','child-fp-b'],['child-a','child-b']]);
    await db.query('select publish_factory_passage_group($1,$2,$3,$4)',[group,children,['child-fp-a','child-fp-b'],['child-a','child-b']]);
    assert.equal((await db.query('select count(*)::int as n from question_factory_publications')).rows[0].n,3);
    const linked=(await db.query("select to_jsonb(q) as value from questions q where id='child-a'")).rows[0].value;
    await db.exec("update questions set evidence=null,provenance=null,passage_text=null where id='child-a'");
    linked.evidence=null;linked.provenance=null;linked.passage_text=group.passage_text;
    await db.query('select apply_factory_screening($1,$2,$3)',['child-a',linked,{...receipt,question_id:'child-a'}]);
    await db.exec("update passage_groups set passage_text='Changed passage' where id='group'");
    await assert.rejects(db.query('select apply_factory_screening($1,$2,$3)',['child-a',linked,{...receipt,question_id:'child-a'}]),/snapshot stale/);
    await db.exec('set role authenticated');await assert.rejects(db.query('select * from question_factory_jobs'),/permission denied/);
    await assert.rejects(db.query("select claim_question_factory('other')"),/permission denied/);
  } finally {await db.close();}
});

test('subscription guard refuses API login, purchased or unknown credits and exhausted included limits',()=>{
  const status={account:{type:'chatgpt'},rateLimits:{primary:{usedPercent:30},secondary:{usedPercent:20},credits:{hasCredits:false,unlimited:false,balance:'0'}}};
  assert.equal(assertIncludedSubscription(status).paid_credits,0);
  assert.throws(()=>assertIncludedSubscription({...status,account:{type:'apiKey'}}),/subscription_login/);
  assert.throws(()=>assertIncludedSubscription({...status,rateLimits:{...status.rateLimits,credits:null}}),/credit_isolation/);
  assert.throws(()=>assertIncludedSubscription({...status,rateLimits:{...status.rateLimits,credits:{hasCredits:true,unlimited:false,balance:'5'}}}),/credit_isolation/);
  assert.throws(()=>assertIncludedSubscription({...status,rateLimits:{...status.rateLimits,primary:{usedPercent:100}}}),/limit_pause/);
});

test('terminal batch record mismatch retains its bound and cannot trigger a duplicate submission',async()=>{
  const {ledger}=ledgerFixture();let submits=0;
  const fetchImpl=async(url,init)=>{
    if(url.endsWith('/files'))return Response.json({id:'file-input'});
    if(url.endsWith('/batches') && init.method==='POST'){submits++;return Response.json({id:'batch_mismatch'});}
    if(url.endsWith('/batches/batch_mismatch'))return Response.json({status:'completed',output_file_id:'file-result'});
    return new Response(JSON.stringify({custom_id:'other-candidate',response:{status_code:200,body:{usage:{input_tokens:1,output_tokens:1}}}}));
  };
  const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl});
  try{await assert.rejects(transport.generate('openai',body,{key:'mismatch'}),BatchPending);
    await assert.rejects(transport.reconcile('mismatch'),/record_mismatch/);assert.equal(ledger.snapshot().unresolved,1);
    assert.equal(ledger.snapshot().unbounded_unresolved,0);const committed=ledger.snapshot().committed_micro;
    await assert.rejects(transport.generate('openai',body,{key:'mismatch'}),/batch_submission_unresolved/);assert.equal(submits,1);
    await assert.rejects(transport.generate('openai',body,{key:'other'}),BatchPending);assert.equal(submits,2);assert.ok(ledger.snapshot().committed_micro>committed);
  }finally{ledger.close();}
});

test('uncertain accepted batch can be attached only after provider identity matches the saved file',async()=>{
  const {ledger}=ledgerFixture();let accepted=false;
  const fetchImpl=async(url,init)=>{
    if(url.endsWith('/files'))return Response.json({id:'file-input'});
    if(url.endsWith('/batches') && init.method==='POST')throw new Error('Lost after submission');
    if(url.endsWith('/batches/batch_recovered'))return Response.json({status:'completed',input_file_id:accepted?'file-input':'file-other',metadata:{factory_key:'recover'},output_file_id:'file-result'});
    return new Response(JSON.stringify({custom_id:'recover',response:{status_code:200,body:{usage:{input_tokens:10,output_tokens:10},output_text:'{"ok":true}'}}}));
  };
  const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl});
  try{await assert.rejects(transport.generate('openai',body,{key:'recover'}),/Lost/);
    await assert.rejects(transport.attachAcceptedBatch('recover','batch_recovered'),/identity_mismatch/);
    accepted=true;assert.equal(responseJSON(await transport.attachAcceptedBatch('recover','batch_recovered')).ok,true);assert.equal(ledger.snapshot().unresolved,0);
  }finally{ledger.close();}
});

test('budget exhaustion stops before dispatch and retired models cannot route through the factory',async()=>{
  const {ledger}=ledgerFixture();let calls=0;
  const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async()=>{calls++;return Response.json({});}});
  try{ledger.reserve('fixture',50000000);await assert.rejects(transport.generate('openai',body,{batch:false}),/budget_exhausted/);
    await assert.rejects(transport.generate('openai',{...body,model:'claude-sonnet'},{batch:false}),/pricing/);assert.equal(calls,0);
  }finally{ledger.close();}
});

test('new factory queues originals first, balances backed chapters and never splits passage groups',()=>{
  const subjects=['english','accountancy','business_studies','economics'];
  const examples=subjects.flatMap(subject=>[0,1,2].map(i=>({id:`${subject}-${i}`,subject,chapter:i===2?'Second':'First',body:`${subject} stem ${i}`,options:['A','B','C','D'],correct_answer:'A',source_pack_id:subject,final_key_matched:true})));
  examples[0].passage_group_id='paper-group';examples[1].passage_group_id='paper-group';
  const registry={examples,packs:Object.fromEntries(subjects.map(s=>[s,{state:'active'}])),passage_groups:{'paper-group':{state:'active',anchor_ids:[examples[0].id,examples[1].id]}}};
  const jobs=planFactoryJobs(registry,[],[],{phase:'pilot'});assert.equal(jobs.length,800);
  for(const subject of subjects)assert.equal(jobs.filter(j=>j.subject===subject).length,200);
  assert.equal(planFactoryJobs(registry,[],[],{phase:'pilot',pilotTarget:200}).length,200);
  assert.throws(()=>planFactoryJobs(registry,[],[],{phase:'pilot',pilotTarget:101}),/balanced_pilot/);
  const groups=[...new Set(jobs.filter(j=>j.passage_group_id).map(j=>j.passage_group_id))];
  for(const group of groups)assert.equal(jobs.filter(j=>j.passage_group_id===group).length,2);
  assert.equal(jobs.filter(j=>j.kind==='authentic_pyq').length,12);
  const next=planFactoryJobs(registry,jobs.map(j=>({...j,state:'published'})),[],{phase:'1000',perSubject:1});
  assert.ok(next.every(j=>j.kind==='pyq_adapted'));assert.ok(next.every(j=>!j.passage_group_id));
});

test('passage publication requires every authenticated child and identical passage content',()=>{
  const registry={examples:[{id:'a',passage_group_id:'source-group'},{id:'b',passage_group_id:'source-group'}],passage_groups:{'source-group':{state:'active',anchor_ids:['a','b']}}};
  const rows=['a','b'].map((id,i)=>({id,subject:'english',chapter:'Reading Comprehension',passage_group_id:'new-group',passage_text:'Software passage.',order_index:i,provenance:{anchor_id:id}}));
  assert.equal(factoryPassageGroup(rows,registry).id,'new-group');
  assert.throws(()=>factoryPassageGroup(rows.slice(0,1),registry),/complete_passage/);
  assert.throws(()=>factoryPassageGroup([rows[0],{...rows[1],passage_text:'Changed'}],registry),/complete_passage/);
});

test('passage authoring attaches the authenticated stimulus locally without quoted schema literals',async()=>{
  const text='Software source text that establishes the key',passage='A manager said "quality" matters.';
  const anchor={id:'anchor',subject:'business_studies',chapter:'Marketing',source_pack_id:'pack',source_pack_version:1,final_key_matched:true,correct_answer:'A',body:'Software stem',options:['a','b','c','d'],passage_text:passage,order_index:1,source_refs:[{id:'ref',locator:'p1',version:1,support_hash:hashJSON(text)}]};
  const registry={examples:[anchor],packs:{pack:{state:'active'}},sources:{ref:{state:'active',reuse_permitted:true,identity_sha256:'fixture',extraction_checked:true,version:1,facts:{p1:{text}},supports:{p1:hashJSON(text)}}},exam_specs:{business_studies:{state:'verified',included_topics:['Marketing'],excluded_topics:[],pattern_rules:['Software pattern']}}};
  const transport={generate:async(_provider,body)=>{
    assert.deepEqual(body.text.format.schema.properties.passage_text.enum,['']);
    return {output_text:JSON.stringify({body:'Software adapted stem',options:['a','b','c','d'],correct_answer:'A',explanation:'Software explanation',route:'passage',passage_text:'',difficulty:'easy',evidence_quotes:['Software source text that establishes the key'],stated_assumptions:[],option_analysis:['a','b','c','d']})};
  }};
  const candidate=await authorCandidate({id:'job',subject:anchor.subject,chapter:anchor.chapter,anchor_id:anchor.id,kind:'pyq_adapted',passage_group_id:'group'},{registry,transport});
  assert.equal(candidate.passage_text,passage);assert.equal(candidate.order_index,1);
});

test('repairing an authenticated original can change only its explanation',async()=>{
  const candidate={id:'original',body:'Immutable original stem',options:['a','b','c','d'],correct_answer:'A',passage_text:'Immutable passage',explanation:'Unsupported claim',source_refs:[],provenance:{kind:'authentic_pyq'}};
  const repaired=await repairFactoryCandidate(candidate,['failed:explanation_support'],{registry:{},ledger:{getCache:()=>null,claimRepair:()=>true,setCache:()=>{}},transport:{generate:async()=>({output_text:JSON.stringify({explanation:'Supported reasoning',abstain:false,body:'Attempted replacement',correct_answer:'B'})})}});
  assert.deepEqual({...repaired,explanation:candidate.explanation},candidate);assert.equal(repaired.explanation,'Supported reasoning');
});

test('new repairs reserve reasoning headroom and constrain keys, routes and immutable passage groups',async()=>{
  const candidate={id:'adapted',body:'Software stem',options:['a','b','c','d'],correct_answer:'A',explanation:'Software explanation',source_refs:[],passage_group_id:'group',passage_text:'Immutable stimulus',provenance:{kind:'pyq_adapted'}};
  const repaired=await repairFactoryCandidate(candidate,['failed:source_support'],{registry:{},ledger:{getCache:()=>null,claimRepair:()=>true,setCache:()=>{}},transport:{generate:async(_p,body)=>{
    assert.equal(body.max_output_tokens,9000);assert.equal(body.text.format.strict,true);
    assert.deepEqual(body.text.format.schema.properties.correct_answer.enum,['A','B','C','D']);assert.deepEqual(body.text.format.schema.properties.route.enum,['passage']);
    return {output_text:JSON.stringify({...candidate,body:'Repaired stem',passage_text:'',abstain:false,route:'passage'})};
  }}});
  assert.equal(repaired.passage_text,candidate.passage_text);assert.equal(repaired.body,'Repaired stem');
});

test('calibration measures blind answers independently of survival and fails closed on empty or claimed releases',()=>{
  const accuracy=calibrationAccuracy([{expected_valid:true,official_key:'A',luna:'A',gemini:'B'},{expected_valid:true,official_key:'B',luna:'B',gemini:'B'},{expected_valid:false,official_key:'A',luna:'A',gemini:'A'}]);
  assert.deepEqual(accuracy,{sample_size:2,luna:1,gemini:.5,luna_answered:1,gemini_answered:.5,luna_abstention:0,gemini_abstention:0});
  // An abstention lowers raw accuracy but is not a wrong key.
  assert.deepEqual(calibrationAccuracy([{expected_valid:true,official_key:'A',luna:'abstain',gemini:'A'},{expected_valid:true,official_key:'B',luna:'B',gemini:'B'}]),{sample_size:2,luna:.5,gemini:1,luna_answered:1,gemini_answered:1,luna_abstention:.5,gemini_abstention:0});
  assert.equal(factoryCalibrationReady({state:'released'}, {version:1},'fixture'),false);
  const route={released:true,independent:true,split_disjoint:true,verifier_version:'fixture',source_registry_version:1,valid_sample_size:1,valid_survival:1,critical_false_accepts:0,missing_categories:[],blind_answer_accuracy:{sample_size:1,luna:1,gemini:1,luna_answered:1,gemini_answered:1}};
  const manifest={state:'released',version:FACTORY_POLICY,source_registry_version:1,verifier_version:'fixture',critical_false_accepts:0,missing_categories:[],routes:Object.fromEntries(['conceptual','numerical','passage'].map(r=>[r,route])),by_subject:Object.fromEntries(['english','accountancy','business_studies','economics'].map(s=>[s,{sample_size:1,luna:1,gemini:1,luna_answered:1,gemini_answered:1}])),
    release_policy:CALIBRATION_RELEASE,valid_survival:.9,abstention:{luna:0,gemini:0}};
  assert.equal(factoryCalibrationReady(manifest,{version:1},'fixture'),false);
  manifest.quality_regression={verifier_version:'fixture',source_registry_version:1,sample_size:18,false_accepts:3};
  assert.equal(factoryCalibrationReady(manifest,{version:1},'fixture'),false);
  manifest.quality_regression.false_accepts=0;
  assert.equal(factoryCalibrationReady(manifest,{version:1},'fixture'),false);
  manifest.benchmark={protocol:'frozen-unobserved-cuET-v1',unseen_at_freeze:true,state:'completed',payload_hash:'a'.repeat(64),registry_version:1,verifier_version:'fixture'};
  assert.equal(factoryCalibrationReady(manifest,{version:1},'fixture'),true);
  assert.equal(factoryCalibrationReady({...manifest,benchmark:{...manifest.benchmark,unseen_at_freeze:false}},{version:1},'fixture'),false);
  assert.equal(factoryCalibrationReady({...manifest,quality_regression:{...manifest.quality_regression,verifier_version:'old'}},{version:1},'fixture'),false);
  assert.equal(factoryCalibrationReady({...manifest,quality_regression:{...manifest.quality_regression,source_registry_version:0}},{version:1},'fixture'),false);
  // Strict-quality floors: a single-item route must survive; frequent abstention or overall false rejection blocks release.
  assert.equal(factoryCalibrationReady({...manifest,valid_survival:.8},{version:1},'fixture'),false);
  assert.equal(factoryCalibrationReady({...manifest,abstention:{luna:.2,gemini:0}},{version:1},'fixture'),false);
  assert.equal(factoryCalibrationReady({...manifest,routes:{...manifest.routes,numerical:{...route,valid_survival:0}}},{version:1},'fixture'),false);
  assert.equal(factoryCalibrationReady({...manifest,release_policy:{policy:'legacy'}},{version:1},'fixture'),false);
  assert.throws(()=>validateCalibrationManifest({development:[],held_out:[]},{}),/independently_keyed/);
});

test('authenticated calibration splits bind real items and reserve whole passage units',()=>{
  const subjects=['english','accountancy','business_studies','economics'];
  const chapters={english:'Vocabulary',accountancy:'Share Capital',business_studies:'Planning',economics:'Money & Banking'};
  const examples=subjects.flatMap(subject=>['dev','held'].map(split=>({id:`${subject}-${split}`,subject,chapter:chapters[subject],explanation:'Software fixture explanation',route:'conceptual',body:`Software ${subject} ${split}`,options:['a','b','c','d'],correct_answer:'A',source_id:`paper-${subject}`,key_locator:'p1',final_key_matched:true,family_id:`${subject}-${split}`})));
  const fixture=(a,split)=>({id:`fixture-${a.id}`,split,valid:true,question:{...a,id:`question-${a.id}`},provenance:{anchor_id:a.id,source_id:a.source_id,key_locator:a.key_locator,independently_keyed:true,final_answer:'A',source_unit_id:officialCalibrationUnit(a)}});
  const manifest={split_policy:'authenticated_item_and_passage_disjoint_v1',development:examples.filter(a=>a.id.endsWith('dev')).map(a=>fixture(a,'development')),held_out:examples.filter(a=>a.id.endsWith('held')).map(a=>fixture(a,'held_out'))};
  assert.equal(validateCalibrationManifest(manifest,{examples}).length,8);
  const shared=fixture(examples[0],'held_out');shared.id='overlap';shared.question.id='overlap-question';shared.question.family_id='spoofed-family';
  assert.throws(()=>validateCalibrationManifest({...manifest,held_out:[shared,...manifest.held_out.slice(1)]},{examples}),/units_or_families_overlap/);
  const invalid=structuredClone(manifest);invalid.held_out[0].provenance.source_unit_id='invented-unit';
  assert.throws(()=>validateCalibrationManifest(invalid,{examples}),/source_unit_required/);
  assert.equal(officialCalibrationUnit({...examples[0],passage_text:'Shared passage'}),officialCalibrationUnit({...examples[1],passage_text:'Shared passage'}));
  const orphan=structuredClone(manifest);orphan.held_out[0].question.route='passage';
  assert.throws(()=>validateCalibrationManifest(orphan,{examples}),/valid_calibration_structure_required/);
});

test('factory queue cannot consume reserved calibration or unsupported source-only anchors',()=>{
  const subjects=['english','accountancy','business_studies','economics'];
  const examples=subjects.flatMap(subject=>['reserved','available','unsupported'].map(suffix=>({id:`${subject}-${suffix}`,subject,chapter:'fixture',generation_ready:suffix!=='unsupported',final_key_matched:true,correct_answer:'A',source_pack_id:'pack',body:`${subject} ${suffix}`,options:['a','b','c','d']})));
  const registry={examples,packs:{pack:{state:'active'}},calibration_anchor_ids:examples.filter(a=>a.id.endsWith('reserved')).map(a=>a.id)};
  const jobs=planFactoryJobs(registry,[],[],{pilotTarget:4});assert.equal(jobs.length,4);assert.equal(jobs.every(j=>j.anchor_id.endsWith('available')),true);
});

test('pending Luna calibration does not prevent independent Gemini dispatch',async()=>{
  const subjects=['english','accountancy','business_studies','economics'];
  const chapters={english:'Vocabulary',accountancy:'Share Capital',business_studies:'Planning',economics:'Money & Banking'};
  const examples=subjects.flatMap(subject=>['dev','held'].map(split=>({id:`${subject}-${split}`,subject,chapter:chapters[subject],explanation:'Software fixture explanation',body:`Software ${subject} ${split}`,options:['a','b','c','d'],correct_answer:'A',route:'conceptual',source_id:`paper-${subject}`,key_locator:'p1',final_key_matched:true,family_id:`${subject}-${split}`,source_refs:[{id:'reference',version:1,locator:'p1',support_hash:hashJSON('Software source')}] })));
  const fixture=(a,split)=>({id:`fixture-${a.id}`,split,valid:true,question:{...a,id:`question-${a.id}`},provenance:{anchor_id:a.id,source_id:a.source_id,key_locator:a.key_locator,independently_keyed:true,final_answer:'A',source_unit_id:officialCalibrationUnit(a)}});
  const manifest={split_policy:'authenticated_item_and_passage_disjoint_v1',development:examples.filter(a=>a.id.endsWith('dev')).map(a=>fixture(a,'development')),held_out:examples.filter(a=>a.id.endsWith('held')).map(a=>fixture(a,'held_out'))};
  const registry={version:1,examples,sources:{reference:{state:'active',kind:'reference',reuse_permitted:true,identity_sha256:'software-only',extraction_checked:true,version:1,facts:{p1:{text:'Software source'}},supports:{p1:hashJSON('Software source')}}},exam_specs:Object.fromEntries(subjects.map(s=>[s,{state:'verified',included_topics:['software-only'],excluded_topics:[],pattern_version:'software-only'}]))};
  const calls=[];const report=await runFactoryCalibration(manifest,{registry,ledger:{getCache:()=>null},transport:{generate:async(provider,_body,options)=>{calls.push(provider);assert.equal(options.purpose,'calibration');throw new BatchPending(`software-${provider}-${calls.length}`,'calibration');}}});
  assert.equal(report.state,'paused');assert.equal(report.pending.length,16);assert.equal(calls.filter(p=>p==='openai').length,8);assert.equal(calls.filter(p=>p==='gemini').length,8);assert.equal(Object.keys(report.routes).length,0);
});

test('dispute versions normalize public snapshots and change with passage, key and explanation edits',()=>{
  const row={id:'q',subject:'economics',chapter:'Money & Banking',body:'Software question',options:[{key:'A',text:'First'},{key:'B',text:'Second'}],correct_answer:'A',explanation:'Software explanation',family_id:'f',concept_id:'c',passage_text:'Software passage'};
  const snapshot={id:'q',internalSubject:'economics',chapter:row.chapter,question:row.body,options:['First','Second'],correctIndex:0,explanation:row.explanation,familyId:'f',conceptId:'c',passageText:row.passage_text};
  assert.equal(questionContentVersion(row),questionContentVersion(snapshot));
  for(const change of [{correct_answer:'B'},{passage_text:'Changed passage'},{explanation:'Changed explanation'}])assert.notEqual(questionContentVersion(row),questionContentVersion({...row,...change}));
});

test('verified questions fill a difficulty shortage before screened legacy questions',()=>{
  const mode={id:'quick',difficulty:{easy:1,medium:0,hard:0},maxPerConcept:10};
  const rows=[{id:'legacy-easy',selection_evidence_tier:1,difficulty:'easy'},{id:'verified-hard',selection_evidence_tier:3,difficulty:'hard'}];
  const selected=pickWithConstraints(rankCandidates(rows,{mode}),1,mode);assert.equal(selected[0].id,'verified-hard');
});

test('authenticated source pack maps official option IDs to the final-key row and retires superseded evidence',()=>{
  const root=mkdtempSync(join(tmpdir(),'factory-key-map-'));
  const paper='123 Software question? 111 First 222 Second 333 Third 444 Fourth';
  const key='123 222',reference='Software fixture reference: the second option is supported.';
  const documents=[['paper','paper',paper],['key','final_key',key],['ref','reference',reference]].map(([id,kind,text])=>{
    writeFileSync(join(root,`${id}.txt`),text);const sha=createHash('sha256').update(text).digest('hex');
    return {id,kind,year:2026,file:`${id}.txt`,extraction_file:`${id}.txt`,identity_sha256:sha,extraction_sha256:sha,version:'1',extraction_checked:true,url:`https://nta.ac.in/software-fixture-${id}`,reuse_permitted:true,permission:{basis:'Isolated software fixture, not authentic academic data.',reference:'Test only'},facts:[{locator:'p1',text}]};
  });
  const anchor={id:'anchor',official_question_id:'123',source_id:'paper',paper_locator:'p1',final_key_source_id:'key',key_locator:'p1',key_quote:key,
    official_option_ids:['111','222','333','444'],final_key_option_id:'222',body:'Software question?',options:['First','Second','Third','Fourth'],correct_answer:'B',chapter:'Money & Banking',route:'conceptual',question_type:'direct_concept',difficulty:'easy',
    final_key_matched:true,authentication:{independently_matched:true,basis:'Test extraction'},source_refs:[{id:'ref',version:'1',locator:'p1',support_hash:hashJSON(reference)}]};
  const pack={id:'pack',version:'1',subject:'economics',documents,anchors:[anchor],exam_spec:{state:'verified',syllabus_version:'fixture',pattern_version:'fixture',exam_rule_version:'fixture',included_topics:['Money'],excluded_topics:[],pattern_rules:['Test direct recall'],source_refs:[{id:'ref',locator:'p1'}]}};
  const previous={version:1,sources:{old:{source_pack_id:'pack',state:'active'}},families:{old:{source_pack_id:'pack',state:'active'}}};
  const registry=registerSourcePack(pack,root,previous);assert.equal(registry.examples[0].correct_answer,'B');assert.equal(registry.sources.old.state,'retired');assert.equal(registry.families.old.state,'retired');
  assert.throws(()=>registerSourcePack({...pack,anchors:[{...anchor,correct_answer:'A'}]},root,previous),/option_id_key_mapping/);
  assert.throws(()=>registerSourcePack({...pack,anchors:[{...anchor,key_quote:'124 222'}]},root,previous),/authenticated_paper|exact_final_key/);
  assert.throws(()=>registerSourcePack({...pack,documents:documents.map(d=>d.kind==='final_key'?{...d,year:2025}:d)},root,previous),/year_mismatch/);
  const positionKey='123 2';writeFileSync(join(root,'key.txt'),positionKey);
  const positionSha=createHash('sha256').update(positionKey).digest('hex');
  const positionPack={...pack,documents:documents.map(d=>d.id==='key'?{...d,identity_sha256:positionSha,extraction_sha256:positionSha,facts:[{locator:'p1',text:positionKey}]}:d),anchors:[{...anchor,key_quote:positionKey,key_format:'position',authentication:{...anchor.authentication,option_order_checked:true}}]};
  assert.equal(registerSourcePack(positionPack,root,previous).examples[0].correct_answer,'B');
  assert.throws(()=>registerSourcePack({...positionPack,anchors:[{...positionPack.anchors[0],correct_answer:'A'}]},root,previous),/position_key_mapping/);
  assert.throws(()=>registerSourcePack({...positionPack,anchors:[{...positionPack.anchors[0],authentication:{independently_matched:true,basis:'Test'}}]},root,previous),/position_key_mapping/);
  assert.throws(()=>registerSourcePack(positionPack,root,{...previous,sources:{paper:{source_pack_id:'other'}}}),/id_collision/);
});

test('presentation lint rejects markup, unseen references, all/none options and non-bijective matching options',()=>{
  const ok={body:'Match List-I with List-II.\n(A) Authority\n(B) Responsibility',options:['(A)-(I), (B)-(II), (C)-(III), (D)-(IV)','(A)-(II), (B)-(I), (C)-(III), (D)-(IV)','(A)-(III), (B)-(IV), (C)-(I), (D)-(II)','(A)-(IV), (B)-(III), (C)-(II), (D)-(I)']};
  assert.deepEqual(presentationLint(ok),[]);
  assert.ok(presentationLint({...ok,body:'Pick the <u>word</u>'}).includes('html'));
  assert.ok(presentationLint({...ok,body:'According to the chapter, which is true?'}).includes('unseen_reference'));
  assert.ok(presentationLint({body:'Which?',options:['a','b','c','All of the above']}).includes('all_none_of_above'));
  assert.ok(presentationLint({...ok,options:[ok.options[0],ok.options[1],ok.options[2],'(A)-(I), (B)-(I), (C)-(III), (D)-(IV)']}).includes('matching_options_not_distinct_bijections'));
  assert.ok(presentationLint({...ok,options:[ok.options[0],ok.options[1],ok.options[2],ok.options[0]+' ']}).includes('option_collision'));
});

test('author evidence quotes must appear verbatim in non-paper references',()=>{
  const references=[{kind:'reference',text:'Authority refers to the right of an individual to command his subordinates.'},{kind:'paper',text:'Paper text that is never academic support.'}];
  assert.equal(quotesInReferences(['the right of an individual to command his subordinates'],references).length,1);
  assert.equal(quotesInReferences(['the right of a person to command subordinates'],references).length,0);
  assert.equal(quotesInReferences(['Paper text that is never academic support.'],references).length,0);
});

test('chapter mapping accepts units and aliases but not other units',()=>{
  assert.equal(sameSyllabusUnit('accountancy','Partnership Fundamentals','Profit & Loss Appropriation Account'),true);
  assert.equal(sameSyllabusUnit('accountancy','Share Capital','Financial Statements of Company'),false);
  assert.equal(sameChapter('Dissolution of Partnership','Dissolution of Partnership Firm'),true);
  assert.equal(sameChapter('Partnership Fundamentals','Profit & Loss Appropriation Account'),false);
});

test('academic-only calibration receipts and v4 receipts without a positive polish gate cannot be published',async()=>{
  const {ledger}=ledgerFixture(),{candidate,registry,text}=academicFixture();
  const transport={generate:async(provider,request)=>{
    const input=JSON.parse(provider==='openai'?request.input[1].content:request.contents[0].parts[0].text);
    return {output_text:JSON.stringify({candidate_id:input.candidate_id,content_hash:input.content_hash,solved_key:'A',syllabus_chapter:input.chapter,syllabus_topic:'Fixture topic',syllabus_entitlement:true,presentation_ready:false,question_type_match:true,
      defects:['Fixture typo'],item_quality_score:6,decisive_principle_in_excerpts:true,answer_conditions:[],claims:[{claim:'Fixture claim',basis:'excerpt'}],passed:true,single_defensible_answer:true,missing_assumptions:false,source_support:true,exam_fit:true,numeric_solution:true,boundary_cases:true,passage_integrity:true,passage_answerability:true,meaningfully_distinct:true,
      supporting_spans:[{source_id:'reference',locator:'p1',quote:text}],reasons:[]})};
  }};
  try{
    const academic=await verifyCandidate(candidate,{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport,polish:false}),version:'luna-gemini-cuET-v4.9',secret:'fixture-secret',policy:FACTORY_POLICY,academicOnly:true});
    assert.equal(academic.state,'eligible');
    assert.ok(evaluateEvidence(academic.question,{...registry,secret:'fixture-secret'}).reasons.includes('polish_gate_required'));
    const production=await verifyCandidate({...candidate,id:'candidate-2'},{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport}),version:'luna-gemini-cuET-v4.9',secret:'fixture-secret',policy:FACTORY_POLICY});
    assert.equal(production.state,'quarantined');
  }finally{ledger.close();}
});

test('chapter mapping is source-backed: a cited document must cover the tag, and evaluator consensus elsewhere still fails',()=>{
  const sources={leac101:{state:'active',chapters:['Partnership Fundamentals','Profit & Loss Appropriation Account']},leac201:{state:'active',chapters:['Share Capital','Financial Statements of Company']},leac104:{state:'active',chapters:['Dissolution of Partnership Firm','Dissolution of Partnership']}};
  const v=x=>chapterMappingVerdict({subject:'accountancy',sources,...x});
  // One dissent inside the cited document's coverage is harmless.
  assert.equal(v({assigned:'Profit & Loss Appropriation Account',luna:'Profit & Loss Appropriation Account',gemini:'Partnership Fundamentals',cited:['leac101']}).ok,true);
  // Both evaluators agreeing on another chapter fails even inside one unit and one document.
  assert.equal(v({assigned:'Profit & Loss Appropriation Account',luna:'Partnership Fundamentals',gemini:'Partnership Fundamentals',cited:['leac101']}).ok,false);
  // A tag the cited sources do not cover fails even when one evaluator agrees with it.
  assert.equal(v({assigned:'Admission of Partner',luna:'Admission of Partner',gemini:'Partnership Fundamentals',cited:['leac101']}).ok,false);
  // Aliases are harmless.
  assert.equal(v({assigned:'Dissolution of Partnership',luna:'Dissolution of Partnership Firm',gemini:'Dissolution of Partnership Firm',cited:['leac104']}).ok,true);
  // Wrong unit for both views fails.
  assert.equal(v({assigned:'Share Capital',luna:'Financial Statements of Company',gemini:'Accounting Ratios',cited:['leac201']}).ok,false);
  assert.equal(v({assigned:'Share Capital',luna:'Accounting Ratios',gemini:'Cash Flow Statement',cited:[]}).ok,false);
});

test('a different-family check that finds a missing assumption quarantines a Luna pass',async()=>{
  const {ledger}=ledgerFixture(),{candidate,registry,text}=academicFixture();let luna=0,gemini=0;
  const transport={generate:async(provider,request)=>{
    const input=JSON.parse(provider==='openai'?request.input[1].content:request.contents[0].parts[0].text);
    if(provider==='gemini')gemini++;else luna++;
    return {output_text:JSON.stringify({candidate_id:input.candidate_id,content_hash:input.content_hash,solved_key:'A',syllabus_chapter:input.chapter,syllabus_topic:'Fixture topic',syllabus_entitlement:true,presentation_ready:true,question_type_match:true,
      defects:[],item_quality_score:10,decisive_principle_in_excerpts:true,answer_conditions:[{condition:'Fixture value',status:'explicit'}],claims:[{claim:'Fixture claim',basis:'excerpt'}],passed:true,single_defensible_answer:true,missing_assumptions:provider==='gemini',source_support:true,exam_fit:true,numeric_solution:true,boundary_cases:true,passage_integrity:true,passage_answerability:true,meaningfully_distinct:true,
      supporting_spans:[{source_id:'reference',locator:'p1',quote:text}],reasons:[]})};
  }};
  try{
    const result=await verifyCandidate(candidate,{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport}),version:'fixture-dual',secret:'fixture-secret',policy:FACTORY_POLICY});
    assert.equal(result.state,'quarantined');assert.deepEqual([luna,gemini],[1,1]);
    assert.ok(result.reasons.some(d=>/independent_evaluation/.test(d))); 
  }finally{ledger.close();}
});

test('missing answer conditions and an unsourced decisive rule fail; implied decisive assumptions fail and stated conventions pass',()=>{
  assert.equal(conditionsComplete({decisive_principle_in_excerpts:true,answer_conditions:[{condition:'12-month year',status:'convention'},{condition:'Final call unpaid',status:'explicit'}]}),true);
  assert.equal(conditionsComplete({decisive_principle_in_excerpts:true,answer_conditions:[{condition:'Other calls were paid',status:'implied'}]}),false);
  assert.equal(conditionsComplete({decisive_principle_in_excerpts:true,answer_conditions:[{condition:'Premium received',status:'missing'}]}),false);
  assert.equal(conditionsComplete({decisive_principle_in_excerpts:false,answer_conditions:[]}),false);
});

test('lint rejects self-labelled options, definition-phrase vocabulary options and unseen lists, but keeps matching and statement options',()=>{
  assert.ok(presentationLint({body:'Find the discount.',options:['(A) ₹400','(B) ₹1,000','(C) ₹600','(D) ₹0']}).includes('option_label_prefix'));
  assert.ok(presentationLint({body:'Choose the SYNONYM for "transient".',question_type:'synonym',options:['continuing for a long time','continuing for only a short time','brief','lasting']}).includes('vocabulary_options_not_words'));
  assert.ok(presentationLint({body:'Which characteristics are explicitly listed under the social environment?',options:['a','b','c','d']}).includes('unseen_reference'));
  assert.deepEqual(presentationLint({body:'Choose the SYNONYM for "candid".',question_type:'synonym',options:['frank','secretive','careful','in use']}),[]);
  assert.deepEqual(presentationLint({body:'Which phrase is closest in meaning to sparse?',question_type:'synonym',options:['Present in small amounts','Growing quickly','Dense','Uniform']}),[]);
  assert.ok(presentationLint({body:'Ex Ante Post Saving describes actual saving.',options:['True','False','Both','Neither']}).includes('undefined_economic_term'));
  assert.deepEqual(presentationLint({body:'Ex ante saving is planned; ex post saving is realised.',options:['a','b','c','d']}),[]);
  assert.deepEqual(presentationLint({body:'Which are correct?',options:['(A), (B) and (C) only','(A) and (D) only','(B), (C) and (D) only','(C) and (D) only']}),[]);
  assert.deepEqual(presentationLint({body:'Match.',options:['(A)-(I), (B)-(II), (C)-(III), (D)-(IV)','(A)-(II), (B)-(I), (C)-(III), (D)-(IV)','(A)-(III), (B)-(IV), (C)-(I), (D)-(II)','(A)-(IV), (B)-(III), (C)-(II), (D)-(I)']}),[]);
});


test('craft 7 through 10 passes while every blocking defect still fails',()=>{
  const r={presentation_ready:true,item_quality_score:10,defects:[],quality_notes:[]};
  assert.equal(itemQualityVerdict(r),true);
  for(const score of [7,8,9])assert.equal(itemQualityVerdict({...r,item_quality_score:score}),true);
  for(const change of [{defects:['Two correct options']},{presentation_ready:false},{item_quality_score:6},{item_quality_score:11},{defects:undefined}])assert.equal(itemQualityVerdict({...r,...change}),false);
});

test('free presentation checks stop a saved defective candidate before any paid adapter',async()=>{
  const {candidate,registry}=academicFixture();let calls=0;
  const result=await verifyCandidate({...candidate,options:['(A) First','(B) Second','(C) Third','(D) Fourth']},{registry,adapters:{source_support:()=>{calls++;throw Error('Must not dispatch');}},version:'fixture',secret:'fixture-secret',policy:FACTORY_POLICY});
  assert.equal(result.state,'quarantined');assert.equal(calls,0);assert.ok(result.reasons.join().includes('option_label_prefix'));
});

test('a saved passing signature cannot bypass a newly detected presentation defect',async()=>{
  const {ledger}=ledgerFixture(),{candidate,registry}=academicFixture();
  try {
    const transport={generate:async(provider,request)=>{const i=JSON.parse(provider==='openai'?request.input[1].content:request.contents[0].parts[0].text);return {output_text:JSON.stringify({candidate_id:i.candidate_id,content_hash:i.content_hash,solved_key:'A',syllabus_chapter:i.chapter,syllabus_topic:'Fixture',syllabus_entitlement:true,presentation_ready:true,question_type_match:true,defects:[],item_quality_score:10,decisive_principle_in_excerpts:true,answer_conditions:[],claims:[{claim:'Fixture',basis:'excerpt'}],passed:true,single_defensible_answer:true,missing_assumptions:false,source_support:true,exam_fit:true,numeric_solution:true,boundary_cases:true,passage_integrity:true,passage_answerability:true,meaningfully_distinct:true,evidence_ids:[i.evidence_catalog[0].id],reasons:[]})};}};
    const ok=await verifyCandidate(candidate,{registry,ledger,adapters:createFactoryEvidence({registry,ledger,transport}),version:'fixture',secret:'fixture-secret',policy:FACTORY_POLICY});
    assert.equal(ok.state,'eligible');
    // The original signature still exists; direct serving must apply the free gate too.
    const bad={...ok.question,body:'Which characteristics are explicitly listed under the social environment?'};
    assert.ok(evaluateEvidence(bad,{...registry,secret:'fixture-secret'}).reasons.includes('unseen_reference'));
  }finally{ledger.close();}
});

test('flattened matching lists restore both columns without changing stored question or key',()=>{
  const body='Match List-I with List-II : List-I List-II (Meaning) (Term) (A) Right to command (I) Answerability (B) Obligation to perform task (II) Delegation (C) Accountability (III) Authority (D) Basis of management hierarchy (IV) Responsibility Choose the correct answer from the options given below :';
  const q={body,correct_answer:'D'},before=contentHash(q),display=formatQuestionText(body);
  assert.ok(display.includes('List-I (Meaning)\n(A) Right to command\n(B) Obligation'));
  assert.ok(display.includes('List-II (Term)\n(I) Answerability\n(II) Delegation'));
  assert.equal(contentHash(q),before);assert.equal(formatQuestionText(display),display);
  assert.equal(formatQuestionText('Assertion (A): True. Reason (R): False.'),'Assertion (A): True. Reason (R): False.');
});

test('three-entry matching choices must also be distinct bijections',()=>{
  const options=['(A)-(II), (B)-(III), (C)-(I)','(A)-(III), (B)-(II), (C)-(I)','(A)-(II), (B)-(I), (C)-(III)','(A)-(I), (B)-(III), (C)-(II)'];
  assert.deepEqual(presentationLint({body:'Match.',options}),[]);
  assert.ok(presentationLint({body:'Match.',options:[...options.slice(0,3),'(A)-(I), (B)-(I), (C)-(II)']}).includes('matching_options_not_distinct_bijections'));
});

test('same skill across different anchor formats cannot inflate a plan',()=>{
  const b={chapter:'Income Determination',assessment_skill:'Ex ante AD = C + I',reasoning_task:'identify',format:'direct_mcq'};
  assert.equal(blueprintSkillKey('economics',b),blueprintSkillKey('economics',{...b,anchor_id:'another',format:'assertion_reason'}));
  assert.notEqual(blueprintSkillKey('economics',b),blueprintSkillKey('economics',{...b,reasoning_task:'calculate'}));
});


test('cache reads and writes are partitioned once and missing write pricing holds usage',async()=>{
  for(const known of [true,false]){
    const {ledger}=ledgerFixture();
    const p={...prices,models:{...prices.models,'gpt-6-luna':{...prices.models['gpt-6-luna'],...(known?{cached_input_per_million:.01,cache_write_per_million:.125}:{})}}};
    const transport=createFactoryTransport({ledger,prices:()=>p,env,fetchImpl:async()=>Response.json({usage:{input_tokens:100,input_tokens_details:{cached_tokens:20,cache_write_tokens:60},output_tokens:10},output_text:'{}'})});
    try{
      if(known){await transport.generate('openai',body,{batch:false});assert.equal(ledger.snapshot().committed_micro,15);}
      else{await assert.rejects(transport.generate('openai',body,{batch:false}),/usage_unresolved/);assert.equal(ledger.snapshot().unresolved,1);}
    }finally{ledger.close();}
  }
});


test('accepted legacy batches reconcile cache-write pricing without a second submission',async()=>{
  const {ledger}=ledgerFixture();let submits=0,upgraded=false;
  const enriched={...prices,models:{...prices.models,'gpt-6-luna':{...prices.models['gpt-6-luna'],batch:{...prices.models['gpt-6-luna'].batch,cached_input_per_million:.005,cache_write_per_million:.0625}}}};
  const transport=createFactoryTransport({ledger,prices:()=>upgraded?enriched:prices,env,fetchImpl:async(url)=>{
    if(url.endsWith('/files'))return Response.json({id:'file-cache-input'});
    if(url.endsWith('/batches')){submits++;return Response.json({id:'batch_cache'});}
    if(url.endsWith('/batches/batch_cache'))return Response.json({status:'completed',output_file_id:'file-cache-output'});
    return new Response(JSON.stringify({custom_id:'legacy-cache',response:{status_code:200,body:{usage:{input_tokens:100,input_tokens_details:{cached_tokens:20,cache_write_tokens:60},output_tokens:10},output_text:'{}'}}})+'\n');
  }});
  try {
    await assert.rejects(transport.generate('openai',body,{key:'legacy-cache'}),BatchPending);
    upgraded=true;await transport.reconcile('legacy-cache');
    assert.equal(submits,1);assert.equal(ledger.snapshot().committed_micro,8);
    const row=ledger.db.prepare("SELECT receipt_json FROM requests WHERE model='gpt-6-luna'").get();
    assert.ok(JSON.parse(row.receipt_json).cache_rate_reconciliation);
  }finally{ledger.close();}
});


test('CUET blanks are plain text while Markdown emphasis and excessive English passage length fail',()=>{
 const q={subject:'english',body:'Choose the correct word: take up ______________ .',options:['a','b','c','d']};
 for(const body of [q.body,'The result is __.','Fill (____) now.'])assert.deepEqual(presentationLint({...q,body}),[]);
 for(const body of ['Choose __this word__.','Choose **this word**.'])assert.ok(presentationLint({...q,body}).includes('markdown'));
 assert.deepEqual(presentationLint({...q,passage_text:Array(300).fill('word').join(' ')}),[]);
 assert.ok(presentationLint({...q,passage_text:Array(301).fill('word').join(' ')}).includes('english_passage_word_limit'));
 assert.deepEqual(presentationLint({...q,subject:'business_studies',passage_text:Array(301).fill('word').join(' ')}),[]);
});

test('cache-only recovery never reserves, dispatches or bypasses saved model identity',async()=>{
 const {ledger}=ledgerFixture();let calls=0;
 const t=createFactoryTransport({ledger,env:{},prices:()=>{throw Error('pricing accessed');},fetchImpl:async()=>{calls++;throw Error('network accessed');}});
 try{
  const before=ledger.snapshot();
  await assert.rejects(t.generate('openai',body,{key:'uncached',cacheOnly:true}),/calibration_cache_miss/);
  ledger.setCache('response:saved',{output_text:'{ "ok": true }'});ledger.setCache('response-model:saved','gpt-6-luna');
  assert.equal(responseJSON(await t.generate('openai',body,{key:'saved',cacheOnly:true})).ok,true);
  ledger.setCache('response-model:saved','other-model');
  await assert.rejects(t.generate('openai',body,{key:'saved',cacheOnly:true}),/response_model_mismatch/);
  assert.deepEqual(ledger.snapshot(),before);assert.equal(calls,0);
 }finally{ledger.close();}
});


test('legacy chapters cannot borrow current CUET syllabus entitlement',()=>{
 const p={kind:'original_practice',syllabus_version:'cuet-2026-provisional-for-2027'};
 assert.ok(provenanceReasons({subject:'economics',chapter:'Infrastructure',provenance:p},{packs:{}}).includes('current_syllabus_chapter_not_entitled'));
 assert.ok(!provenanceReasons({subject:'economics',chapter:'Money & Banking',provenance:p},{packs:{}}).includes('current_syllabus_chapter_not_entitled'));
 assert.ok(!provenanceReasons({subject:'accountancy',chapter:'Dissolution of Partnership',provenance:p},{packs:{}}).includes('current_syllabus_chapter_not_entitled'));
});
