import {existsSync,readFileSync} from 'node:fs';
import {saveAtomicArtifact} from './atomicArtifact.mjs';
import {keyedOrder} from './batchInspection.mjs';

// One registered ordering source yields one ordering idea: its steps and their
// order. Reusing it (with relabelled steps or renamed characters) repeats the
// task, so the allocation is consumed across campaigns and restarts.
export const IDEA_ALLOCATION_CONTRACT='ordering-source-allocation-v1';
export const DEFAULT_IDEA_ALLOCATION_PATH='data/question-factory-runtime/idea-allocations.json';
const refKey=r=>[r.id,r.version,r.locator,r.support_hash].join(':');
export const orderingFormat=format=>/order|sequence|jumble/i.test(String(format||''));
export const orderingIdeaKey=refs=>'ordering:'+[...new Set((refs||[]).map(refKey))].sort().join('|');
// Bank rows often lack question_type: four pure letter-sequence options mark an ordering item.
export const isOrderingItem=q=>orderingFormat(q?.question_type||q?.format)||
 (Array.isArray(q?.options)&&q.options.length===4&&q.options.every((_,i)=>keyedOrder({options:q.options,correct_answer:'ABCD'[i]}).length===4));

export function loadIdeaAllocations(path=DEFAULT_IDEA_ALLOCATION_PATH){
 if(!existsSync(path))return {contract:IDEA_ALLOCATION_CONTRACT,allocations:{}};
 const value=JSON.parse(readFileSync(path,'utf8'));
 if(value.contract!==IDEA_ALLOCATION_CONTRACT||!value.allocations||typeof value.allocations!=='object')throw Error('idea_allocation_contract_mismatch');
 return value;
}
// Ordering ideas already consumed by usable inventory, planned briefs or the
// persisted ledger. Derivation from inventory keeps restarts safe even without the file.
export function consumedOrderingIdeas(context=[],allocations={allocations:{}}){
 const used=new Set(Object.keys(allocations.allocations||{}));
 for(const q of context)if(isOrderingItem(q)&&q.source_refs?.length)used.add(orderingIdeaKey(q.source_refs));
 return used;
}
// Append-only: an existing allocation is never reassigned or removed.
export function recordIdeaAllocations(jobs,{campaignId,path=DEFAULT_IDEA_ALLOCATION_PATH,at=new Date().toISOString()}={}){
 if(!campaignId)throw Error('idea_allocation_campaign_required');
 const ledger=loadIdeaAllocations(path);let added=0;
 for(const j of jobs){
  if(!orderingFormat(j.format||j.question_type)||!j.source_refs?.length)continue;
  const key=orderingIdeaKey(j.source_refs),existing=ledger.allocations[key];
  if(existing){if(existing.campaign_id===campaignId&&existing.job_id===j.id)continue;throw Error('ordering_idea_already_allocated:'+key);}
  ledger.allocations[key]={campaign_id:campaignId,job_id:j.id,subject:j.subject,chapter:j.chapter,refs:j.source_refs,allocated_at:at};added++;
 }
 if(added)saveAtomicArtifact(path,ledger);
 return {added,total:Object.keys(ledger.allocations).length};
}
