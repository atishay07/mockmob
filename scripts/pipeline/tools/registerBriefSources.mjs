import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const path='data/source_registry.json',registry=JSON.parse(readFileSync(path)),directory='artifacts/question-factory/source-diversity-2026-10-07';
mkdirSync(directory,{recursive:true});
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
if(!existsSync(directory+'/registry-before.json'))save(directory+'/registry-before.json',registry);
const rows=JSON.parse(readFileSync('data/question-factory-runtime/dictionary-expansion-2026-10-07.json'));
const report=[];
for(const row of rows){
 const id='oxford-quality-'+row.word,url='https://www.oxfordlearnersdictionaries.com/definition/english/'+row.word;
 if(row.text.trim().split(/\s+/).length>25||row.text.length<25)throw Error('bounded_decisive_definition_required');
 const file=directory+'/'+id+'.json',capture={url,title:row.word+' adjective — Oxford Advanced Learner’s Dictionary',exact_excerpt:row.text,scope:row.scope||'First dictionary sense',opened_directly:true,capture_scope:'Brief definition copied from the opened official entry; identity binds this capture, not complete remote HTML',captured_at:new Date().toISOString()};
 const existing=registry.sources[id];
 if(existing){if(existing.facts.definition.text!==row.text)throw Error('registered_source_immutable:'+id);continue;}
 save(file,capture);const digest=createHash('sha256').update(readFileSync(file)).digest('hex');
 registry.sources[id]={id,kind:'reference',state:'active',version:1,chapters:['Vocabulary','Correct Word Usage','Match the Following','Para Jumbles'],url,title:capture.title,
  identity_sha256:digest,extraction_sha256:digest,extraction_checked:true,reuse_permitted:true,file,extraction_file:file,
  capture_scope:capture.capture_scope,permission:{basis:'Brief attributed dictionary excerpt for local educational verification; no unrestricted republication claim',reference:url},
  facts:{definition:{text:row.text}},supports:{definition:hashJSON(row.text)},source_pack_id:'original-english-reference-v1'};
 registry.packs['original-english-reference-v1'].document_ids.push(id);report.push({id,url,characters:row.text.length,scope:capture.scope});
}
const stimuli=JSON.parse(readFileSync('data/question-factory-runtime/original-reading-stimuli-2026-10-07.json'));
for(const [chapter,texts] of Object.entries(stimuli))for(const text of texts){
 if(text.split(/\s+/).length>300)throw Error('english_passage_word_limit');
 const id='mockmob-original-stimulus-diverse-'+hashJSON({chapter,text}).slice(0,20),file=directory+'/'+id+'.txt';
 if(registry.sources[id])continue;
 writeFileSync(file,text);const digest=createHash('sha256').update(text).digest('hex');
 registry.sources[id]={id,kind:'reference',state:'active',version:1,chapters:[chapter],url:'local://mockmob/original-stimuli/'+id,title:'MockMob original fictional reading stimulus',
  identity_sha256:digest,extraction_sha256:digest,extraction_checked:true,reuse_permitted:true,file,extraction_file:file,
  permission:{basis:'Original fictional prose created for MockMob practice; no outside factual or publisher claim',reference:file},
  facts:{stimulus:{text}},supports:{stimulus:hashJSON(text)},source_pack_id:'original-english-reference-v1'};
 registry.packs['original-english-reference-v1'].document_ids.push(id);report.push({id,chapter,words:text.split(/\s+/).length,source_kind:'original_fiction'});
}
save(path,registry);
const registered=Object.values(registry.sources).filter(s=>s.file?.startsWith(directory+'/')).map(s=>({id:s.id,url:s.url,chapters:s.chapters,identity_sha256:s.identity_sha256,supports:s.supports}));
const summary={at:new Date().toISOString(),new_documents_this_run:report,all_registered_documents:registered,paid_requests:0,existing_sources_unchanged:true,benchmark_basis:'Existing dated sample; newly retrieved vocabulary and original fictional stimuli are checked independently per candidate and are not fresh benchmark evidence.'};
if(report.length)save(directory+'/registration-run-'+hashJSON(report.map(r=>r.id)).slice(0,16)+'.json',summary);
save(directory+'/registration.json',summary);
console.log(JSON.stringify({new_documents:report.length,paid_requests:0}));
