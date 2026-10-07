import {hashJSON,inventoryFingerprint} from '../../../data/question_factory_policy.mjs';
import {publicationEligibility} from '../../../data/evidence_registry.js';
import {factoryPassageGroup} from './factoryCore.mjs';
const normalized=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}₹]+/gu,' ').trim();
// Exact content and identical semantic target/answer combinations cannot inflate
// inventory. Broad chapter or formula tags alone do not prove a duplicate.
export function inspectBatch(rows,{eligible=publicationEligibility}={}){
 const decisions=[],seen=new Map(),lexicalTargets=new Map();
 for(const job of rows.filter(j=>['eligible','published'].includes(j.state))){
  const q=job.candidate,check=eligible(q);if(!check.eligible){decisions.push({id:job.id,reason:'inspection_evidence_invalid',details:check.reasons});continue;}
  if(q.subject==='english'&&/every english clause has two parts/i.test(q.body)){
   decisions.push({id:job.id,reason:'unsupported_exact_clause_generalization',basis:'The supplied clause reference states at least two parts; the generated universal exact-two assertion removes that qualification.'});continue;
  }
  if(q.subject==='economics'&&q.question_type==='sequence_ordering'&&/fresh loan/i.test(q.body)&&/logical order/i.test(q.body)&&/creates a liability/i.test(q.body)&&!/stipulated|specified procedure|must first/i.test(q.body)){
   decisions.push({id:job.id,reason:'uncertain_classification_step_order',basis:'Recognizing a loan liability and noting repayment obligations can precede one another. The stem does not stipulate a unique procedure.'});continue;
  }
  // NCERT 6.5.4 distinguishes dividend/interest classification for financial
  // and non-financial enterprises. A generic AS-3 heading does not state which
  // enterprise is reporting. Keep an uncertain classification key withheld.
  if(q.chapter==='Cash Flow Statement'&&/\b(?:dividend|interest)\b/i.test(q.body)&&/\b(?:investing|operating|financing)\b/i.test(q.body)&&
    !/\b(?:non[-\s]*financial|financial)\s+(?:enterprise|company|institution)\b/i.test(q.body)){
   decisions.push({id:job.id,reason:'missing_financial_enterprise_status',basis:'NCERT Cash Flow Statement 6.5.4: financial-enterprise interest/dividends received are operating; non-financial-enterprise receipts are investing.'});continue;
  }
  const fingerprint=inventoryFingerprint(q);
  if(seen.has(fingerprint))decisions.push({id:job.id,reason:'duplicate_content',duplicate_of:seen.get(fingerprint)});else seen.set(fingerprint,job.id);
  // Four paraphrases testing usage of the same named word do not create four
  // new lexical targets, even when their correct sentence texts differ.
  if(['synonym','antonym','correct_word_usage'].includes(q.question_type)){
   const quoted=[...String(q.body||'').matchAll(/["“‘']([a-z][a-z-]{1,30})["”’']/gi)].map(m=>normalized(m[1]));
   const targets=[...new Set(quoted)];
   if(targets.length===1){const target=[q.subject,q.question_type,targets[0]].join(':');
    if(lexicalTargets.has(target)){if(!decisions.some(d=>d.id===job.id))decisions.push({id:job.id,reason:'duplicate_lexical_target',duplicate_of:lexicalTargets.get(target),target:targets[0]});}
    else lexicalTargets.set(target,job.id);
   }
  }
 }
 const approved=rows.filter(j=>['eligible','published'].includes(j.state)&&!decisions.some(d=>d.id===j.id)),pairs=[];
 for(let i=0;i<approved.length;i++)for(let k=i+1;k<approved.length;k++){
  const a=approved[i],b=approved[k],x=a.candidate,y=b.candidate;
  if(x.subject!==y.subject||x.chapter!==y.chapter||x.question_type!==y.question_type)continue;
  const answer=q=>normalized(q.options['ABCD'.indexOf(q.correct_answer)]);
  const conceptEqual=x.concept_id&&normalized(x.concept_id)===normalized(y.concept_id);
  const words=q=>new Set(normalized(q.body).split(' ')),wx=words(x),wy=words(y),similarity=[...wx].filter(w=>wy.has(w)).length/Math.max(wx.size,wy.size);
  const sameQuestion=normalized(x.body)===normalized(y.body)&&normalized(x.passage_text)===normalized(y.passage_text)&&answer(x)===answer(y);
  // Equal correct text alone is common for numerical or matching options.
  // Require both a specific shared concept and strongly matching actual stems.
  if(sameQuestion||conceptEqual&&answer(x)===answer(y)&&similarity>=.8){
   pairs.push({a:a.id,b:b.id,similarity,concept:x.concept_id});
   if(!decisions.some(d=>d.id===b.id))decisions.push({id:b.id,reason:'duplicate_idea_conservative',duplicate_of:a.id});
  }
 }
 const kept=approved.filter(j=>!decisions.some(d=>d.id===j.id));
 const count=key=>Object.fromEntries([...new Set(kept.map(j=>j.candidate[key]))].map(k=>[k,kept.filter(j=>j.candidate[key]===k).length]));
 const positions=count('correct_answer'),formatPositions={};for(const j of kept){const q=j.candidate;formatPositions[q.question_type]??={};formatPositions[q.question_type][q.correct_answer]=(formatPositions[q.question_type][q.correct_answer]||0)+1;}
 return {contract:'evidence-content-idea-inspection-v1',content_hash:hashJSON(rows.map(j=>({id:j.id,candidate:j.candidate,result:j.result}))),decisions,duplicate_pairs:pairs,
  denominator:rows.length,approved:kept.length,answer_positions:positions,answer_positions_by_format:formatPositions,formats:count('question_type'),difficulty:count('difficulty'),
  longest_same_answer_run:kept.reduce((a,j)=>{const p=j.candidate.correct_answer;a.run=a.last===p?a.run+1:1;a.last=p;a.maximum=Math.max(a.maximum,a.run);return a;},{last:null,run:0,maximum:0}).maximum,
  limitation:'Deterministic duplicate detection and independent novelty gates reduce repeated content; semantic equivalence beyond these checks is not guaranteed.',
  ready:rows.length===100&&rows.every(j=>['eligible','quarantined','published'].includes(j.state))&&decisions.length===0};
}

// Inspect new candidates against the actual usable bank before publication.
// Existing rows are read-only context, never reclassified by this inspection.
export function inspectAgainstInventory(rows,inventory,{eligible=publicationEligibility,registry}={}){
 const ids=new Set(rows.map(j=>j.id)),existing=inventory.filter(q=>!ids.has(q.id)&&eligible(q).eligible).map(q=>({id:q.id,state:'published',candidate:q}));
 const combined=inspectBatch([...existing,...rows],{eligible});
 const decisions=combined.decisions.filter(d=>ids.has(d.id));
 // Apply the publisher's existing atomic contract before any RPC. Individually
 // valid children cannot publish a group with differing chapter classifications,
 // missing children, changed stimulus text or conflicting order positions.
 if(registry)for(const groupId of new Set(rows.filter(j=>['eligible','published'].includes(j.state)).map(j=>j.candidate?.passage_group_id).filter(Boolean))){
  const siblings=rows.filter(j=>['eligible','published'].includes(j.state)&&j.candidate?.passage_group_id===groupId);
  try{factoryPassageGroup(siblings.map(j=>j.candidate),registry);}
  catch(error){for(const j of siblings)if(!decisions.some(d=>d.id===j.id))decisions.push({id:j.id,reason:'inspection_passage_group_contract',details:error.message,group_id:groupId});}
 }
 const failedGroups=new Set(rows.filter(j=>decisions.some(d=>d.id===j.id)).map(j=>j.candidate?.passage_group_id).filter(Boolean));
 for(const j of rows)if(['eligible','published'].includes(j.state)&&failedGroups.has(j.candidate?.passage_group_id)&&!decisions.some(d=>d.id===j.id))decisions.push({id:j.id,reason:'atomic_group_sibling_withheld'});
 const kept=rows.map(j=>decisions.some(d=>d.id===j.id)?{...j,state:'quarantined'}:j),summary=inspectBatch(kept,{eligible});
 return {...summary,content_hash:hashJSON(rows.map(j=>({id:j.id,candidate:j.candidate,result:j.result}))),decisions,ready:summary.ready&&decisions.length===0,inventory_compared:existing.length,inventory_ids_hash:hashJSON(existing.map(j=>j.id).sort()),duplicate_pairs:combined.duplicate_pairs.filter(p=>ids.has(p.a)||ids.has(p.b))};
}
