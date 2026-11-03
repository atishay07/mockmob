import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const directory='artifacts/question-factory/execution-2026-10-07';
const read=name=>JSON.parse(readFileSync(directory+'/'+name,'utf8'));
const batch=read('batch-report.json'),items=read('all-100.json'),benchmark=read('validation-summary.json');
const inspection=read('batch-inspection.json'),publication=read('publication.json');
const staging=read('staging/published-application-checks.json'),local=read('local-checks.json');
assert.equal(batch.complete,true);assert.equal(items.length,100);assert.equal(new Set(items.map(j=>j.id)).size,100);
assert.equal(batch.cost.held_usd,0);assert.equal(inspection.ready,true);assert.equal(staging.passed,true);
assert.equal(batch.approved_unique+batch.rejected,100);assert.equal(batch.newly_published,batch.approved_unique);
assert.equal(publication.newly_published,batch.newly_published);assert.equal(staging.unique_retrieved,batch.newly_published);
assert.equal(Math.round(items.reduce((n,j)=>n+j.item_cost.settled_usd,0)*1e6),Math.round(batch.cost.settled_usd*1e6));
const money=value=>value==null?'unavailable':'$'+Number(value).toFixed(6);
const sql=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
const costs=sql.prepare("SELECT sum(CASE WHEN state='settled' THEN actual ELSE 0 END) AS settled,sum(CASE WHEN state!='settled' THEN max(reserved,coalesce(actual,0)) ELSE 0 END) AS held FROM requests").get();
sql.close();
const subjectLabels={english:'English',accountancy:'Accountancy',business_studies:'Business Studies',economics:'Economics'};
const table=(head,rows)=>[head.join(' | '),head.map(()=>'---').join(' | '),...rows.map(row=>row.join(' | '))].map(row=>'| '+row+' |').join('\n');
const bySubject=Object.entries(subjectLabels).map(([key,label])=>[label,items.filter(j=>j.subject===key).length,items.filter(j=>j.subject===key&&j.state==='published').length,items.filter(j=>j.subject===key&&j.state==='quarantined').length]);
const receipts=read('receipts.json').filter(r=>r.receipt?.purpose==='candidate');
const stages=new Map();for(const row of receipts){const r=row.receipt,key=[r.provider,r.model,r.stage,r.execution_mode].join(' / ');if(!stages.has(key))stages.set(key,{cost:0,input:0,output:0,reasoning:0,requests:0});const stage=stages.get(key),usage=r.usage||{};stage.cost+=row.actual/1e6;stage.requests++;stage.input+=usage.input_tokens??usage.promptTokenCount??0;stage.output+=usage.output_tokens??((usage.candidatesTokenCount||0)+(usage.thoughtsTokenCount||0));stage.reasoning+=usage.output_tokens_details?.reasoning_tokens??usage.thoughtsTokenCount??0;}
const coverage=read('coverage-after.json');
const scenarioRows=batch.budget_scenarios.map(s=>[money(s.cap_usd),s.authorized?'authorized':'scenario only',s.additional_approved_affordable]);
const text=`# MockMob question generator execution

Recorded ${new Date().toISOString()}. This is the completed preregistered live cohort, not software fixtures or queued requests.

**${batch.approved_unique} unique approved questions from all 100 candidates; ${batch.rejected} withheld. ${batch.newly_published} newly published in separate staging and ${staging.unique_retrieved} retrieved through the signed-in student API. Production publications and writes: 0.**

${table(['Subject','Candidates','Approved and staged','Rejected'],bySubject)}

## Cost and conditional scale forecast

The live 100-candidate cohort cost ${money(batch.cost.settled_usd)} in gross recorded provider usage, including rejected items, reasoning, repair, completion retries and validation. Its remaining holds are ${money(batch.cost.held_usd)}. Cost per unique approved question is ${money(batch.cost_per_approved_usd)}. Local deterministic retrieval and planning made no paid research-agent requests.

The fresh final benchmark cost ${money(benchmark.fresh_cost_usd)}. All calibration/preparation attempts, including failures and archived accepted requests, cost ${money(benchmark.all_calibration_attempts_cost_usd)}. The full execution campaign with preparation cost ${money(batch.gross_campaign_with_benchmark.settled_usd)}; historical content spending remains in the lifetime ledger.

Lifetime settled usage is ${money(costs.settled/1e6)}; conservative open holds are ${money(costs.held/1e6)}; committed spending is ${money(batch.lifetime.committed_micro/1e6)} against the authorized $50 ceiling. The saved historical OpenAI 503 remains held, never assumed free. These are usage-metered amounts at saved gross rates. Provider invoices have not been obtained; the lifetime total is not fully settled while that hold remains.

The conditional marginal forecast for 10,000 approved questions is ${money(batch.conditional_10000_forecast_usd)}. Including already committed lifetime preparation/history and the remaining questions gives ${money(batch.conditional_lifetime_to_10000_usd)}. These assume the observed subject mix, quality gates, pricing and unique yield continue; broader topic/source coverage can change them.

${table(['Lifetime cap','Authorization','Additional approved affordable at measured cost'],scenarioRows)}

${batch.conditional_lifetime_to_10000_usd>70?'The measured premium pipeline does not fit 10,000 approved questions within $50–70. The cost drivers below show the actual authoring, independent validation, explanation and repair burden; correctness gates have not been lowered.':'The measured forecast is conditional and does not authorize spending beyond $50. A small cohort cannot establish quality or cost for every syllabus gap.'}

${table(['Provider / model / stage / mode','Calls','Input tokens','Output tokens','Reasoning subset','Gross cost'],[...stages].map(([key,s])=>[key,s.requests,s.input,s.output,s.reasoning,money(s.cost)]))}

## Validation evidence

The final frozen benchmark contains 24 newly written current-format items: 12 independently keyed valid items and 12 controlled defects, including wrong keys, overlapping options, missing assumptions, unsupported explanations, out-of-syllabus content and numerical faults. All 12 valid items survived and all 12 defects were rejected. Each independent model solved all 12 valid keys correctly in this sample. The 18 previously inspected challenges are separately labelled regressions and all are withheld.

The model contract was frozen before those calls. A subsequent free, strictly rejecting guard for undefined economic hybrid terms was added before bulk dispatch. The original benchmark and results are preserved, and its 24 item decisions were unchanged. That amendment is not claimed as a new unseen model evaluation. The zero-observed false-accept rate across just 12 defects has a one-sided 95% upper bound of ${(benchmark.defect_false_accept_rate_95_percent_upper_bound*100).toFixed(2)}%; this small measurement is not proof of perfect accuracy or broad generalization.

Every approved item passes the 16 mandatory gates among 19 criteria and both independent overall craft scores of 7–10. Scores do not establish truth. The independent passes are blinded to the proposed key and explanation. A separate explanation audit follows their solutions. At most one targeted academic repair is permitted. Cached decisions bind candidate content, source references and verification contracts. Failed or unsupported questions remain unavailable.

The 7–10 threshold applies to each provider's overall craft judgment. Individual clarity, distractor and difficulty subscores remain exported without inflation; some are lower. Thus overall approval does not mean every craft dimension scored 7+, or that this cohort is uniformly excellent. Difficulty labels are model estimates, not observed student difficulty. The source-backed correctness gates remain mandatory regardless of these craft ratings.

Live inspection found a cash-flow item that passed model checks while omitting financial-enterprise status, which changes the classification of dividend receipts under NCERT section 6.5.4. It was withheld before publication. Inspection also withheld an unsupported exact-two clause generalization and an uncertain loan-classification ordering. These are observed live model misses, not zero false accepts. Free mandatory rejection guards and duplicate guards were strengthened after generation; the frozen model benchmark was not rerun or represented as fresh evidence for those additions. The exact source and finding are retained in live-assumption-check.json, and inspection decisions remain in all-100.json. The benchmark's small defect sample cannot establish the reliability of every new topic.

## Batch composition and coverage

Approved answer positions: ${JSON.stringify(batch.answer_positions)}. Approved formats: ${JSON.stringify(batch.formats)}. Approved difficulties: ${JSON.stringify(batch.difficulty)}. Detailed position runs, format breakdowns and automatic duplicate decisions are in batch-inspection.json. Different recalculated numerical answers are retained; duplicate content and conservative same-idea matches are withheld. These guards do not prove exhaustive semantic novelty.

Coverage after publication contains ${coverage.total_usable} usable unique staging questions across ${coverage.cells.length} official chapter cells. It records subject, official topics, format, difficulty, duplicates and Accountancy branch. Both blind validators must identify the same unique official topic to fill a fine topic cell; ambiguous tags leave gaps open. Accountancy uses the common and financial-analysis branch for this cohort; the computerized alternative remains separately tracked.

Original practice needs relevant decisive authoritative excerpts and independent verification, without an obligatory PYQ anchor. Authenticated PYQ provenance remains stricter. Exact excerpts and citations are exported with every item. The verified 2026 baseline is used provisionally for 2027: 50 questions, 60 minutes, +5/−1/0, maximum raw score 250. Final 2027 rules are unconfirmed. English passages are capped at 300 words.

## Application and publication proof

Staging project: onwkqxmjqjrhfbjjdydu (mockmob-question-factory-staging). Its 47-migration bootstrap passed a local dry run before staging application. The local Next.js staging app runs on port 3101 against that separate remote database, with paid student/payment/email keys disabled. This is not a production deployment.

Signed-in admin controls, anonymous/student authorization denial, cross-origin denial, worker restart with the original accepted IDs, single-item idempotency, complete passage-group atomicity and rollback are recorded in staging/. Storage fixtures are explicitly separate from the academic cohort. The completed cohort was published through the existing atomic system. Actual signed-in student retrieval returned only approved IDs with complete passages. A retained, explicitly labelled staging availability-test dispute immediately removed a real approved row from retrieval, then its unchanged publication state was restored under a concurrency guard.

The actual database round trip exposed order-dependent evidence signatures: PostgreSQL JSONB reorders object keys. Canonical object signing now preserves array order and all content checks, while legacy signatures remain accepted when verifiable. Only staging evidence envelopes were re-signed after matching the exact independently validated academic records and content hashes; original envelopes are retained. This storage amendment and serializer are bound into the verification contract, without another paid academic benchmark. A nullable database answer index also no longer overrides a letter key. Regression tests cover key ordering, tampering, legacy signatures and null indices. The dashboard shows completed publication and measured costs. A repeated 100-row progress write hit a database statement timeout; progress synchronization now uses bounded 25-row writes, and a complete published worker does not repeat publication each tick.

Available signed-in 10-question quick-practice quotes: English, Accountancy and Business Studies. Economics correctly returns inventory_insufficient because only nine approved Economics questions exist. No full 50-question subject paper is claimed available from this cohort alone.

Local checks: factory ${local.factory.passed}/${local.factory.passed}, recovery ${local.recovery.passed}/${local.recovery.passed}, learning ${local.learning.passed}/${local.learning.passed}, question/payment ${local.question_and_payment.passed}/${local.question_and_payment.passed}, discovery feed ${local.discovery_feed.passed}/${local.discovery_feed.passed}; optimized production build passed. Existing height/width warnings remain. These checks do not establish captured production payments. Student AI's separate $25 per IST month cap is preserved.

## Reproduction and remaining external gates

Run from the repository root in PowerShell. Resume commands collect accepted provider IDs; they do not submit them again. Preserve data/pipeline-budget.sqlite and its runtime files securely.

\`\`\`powershell
npm.cmd run factory:staging-app
npm.cmd run factory:focused -- reconcile
npm.cmd run factory:focused -- report
npm.cmd run factory:focused -- inspect
npm.cmd run factory:focused -- publish --staging
node --use-system-ca scripts/pipeline/tools/checkPublishedStaging.mjs
npm.cmd run test:factory
npm.cmd run test:recovery
npm.cmd run test:learning
npm.cmd run build
\`\`\`

The saved historical 503 request req_b4d44cd7e2164c18bda70d533c3683d5 lacks authoritative usage. Two existing batch receipts were collected without resubmission. The project API key receives HTTP 403 from organization usage endpoints and the provider usage page requires owner sign-in. Smallest action: obtain the provider's exact usage/billing confirmation for that request; retain the full $0.011096 hold until then. Valid conservative maximum holds permit bounded unrelated work and remain committed; unbounded holds and overruns block. Concurrency, late settlement, restart, known rejection and no-resubmission behavior are tested.

Production requires explicit owner approval under AGENTS.md. A read-only prerequisite check and additive transactional migration are prepared in production/. No production schema, questions, entitlements or receipts were changed. The final approval can cover the reviewed migration, deployment and publication of this approved subset; the empty-staging bootstrap must never be applied to production.

Artifacts: original-candidates.json preserves all 100 original provider drafts; all-100.json and all-100.csv retain the complete denominator and final repairs; approved.json and approved-records.json contain the approved subset; rejected.json contains rejected items and reasons; supporting excerpts, keys, explanations, criterion results and item costs are included. receipts.json, batch-report.json, batch-inspection.json, validation-summary.json, coverage-after.json and staging/ retain the evidence.
`;
writeFileSync(directory+'/REPORT.md',text.replaceAll('\\`','`'));
console.log(JSON.stringify({report:directory+'/REPORT.md',approved:batch.approved_unique,newly_published:batch.newly_published,batch_cost_usd:batch.cost.settled_usd,settled_lifetime_usd:costs.settled/1e6,conservative_holds_usd:costs.held/1e6}));
