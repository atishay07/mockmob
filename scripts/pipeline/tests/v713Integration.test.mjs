import test from 'node:test';
import assert from 'node:assert/strict';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {createFactoryEvidenceV713,TOPOLOGIES,V713_PROMPT_HASH,adaptEvaluationRequestV713} from '../lib/factoryEvidenceV713.mjs';
import {FACTORY_VERIFIER_VERSION_V713,validationContractV713} from '../lib/contractV713.mjs';
import {validationContractV712} from '../lib/contractV712.mjs';
import {verifyCandidateV713} from '../lib/verifyV713.mjs';
import {assessDifficultyV713,DIFFICULTY_SCHEMA_V713} from '../lib/difficultyPolicyV713.mjs';

const SECRET='offline-v713-regression-secret';
const rule='Cash receipts from the sale of goods and the rendering of services are examples of cash flows from operating activities.';
const sourceText=`${rule}\nCash payments to acquire fixed assets are investing activities.\nCash proceeds from issuing shares are financing activities.`;
const examUnit='Cash Flow Statement';

function makeScenario({failure=null,requested='easy',subject='accountancy',unsupportedOnly=false,topology=TOPOLOGIES.dual_blind}={}){
  const passage=subject==='english'?'Nila borrowed the atlas from the reading room and returned it before closing.':'',
    body=subject==='english'?'According to the passage, what did Nila do before closing?':
      'A garment retailer receives cash from customers for garments it sells. Classify this cash flow.',
    options=subject==='english'?['She returned the atlas.','She bought the atlas.','She kept the atlas overnight.','She donated the atlas.']:
      ['Operating activity.','Investing activity.','Financing activity.','No cash flow.'];
  const familyId='v713-family',packId='v713-pack',sourceId='v713-src',excerpt=subject==='english'?passage:sourceText;
  const candidate={id:'v713-local-'+subject,subject,chapter:subject==='english'?'Narrative Passage':examUnit,family_id:familyId,
    route:subject==='english'?'passage':'conceptual',question_type:subject==='english'?'reading_comprehension':'conceptual_mcq',
    difficulty:requested,body,options,correct_answer:'A',passage_text:passage,
    explanation:unsupportedOnly?'Nila returned the atlas before closing; this was the only item she returned.':subject==='english'?'The passage says Nila returned the atlas before closing.':'Cash received from customers for goods sold is an operating activity.',
    learning_objective:{syllabus_unit:subject==='english'?'Reading Comprehension':examUnit,objective:subject==='english'?'Locate an explicitly stated event in a narrative passage.':'Classify operating cash receipts from sales of goods.',target_term:''},
    provenance:{kind:'original_practice',adaptation_family:familyId,syllabus_version:'offline-syllabus',pattern_version:'offline-pattern',source_pack_id:packId,source_pack_version:1},
    source_refs:[{id:sourceId,version:1,locator:'excerpt',support_hash:hashJSON(excerpt)}],
    evidence_quotes:[subject==='english'?'returned it before closing':rule]};
  const registry={version:'offline-v713',examples:[],packs:{[packId]:{state:'active',version:1,subject}},families:{[familyId]:{state:'active',version:1}},
    exam_specs:{[subject]:{state:'verified',included_topics:[candidate.chapter],excluded_topics:[],syllabus_version:'offline-syllabus',pattern_version:'offline-pattern',pattern_rules:{},exam_rule_version:'offline-rule'}},
    sources:{[sourceId]:{state:'active',reuse_permitted:true,identity_sha256:'c'.repeat(64),extraction_checked:true,version:1,
      supports:{excerpt:hashJSON(excerpt)},facts:{excerpt:{text:excerpt}},chapters:[candidate.chapter],kind:'textbook',title:'Synthetic source',url:'https://ncert.nic.in/offline-fixture'}}};
  const cache=new Map(),requests=[];
  const ledger={getCache:key=>cache.get(key)??null,setCache:(key,value)=>cache.set(key,structuredClone(value))};
  const optionRows=(input,provider,solved='A')=>input.options.map(option=>{
    const correct=option.key===solved,quote=subject==='english'?'Nila borrowed the atlas from the reading room and returned it before closing.':rule;
    return {option:option.key,status:correct?'supported':'contradicted',false_part:correct?'':option.text.replace(/\.$/,''),
      premise_source:subject==='english'?'passage_scope':'excerpt',evidence_id:subject==='english'?'':'E1.1',premise_quote:quote,
      reason:correct?'This matches the decisive text.':'The decisive text rules this alternative out.'};
  });
  const transport={async generate(provider,requestBody,options={}){
    requests.push({provider,body:structuredClone(requestBody),options:{...options}});
    const user=provider==='openai'?requestBody.input.find(r=>r.role==='user').content:requestBody.contents.find(r=>r.role==='user').parts[0].text;
    const input=JSON.parse(user);
    if(options.stage==='explanation_support'){
      const key=input.option_resolutions[0].solved_key,other=['A','B','C','D'].filter(k=>k!==key);
      const claims=[{claim:candidate.explanation,basis:unsupportedOnly?'unsupported':subject==='english'?'excerpt':'excerpt'}];
      const audit={key,key_fully_supported:true,key_reason:'The full key is stated.',unexcluded_rival_conditions:[],
        distractors:other.map(option=>({option,decisively_wrong:true,basis:subject==='english'?'passage_unsupported':'direct_contradiction',reason:'The full alternative is not supported.'}))};
      return {output_text:JSON.stringify({candidate_id:input.candidate_id,content_hash:input.content_hash,claims,passed:!unsupportedOnly,
        reasons:unsupportedOnly?['Unsupported exclusivity claim.']:[],evidence_ids:['E1.1'],resolution_audit:audit})};
    }
    const solved='A';
    const value={candidate_id:input.candidate_id,content_hash:input.content_hash,solved_key:solved,single_defensible_answer:true,source_support:true,
      numeric_solution:true,boundary_cases:true,passage_integrity:true,passage_answerability:true,meaningfully_distinct:true,evidence_ids:['E1.1'],
      reasons:['The printed evidence decides the answer.'],syllabus_chapter:candidate.chapter,syllabus_topic:candidate.chapter,syllabus_entitlement:true,
      presentation_ready:true,question_type_match:true,principle_applicability:'excerpt_required',decisive_principle_in_excerpts:true,answer_conditions:[],
      option_challenges:input.options.filter(o=>o.key!==solved).map(o=>({option:o.key,strongest_reading:'This full alternative is inconsistent with the decisive fact.',correct_under_reading:false,reading_status:'strained',convention_evidence_ids:[]})),
      option_resolution:optionRows(input,provider,solved),blocking_defects:[],style_notes:[],
      cuet_fit:{criteria:Object.fromEntries(['syllabus_objective','format_authenticity','level_calibration','discrimination_value'].map(id=>[id,{level:3,evidence:'The item requires the named source-backed skill.'}])),
        reasoning_steps:1,estimated_difficulty:requested,cognitive_level:'comprehension',exemplar_ids_compared:[]}};
    if(options.stage==='blind_solution'||options.stage==='independent_evaluation'){
      if(failure!=='missing-assessment')value.difficulty_assessment={level:failure==='unknown-level'?'expert':requested,reason:'The task is a direct syllabus application.',comparison_basis:'heuristic'};
    }
    if(failure==='unresolved-alternative'&&provider==='gemini')value.option_resolution.find(r=>r.option==='D').status='unresolved';
    if(failure==='duplicate-provider'&&provider==='gemini')value.provider='openai';
    return {output_text:JSON.stringify(value)};
  }};
  const adapters=createFactoryEvidenceV713({registry,ledger,transport,topology:TOPOLOGIES.dual_blind});
  const run=()=>verifyCandidateV713(candidate,{registry,ledger,adapters,topology,secret:SECRET});
  return {candidate,registry,requests,cache,transport,adapters,run};
}

test('V713 real adapter flow preserves the two blind solves, frozen matrix audit, and existing V712 mandatory gates',async()=>{
  assert.match(validationContractV713(),/^[0-9a-f]{64}$/);assert.equal(validationContractV712(),'1107c72a94dd5a8f408fb41e75d57f37f885d693aa268dd0ca149bf2d2d2f899');
  const s=makeScenario(),result=await s.run();
  assert.equal(result.state,'eligible',JSON.stringify(result.reasons||result));
  const record=result.question.evidence.record;
  assert.equal(record.verifier_version,FACTORY_VERIFIER_VERSION_V713);assert.equal(record.validation_contract_hash,validationContractV713());
  assert.equal(record.option_resolution.required,true);assert.equal(record.option_resolution.matrices.length,2);
  assert.deepEqual(s.requests.map(r=>[r.provider,r.options.stage]),[['openai','blind_solution'],['gemini','independent_evaluation'],['openai','explanation_support']]);
  for(const r of s.requests.slice(0,2)){
    const raw=r.body.input?.find(x=>x.role==='user')?.content||r.body.contents?.find(x=>x.role==='user')?.parts?.[0]?.text,input=JSON.parse(raw);
    assert.equal('correct_answer'in input,false);assert.equal('option_resolutions'in input,false);assert.equal(raw.includes(s.candidate.explanation),false);
    const system=r.provider==='openai'?r.body.input.find(x=>x.role==='system').content:r.body.systemInstruction.parts[0].text;
    assert.equal(system.includes('V7.6 whole-option semantic adjudication'),false,'compact instructions replace accumulated V7.6 text');
    assert.ok(system.includes('Read all clauses/conjunctions/quantifiers/modalities'));
    assert.ok(system.includes('Academic gates precede'));
    assert.ok(system.includes('difficulty_assessment'));
    const schema=r.provider==='openai'?r.body.text.format.schema:r.body.generationConfig.responseFormat.text.schema;
    assert.ok(schema.required.includes('difficulty_assessment'));
    assert.deepEqual(schema.properties.difficulty_assessment.required,DIFFICULTY_SCHEMA_V713.required);
    const rowSchema=schema.properties.option_resolution.items;
    assert.deepEqual(rowSchema.required,['option','status','false_part','premise_source','evidence_id','premise_quote','reason']);
  }
  const auditRequest=s.requests[2],auditSchema=auditRequest.body.text.format.schema;
  assert.ok(auditSchema.required.includes('resolution_audit'));
  assert.deepEqual(JSON.parse(auditRequest.body.input.find(x=>x.role==='user').content).option_resolutions.map(r=>r.solver),['openai','gemini']);
  assert.equal(auditRequest.body.input.find(x=>x.role==='system').content.includes('BOTH independently frozen option resolutions'),true);
  assert.equal(V713_PROMPT_HASH,record.checks.blind_solution.evaluation_prompt);
  const requestCount=s.requests.length, cachedResult=await s.run();
  assert.equal(cachedResult.state,'eligible');assert.equal(s.requests.length,requestCount,'same V713 contract reuses the content-bound local cache');
  assert.ok([...s.cache.keys()].some(key=>key.startsWith(`v713:${validationContractV713()}:`)),'V713 adapter cache is contract namespaced');
});

test('V713 compact request remains provider-shape safe and adds one difficulty assessment field only to solver schemas',()=>{
  const body={model:'gemini-3.8-flash',systemInstruction:{parts:[{text:'Existing V7.6 evaluator.'}]},
    contents:[{role:'user',parts:[{text:JSON.stringify({candidate_id:'x',content_hash:'h',evidence_catalog:[],options:[]})}]}],
    generationConfig:{maxOutputTokens:4500,responseFormat:{text:{schema:{type:'object',required:['candidate_id','content_hash','option_challenges'],properties:{candidate_id:{type:'string'},content_hash:{type:'string'},option_challenges:{type:'array'}}}}}}};
  const adapted=adaptEvaluationRequestV713('gemini',body,{stage:'independent_evaluation'});
  assert.equal(body.generationConfig.maxOutputTokens,4500,'the caller body remains immutable');
  assert.equal(adapted.generationConfig.maxOutputTokens,6000);
  assert.ok(adapted.generationConfig.responseFormat.text.schema.required.includes('option_resolution'));
  assert.ok(adapted.generationConfig.responseFormat.text.schema.required.includes('difficulty_assessment'));
  assert.equal(adapted.generationConfig.responseFormat.text.schema.properties.option_resolution.items.required.length,7);
  assert.equal(adapted.systemInstruction.parts[0].text.includes('V7.8'),false);
  assert.deepEqual(adaptEvaluationRequestV713('gemini',body,{stage:'source_support'}),body,
    'non-solver requests pass through the compact evaluator adapter unchanged');
});

test('V713 adapter doubles adapted output caps on real incomplete-JSON retries with new durable keys',async()=>{
  const s=makeScenario(), original=s.transport.generate.bind(s.transport), seen=[];
  const failures=new Set();
  s.transport.generate=async(provider,body,options={})=>{
    const identity=`${options.stage}:${provider}`;
    seen.push({identity,provider,stage:options.stage,cap:provider==='openai'?body.max_output_tokens:body.generationConfig.maxOutputTokens,key:options.key});
    if(!failures.has(identity)){failures.add(identity);return {output_text:'{'};}
    return original(provider,body,options);
  };
  const result=await s.run();
  assert.equal(result.state,'eligible',JSON.stringify(result.reasons||result));
  for(const [identity,base,retry] of [['blind_solution:openai',16000,32000],['independent_evaluation:gemini',6000,12000],['explanation_support:openai',8000,16000]]){
    const pair=seen.filter(row=>row.identity===identity);
    assert.equal(pair.length,2,identity);
    assert.deepEqual(pair.map(row=>row.cap),[base,retry],identity);
    assert.notEqual(pair[0].key,pair[1].key,`${identity} retry must have a distinct durable key`);
  }
});

for(const [failure,expected] of [['missing-assessment','independent_difficulty_assessment_missing'],['unknown-level','independent_difficulty_assessment_missing'],
  ['unresolved-alternative','failed:independent_evaluation']]){
  test(`V713 quarantines ${failure} through the actual adapter and verifier seam`,async()=>{
    const s=makeScenario({failure}),result=await s.run();assert.equal(result.state,'quarantined',JSON.stringify(result));
    assert.ok(JSON.stringify(result.reasons||result).includes(expected),JSON.stringify(result.reasons||result));
  });
}

test('V713 requires two independently authored demand observations and fails closed on malformed checks',()=>{
  assert.deepEqual(assessDifficultyV713({blind_solution:{provider:'openai'},independent_evaluation:{provider:'gemini'}}).reason,'independent_difficulty_assessment_missing');
  const valid={level:'easy',reason:'Direct recognition.',comparison_basis:'heuristic'};
  assert.equal(assessDifficultyV713({blind_solution:{provider:'openai',difficulty_assessment:valid},independent_evaluation:{provider:'gemini',difficulty_assessment:valid}}).level,'easy');
  assert.equal(assessDifficultyV713({blind_solution:{provider:'openai',difficulty_assessment:valid},independent_evaluation:{provider:'openai',difficulty_assessment:valid}}).reason,'difficulty_assessments_not_independent');
  assert.equal(assessDifficultyV713({blind_solution:{provider:'openai',difficulty_assessment:{...valid,reason:7}},independent_evaluation:{provider:'gemini',difficulty_assessment:valid}}).passed,false);
});

test('V713 keeps the V712 economics MR numerical-coincidence control quarantined when the total-output rival is unresolved',async()=>{
  const s=makeScenario(),result=await s.run();
  const view={candidate_id:'econ-mr',content_hash:'econ-hash',body:'A price-taking farmer sells one more unit at Rs 40. What is marginal revenue?',
    passage:'',options:[{key:'A',text:'Rs 0'},{key:'B',text:'Rs 20'},{key:'C',text:'Rs 40'},{key:'D',text:'Rs 40 multiplied by total output'}]};
  const matrix={candidate_id:view.candidate_id,content_hash:view.content_hash,solved_key:'C',passed:true,option_resolution_rows:[
    {option:'A',status:'contradicted',false_part:'Rs 0',premise_source:'stem',evidence_id:'',premise_quote:'sells one more unit at Rs 40',reason:'The extra unit adds Rs 40.'},
    {option:'B',status:'contradicted',false_part:'Rs 20',premise_source:'stem',evidence_id:'',premise_quote:'sells one more unit at Rs 40',reason:'The given price is Rs 40.'},
    {option:'C',status:'supported',false_part:'',premise_source:'stem',evidence_id:'',premise_quote:'sells one more unit at Rs 40',reason:'Price-taking MR equals price.'},
    {option:'D',status:'unresolved',false_part:'',premise_source:'none',evidence_id:'',premise_quote:'',reason:'Total output is unstated; at one unit the value coincides.'}],option_resolution:[]};
  const {applyOptionResolutionV712}=await import('../lib/optionResolutionV712.mjs');
  const resolved=applyOptionResolutionV712(matrix,view,{evidenceCatalog:[]});
  assert.equal(resolved.option_resolution.passed,false);assert.match(resolved.option_resolution.reason,/unresolved_alternative:D/);
  assert.equal(result.state,'eligible','the fixture setup stays healthy; the control check above is intentionally isolated');
});

test('V713 generic explanation-claims gate still rejects unsupported “only” on English items',async()=>{
  const s=makeScenario({subject:'english',unsupportedOnly:true});
  const result=await s.run();
  assert.equal(result.state,'quarantined');
  assert.equal(result.failed_stage,'explanation_support',JSON.stringify(result));
  const audit=s.requests.find(r=>r.options.stage==='explanation_support');
  assert.ok(audit.body.input.find(r=>r.role==='system').content.includes('every factual explanation claim'));
  assert.ok(JSON.parse(audit.body.input.find(r=>r.role==='user').content).proposed_explanation.includes('only'));
});
