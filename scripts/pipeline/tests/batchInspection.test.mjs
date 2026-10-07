import test from 'node:test';import assert from 'node:assert/strict';import {inspectBatch,inspectAgainstInventory} from '../lib/batchInspection.mjs';
const job=(id,body,answer='₹20')=>({id,state:'eligible',candidate:{subject:'economics',chapter:'Production & Costs',question_type:'numerical_calculation',difficulty:'easy',concept_id:'marginal_cost',body,options:[answer,'₹10','₹30','₹40'],correct_answer:'A'}});
const opts={eligible:()=>({eligible:true})};
test('publisher passage contracts quarantine mixed chapters, changed stimuli and incomplete groups before RPCs',()=>{
 const a=job('a','First independent question'),b=job('b','Second independent question');
 for(const [index,j] of [a,b].entries())Object.assign(j.candidate,{id:j.id,provenance:{kind:'original_practice'},passage_group_id:'g',passage_text:'Complete registered passage.',order_index:index});
 const registry={passage_groups:{g:{id:'g',state:'active',kind:'original_practice',candidate_ids:['a','b'],passage_text:'Complete registered passage.'}}};
 assert.equal(inspectAgainstInventory([a,b],[],{...opts,registry}).decisions.length,0);
 for(const change of [{chapter:'Other chapter'},{passage_text:'A rewritten passage.'},{order_index:0}]){
  const changed={...b,candidate:{...b.candidate,...change}};
  const result=inspectAgainstInventory([a,changed],[],{...opts,registry});
  assert.deepEqual(result.decisions.map(d=>d.id).sort(),['a','b']);
  assert.ok(result.decisions.every(d=>d.reason==='inspection_passage_group_contract'));
 }
 assert.equal(inspectAgainstInventory([a],[],{...opts,registry}).decisions[0].reason,'inspection_passage_group_contract');
});
test('cross-cohort duplicate detection withholds the newcomer and never modifies prior publication',()=>{
 const old=job('old','A total cost grows from ₹80 to ₹100 for one more unit.');old.candidate.id=old.id;
 const incoming=structuredClone(old);incoming.id='new';incoming.candidate.id='new';incoming.candidate.options.reverse();incoming.candidate.correct_answer='D';
 const before=JSON.stringify(old.candidate),r=inspectAgainstInventory([incoming],[old.candidate],opts);
 assert.deepEqual(r.decisions.map(d=>d.id),['new']);assert.equal(r.inventory_compared,1);assert.equal(JSON.stringify(old.candidate),before);
 assert.equal(inspectAgainstInventory([old],[old.candidate],opts).decisions.length,0,'A replay excludes its own prior row');
});
test('cross-cohort duplicate failure withholds every sibling in an atomic passage group',()=>{
 const old=job('old','An unchanged reading question');old.candidate.id='old';
 const a=structuredClone(old);a.id='new';a.candidate.id='new';a.candidate.passage_group_id='group';
 const b=job('sibling','An independently distinct sibling question');b.candidate.passage_group_id='group';
 const r=inspectAgainstInventory([a,b],[old.candidate],opts);
 assert.ok(r.decisions.some(d=>d.id==='sibling'&&d.reason==='atomic_group_sibling_withheld'));
});
test('a universal exact clause claim cannot replace the supported at-least qualification',()=>{
 const q=job('a','Every English clause has two parts: a noun phrase and a verb phrase.');q.candidate.subject='english';
 assert.equal(inspectBatch([q],opts).decisions[0].reason,'unsupported_exact_clause_generalization');
 q.candidate.body='All clauses in English have at least two parts.';assert.equal(inspectBatch([q],opts).decisions.length,0);
});
test('loan classification needs a stipulated sequence when reasoning steps can commute',()=>{
 const q=job('a','For a fresh loan, arrange the logical order: note repayment, conclude it creates a liability, classify the receipt.');q.candidate.question_type='sequence_ordering';
 assert.equal(inspectBatch([q],opts).decisions[0].reason,'uncertain_classification_step_order');
 q.candidate.body+=' Use the specified procedure.';assert.equal(inspectBatch([q],opts).decisions.length,0);
});
test('inspection rejects duplicated content despite reordered options and preserves recalculated numericals',()=>{
 const a=job('a','Total cost increases from ₹80 to ₹100 for one more unit.'),b=structuredClone(a);b.id='b';b.candidate.options.reverse();b.candidate.correct_answer='D';
 assert.equal(inspectBatch([a,b],opts).decisions[0].reason,'duplicate_content');
 const c=job('c','Total cost increases from ₹80 to ₹110 for one more unit.','₹30');assert.equal(inspectBatch([a,c],opts).decisions.length,0);
});
test('similar specific idea and same answer is conservatively withheld, but a broad shared concept is insufficient',()=>{
 const a=job('a','What is marginal cost when total cost increases from 80 to 100 for one more unit?'),b=job('b','Find marginal cost when total cost increases from 80 to 100 for one more unit?');
 assert.equal(inspectBatch([a,b],opts).decisions[0].reason,'duplicate_idea_conservative');
 assert.equal(inspectBatch([a,job('c','A firm increases total cost by 10 to produce two additional units.','₹5')],opts).decisions.length,0);
});
test('invalid evidence is withheld independently of high craft and complete count',()=>{
 assert.equal(inspectBatch([job('a','Stem')],{eligible:()=>({eligible:false,reasons:['expired']})}).decisions[0].reason,'inspection_evidence_invalid');
 assert.equal(inspectBatch([job('a','Stem')],opts).ready,false);
});

test('paraphrased usage sentences for one named word cannot inflate lexical coverage',()=>{
 const lexical=(id,body,answer)=>({id,state:'eligible',candidate:{subject:'english',chapter:'Correct Word Usage',question_type:'correct_word_usage',difficulty:'medium',body,options:[answer,'Other A','Other B','Other C'],correct_answer:'A'}});
 const a=lexical('a','Choose the correct use of “concise”.','The concise notice gave essential instructions in few words.');
 const b=lexical('b','Which sentence uses "concise" correctly?','The concise report gave the key findings in a few words.');
 const c=lexical('c','Choose the correct use of "candid".','She was candid about her mistake.');
 const decisions=inspectBatch([a,b,c],opts).decisions;assert.equal(decisions.length,1);assert.equal(decisions[0].id,'b');assert.equal(decisions[0].reason,'duplicate_lexical_target');
});

test('changed distractors and concept labels do not create a new question with the same stem, passage and answer',()=>{
 const a=job('a','What does Arun do after the shadow reaches the chair legs?','He goes inside to write a letter.');a.candidate.passage_text='Arun waits by a chair and then writes a letter.';
 const b=structuredClone(a);b.id='b';b.candidate.concept_id='different_label';b.candidate.options[1]='He sleeps.';
 assert.equal(inspectBatch([a,b],opts).decisions[0].reason,'duplicate_idea_conservative');
 b.candidate.passage_text='Another independently supplied story.';assert.equal(inspectBatch([a,b],opts).decisions.length,0);
});

test('model passes cannot compensate for an unstated financial-enterprise condition in cash-flow classification',()=>{
 const q=job('a','Under AS-3, dividend received is classified as which investing cash flow?');q.candidate.subject='accountancy';q.candidate.chapter='Cash Flow Statement';
 assert.equal(inspectBatch([q],opts).decisions[0].reason,'missing_financial_enterprise_status');
 q.candidate.body='For a non-financial enterprise, dividend received is classified as which investing cash flow?';assert.equal(inspectBatch([q],opts).decisions.length,0);
});
