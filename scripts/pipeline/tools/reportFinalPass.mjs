import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {contentHash} from '../../../data/content_evidence.js';
import {FACTORY_SUBJECTS,factoryCalibrationReady,inventoryFingerprint} from '../../../data/question_factory_policy.mjs';
import {getCanonicalChapters} from '../../../data/canonical_syllabus.js';
import {presentationLint,formatQuestionText} from '../../../data/question_presentation.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
import {factoryCostReport} from '../lib/factoryCosts.mjs';
// Read-only ledger audit. No environment secrets, paid calls or site writes.
const out='artifacts/question-factory/final-pass';mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const source=read('artifacts/question-factory/quality-v5/results.json'),previous=read('artifacts/question-factory/quality-v5/cost-and-cohort-report.json'),audit=read('artifacts/question-factory/quality-v5/independent-audit.json'),registry=read('data/source_registry.json'),calibration=read('data/calibration_manifest.json');
const db=new DatabaseSync(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite',{readOnly:true});
const requests=db.prepare('SELECT * FROM requests').all(),costs=factoryCostReport({db});
const sum=rows=>rows.reduce((s,r)=>s+(r.actual??r.reserved)/1e6,0),settled=sum(requests.filter(r=>r.state==='settled')),held=sum(requests.filter(r=>r.state!=='settled')),ceiling=db.prepare('SELECT limit_micro FROM budget').get().limit_micro/1e6;
let under=0,over=0,affected=0;
for(const row of requests.filter(r=>r.state==='settled'&&r.model==='gpt-6-luna')) {
 const r=JSON.parse(row.receipt_json||'{}'),u=r.usage,d=u?.input_tokens_details;
 if(!u||!r.rates||!(d?.cache_write_tokens||d?.cached_tokens))continue;
 const c=d.cached_tokens||0,w=d.cache_write_tokens||0,rate=r.rates;
 const calc=Math.ceil((u.input_tokens-c-w)*rate.input_per_million+c*(rate.cached_input_per_million??rate.input_per_million*.1)+w*(rate.cache_write_per_million??rate.input_per_million*1.25)+u.output_tokens*rate.output_per_million);
 affected++;under+=Math.max(0,calc-row.actual);over+=Math.max(0,row.actual-calc);
}
const cacheAudit={affected_receipts:affected,underbooked_rows_usd:under/1e6,overbooked_rows_usd:over/1e6,net_adjustment_estimate_usd:(under-over)/1e6,basis:'Read-only recomputation from saved token partitions and published Luna cache ratios. Original settled costs stay preserved. This is not invoice reconciliation.',source_url:'https://developers.openai.com/api/docs/models/gpt-6-luna'};
save(out+'/cache-price-audit.json',cacheAudit);
const eligible=source.jobs.filter(j=>j.state==='eligible');
if(audit.items.length!==eligible.length||new Set(audit.items.map(a=>a.n)).size!==eligible.length)throw Error('Incomplete historical audit');
const items=eligible.map(j=>{
 const a=audit.items.find(x=>x.n===j.number);if(!a)throw Error('Missing audit item');
 const lint=presentationLint(j.candidate),display=formatQuestionText(j.candidate.body);
 let classification=a.verdict;
 if(lint.length)classification='needs_correction';else if(j.number===51&&display!==j.candidate.body)classification='display_restored_needs_revalidation';else if(a.verdict==='defect')classification='needs_correction';
 return {n:j.number,id:j.id,content_hash:contentHash(j.candidate),subject:j.subject,kind:j.kind,historical_verdict:a.verdict,classification,lint,review_note:a.note,display_changed:display!==j.candidate.body,new_publication_evidence:false};
});
const count=v=>items.filter(i=>i.classification===v).length;
const unchanged=count('publish_ready')+count('acceptable_weak'),restored=count('display_restored_needs_revalidation'),ready=unchanged+restored;
const per=previous.spend.cohort_usd/ready,remaining=ceiling-settled-held;
const coverage=FACTORY_SUBJECTS.map(subject=>{
 const reserved=new Set(registry.calibration_anchor_ids||[]),anchors=registry.examples.filter(a=>a.subject===subject&&!a.dropped&&a.generation_ready!==false&&!reserved.has(a.id)&&registry.packs?.[a.source_pack_id]?.state==='active');
 const backed=[...new Set(anchors.map(a=>a.chapter))];
 return {subject,generation_anchors:anchors.length,backed_chapters:backed,missing_generation_chapters:getCanonicalChapters(subject).filter(c=>!backed.includes(c)),reviewed_ready_candidates:items.filter(i=>i.subject===subject&&['publish_ready','acceptable_weak','display_restored_needs_revalidation'].includes(i.classification)).length};
});
const report={at:new Date().toISOString(),verifier:FACTORY_VERIFIER_VERSION,production_changes:0,published:0,
 budget:{ceiling_usd:ceiling,settled_gross_usd:settled,held_usd:held,remaining_usd:remaining,new_committed_since_handover_usd:settled+held-previous.spend.lifetime_gross_usd,cache_price_audit:cacheAudit,invoice_reconciliation:'Token-rated ledger costs; promotional credits and provider invoices unverified',costs},
 historical_cohort:{planned:source.jobs.length,generated:source.generated,machine_passes:eligible.length,reviewed_strong:count('publish_ready'),reviewed_ordinary:count('acceptable_weak'),unchanged_review_supported:unchanged,display_restored:restored,potential_review_supported:ready,needs_correction:count('needs_correction'),duplicate_surplus:count('duplicate_surplus'),guaranteed_ten_out_of_ten:null,new_verified_questions:0,current_publication_eligible:0,audit_basis:'Claude included-subscription review cross-checked against all saved hashes and shared free checks. This is a review-supported draft count, not new signed academic evidence.'},
 coverage,items,
 forecast:{denominator:'Review-supported distinct drafts after mandatory defects, excluding two duplicates; includes one display restoration awaiting revalidation.',cohort_cost_usd:previous.spend.cohort_usd,real_time_cost_per_review_supported_usd:per,lifetime_total_for_10000_estimate_usd:settled+held+Math.max(0,10000-ready)*per,additional_review_supported_affordable_estimate:Math.floor(remaining/per),batch:{status:'Estimate only; full revised seven-item probe is still separately tracked',cost_per_review_supported_estimate_usd:per/2,lifetime_total_for_10000_estimate_usd:settled+held+Math.max(0,10000-ready)*per/2,additional_affordable_estimate:Math.floor(remaining/(per/2))},required_cost_per_new_question_for_10000_at_50_usd:remaining/(10000-ready),required_cost_per_new_question_for_10000_at_60_usd:(60-settled-held)/(10000-ready),sixty_usd_scenario_is_not_authorized_budget_change:true},
 release:{ready:factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION),saved_manifest_state:calibration.state,saved_manifest_verifier:calibration.verifier_version,valid_survival:calibration.valid_survival,benchmark_exposure:'Previously observed and tuned; regression evidence, not unseen validation',remaining:['Complete and inspect the saved batch probe without resubmitting accepted IDs.','Use a genuinely unobserved frozen officially keyed benchmark before claiming independent generalisation; add grammar/reading anchors and full source coverage.','Revalidate revised quality tiers against every critical negative and all audited defects. Preserve historical results.','Measure a separate subject-balanced batch cohort, including every failure/repair/blueprint and denominator. Scale only from measured usable yield.','Stage the saved migration and verify signed-in admin/worker restart/atomic publication/dispute behavior; save dry-run reports before production approval.']}
};
save(`${out}/reconciliation-report.json`,report);
const rows=items.filter(i=>['publish_ready','acceptable_weak','display_restored_needs_revalidation'].includes(i.classification)).map(i=>{
 const q=structuredClone(source.jobs.find(j=>j.id===i.id).candidate);delete q.evidence;
 return {...q,display_body:formatQuestionText(q.body),review:{...i,publication_ready:false}};
});
save(`${out}/review-supported-drafts.json`,{publication_ready:false,guaranteed_accuracy:false,reviewed_count:rows.length,questions:rows});
const fmt=n=>'$'+n.toFixed(2);
writeFileSync(`${out}/REPORT.md`,[
 '# Question factory final pass — 6 October 2026','',
 '**Not end-to-end ready. The question bank is not syllabus-complete, the current verifier has no released calibration, and nothing from this work is published.**','',
 `The persistent ledger confirms ${fmt(settled)} settled gross cost, ${fmt(held)} reserved for pending work, and ${fmt(remaining)} available under the unchanged $50 lifetime ceiling. Provider invoices and promotional deductions are not reconciled. Claude used Luna and Gemini APIs for the questions and acted as developer/reviewer in its subscription session. There is no Opus authoring receipt in this cohort.`, '',
 '| Count | Meaning |','| --- | --- |',
 `| ${source.jobs.length} | Planned candidates, all retained in the denominator |`,
 `| ${source.generated} | Actually generated |`,
 `| ${eligible.length} | Historical automated passes under v5.3 |`,
 `| ${count('publish_ready')} | Historical review rated strong; no guarantee of perfection |`,
 `| ${count('acceptable_weak')} | Correct ordinary practice with craft weaknesses and no free blocking finding |`,
 `| ${unchanged} | Unchanged review-supported candidates |`,
 `| ${restored} | Original matching question restored for display; renewed verification still needed |`,
 `| ${ready} | Potential usable drafts after that display fix |`,
 `| ${count('needs_correction')} | Need wording/presentation/ambiguity correction |`,
 `| ${count('duplicate_surplus')} | Duplicate ideas, excluded from unique inventory |`,
 '| 0 | Newly verified under v5.4 or published |','',
 'The eighth previously labelled weak question (57) refers to an unseen list; it is withheld. The matching original (51) now displays its two lists separately without editing its signed text or key. Exact question hashes and classifications are in reconciliation-report.json; review-supported-drafts.json is explicitly unpublished.', '',
 '## Cost conclusion','',
 `The ${fmt(previous.spend.cohort_usd)} cohort cost is $${per.toFixed(5)} per review-supported draft, rather than the $0.01944 quoted per automated pass. Reaching 10,000 at this yield costs roughly ${fmt(report.forecast.lifetime_total_for_10000_estimate_usd)} at real-time rates, or ${fmt(report.forecast.batch.lifetime_total_for_10000_estimate_usd)} assuming every cost halves. Both are estimates, exclude new source acquisition/calibration/staging, and exceed $50–60. The required future rate is $${report.forecast.required_cost_per_new_question_for_10000_at_50_usd.toFixed(5)} per genuinely usable new question at $50. A $60 scenario does not change the code ceiling.`, '',
 'Full batch pricing and revised usable yield have not been established. A lower invoice due to credits is not a lower gross generation cost. Do not extrapolate machine passes as published questions. The 5,000–7,000 claim is not supported by the strict reviewed denominator.', '',
 '## Implemented','',
 '- 7–8/10 sound practice can pass. Correctness, single defensible answer, source entitlement, explicit conditions, explanation, syllabus and readable format remain mandatory. Optional craft notes cannot excuse a blocking defect.',
 '- Shared free presentation checks run before paid validation and again when evidence is served. They now cover saved/repaired items and three-entry matching choices.',
 '- Unambiguous flattened matching/statement lists restore at display time without changing stored content or keys.',
 '- Blueprints share subject-wide skill/task identities and avoidance context across anchors. This suppresses exact repeated skill IDs; semantic paraphrases can still require detection.',
 '- Campaigns support resumable native batches. Pending jobs stay pending and cannot quarantine an entire passage group prematurely. Receipts now record execution mode.',
 '- Cache reads/writes now use their distinct published rates. Historical saved partitions show a net overcount of about two cents; original settlements stay preserved, and the difference is separate from invoices. Unknown write pricing holds usage.',
 '- Seven frozen existing items form a small batch probe, including three defects caught at zero model cost, one ambiguous assertion-reason item and one deliberately wrong key. This is regression/transport measurement, not an unseen benchmark. No new authoring or production writes.', '',
 '## Remaining implementation order','',
 ...report.release.remaining.map((r,i)=>`${i+1}. ${r}`), '',
 'Source generation currently covers only vocabulary in English, four chapters in Business Studies, five in Economics, and ten tagged chapters in Accountancy. The 58 historical passes span 16 chapters, with 29 easy and 29 medium items. Easy questions remain useful; this distribution does not establish syllabus or stretch-item readiness. The 2026 baseline is verified; final 2027 format/syllabus cannot be asserted before the official documents are available.', '',
 '## Acceptance standard','',
 'Aim for excellent PYQ-faithful questions with plausible distractors and occasional modest stretch within Class XII. Admit sound 7–8/10 practice where only craft is weak. Quarantine wrong/uncertain keys, overlapping answers, missing decisive conditions, false sources, unsupported explanations, out-of-syllabus content or broken presentation. A score of 10 and model agreement are opinions, not proof of zero errors. No routine human review becomes a publication requirement.', '',
 'Verification and deployment boundaries are recorded in docs/brain/STATUS.md. All prior campaigns, receipts, dirty edits, payments, atomic credits and student-AI budgets are preserved.'
].join('\n')+'\n');
console.log(JSON.stringify({budget:{settled,held,remaining},cohort:report.historical_cohort,coverage,forecast:report.forecast,release:report.release.ready},null,2));db.close();
