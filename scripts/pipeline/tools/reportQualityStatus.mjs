import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {factoryCostReport} from '../lib/factoryCosts.mjs';
import {FACTORY_POLICY,factoryCalibrationReady} from '../../../data/question_factory_policy.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
const root='artifacts/question-factory/quality-uplift',read=p=>JSON.parse(readFileSync(p,'utf8'));
const audit=read(`${root}/AUDIT-48.json`),calibration=read('data/calibration_manifest.json'),regression=read(`${root}/quality-regression-results.json`),registry=read('data/source_registry.json');
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true}),rows=db.prepare('SELECT actual,reserved,state FROM requests').all();
const limit=db.prepare('SELECT limit_micro FROM budget WHERE id=1').get().limit_micro;
const settled=rows.filter(r=>r.state==='settled').reduce((n,r)=>n+r.actual,0),held=rows.filter(r=>r.state!=='settled').reduce((n,r)=>n+(r.actual??r.reserved),0);
const costs=factoryCostReport({db});
const valid=calibration.observations.filter(o=>o.expected_valid),negatives=calibration.observations.filter(o=>!o.expected_valid);
const table=db.prepare("SELECT name FROM sqlite_master WHERE name='factory_commission_jobs_quality_uplift'").get();
const newJobs=table?db.prepare('SELECT count(*) n FROM factory_commission_jobs_quality_uplift').get().n:0;
const result={at:new Date().toISOString(),state:'not_production_ready',verifier:FACTORY_VERIFIER_VERSION,policy:FACTORY_POLICY,registry_version:registry.version,
 audit:{reviewed:48,intended_key_matches:48,...audit.counts,perfection_guaranteed:false},
 calibration:{state:calibration.state,valid_sample_size:valid.length,valid_eligible:valid.filter(o=>o.state==='eligible').length,luna_key_accuracy:valid.filter(o=>o.luna===o.official_key).length/valid.length,gemini_key_accuracy:valid.filter(o=>o.gemini===o.official_key).length/valid.length,known_bad:negatives.length,known_bad_accepted:negatives.filter(o=>o.state==='eligible').length,
  failed_valid_items:valid.filter(o=>o.state!=='eligible'),audit_challenges:regression.complete,audit_challenges_quarantined:regression.observations.filter(o=>o.state==='quarantined').length,audit_challenges_accepted:regression.false_accepts,accepted_audit_challenges:regression.observations.filter(o=>o.state==='eligible')},
 generation_allowed:factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION)&&regression.false_accepts===0,new_candidate_jobs:newJobs,new_pilot_questions:0,production_changes:0,
 measured_yield_above_70:false,forecast_60_usd_validated:false,
 budget:{limit_usd:limit/1e6,gross_usd:settled/1e6,held_usd:held/1e6,available_usd:(limit-settled-held)/1e6,resumed_validation_usd:(settled-1419007)/1e6,unresolved:rows.filter(r=>r.state==='unresolved').length,credits_applied:'Unverified; gross cost reported',costs},
 checks:{factory:45,recovery:35,question_payment_nta:49,total:129,targeted_lint:'passed',production_build:'passed',local_preview:read(`${root}/preview-check.json`)},
 remaining:['Resolve five previously labelled valid-fixture rejections: ambiguous word-choice/economic implications, chapter taxonomy and dissolution explanation debit/credit direction. Freeze this result before changing fixture classifications or content.',
 'Fix the three audited quality misses: missing other-instalment payment assumption; journal-entry claim without direct attached support; generalising a no-saving example to every two-sector economy.',
 'Rerun strict calibration and all audited defect challenges; do not raise the pass rate by bypassing these checks.',
 'Only after academic release, run the separate preregistered 100-candidate cohort across four subjects and measure true yield, variety, repairs and all-in cost.',
 'Expand source/chapter and difficult-question coverage; demonstrate authenticated staging worker, dashboard and atomic publication before production migration/deployment.']};
writeFileSync(`${root}/final-status.json`,JSON.stringify(result,null,2)+'\n');
const money=n=>`$${n.toFixed(6)}`;
writeFileSync(`${root}/FINAL-STATUS.md`,[
 '# Question factory quality uplift — checked final status','',
 '**The audit is complete. The quality uplift is incomplete and generation remains paused.**',
 '',`Audit of previous 48 passing hashes: ${audit.counts.approve} have no blocking defect found, ${audit.counts.suspect} need corrections and ${audit.counts.incomplete} lacks evidence. All intended keys matched. This does not establish 100% accuracy or 10/10 exam quality.`,
 '',`Live ${FACTORY_VERIFIER_VERSION} regression: ${result.calibration.valid_eligible}/${valid.length} previously labelled valid items eligible. Luna ${Math.round(result.calibration.luna_key_accuracy*10000)/100}% and Gemini ${Math.round(result.calibration.gemini_key_accuracy*10000)/100}% intended-key accuracy; all ${negatives.length} controlled negatives quarantined.`,
 `The additional independent-audit challenges quarantine ${result.calibration.audit_challenges_quarantined}/18. Three flagged items still pass automated checks. Academic release fails. The older released calibration cannot authorize this version.`,
 '', 'Implemented and locally checked: separate chapter/presentation receipts, academic support excluding paper-question quotes, explicit author assumptions and plain-text contracts, corrected per-adaptation chapter selection, one durable completion retry, scoped exact source paragraphs, 25 primary dictionary targets and persistent campaign isolation. Earlier evidence is invalid under the new policy; original 100-question artifacts stay frozen.',
 '', 'No optimized 100-question cohort was generated. Neither a yield above 70% nor a $60 cost for 10,000 is a measured result. The older approximately $79.73 batch forecast used the now-disputed 48% automated yield and should not be treated as a current strict-quality forecast.',
 '',`Content ledger: ${money(settled/1e6)} accounted, ${money(held/1e6)} held, ${money(result.budget.available_usd)} remaining under the unchanged $50 ceiling. This resumed verification used ${money(result.budget.resumed_validation_usd)}. Google promotional deductions remain unverified.`,
 '', 'Verification: 129 tests pass (45 factory, 35 recovery, 49 question/payment/NTA); targeted lint and production build pass. Local preview returns HTTP200 with failed gates, historical pass labels and the old forecast withheld. Authenticated staging/production interactions remain unverified. The factory migration is saved and tested in isolated PGlite, not applied to the site database. No production data writes or publication occurred.',
 '', 'Remaining work:', '', ...result.remaining.map(r=>`- ${r}`),
 '', 'Detailed evidence: AUDIT-48.json; commissioning-calibration-result.json; quality-regression-results.json; source-registration.json; test and lint logs in this directory. The keyed benchmark was previously observed and is a regression check, not a fresh unseen-paper accuracy claim.'
 ].join('\n')+'\n');
console.log(JSON.stringify({...result,calibration:{...result.calibration,failed_valid_items:undefined,accepted_audit_challenges:undefined},budget:{...result.budget,costs:undefined},remaining:undefined},null,2));db.close();
