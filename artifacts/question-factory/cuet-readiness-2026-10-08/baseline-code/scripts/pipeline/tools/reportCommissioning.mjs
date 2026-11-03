import {readFileSync,writeFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {DatabaseSync} from 'node:sqlite';
import {contentHash,evaluateEvidence} from '../../../data/content_evidence.js';
import {inventoryFingerprint,FACTORY_SUBJECTS} from '../../../data/question_factory_policy.mjs';
import {prepareFactoryPublication,factoryPassageGroup} from '../lib/factoryCore.mjs';

try{loadEnvFile('.env.local');}catch{}
const root='artifacts/question-factory',read=p=>JSON.parse(readFileSync(p,'utf8'));
const raw=read(`${root}/commissioning100-results.json`),baseline=read(`${root}/commissioning100-baseline.json`),registry=read('data/source_registry.json');
const calibration=read('data/calibration_manifest.json');
const db=new DatabaseSync(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite',{readOnly:true});
const receipts=db.prepare('SELECT id,created_at,actual,state,receipt_json FROM requests').all().map(r=>({...r,receipt:r.receipt_json?JSON.parse(r.receipt_json):{}}));
const costsFor=id=>receipts.filter(r=>r.receipt.candidate_id===id);
const total=rows=>rows.reduce((s,r)=>s+(r.actual||0)/1e6,0);
const jobs=raw.jobs.map((j,index)=>({...j,number:index+1,cost_usd:total(costsFor(j.id)),requests:costsFor(j.id).length}));
const reasons={};for(const j of jobs)if(j.state==='quarantined')for(const r of j.result?.reasons||[])reasons[r]=(reasons[r]||0)+1;
const countBy=(rows,field)=>rows.reduce((m,r)=>(m[r[field]||'unknown']=(m[r[field]||'unknown']||0)+1,m),{});
const variants=jobs.filter(j=>j.candidate),eligible=jobs.filter(j=>j.state==='eligible');
const publicationDryRun=[];
for(const job of eligible){
 const question=job.candidate,verdict=evaluateEvidence(question,{...registry,secret:process.env.CUET_EVIDENCE_SIGNING_KEY});
 if(!verdict.eligible)throw new Error(`saved_evidence_not_eligible:${job.id}:${verdict.reasons}`);
 const prepared=prepareFactoryPublication(question,{group:!!question.passage_group_id});
 if(contentHash(prepared.row)!==contentHash(question))throw new Error('publication_hash_roundtrip_failed');
 publicationDryRun.push({id:job.id,content_hash:contentHash(question),fingerprint:prepared.fingerprint,row_preparation:'passed',database_write:false});
}
for(const id of new Set(eligible.map(j=>j.passage_group_id).filter(Boolean)))factoryPassageGroup(eligible.filter(j=>j.passage_group_id===id).map(j=>j.candidate),registry);
const conservativeDebit=receipts.filter(r=>Date.parse(r.created_at+'Z')>=Date.parse(baseline.at)).reduce((sum,r)=>sum+(r.receipt.conservative_debit_micro||0)/1e6,0);
const campaignIds=new Set(jobs.map(j=>j.id));const campaignReceipts=receipts.filter(r=>campaignIds.has(r.receipt.candidate_id));
const campaignCost=total(campaignReceipts)+conservativeDebit;
const campaignStages={};for(const row of campaignReceipts){
 const stage=row.receipt.stage||'unclassified',s=campaignStages[stage] ||= {requests:0,cost_usd:0,input_tokens:0,output_tokens:0,reasoning_tokens:0};
 const u=row.receipt.usage||{};s.requests++;s.cost_usd+=(row.actual||0)/1e6;s.input_tokens+=u.input_tokens??u.promptTokenCount??0;
 s.output_tokens+=u.output_tokens??((u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0));s.reasoning_tokens+=u.output_tokens_details?.reasoning_tokens??u.thoughtsTokenCount??0;
}
const formatGroup=q=>q.route==='passage'?'passage group':q.route==='numerical'?'numerical MCQ':/synonym|antonym|vocabulary/i.test(q.question_type)?'vocabulary':/match/i.test(q.question_type)?'matching':/sequence|ordering/i.test(q.question_type)?'sequence':/statement/i.test(q.question_type)?'statement selection':'concept/application MCQ';
const batchEquivalent=campaignReceipts.reduce((sum,r)=>{
 const rate=read('data/pipeline-prices.json').models[r.receipt.model]?.batch,usage=r.receipt.usage;if(!rate||!usage)return sum;
 const input=usage.input_tokens??usage.promptTokenCount??0,output=usage.output_tokens??((usage.candidatesTokenCount||0)+(usage.thoughtsTokenCount||0));
 return sum+Math.ceil(input*rate.input_per_million+output*rate.output_per_million)/1e6;
},0);
const batchPerEligible=eligible.length?batchEquivalent/eligible.length:null;
const affordableAdditional=batchPerEligible?Math.floor(raw.budget.available_usd/batchPerEligible):null;
const summary={at:new Date().toISOString(),target:100,generated:variants.length,terminal:jobs.filter(j=>['eligible','quarantined'].includes(j.state)).length,
 eligible:eligible.length,quarantined:jobs.filter(j=>j.state==='quarantined').length,published:0,acceptance:eligible.length/100,
 by_subject:Object.fromEntries(FACTORY_SUBJECTS.map(s=>[s,{generated:variants.filter(j=>j.subject===s).length,eligible:eligible.filter(j=>j.subject===s).length,quarantined:jobs.filter(j=>j.subject===s&&j.state==='quarantined').length,chapters:[...new Set(variants.filter(j=>j.subject===s).map(j=>j.chapter))]}])),
 formats:countBy(variants.map(j=>j.candidate),'question_type'),routes:countBy(variants.map(j=>j.candidate),'route'),difficulty:countBy(variants.map(j=>j.candidate),'difficulty'),
 format_groups:countBy(variants.map(j=>({group:formatGroup(j.candidate)})),'group'),eligible_routes:countBy(eligible.map(j=>j.candidate),'route'),eligible_source_kinds:countBy(eligible,'kind'),
 source_kinds:countBy(jobs,'kind'),unique_fingerprints:new Set(variants.map(j=>inventoryFingerprint(j.candidate))).size,
 eligible_unique_fingerprints:new Set(eligible.map(j=>inventoryFingerprint(j.candidate))).size,
 unique_anchor_families:new Set(variants.map(j=>j.candidate.family_id)).size,passage_groups:new Set(jobs.map(j=>j.passage_group_id).filter(Boolean)).size,
 eligible_anchor_families:new Set(eligible.map(j=>j.candidate.family_id)).size,
 repairs:jobs.filter(j=>j.attempt>0).length,rejection_reasons:reasons,
 cost:{campaign_gross_usd:Number(campaignCost.toFixed(6)),campaign_stages:campaignStages,conservative_failure_debit_usd:conservativeDebit,provider_usage_cost_usd:Number((campaignCost-conservativeDebit).toFixed(6)),per_candidate_usd:campaignCost/100,per_eligible_usd:eligible.length?campaignCost/eligible.length:null,
 ledger_gross_usd:raw.budget.gross_usd,held_usd:raw.budget.held_usd,available_usd:raw.budget.available_usd,mode:'standard direct requests',
 batch_equivalent_usd:Number(batchEquivalent.toFixed(6)),batch_forecast_10000_eligible_usd:eligible.length?10000*batchEquivalent/eligible.length:null,
 additional_eligible_affordable:affordableAdditional,prospective_total_eligible_affordable:affordableAdditional===null?null:affordableAdditional+eligible.length,
 shortfall_to_10000_usd:batchPerEligible?Math.max(0,(10000-eligible.length)*batchPerEligible-raw.budget.available_usd):null,
 forecast_basis:'Token-priced batch estimate at observed acceptance. Not a completed batch invoice or a throughput guarantee; source expansion may change these costs.',credits_applied:'Unverified; report uses gross API cost'},
 calibration:{state:calibration.state,valid:calibration.observations.filter(o=>o.expected_valid).length,valid_eligible:calibration.observations.filter(o=>o.expected_valid&&o.state==='eligible').length,
 known_bad:calibration.observations.filter(o=>!o.expected_valid).length,known_bad_accepted:calibration.critical_false_accepts,by_subject:calibration.by_subject,verifier:calibration.verifier_version},
 publication_row_preparation:publicationDryRun.length,production_changes:0,
 caveats:['Eligible means all configured automated checks passed, not a guarantee of zero errors.','Quarantine includes redundancy, incomplete model output and unsupported content; it is not automatically a wrong academic answer.','Sources span four 2024 paper identities; coverage is too narrow to claim a 10000-question source foundation.','Staging migration, authenticated admin operations and deployment remain unverified.'],jobs};
writeFileSync(`${root}/commissioning100-report.json`,JSON.stringify(summary,null,2)+'\n');
writeFileSync(`${root}/commissioning100-eligible.json`,JSON.stringify({at:summary.at,published:0,questions:eligible.map(j=>j.candidate)},null,2)+'\n');
writeFileSync(`${root}/commissioning100-publication-dry-run.json`,JSON.stringify({at:summary.at,database_writes:0,rows:publicationDryRun},null,2)+'\n');
const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv=[['number','id','subject','chapter','status','kind','body','A','B','C','D','correct_answer','explanation','cost_usd','reasons']];
for(const j of jobs){const q=j.candidate||{};csv.push([j.number,j.id,j.subject,j.chapter,j.state,j.kind,q.body,...(q.options||['','','','']).map(o=>typeof o==='string'?o:o.text),q.correct_answer,q.explanation,j.cost_usd,(j.result?.reasons||[]).join('; ')]);}
writeFileSync(`${root}/commissioning100-questions.csv`,'\uFEFF'+csv.map(row=>row.map(csvCell).join(',')).join('\n'));
const dollars=n=>`$${Number(n).toFixed(6)}`;
const md=['# MockMob — 100-question commissioning report','',`Generated **${summary.generated}/100**; passed **${summary.eligible}**; quarantined **${summary.quarantined}**; published **0**.`,
 '',`Generation and validation cost **${dollars(campaignCost)}**, including repairs and rejected candidates. Cost per passing question: **${summary.cost.per_eligible_usd===null?'not available':dollars(summary.cost.per_eligible_usd)}**.`,
 `This total includes ${dollars(conservativeDebit)} conservatively charged at the full request reservation because an earlier HTTP400 body was not retained; that portion is an upper bound, not reported provider usage.`,
 `Total lifetime ledger: ${dollars(raw.budget.gross_usd)} settled, ${dollars(raw.budget.held_usd)} reserved, ${dollars(raw.budget.available_usd)} available. Promotional deductions unverified.`,
 '',`Calibration: ${summary.calibration.valid_eligible}/${summary.calibration.valid} valid items pass; ${summary.calibration.known_bad-summary.calibration.known_bad_accepted}/${summary.calibration.known_bad} controlled bad fixtures quarantine. This is a small external-key benchmark, not universal accuracy.`,
 '', '| Subject | Generated | Pass | Quarantine |','| --- | ---: | ---: | ---: |',...Object.entries(summary.by_subject).map(([s,v])=>`| ${s} | ${v.generated} | ${v.eligible} | ${v.quarantined} |`),
 '',`Unique final fingerprints: ${summary.unique_fingerprints}; anchor families: ${summary.unique_anchor_families}; passage groups: ${summary.passage_groups}; repairs: ${summary.repairs}.`,
 `Passing drafts span ${summary.eligible_anchor_families} anchor families; fingerprints do not establish distinct skills or complete syllabus coverage.`,
 '',`Inventory kinds: ${summary.source_kinds.authentic_pyq||0} authenticated originals and ${summary.source_kinds.pyq_adapted||0} adaptations. Passing: ${summary.eligible_source_kinds.authentic_pyq||0} originals and ${summary.eligible_source_kinds.pyq_adapted||0} adaptations.`,
 `Draft format groups: ${Object.entries(summary.format_groups).map(([k,v])=>`${k}: ${v}`).join('; ')}. Free-form author labels are grouped here and do not count as separate formats.`,
 `Difficulty: ${Object.entries(summary.difficulty).map(([k,v])=>`${k}: ${v}`).join('; ')}. No difficult draft was produced in this run.`,
 '', '## Rejection reasons','',...Object.entries(reasons).map(([reason,n])=>`- ${reason}: ${n}`),
 '', '## Cost and scaling','',`Observed-token batch equivalent: ${dollars(batchEquivalent)}. Forecast for 10,000 eligible at this acceptance: ${summary.cost.batch_forecast_10000_eligible_usd===null?'unavailable':dollars(summary.cost.batch_forecast_10000_eligible_usd)}. This is an estimate; it excludes further source work and changes in acceptance.`,
 `Assuming all current eligible drafts are subsequently published and this yield persists, remaining funds support approximately ${affordableAdditional} additional eligible questions. Estimated gap to 10,000: ${summary.cost.shortfall_to_10000_usd===null?'unavailable':dollars(summary.cost.shortfall_to_10000_usd)}. Bulk scaling remains paused; no budget increase or validation reduction was made.`,
 '', '| Campaign stage | Requests | Cost | Input tokens | Output tokens, including reasoning |','| --- | ---: | ---: | ---: | ---: |',...Object.entries(campaignStages).map(([stage,s])=>`| ${stage} | ${s.requests} | ${dollars(s.cost_usd)} | ${s.input_tokens} | ${s.output_tokens} |`),
 '', '## Fixes and next gates','',
 '- Strict author schemas now attach authenticated passages locally instead of quoting passage text in schema literals. Explicit pre-inference rejection diagnostics are retained; uncertain usage remains guarded.',
 '- Oversized explanation audits remove repeated format/syllabus context while retaining the actual question, authenticated excerpts and both blind solutions. Authenticated original explanations can be repaired once without changing their official stem/options/key.',
 '- Future adaptations use a strict repair schema and 6000 output-token headroom. The 18 incomplete responses in this measured run retain their failed receipt and repair limit; the future configuration is not counted as a successful live retest.',
 '- Expand supported anchor/topic coverage before scaling, especially English and Business Studies. Preserve family limits and test generation of difficult items and whole passage groups.',
 '- Prove authenticated staging worker/admin/publication operations with the saved migration and dry-run rows before seeking production migration approval. The local preview has disabled controls.',
 '', '## What is ready','',`All ${publicationDryRun.length} eligible drafts pass evidence verification and publication row/hash preparation. No database writes were made.`,
 '', '## Remaining gates','',...summary.caveats.map(x=>`- ${x}`),
 '', '## All 100 candidate questions',''];
for(const j of jobs){const q=j.candidate||{};md.push(`### ${j.number}. ${j.subject} — ${j.state}`,'',`ID: ${j.id}; ${j.chapter}; ${j.kind}; cost ${dollars(j.cost_usd)}.`, '',q.body||'Authoring did not return a complete candidate.','',...(q.options||[]).map((o,i)=>`${'ABCD'[i]}. ${typeof o==='string'?o:o.text}`),'',`Proposed answer: **${q.correct_answer||'missing'}**.`,q.explanation||'', '',`Outcome: ${(j.result?.reasons||['all required checks passed']).join('; ')}`,...(j.result?.failure_details||[]).map(s=>`- ${s}`),'');if(q.passage_text)md.push('Passage:',q.passage_text,'');}
writeFileSync(`${root}/COMMISSIONING-100-REPORT.md`,md.join('\n'));
console.log(JSON.stringify({...summary,jobs:undefined},null,2));db.close();
