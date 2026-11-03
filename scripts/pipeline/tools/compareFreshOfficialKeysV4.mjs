// Official keys are compared AFTER immutable independent first passes. No answer is rewritten.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-2024-25-source-keys-v4'),read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const freeze=read(join(root,'SECOND-REVIEW-FREEZE.json')),packet=read(join(root,'questions-blinded-v1.json')),manifest=read(join(root,'OFFICIAL-KEY-SOURCE-MANIFEST.json'));
if(manifest.second_review_freeze_sha256!==sha(join(root,'SECOND-REVIEW-FREEZE.json')))throw Error('all_first_passes_must_precede_gold');
const roots=['english-source-derivation-v2.json','accountancy-source-derivation-v1.json','business-source-derivation-v1.json','economics-source-derivation-v1.json'].flatMap(n=>read(join(root,'source-support',n)).items);
const independent=freeze.reviews.flatMap(r=>{if(sha(r.path)!==r.sha256)throw Error('immutable_independent_review_changed');const d=read(r.path);return d.items||d.records;});
const keys={accountancy:['B','D','C','A','C','B','D','A'],business_studies:['A','D','C','D','A','D','C','D'],economics:['D','C','B','B','B','B','A','D'],english:['A','B','A','A','C','C','A','D']};
const quotes={
 accountancy:['1. B- ₹ 1,20,000','2. D - A is false but R is true','3. C - Subscribed','4. A - Bad Debts A/c Dr. To Debtors A/c Prov. for Doubtful Debts A/c Dr. To Bad Debts A/c','5. C - 12 %','6. B- ₹ 4,800; ₹ 2,700; ₹ 2,100','7. D - 1st May 2024','8. A - Realisation Account will be credited by ₹ 60,000'],
 business_studies:['1. A. Management as science','2. D. Assignment of duties','3. C. Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion.','4. D. Statement II is true, Statement I is false','5. A. Competitive spirit among the existing staff','6. D. Economic and technological environment','7. C. Buy only standardised products','8. D. Assertion (A) is false, Reason (R) is true'],
 economics:['1. D. Assertion (A) is false, but Reason (R) is true.','2. C. Redistribution of income','3. B. Net Product Taxes','4. B. flexible','For Visually Impaired Candidates: B. 450','6. B. fiscal','7. A. Statement 1 is true and Statement 2 is false.','8. D. Autonomous Consumption, Induced Consumption and Autonomous Investment'],
 english:['I They lead to instant interruptions in conversations.','II It illustrates how moments are fleeting and unnoticed, lost amid the distractions of digital interactions','III A. a deep (psychological) dependence on technology for a sense of wholeness or connection','IV reduce the anxiety associated with the need to constantly be connected','V C. It interferes with our ability to engage with meaningful aspects of our life.','VI Yes it does - develop a hunch / mind is constantly alert (any one)','VII The phrase refers to the natural, meaningful, and often quieter moments that make up human existence and relationships','VIII D. clamour']};
const records=packet.items.map(q=>{
 const n=Number(q.item_id.slice(-2))-1,r=roots.find(i=>i.item_id===q.item_id),s=independent.find(i=>i.item_id===q.item_id),doc=manifest.documents.find(d=>d.subject===q.subject),cache=read(doc.cache_path),quote=quotes[q.subject][n],page=cache.pages.find(p=>p.text.includes(quote));
 if(!r||!s||!page||sha(doc.pdf_path)!==doc.pdf_sha256||sha(doc.cache_path)!==doc.cache_sha256)throw Error('complete_immutable_comparison_required:'+q.item_id);
 const offset=page.text.indexOf(quote),officialMappedKey=keys[q.subject][n],second=s.independently_solved_key;
 const reasons=[];
 if(r.unique_key_supported!==true||!r.source_derived_provisional_key)reasons.push('first_source_solver_withheld');
 if(!/^[ABCD]$/.test(second||'')||(s.cuet_fit_ready??s.CUET_fit_ready)!==true||s.uncertain===true||s.cuet_fit_uncertain===true)reasons.push('independent_solver_abstained_or_not_ready');
 if(r.source_derived_provisional_key!==second)reasons.push('independent_source_key_disagreement');
 if(r.source_derived_provisional_key!==officialMappedKey||second!==officialMappedKey)reasons.push('official_key_or_value_point_disagreement');
 if(freeze.positive_control_additional_exclusions.some(e=>e.id===q.item_id))reasons.push('frozen_review_integrity_hold');
 return {id:q.item_id,subject:q.subject,first_source_key:r.source_derived_provisional_key,independent_second_key:second,official_comparison_key:officialMappedKey,
 official_key_type:q.subject==='english'&&![2,4,7].includes(n)?'official_value_point_mapped_to_preexisting_adapted_options':'official_letter_for_selected_source_variant',
 official_source:{url:doc.official_url,pdf_sha256:doc.pdf_sha256,cache_sha256:doc.cache_sha256,physical_pdf_page:page.page,quote_start:offset,quote_end:offset+quote.length,quote},
 positive_control_eligible:reasons.length===0,withhold_reasons:reasons,
 disclosure:q.subject==='english'?'Some source answers are descriptive value points, mapped semantically to the already frozen MCQ adaptation; not claimed as an official CUET answer key.':n===4&&q.subject==='economics'?'The selected visually impaired source variant has B=45 degrees; the original graphical variant uses different diagram labels.':null};
});
const output=join(root,'OFFICIAL-COMPARISON.json');if(existsSync(output))throw Error('immutable_official_comparison_exists');
writeFileSync(output,JSON.stringify({at:new Date().toISOString(),raw_denominator:32,pre_acquisition_binding:packet.pre_acquisition_binding,packet_sha256:sha(join(root,'questions-blinded-v1.json')),second_review_freeze_sha256:sha(join(root,'SECOND-REVIEW-FREEZE.json')),official_key_manifest_sha256:sha(join(root,'OFFICIAL-KEY-SOURCE-MANIFEST.json')),records,positive_count:records.filter(r=>r.positive_control_eligible).length,withheld_count:records.filter(r=>!r.positive_control_eligible).length,frozen_answers_changed:0,paid_calls:0,CUET_validator_results_seen:false,publication:false,limitations:['All 32 raw cases retained; positive-control selection is based only on frozen source solves and official comparison before paid CUET-fit outcomes.','Official source paper families and the eight linked English adaptations are correlated.','Agreement with a marking scheme does not compensate for ambiguity or missing support.']},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:output,sha256:sha(output),raw_denominator:32,positive:records.filter(r=>r.positive_control_eligible).length,withheld:records.filter(r=>!r.positive_control_eligible).map(r=>({id:r.id,reasons:r.withhold_reasons})),paid_calls:0}));
