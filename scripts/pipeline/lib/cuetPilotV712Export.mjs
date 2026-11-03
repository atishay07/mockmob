// Read-only reporting for the v7.9 measurement pilot: per-candidate rows, batch inspection against the usable inventory, preparation-value,
// difficulty, format-variety and answer-position analysis, and gross cost. No provider call, no ledger write, no publication.
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {inspectAgainstInventory,keyedOrder,BATCH_INSPECTION_CONTRACT} from './batchInspection.mjs';
import {measurementInspectionEligibility} from './measurementInspectionVNext.mjs';
import {preparationValueV76} from './preparationValueV76.mjs';
import {FACTORY_VERIFIER_VERSION_V712} from './contractV712.mjs';
import {V712_PROMPT_HASH} from './factoryEvidenceV712.mjs';
import {reasoningStepsV76} from './factoryEvidenceV76.mjs';
import {sourceMaterial} from './factoryEvidence.mjs';
import {applyClosure,isTerminal} from './cuetPilotV75Run.mjs';
import {PILOT_SUBJECTS,PILOT_WAVE_SIZE} from './cuetPilotV712Plan.mjs';

export const EXPORT_CONTRACT='cuet-pilot-v712-export-v1';
const count=(list,fn)=>list.reduce((n,x)=>{const k=fn(x);if(k===undefined||k===null)return n;n[k]=(n[k]||0)+1;return n;},{});
const micro=n=>Math.round(n)/1e6;

export function longestRun(sequence){let best=0,run=0,last=null;for(const x of sequence){run=x===last?run+1:1;last=x;best=Math.max(best,run);}return best;}

// Answer-position pattern overall, per subject, per passage group and against the requested position.
export function positionPatterns(items){
  const ordered=[...items].sort((a,b)=>a.number-b.number),keys=list=>list.map(i=>i.key);
  const groups={};for(const item of ordered.filter(i=>i.group))(groups[item.group]??=[]).push(item);
  return {n:ordered.length,overall:count(ordered,i=>i.key),by_subject:Object.fromEntries(PILOT_SUBJECTS.map(subject=>[subject,count(ordered.filter(i=>i.subject===subject),i=>i.key)])),
    longest_same_key_run:{overall:longestRun(keys(ordered)),by_subject:Object.fromEntries(PILOT_SUBJECTS.map(subject=>[subject,longestRun(keys(ordered.filter(i=>i.subject===subject)))]))},
    by_passage_group:Object.fromEntries(Object.entries(groups).map(([group,rows])=>[group,{keys:rows.sort((a,b)=>a.order-b.order).map(r=>r.key).join(''),all_same:new Set(rows.map(r=>r.key)).size===1}])),
    requested_position_matched:ordered.filter(i=>i.key===i.requested).length,
    share_of_most_common:ordered.length?Math.max(...Object.values(count(ordered,i=>i.key)))/ordered.length:null};
}
const positionItem=job=>({number:job.number,subject:job.subject,group:job.passage_group_id||null,order:job.order_index??0,key:job.candidate?.correct_answer,requested:job.requested_answer_position});

export function summariseChecks(checks){
  return Object.fromEntries(Object.entries(checks||{}).map(([stage,c])=>[stage,{passed:c.passed??null,provider:c.provider??null,model:c.model??null,effort:c.effort??null,
    solved_key:c.solved_key??null,exam_fit:c.exam_fit??null,reasoning_steps:c.cuet_fit_result?.reasoning_steps??null,reasons:(c.reasons||[]).slice(0,6),failure_details:(c.failure_details||[]).slice(0,4)}]));
}

export function buildPilotExport({campaign,prereg,state,registry,accounting=null,inventoryRows=[],now=new Date().toISOString(),verifyEvidence=true}){
  const jobs=campaign.jobs.map(j=>structuredClone(state.jobs[j.id]));
  applyClosure(jobs);
  const ids=campaign.jobs.map(j=>j.id),inventoryIds=new Set(inventoryRows.map(q=>q.id));
  const profile={measurement_only:true,publication_policy:'never',verifier_version:FACTORY_VERIFIER_VERSION_V712,topology:'dual_blind',prompt_hash:V712_PROMPT_HASH};
  const pilotEligible=measurementInspectionEligibility(profile,registry,ids);
  const eligible=q=>inventoryIds.has(q.id)?{eligible:true}:pilotEligible(q);
  const finished=jobs.filter(isTerminal);
  const inspection=inspectAgainstInventory(jobs,inventoryRows,{eligible,registry});
  const withheld=new Map(inspection.decisions.map(d=>[d.id,d]));
  // The inspection's own readiness flag is tied to the 100-candidate campaigns; a pilot is ready when all 40 are terminal and nothing is withheld.
  const inspectionReport={...inspection,ready:undefined,pilot_ready:jobs.length===ids.length&&jobs.every(isTerminal)&&inspection.decisions.length===0,
    contract:BATCH_INSPECTION_CONTRACT,pilot_denominator:ids.length,evidence_signature_verified:verifyEvidence,
    withheld_by_inspection:inspection.decisions.length,note:'Withholding here is a measurement outcome: nothing is published and no stored record is changed.'};

  const requests=accounting?.requests||[];
  const byCandidate=requests.reduce((m,r)=>{(m[r.candidate_id]??=[]).push(r);return m;},{});
  const costOf=id=>{const list=byCandidate[id]||[];return {requests:list.length,settled_usd:micro(list.reduce((n,r)=>n+r.settled_micro,0)),held_usd:micro(list.reduce((n,r)=>n+r.held_micro,0)),
    gross_usd:micro(list.reduce((n,r)=>n+r.settled_micro+r.held_micro,0))};};
  const waveOf=job=>Math.floor((job.number-1)/PILOT_WAVE_SIZE)+1;

  const rows=jobs.map(job=>{
    const q=job.candidate||{},record=q.evidence?.record,checks=record?.checks||job.result?.checks||{};
    const finalState=!isTerminal(job)?(job.state==='queued'?'not_run':'in_progress'):withheld.has(job.id)&&job.state==='eligible'?'eligible_withheld_by_inspection':job.state;
    const steps=reasoningStepsV76(checks);
    const prep=job.candidate?.body?preparationValueV76(job.candidate,{reasoningSteps:steps}):null;
    let excerpts=[];try{excerpts=sourceMaterial(registry,q.source_refs||job.source_refs||[]);}catch{excerpts=[];}
    return {id:job.id,number:job.number,wave:waveOf(job),subject:job.subject,chapter:q.chapter||job.chapter,topic:job.topic,
      format_intended:job.format,format_authored:q.question_type??null,difficulty_intended:job.difficulty,difficulty_authored:q.difficulty??null,
      requested_answer_position:job.requested_answer_position,key:q.correct_answer??null,state:job.state,final_state:finalState,repair_count:job.repair_count||0,
      passage_group_id:job.passage_group_id||null,passage_text:q.passage_text||job.passage_text||'',
      question:{body:q.body??null,options:q.options??null,correct_answer:q.correct_answer??null,explanation:q.explanation??null,option_analysis:q.option_analysis??null,stated_assumptions:q.stated_assumptions??null},
      learning_objective:q.learning_objective??null,decisive_quotes:q.evidence_quotes??null,source_refs:q.source_refs||job.source_refs,supporting_excerpts:excerpts,
      verdicts:summariseChecks(checks),cuet_fit:record?.cuet_fit??null,reasoning_steps:steps??null,preparation_value:prep,
      rejection_reasons:job.state==='quarantined'?(job.result?.reasons||[]):[],failed_stage:job.result?.failed_stage||null,first_attempt_reasons:job.first_result?.reasons||null,
      inspection_decision:withheld.get(job.id)||null,author_failure:job.author_failure||null,normalization:job.normalization||null,item_cost:costOf(job.id)};
  });

  const authored=rows.filter(r=>r.key),approved=rows.filter(r=>r.final_state==='eligible');
  const approvedJobs=jobs.filter(j=>rows.find(r=>r.id===j.id).final_state==='eligible');
  const prepFindings=rows.flatMap(r=>(r.preparation_value?.findings||[]).map(f=>({...f,id:r.id,subject:r.subject,final_state:r.final_state})));
  const reasonsOf=r=>r.final_state==='quarantined'?(r.failed_stage||r.rejection_reasons[0]||'unknown'):null;
  const subjectBlock=subject=>{const list=rows.filter(r=>r.subject===subject),done=list.filter(r=>['eligible','quarantined','eligible_withheld_by_inspection'].includes(r.final_state));
    return {denominator:list.length,terminal:done.length,eligible_machine:list.filter(r=>r.state==='eligible').length,approved_after_inspection:list.filter(r=>r.final_state==='eligible').length,
      quarantined:list.filter(r=>r.state==='quarantined').length,withheld_by_inspection:list.filter(r=>r.final_state==='eligible_withheld_by_inspection').length,
      repaired:list.filter(r=>r.repair_count>0).length,gross_usd:micro(list.reduce((n,r)=>n+r.item_cost.gross_usd*1e6,0))};};
  const gross=requests.reduce((n,r)=>n+r.settled_micro+r.held_micro,0),settled=requests.reduce((n,r)=>n+r.settled_micro,0),held=requests.reduce((n,r)=>n+r.held_micro,0);
  const stageCost={};for(const r of requests){const k=`${r.stage||'unknown'}/${r.provider||'unknown'}`;const s=stageCost[k]??={requests:0,settled_usd:0,held_usd:0};s.requests++;s.settled_usd+=r.settled_micro/1e6;s.held_usd+=r.held_micro/1e6;}
  const report={contract:EXPORT_CONTRACT,pilot_id:campaign.id,at:now,measurement_only:true,publication_policy:'never',newly_published:0,
    denominator:ids.length,terminal:finished.length,complete:finished.length===ids.length,untouched:rows.filter(r=>r.final_state==='not_run').length,
    machine_eligible:rows.filter(r=>r.state==='eligible').length,approved_after_inspection:approved.length,quarantined:rows.filter(r=>r.state==='quarantined').length,
    withheld_by_inspection:rows.filter(r=>r.final_state==='eligible_withheld_by_inspection').length,
    yield_machine:ids.length?rows.filter(r=>r.state==='eligible').length/ids.length:null,yield_after_inspection:ids.length?approved.length/ids.length:null,
    stop_reason:state.stop_reason,circuit_open:state.circuit_open,waves:state.waves,by_subject:Object.fromEntries(PILOT_SUBJECTS.map(s=>[s,subjectBlock(s)])),
    repairs:{repaired:rows.filter(r=>r.repair_count>0).length,eligible_after_repair:rows.filter(r=>r.repair_count>0&&r.state==='eligible').length,
      repair_triggers:count(rows.filter(r=>r.first_attempt_reasons),r=>String(r.first_attempt_reasons[0]).slice(0,60))},
    rejection_by_stage:count(rows,reasonsOf),
    cost:{settled_usd:micro(settled),held_usd:micro(held),gross_usd:micro(gross),requests:requests.length,unresolved:requests.filter(r=>r.state==='unresolved').length,
      cap_usd:prereg.cap_usd,conservative_maximum_usd:prereg.cost?.pilot_maximum_usd??null,by_stage:stageCost,
      per_machine_eligible_usd:rows.some(r=>r.state==='eligible')?micro(gross)/rows.filter(r=>r.state==='eligible').length:null,
      per_approved_usd:approved.length?micro(gross)/approved.length:null,receipt_complete:accounting?.receipt_complete??null,
      basis:'Provider usage receipts at recorded rates plus conservative maximum holds for unresolved requests. No provider invoice has been obtained.'},
    format_variety:{intended:count(rows,r=>r.format_intended),authored:count(authored,r=>r.format_authored),approved:count(approved,r=>r.format_authored),
      requested_format_kept:authored.filter(r=>r.format_authored===r.format_intended).length,
      approved_distinct_formats_by_subject:Object.fromEntries(PILOT_SUBJECTS.map(s=>[s,[...new Set(approved.filter(r=>r.subject===s).map(r=>r.format_authored))].length]))},
    difficulty:{intended:count(rows,r=>r.difficulty_intended),authored:count(authored,r=>r.difficulty_authored),approved:count(approved,r=>r.difficulty_authored),
      intended_vs_authored_mismatch:authored.filter(r=>r.difficulty_authored!==r.difficulty_intended).length,
      reasoning_steps_of_approved:count(approved,r=>r.reasoning_steps),difficulty_label_overstated_findings:prepFindings.filter(f=>f.code==='difficulty_label_overstated').length},
    answer_positions:{requested:count(rows,r=>r.requested_answer_position),authored:positionPatterns(authoredPositionItems(jobs)),approved:positionPatterns(approvedJobs.map(positionItem))},
    preparation_value:{findings_by_code:count(prepFindings,f=>`${f.code}${f.blocking?':blocking':':advisory'}`),candidates_with_blocking:new Set(prepFindings.filter(f=>f.blocking).map(f=>f.id)).size,
      first_attempt_blocked_on_preparation_value:rows.filter(r=>(r.first_attempt_reasons||[]).includes('failed:preparation_value')).length,
      learning_objective_present:authored.filter(r=>r.learning_objective?.objective).length,authored_total:authored.length,
      ordering_printed_order_key:jobs.filter(j=>j.candidate&&/order|sequence|jumble/i.test(j.candidate.question_type||'')&&keyedOrder({options:j.candidate.options,correct_answer:j.candidate.correct_answer}).join('')==='ABCD').length,
      note:'Findings are recomputed from the final candidate text with the frozen v7.9 rules; first_attempt_blocked_on_preparation_value counts items whose first validation was blocked.'},
    inspection:{contract:BATCH_INSPECTION_CONTRACT,inventory_compared:inspection.inventory_compared,inventory_ids_hash:inspection.inventory_ids_hash,decisions:inspection.decisions,
      duplicate_pairs:inspection.duplicate_pairs,repeated_ordering_ideas:inspection.decisions.filter(d=>d.rule==='repeated_ordering_task').length,pilot_ready:inspectionReport.pilot_ready,limitation:inspection.limitation},
    gaps_at_preparation:prereg.gaps_at_preparation??[],
    limitations:['Measurement only: nothing is published and this does not release v7.9.','Model agreement and ratings are not truth; no human review was performed.','Provider invoices were not obtained.']};
  return {rows,report,inspection:inspectionReport,
    approved:approvedJobs.map(j=>j.candidate),
    rejected:rows.filter(r=>['quarantined','eligible_withheld_by_inspection'].includes(r.final_state)),
    receipts:requests,
    csv:toCsv(rows)};
}
function authoredPositionItems(jobs){return jobs.filter(j=>j.candidate?.correct_answer).map(positionItem);}

export function toCsv(rows){
  const columns=['number','id','wave','subject','chapter','topic','format_intended','format_authored','difficulty_intended','difficulty_authored','requested_answer_position','key','state','final_state','repair_count','learning_objective',
    'body','options','explanation','decisive_quotes','source_refs','rejection_reasons','failed_stage','settled_usd','held_usd','gross_usd'];
  const cell=v=>'"'+String(v&&typeof v==='object'?JSON.stringify(v):v??'').replaceAll('"','""')+'"';
  const value=(r,c)=>c==='body'||c==='options'||c==='explanation'?r.question[c==='body'?'body':c]:c==='settled_usd'||c==='held_usd'||c==='gross_usd'?r.item_cost[c]:r[c];
  return [columns,...rows.map(r=>columns.map(c=>value(r,c)))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export const pilotContentHash=jobs=>hashJSON(jobs.map(j=>({id:j.id,candidate:j.candidate,result:j.result})));
