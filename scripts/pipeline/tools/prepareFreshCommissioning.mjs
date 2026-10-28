import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {hashJSON,FACTORY_SUBJECTS} from '../../../data/question_factory_policy.mjs';
import {registerSourcePack} from '../lib/sourcePacks.mjs';
import {officialCalibrationUnit,validateCalibrationManifest} from '../lib/factoryCalibration.mjs';

const root=resolve('data/question-factory-runtime'),read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const old=read(resolve(root,'calibration-fixtures.json'));
const previous=read('data/source_registry.json');
const archive='artifacts/question-factory/calibration-history';mkdirSync(archive,{recursive:true});
if(!existsSync(`${archive}/v2.6-fixtures.json`))writeFileSync(`${archive}/v2.6-fixtures.json`,JSON.stringify(old,null,2));
if(!existsSync(`${archive}/v2.6-result.json`))writeFileSync(`${archive}/v2.6-result.json`,readFileSync('data/calibration_manifest.json'));
const packs=new Map(FACTORY_SUBJECTS.map(s=>[s,read(resolve(root,`${s}-authenticated-pack.json`))]));
const extractionFixes=[];
for(const pack of packs.values())for(const anchor of pack.anchors){
 const fixed=anchor.options.map(option=>option.replace(/\s+Read the (?:following|given) (?:passage|information|carefully)[\s\S]*$/i,'').trim());
 if(JSON.stringify(fixed)===JSON.stringify(anchor.options))continue;
 const paper=pack.documents.find(d=>d.id===anchor.source_id);
 const proof=paper.authentication.questions.find(q=>String(q.id)===anchor.official_question_id);
 if(!proof||proof.quotes.some(quote=>fixed.some(option=>!quote.includes(option))))throw new Error('corrected_option_not_in_both_original_copies');
 extractionFixes.push({anchor_id:anchor.id,before:anchor.options,after:fixed,basis:'Removed following stimulus from the final option; retained exact option prefixes present in both paper copies.'});
 anchor.options=fixed;proof.options=fixed;
 const fact=paper.facts.find(f=>f.locator===anchor.paper_locator);
 const marker=fact.text.match(/Read the (?:following|given) (?:passage|information|carefully)/i);
 if(marker){fact.text=fact.text.slice(0,marker.index).trim();for(const ref of anchor.source_refs)if(ref.id===paper.id&&ref.locator===fact.locator)ref.support_hash=hashJSON(fact.text);}
}
if(extractionFixes.length)writeFileSync('artifacts/question-factory/option-extraction-repairs.json',JSON.stringify({at:new Date().toISOString(),fixes:extractionFixes},null,2));
for(const a of packs.get('accountancy').anchors.filter(a=>['47','48'].includes(a.official_question_id)))a.question_type='numerical_case';
const newFile=resolve(root,'reference-downloads/leac101.pdf'),newExtraction=resolve(root,'reference-downloads/leac101.normalized.txt');
if(!packs.get('accountancy').documents.some(d=>d.id==='ncert-leac101'))packs.get('accountancy').documents.push({id:'ncert-leac101',kind:'reference',url:'https://ncert.nic.in/textbook/pdf/leac101.pdf',file:'reference-downloads/leac101.pdf',extraction_file:'reference-downloads/leac101.normalized.txt',identity_sha256:sha(newFile),extraction_sha256:sha(newExtraction),extraction_checked:true,version:1,reuse_permitted:true,permission:{basis:'Attributed official NCERT text for local educational validation, not unrestricted republication',reference:'https://ncert.nic.in/textbook/pdf/leac101.pdf'},facts:[]});
for(const [subject,ids]of [['accountancy',['leac104']],['business_studies',['lebs101','lebs201','lebs202']],['economics',['leec105','leec106']]])for(const id of ids){
 const file=`reference-downloads/${id}.pdf`,extraction=`reference-downloads/${id}.normalized.txt`,url=`https://ncert.nic.in/textbook/pdf/${id}.pdf`;
 if(!packs.get(subject).documents.some(d=>d.id===`ncert-${id}`))packs.get(subject).documents.push({id:`ncert-${id}`,kind:'reference',url,file,extraction_file:extraction,identity_sha256:sha(resolve(root,file)),extraction_sha256:sha(resolve(root,extraction)),extraction_checked:true,version:1,reuse_permitted:true,permission:{basis:'Attributed official NCERT excerpts for local validation, not unrestricted republication',reference:url},facts:[]});
}
{
 const file='business-economics-auth-work/official-ncert/lebs103.pdf',extraction='business-economics-auth-work/official-ncert/lebs103.normalized.txt',url='https://ncert.nic.in/textbook/pdf/lebs103.pdf';
 if(!packs.get('business_studies').documents.some(d=>d.id==='ncert-lebs103'))packs.get('business_studies').documents.push({id:'ncert-lebs103',kind:'reference',url,file,extraction_file:extraction,identity_sha256:sha(resolve(root,file)),extraction_sha256:sha(resolve(root,extraction)),extraction_checked:true,version:1,reuse_permitted:true,permission:{basis:'Attributed official NCERT local educational validation excerpts',reference:url},facts:[]});
}
const attach={accountancy:{'ncert-leac201':[3,14,17,20,38],'ncert-leac101':[5,7,28,29],'ncert-leac104':[46,47,48,49,50]},
  business_studies:{'ncert-lebs102':[2,3,4],'ncert-lebs103':[6,7,8],'ncert-lebs201':[32,33,34],'ncert-lebs101':[35],'ncert-lebs202':[41,42,43,44,45],'ncert-lebs108':[16,17,18]},
  economics:{'ncert-leec104':[1,4,26,45,48,50],'ncert-leec103':[3,5,49],'ncert-leec105':[7,8],'ncert-leec106':[9,10,24],'ncert-leec102':[25,47]}};
const words=s=>new Set(String(s).toLowerCase().match(/[a-z]{4,}/g)?.filter(w=>!['following','correct','given','which','these','their','would','account','choose','options','statement','statements','answer'].includes(w))||[]);
for(const [subject,docs]of Object.entries(attach))for(const [id,numbers]of Object.entries(docs)){
 const pack=packs.get(subject),doc=pack.documents.find(d=>d.id===id);if(!doc)throw new Error(`source_missing:${id}`);
 const pages=read(resolve(root,doc.file.replace(/\.pdf$/,'.pages.json')));
 const plain=resolve(root,`${id}-commissioning-extraction.txt`);writeFileSync(plain,pages.map(p=>p.text).join('\n'));
 doc.extraction_file=relative(root,plain).replaceAll('\\','/');doc.extraction_sha256=sha(plain);
 for(const number of numbers){const anchor=pack.anchors.find(a=>a.official_question_id===String(number));if(!anchor)continue;
  anchor.source_refs=anchor.source_refs.filter(r=>r.id===id||pack.documents.find(d=>d.id===r.id)?.kind==='paper');
  // Select existing authenticated textbook pages by content. Academic entailment
  // is subsequently checked by both blind models, not asserted by this search.
  const query=words(anchor.body+' '+anchor.options.join(' '));
  const ranked=pages.map(p=>({...p,score:[...query].filter(w=>p.text.toLowerCase().includes(w)).length})).sort((a,b)=>b.score-a.score||a.page-b.page).slice(0,2);
  if(!ranked[0]?.score)continue;
  for(const page of ranked){const locator=`pdf-page-${page.page}`;
   if(!doc.facts.some(f=>f.locator===locator))doc.facts.push({locator,text:page.text});
   if(!anchor.source_refs.some(r=>r.id===id&&r.locator===locator))anchor.source_refs.push({id,version:doc.version,locator,support_hash:hashJSON(page.text)});
  }
  anchor.generation_ready=true;anchor.source_support_state='local_textbook_pages_pending_blind_validation';
 }
}
for(const a of packs.get('business_studies').anchors.filter(a=>['29','30'].includes(a.official_question_id))){a.generation_ready=false;a.source_support_state='specific_reference_not_acquired';}
// This new group is a complete passage-based reading task. Its checked stimulus
// directly contains the facts needed to answer all five original questions.
for(const a of packs.get('economics').anchors.filter(a=>Number(a.official_question_id)>=28&&Number(a.official_question_id)<=32)){
 if(!a.passage_text||!a.passage_group_id)throw new Error('restored_passage_required');
 a.generation_ready=true;a.source_support_state='authenticated_passage_pending_blind_validation';
}
let registry=previous;
for(const pack of packs.values()){
 pack.version=Number(pack.version)+1;registry=registerSourcePack(pack,root,registry);
}
const heldIds={english:[7,42,44],accountancy:[28,46,47,48,49,50],business_studies:[2,3,16,18],economics:[1,4,48]};
heldIds.business_studies=[32,33,34,35];
const priorFresh=existsSync(resolve(root,'commissioning-calibration-v3.json'))?read(resolve(root,'commissioning-calibration-v3.json')):null;
const fresh={version:'official-cuET-calibration-fixtures-v3',split_policy:'authenticated_item_and_passage_disjoint_v1',development:[],held_out:[],
 limitations:['Fresh valid held-out questions relative to v2.6 development. Same four papers, not a new-paper benchmark.','Prior negative fixtures are retained as regression challenges, not new unseen attacks.']};
const make=(anchor,split)=>{
 const spec=registry.exam_specs[anchor.subject],family=anchor.family_id||`pyq:${anchor.id}`;const q={...anchor,id:`commission-v3-${anchor.id}`,family_id:family,explanation:anchor.explanation || [...(priorFresh?.development||[]),...(priorFresh?.held_out||[])].find(f=>f.provenance.anchor_id===anchor.id&&f.valid)?.question.explanation || 'Explanation preparation pending.',
 provenance:{kind:'authentic_pyq',anchor_id:anchor.id,adaptation_family:family,source_pack_id:anchor.source_pack_id,source_pack_version:anchor.source_pack_version,syllabus_version:spec.syllabus_version,pattern_version:spec.pattern_version}};
 return {id:q.id,split,category:`valid_${anchor.difficulty==='hard'?'difficult':anchor.difficulty}`,valid:true,question:q,
  provenance:{anchor_id:anchor.id,source_id:anchor.source_id,source_unit_id:officialCalibrationUnit(anchor),key_locator:anchor.key_locator,independently_keyed:true,final_answer:anchor.correct_answer}};
};
for(const f of [...old.development,...old.held_out.filter(f=>f.valid)]){
 const a=registry.examples.find(a=>a.id===f.provenance.anchor_id);fresh.development.push(make(a,'development'));
}
for(const f of priorFresh?.held_out.filter(f=>f.valid)||[]){const a=registry.examples.find(a=>a.id===f.provenance.anchor_id);if(!fresh.development.some(f=>f.provenance.anchor_id===a.id))fresh.development.push(make(a,'development'));}
for(const [subject,numbers]of Object.entries(heldIds))for(const number of numbers){const a=registry.examples.find(a=>a.subject===subject&&a.official_question_id===String(number));if(!a)throw new Error('fresh_anchor_missing');fresh.held_out.push(make(a,'held_out'));}
for(const f of old.held_out.filter(f=>!f.valid)){
 const clone=structuredClone(f);clone.id=`commission-v3-${f.id}`;clone.question.id=clone.id;
 clone.question.provenance.source_pack_version=registry.examples.find(a=>a.id===f.provenance.anchor_id).source_pack_version;
 // Negative units intentionally belong to previously evaluated development
 // families; they are known challenge fixtures and are never valid holdouts.
 clone.provenance.source_unit_id=officialCalibrationUnit(registry.examples.find(a=>a.id===f.provenance.anchor_id));
 fresh.held_out.push(clone);
}
// Retained negatives must be family-disjoint from development. Their original
// baselines were observed in v2.6, so keep them out of the new development list.
const negativeAnchors=new Set(fresh.held_out.filter(f=>!f.valid).map(f=>f.provenance.anchor_id));
const heldUnits=new Set(fresh.held_out.map(f=>f.provenance.source_unit_id));
const heldFamilies=new Set(fresh.held_out.map(f=>f.question.family_id));
fresh.development=fresh.development.filter(f=>!negativeAnchors.has(f.provenance.anchor_id)&&!heldUnits.has(f.provenance.source_unit_id)&&!heldFamilies.has(f.question.family_id));
registry.calibration_anchor_ids=[...new Set([...previous.calibration_anchor_ids,...fresh.held_out.filter(f=>f.valid).map(f=>f.provenance.anchor_id)])];
validateCalibrationManifest(fresh,registry);
for(const pack of packs.values())writeFileSync(resolve(root,`${pack.subject}-authenticated-pack.json`),JSON.stringify(pack,null,2));
writeFileSync('data/source_registry.json',JSON.stringify(registry,null,2));
writeFileSync(resolve(root,'commissioning-calibration-v3.json'),JSON.stringify(fresh,null,2));
console.log(JSON.stringify({registry_version:registry.version,development:fresh.development.length,held_out:fresh.held_out.length,valid:fresh.held_out.filter(f=>f.valid).length}));
