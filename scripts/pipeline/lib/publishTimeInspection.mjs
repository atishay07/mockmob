// Publish-time idea inspection. Every route that publishes generated questions runs the deterministic
// content-idea inspection against the CURRENT target inventory immediately before the publish call, and fails
// closed: an inspection error, an unreadable inventory or a withheld id means nothing is published.
// This module reads and compares only; it never calls a provider and never writes to the target database.
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {inspectAgainstInventory,BATCH_INSPECTION_CONTRACT} from './batchInspection.mjs';
import {publicationEligibility} from '../../../data/evidence_registry.js';

export const PUBLISH_TIME_INSPECTION_REASON='publish_time_inspection';
const PUBLISHABLE=['eligible','published'];

// Pure inspection. Rows are queue/campaign jobs {id,state,candidate}. Returns
// {contract,inventory_ids_hash,kept,withheld:[{id,decision}],inspection,record}. Throws (fail closed) when the
// inputs are unusable or the inspection itself errors; a withheld item is a normal result, not an error.
export function inspectPublishTime({rows,inventory,registry,eligible=publicationEligibility}={}){
 if(!Array.isArray(rows)||!rows.length)throw new Error('publish_time_inspection_rows_required');
 if(!Array.isArray(inventory))throw new Error('publish_time_inspection_inventory_required');
 if(rows.some(j=>!j||!j.id||typeof j.candidate!=='object'||j.candidate===null)||new Set(rows.map(j=>j.id)).size!==rows.length)throw new Error('publish_time_inspection_rows_invalid');
 let inspection;
 try{inspection=inspectAgainstInventory(rows,inventory,{eligible,registry});}
 catch(error){throw new Error(`publish_time_inspection_failed:${error?.message||'unknown'}`);}
 if(inspection?.contract!==BATCH_INSPECTION_CONTRACT||!Array.isArray(inspection.decisions)||typeof inspection.inventory_ids_hash!=='string')throw new Error('publish_time_inspection_contract_mismatch');
 const decisions=new Map();for(const d of inspection.decisions)if(!decisions.has(d.id))decisions.set(d.id,d);
 // inspectAgainstInventory already withholds passage-group siblings together; repeat the rule here so a group
 // can never partially publish even if a sibling was in a state the inspection does not read.
 const blocked=j=>decisions.has(j.id)||!PUBLISHABLE.includes(j.state);
 const failedGroups=new Set(rows.filter(blocked).map(j=>j.candidate.passage_group_id).filter(Boolean));
 const kept=[],withheld=[];
 for(const j of rows){
  const decision=decisions.get(j.id)||(!PUBLISHABLE.includes(j.state)?{id:j.id,reason:'not_publishable_state',state:j.state}:failedGroups.has(j.candidate.passage_group_id)?{id:j.id,reason:'atomic_group_sibling_withheld'}:null);
  if(decision)withheld.push({id:j.id,decision});else kept.push(j);
 }
 const record={contract:inspection.contract,inventory_ids_hash:inspection.inventory_ids_hash,inventory_compared:inspection.inventory_compared,content_hash:inspection.content_hash,
  inspected_ids:rows.map(j=>j.id),kept_ids:kept.map(j=>j.id),withheld,at:new Date().toISOString()};
 return {contract:inspection.contract,inventory_ids_hash:inspection.inventory_ids_hash,kept,withheld,inspection,record};
}

// Same, but throws when nothing may publish.
export function assertPublishTimeInspection(options){
 const result=inspectPublishTime(options);
 if(!result.kept.length)throw new Error(`publish_time_inspection_nothing_publishable:${result.withheld.map(w=>w.id).join(',')}`);
 return result;
}

// Queue-job patch for a withheld item: existing quarantined state, reason 'publish_time_inspection' plus the decision.
export function withheldJobPatch(job,outcome){
 const decision=outcome.withheld.find(w=>w.id===job.id)?.decision||{id:job.id,reason:'atomic_group_sibling_withheld'};
 return {state:'quarantined',stage:'complete',result:{...(job.result&&typeof job.result==='object'?job.result:{}),state:'quarantined',reasons:[PUBLISH_TIME_INSPECTION_REASON],inspection:decision,publish_time_inspection:outcome.record}};
}

// One publication unit (a single question or a whole passage group). Reads the current inventory, inspects, and calls
// publish(keptRows) only when nothing in the unit is withheld. Returns {status:'published'|'withheld'|'inspection_failed'}.
// A publish error propagates unchanged so each route keeps its own publish-failure handling.
export async function publishInspectedUnit({rows,readInventory,registry,eligible,publish}){
 let result;
 try{result=inspectPublishTime({rows,inventory:await readInventory(),registry,eligible});}
 catch(error){return {status:'inspection_failed',error:error?.message||'publish_time_inspection_failed',withheld:[],kept:[]};}
 if(result.withheld.length||!result.kept.length)return {status:'withheld',...result};
 const receipt=await publish(result.kept,result);
 return {status:'published',receipt,...result};
}

const stamp=date=>date.toISOString().replace(/[:.]/g,'-');
// Whole-campaign gate for the cohort routes. Inspects every publishable row against the current inventory, saves a
// new dated artifact next to the campaign files (never overwrites a file) and throws if anything is withheld.
export async function inspectBeforeBulkPublish({rows,readInventory,registry,eligible,directory,now=()=>new Date()}){
 const result=inspectPublishTime({rows,inventory:await readInventory(),registry,eligible});
 const at=now(),path=join(directory,`publish-time-inspection-${stamp(at)}.json`);
 if(!existsSync(directory))mkdirSync(directory,{recursive:true});
 writeFileSync(path,JSON.stringify({...result.record,at:at.toISOString(),withheld_count:result.withheld.length,decisions:result.inspection.decisions,duplicate_pairs:result.inspection.duplicate_pairs,
  note:'Run immediately before publication against the current target inventory; saved campaign inspection files are unchanged.'},null,2)+'\n',{flag:'wx'});
 if(result.withheld.length)throw new Error(`publish_time_inspection_withheld:${result.withheld.map(w=>w.id).join(',')}`);
 return {...result,artifact:path};
}
