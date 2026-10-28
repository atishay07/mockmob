import { readFileSync,writeFileSync,mkdirSync,existsSync } from 'node:fs';
import { resolve,dirname,relative,isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { corroboratePaper,matchMirroredAnchor,omrAnswer } from '../lib/mirroredPaperEvidence.mjs';

// Bookkeeping over checked source transcripts, not an academic model verdict.
const workspace=resolve('.'),runtime=resolve('data/question-factory-runtime');
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const paths={english:'english-auth-work/corroboration.json',accountancy:'accountancy-auth-work/mirror-corroboration-sidecar.json',business_studies:'business-economics-auth-work/business-studies/corroboration.json',economics:'business-economics-auth-work/economics/corroboration.json'};
const reports=[];
for(const [subject,name]of Object.entries(paths)) {
  const sidecar=resolve(runtime,name),folder=dirname(sidecar),doc=JSON.parse(readFileSync(sidecar));
  const locate=name=>name.startsWith('data/')?resolve(workspace,name):resolve(folder,name);
  const localFile=(_root,name)=>{const path=locate(name),rel=relative(runtime,path);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('source_path_outside_runtime');return path;};
  const auth=corroboratePaper(doc,{localFile,fileHash:sha,subject},runtime);
  const key=doc.official_key || auth.official_key || auth.official_key_evidence;
  const keyPath=locate(key.file),textPath=locate(key.page_text_file || key.extraction_file || key.transcription_file),keyText=readFileSync(textPath,'utf8');
  const expected=key.identity_sha256 || key.sha256 || 'a4d60292d743f13412b1637e3f0bb6317e3643ea9d70fe0018e1d1e3f14e3145';
  if(!existsSync(keyPath)||sha(keyPath)!==expected || !['www.nta.ac.in','nta.ac.in'].includes(new URL(key.url).hostname))throw new Error('official_key_binary_changed');
  const rows=key.key_rows || key.rows;
  const answers=auth.questions.map(q=>{
    const row=rows?.[q.id],header=q.key_table_header_quote || key.key_table_header_quote || key.table_header_quote;
    const anchor={...q,official_question_id:String(q.id),key_format:'omr_section',omr_booklet:auth.identity.booklet,key_column:q.key_column ?? row?.column ?? row?.key_column ?? (Number(q.id)>45?1:0),key_quote:q.key_quote || row?.row_quote || row?.quote,
      key_table_header_quote:header,authentication:{...q.authentication,option_order_checked:true,key_context_quote:q.authentication?.key_context_quote || q.key_context_quote || key.key_context_quote}};
    // Accountancy's sidecar preserves its separate printed key table; bind to
    // its exact identity line rather than relying on a synthesized header.
    if(subject==='accountancy'){
      anchor.authentication.key_context_quote=keyText.split('\n').find(line=>line.includes(auth.identity.key_date_token)&&line.includes('301'))?.trim();
      anchor.key_quote=keyText.split('\n').find(line=>new RegExp(`^${Number(q.id)>45?Number(q.id)-45:q.id} `).test(line))?.trim();
    }
    matchMirroredAnchor(anchor,doc,{kind:'final_key'},keyText);
    let answer;try{answer=omrAnswer(anchor,keyText);}catch(error){throw new Error(`${subject}:Q${q.id}:${error.message}`,{cause:error});}
    return {question_id:String(q.id),answer,single:/^[1-4]$/.test(answer),chapter:q.chapter || q.canonical_chapter || q.anchor_metadata?.canonical_chapter || null,route:q.route || q.anchor_metadata?.route || null};
  });
  reports.push({subject,sidecar:relative(workspace,sidecar).replaceAll('\\','/'),sidecar_sha256:sha(sidecar),paper_sha256:doc.identity_sha256,key_sha256:sha(keyPath),key_page:key.page || key.physical_pdf_page,booklet:auth.identity.booklet,key_language:auth.identity.language,question_count:answers.length,single_answer_count:answers.filter(a=>a.single).length,excluded_key_count:answers.filter(a=>!a.single).length,answers,state:'paper_and_key_identity_checked',academic_validation:false,publication_evidence:false});
}
const report={at:new Date().toISOString(),production_changes:0,api_spend_usd:0,questions_identity_checked:reports.reduce((n,r)=>n+r.question_count,0),subjects:reports,remaining_gates:['anchor_level_reference_contexts','source_pack_registration','officially_keyed_calibration','800_candidate_pilot','staging_and_production_release']};
mkdirSync('artifacts/question-factory',{recursive:true});writeFileSync('artifacts/question-factory/source-foundation-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,subjects:reports.map(({answers,...r})=>r)},null,2));
