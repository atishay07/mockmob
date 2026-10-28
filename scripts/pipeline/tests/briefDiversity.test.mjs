import test from 'node:test';
import assert from 'node:assert/strict';
import {diversifyBrief} from '../lib/briefDiversity.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const document=(id,text,chapter='Vocabulary')=>({id,state:'active',kind:'reference',version:1,reuse_permitted:true,extraction_checked:true,identity_sha256:'checked',chapters:[chapter],facts:{definition:{text}},supports:{definition:hashJSON(text)}});
test('lexical briefs avoid already published and preregistered targets',()=>{
 const registry={sources:Object.fromEntries(['prudent','candid','resilient'].map(word=>['oxford-quality-'+word,document('oxford-quality-'+word,'Exact checked definition for '+word+'.')]))};
 const b={id:'next',subject:'english',chapter:'Vocabulary',format:'synonym',topic:'Vocabulary'};
 const r=diversifyBrief(b,registry,[{subject:'english',question_type:'synonym',body:'Closest meaning to "prudent".'}],{planned:[{subject:'english',format:'synonym',topic:'Test "candid".'}]});
 assert.match(r.topic,/"resilient"/);assert.equal(r.state,'retrieved_pending_entailment');
});
test('commerce prefers an unused source section without inventing support',()=>{
 const s=document('ncert-checked','One decisive exact registered section for a test.','Planning');
 s.facts.second={text:'Another decisive exact registered section for a test.'};s.supports.second=hashJSON(s.facts.second.text);
 const registry={sources:{[s.id]:s}},first={id:s.id,version:1,locator:'definition',support_hash:s.supports.definition};
 const r=diversifyBrief({id:'next',subject:'business_studies',chapter:'Planning',topic:'Planning',format:'case_application'},registry,[{source_refs:[first]}]);
 assert.equal(r.refs[0].locator,'second');assert.equal(r.excerpts[0].text,s.facts.second.text);assert.equal(r.cost_usd,0);
});
test('missing, exercise-only or unpermitted material returns no supported brief',()=>{
 const s=document('ncert-checked','Test your understanding: unsupported exercise answers.','Planning');
 assert.equal(diversifyBrief({id:'x',chapter:'Planning',topic:'Planning'},{sources:{s}},[]),null);
 s.facts.definition.text='A decisive rule in a document without reuse permission.';s.reuse_permitted=false;
 assert.equal(diversifyBrief({id:'x',chapter:'Planning',topic:'Planning'},{sources:{s}},[]),null);
});
test('an ordering stimulus is never recycled; exhaustion is an explicit gap, and the ledger persists across runs',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {recordIdeaAllocations,loadIdeaAllocations}=await import('../lib/ideaAllocation.mjs');
 const stimulus=(id,text)=>({...document(id,text,'Para Jumbles'),facts:{stimulus:{text}},supports:{stimulus:hashJSON(text)}});
 const a=stimulus('mockmob-original-stimulus-diverse-a','A fictional account with four linked sentences about one bookmark.'),b=stimulus('mockmob-original-stimulus-diverse-b','A different fictional account whose four sentences follow a cause and its effects.');
 const registry={sources:{[a.id]:a,[b.id]:b}},brief=id=>({id,subject:'english',chapter:'Para Jumbles',format:'sequence_ordering',topic:'Para Jumbles'});
 const refA={id:a.id,version:1,locator:'stimulus',support_hash:a.supports.stimulus};
 const empty={contract:'ordering-source-allocation-v1',allocations:{}};
 // Inventory already holds an ordering item from A (bank rows carry only options).
 const used={subject:'english',options:['A-B-C-D','B-A-C-D','A-C-B-D','A-B-D-C'],source_refs:[refA]};
 const first=diversifyBrief(brief('one'),registry,[used],{allocations:empty});assert.equal(first.refs[0].id,b.id);
 // A planned ordering brief consumes B; nothing remains.
 const gap=diversifyBrief(brief('two'),registry,[used],{planned:[{...brief('one'),source_refs:first.refs}],allocations:empty});
 assert.equal(gap.state,'gap');assert.equal(gap.gap,'ordering_source_pool_exhausted');assert.deepEqual(gap.refs,[]);
 // A non-ordering brief may still use the same stimulus.
 assert.ok(diversifyBrief({...brief('three'),format:'reading_comprehension'},registry,[used],{allocations:empty}).refs.length);
 // Persisted allocation survives a restart with no inventory context.
 const dir=mkdtempSync(join(tmpdir(),'alloc-')),path=join(dir,'idea-allocations.json');
 try{
  assert.equal(recordIdeaAllocations([{...brief('one'),source_refs:first.refs}],{campaignId:'c1',path}).added,1);
  assert.equal(recordIdeaAllocations([{...brief('one'),source_refs:first.refs}],{campaignId:'c1',path}).added,0);
  assert.throws(()=>recordIdeaAllocations([{...brief('other'),source_refs:first.refs}],{campaignId:'c2',path}),/ordering_idea_already_allocated/);
  const restarted=diversifyBrief(brief('four'),registry,[],{allocations:loadIdeaAllocations(path)});assert.equal(restarted.refs[0].id,a.id);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
