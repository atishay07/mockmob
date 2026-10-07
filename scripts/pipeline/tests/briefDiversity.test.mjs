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
