import { randomUUID } from 'node:crypto';
import { FACTORY_SUBJECTS,FACTORY_PILOT_TARGET,inventoryFingerprint } from '../../../data/question_factory_policy.mjs';

export const ACTIVE_JOB_STATES=['queued','waiting','validating','repairing','eligible','pilot_eligible'];
// Originals are consumed before adaptations. Complete passage units are never
// split to meet a quota. Coverage balances only chapters backed by real anchors.
export function planFactoryJobs(registry,existing,publications,{perSubject=50,phase='pilot',pilotTarget=FACTORY_PILOT_TARGET,inventory=new Set()}={}) {
  if(!Number.isSafeInteger(pilotTarget) || pilotTarget<4 || pilotTarget>800 || pilotTarget%4!==0)throw new Error('balanced_pilot_target_required');
  if(phase==='pilot')perSubject=pilotTarget/4;
  if(!Number.isSafeInteger(perSubject) || perSubject<1 || perSubject>(phase==='pilot'?200:50))throw new Error('enqueue_size_out_of_range');
  if(phase==='pilot' && existing.length)throw new Error('pilot_already_enqueued');
  const jobs=[],limit=phase==='pilot'?pilotTarget:phase==='1000'?1000:10000;
  let room=limit-publications.length-existing.filter(j=>ACTIVE_JOB_STATES.includes(j.state)).length;
  for(const subject of FACTORY_SUBJECTS) {
    const reserved=new Set(registry.calibration_anchor_ids || []);
    const anchors=(registry.examples || []).filter(a=>a.subject===subject && a.generation_ready!==false && !reserved.has(a.id) && a.final_key_matched && !a.dropped && /^[ABCD]$/.test(a.correct_answer) && registry.packs?.[a.source_pack_id]?.state==='active');
    const units=[];const seen=new Set();
    for(const a of anchors) {
      const unitKey=a.passage_group_id || a.id;if(seen.has(unitKey))continue;seen.add(unitKey);
      const group=a.passage_group_id?registry.passage_groups?.[a.passage_group_id]:null;
      if(a.passage_group_id && group?.state!=='active')continue;
      const members=group?group.anchor_ids.map(id=>anchors.find(anchor=>anchor.id===id)): [a];
      if(members.some(m=>!m))continue;units.push(members);
    }
    const subjectPublications=publications.filter(p=>p.subject===subject).length;
    const pending=existing.filter(j=>j.subject===subject && ACTIVE_JOB_STATES.includes(j.state)).length;
    let remaining=Math.min(perSubject,2500-subjectPublications-pending,room);
    const coverage=new Map();
    for(const j of existing.filter(j=>j.subject===subject))coverage.set(j.chapter,(coverage.get(j.chapter)||0)+1);
    while(remaining>0) {
      const available=units.filter(unit=>unit.length<=remaining);
      if(!available.length)break;
      const unimported=available.filter(unit=>unit.every(a=>a.original_ready!==false && !inventory.has(inventoryFingerprint(a)) && ![...existing,...jobs].some(j=>j.anchor_id===a.id && j.kind==='authentic_pyq')));
      const original=unimported.length>0;
      const choices=original?unimported:available;
      const history=[...existing,...jobs];
      const used=unit=>history.filter(j=>unit.some(a=>a.id===j.anchor_id)).length;
      choices.sort((a,b)=>(coverage.get(a[0].chapter)||0)-(coverage.get(b[0].chapter)||0) || used(a)-used(b) || a[0].id.localeCompare(b[0].id));
      const unit=choices[0],groupId=unit[0].passage_group_id?`factory_pg_${randomUUID()}`:null;
      for(const a of unit)jobs.push({id:randomUUID(),subject,chapter:a.chapter,anchor_id:a.id,kind:original?'authentic_pyq':'pyq_adapted',passage_group_id:groupId});
      coverage.set(unit[0].chapter,(coverage.get(unit[0].chapter)||0)+unit.length);
      remaining-=unit.length;room-=unit.length;
    }
  }
  if(phase==='pilot' && jobs.length!==pilotTarget)throw new Error('pilot_requires_complete_source_backed_candidates');
  return jobs;
}
