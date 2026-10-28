// Construct once, before any paid fit outcome. Retain every raw reference case.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {payloadHash} from '../lib/cuetFitBenchmark.mjs';
import {expectedReleaseBindingV73} from '../lib/releaseEvidenceV73.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const root=resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-2024-25-source-keys-v4');
const dir=resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-official-source-v73');
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),hash=s=>createHash('sha256').update(s).digest('hex');
if(existsSync(dir))throw Error('immutable_fresh_study_already_exists');
const packet=read(join(root,'questions-blinded-v1.json')),comparison=read(join(root,'OFFICIAL-COMPARISON.json')),second=read(join(root,'SECOND-REVIEW-FREEZE.json')),registry=read('data/source_registry.json');
if(comparison.raw_denominator!==32||comparison.positive_count!==22||comparison.frozen_answers_changed!==0||JSON.stringify(packet.pre_acquisition_binding)!==JSON.stringify(expectedReleaseBindingV73()))throw Error('complete_current_source_custody_required');
const audits=['english-source-derivation-v2.json','accountancy-source-derivation-v1.json','business-source-derivation-v1.json','economics-source-derivation-v1.json'].flatMap(n=>read(join(root,'source-support',n)).items);
const sourceView=read(join(root,'independent-second-review-packet.json'));
if(sourceView.contains_proposed_answers!==false||comparison.second_review_freeze_sha256!==sha(join(root,'SECOND-REVIEW-FREEZE.json')))throw Error('blind_custody_changed');
for(const record of second.reviews)if(sha(record.path)!==record.sha256)throw Error('independent_review_changed');
const overlay={sources:{},families:{},packs:{}},fixtures=[];
for(const subject of ['english','accountancy','business_studies','economics']){
 const id='fresh-v73-source-'+subject;
 overlay.packs[id]={id,subject,version:1,state:'active',registered_at:new Date().toISOString(),document_ids:[]};
}
function addSource({id,subject,chapter,text,url,title,identity,kind='reference',permission='Brief attributed educational verification excerpt in a private measurement corpus; no unrestricted redistribution claim'}){
 if(overlay.sources[id])return {id,version:1,locator:'decisive-excerpt',support_hash:hashJSON(text)};
 const pack='fresh-v73-source-'+subject;
 overlay.sources[id]={id,kind,state:'active',version:1,chapters:[chapter],url,title,identity_sha256:identity,extraction_sha256:hash(text),extraction_checked:true,reuse_permitted:true,permission:{basis:permission,reference:url},facts:{'decisive-excerpt':{text}},supports:{'decisive-excerpt':hashJSON(text)},source_pack_id:pack};
 overlay.packs[pack].document_ids.push(id);
 return {id,version:1,locator:'decisive-excerpt',support_hash:hashJSON(text)};
}
const lexicalQuote='a loud noise, especially one that is made by a lot of people or animals';
const lexicalCache={at:new Date().toISOString(),url:'https://www.oxfordlearnersdictionaries.com/us/definition/english/clamour_2',title:'Oxford Advanced Learner’s Dictionary: clamour noun',quote:lexicalQuote,retrieval:'Publisher-page excerpt returned by the web retrieval tool; not an original HTML or complete dictionary document hash.',quote_sha256:hash(lexicalQuote),first_solver_answer_unchanged:true,official_key_not_supplied_to_validator:true};
function candidate(q,a){
 const chapter=q.chapter==='Dissolution of Partnership'?'Dissolution of Partnership Firm':q.chapter,pack='fresh-v73-source-'+q.subject,family=q.subject==='english'?'fresh-v73-english-linked-passage':`fresh-v73-family-${q.item_id}`;
 const views=sourceView.items.find(v=>v.item_id===q.item_id),stimulus=packet.stimuli.find(s=>s.stimulus_id===q.stimulus_id);
 const refs=views.source_excerpts.map((s,i)=>addSource({id:`fresh-v73-${q.item_id}-excerpt-${i+1}`,subject:q.subject,chapter,text:s.quote,url:s.url||'local://mockmob/fresh-source-stimulus/'+q.stimulus_id,title:s.kind==='adapted_question_stimulus'?'Frozen original adapted practice passage':'Selected authoritative teaching excerpt',identity:s.document_sha256,permission:s.permission_basis}));
 if(q.item_id==='cbse24-eng-q08')refs.push(addSource({id:'fresh-v73-oxford-clamour-noun',subject:q.subject,chapter,text:lexicalQuote,url:lexicalCache.url,title:lexicalCache.title,identity:hash(lexicalQuote),permission:'Short attributed dictionary quotation for private educational verification; original publisher page identity is the URL, and cached excerpt identity is its recorded digest.'}));
 overlay.families[family]={state:'active',version:1,source_pack_id:pack,kind:'original_practice'};
 const numeric=q.subject==='accountancy'&&['01','08'].includes(q.item_id.slice(-2))||q.item_id==='cbse24-eco-q06';
 const format=q.subject==='english'?'reading_comprehension':numeric?'numerical_calculation':/Assertion|Statement/.test(q.body)?'statement_selection':q.body.length>220?'case_application':'direct_mcq';
 const spec=registry.exam_specs[q.subject];
 return{id:q.item_id,subject:q.subject,chapter,concept_id:null,body:q.body,options:structuredClone(q.options),correct_answer:a.source_derived_provisional_key,
  explanation:a.derivation+' '+a.option_claims.map(o=>`${o.option}: ${o.assessment}`).join(' '),route:stimulus?'passage':numeric?'numerical':'conceptual',difficulty:numeric||format==='case_application'?'medium':'easy',question_type:format,passage_text:stimulus?.text||'',family_id:family,source_refs:refs,
  provenance:{kind:'original_practice',anchor_id:null,adaptation_family:family,adaptation_type:null,syllabus_version:spec.syllabus_version,pattern_version:spec.pattern_version,source_pack_id:pack,source_pack_version:1}};
}
for(const proof of comparison.records.filter(r=>r.positive_control_eligible)){
 const q=packet.items.find(i=>i.item_id===proof.id),a=audits.find(i=>i.item_id===proof.id),c=candidate(q,a);
 fixtures.push({id:c.id,group:'authored_valid',category:'valid',expected_valid:true,candidate:c,oracle:{key:c.correct_answer,basis:'Frozen source derivation, separately blinded Luna first pass and official CBSE source key/value point agree; disputed or insufficient-support cases were withheld before fit evaluation.',source_refs:c.source_refs},source_custody:proof,construction_repairs_used:q.targeted_source_edits_used,maximum_additional_repairs:0});
}
function defect(rootId,category,mutate,basis,extra={}){
 const base=fixtures.find(f=>f.id===rootId&&f.expected_valid===true);if(!base)throw Error('positive_root_required:'+rootId);
 const c=structuredClone(base.candidate),id=rootId+'--'+category;c.id=id;mutate(c);
 fixtures.push({id,group:'controlled_defect',category,expected_valid:false,candidate:c,oracle:{key:extra.key||base.oracle.key,correct_key_of_base:base.oracle.key,basis,source_refs:c.source_refs},derived_from:rootId,construction_repairs_used:0,maximum_additional_repairs:0,...extra});
}
defect('cbse24-eng-q01','wrong_key',c=>c.correct_answer='D','The frozen passage says notifications draw attention to screens; A is supported and D contradicts it.');
defect('cbse24-ac-q01','wrong_key',c=>c.correct_answer='A','Independent calculation gives Amar a 120000 debit, B; A omits the guarantee adjustment.');
defect('cbse24-eco-q06','wrong_key',c=>c.correct_answer='A','45 minus 27.2 is fiscal deficit, B; revenue expenditure and revenue receipts are not supplied.');
defect('cbse24-eng-q01','overlapping_options',c=>c.options[1].text='Pull attention from spoken exchanges towards phone screens','A and B differently phrase the same passage-supported effect.',{key:'multiple_correct_A_B'});
defect('cbse24-bs-q02','overlapping_options',c=>c.options[1].text='Allocating defined duties to staff according to their skills','B and D both describe the supplied assignment-of-duties rule.',{key:'multiple_correct_B_D'});
defect('cbse24-eco-q06','overlapping_options',c=>c.options[3].text='Fiscal deficit: expenditure minus non-borrowing receipts','B and D both name the same fiscal-deficit calculation.',{key:'multiple_correct_B_D'});
defect('cbse24-ac-q01','missing_assumption',c=>c.body=c.body.replace('share profits and losses equally.','share profits and losses in an unequal ratio that is not specified here.'),'The expressly unequal profit/loss ratio is missing. Equal default sharing cannot replace an expressly unequal agreement. Equal sharing gives Amar 120000, but 2:1:1 gives 142500.',{key:'indeterminate'});
defect('cbse24-ac-q08','missing_settlement_value',c=>c.body=c.body.replace('in full settlement','in partial settlement'),'Partial settlement does not establish the agreed takeover value. Book value is not automatically the settlement consideration.',{key:'indeterminate'});
defect('cbse24-ac-q04','missing_provision_amount',c=>c.body=c.body.replace('of ₹20,000','of an unspecified amount'),'The provision may cover all or only part of the 15000 bad debt. Its amount changes the adjustment and any residual loss; a general rule cannot supply this case amount.',{key:'indeterminate'});
defect('cbse24-ac-q01','numerical_fault',c=>c.options[1].text='₹1,10,000','The correct total debit is 120000, now absent from all four alternatives.',{key:'none'});
defect('cbse24-eco-q06','numerical_fault',c=>c.body=c.body.replace('₹17.8','₹16.8'),'45 minus 27.2 equals 17.8, not the displayed 16.8; the numerical premise is false.',{key:'none'});
defect('cbse24-ac-q01','explanation_arithmetic',c=>c.explanation+=' The guarantee deficiency is ₹1,10,000.','The appended assertion contradicts 60000 - (-60000) =120000.');
defect('cbse24-eng-q03','unsupported_explanation',c=>c.explanation+=' The cited passage reports that 82% of Class XII students check phones every hour.','The appended statistic is deliberately invented for this withheld control. No sample, number or hourly fact appears in the passage.');
defect('cbse24-eco-q02','unsupported_explanation',c=>c.explanation+=' NCERT reports that this policy reduced income inequality by exactly 18% in 2025.','The appended dated effect is deliberately fabricated for a withheld control; it appears nowhere in the selected source and is not hypothetical data.');
defect('cbse24-eng-q07','incomplete_passage',c=>c.passage_text='','The question refers to paragraphs 3–4, but the candidate has no passage. Internal research cannot substitute for missing student text.');
defect('cbse24-eng-q03','missing_decisive_paragraph',c=>c.passage_text=c.passage_text.split('\n\n').filter(p=>!p.startsWith('(2)')).join('\n\n'),'The absent-phone/phantom-limb paragraph is removed from the candidate passage, while internal references still retain it.',{key:'not_answerable_from_candidate_passage'});
defect('cbse24-eng-q04','passage_unanswerable',c=>{c.body='Exactly how many smartphone notifications arrive in the room each hour?';c.options=['Two','Four','Six','Eight'].map((text,i)=>({key:'ABCD'[i],text}));},'The passage and references supply no hourly notification count.',{key:'indeterminate'});
defect('cbse24-eco-q07','boundary_explanation',c=>c.explanation+=' Equality is excluded: MPC must always be strictly less than 1.','The selected NCERT source explicitly gives maximum MPC=1; the appended strict inequality contradicts its equality boundary.');
defect('cbse24-ac-q04','false_authentic_pyq_claim',c=>{c.provenance.kind='authentic_pyq';c.provenance.anchor_id='cbse-2024-not-a-cuet-pyq';},'A CBSE-reference practice adaptation cannot claim an authenticated CUET PYQ anchor.');
defect('cbse24-eco-q04','out_of_syllabus',c=>{c.body='For this statistics question, define the median of five ordered observations as the third observation. For the observations 11, 27, 39, 45 and 70, what is the median?';c.options=['27','39','45','70'].map((text,i)=>({key:'ABCD'[i],text}));c.correct_answer='B';c.explanation='The stipulated definition selects the third ordered observation, 39.';const text=c.body;c.source_refs=[addSource({id:'fresh-v73-original-statistics-stimulus',subject:c.subject,chapter:c.chapter,text,url:'local://mockmob/fresh-controlled-statistics-stimulus',title:'Original hypothetical statistics definition and data',identity:hash(text),permission:'Original controlled hypothetical stimulus; never published.'})];},'The actual objective is a Statistics median computation, outside current CUET Economics units; an entitled chapter label cannot confer entitlement on another topic.',{key:'B'});
if(fixtures.length!==42||fixtures.filter(f=>f.expected_valid).length!==22)throw Error('fixed_denominator_changed');
const removed=fixtures.find(f=>f.category==='missing_decisive_paragraph');if(removed.candidate.passage_text.includes('When phones are out of reach'))throw Error('decisive_paragraph_was_not_removed');
const id='fresh-official-source-v73-2026-10-08',frozen={id,created_at:new Date().toISOString(),fixtures,payload_hash:payloadHash(fixtures),denominator:42,valid_roots:22,controlled_defects:20,contract_binding:expectedReleaseBindingV73(),verifier_version:'cuet-fit-validator-v7.3',release_eligibility:{scope:'full_cuet_release',classification:'fresh',approved_before_evaluation:true,previously_read:false,tuned_on:false,preregistration_id:id},construction_disclosure:{raw_reference_denominator:32,positive_controls:22,withheld_reference_cases:10,official_comparison_sha256:sha(join(root,'OFFICIAL-COMPARISON.json')),pre_acquisition_binding_sha256:sha(join(root,'PRE-ACQUISITION-BINDING.json')),first_passes_frozen_before_official_keys:true,candidate_grammar_or_semantics_changed_after_second_review:false,maximum_content_repairs:0,lexical_evidence_supplement:'A 17-word publisher dictionary definition was retrieved after independent solves, before any paid fit outcome; no candidate key, option, passage, oracle label or validator contract changed.',source_family_correlation:'Four source-paper families; six positive English controls share one 190-word stimulus. Paired controls are correlated, not perfect-accuracy evidence.',format_limit:'This compact set covers passage/direct/case/statement/numerical formats; matching and ordering are covered separately by generation and historical regression.',publication:'never'}};
mkdirSync(dir,{recursive:true});const save=(n,d)=>writeFileSync(join(dir,n),JSON.stringify(d,null,2)+'\n',{flag:'wx'});
save('frozen.json',frozen);save('scratch-registry-overlay.json',overlay);save('lexical-evidence-supplement.json',lexicalCache);
save('independent-key-custody.json',{at:new Date().toISOString(),complete:true,positive_ids:fixtures.filter(f=>f.expected_valid).map(f=>f.id),problems:[],raw_reference_denominator:32,withheld_ids:comparison.records.filter(r=>!r.positive_control_eligible).map(r=>r.id),all_raw_comparison:comparison,independent_second_review_freeze:second,official_key_manifest_sha256:sha(join(root,'OFFICIAL-KEY-SOURCE-MANIFEST.json')),validator_results_seen:false,limitation:'Selection uses only pre-validation source/key evidence; all 32 source cases and 20 explicit controlled mutations remain auditable.'});
console.log(JSON.stringify({dir,denominator:42,positive:22,defects:20,payload_hash:frozen.payload_hash,paid_calls:0,publication_writes:0}));
