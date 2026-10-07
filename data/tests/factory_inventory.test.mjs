import test from 'node:test';import assert from 'node:assert/strict';
import {factoryInventoryCounts,factoryLifetimeEconomics} from '../factory_inventory.mjs';
import {checkpointEvidenceReady} from '../factory_phase_budget.mjs';
test('historical withheld receipts and unrelated usable legacy items cannot fill factory yield',()=>{
 const pubs=[{question_id:'live',subject:'english'},{question_id:'held',subject:'english'},{question_id:'rejected',subject:'economics'}];
 const count=factoryInventoryCounts(pubs,{cells:[{ideas:[{id:'live'},{id:'legacy'}]}]});
 assert.deepEqual(count,{usable_factory:1,unavailable_factory:2,by_subject_usable:{english:1,economics:0}});
 assert.equal(factoryInventoryCounts(pubs,null).usable_factory,0);
});
test('a thousand historical publications with one withheld item do not satisfy the thousand usable gate',()=>{
 const pubs=Array.from({length:1000},(_,i)=>({question_id:String(i),subject:'english'}));
 const counts=factoryInventoryCounts(pubs,{cells:[{ideas:pubs.slice(1).map(p=>({id:p.question_id}))}]});
 assert.equal(checkpointEvidenceReady({},'release_10000',counts.usable_factory),false);
 assert.equal(checkpointEvidenceReady({},'release_10000',1000),true);
});
test('lifetime forecast includes existing spending and conservative holds once',()=>{
 const e=factoryLifetimeEconomics({budget:{committed_micro:12000000},cost_per_published_usd:.008},500);
 assert.equal(e.forecast,88);assert.equal(e.affordable,5250);assert.equal(e.shortfall,38);
 assert.equal(factoryLifetimeEconomics({budget:{committed_micro:51000000},cost_per_published_usd:.008},500).affordable,500);
});
test('missing cost evidence never creates an affordable-inventory or cost claim',()=>{
 assert.deepEqual(factoryLifetimeEconomics({budget:{committed_micro:0}},500),{forecast:null,affordable:null,shortfall:null});
});
