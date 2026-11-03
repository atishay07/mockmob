// Freeze independent answer/source work before the separate official-key comparison.
// This tool must never read candidate marking schemes or sealed key sidecars.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {auditSHA as sha} from '../lib/manualSourceAuditSupport.mjs';
import {expectedReleaseBindingV73} from '../lib/releaseEvidenceV73.mjs';
const root=resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-independent-key-candidates');
const output=join(root,'source-support-v3','freeze-before-official-key-comparison-v3.json');
if(existsSync(output))throw Error('independent_freeze_already_exists');
const inputs=new Map();
function read(path){const bytes=readFileSync(join(root,path));inputs.set(path,{path,sha256:sha(bytes)});return JSON.parse(bytes);}
const candidates=new Map();
for(const path of ['questions-blinded-v2.json','2025-26-additional/questions-blinded-2025-26-v2.json']){
 const d=read(path);for(const q of d.items){if(candidates.has(q.item_id))throw Error('duplicate_candidate');candidates.set(q.item_id,{q,path,data:d});}
}
const reviewerFiles=['cbse-blind-key-review-v1.json','cbse-blind-key-review-v2.json','2025-26-additional/cbse-blind-key-review-2025-26-additional-v1.json','2025-26-additional/cbse-blind-key-review-2025-26-v2-changed.json'];
const firstPassIds=new Set();
for(const path of reviewerFiles){const d=read(path);for(const row of d.items){if(row.no_proposedkeyseen!==true&&row.no_proposed_key_seen!==true)throw Error('reviewer_blinding_not_attested:'+row.item_id);firstPassIds.add(row.item_id);}}
const rows=[],sources=new Map();
for(const subject of ['english','business','accountancy','economics']){
 const path=`source-support-v3/${subject}-independent-claim-audit-v3.json`,audit=read(path);
 if(audit.denominator!==16||audit.items.length!==16)throw Error('subject_audit_denominator_invalid:'+subject);
 for(const row of audit.items){
  const current=candidates.get(row.item_id);if(!current||current.path!==row.candidate_file||!firstPassIds.has(row.item_id)||row.candidate_file_sha256!==inputs.get(current.path).sha256)throw Error('question_or_review_binding_mismatch:'+row.item_id);
  const stimulus=current.data.stimuli?.find(s=>s.stimulus_id===current.q.stimulus_id)?.text;
  const view={question:current.q.question,options:current.q.options,...(row.subject==='english_core'?{stimulus}: {})};
  if(sha(JSON.stringify(view))!==row.question_view_sha256||row.source_answerability_review_complete!==true||row.option_claim_checks.length!==current.q.options.length)throw Error('question_view_or_option_audit_incomplete:'+row.item_id);
  if(row.construction_gate==='pass'&&(!row.unique_key_supported||!current.q.options.some(o=>o.label===row.independently_derived_key)))throw Error('positive_key_not_unique_or_present:'+row.item_id);
  for(const span of row.decisive_support){
   if(row.subject==='english_core'){
    if(typeof stimulus!=='string'||sha(stimulus)!==span.stimulus_text_sha256||stimulus.slice(span.start,span.end)!==span.quote)throw Error('stimulus_quote_changed:'+row.item_id);
   }else{
    const bytes=readFileSync(span.cache_path),data=JSON.parse(bytes),page=(Array.isArray(data)?data:data.pages).find(p=>p.page===span.physical_pdf_page);
    if(sha(bytes)!==span.cache_sha256||!page||sha(page.text)!==span.page_text_sha256||page.text.slice(span.quote_start,span.quote_end)!==span.quote||sha(readFileSync(span.pdf_path))!==span.pdf_sha256)throw Error('source_quote_or_pdf_changed:'+row.item_id);
    sources.set(span.cache_path,{path:span.cache_path,sha256:span.cache_sha256,pdf_path:span.pdf_path,pdf_sha256:span.pdf_sha256});
   }
  }
  rows.push({item_id:row.item_id,subject:row.subject,candidate_file:row.candidate_file,question_view_sha256:row.question_view_sha256,independently_derived_key:row.independently_derived_key,construction_gate:row.construction_gate,construction_reasons:row.construction_reasons,audit_path:path,audit_sha256:inputs.get(path).sha256});
 }
}
if(rows.length!==64||new Set(rows.map(r=>r.item_id)).size!==64||candidates.size!==64)throw Error('complete_64_item_freeze_required');
const result={at:new Date().toISOString(),phase:'independent_answers_and_source_derivations_frozen_before_official_key_comparison',denominator:64,option_claims:254,construction_passes:rows.filter(r=>r.construction_gate==='pass').length,withheld:rows.filter(r=>r.construction_gate==='withheld').length,inputs:[...inputs.values()],sources:[...sources.values()],rows,prospective_verifier_binding:expectedReleaseBindingV73(),custody_disclosure:{first_pass_reviewers_attested_key_hidden:true,construction_author_knew_preexisting_discrepancy_notes:true,sealed_candidate_key_sidecars_read_by_this_tool:false,paid_fit_evaluations:0,release_or_publication:false},limitations:['Construction authors necessarily read source candidates; no paid fit result or benchmark-driven validator tuning has occurred on this corpus.','These are adapted CBSE practice references, not authentic CUET PYQs.','Only a later fixed study can measure validator reliability; these source-audit counts are not model yield or accuracy.']};
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,sha256:sha(readFileSync(output)),denominator:64,option_claims:254,construction_passes:result.construction_passes,withheld:result.withheld,official_key_comparison:'next_separate_post_freeze_stage'}));
