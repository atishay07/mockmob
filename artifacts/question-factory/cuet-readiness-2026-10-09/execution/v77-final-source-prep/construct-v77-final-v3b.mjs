import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep';
const sha=x=>createHash('sha256').update(x).digest('hex');
const hashJSON=x=>sha(Buffer.from(JSON.stringify(x)));
const read=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
const write=(p,x)=>writeFileSync(join(root,p),JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const v2=read('draft-cases-v2b-PRIVATE.json');
const packet2=read('blind-review-packet-v2b.json');
const overlay2=read('source-overlay-v2b.json');
const col106=read('ncert/lebs106.columns-v3b.json');
const col203=read('ncert/lebs203.columns-v3b.json');
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const copyHash=p=>sha(readFileSync(join(root,p)));
const byPageColumn=(rows,page,column)=>rows.find(x=>x.physical_pdf_page===page&&x.column===column);
const selected=[
  {key:'staffing',doc:'lebs106',rows:col106,page:2,column:'right',start:'Staffing has been described as',end:'into the organisation structure.'},
  {key:'rights_safety',doc:'lebs203',rows:col203,page:7,column:'left',start:'These rights include the following:',end:'meeting quality specifications.'},
  {key:'rights_information_choice',doc:'lebs203',rows:col203,page:7,column:'right',start:'complete information about',end:'a choice from amongst these.'},
  {key:'rights_heard_redressal_education',doc:'lebs203',rows:col203,page:8,column:'left',start:'4. Right to be heard:',end:'consumers in this respect.'},
];
const columns={};
for(const x of selected){
  const row=byPageColumn(x.rows,x.page,x.column);if(!row)throw Error(`column_missing:${x.key}`);
  const a=row.text.indexOf(x.start),b=row.text.indexOf(x.end,a+x.start.length);if(a<0||b<0)throw Error(`column_span_missing:${x.key}`);
  const quote=row.text.slice(a,b+x.end.length);if(row.text.indexOf(quote)!==a)throw Error(`column_span_not_contiguous:${x.key}`);
  columns[x.key]={...x,quote,start_offset:a,end_offset:b+x.end.length,extraction_file:`ncert/${x.doc}.columns-v3b.json`,extraction_sha256:copyHash(`ncert/${x.doc}.columns-v3b.json`)};
}
const newSources={};
for(const [key,x] of Object.entries(columns)){
  const doc=overlay2.sources[`v77v2src-${x.doc}-p${x.page}-${x.key==='staffing'?'bs_staffing':x.key}`];
  const pdfPath=`ncert/${x.doc}.pdf`;
  const id=`v77v3src-${x.doc}-p${x.page}-column-${x.column}-${key}`;
  newSources[id]={id,kind:'reference',state:'active',version:1,title:`NCERT ${x.doc} physical page ${x.page} ${x.column} column`,url:doc?.url||`https://ncert.nic.in/textbook/pdf/${x.doc}.pdf`,identity_sha256:copyHash(pdfPath),extraction_file:x.extraction_file,extraction_sha256:x.extraction_sha256,physical_pdf_page:x.page,column:x.column,crop_bbox_points:byPageColumn(x.rows,x.page,x.column).bbox_points,raw_start_offset:x.start_offset,raw_end_offset:x.end_offset,source_pack_id:'v77-final-v2-pack-business_studies',facts:{[`physical-pdf-page-${x.page}-column-${x.column}`]:{text:x.quote}},supports:{[`physical-pdf-page-${x.page}-column-${x.column}`]:hashJSON(x.quote)},permission:{basis:'Attributed NCERT source, exact column-specific extraction from the locally verified PDF; no unrestricted republication claim'}};
}
const cases=v2.cases.map(old=>{
  const c=structuredClone(old),cand=c.candidate;
  let refs=cand.source_refs.filter(r=>!r.id.includes('v77v2src-lebs106-p2-bs_staffing')&&!r.id.includes('v77v2src-lebs203-p7-bs_rights_1_3')&&!r.id.includes('v77v2src-lebs203-p8-bs_rights_4_6'));
  const add=(id,quote,locator)=>refs.push({id,version:1,locator,support_hash:hashJSON(quote)});
  if(['v77f-3546cbf8ea19','v77f-1db3dc389725'].includes(c.id)){
    const x=columns.staffing,id=Object.keys(newSources).find(k=>k.endsWith('-staffing'));
    add(id,x.quote,'physical-pdf-page-2-column-right');
  }
  if(['v77f-a20de9004938','v77f-9a31e9a4c29b','v77f-e9ef75026c19'].includes(c.id)){
    for(const k of ['rights_safety','rights_information_choice','rights_heard_redressal_education']){
      const x=columns[k],id=Object.keys(newSources).find(s=>s.endsWith(`-${k}`));add(id,x.quote,`physical-pdf-page-${x.page}-column-${x.column}`);
    }
  }
  if(c.id==='v77f-073bdc31e03c'){
    const id=Object.keys(overlay2.sources).find(s=>s.includes('leac206-p5-ac_investing_disposal'));
    if(!id)throw Error('investing_heading_source_missing');
    const q=overlay2.sources[id].facts['physical-pdf-page-5'].text;
    add(id,q,'physical-pdf-page-5-investing-activity-heading-and-examples');
  }
  // Candidate objectives remain valid skill descriptions without disclosing a key or defect.
  const neutral={
    'v77f-ad344a8b5f2d':['Analysis of Financial Statements','Evaluate investment facts against cash-flow classification criteria.','cash-flow classification criteria'],
    'v77f-2105354e5de1':['Analysis of Financial Statements','Classify receipts using the business activity described.','cash-flow activity categories'],
    'v77f-662880a2c5fb':['Analysis of Financial Statements','Interpret the purpose of activity groupings in a financial statement.','statement objectives'],
    'v77f-073bdc31e03c':['Analysis of Financial Statements','Classify payments for long-term resources using stated cash-flow categories.','cash-flow categories'],
    'v77f-84e9ba57542c':['Analysis of Financial Statements','Classify cash flows using the business events described.','cash-flow activity categories'],
    'v77f-59b58a25bbb3':['Analysis of Financial Statements','Apply investment criteria to a described financial instrument.','investment criteria'],
    'v77f-e77493e30567':['Analysis of Financial Statements','Calculate net cash using stated receipts and payments.','net cash calculation'],
    'v77f-3546cbf8ea19':['Staffing','Identify a management function from described organisational activities.','management functions'],
    'v77f-c6d21440345d':['Staffing','Identify a staffing activity from employee-learning needs.','employee learning activities'],
    'v77f-a20de9004938':['Consumer Protection','Apply consumer-rights distinctions to a customer scenario.','consumer rights'],
    'v77f-9a31e9a4c29b':['Consumer Protection','Apply consumer-rights distinctions to a customer scenario.','consumer rights'],
    'v77f-1db3dc389725':['Staffing','Identify a management function from described organisational activities.','management functions'],
    'v77f-e9ef75026c19':['Consumer Protection','Apply consumer-rights distinctions to a customer scenario.','consumer rights'],
    'v77f-3e505228c987':['Staffing','Identify an advanced causal-estimation method.','causal-estimation methods'],
    'v77f-ea8f75b17d74':['Introductory Microeconomics','Calculate change in total utility over an additional unit.','utility calculation'],
    'v77f-b123137834cc':['Introductory Microeconomics','Distinguish approaches to modelling consumer preferences.','consumer preference models'],
    'v77f-466fab2284fd':['Introductory Microeconomics','Interpret consumer preferences represented by an indifference curve.','preference representations'],
    'v77f-2d806114710e':['Introductory Microeconomics','Apply utility concepts to a described consumer choice.','utility concepts'],
    'v77f-63d002be451c':['Introductory Microeconomics','Calculate change in total utility over an additional unit.','utility calculation'],
    'v77f-98a231fa15fa':['Introductory Microeconomics','Apply a consumer-behaviour rule to a stated consumption pattern.','consumer-behaviour rules'],
    'v77f-fcf957a734d5':['Introductory Microeconomics','Distinguish approaches to modelling consumer preferences.','consumer preference models'],
    'v77f-4c09b80e91ce':['Narrative Passage','Infer a word’s contextual meaning from narrative details.','contextual vocabulary'],
    'v77f-a99cc144f9e5':['Narrative Passage','Infer a character’s purpose from narrative details.','narrative comprehension'],
    'v77f-1ed13162f85d':['Narrative Passage','Retrieve a specific event and reason from a narrative.','narrative comprehension'],
    'v77f-dfcca21b749e':['Narrative Passage','Interpret the main purpose of a narrative from its details.','narrative comprehension'],
    'v77f-c519f01371f2':['Narrative Passage','Retrieve a specific detail from a narrative passage.','narrative comprehension'],
    'v77f-2ca94e8b4e72':['Narrative Passage','Infer a word’s contextual meaning from narrative details.','contextual vocabulary'],
    'v77f-56f266269b74':['Narrative Passage','Identify verb mood in a clause.','verb mood'],
  }[c.id];
  if(!neutral)throw Error(`neutral_objective_missing:${c.id}`);
  const [syllabus_unit,objective,target_term]=neutral;
  cand.learning_objective={syllabus_unit,objective,target_term,why_answer_requires_it:'The candidate assesses the skill described by its objective through the task presented in the stem.'};
  cand.source_refs=refs;c.oracle.source_refs=refs;c.source_item_id=refs[0].id;
  c.case_v2b_sha256=old.case_v2_sha256||hashJSON(old);c.case_v3b_sha256=hashJSON(c);
  return c;
});
const sourceOverlay=structuredClone(overlay2);
sourceOverlay.schema='v77-final-source-overlay-v3b';sourceOverlay.created_at=new Date().toISOString();sourceOverlay.parent_overlay='source-overlay-v2b.json';
sourceOverlay.parent_overlay_sha256=copyHash('source-overlay-v2b.json');
for(const id of Object.keys(sourceOverlay.sources))if(/v77v2src-lebs106-p2-bs_staffing|v77v2src-lebs203-p7-bs_rights_1_3|v77v2src-lebs203-p8-bs_rights_4_6/.test(id))sourceOverlay.sources[id].state='superseded-by-v3-column-extraction';
Object.assign(sourceOverlay.sources,newSources);
sourceOverlay.packs['v77-final-v2-pack-business_studies'].source_ids=[...new Set([...sourceOverlay.packs['v77-final-v2-pack-business_studies'].source_ids,...Object.keys(newSources)])];
const blindCases=cases.map(c=>({id:c.id,subject:c.subject,chapter:c.chapter,body:c.candidate.body,options:c.candidate.options,difficulty:c.candidate.difficulty,passage_text:c.candidate.passage_text,route:c.candidate.route,question_type:c.candidate.question_type,learning_objective:{syllabus_unit:c.candidate.learning_objective.syllabus_unit,objective:c.candidate.learning_objective.objective,target_term:c.candidate.learning_objective.target_term},sources:c.candidate.source_refs.map(r=>{const s=sourceOverlay.sources[r.id];const fact=s.facts[Object.keys(s.facts)[0]].text;return{id:r.id,version:r.version,locator:r.locator,quote:fact,source_url:s.url||null,identity_sha256:s.identity_sha256};})}));
const blind={...structuredClone(packet2),schema:'v77-final-blind-review-v3b',created_at:new Date().toISOString(),parent_packet:'blind-review-packet-v2b.json',parent_packet_sha256:copyHash('blind-review-packet-v2b.json'),v3b_correction_started_at:new Date().toISOString(),source_overlay:'source-overlay-v3b.json',lineage_file:'case-lineage-v2b.json',cases:blindCases,instructions:'Derive answers independently before judging labels. Review every complete option; verify coherent exact source excerpts, source/page identity, all competing classifications, assumptions, calculations, syllabus entitlement, narrative completeness and presentation. This additive V3 preserves V2b stems, option text and option order, corrects column extraction and neutralizes objective metadata. Shared source families remain correlated evidence. Option positions have not been balanced.'};
const priorManifest=read('exact-source-copies-manifest-v2b.json');
const copyManifest={schema:'v77-final-exact-source-copies-v3b',created_at:new Date().toISOString(),parent_manifest:'exact-source-copies-manifest-v2b.json',parent_manifest_sha256:copyHash('exact-source-copies-manifest-v2b.json'),inherited_files:priorManifest.files,inherited_additional_source_artifacts:priorManifest.additional_source_artifacts||[],added_files:[
  ...['ncert/lebs106.columns-v3b.json','ncert/lebs203.columns-v3b.json','extract-business-columns-v3b.py'].map(p=>({path:join(root,p),sha256:copyHash(p),kind:'column-specific-source-extraction'})),
  ...Object.keys(newSources).map(id=>({source_id:id,pdf_path:join(root,`ncert/${newSources[id].title.match(/lebs\d+/)?.[0]||'lebs203'}.pdf`),pdf_identity_sha256:newSources[id].identity_sha256,extraction_path:join(root,newSources[id].extraction_file),extraction_sha256:newSources[id].extraction_sha256,physical_pdf_page:newSources[id].physical_pdf_page,column:newSources[id].column}))
],source_registry_sha256:sha(readFileSync('data/source_registry.json'))};
const changed=cases.map(c=>({case_id:c.id,v2b_case_sha256:c.case_v2b_sha256,v3b_case_sha256:c.case_v3b_sha256,changes:[...(c.candidate.source_refs.some(r=>Object.keys(newSources).includes(r.id))?['Business Studies column-cropped source refs installed']:[]),...(c.id==='v77f-073bdc31e03c'?['Investing activity heading/example added alongside fixed-asset purchase bullet']:[]),'learning objective rewritten as a neutral task description','blind packet excludes why_answer_requires_it'],semantic_preservation:{stem_unchanged:true,option_text_and_order_unchanged:true,proposed_answer_unchanged:true,expected_valid_unchanged:true,category_unchanged:true}}));
const start={schema:'v77-final-v3b-correction-start',v1_construction_started_at:v2.case_construction_started_at,v2b_correction_started_at:v2.v2_correction_started_at,v3b_correction_started_at:new Date().toISOString(),v1_packet_sha256:copyHash('blind-review-packet-v1.json'),v2b_packet_sha256:copyHash('blind-review-packet-v2b.json'),source_pdfs_unchanged:true,no_frozen_modules_edited:true,no_native_or_study_calls:true};
write('draft-cases-v3b-PRIVATE.json',{schema:'v77-final-private-draft-v3b',created_at:new Date().toISOString(),parent_draft:'draft-cases-v2b-PRIVATE.json',parent_draft_sha256:copyHash('draft-cases-v2b-PRIVATE.json'),source_overlay:'source-overlay-v3b.json',transport_freeze_sha256:v2.transport_freeze_sha256,contract_freeze_sha256:v2.contract_freeze_sha256,case_construction_started_at:v2.case_construction_started_at,v3b_correction_started_at:start.v3b_correction_started_at,scope:'Additive evidence and neutral-metadata correction. V2b retained unchanged. Stems, options/order, proposed answers, labels, and expected_valid are preserved.',cases});
write('source-overlay-v3b.json',sourceOverlay);
write('blind-review-packet-v3b.json',blind);
write('v2b-to-v3b-change-map.json',changed);
write('exact-source-copies-manifest-v3b.json',copyManifest);
write('construction-start-v3b.json',start);
console.log(JSON.stringify({created_at:blind.created_at,case_count:blind.cases.length,subjects:Object.fromEntries(['accountancy','business_studies','economics','english'].map(s=>[s,blind.cases.filter(c=>c.subject===s).length])),english_passages:blind.cases.filter(c=>c.subject==='english'&&!!c.passage_text).length,business_column_sources:Object.keys(newSources).length,source_refs:cases.reduce((n,c)=>n+c.candidate.source_refs.length,0),packet:'blind-review-packet-v3b.json'}));
