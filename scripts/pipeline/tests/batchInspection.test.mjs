import test from 'node:test';import assert from 'node:assert/strict';import {inspectBatch,inspectAgainstInventory} from '../lib/batchInspection.mjs';
const job=(id,body,answer='₹20')=>({id,state:'eligible',candidate:{subject:'economics',chapter:'Production & Costs',question_type:'numerical_calculation',difficulty:'easy',concept_id:'marginal_cost',body,options:[answer,'₹10','₹30','₹40'],correct_answer:'A'}});
const opts={eligible:()=>({eligible:true})};
test('dictionary definitions do not establish a universal both-qualities rule for antonyms',()=>{
 const q=job('a','Which phrase is the antonym of plausible?','Unreasonable and unlikely to be true');Object.assign(q.candidate,{subject:'english',question_type:'antonym',explanation:'Its antonym must oppose both qualities, so this is correct.'});
 assert.equal(inspectBatch([q],opts).decisions[0].reason,'unsupported_conjunctive_antonym_explanation');
 q.candidate.explanation='The cited antonym definition describes an explanation as difficult to believe.';assert.equal(inspectBatch([q],opts).decisions.length,0);
});
test('same passage fact is withheld despite different concept labels and pronoun paraphrases',()=>{
 const a=job('a','What condition did the members set for reconsidering the proposed drill purchase?','If the repaired equipment could no longer handle the workload.');
 Object.assign(a.candidate,{subject:'english',chapter:'Factual Passage',question_type:'reading_comprehension',passage_text:'A complete fictional club passage.'});
 const b=structuredClone(a);b.id='b';b.candidate.concept_id='another label';b.candidate.body='What condition did the members identify for reconsidering the purchase of a new drill?';b.candidate.options[0]='If the repaired equipment could no longer handle their workload.';
 assert.equal(inspectBatch([a,b],opts).decisions[0].reason,'duplicate_idea_conservative');
 b.candidate.body='Under what condition did the members agree to reconsider buying the new drill?';b.candidate.options[0]="The repaired equipment could no longer handle the club's workload.";
 assert.equal(inspectBatch([a,b],opts).decisions[0].reason,'duplicate_idea_conservative');
 b.candidate.passage_text='A different complete passage.';assert.equal(inspectBatch([a,b],opts).decisions.length,0);
});
test('reading novelty guard preserves different facts, quantities, negations and short common answers',()=>{
 const a=job('a','What condition did members give?','If repaired equipment could no longer handle 20 repairs.');
 Object.assign(a.candidate,{subject:'english',chapter:'Factual Passage',question_type:'reading_comprehension',passage_text:'A complete fictional club passage.'});
 for(const answer of ['If repaired equipment could no longer handle 30 repairs.','If repaired equipment could handle 20 repairs.','To buy a charging cable and inexpensive switches.','Yes']){
  const b=structuredClone(a);b.id='b';b.candidate.body='Which condition did members give?';b.candidate.concept_id='different';b.candidate.options[0]=answer;
  assert.equal(inspectBatch([a,b],opts).decisions.length,0,answer);
 }
});
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
test('relabelled ordering of the same account is one idea; different steps or orders are kept',()=>{
 // Campaign C pair 0fc6254f…/415691cf…: same stimulus, different concept IDs and difficulty labels.
 const order=(id,body,options,key)=>({id,state:'eligible',candidate:{subject:'english',chapter:'Para Jumbles',question_type:'sequence_ordering',difficulty:'easy',concept_id:id,body,options,correct_answer:key}});
 const a=order('a','Arrange the four sentences from one fictional workshop account in order.\n(A) After smoothing the edges, Noor painted the bookmark and left it to dry.\n(B) Once the shape had been cut, Noor smoothed its edges.\n(C) Noor first drew a design for a wooden bookmark.\n(D) Using that drawing as a guide, Noor cut the bookmark\'s shape.\nChoose the correct sequence from the options given below:',['C-B-D-A','D-C-B-A','C-D-A-B','C-D-B-A'],'D');
 const b=order('b','Arrange the following four sentences from one fictional account in order.\n(A) She then smoothed the edges of the shape just cut.\n(B) Using that drawing as a guide, Noor cut the bookmark\'s shape.\n(C) After that smoothing, she painted the bookmark and left it to dry.\n(D) In a fictional workshop, Noor first drew a design for a wooden bookmark.\nChoose the correct sequence from the options given below:',['D-A-B-C','B-D-A-C','D-B-C-A','D-B-A-C'],'D');
 const decisions=inspectBatch([a,b],opts).decisions;
 assert.equal(decisions.length,1);assert.equal(decisions[0].id,'b');assert.equal(decisions[0].reason,'duplicate_idea_conservative');assert.equal(decisions[0].rule,'repeated_ordering_task');
 const other=order('c','Arrange the four sentences in order.\n(A) After editing the copy, Aman compared it with the untouched original.\n(B) First, Aman made a copy of the original interview recording.\n(C) He then edited that copy to reduce the background noise.\n(D) Finally, Aman saved the edited version under a different name.\nChoose the correct sequence from the options given below:',['B-C-A-D','B-A-C-D','C-B-A-D','B-C-D-A'],'A');
 assert.equal(inspectBatch([a,other],opts).decisions.length,0);
 // Shared steps keyed in a different order are a different reasoning task.
 const reversed=structuredClone(b);reversed.id='r';reversed.candidate.options=['D-A-B-C','B-D-A-C','D-B-C-A','D-C-A-B'];
 assert.equal(inspectBatch([a,reversed],opts).decisions.length,0);
 // A shared process vocabulary with different steps (Business Studies) is not a duplicate.
 const steps=(id,lines,key)=>order(id,'Arrange the steps in order.\n'+lines.map((l,i)=>`(${'ABCD'[i]}) ${l}`).join('\n'),['A-B-C-D','B-A-C-D','A-C-B-D','A-B-D-C'],key);
 const planning=steps('p',['Setting objectives for the organisation','Developing planning premises','Identifying alternative courses of action','Evaluating the alternative courses'],'A');
 const controlling=steps('q',['Setting performance standards','Measuring actual performance','Comparing actual performance with standards','Analysing deviations from standards'],'A');
 Object.assign(planning.candidate,{subject:'business_studies',chapter:'Management'});Object.assign(controlling.candidate,{subject:'business_studies',chapter:'Management'});
 assert.equal(inspectBatch([planning,controlling],opts).decisions.length,0);
 // The same procedure with different quantities is a different calculation (bank goodwill pair).
 const four=steps('g4',['Add the four annual profits.','Divide their total by 4 to obtain average profit.','Multiply the average profit by 3 years purchase.','Record ₹1,80,000 as goodwill.'],'A');
 const three=steps('g3',['Add the three annual profits.','Divide their total by 3 to obtain average profit.','Multiply the average profit by 4 years purchase.','Record ₹1,92,000 as goodwill.'],'A');
 assert.equal(inspectBatch([four,three],opts).decisions.length,0);
 // A matching key such as "(A)-(III), (B)-(II)" is never read as an ordering.
 const match=(id,partner)=>order(id,'Match List-I with List-II.\n(A) Partner '+partner+'\n(B) Partner Q\n(C) Partner R\n(D) Partner S',['(A)-(III), (B)-(II), (C)-(I), (D)-(IV)','(A)-(I), (B)-(II), (C)-(III), (D)-(IV)','(A)-(II), (B)-(I), (C)-(III), (D)-(IV)','(A)-(IV), (B)-(III), (C)-(II), (D)-(I)'],'A');
 assert.equal(inspectBatch([match('m1','P'),match('m2','P ')],opts).decisions.filter(d=>d.rule).length,0);
});
test('ordering duplicate rule keeps different units, negated steps and distinct procedures sharing vocabulary',()=>{
 const order=(id,lines,key='A')=>({id,state:'eligible',candidate:{subject:'accountancy',chapter:'Issue of Shares',question_type:'sequence_ordering',difficulty:'medium',concept_id:id,
  body:'Arrange the steps in order.\n'+lines.map((l,i)=>`(${'ABCD'[i]}) ${l}`).join('\n'),options:['A-B-C-D','B-A-C-D','A-C-B-D','A-B-D-C'],correct_answer:key}});
 const rupees=order('r',['Receive application money of ₹2 per share.','Allot the shares to applicants.','Call allotment money of ₹3 per share.','Make the first call of ₹5 per share.']);
 const percent=order('p',['Receive application money of 2% per share.','Allot the shares to applicants.','Call allotment money of 3% per share.','Make the first call of 5% per share.']);
 assert.equal(inspectBatch([rupees,percent],opts).decisions.length,0);
 const negated=order('n',['Receive application money of ₹2 per share.','Do not allot the shares to applicants.','Call allotment money of ₹3 per share.','Make the first call of ₹5 per share.']);
 // Three steps still match, so this one is withheld; with two changed steps it is kept.
 assert.equal(inspectBatch([rupees,negated],opts).decisions.length,1);
 const twoChanged=order('t',['Receive application money of ₹2 per share.','Do not allot the shares to applicants.','Do not call allotment money of ₹3 per share.','Make the first call of ₹5 per share.']);
 assert.equal(inspectBatch([rupees,twoChanged],opts).decisions.length,0);
 // Same chapter, overlapping vocabulary, different procedure (forfeiture versus issue).
 const forfeit=order('f',['Shareholder fails to pay the first call.','Directors send a notice demanding the unpaid call.','Shares are forfeited by a board resolution.','Forfeited shares are reissued to another person.']);
 assert.equal(inspectBatch([rupees,forfeit],opts).decisions.length,0);
});
