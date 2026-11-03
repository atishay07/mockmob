import { readFileSync,writeFileSync,copyFileSync,existsSync } from 'node:fs';
import { resolve,dirname,relative } from 'node:path';
import { createHash } from 'node:crypto';
import { registerSourcePack } from '../lib/sourcePacks.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';

// Produces reviewable pack drafts only. Source-only anchors are explicitly
// barred from authoring until answer-supporting reference curation is attached.
const root=resolve('data/question-factory-runtime'),workspace=resolve('.');
const paths={english:'english-auth-work/corroboration.json',accountancy:'accountancy-auth-work/mirror-corroboration-sidecar.json',business_studies:'business-economics-auth-work/business-studies/corroboration.json',economics:'business-economics-auth-work/economics/corroboration.json'};
const read=path=>JSON.parse(readFileSync(path,'utf8')),sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex'),norm=s=>String(s || '').replace(/\s+/g,' ').trim();
function questionExcerpt(question) {
  const quote=norm(question.quotes[0]);let optionEnd=quote.indexOf(norm(question.body))+norm(question.body).length;
  for(const option of question.options){const at=quote.indexOf(norm(option),optionEnd);if(at<0)throw new Error('ordered_question_excerpt_required');optionEnd=at+norm(option).length;}
  const following=quote.match(/Read the (?:following|given|passage)/i);
  // A parser block can contain the stimulus for the NEXT question group.
  // Keep only this question's contiguous stem/options; its own shared passage
  // receives a separate, authenticated locator below.
  return following && following.index>=optionEnd?quote.slice(0,following.index).trim():quote;
}
const binding=read(resolve(root,'source-foundation/official-syllabus-bindings.json'));
const permission={basis:'Owner reuse attestation; no independently verified licence document',reference:'Owner commissioning message, 6 October 2026',independently_verified_licence:false};
let registry=read('data/source_registry.json');
const summary=[];
for(const [subject,name]of Object.entries(paths)) {
  const path=resolve(root,name),folder=dirname(path),paper=read(path),id=`cuet2024-${subject}-bookA`,version=1;
  const locate=name=>name.startsWith('data/')?resolve(workspace,name):resolve(folder,name);
  const rel=path=>relative(root,path).replaceAll('\\','/');
  const normalizeExtract=(file,suffix)=>{const input=locate(file),output=resolve(folder,suffix);writeFileSync(output,norm(readFileSync(input,'utf8')));return {extraction_file:rel(output),extraction_sha256:sha(output),normalization_of_sha256:sha(input),extraction_checked:true};};
  const auth=paper.authentication,key=paper.official_key || auth.official_key || auth.official_key_evidence;
  if(sha(locate(key.file))!==(key.identity_sha256 || key.sha256 || 'a4d60292d743f13412b1637e3f0bb6317e3643ea9d70fe0018e1d1e3f14e3145'))throw new Error('official_key_binary_changed');
  const originalKeyText=locate(key.page_text_file || key.extraction_file || key.transcription_file);
  const expectedKeyText=key.page_text_sha256 || key.extraction_sha256;
  if(expectedKeyText && sha(originalKeyText)!==expectedKeyText)throw new Error('checked_key_transcript_changed');
  paper.id=`${id}-paper`;paper.kind='paper';paper.version=version;paper.file=rel(locate(paper.file));Object.assign(paper,normalizeExtract(paper.extraction_file,'pack-paper-normalized.txt'));
  auth.copies=auth.copies.map((copy,index)=>({...copy,file:rel(locate(copy.file)),...normalizeExtract(copy.extraction_file,`pack-mirror-${index}-normalized.txt`)}));
  auth.catalog.file=rel(locate(auth.catalog.file));
  auth.questions=auth.questions.map(q=>({...q,body:norm(q.body),options:q.options.map(norm),quotes:q.quotes.map(norm),passage_text:norm(q.passage_text)}));
  const extract=readFileSync(resolve(root,paper.extraction_file),'utf8');
  paper.facts=auth.questions.map(q=>({locator:`q${q.id}`,text:questionExcerpt(q)}));
  const keyInput=locate(key.page_text_file || key.extraction_file || key.transcription_file),keyOutput=resolve(folder,'pack-key-normalized.txt');writeFileSync(keyOutput,norm(readFileSync(keyInput,'utf8')));
  const keyText=readFileSync(keyInput,'utf8'),keyDoc={id:`${id}-final-key`,kind:'final_key',year:2024,url:key.url,file:rel(locate(key.file)),identity_sha256:sha(locate(key.file)),extraction_file:rel(keyOutput),extraction_sha256:sha(keyOutput),extraction_checked:true,version,facts:[{locator:`pdf-page-${key.page || key.physical_pdf_page}`,text:norm(keyText)}]};
  const syllabusBinding=binding.documents.find(d=>d.subject===subject),syllabusFile=resolve(root,`source-foundation/${subject}-syllabus-2026.pdf`);copyFileSync(resolve(workspace,syllabusBinding.file),syllabusFile);
  if(sha(syllabusFile)!==syllabusBinding.sha256)throw new Error('official_syllabus_binary_changed');
  const syllabusTextFile=resolve(root,`source-foundation/${subject}-syllabus-2026.txt`),syllabusText=readFileSync(syllabusTextFile,'utf8');
  const syllabus={id:`cuet2026-${subject}-syllabus`,kind:'syllabus',year:2026,url:syllabusBinding.url,file:rel(syllabusFile),identity_sha256:sha(syllabusFile),extraction_file:rel(syllabusTextFile),extraction_sha256:sha(syllabusTextFile),extraction_checked:true,version,official_index_url:syllabusBinding.index_url,official_index_file:'source-foundation/official-syllabus-index-2026.html',official_index_sha256:syllabusBinding.index_sha256,facts:[{locator:'full-syllabus',text:syllabusText}]};
  const documents=[paper,keyDoc,syllabus],anchors=[],passageGroups=new Map(),excluded=[];
  for(const q of auth.questions) {
    const metadata=q.anchor_metadata || q,chapter=metadata.canonical_chapter || q.chapter || q.canonical_chapter,rows=key.key_rows || key.rows,row=rows?.[q.id];
    const keyQuote=q.key_quote || row?.row_quote || row?.quote || keyText.split('\n').find(line=>new RegExp(`^${Number(q.id)>45?Number(q.id)-45:q.id} `).test(line))?.trim();
    const keyValue=q.official_key_value || q.official_key?.answer || row?.value || row?.answer || metadata.official_key_answer_position;
    if(!/^[1-4]$/.test(String(keyValue || '')) || !isValidTopSyllabusPair(subject,chapter) || ['excluded','quarantined'].includes(metadata.curation_state) || q.candidate_eligible===false){excluded.push(String(q.id));continue;}
    const refs=[{id:paper.id,version,locator:`q${q.id}`,support_hash:hashJSON(questionExcerpt(q))}];
    let generationReady=false;
    // Existing English captures are opened primary grammar/dictionary pages,
    // not retrieval snippets. Other subjects attach NCERT curation separately.
    const ref=q.calibration_reference;
    if(ref?.file && ref?.url && ref?.excerpt && existsSync(locate(ref.file))) {
      const refFile=locate(ref.file),text=readFileSync(refFile,'utf8');
      if(!text.includes(ref.excerpt) || ref.identity_sha256 && sha(refFile)!==ref.identity_sha256)throw new Error('reference_excerpt_or_capture_changed');
      const refId=`${id}-q${q.id}-reference`;documents.push({id:refId,kind:'reference',url:ref.url,file:rel(refFile),identity_sha256:sha(refFile),extraction_file:rel(refFile),extraction_sha256:sha(refFile),extraction_checked:true,version,facts:[{locator:'checked-excerpt',text:ref.excerpt}],permission:{basis:'Brief attributed reference quotation used in local educational validation',reference:ref.url},reuse_permitted:true});
      refs.push({id:refId,version,locator:'checked-excerpt',support_hash:hashJSON(ref.excerpt)});generationReady=true;
    }
    let groupId=null;
    if(q.passage_text) {
      groupId=`${id}-passage-${hashJSON(q.passage_text).slice(0,12)}`;
      if(!passageGroups.has(groupId))passageGroups.set(groupId,{id:groupId,complete:true,anchor_ids:[],passage_text:q.passage_text});
      const locator=`passage-${hashJSON(q.passage_text).slice(0,12)}`;
      if(!paper.facts.some(f=>f.locator===locator))paper.facts.push({locator,text:q.passage_text});
      refs.push({id:paper.id,version,locator,support_hash:hashJSON(q.passage_text)});
      generationReady=subject==='english' && q.passage_text.split(/\s+/).length<=300;
    }
    const anchor={id:`${id}-q${q.id}`,official_question_id:String(q.id),body:q.body,options:q.options,chapter,route:metadata.route || q.route,difficulty:metadata.difficulty || q.difficulty || 'medium',question_type:metadata.question_type || q.question_type,correct_answer:'ABCD'[Number(keyValue)-1],source_id:paper.id,final_key_source_id:keyDoc.id,paper_locator:`q${q.id}`,key_locator:keyDoc.facts[0].locator,key_quote:norm(keyQuote),key_format:'omr_section',omr_booklet:auth.identity.booklet,key_column:q.key_column ?? row?.column ?? row?.key_column ?? (Number(q.id)>45?1:0),key_table_header_quote:norm(q.key_table_header_quote || key.key_table_header_quote || key.table_header_quote),final_key_matched:true,authentication:{independently_matched:true,basis:'Complete separately published paper copies and exact official final OMR key section',option_order_checked:true,key_context_quote:norm(q.authentication?.key_context_quote || q.key_context_quote || key.key_context_quote || keyText.split('\n').find(line=>line.includes(auth.identity.key_date_token)&&line.includes(auth.identity.subject_code)))},source_refs:refs,generation_ready:generationReady,source_support_state:generationReady?'reference_curated_pending_blind_validation':'paper_and_key_only',passage_text:q.passage_text};
    if(groupId){anchor.passage_group_id=groupId;anchor.order_index=passageGroups.get(groupId).anchor_ids.length;passageGroups.get(groupId).anchor_ids.push(anchor.id);}
    anchors.push(anchor);
  }
  // Any omitted sibling invalidates the whole stimulus group.
  const rejectedGroups=new Set([...passageGroups.values()].filter(g=>g.anchor_ids.length!==auth.questions.filter(q=>q.passage_text===g.passage_text).length).map(g=>g.id));
  const kept=anchors.filter(a=>!rejectedGroups.has(a.passage_group_id));
  for(const doc of documents)if(!doc.permission){doc.permission=permission;doc.reuse_permitted=true;}
  const spec={state:'verified',syllabus_version:'cuet-2026-provisional-for-2027',pattern_version:'cuet-2024-authenticated-bookA-v1',exam_rule_version:'2026-syllabus-boundaries-2027-revalidation-required',included_topics:[syllabusText],excluded_topics:subject==='accountancy'?['Not-for-profit organisation accounting','Piecemeal distribution','Sale to a company','Insolvency of a partner']:subject==='business_studies'?['Entrepreneurship Development (absent from 2026 syllabus)']:[],pattern_rules:['Use the authenticated paper examples for wording, format and depth.','Preserve four ordered options and one defensible answer; dropped or multiple-answer originals are excluded.','Historical paper timing and attempt rules do not establish 2027 examination rules.'],source_refs:[{id:syllabus.id,locator:'full-syllabus'},{id:paper.id,locator:'q1'}]};
  const pack={id,subject,version,documents,anchors:kept,passage_groups:[...passageGroups.values()].filter(g=>!rejectedGroups.has(g.id)),exam_spec:spec};
  registry=registerSourcePack(pack,root,registry);
  writeFileSync(resolve(root,`${subject}-authenticated-pack.json`),JSON.stringify(pack,null,2));
  summary.push({subject,authenticated_anchors:kept.length,reference_curated:kept.filter(a=>a.generation_ready).length,excluded_question_ids:excluded,excluded_passage_groups:[...rejectedGroups],pack_file:rel(resolve(root,`${subject}-authenticated-pack.json`))});
}
writeFileSync(resolve(root,'source-registry-draft.json'),JSON.stringify(registry,null,2));
writeFileSync('artifacts/question-factory/authenticated-pack-preparation.json',JSON.stringify({at:new Date().toISOString(),draft_only:true,production_changes:0,subjects:summary},null,2));
console.log(JSON.stringify(summary,null,2));
