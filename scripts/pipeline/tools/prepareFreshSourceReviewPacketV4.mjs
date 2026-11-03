// Remove all first-solver decisions before a separately frozen answer-blind review.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {auditSHA as sha} from '../lib/manualSourceAuditSupport.mjs';
import {expectedReleaseBindingV73} from '../lib/releaseEvidenceV73.mjs';
const root=resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-2024-25-source-keys-v4');
const packetPath=join(root,'questions-blinded-v1.json'),packetBytes=readFileSync(packetPath),packet=JSON.parse(packetBytes);
if(JSON.stringify(packet.pre_acquisition_binding)!==JSON.stringify(expectedReleaseBindingV73())||packet.contains_proposed_answers!==false||packet.contains_explanations!==false)throw Error('current_frozen_question_only_contract_required');
const paths=['english-source-derivation-v2.json','accountancy-source-derivation-v1.json','business-source-derivation-v1.json','economics-source-derivation-v1.json'];
const audits=paths.map(p=>{const path=join(root,'source-support',p),bytes=readFileSync(path),audit=JSON.parse(bytes);if(audit.packet_sha256!==sha(packetBytes)||audit.official_marking_scheme_read!==false||audit.paid_validator_results_seen!==false||audit.raw_denominator!==8)throw Error('pre_key_source_derivation_required:'+p);return{path,sha256:sha(bytes),audit};});
const sourceRows=new Map(audits.flatMap(a=>a.audit.items).map(r=>[r.item_id,r]));
if(sourceRows.size!==32||packet.items.length!==32)throw Error('all_32_raw_cases_required');
const items=packet.items.map(q=>{
 if(typeof q.body!=='string'||!q.body.trim()||q.options.length!==4||q.options.some(o=>!['A','B','C','D'].includes(o.key)||!o.text))throw Error('complete_four_option_question_required:'+q.item_id);
 const row=sourceRows.get(q.item_id);if(!row||!row.decisive_support?.length)throw Error('source_view_required:'+q.item_id);
 const stimulus=packet.stimuli.find(s=>s.stimulus_id===q.stimulus_id);
 const expectedView=sha(JSON.stringify(stimulus?{body:q.body,options:q.options,stimulus:stimulus.text}:{body:q.body,options:q.options}));
 if(row.question_view_sha256!==expectedView)throw Error('body_options_stimulus_binding_required:'+q.item_id);
 const sources=row.decisive_support.map(s=>{
  if(!s.quote||!s.page_text_sha256)throw Error('actual_source_excerpt_required:'+q.item_id);
  if(s.kind==='adapted_question_stimulus'){
   if(!stimulus||s.packet_sha256!==sha(packetBytes)||s.stimulus_sha256!==sha(stimulus.text)||stimulus.text.slice(s.quote_start,s.quote_end)!==s.quote)throw Error('stimulus_excerpt_changed:'+q.item_id);
  }else{
   const cacheBytes=readFileSync(s.cache_path),cache=JSON.parse(cacheBytes),page=cache.pages.find(p=>p.page===(s.physical_pdf_page??s.html_view));
   const documentPath=s.pdf_path||s.document_path,documentHash=s.pdf_sha256||s.document_sha256;
   if(sha(cacheBytes)!==s.cache_sha256||!page||sha(page.text)!==s.page_text_sha256||page.text.slice(s.quote_start,s.quote_end)!==s.quote||sha(readFileSync(documentPath))!==documentHash)throw Error('document_excerpt_identity_changed:'+q.item_id);
  }
  return{source_id:s.source_id,kind:s.kind||'official_teaching_reference',url:s.official_url||null,quote:s.quote,physical_pdf_page:s.physical_pdf_page??null,page_text_sha256:s.page_text_sha256,document_sha256:s.pdf_sha256||s.document_sha256||s.packet_sha256,permission_basis:s.permission_basis||'Original adapted practice stimulus; source lineage is preserved in the frozen packet.'};
 });
 return{item_id:q.item_id,subject:q.subject,chapter:q.chapter,body:q.body,options:q.options,...(stimulus?{stimulus_id:stimulus.stimulus_id,passage_text:stimulus.text,passage_words:stimulus.words}:{}),source_excerpts:sources};
});
const review={schema:'fresh-independent-review-question-source-view-v4',at:new Date().toISOString(),packet_sha256:sha(packetBytes),contract_binding:packet.pre_acquisition_binding,raw_denominator:32,contains_proposed_answers:false,contains_proposed_explanations:false,contains_first_solver_decisions:false,official_marking_schemes_included:false,items,review_requirements:['Derive the answer before inspecting any proposed answer or marking scheme.','Check each alternative under its strongest reasonable within-syllabus reading.','Record abstention and decisive missing support rather than forcing an answer.','Assess CUET readiness against syllabus, format and level; valid easy questions need no artificial traps.','Freeze all 32 first-pass observations and input hash before official-key comparison.']};
const output=join(root,'independent-second-review-packet.json');if(existsSync(output))throw Error('immutable_second_review_packet_already_exists');
writeFileSync(output,JSON.stringify(review,null,2)+'\n',{flag:'wx'});
const custody=join(root,'FIRST-DERIVATION-FREEZE.json');if(existsSync(custody))throw Error('immutable_derivation_custody_already_exists');
writeFileSync(custody,JSON.stringify({at:new Date().toISOString(),raw_denominator:32,packet_sha256:sha(packetBytes),review_packet_sha256:sha(readFileSync(output)),contract_binding:packet.pre_acquisition_binding,first_derivations:audits.map(({path,sha256})=>({path,sha256})),source_key_positive_candidates:audits.reduce((n,a)=>n+a.audit.provisional_positive,0),withheld:audits.reduce((n,a)=>n+a.audit.withheld,0),official_candidate_keys_read:false,independent_second_review_complete:false,CUET_fit_evaluation_complete:false,release:false,publication:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:sha(readFileSync(output)),raw_denominator:32,source_excerpts:items.reduce((n,i)=>n+i.source_excerpts.length,0),proposed_answers:false,paid_calls:0}));
