// Versioned publication/retrieval seam. No default production client, provider calls or migrations.
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { evidenceSignature } from '../../../data/content_evidence.js';
import { publicationEligibility as legacyEligibility } from '../../../data/evidence_registry.js';
import { inspectPublishTime } from './publishTimeInspection.mjs';
import { factoryPassageGroup } from './factoryCore.mjs';
import { filterPracticeRowsV717,selectNtaQuestionSetV717,rankPracticeRowsV717 } from './practiceSelectionV717.mjs';
import { publicationEligibilityV717 } from './verifyV717.mjs';
import { FACTORY_VERIFIER_VERSION_V717,validationContractV717 } from './contractV717.mjs';
const DIFFICULTY_WEIGHT={easy:1,medium:2,hard:3};
// Identity of a unit is fixed by the signed inputs, so recovery can be decided before anything is re-inspected.
export function publicationUnitKeyV717({questions,target}) {
 const group=questions?.[0]?.passage_group_id || null;
 const contentIdentity=(questions||[]).map(q=>({id:q.id,content_hash:q.evidence?.record?.content_hash,evidence:q.evidence}));
 return 'v717-publication:'+hashJSON({target,contract:validationContractV717(),group,contentIdentity});
}
// Only real public.questions columns are persisted; route/sources/question type stay inside the signed record.
export function toPersistedRowV717(q,record,signature,{authorId,at,nta}) {
 const level=record.decision.difficulty.level;
 return {id:q.id,author_id:authorId,subject:q.subject,chapter:q.chapter,body:q.body,options:q.options || null,correct_answer:q.correct_answer,
  explanation:q.explanation || null,difficulty:level,difficulty_weight:DIFFICULTY_WEIGHT[level],tags:['factory:v717','difficulty:'+level,nta?'route:nta_eligible':'route:practice_only'],
  status:'live',evidence:{record,signature},family_id:q.family_id,passage_text:q.passage_text || null,passage_group_id:q.passage_group_id || null,
  question_type:q.question_type || null,concept_id:q.concept_id || null,order_index:Number(q.order_index || 0) || null,provenance:q.provenance || null,ai_tier:'A',verification_state:'verified',
  // Ranking hint only (0-1, floored so 6.999 never displays as 7); eligibility always re-derives from the signed decision.
  quality_band:nta?'strong':'useful',quality_score:Math.floor(record.decision.quality_score*1000)/10000,
  exploration_state:'active',exploration_lane:'standard',live_at:at,is_deleted:false};
}
export function preparePublicationUnitV717({questions,inventory,familyHolds,registry,manifest,secret,target='local',authorId='v717-local-author'}={}) {
 if(!['local','staging'].includes(target))throw Error('v717_production_requires_separate_explicit_approval_and_adapter');
 if(!Array.isArray(questions)||!questions.length||!Array.isArray(inventory)||!Array.isArray(familyHolds)||!secret)throw Error('v717_current_inventory_holds_and_secret_required');
 const ids=questions.map(q=>q.id);
 if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw Error('v717_publication_ids_invalid');
 const group=questions[0].passage_group_id;
 if(group ? questions.some(q=>q.passage_group_id!==group) : questions.length!==1 || questions.some(q=>q.route==='passage'))throw Error('v717_single_atomic_publication_unit_required');
 if(questions.some(q=>familyHolds.includes(q.family_id)))return {ready:false,reasons:['family_publication_held']};
 const context={registry,manifest,secret};
 const filtered=filterPracticeRowsV717(questions,context,'practice');
 if(filtered.rejected.length || filtered.rows.length!==questions.length)return {ready:false,reasons:['scorecard_or_passage_group_ineligible'],rejections:filtered.rejected};
 const eligible=q=>q.evidence?.record?.verifier_version===FACTORY_VERIFIER_VERSION_V717?publicationEligibilityV717(q,context):legacyEligibility(q);
 const inspection=inspectPublishTime({rows:questions.map(q=>({id:q.id,state:'eligible',candidate:q})),inventory,registry,eligible});
 if(inspection.withheld.length)return {ready:false,reasons:['publish_time_inspection'],inspection};
 // A passage unit is NTA-visible only when every child is; otherwise the whole unit stays practice-only.
 const nta=questions.every(q=>publicationEligibilityV717(q,{...context,mode:'nta'}).eligible),at=new Date().toISOString();
 const rows=questions.map(q=>{
  const record={...q.evidence.record,state:'published',published_at:at};
  return toPersistedRowV717(q,record,evidenceSignature(record,secret),{authorId,at,nta});
 });
 // The registered group contract (inspection already applied it) supplies the group row; visibility is unit metadata.
 const groupRow=group?{...factoryPassageGroup(questions,registry),difficulty:rows[0].difficulty,mode_visibility:nta?['practice','full_mock','nta_mode']:['practice']}:null;
 return {ready:true,target,unit_key:publicationUnitKeyV717({questions,target}),content_hash:hashJSON(questions),payload_hash:hashJSON(rows),rows,group:groupRow,group_id:group||null,
  mode_visibility:nta?['practice','full_mock','nta_mode']:['practice'],
  preconditions:{inventory_ids_hash:inspection.inventory_ids_hash,family_holds_hash:hashJSON([...familyHolds].sort())},inspection:inspection.record};
}
// Writer must perform one idempotent atomic transaction and compare current preconditions.
// A dispatching/uncertain prior write recovers receipt-only; it is re-dispatched only after the
// adapter proves (under its write lock) that nothing from the unit committed.
export async function publishUnitV717({questions,registry,manifest,secret,target,adapter,authorId}={}) {
 if(!adapter || !['readInventory','readFamilyHolds','inventoryVersion','getWriteState','saveWriteState','writeAtomic','readReceipt'].every(name=>typeof adapter[name]==='function'))throw Error('v717_explicit_atomic_writer_required');
 if(!['local','staging'].includes(target))throw Error('v717_production_requires_separate_explicit_approval_and_adapter');
 const unit_key=publicationUnitKeyV717({questions,target}),content_hash=hashJSON(questions);
 const prior=await adapter.getWriteState(unit_key);
 if(prior && prior.content_hash!==content_hash)throw Error('v717_publication_identity_changed');
 if(prior && ['dispatching','uncertain','committed'].includes(prior.state)) {
  const receipt=await adapter.readReceipt(unit_key);
  if(receipt?.committed===true && receipt.unit_key===unit_key && receipt.content_hash===content_hash) {
   if(prior.state!=='committed')await adapter.saveWriteState(unit_key,{...prior,state:'committed',receipt});
   return {state:'published',receipt,recovered:true};
  }
  if(!(receipt?.committed===false && receipt.definitive_absent===true && receipt.unit_key===unit_key))return {state:'uncertain',unit_key,recovery:'receipt_only'};
 }
 // The version is read before the inventory so a concurrent change between them fails the in-transaction precondition.
 const inventory_version=await adapter.inventoryVersion(),inventory=await adapter.readInventory(),familyHolds=await adapter.readFamilyHolds();
 const prepared=preparePublicationUnitV717({questions,inventory,familyHolds,registry,manifest,secret,target,authorId});
 if(!prepared.ready)return {state:'withheld',...prepared};
 prepared.preconditions.inventory_version=inventory_version;
 const record={state:'dispatching',unit_key,content_hash,payload_hash:prepared.payload_hash,attempt:(prior?.attempt || 0)+1};
 await adapter.saveWriteState(unit_key,record);
 try {
  const receipt=await adapter.writeAtomic(structuredClone(prepared));
  if(receipt?.committed!==true || receipt.unit_key!==unit_key || receipt.content_hash!==content_hash)throw Error('v717_atomic_write_receipt_missing_or_changed');
  await adapter.saveWriteState(unit_key,{...record,state:'committed',receipt});
  return {state:'published',receipt,inspection:prepared.inspection};
 }catch(error){
  // Only an adapter-proven rollback is a definitive non-publication; anything else stays uncertain and receipt-only.
  if(error?.definitive_no_commit===true){await adapter.saveWriteState(unit_key,{...record,state:'aborted',error:String(error.message)});return {state:'withheld',unit_key,reasons:['write_rejected_before_commit:'+String(error.message)]};}
  await adapter.saveWriteState(unit_key,{...record,state:'uncertain',error:String(error.message)});return {state:'uncertain',unit_key,recovery:'receipt_only',error:String(error.message)};
 }
}
export function retrievePracticeV717(rows,{familyHolds,...options}={}) {
 if(!Array.isArray(familyHolds))throw Error('v717_current_family_holds_required');
 return rankPracticeRowsV717(rows.filter(q=>!familyHolds.includes(q?.family_id)),options);
}
export function retrieveNtaV717(rows,count,{familyHolds,...options}={}) {
 if(!Array.isArray(familyHolds))throw Error('v717_current_family_holds_required');
 return selectNtaQuestionSetV717(rows.filter(q=>!familyHolds.includes(q?.family_id)),count,options);
}
