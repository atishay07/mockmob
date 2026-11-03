import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BATCH_INSPECTION_CONTRACT} from '../lib/batchInspection.mjs';
import {assertPublishTimeInspection,inspectPublishTime,inspectBeforeBulkPublish,publishInspectedUnit,withheldJobPatch,PUBLISH_TIME_INSPECTION_REASON} from '../lib/publishTimeInspection.mjs';

const eligible=()=>({eligible:true});
const candidate=(id,body,answer='₹20',extra={})=>({id,subject:'economics',chapter:'Production & Costs',question_type:'numerical_calculation',difficulty:'easy',concept_id:`concept_${id}`,body,
 options:[answer,'₹10','₹30','₹40'],correct_answer:'A',...extra});
const job=(id,body,answer,extra)=>({id,state:'eligible',candidate:candidate(id,body,answer,extra)});
const published=(id,body,answer)=>({...candidate(id,body,answer)});
const groupRegistry={passage_groups:{g:{id:'g',state:'active',kind:'original_practice',candidate_ids:['a','b'],passage_text:'Complete registered passage.',source_pack_id:'pack'}}};
const groupRows=()=>['a','b'].map((id,index)=>job(id,`Independent question number ${id} about unrelated facts ${id.repeat(3)}`,`Answer ${id}`,
 {provenance:{kind:'original_practice'},passage_group_id:'g',passage_text:'Complete registered passage.',order_index:index}));
const recorder=()=>{const calls=[];return {calls,publish:async rows=>{calls.push(rows.map(r=>r.id));return {ok:true};}};};

test('a duplicate of an inventory item is withheld and never reaches the publish function',async()=>{
 const body='A total cost grows from ₹80 to ₹100 for one more unit.';
 const {calls,publish}=recorder();
 const outcome=await publishInspectedUnit({rows:[job('new',body)],readInventory:async()=>[published('old',body)],eligible,publish});
 assert.equal(outcome.status,'withheld');
 assert.deepEqual(outcome.withheld.map(w=>w.id),['new']);
 assert.equal(outcome.withheld[0].decision.reason,'duplicate_content');
 assert.equal(outcome.withheld[0].decision.duplicate_of,'old');
 assert.deepEqual(calls,[]);
 const patch=withheldJobPatch({id:'new',result:{state:'eligible',note:'kept'}},outcome);
 assert.equal(patch.state,'quarantined');
 assert.deepEqual(patch.result.reasons,[PUBLISH_TIME_INSPECTION_REASON]);
 assert.equal(patch.result.inspection.reason,'duplicate_content');
 assert.equal(patch.result.note,'kept');
 assert.equal(patch.result.publish_time_inspection.contract,BATCH_INSPECTION_CONTRACT);
});

test('a passage group with one duplicate child is withheld as a whole group',async()=>{
 const rows=groupRows();
 const {calls,publish}=recorder();
 const outcome=await publishInspectedUnit({rows,readInventory:async()=>[{...published('old',rows[1].candidate.body,'Answer b'),passage_text:'Complete registered passage.'}],registry:groupRegistry,eligible,publish});
 assert.equal(outcome.status,'withheld');
 assert.deepEqual(outcome.withheld.map(w=>w.id).sort(),['a','b']);
 assert.equal(outcome.withheld.find(w=>w.id==='a').decision.reason,'atomic_group_sibling_withheld');
 assert.equal(outcome.withheld.find(w=>w.id==='b').decision.reason,'duplicate_content');
 assert.deepEqual(outcome.kept,[]);
 assert.deepEqual(calls,[]);
});

test('a passage group whose sibling is not in a publishable state never partially publishes',()=>{
 const rows=groupRows();rows[1].state='quarantined';
 const result=inspectPublishTime({rows,inventory:[],registry:groupRegistry,eligible});
 assert.deepEqual(result.kept,[]);
 assert.deepEqual(result.withheld.map(w=>w.id).sort(),['a','b']);
});

test('a clean item and a clean passage group publish, with contract and inventory hash recorded',async()=>{
 const {calls,publish}=recorder();
 const inventory=[published('other','A completely different question about marginal revenue and demand curves.','₹55')];
 const outcome=await publishInspectedUnit({rows:[job('clean','What is the marginal cost when output rises by one unit and cost rises by ₹20?')],readInventory:async()=>inventory,eligible,publish});
 assert.equal(outcome.status,'published');
 assert.deepEqual(calls,[['clean']]);
 assert.equal(outcome.contract,BATCH_INSPECTION_CONTRACT);
 assert.match(outcome.inventory_ids_hash,/^[0-9a-f]{8,}$/);
 assert.equal(outcome.record.inventory_compared,1);
 const group=await publishInspectedUnit({rows:groupRows(),readInventory:async()=>inventory,registry:groupRegistry,eligible,publish});
 assert.equal(group.status,'published');
 assert.deepEqual(calls.at(-1),['a','b']);
});

test('inspection errors fail closed and nothing is published',async()=>{
 for(const readInventory of [async()=>{throw new Error('factory_storage_unavailable:57014');},async()=>null,async()=>undefined]){
  const {calls,publish}=recorder();
  const outcome=await publishInspectedUnit({rows:[job('x','What is the marginal cost of one extra unit?')],readInventory,eligible,publish});
  assert.equal(outcome.status,'inspection_failed');assert.deepEqual(calls,[]);
 }
 const {calls,publish}=recorder();
 const throwing=await publishInspectedUnit({rows:[job('x','What is the marginal cost of one extra unit?')],readInventory:async()=>[],eligible:()=>{throw new Error('boom');},publish});
 assert.equal(throwing.status,'inspection_failed');assert.match(throwing.error,/publish_time_inspection_failed:boom/);
 assert.deepEqual(calls,[]);
 assert.throws(()=>inspectPublishTime({rows:[],inventory:[]}),/rows_required/);
 assert.throws(()=>inspectPublishTime({rows:[job('x','q')],inventory:'nope'}),/inventory_required/);
 assert.throws(()=>inspectPublishTime({rows:[{id:'x',state:'eligible'}],inventory:[]}),/rows_invalid/);
 // Evidence that the real eligibility check rejects (unsigned candidates) withholds rather than publishes.
 const unsigned=await publishInspectedUnit({rows:[job('u','What is the marginal cost of one extra unit?')],readInventory:async()=>[],publish});
 assert.equal(unsigned.status,'withheld');assert.equal(unsigned.withheld[0].decision.reason,'inspection_evidence_invalid');
});

test('a publish error is not swallowed by the helper',async()=>{
 await assert.rejects(publishInspectedUnit({rows:[job('x','What is the marginal cost of one extra unit?')],readInventory:async()=>[],eligible,publish:async()=>{throw new Error('factory_publication_failed:23505');}}),/factory_publication_failed/);
});

test('assertPublishTimeInspection throws when nothing may publish and otherwise splits kept and withheld',()=>{
 const body='A total cost grows from ₹80 to ₹100 for one more unit.';
 assert.throws(()=>assertPublishTimeInspection({rows:[job('new',body)],inventory:[published('old',body)],eligible}),/nothing_publishable:new/);
 const mixed=assertPublishTimeInspection({rows:[job('new',body),job('fresh','Which cost does not change when output changes in the short run?','Fixed cost')],inventory:[published('old',body)],eligible});
 assert.deepEqual(mixed.kept.map(j=>j.id),['fresh']);assert.deepEqual(mixed.withheld.map(w=>w.id),['new']);
 assert.equal(mixed.contract,BATCH_INSPECTION_CONTRACT);assert.equal(typeof mixed.inventory_ids_hash,'string');
});

test('an item already in the inventory under its own id is not compared with itself',()=>{
 const body='A total cost grows from ₹80 to ₹100 for one more unit.';
 const result=assertPublishTimeInspection({rows:[{...job('same',body),state:'published'}],inventory:[published('same',body)],eligible});
 assert.deepEqual(result.kept.map(j=>j.id),['same']);
});

test('the cohort gate saves a new dated artifact, never overwrites, and refuses withheld ids',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'publish-time-'));
 try{
  const body='A total cost grows from ₹80 to ₹100 for one more unit.';
  writeFileSync(join(directory,'batch-inspection.json'),'{"saved":true}');
  const clean=await inspectBeforeBulkPublish({rows:[job('fresh','Which cost does not change when output changes in the short run?','Fixed cost')],readInventory:async()=>[published('old',body)],eligible,directory,now:()=>new Date('2026-10-09T10:00:00.000Z')});
  assert.equal(clean.withheld.length,0);
  assert.equal(JSON.parse(readFileSync(clean.artifact,'utf8')).contract,BATCH_INSPECTION_CONTRACT);
  await assert.rejects(inspectBeforeBulkPublish({rows:[job('fresh','Which cost does not change when output changes in the short run?','Fixed cost')],readInventory:async()=>[],eligible,directory,now:()=>new Date('2026-10-09T10:00:00.000Z')}),/EEXIST/);
  await assert.rejects(inspectBeforeBulkPublish({rows:[job('new',body)],readInventory:async()=>[published('old',body)],eligible,directory,now:()=>new Date('2026-10-09T11:00:00.000Z')}),/publish_time_inspection_withheld:new/);
  await assert.rejects(inspectBeforeBulkPublish({rows:[job('new',body)],readInventory:async()=>{throw new Error('down');},eligible,directory,now:()=>new Date('2026-10-09T12:00:00.000Z')}),/down/);
  const files=readdirSync(directory).sort();
  assert.equal(files.filter(f=>f.startsWith('publish-time-inspection-')).length,2);
  assert.equal(readFileSync(join(directory,'batch-inspection.json'),'utf8'),'{"saved":true}');
  const withheldArtifact=JSON.parse(readFileSync(join(directory,files.filter(f=>f.startsWith('publish-time-inspection-')).at(-1)),'utf8'));
  assert.equal(withheldArtifact.withheld[0].decision.reason,'duplicate_content');
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('every currently supported factory publishing route calls the publish-time gate before its first publish call',()=>{
 const strip=s=>s.replace(/^\s*import .*$/gm,'');
 const factory=strip(readFileSync('scripts/pipeline/factory.mjs','utf8'));
 const calls=[...factory.matchAll(/publishFactory(?:Question|Group)\(/g)];
 assert.equal(calls.length,4);
 for(const call of calls)assert.ok(factory.slice(Math.max(0,call.index-420),call.index).includes('publishInspectedUnit'),`ungated publish at ${call.index}`);
 for(const path of ['scripts/pipeline/tools/focusedFactory.mjs','scripts/pipeline/tools/publishProductionCohort.mjs']){
  const source=strip(readFileSync(path,'utf8')),gate=source.indexOf('inspectBeforeBulkPublish('),first=source.search(/publishFactory(?:Question|Group)\(/);
  assert.ok(gate>0&&first>gate,path);
  assert.ok(gate<source.indexOf("from('question_factory_jobs').upsert("),`${path} writes before the gate`);
 }
 const v76=strip(readFileSync('scripts/pipeline/tools/publishCuetFitCampaignV76.mjs','utf8'));
 const v76Gate=v76.indexOf('inspectBeforeBulkPublish('),v76FirstWrite=v76.indexOf("from('question_factory_jobs').upsert(");
 assert.ok(v76Gate>0&&v76FirstWrite>v76Gate,'v76 campaign route must inspect before staging writes');
 assert.ok(v76.includes('publishInspectedUnit('),'v76 campaign route must re-inspect each atomic publication unit');
 assert.ok(v76.includes('publication_policy !== \'released_staging_only\'')&&v76.includes('measurement_only === true'), 'v76 route must reject measurement-only profiles');
 const controller=strip(readFileSync('scripts/pipeline/controller.mjs','utf8'));
 assert.ok(!controller.includes('publishBatch(')&&controller.includes('legacy_controller_publication_disabled_use_qualified_factory'), 'legacy controller must stay closed');
 const autonomous=strip(readFileSync('scripts/pipeline/autonomous/worker.mjs','utf8'));
 assert.ok(autonomous.includes('publishAfterCurrentInspection')&&autonomous.includes('publishInspectedUnit'), 'autonomous question and passage publication must inspect the current bank');
 const offline=strip(readFileSync('scripts/pipeline/lib/offlineBatchFactory.mjs','utf8'));
 assert.ok(offline.includes('publishInspectedUnit')&&offline.includes('readBankSnapshot'), 'offline imports must inspect the current bank before writing');
 const v7Worker=strip(readFileSync('scripts/pipeline/tools/cuetFitFactory.mjs','utf8'));
 assert.ok(v7Worker.includes('assertPublicationPolicy(profile)'), 'hash-bound v7 manual action stays behind the stricter versioned route policy');
});
