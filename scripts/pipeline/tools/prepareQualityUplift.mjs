import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {registerSourcePack} from '../lib/sourcePacks.mjs';
import {validateCalibrationManifest} from '../lib/factoryCalibration.mjs';
const root=resolve('data/question-factory-runtime'),out='artifacts/question-factory/quality-uplift';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
mkdirSync(out,{recursive:true});
if(existsSync(`${out}/source-registration.json`))throw new Error('quality_sources_already_prepared');
let registry=read('data/source_registry.json');
save(`${out}/registry-v3.1.json`,registry);save(`${out}/calibration-v3.1.json`,read('data/calibration_manifest.json'));
const packs=new Map(['english','accountancy','economics'].map(s=>[s,read(resolve(root,`${s}-authenticated-pack.json`))]));
const added=[],disabled=[];
function excerpt(pack,id,page,text){
 const doc=pack.documents.find(d=>d.id===id);if(!doc)throw new Error(`source_not_registered:${id}`);
 text=text.replace(/\s+/g,' ').trim();
 if(!readFileSync(resolve(root,doc.extraction_file),'utf8').includes(text))throw new Error(`source_excerpt_not_exact:${id}:${page}`);
 const locator=`quality-v3-${page}-${hashJSON(text).slice(0,10)}`;
 if(!doc.facts.some(f=>f.locator===locator))doc.facts.push({locator,text});
 const ref={id,version:doc.version,locator,support_hash:hashJSON(text)};added.push({ref,characters:text.length});return ref;
}
const ac=read(`${out}/accountancy-authoring-guidance.json`),ap=packs.get('accountancy');
const trimmed=ac.trimmed_source_facts.map(f=>{
 const text=f.exact_normalized_source_paragraph||f.exact_normalized_source_paragraphs||f.exact_normalized_source_block||f.exact_source_block;
 return text?{...f,ref:excerpt(ap,f.id,f.locator,text)}:null;
}).filter(Boolean);
for(const mapping of ac.anchor_mapping){
 const a=ap.anchors.find(a=>a.id===mapping.anchor_id);if(!a)throw new Error('anchor_missing');
 a.original_ready=mapping.original_enabled_recommendation;
 if(['7','17','20'].includes(a.official_question_id))a.original_ready=false;
 a.academic_guidance=[ac.mapping_policy,...ac.format_constraints,...ac.original_disable_recommendations.filter(r=>r.anchor===a.id).map(r=>r.reason)];
 a.variant_briefs=ac.safe_variant_proposals.filter(v=>v.anchor_pattern===a.id).map(v=>`Test ${v.topic}. ${v.stem} Required assumptions: ${(v.explicit_assumptions||[]).join('; ')}. Create a distinct supported value set or reasoning direction rather than copying this proposal.`);
 const replacement=trimmed.filter(f=>mapping.minimal_relevant_locators.includes(`${f.id}:${f.locator}`)).map(f=>f.ref);
 // Keep only the exact paragraphs plus any needed matching-account proforma.
 if(replacement.length){
  const preserved=a.source_refs.filter(r=>ap.documents.find(d=>d.id===r.id)?.kind==='paper'||mapping.minimal_relevant_locators.includes(`${r.id}:${r.locator}`)&&!trimmed.some(f=>f.id===r.id&&f.locator===r.locator));
  a.source_refs=[...preserved,...replacement];
 }
}
const eco=read(`${out}/economics-authoring-guidance.json`),ep=packs.get('economics');
const paragraphs=read(`${out}/economics-reference-paragraphs.json`);
const ecRefs=new Map(paragraphs.filter(p=>ep.documents.find(d=>d.id===p.source_id)?.kind==='reference').map(p=>[p.ref,excerpt(ep,p.source_id,p.locator,p.exact_excerpt)]));
for(const rule of eco.priority_anchors){
 const a=ep.anchors.find(a=>a.official_question_id===String(rule.q));
 if(rule.disable_all){a.generation_ready=false;disabled.push(a.id);continue;}
 a.original_ready=!rule.disable_original;a.academic_guidance=[...eco.global_prohibited_assumptions,...rule.prohibited,rule.reference_note||''];
 a.variant_briefs=eco.adaptation_briefs.filter(b=>b.q===rule.q).map(b=>`Test ${b.topic}. ${b.brief} Preserve explicit assumptions and use a new numerical value set when numerical.`);
 const refs=[...new Set([...rule.paragraphs,...eco.adaptation_briefs.filter(b=>b.q===rule.q).flatMap(b=>b.paragraphs)])].map(id=>ecRefs.get(id)).filter(Boolean);
 if(!refs.length)throw new Error('safe_economics_references_required');
 a.source_refs=[...a.source_refs.filter(r=>ep.documents.find(d=>d.id===r.id)?.kind==='paper'),...refs];
}
const english=packs.get('english'),lexemes=read(`${out}/english-lexeme-sources.json`);
if(lexemes.targets.length!==25||new Set(lexemes.targets.map(t=>t.word)).size!==25)throw new Error('25_distinct_targets_required');
const lexicalRefs=lexemes.targets.map(t=>{
 if(!t.page_retrieval_proof.exact_definition_observed_in_page_body||new URL(t.source_url).hostname!=='www.oxfordlearnersdictionaries.com')throw new Error('observed_primary_lexeme_required');
 const id=`oxford-quality-${t.word}`,file=resolve(root,`english-auth-work/${id}.json`);
 save(file,{word:t.word,exact_excerpt:t.exact_definition,url:t.source_url,retrieval_proof:t.page_retrieval_proof,capture_scope:'Researcher-preserved exact brief definition; not the full remote HTML'});
 const doc={id,kind:'reference',url:t.source_url,file:relative(root,file).replaceAll('\\','/'),extraction_file:relative(root,file).replaceAll('\\','/'),identity_sha256:sha(file),extraction_sha256:sha(file),extraction_checked:true,version:1,reuse_permitted:true,permission:{basis:'Brief attributed quotation for local academic validation; no unrestricted reuse claim',reference:t.source_url},facts:[{locator:'definition',text:t.exact_definition}]};
 english.documents.push(doc);
 return {word:t.word,brief:`Use only this sense: ${t.sense}. ${t.adaptation_ideas.uniqueness_guard}`,ref:{id,version:1,locator:'definition',support_hash:hashJSON(t.exact_definition)}};
});
english.anchors.find(a=>a.official_question_id==='46').original_ready=false;
for(const pack of packs.values()){pack.version++;registry=registerSourcePack(pack,root,registry);save(resolve(root,`${pack.subject}-authenticated-pack.json`),pack);}
save('data/source_registry.json',registry);save(`${out}/lexeme-job-sources.json`,lexicalRefs);
const fixtures=read(resolve(root,'commissioning-calibration-v3.json'));
fixtures.version='official-cuET-calibration-fixtures-v3.2-regression';
fixtures.limitations.push('Re-evaluation of the previously observed keyed benchmark after quality hardening; not a fresh unseen paper benchmark.');
for(const f of [...fixtures.development,...fixtures.held_out])f.question.provenance.source_pack_version=registry.examples.find(a=>a.id===f.provenance.anchor_id).source_pack_version;
validateCalibrationManifest(fixtures,registry);save(resolve(root,'commissioning-calibration-v3.2.json'),fixtures);
save('data/calibration_manifest.json',{state:'paused',reason:'quality_v3_requires_calibration',version:'cuet-llm-v3',verifier_version:'luna-gemini-cuET-v3.2',source_registry_version:registry.version});
save(`${out}/source-registration.json`,{at:new Date().toISOString(),registry_version:registry.version,exact_excerpt_facts:added,disabled_anchors:disabled,lexical_targets:25,production_changes:0});
console.log(JSON.stringify({registry:registry.version,exact_excerpts:added.length,disabled,lexical_targets:25}));
