import { selectNtaQuestionSet } from '../../../data/nta_question_selector.js';
import { rankCandidates } from '../../../data/mock_question_selector.js';
import { publicationEligibilityV716 } from './verifyV716.mjs';
// These explicit versioned consumers cannot promote an arbitrary quality_score field.
export function filterPracticeRowsV716(rows,context={},mode='practice') {
 const eligible=[],rejected=[];
 // A malformed row is rejected on its own; it cannot abort retrieval for every other row.
 rows=(rows || []).filter(row=>{if(row && typeof row==='object')return true;rejected.push({id:null,reasons:['malformed_row']});return false;});
 for (const row of rows) {
  let result;
  try {result=publicationEligibilityV716(row,{...context,mode});} catch {result={eligible:false,reasons:['scorecard_context_invalid']};}
  // Selectors consume the signed decision, never unsigned difficulty/quality columns.
  if (result.eligible) eligible.push({...row,quality_score:result.decision.quality_score / 10,difficulty:result.decision.difficulty.level});
  else rejected.push({id:row.id,reasons:result.reasons});
 }
 const groups=new Map();
 for (const row of rows) if (row.passage_group_id) {
  const group=groups.get(row.passage_group_id)||[]; group.push(row); groups.set(row.passage_group_id,group);
 }
 const blocked=new Set();
 for (const [id,siblings] of groups) {
  const membership=siblings[0].evidence?.record?.passage_group;
  const members=membership?.member_ids;
  const selectedIds=new Set(eligible.map(row=>row.id));
  const complete=membership?.id===id && Array.isArray(members) && members.length>=2 && new Set(members).size===members.length &&
   siblings.length===members.length && siblings.every(row=>members.includes(row.id) && selectedIds.has(row.id) && row.passage_text===siblings[0].passage_text &&
    JSON.stringify(row.evidence?.record?.passage_group)===JSON.stringify(membership));
  if (!complete) {blocked.add(id);for(const row of siblings) if(!rejected.some(item=>item.id===row.id)) rejected.push({id:row.id,reasons:['atomic_passage_group_ineligible']});}
 }
 return {rows:eligible.filter(row=>!blocked.has(row.passage_group_id)),rejected};
}
export function selectNtaQuestionSetV716(rows,count,options={}) {
 const filtered=filterPracticeRowsV716(rows,options,'nta');
 const pool=options.inventoryComplete===true?filtered.rows:filtered.rows.filter(row=>row.evidence.record.decision.difficulty.level!=='hard');
 const selected=selectNtaQuestionSet(pool,count,options);
 return {...selected,scorecard_rejections:filtered.rejected};
}
export function rankPracticeRowsV716(rows,options={}) {
 const mode=options.difficulty || (['easy','medium','hard'].includes(options.mode?.id)?options.mode.id:options.mode?.id==='full_mock'?'full_mock':'practice');
 const filtered=filterPracticeRowsV716(rows,options,mode);
 return {rows:rankCandidates(filtered.rows,options),scorecard_rejections:filtered.rejected};
}
