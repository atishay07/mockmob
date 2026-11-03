import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { BudgetLedger } from '../../../../../scripts/pipeline/lib/budgetLedger.mjs';
import { createFactoryEvidenceV77, blindViewV77, TOPOLOGIES } from '../../../../../scripts/pipeline/lib/factoryEvidenceV77.mjs';
import { hashJSON } from '../../../../../data/question_factory_policy.mjs';
import { effortsFor } from '../../../../../data/cuet_fit_evidence.mjs';
import { replayV77CompletedEvaluation } from './recoverV77Receipts.mjs';
import { replayV77Topology } from './recoverV77Receipts.mjs';
import { buildFixtures, applyAdditions } from '../../../../../scripts/pipeline/lib/cuetFitBenchmark.mjs';
import { validateFactoryCandidateV77 } from '../../../../../scripts/pipeline/lib/verifyV77.mjs';
import { appendV77RecoveryHistory, dispatchV77NativeRequest, QUALIFICATION_V77_PREFIX } from '../../../../../scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs';
import { acceptedNativeRequestV73 } from '../../../../../scripts/pipeline/lib/freshCuetReadinessV73Guards.mjs';
import { requestNeedsReservation, maximumRequestMicro, assertCampaignBudget } from '../../../../../scripts/pipeline/lib/campaignExecutionV7.mjs';

const sourceText = 'The supplied excerpt states that the method reduces cost.';
const sourceHash = hashJSON(sourceText);
const candidate = {
  id: 'v77-receipt-replay-fixture', subject: 'business_studies', chapter: 'Principles of Management', family_id: 'v77-replay-family',
  route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'easy', body: 'Which statement follows from the excerpt?',
  options: ['The method reduces cost.', 'The method raises cost.', 'The method leaves cost unchanged.', 'The method doubles cost.'],
  correct_answer: 'B', explanation: 'The excerpt supports B.',
  provenance: { kind: 'original_practice', adaptation_family: 'v77-replay-family', syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', source_pack_id: 'v77-replay-pack', source_pack_version: 1 },
  source_refs: [{ id: 'v77-replay-source', version: 1, locator: 'p1', support_hash: sourceHash }],
  learning_objective: { syllabus_unit: 'Principles of Management', objective: 'Identify the stated principle.', target_term: '' },
};
const registry = {
  examples: [], packs: { 'v77-replay-pack': { state: 'active', version: 1, subject: 'business_studies' } },
  families: { 'v77-replay-family': { state: 'active', version: 1 } },
  exam_specs: { business_studies: { state: 'verified', included_topics: ['Unit I: Nature and Significance of Management'], excluded_topics: [],
    syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', pattern_rules: {}, exam_rule_version: 'test-rule' } },
  sources: { 'v77-replay-source': { state: 'active', reuse_permitted: true, identity_sha256: 'a'.repeat(64), extraction_checked: true,
    version: 1, supports: { p1: sourceHash }, facts: { p1: { text: sourceText } }, chapters: ['Principles of Management'], kind: 'textbook', title: 'Replay fixture', url: 'https://ncert.nic.in/offline-fixture' } },
};
function providerJudgment(input) {
  const quote = input.evidence_catalog[0].quote;
  const matrix = input.options.map(option => ({ option: option.key, exact_option_text: option.text, clauses: [{ clause: option.text,
    status: option.key === 'B' ? 'support' : 'contradiction', decisive_context: quote, rationale: 'The supplied excerpt resolves this option.',
    basis: 'excerpt', contradiction_basis: option.key === 'B' ? 'none' : 'source_contradiction', evidence_ids: ['E1.1'], premises: [quote] }] }));
  const criteria = Object.fromEntries(['syllabus_objective','format_authenticity','level_calibration','discrimination_value'].map(id => [id,{level:3,evidence:'Direct source-based item.'}]));
  return { candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: 'B', single_defensible_answer: true,
    source_support: true, numeric_solution: true, boundary_cases: true, passage_integrity: true, passage_answerability: true, meaningfully_distinct: true,
    evidence_ids: ['E1.1'], reasons: ['Offline fixture.'], syllabus_chapter: input.chapter, syllabus_topic: input.chapter,
    syllabus_entitlement: true, presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true,
    answer_conditions: [], option_challenges: ['A','C','D'].map(option=>({option,strongest_reading:'No defensible alternative.',correct_under_reading:false,reading_status:'strained',convention_evidence_ids:[]})),
    option_resolution_matrix: matrix, blocking_defects: [], style_notes: [],
    cuet_fit: { criteria, reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'recall', exemplar_ids_compared: [] } };
}
function explanationAudit(input) {
  const evidence=input.evidence_catalog[0], matrices=input.option_resolution_matrices;
  return {candidate_id:input.candidate_id,content_hash:input.content_hash,claims:[{claim:'The explanation follows from the stated excerpt.',basis:'excerpt'}],
    passed:true,reasons:[],evidence_ids:[evidence.id],supporting_spans:[{source_id:evidence.source_id,locator:evidence.locator,quote:evidence.quote,...(evidence.start===undefined?{}:{start:evidence.start}),...(evidence.end===undefined?{}:{end:evidence.end})}],
    option_resolution_audits:matrices.flatMap(entry=>entry.matrix.map(row=>{
      const whole=row.clauses.some(clause=>clause.status==='contradiction')?'contradiction':row.clauses.every(clause=>clause.status==='support')?'support':'unresolved';
      return {candidate_id:input.candidate_id,content_hash:input.content_hash,solver:entry.solver,option:row.option,exact_option_text:row.exact_option_text,
        claimed_whole_status:whole,audited_whole_status:whole,whole_claim_audit:'entailed',basis_audit:'excerpt_direct',rationale:'Matches the supplied excerpt.',
        evidence_ids:[evidence.id],premises:[evidence.quote],clauses:row.clauses.map(clause=>({clause:clause.clause,claimed_status:clause.status,audited_status:clause.status,
          claim_audit:clause.status==='unresolved'?'uncertain':'entailed',basis_audit:clause.status==='unresolved'?'source_silence':'excerpt_direct',rationale:'Matches the supplied excerpt.',
          evidence_ids:[evidence.id],premises:[evidence.quote]}))};
    }))};
}
function makeStudyIds() { return { fresh: `${QUALIFICATION_V77_PREFIX}fresh`, regression: `${QUALIFICATION_V77_PREFIX}regression` }; }

test('replays a blind-evaluation error from a complete SQLite receipt without response cache, fetch, or new reservation', async () => {
  const dir = mkdtempSync(join(tmpdir(),'v77-receipt-replay-')), dbPath = join(dir,'budget.sqlite');
  const openPriceFile = '../../../../../data/pipeline-prices.json';
  const prices = JSON.parse((await import('node:fs')).readFileSync(new URL(openPriceFile, import.meta.url),'utf8'));
  const ids = makeStudyIds(), view = blindViewV77(candidate,candidate.source_refs), captured = {};
  const memory = new Map();
  const adapters = createFactoryEvidenceV77({ registry, ledger:{getCache:key=>memory.get(key)||null,setCache:(key,value)=>memory.set(key,value)},
    topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,efforts:effortsFor(candidate),
    transport:{async generate(provider,body,options){captured.provider=provider;captured.body=structuredClone(body);captured.options={...options};
      const raw=provider==='openai'?body.input.find(row=>row.role==='user').content:body.contents.find(row=>row.role==='user').parts[0].text;
      return {output_text:JSON.stringify(providerJudgment(JSON.parse(raw)))};}} });
  // Capture the exact adapted Gemini request shape and parent identity in memory only.
  const expected = await adapters.__evaluation(view,'gemini');
  assert.equal(expected.option_resolution.passed,true);
  const nativeKey=hashJSON({study:`${ids.fresh}:${ids.regression}`,parent:captured.options.key});
  const rawResponse={candidates:[{content:{parts:[{text:JSON.stringify(providerJudgment(JSON.parse(captured.body.contents[0].parts[0].text)))}]},finishReason:'STOP'}],
    usageMetadata:{promptTokenCount:200,candidatesTokenCount:50,thoughtsTokenCount:0}};
  const seed=new BudgetLedger(dbPath),model='gemini-3.8-flash',rate=prices.models[model];
  const output=captured.body.generationConfig.maxOutputTokens;
  const reserved=Math.ceil(rate.max_input_tokens*Math.max(rate.input_per_million,rate.cache_write_per_million||0)+output*rate.output_per_million);
  const reservation=seed.reserve(model,reserved);
  seed.settle(reservation,1_000,{provider:'gemini',model,usage:rawResponse.usageMetadata,stage:'independent_evaluation',purpose:'calibration'});
  const config={provider:'gemini',model,key:nativeKey,reserved,pricing:prices,rates:rate,execution_mode:'realtime',stage:'independent_evaluation',purpose:'calibration',candidate_id:`${QUALIFICATION_V77_PREFIX}${candidate.id}`,toolCalls:0};
  seed.db.prepare("INSERT INTO provider_requests(id,reservation_id,provider,state,request_json,response_json) VALUES(?,?,?,'complete',?,?)")
    .run(nativeKey,reservation,'gemini',JSON.stringify({body:captured.body,config}),JSON.stringify(rawResponse));
  assert.equal(seed.getCache(`response:${nativeKey}`),null,'the durable response has no cache entry');
  const before={rows:seed.db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,providerRows:seed.db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n};
  seed.close();
  const db=new DatabaseSync(dbPath,{readOnly:true}),fetchCounter={count:0};
  try {
    const replay=await replayV77CompletedEvaluation({fixture:{candidate},provider:'gemini',ids,registry,db,prices,expectedNativeKey:nativeKey,fetchCounter});
    assert.equal(replay.judgment.option_resolution.passed,true);
    assert.equal(replay.judgment.candidate_id,candidate.id);
    assert.equal(replay.native_fetches,0);
    assert.equal(fetchCounter.count,0);
    assert.equal(db.prepare('SELECT value FROM cache WHERE id=?').get(`response:${nativeKey}`),undefined);
    const after={rows:db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,providerRows:db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n};
    assert.deepEqual(after,before);
    const results={evaluations:{[candidate.id]:{gemini:{status:'error',error:'saved transport interruption',native_key:nativeKey}}},recovery_history:[]};
    appendV77RecoveryHistory(results,{studyId:ids.fresh,fixtureId:candidate.id,recordKind:'evaluation:gemini',priorRecord:results.evaluations[candidate.id].gemini,nativeKey});
    results.evaluations[candidate.id].gemini={status:'judged',...replay.judgment};
    assert.equal(results.recovery_history.length,1);
    assert.equal(results.recovery_history[0].prior_record.error,'saved transport interruption');
    assert.equal(results.evaluations[candidate.id].gemini.status,'judged');
  } finally { db.close(); rmSync(dir,{recursive:true,force:true}); }
});

test('a missing complete retry identity is denied before the native transport seam', async () => {
  let nativeCalls=0;
  const ledger={db:{prepare(){return {get(){return null;}};}}};
  const state={stopping:false,pendingMaximum:0};
  await assert.rejects(dispatchV77NativeRequest({provider:'gemini',body:{contents:[{role:'user',parts:[{text:JSON.stringify({candidate_id:'case'})}]}],generationConfig:{maxOutputTokens:1}},
    options:{key:'missing-completion-retry-key',stage:'independent_evaluation'},studyIds:makeStudyIds(),allowedCandidates:new Set(['case']),
    native:{async generate(){nativeCalls++;throw new Error('should never run');}},ledger,prices:{},state,
    reservationNeeded:()=>false,requestAccepted:()=>false,requestState:()=>null,maximumRequest:()=>1,scopedCommitted:()=>0,lifetimeCommitted:()=>0,
    assertCampaign:assertCampaignBudget,assertLifetime:()=>{},recoveryOnly:true,completedResponseAvailable:()=>false}),/exact_complete_response_required/);
  assert.equal(nativeCalls,0);
});


test('replays an existing bounded complete-JSON retry receipt without requiring the initial key to equal the saved retry key', async () => {
  const dir=mkdtempSync(join(tmpdir(),'v77-retry-replay-')),dbPath=join(dir,'budget.sqlite'),prices=JSON.parse((await import('node:fs')).readFileSync(new URL('../../../../../data/pipeline-prices.json',import.meta.url),'utf8'));
  const ids=makeStudyIds(),view=blindViewV77(candidate,candidate.source_refs),calls=[],memory=new Map();
  const adapters=createFactoryEvidenceV77({registry,ledger:{getCache:key=>memory.get(key)||null,setCache:(key,value)=>memory.set(key,value)},topology:TOPOLOGIES.dual_blind,
    calibrationPurpose:true,efforts:effortsFor(candidate),transport:{async generate(provider,body,options){calls.push({provider,body:structuredClone(body),options:{...options}});
      if(calls.length===1)return {output_text:'{"partial":'};
      const raw=provider==='gemini'?body.contents.find(row=>row.role==='user').parts[0].text:body.input.find(row=>row.role==='user').content;
      return {output_text:JSON.stringify(providerJudgment(JSON.parse(raw)))};
    }}});
  const expected=await adapters.__evaluation(view,'gemini');assert.equal(expected.option_resolution.passed,true);assert.equal(calls.length,2);
  const keys=calls.map(call=>hashJSON({study:`${ids.fresh}:${ids.regression}`,parent:call.options.key}));
  const seed=new BudgetLedger(dbPath),model='gemini-3.8-flash',rate=prices.models[model];
  calls.forEach((call,index)=>{
    const output=call.body.generationConfig.maxOutputTokens,reserved=Math.ceil(rate.max_input_tokens*Math.max(rate.input_per_million,rate.cache_write_per_million||0)+output*rate.output_per_million);
    const reservation=seed.reserve(model,reserved),payload=index===0?{output_text:'{"partial":',usage:{input_tokens:100,output_tokens:2}}:
      {candidates:[{content:{parts:[{text:JSON.stringify(providerJudgment(JSON.parse(call.body.contents[0].parts[0].text)))}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:60,thoughtsTokenCount:0}};
    seed.settle(reservation,1000,{provider:'gemini',model,stage:'independent_evaluation',purpose:'calibration'});
    const config={provider:'gemini',model,key:keys[index],reserved,pricing:prices,rates:rate,execution_mode:'realtime',stage:'independent_evaluation',purpose:'calibration',candidate_id:`${QUALIFICATION_V77_PREFIX}${candidate.id}`,toolCalls:0};
    seed.db.prepare("INSERT INTO provider_requests(id,reservation_id,provider,state,request_json,response_json) VALUES(?,?,?,'complete',?,?)").run(keys[index],reservation,'gemini',JSON.stringify({body:call.body,config}),JSON.stringify(payload));
  });
  const before={requests:seed.db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,providerRows:seed.db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n};seed.close();
  const db=new DatabaseSync(dbPath,{readOnly:true});
  try{
    const replay=await replayV77CompletedEvaluation({fixture:{candidate},provider:'gemini',ids,registry,db,prices,expectedNativeKey:keys[1]});
    assert.equal(replay.judgment.option_resolution.passed,true);assert.ok(replay.native_keys.includes(keys[0]));assert.ok(replay.native_keys.includes(keys[1]));
    assert.equal(replay.native_fetches,0);assert.deepEqual({requests:db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,providerRows:db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n},before);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('replays a topology explanation error from a complete SQLite receipt and derives terminal verifier state offline', async () => {
  const priorSecret=process.env.CUET_EVIDENCE_SIGNING_KEY;
  process.env.CUET_EVIDENCE_SIGNING_KEY='v77-topology-test-secret';
  const dir=mkdtempSync(join(tmpdir(),'v77-topology-replay-')),dbPath=join(dir,'budget.sqlite');
  try {
    const sourceRegistry=JSON.parse((await import('node:fs')).readFileSync(new URL('../../../../../data/source_registry.json',import.meta.url),'utf8'));
    const {additions,fixtures}=buildFixtures(sourceRegistry),studyRegistry=applyAdditions(sourceRegistry,additions,fixtures);
    const fixture=fixtures.find(row=>row.id==='v7b-acc-inv-turnover');
    assert.ok(fixture?.candidate,'offline registered V7 synthetic fixture exists');
    fixture.candidate.learning_objective={syllabus_unit:fixture.candidate.chapter,objective:'Apply the stated accounting treatment.',target_term:'inventory'};
    const cache=new Map(),captured=[];
    const transport={async generate(provider,body,options){
      captured.push({provider,body:structuredClone(body),options:{...options}});
      const raw=provider==='gemini'?body.contents.find(row=>row.role==='user').parts[0].text:body.input.find(row=>row.role==='user').content;
      const input=JSON.parse(raw),result=options.stage==='explanation_support'
        ?explanationAudit(input)
        :providerJudgment(input);
      const text=JSON.stringify(result);
      const response=provider==='openai'?{output_text:text,status:'completed'}:{candidates:[{content:{parts:[{text}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:200,candidatesTokenCount:80,thoughtsTokenCount:0}};
      captured.at(-1).response=structuredClone(response);return response;
    }};
    const memLedger={getCache:key=>cache.get(key)||null,setCache:(key,value)=>cache.set(key,structuredClone(value))};
    const baseline=await validateFactoryCandidateV77(fixture.candidate,{registry:studyRegistry,ledger:memLedger,transport,calibrationPurpose:true,efforts:effortsFor(fixture.candidate),seen:new Set()});
    assert.equal(baseline.state,'eligible',JSON.stringify({reasons:baseline.reasons,failure_details:baseline.failure_details,checks:baseline.checks?.explanation_support}));
    const explanationCall=captured.find(call=>call.options.stage==='explanation_support'&&call.provider==='openai');
    assert.ok(explanationCall,'baseline produced explanation receipt');
    const prices=JSON.parse((await import('node:fs')).readFileSync(new URL('../../../../../data/pipeline-prices.json',import.meta.url),'utf8'));
    const seed=new BudgetLedger(dbPath);
    try {
      for(const [key,value] of cache)if(!/^[0-9a-f]{64}$/.test(key))seed.db.prepare('INSERT INTO cache(id,value) VALUES(?,?)').run(key,JSON.stringify(value));
      const keys=[];
      for(const call of captured) {
        const nativeKey=hashJSON({study:`${QUALIFICATION_V77_PREFIX}fresh:${QUALIFICATION_V77_PREFIX}regression`,parent:call.options.key});
        if(keys.some(row=>row.key===nativeKey))continue;
        const model=call.provider==='openai'?'gpt-6-luna':'gemini-3.8-flash',rate=prices.models[model];
        const response=call.response;
        const output=call.body.generationConfig?.maxOutputTokens||call.body.max_output_tokens||5000;
        const reserved=Math.ceil(rate.max_input_tokens*Math.max(rate.input_per_million,rate.cache_write_per_million||0)+output*rate.output_per_million),reservation=seed.reserve(model,reserved);
        seed.settle(reservation,1000,{provider:call.provider,model,usage:response.usageMetadata||{prompt_tokens:200,completion_tokens:80},stage:call.options.stage,purpose:'calibration'});
        const config={provider:call.provider,model,key:nativeKey,reserved,pricing:prices,rates:rate,execution_mode:'realtime',stage:call.options.stage,purpose:'calibration',candidate_id:`${QUALIFICATION_V77_PREFIX}${fixture.candidate.id}`,toolCalls:0};
        seed.db.prepare("INSERT INTO provider_requests(id,reservation_id,provider,state,request_json,response_json) VALUES(?,?,?,'complete',?,?)")
          .run(nativeKey,reservation,call.provider,JSON.stringify({body:call.provider==='openai'?{...call.body,service_tier:'flex'}:call.body,config}),JSON.stringify(response));
        keys.push({key:nativeKey,stage:call.options.stage});
      }
      const explanationKey=keys.find(row=>row.stage==='explanation_support')?.key;assert.ok(explanationKey);
      const before={requests:seed.db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,providerRequests:seed.db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n};
      seed.close();
      const db=new DatabaseSync(dbPath,{readOnly:true});
      try {
        const fetchCounter={count:0},replay=await replayV77Topology({fixture,ids:makeStudyIds(),registry:studyRegistry,db,prices,expectedNativeKey:explanationKey,fetchCounter});
        assert.equal(replay.verdict.state,'eligible',JSON.stringify(replay.verdict.reasons));
        assert.ok(replay.native_keys.includes(explanationKey));
        assert.equal(replay.native_fetches,0);assert.equal(fetchCounter.count,0);
        assert.deepEqual({requests:db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,providerRequests:db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n},before);
        const results={topologies:{dual_blind:[{id:fixture.candidate.id,state:'error',error:'saved explanation interruption',native_key:explanationKey}]},recovery_history:[]};
        appendV77RecoveryHistory(results,{studyId:makeStudyIds().fresh,fixtureId:fixture.candidate.id,recordKind:'topology',priorRecord:results.topologies.dual_blind[0],nativeKey:explanationKey});
        results.topologies.dual_blind[0]={...results.topologies.dual_blind[0],...replay.verdict};
        assert.equal(results.topologies.dual_blind[0].state,'eligible');
        assert.equal(results.recovery_history[0].prior_record.error,'saved explanation interruption');
      } finally {db.close();}
    } finally {try{seed.close();}catch{}}
  } finally {if(priorSecret===undefined)delete process.env.CUET_EVIDENCE_SIGNING_KEY;else process.env.CUET_EVIDENCE_SIGNING_KEY=priorSecret;rmSync(dir,{recursive:true,force:true});}
});
