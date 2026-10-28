// Preregister the single v7.5 measurement pilot: 40 candidates, 10 each English, Accountancy, Business Studies, Economics.
// Never calls a model provider, never writes the ledger, the staging database or production. Preview with --dry-run (writes nothing);
// register with --register. An existing preregistration is never overwritten.
//   node scripts/pipeline/tools/prepareCuetPilotV75.mjs --inventory-file --dry-run
//   node scripts/pipeline/tools/prepareCuetPilotV75.mjs --inventory-file --register
//   (optional) --staging  reads the separate staging bank (read-only) instead of the offline reassessment file; needs .env.staging
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {loadEnvFile} from 'node:process';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {effortsFor} from '../../../data/cuet_fit_evidence.mjs';
import {candidateCSourceViews,C_SOURCE_OVERLAY_PATH} from '../lib/candidateCRegistration.mjs';
import {authorOriginal} from '../lib/factoryCore.mjs';
import {authorOriginalV75,ORIGINAL_AUTHOR_POLICY_V75} from '../lib/originalAuthorPolicyV75.mjs';
import {loadIdeaAllocations,recordIdeaAllocations,orderingIdeaKey,orderingFormat,DEFAULT_IDEA_ALLOCATION_PATH,consumedOrderingIdeas} from '../lib/ideaAllocation.mjs';
import {composeAuthorTransport} from '../lib/cuetPilotV75Deps.mjs';
import {PILOT_TRANSPORT_PROFILE,assertPilotRegistration} from '../lib/cuetPilotV75Run.mjs';
import {V75_PROMPT_HASH} from '../lib/factoryEvidenceV75.mjs';
import * as Plan from '../lib/cuetPilotV75Plan.mjs';

const args=process.argv.slice(2),flag=name=>args.includes(name),value=name=>{const i=args.indexOf(name);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:null;};
const dry=flag('--dry-run'),register=flag('--register');
if(!dry&&!register)throw Error('choose_--dry-run_to_preview_or_--register_to_write_the_preregistration');
if(dry&&register)throw Error('dry_run_and_register_are_exclusive');
if(flag('--publish')||flag('--execute'))throw Error('preparation_never_publishes_or_executes');
const offline=flag('--inventory-file'),staging=flag('--staging');
if(offline===staging)throw Error('choose_exactly_one_inventory_source:--inventory-file_or_--staging');
const capUsd=Number(value('--cap-usd')??Plan.PILOT_CAP_USD_MAX),branch=flag('--computerized')?'computerized':'financial_analysis';
if(!(capUsd>0)||capUsd>Plan.PILOT_CAP_USD_MAX)throw Error('cap_usd_must_be_positive_and_at_most_3');
// --out-dir / --allocations-path exist only so the registration path can be self-tested without touching the real pilot directory or allocation ledger.
const directory=(value('--out-dir')||Plan.PILOT_DIRECTORY).replaceAll('\\','/'),allocationsPath=value('--allocations-path')||DEFAULT_IDEA_ALLOCATION_PATH;
if(!/^artifacts\/question-factory\/[\w.-]+$/.test(directory))throw Error('local_factory_artifact_directory_required');
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>Plan.sha256File(p);
if(register&&(existsSync(directory+'/PREREGISTRATION.json')||existsSync(directory+'/campaign.json')))throw Error('pilot_already_preregistered_refusing_to_overwrite');

// 1. The frozen v7.5 contract and its inputs are verified before anything is planned.
const freeze=Plan.assertV75FreezeIntact();
if(freeze.prompt_hash!==V75_PROMPT_HASH)throw Error('v75_prompt_hash_changed');
const prices=read('data/pipeline-prices.json');
if(!(Date.parse(prices.expires_at)>Date.now()+3600e3))throw Error('verified_pricing_expires_within_an_hour_refresh_prices_first');

// 2. Registry: base + reviewed stimuli overlay + the private teaching-context views used by campaign C. The base file is untouched.
const base=read('data/source_registry.json'),stimuliOverlay=read(Plan.STIMULI_OVERLAY_PATH),merged=Plan.mergeRegistryOverlay(base,stimuliOverlay);
const privateOverlay=read(C_SOURCE_OVERLAY_PATH),views=candidateCSourceViews(merged,privateOverlay);

// 3. Inventory and coverage.
let inventory=Plan.loadOfflineInventory({reassessmentDirectory:value('--inventory-file')||Plan.STOCK_REASSESSMENT_DIRECTORY});
if(staging){
  try{loadEnvFile('.env.local');}catch{}loadEnvFile('.env.staging');
  if(process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
  const {createClient}=await import('@supabase/supabase-js'),{readBankSnapshot,readAllRows}=await import('../lib/bankSnapshot.mjs');
  const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  inventory=Plan.withStagingRows(inventory,await readBankSnapshot(db),(await readAllRows(db,'recovery_family_holds','family_id','family_id')).map(h=>h.family_id));
}
const coverage=Plan.offlineCoverage(inventory,merged);
const {priorAttempts,context}=Plan.planningContextFor(inventory,views.registry);

// 4. Briefs. Idea gaps are decided here, once.
const allocations=loadIdeaAllocations(allocationsPath);
const plan=Plan.planPilotBriefs({coverage,views,planningContext:context,priorAttempts,allocations,branch});
const jobs=plan.jobs;
assertPilotRegistration({contract:Plan.PILOT_CONTRACT,pilot_id:Plan.PILOT_ID,denominator:40,measurement_only:true,publication_policy:'never',topology:'dual_blind',
  maximum_repairs_per_candidate:1,no_regeneration:true,no_replacement_after_registration:true,cap_usd:capUsd,
  waves:{size:Plan.PILOT_WAVE_SIZE,weak_yield_below:Plan.WEAK_WAVE_YIELD,consecutive_weak_waves_stop:Plan.WEAK_WAVES_TO_STOP}},
  {id:Plan.PILOT_ID,denominator:40,measurement_only:true,publication_policy:'never',maximum_repairs_per_candidate:1,jobs});

// 5. Offline author-input preflight: the exact v7.5 request for every brief, captured without any provider.
const limits=prices.models['gpt-6-luna'],captures=[];
for(const job of jobs){
  const offlineTransport={generate:async(provider,body)=>{
    captures.push({id:job.id,provider,bytes:Buffer.byteLength(JSON.stringify(body)),output_cap:body.max_output_tokens,has_support:job.source_refs.length>0,
      has_learning_objective_schema:Boolean(body.text?.format?.schema?.properties?.learning_objective),requested_format:job.format});
    throw Error('offline_input_captured');}};
  try{await authorOriginalV75(authorOriginal,job,{registry:plan.registry,transport:composeAuthorTransport(offlineTransport,job)});}
  catch(error){if(error.message!=='offline_input_captured')throw error;}
}
if(captures.length!==40||captures.some(c=>c.bytes>limits.max_input_tokens||!c.has_support||!c.has_learning_objective_schema||c.output_cap!==Plan.STAGE_OUTPUT_CAPS.author))
  throw Error('pilot_authoring_preflight_failed');
const cost=Plan.conservativeMaximum(prices);
const summary=Plan.planSummary(jobs);

// Ordering ideas that registration will consume.
const orderingIdeas=jobs.filter(j=>orderingFormat(j.format)).map(j=>({job_id:j.id,subject:j.subject,key:orderingIdeaKey(j.source_refs)}));
const alreadyConsumed=consumedOrderingIdeas([],allocations);
if(orderingIdeas.some(i=>alreadyConsumed.has(i.key)))throw Error('ordering_idea_already_allocated_before_registration');

const table=Plan.PILOT_SUBJECTS.map(subject=>{const s=summary.by_subject[subject];
  return `${subject.padEnd(17)} formats ${JSON.stringify(s.formats)} difficulty ${JSON.stringify(s.difficulties)} chapters ${Object.keys(s.chapters).length}`;});
const briefs=jobs.map(j=>({number:j.number,id:j.id,wave:Math.floor((j.number-1)/Plan.PILOT_WAVE_SIZE)+1,subject:j.subject,chapter:j.chapter,format:j.format,difficulty:j.difficulty,
  requested_answer_position:j.requested_answer_position,source_pack_id:j.source_pack_id,source_refs:j.source_refs.map(r=>`${r.id}/${r.locator}`),passage_group_id:j.passage_group_id||null,replaces_gap:j.replaces_gap||null}));
const preview={tool:'prepareCuetPilotV75',mode:dry?'dry_run_nothing_written':'register',inventory_source:offline?'offline_inventory_file':'staging',pilot_id:Plan.PILOT_ID,branch,
  inventory:{usable_total:coverage.total_usable,reassessed_bank_usable:inventory.bank.inventory.length,campaign_a_b_c_eligible:inventory.eligibleCandidates.length,prior_attempts_for_novelty:priorAttempts.length,basis:inventory.basis},
  denominator:40,per_subject:10,plan:summary,gaps:plan.gaps,table,briefs,
  author_preflight:{captures:captures.length,maximum_bytes:Math.max(...captures.map(c=>c.bytes)),input_limit_bytes:limits.max_input_tokens},
  cost:{cap_usd:capUsd,conservative_maximum_usd:Number(cost.pilot_maximum_usd.toFixed(4)),per_candidate_maximum_usd:Number(cost.per_candidate_maximum_usd.toFixed(5)),
    maximum_requests_per_candidate:cost.maximum_requests_per_candidate.total,empirical_reference:'Campaign C (Gemini batch): USD 0.0086 gross per candidate on average, USD 0.023 maximum; realtime Gemini roughly doubles its share.'},
  ordering_ideas_to_allocate:orderingIdeas.length,prices_expire_at:prices.expires_at,paid_calls:0,ledger_writes:0,staging_writes:0,production_writes:0};
if(dry){console.log(JSON.stringify(preview,null,1));process.exit(0);}

// 6. Registration. The preregistration file is written last: its existence marks a complete registration.
mkdirSync(directory,{recursive:true});
const save=(name,value)=>writeFileSync(`${directory}/${name}`,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const ledgerPath=process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite',readOnly=new DatabaseSync(ledgerPath,{readOnly:true});
const budgetStart={...readOnly.prepare('SELECT limit_micro FROM budget WHERE id=1').get(),...readOnly.prepare("SELECT COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserved,COALESCE(actual,0)) END),0) AS committed_micro,COUNT(*) AS requests,SUM(CASE WHEN state='unresolved' THEN 1 ELSE 0 END) AS unresolved FROM requests").get()};
readOnly.close();
const registeredAt=new Date().toISOString();
save('registry.json',plan.registry);
save('registry-overlay.json',{contract:'cuet-pilot-v75-registry-overlay-v1',base_registry:{path:'data/source_registry.json',sha256:sha('data/source_registry.json'),modified:false},
  stimuli_overlay:{path:Plan.STIMULI_OVERLAY_PATH,sha256:sha(Plan.STIMULI_OVERLAY_PATH),sources:Object.keys(stimuliOverlay.sources),pack_additions:stimuliOverlay.pack_additions},
  private_source_overlay:views.overlay_binding,source_context:{contract:views.contract,reports:views.reports},
  families_added:Object.fromEntries(jobs.map(j=>[j.family_id,plan.registry.families[j.family_id]])),passage_groups_added:Object.fromEntries(Object.entries(plan.registry.passage_groups).filter(([id])=>jobs.some(j=>j.passage_group_id===id))),
  merged_registry_sha256:sha(directory+'/registry.json')});
save('inventory-coverage-before.json',coverage);
save('author-preflight.json',{at:registeredAt,captures,author_policy:ORIGINAL_AUTHOR_POLICY_V75,paid_calls:0});
save('campaign.json',{id:Plan.PILOT_ID,contract:Plan.PILOT_CONTRACT,preregistered_at:registeredAt,verifier:freeze.verifier_version,topology:'dual_blind',branch,denominator:40,per_subject:10,
  measurement_only:true,publication_policy:'never',cap_usd:capUsd,budget_start:budgetStart,maximum_repairs_per_candidate:1,no_regeneration:true,gaps_at_preparation:plan.gaps,jobs});
const prereg={contract:Plan.PILOT_CONTRACT,pilot_id:Plan.PILOT_ID,preregistered_at:registeredAt,purpose:'One measurement-only pilot of the frozen v7.5 contract on 40 candidates. It publishes nothing and releases nothing.',
  denominator:40,per_subject:10,subjects:Plan.PILOT_SUBJECTS,accountancy_branch:branch,accountancy_branch_note:'The alternative Unit IV branches stay separate: only the common units and this branch are planned.',
  measurement_only:true,publication_policy:'never',topology:'dual_blind',
  validation_roles:{blind_solve:'gpt-6-luna (answer hidden)',independent_evaluation:'gemini-3.8-flash (answer hidden)',explanation_audit:'gpt-6-luna',efforts_by_subject_and_format:Object.fromEntries([...new Set(jobs.map(j=>j.subject+':'+j.format))].map(k=>{const [subject,format]=k.split(':');return [k,effortsFor({subject,question_type:format})];}))},
  authoring:{policy:ORIGINAL_AUTHOR_POLICY_V75,learning_objective_required:true,format_contract:'registered-cuet-brief-format-c1',quote_contract:'original-exact-quote-selection-v3',addendum:'author-addendum-v7.1'},
  contract_binding:{verifier_version:freeze.verifier_version,validation_contract_hash:freeze.validation_contract_hash,parent_contract_hash:freeze.parent_contract_hash,prompt_hash:freeze.prompt_hash,
    author_policy_hash:freeze.author_policy_hash,freeze_record_sha256:freeze.freeze_record_sha256,frozen_at:freeze.frozen_at,frozen_file_sha256:freeze.file_sha256},
  release_status_at_registration:{releases_in_manifest:Object.keys(read('data/calibration_manifest.json').cuet_fit_releases||{}),v75_release_available:false,note:'No v7.5 release is assumed or required: this tool is measurement-only and cannot publish even if a release is added later.'},
  format_difficulty_plan:{format_plan:'CUET_FORMAT_PLAN (focusedBriefsV7), largest-remainder expansion to 10 per subject',difficulty_plan:'CUET_DIFFICULTY_PLAN expansion to 10 per subject (no hard briefs are planned at this size)',summary},
  briefs,source_packs:[...new Set(jobs.map(j=>j.source_pack_id))],gaps_at_preparation:plan.gaps,
  gap_rule:'A brief that returns an idea gap (or no permitted source) is recorded here and replaced only at preparation time by the next coverage-gap brief for the same subject whose chapter/format route is not itself gapped. Never after registration.',
  waves:{size:Plan.PILOT_WAVE_SIZE,weak_yield_below:Plan.WEAK_WAVE_YIELD,consecutive_weak_waves_stop:Plan.WEAK_WAVES_TO_STOP,yield_definition:'machine-eligible candidates / terminal candidates of the wave, after free duplicate and passage-group closure',
    avoidance:'Each wave sees the approved items of earlier waves; a job seals its avoidance list before its first authoring request.'},
  maximum_repairs_per_candidate:1,repair_rules:'One targeted repair, only after a failed gate, a preparation-value blocking finding or a key contradiction; preparation-value blocking at authoring consumes the repair or quarantines. Then exactly one revalidation.',
  no_regeneration:true,no_replacement_after_registration:true,
  stop_rules:['two consecutive complete waves under 40% yield: remaining candidates stay untouched',`${Plan.SYSTEMIC_ERRORS_TO_STOP} consecutive candidates lost to provider/transport errors`,'campaign cap, lifetime ceiling, pricing or credit exhaustion (candidates retained, same keys reusable after top-up)','SIGINT/SIGTERM or a STOP_AFTER_REQUEST file: in-flight work drains, nothing is killed'],
  uncertain_keys:'A request key that was accepted but has no settled receipt is never resubmitted; the candidate is quarantined and the conservative maximum hold stays committed.',
  decision_rules:{publication:'never',release_claim:'none',reported_measures:['machine-eligible yield overall and per subject','yield after batch inspection against the usable inventory','preparation-value blocking rate and repair success','learning-objective presence','format fidelity and variety','difficulty labels versus reasoning steps','answer-position patterns overall, per subject and per passage group','gross cost per candidate and per approved item'],
    interpretation:'A measured yield and defect profile on 40 candidates. It does not establish accuracy or a release, and no threshold beyond the stop rules above is preregistered here.'},
  cap_usd:capUsd,cost,empirical_cost_reference:preview.cost.empirical_reference,
  transport_profile:{...PILOT_TRANSPORT_PROFILE,concurrency:4},
  inputs:{campaign_sha256:sha(directory+'/campaign.json'),registry_sha256:sha(directory+'/registry.json'),registry_overlay_sha256:sha(directory+'/registry-overlay.json'),
    coverage_sha256:sha(directory+'/inventory-coverage-before.json'),author_preflight_sha256:sha(directory+'/author-preflight.json'),inventory_hashes:inventory.hashes,inventory_source:preview.inventory_source,inventory_basis:inventory.basis,
    pricing_binding:Plan.pricingBinding(prices),prices_expire_at:prices.expires_at,ledger_before:budgetStart},
  dependency_hashes:Plan.fileHashes(Plan.PILOT_DEPENDENCY_FILES),tooling_hashes:Plan.fileHashes(Plan.PILOT_TOOLING_FILES),
  allocations:{ledger:allocationsPath,ordering_ideas:orderingIdeas,recorded_after_registration:true},
  limitations:['Measurement of a frozen contract, not a release.','Model agreement and ratings are not truth.','No provider invoice; costs are usage receipts at recorded rates plus conservative holds.']};
if(JSON.stringify(prereg).includes('\u0000'))throw Error('preregistration_invalid');
save('PREREGISTRATION.json',prereg);
const recorded=recordIdeaAllocations(jobs,{campaignId:Plan.PILOT_ID,path:allocationsPath});
console.log(JSON.stringify({registered:true,directory,denominator:40,per_subject:10,cap_usd:capUsd,conservative_maximum_usd:Number(cost.pilot_maximum_usd.toFixed(4)),gaps:plan.gaps.length,
  idea_allocations_recorded:recorded,preregistration_sha256:sha(directory+'/PREREGISTRATION.json'),paid_calls:0,ledger_writes:0,staging_writes:0,production_writes:0}));
