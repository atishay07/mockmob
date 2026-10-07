import test from 'node:test';
import assert from 'node:assert/strict';
import {retrieveFocusedSources} from '../lib/focusedSources.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const source=(id,facts)=>({id,version:1,state:'active',kind:'reference',reuse_permitted:true,extraction_checked:true,identity_sha256:'identity',chapters:['Accounting Ratios'],facts:Object.fromEntries(Object.entries(facts).map(([k,text])=>[k,{text}])),supports:Object.fromEntries(Object.entries(facts).map(([k,text])=>[k,hashJSON(text)]))});
test('topic-rich exercises cannot displace the decisive normative formula',()=>{
 const registry={sources:{s:source('s',{exercise:'Exercises: inventory inventory turnover inventory. What is inventory turnover?',formula:'Inventory Turnover Ratio = Cost of Revenue from Operations / Average Inventory. Average inventory is opening plus closing inventory divided by two.'})}};
 const r=retrieveFocusedSources(registry,{subject:'accountancy',chapter:'Accounting Ratios',topic:'Inventory turnover'});assert.equal(r.refs.length,1);assert.equal(r.refs[0].locator,'formula');assert.match(r.excerpts[0].text,/Cost of Revenue/);
});
test('four lexical definitions support matching briefs and vary deterministically across gaps',()=>{
 const registry={sources:Object.fromEntries(['alpha','beta','delta','epsilon','gamma'].map(word=>{const s=source('oxford-quality-'+word,{definition:word+' means a distinct definition'});s.chapters=['Vocabulary','Match the Following'];return [s.id,s];}))};
 const brief={subject:'english',chapter:'Match the Following',topic:'Matching meanings',variant_index:0};
 const a=retrieveFocusedSources(registry,brief),b=retrieveFocusedSources(registry,{...brief,variant_index:1});assert.equal(a.refs.length,4);assert.equal(new Set(a.refs.map(r=>r.id)).size,4);assert.notEqual(a.refs[0].id,b.refs[0].id);assert.deepEqual(retrieveFocusedSources(registry,brief),a);
});
test('a stored excerpt hash mismatch fails closed before generation',()=>{
 const registry={sources:{s:source('s',{formula:'Inventory turnover uses average inventory.'})}};registry.sources.s.facts.formula.text='A fabricated replacement formula';assert.throws(()=>retrieveFocusedSources(registry,{subject:'accountancy',chapter:'Accounting Ratios',topic:'Inventory'}),/excerpt_required/);
});
