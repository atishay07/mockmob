import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import registry from '../../../../../data/source_registry.json' with {type:'json'};
import {expectedReleaseBinding,REQUIRED_SUBJECTS} from '../../../../../scripts/pipeline/lib/releaseEvidenceV7.mjs';
import {hashJSON,FACTORY_POLICY} from '../../../../../data/question_factory_policy.mjs';
import {canonicalQuestion} from '../../../../../data/content_evidence.js';
import {getCanonicalChapters} from '../../../../../data/canonical_syllabus.js';
import factoryScope from '../../../../../data/question_factory_scope.json' with {type:'json'};

const dir=dirname(fileURLToPath(import.meta.url)), read=name=>JSON.parse(readFileSync(resolve(dir,name),'utf8')), fail=[];
const frozen=read('frozen.json'),cases=read('cases.json'),overlay=read('scratch-registry-overlay.json'),certs=read('source-certificates.json'),blind=read('blind-review-packet.json');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b), fixtures=frozen.fixtures||[], roots=fixtures.filter(f=>f.group==='authored_valid'), defects=fixtures.filter(f=>f.group==='controlled_defect');
const add=(condition,issue)=>{if(!condition)fail.push(issue);};
const payload=hashJSON(fixtures.map(f=>({id:f.id,group:f.group,category:f.category,expected_valid:f.expected_valid,candidate:f.candidate,oracle:f.oracle})));
add(frozen.id==='fresh-full-v5-2026-10-08','benchmark_id');
add(fixtures.length===96&&roots.length===64&&defects.length===32,'96_item_denominator');
add(cases.fixtures?.length===96&&same(cases.fixtures,fixtures),'cases_frozen_match');
add(frozen.payload_hash===payload,'payload_hash');
add(same(frozen.contract_binding,expectedReleaseBinding()),'actual_current_release_binding');
add(frozen.verifier_version===expectedReleaseBinding().verifier_version,'verifier_version');
add(frozen.classification==='fresh'&&frozen.scope==='full_cuet_release','fresh_full_release_scope');
add(frozen.release_eligibility?.approved_before_evaluation===true&&frozen.release_eligibility.previously_read===false&&frozen.release_eligibility.tuned_on===false,'preregistration_flags');
add(frozen.release_eligibility?.preregistration_id==='fresh-full-v5-prereg-2026-10-08','preregistration_id');
add(frozen.benchmark_contract?.policy_version===FACTORY_POLICY&&frozen.benchmark_contract.denominator===96,'policy_contract');
add(frozen.benchmark_contract?.syllabus_baseline?.includes('provisional for 2027'),'provisional_2027_baseline');
add(frozen.benchmark_contract?.accountancy_branch?.startsWith('financial_analysis_only'),'accountancy_branch_scope');
add(read('preregistration.json').paid_evaluation_authorized===false,'no_paid_evaluation_authorized');
add(read('preregistration.json').evaluation_started===false,'no_evaluation_started');
add(read('preregistration.json').release_policy?.fresh_controlled_defect_false_accepts_max===0&&read('preregistration.json').release_policy?.valid_survival_min===0.85,'preregistered_release_rule');
add(overlay.registry_mutation!==true,'overlay_only');
add(blind.contains_answers===false&&blind.contains_explanations===false&&blind.contains_labels===false&&blind.items?.length===64,'blind_packet_metadata');
add(blind.items.every(x=>!('correct_answer'in x)&&!('explanation'in x)&&!('oracle'in x)&&!('category'in x)&&!('expected_valid'in x)),'blind_packet_has_no_answer_or_labels');
add(new Set(fixtures.map(f=>f.id)).size===96,'unique_fixture_ids');
add(new Set(roots.map(f=>f.candidate.id)).size===64,'unique_root_ids');
for(const subject of REQUIRED_SUBJECTS){
 const sr=roots.filter(f=>f.candidate.subject===subject),sd=defects.filter(f=>f.candidate.subject===subject);
 add(sr.length===16&&sd.length===8,'subject_counts:'+subject);
 if(subject!=='english') add(new Set(sr.map(f=>f.candidate.chapter)).size>=4,'commerce_topic_coverage:'+subject);
}
add(defects.every(f=>f.mutation?.category===f.category&&f.derived_from),'defect_mutation_records');
for(const category of ['wrong_key','overlapping_options','unsupported_explanation','missing_assumptions','out_of_syllabus','numeric_fault'])add(defects.some(f=>f.category===category),'defect_category:'+category);
for(const f of fixtures){
 const c=f.candidate,q=canonicalQuestion(c);
 add(c.id===f.id,'candidate_id:'+f.id);
 add(Array.isArray(c.options)&&q.options.length===4,'four_options:'+f.id);
 if(f.expected_valid)add(new Set(q.options.map(o=>o.text.trim().toLowerCase())).size===4,'valid_root_option_distinctness:'+f.id);
 add('ABCD'.includes(c.correct_answer),'candidate_answer_encoding:'+f.id);
 add(c.family_id==='fresh-full-v5-family-'+c.id,'candidate_family:'+f.id);
 add(c.provenance?.kind==='original_practice','original_practice_provenance:'+f.id);
 add(c.provenance?.source_pack_id==='fresh-full-v5-'+c.subject+'-overlay','overlay_pack:'+f.id);
 if(f.group==='authored_valid') add(getCanonicalChapters(c.subject).includes(c.chapter)&&factoryScope.subjects[c.subject]?.chapters.includes(c.chapter),'root_chapter_entitlement:'+f.id);
 if(f.category==='out_of_syllabus')add(!factoryScope.subjects[c.subject]?.chapters.includes(c.chapter),'out_of_syllabus_control:'+f.id);
 for(const r of c.source_refs||[]){
  const cert=certs.sources[r.id+':'+r.locator],s=overlay.sources[r.id]||registry.sources[r.id];
  add(Boolean(cert&&s?.facts?.[r.locator]),'source_certificate:'+f.id+':'+r.id);
  if(cert&&s)add(cert.version===r.version&&cert.support_hash===r.support_hash&&s.supports?.[r.locator]===r.support_hash,'source_support_hash:'+f.id+':'+r.id);
  if(cert&&s)add(cert.exact_excerpt===s.facts[r.locator].text&&cert.registered_fact_sha256===hashJSON(s.facts[r.locator].text),'source_exact_quote:'+f.id+':'+r.id);
  if(cert)add(cert.supporting_quotes?.every(q=>cert.exact_excerpt.includes(q)),'source_concise_quote:'+f.id+':'+r.id);
 }
}
const official=registry.sources['cuet2026-english-syllabus']?.facts?.['full-syllabus']?.text||'';
const syllabusCertificate=certs.english_syllabus_clause;
add(Boolean(syllabusCertificate?.exact_clause&&official.includes(syllabusCertificate.exact_clause)&&syllabusCertificate.support_hash===registry.sources['cuet2026-english-syllabus'].supports['full-syllabus']),'official_english_syllabus_clause');
add(roots.filter(f=>f.candidate.subject==='english').every(f=>f.candidate.route==='passage'&&f.candidate.passage_text.trim().length>0&&f.candidate.passage_text.trim().split(/\s+/).length<=300),'english_complete_passages_under_300');
add(Object.keys(overlay.sources).every(id=>overlay.sources[id].origin==='original_benchmark_overlay'||overlay.sources[id].permission?.basis?.includes('Original passage')),'original_source_overlay');
const styles=new Set(roots.map(f=>f.candidate.question_type));
for(const needed of ['direct_recall','numerical_mcq','matching','statement_mcq','ordering_mcq','passage_direct','passage_inference']) add(styles.has(needed),'format_coverage:'+needed);
const report={benchmark_id:frozen.id,state:fail.length?'failed':'structurally_verified',fixture_count:fixtures.length,valid_roots:roots.length,controlled_defects:defects.length,per_subject:Object.fromEntries(REQUIRED_SUBJECTS.map(s=>[s,{roots:roots.filter(f=>f.candidate.subject===s).length,defects:defects.filter(f=>f.candidate.subject===s).length}])),topic_count:Object.keys(read('structural-report.json').topic_counts).length,format_count:styles.size,payload_hash:frozen.payload_hash,contract_binding_hash:frozen.contract_binding.validation_contract_hash,failures:[...new Set(fail)]};
console.log(JSON.stringify(report,null,2));
if(fail.length)process.exitCode=1;
