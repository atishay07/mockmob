// Receipt-only V7.7 recovery. It consumes exact settled provider responses from SQLite and rewrites
// only local derived results; it has no new-reservation or provider-network path.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { loadEnvFile } from 'node:process';
import { hashJSON, provenanceReasons } from '../../../../../data/question_factory_policy.mjs';
import { REQUIRED_SUBJECTS } from '../../../../../scripts/pipeline/lib/releaseEvidenceV77.mjs';
import { payloadHash } from '../../../../../scripts/pipeline/lib/cuetFitBenchmark.mjs';
import { structureVerdict } from '../../../../../scripts/pipeline/lib/evidencePipeline.mjs';
import { presentationLint } from '../../../../../data/question_presentation.mjs';
import { createFactoryEvidenceV77, blindViewV77, TOPOLOGIES } from '../../../../../scripts/pipeline/lib/factoryEvidenceV77.mjs';
import { validateFactoryCandidateV77 } from '../../../../../scripts/pipeline/lib/verifyV77.mjs';
import {
  verifyV77Freeze, verifyV77TransportFreeze, V77_TRANSPORT_DEPENDENCIES,
  expectedReleaseBindingV77, assertExecutionPlanV77, assertFreshV77Study, assertV77Authorization,
  assertNoPriorV75V76CaseReuse, assertV77StudySlotBinding, normalizedCaseFingerprint,
  MAX_INPUT_BODY_BYTES_V77, QUALIFICATION_V77_PREFIX, QUALIFICATION_V77_CAP_USD,
  LIFETIME_CAP_USD, dispatchV77NativeRequest, appendV77RecoveryHistory,
} from '../../../../../scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs';
import { assertBenchmarkProvenanceV73, assertCustodySetV73, assertReleaseEvidenceRoleV73,
  acceptedNativeRequestV73 } from '../../../../../scripts/pipeline/lib/freshCuetReadinessV73Guards.mjs';
import { createFactoryTransport } from '../../../../../scripts/pipeline/lib/factoryTransport.mjs';
import { bodyCandidateId, scopedAccounting } from '../../../../../scripts/pipeline/lib/scopedAccounting.mjs';
import { assertCampaignBudget, maximumRequestMicro, requestNeedsReservation } from '../../../../../scripts/pipeline/lib/campaignExecutionV7.mjs';
import { effortsFor } from '../../../../../data/cuet_fit_evidence.mjs';
import { saveAtomicArtifact } from '../../../../../scripts/pipeline/lib/atomicArtifact.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../');
const registeredRoot = resolve(repoRoot, 'artifacts/question-factory/cuet-readiness-2026-10-09/v77-qualification');
const historyPath = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-case-freshness-check.md';
const priorPaths = [
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-official-source-v73/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-official-source-v73-model/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-proposal-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-semantic-view-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-semantic-view-final-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v74-known-critical-regression-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v74-prerequisite-diagnostic-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v75-fresh-cbse2022-2026-10-09/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v75-known-critical-regression-2026-10-09/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-fresh/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-regression/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-fresh-bounded-input/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-regression-bounded-input/frozen.json',
];
const v76RegressionPath = 'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-regression-bounded-input/frozen.json';
const read = path => readFileSync(resolve(repoRoot, path));
const json = path => JSON.parse(read(path).toString('utf8'));
const sha = path => createHash('sha256').update(read(path)).digest('hex');
const fail = message => { throw new Error(message); };
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] || null; };
const inside = path => { const rel = relative(registeredRoot, path); return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel); };

function verifyInputs(dirs, freezeInfo, transportFreeze, binding) {
  const frozen = Object.fromEntries(Object.entries(dirs).map(([name, dir]) => [name, JSON.parse(readFileSync(join(dir,'frozen.json'),'utf8'))]));
  const ids = Object.fromEntries(Object.entries(frozen).map(([name, f]) => [name,f.id]));
  if (ids.fresh === ids.regression || !ids.fresh?.startsWith(QUALIFICATION_V77_PREFIX) || !ids.regression?.startsWith(QUALIFICATION_V77_PREFIX)) fail('fixed_v77_study_ids_required');
  if (!existsSync(resolve(repoRoot,historyPath))) fail('required_v76_case_freshness_review_missing');
  const review = readFileSync(resolve(repoRoot,historyPath),'utf8');
  if (!review.includes('264 fixture rows') || !review.includes('90 distinct subject/stem/options records')) fail('prior_case_history_review_contract_changed');
  const prior = Object.fromEntries(priorPaths.map(path => {
    if (!existsSync(resolve(repoRoot,path))) fail(`required_prior_case_history_missing:${path}`);
    const doc=json(path), fixtureHashes=Object.fromEntries((doc.fixtures||[]).map(f=>[f.id,hashJSON({id:f.id,fingerprint:normalizedCaseFingerprint(f)})]));
    if (!doc.fixtures?.length) fail(`required_prior_case_history_empty:${path}`);
    return [path,{sha256:sha(path),fixture_hashes:fixtureHashes,fixtures:doc.fixtures}];
  }));
  const inputHashes = () => ({ freeze: freezeInfo.raw_sha256, v77_contract: freezeInfo.validation_contract_hash,
    fresh: { frozen: sha(relative(repoRoot,join(dirs.fresh,'frozen.json'))), overlay: sha(relative(repoRoot,join(dirs.fresh,'scratch-registry-overlay.json'))),
      custody: sha(relative(repoRoot,join(dirs.fresh,'independent-key-custody.json'))), case_review: sha(relative(repoRoot,join(dirs.fresh,'case-freshness-review.json'))) },
    regression: { frozen: sha(relative(repoRoot,join(dirs.regression,'frozen.json'))), overlay: sha(relative(repoRoot,join(dirs.regression,'scratch-registry-overlay.json'))),
      custody: sha(relative(repoRoot,join(dirs.regression,'independent-key-custody.json'))) },
    source_registry: sha('data/source_registry.json'), prices: sha('data/pipeline-prices.json'), binding,
    transport_freeze: transportFreeze.raw_sha256, transport_dependency_hash: transportFreeze.transport_hash,
    transport_dependencies: Object.fromEntries(V77_TRANSPORT_DEPENDENCIES.map(path=>[path,sha(path)])),
    prior_case_history_review: sha(historyPath),
    prior_case_frozen_hashes: Object.fromEntries(Object.entries(prior).map(([path,row])=>[path,row.sha256])),
    prior_case_fixture_hashes: Object.fromEntries(Object.entries(prior).map(([path,row])=>[path,row.fixture_hashes])) });
  const snapshots={};
  for (const name of ['fresh','regression']) {
    const dir=dirs[name],f=frozen[name],overlay=JSON.parse(readFileSync(join(dir,'scratch-registry-overlay.json'),'utf8'));
    const custody=JSON.parse(readFileSync(join(dir,'independent-key-custody.json'),'utf8'));
    const fixtureIds=f.fixtures?.map(x=>x.id)||[],positive=f.fixtures?.filter(x=>x.expected_valid===true)||[],defects=f.fixtures?.filter(x=>x.expected_valid===false)||[];
    if (!fixtureIds.length||new Set(fixtureIds).size!==fixtureIds.length||payloadHash(f.fixtures)!==f.payload_hash||JSON.stringify(f.contract_binding)!==JSON.stringify(binding)) fail(`frozen_v77_study_contract_invalid:${name}`);
    if (fixtureIds.length!==f.denominator||positive.length!==f.valid_roots||defects.length!==f.controlled_defects) fail(`fixed_v77_denominator_mismatch:${name}`);
    if (name==='fresh') {
      if (fixtureIds.length!==28||positive.length!==16||defects.length!==12) fail('fresh_fixed_28_16_12_denominator_required');
      for(const subject of REQUIRED_SUBJECTS) if(positive.filter(x=>x.candidate?.subject===subject).length!==4||defects.filter(x=>x.candidate?.subject===subject).length!==3) fail(`fresh_subject_quota_invalid:${subject}`);
    } else {
      if(fixtureIds.length!==13||positive.length!==4||defects.length!==9||hashJSON(f.fixtures)!==hashJSON(json(v76RegressionPath).fixtures)) fail('v76_bounded_regression_must_remain_unchanged');
    }
    assertReleaseEvidenceRoleV73(f.release_eligibility);assertBenchmarkProvenanceV73(f.fixtures,f.release_eligibility.classification);
    assertCustodySetV73({fixtureIds,positiveIds:positive.map(x=>x.id),custody});
    if(name==='fresh') {
      const reviewPath=join(dir,'case-freshness-review.json'),caseReview=JSON.parse(readFileSync(reviewPath,'utf8'));
      assertFreshV77Study({frozen:f,custody,freezeSha256:freezeInfo.raw_sha256,freezeAt:freezeInfo.freeze.frozen_at,
        transportFreezeSha256:transportFreeze.raw_sha256,transportFreezeAt:transportFreeze.frozen_at,
        custodySha256:createHash('sha256').update(readFileSync(join(dir,'independent-key-custody.json'))).digest('hex'),
        caseReviewSha256:createHash('sha256').update(readFileSync(reviewPath)).digest('hex'),caseReview});
      assertNoPriorV75V76CaseReuse(f.fixtures,Object.values(prior).flatMap(row=>row.fixtures));
    }
    snapshots[name]={f,overlay,custody,fixtureIds,positive,defects};
  }
  assertV77StudySlotBinding(ids.fresh,ids.regression,snapshots.fresh.f,snapshots.regression.f);
  const sourceRegistry=json('data/source_registry.json');
  for(const [name,s] of Object.entries(snapshots)) {
    s.registry={...sourceRegistry,sources:{...sourceRegistry.sources,...s.overlay.sources},families:{...sourceRegistry.families,...s.overlay.families},packs:{...sourceRegistry.packs,...s.overlay.packs}};
    for(const fixture of s.f.fixtures) for(const ref of fixture.candidate.source_refs||[]) {
      const source=s.registry.sources?.[ref.id];
      if(source?.state!=='active'||source.reuse_permitted!==true||source.version!==ref.version||source.supports?.[ref.locator]!==ref.support_hash||hashJSON(source.facts?.[ref.locator]?.text)!==ref.support_hash) fail(`registered_support_contract_changed:${fixture.id}`);
    }
    const failures=s.positive.map(f=>({id:f.id,reasons:[...structureVerdict(f.candidate).reasons,...presentationLint(f.candidate),...provenanceReasons(f.candidate,s.registry)]})).filter(x=>x.reasons.length);
    if(failures.length) fail(`positive_fixture_local_failures_before_recovery:${name}`);
  }
  return {frozen,ids,snapshots,inputHashes:inputHashes()};
}

function createReceiptSession({ fixture, ids, registry, db, prices, expectedNativeKey, fetchCounter={count:0} }) {
  const ephemeralCache=new Map();
  const consumedNativeKeys=new Set();
  const ledger={db,
    getCache(key){ if(key.includes(':evaluation:')) return ephemeralCache.get(key)??null; const row=db.prepare('SELECT value FROM cache WHERE id=?').get(key);return ephemeralCache.get(key)??(row?JSON.parse(row.value):null); },
    setCache(key,value){ ephemeralCache.set(key,structuredClone(value)); },
    settle(){throw new Error('receipt_replay_must_not_write_ledger');}, reserve(){throw new Error('receipt_replay_must_not_reserve');},
    assertHistoryReconciled(){throw new Error('receipt_replay_must_not_enter_reservation_path');},
  };
  const native=createFactoryTransport({ledger,prices:()=>prices,env:{},realtimeStages:['blind_solution','independent_evaluation','explanation_support'],
    flexStages:['blind_solution','independent_evaluation','explanation_support'],fetchImpl:async()=>{fetchCounter.count++;throw new Error('receipt_replay_network_forbidden');}});
  const state={stopping:false,pendingMaximum:0};
  const candidate=fixture.candidate,allowedCandidates=new Set([candidate.id]);
  const transport={generate:async(providerName,body,options={})=>{
    const nativeKey=hashJSON({study:`${ids.fresh}:${ids.regression}`,parent:options.key});
    const completeRow=()=>{const row=db.prepare('SELECT state,response_json,reservation_id,provider,request_json FROM provider_requests WHERE id=?').get(nativeKey);
      if(!row||row.state!=='complete'||!row.response_json||row.provider!==providerName)return false;
      const request=JSON.parse(row.request_json),expectedStage=options.stage;
      if(request.config?.key!==nativeKey||request.config?.provider!==providerName||request.config?.stage!==expectedStage||
         request.config?.candidate_id!==`${QUALIFICATION_V77_PREFIX}${candidate.id}`) return false;
      const reservation=db.prepare('SELECT state FROM requests WHERE id=?').get(row.reservation_id);return reservation?.state==='settled';};
    const response=await dispatchV77NativeRequest({provider:providerName,body,options,studyIds:ids,allowedCandidates,native,ledger,prices,state,
      reservationNeeded:requestNeedsReservation,requestAccepted:(active,key)=>acceptedNativeRequestV73(active.db,key),
      requestState:(active,key)=>active.db.prepare('SELECT state FROM provider_requests WHERE id=?').get(key)?.state||null,
      maximumRequest:maximumRequestMicro,scopedCommitted:active=>scopedAccounting(active,QUALIFICATION_V77_PREFIX).committed_micro,
      lifetimeCommitted:()=>{throw new Error('receipt_replay_must_not_read_for_reservation');},assertCampaign:assertCampaignBudget,
      assertLifetime:()=>{throw new Error('receipt_replay_must_not_check_or_reserve_new_spend');},recoveryOnly:true,
      completedResponseAvailable:(_active,key)=>completeRow(),auditGuard:(_provider,finalBody)=>{
        const input=JSON.parse(finalBody.input.find(row=>row.role==='user').content);
        if(input.option_resolution_matrices?.length!==2||!JSON.stringify(finalBody).includes('option_resolution_audits')) throw new Error('v77_both_frozen_matrices_required');
      }});
    consumedNativeKeys.add(nativeKey);
    return response;
  }};
  const adapters=createFactoryEvidenceV77({registry,ledger,transport,topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,efforts:effortsFor(candidate)});
  const view=blindViewV77(candidate,candidate.source_refs);
  return {ledger,transport,adapters,view,consumedNativeKeys,fetchCounter,ephemeralCache};
}

export async function replayV77CompletedEvaluation(options) {
  const session=createReceiptSession(options), judgment=await session.adapters.__evaluation(session.view,options.provider);
  if(options.expectedNativeKey&&!session.consumedNativeKeys.has(options.expectedNativeKey)) fail('saved_error_native_key_not_consumed');
  return {judgment,native_fetches:session.fetchCounter.count,ephemeral_cache_entries:session.ephemeralCache.size,native_keys:[...session.consumedNativeKeys]};
}

export async function replayV77Topology(options) {
  const session=createReceiptSession(options), verdict=await validateFactoryCandidateV77(options.fixture.candidate,{registry:options.registry,
    ledger:session.ledger,transport:session.transport,topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,
    efforts:effortsFor(options.fixture.candidate),seen:new Set()});
  if(options.expectedNativeKey&&!session.consumedNativeKeys.has(options.expectedNativeKey)) fail('saved_topology_error_native_key_not_consumed');
  return {verdict,native_fetches:session.fetchCounter.count,native_keys:[...session.consumedNativeKeys]};
}

// CLI accepts only frozen registered studies; every result rewrite retains the exact original error.
async function main() {
const freshArg=arg('--fresh-dir'),regressionArg=arg('--regression-dir'),authorizationArg=arg('--authorization'),studyName=arg('--study'),fixtureId=arg('--fixture-id'),provider=arg('--provider'),kind=arg('--kind')||'evaluation';
if(!freshArg||!regressionArg||!authorizationArg||!['fresh','regression'].includes(studyName)||!fixtureId||!['openai','gemini'].includes(provider)||!['evaluation','topology'].includes(kind)) fail('usage: --fresh-dir <dir> --regression-dir <dir> --authorization <path> --study fresh|regression --fixture-id <id> --provider openai|gemini --kind evaluation|topology');
const resolveDir=value=>resolve(repoRoot,value),dirs={fresh:resolveDir(freshArg),regression:resolveDir(regressionArg)};
for(const [name,dir] of Object.entries(dirs)){if(!inside(dir))fail(`study_outside_fixed_v77_scope:${name}`);}
const core=verifyV77Freeze(repoRoot),transportFreeze=verifyV77TransportFreeze(repoRoot,V77_TRANSPORT_DEPENDENCIES,{required:true}),binding=expectedReleaseBindingV77();
const bound=verifyInputs(dirs,core,transportFreeze,binding),name=studyName,studyDir=dirs[name],snapshot=bound.snapshots[name],fixture=snapshot.f.fixtures.find(row=>row.id===fixtureId);
if(!fixture) fail('fixture_not_in_frozen_study');
const planPath=join(studyDir,'run','execution-plan.json'),preflightPath=join(studyDir,'run','preflight.json'),resultsPath=join(studyDir,'run','results.json');
for(const path of [planPath,preflightPath,resultsPath])if(!existsSync(path))fail(`required_registered_artifact_missing:${relative(repoRoot,path)}`);
const plan=JSON.parse(readFileSync(planPath,'utf8')),preflight=JSON.parse(readFileSync(preflightPath,'utf8'));
const peerPlans=Object.fromEntries(['fresh','regression'].map(key=>[key,JSON.parse(readFileSync(join(dirs[key],'run','execution-plan.json'),'utf8'))]));
assertExecutionPlanV77(plan,{id:bound.ids[name],binding,inputHashes:bound.inputHashes,registryHash:hashJSON(snapshot.registry),denominator:snapshot.fixtureIds.length,
  validRoots:snapshot.positive.length,controlledDefects:snapshot.defects.length,classification:name});
for(const peerName of ['fresh','regression']) {
  const peer=peerPlans[peerName],peerSnapshot=bound.snapshots[peerName];
  assertExecutionPlanV77(peer,{id:bound.ids[peerName],binding,inputHashes:bound.inputHashes,registryHash:hashJSON(peerSnapshot.registry),denominator:peerSnapshot.fixtureIds.length,
    validRoots:peerSnapshot.positive.length,controlledDefects:peerSnapshot.defects.length,classification:peerName});
}
const executionPlanHashes={fresh:hashJSON({...peerPlans.fresh,created_at:undefined}),regression:hashJSON({...peerPlans.regression,created_at:undefined})};
const studyPayloads=Object.fromEntries(['fresh','regression'].map(key=>[key,{payload_hash:bound.frozen[key].payload_hash,
  frozen_sha256:sha(relative(repoRoot,join(dirs[key],'frozen.json'))),custody_sha256:sha(relative(repoRoot,join(dirs[key],'independent-key-custody.json')))}]));
assertV77Authorization(json(authorizationArg),{freezeSha256:core.raw_sha256,contractHash:core.validation_contract_hash,
  freshId:bound.ids.fresh,regressionId:bound.ids.regression,studyPayloads,transportFreezeHash:transportFreeze.raw_sha256,executionPlanHashes});
const expectedBlind=snapshot.fixtureIds.flatMap(id=>[{fixture_id:id,provider:'openai',phase:'blind_solution'},{fixture_id:id,provider:'gemini',phase:'independent_evaluation'}]).map(x=>`${x.fixture_id}\0${x.provider}\0${x.phase}`).sort();
const actualBlind=(preflight.blind_capture_manifest||[]).map(x=>`${x.fixture_id}\0${x.provider}\0${x.phase}`).sort();
const expectedAudit=[...snapshot.fixtureIds].sort(),actualAudit=(preflight.audit_capture_manifest||[]).map(x=>x.fixture_id).sort();
const expectedCapture=[...expectedBlind,...snapshot.fixtureIds.map(id=>`${id}\0openai\0explanation_support`)].sort();
const actualCapture=(preflight.capture_manifest||[]).map(x=>`${x.fixture_id}\0${x.provider}\0${x.stage}`).sort();
if(JSON.stringify(plan.input_hashes)!==JSON.stringify(bound.inputHashes)||JSON.stringify(preflight.input_hashes)!==JSON.stringify(plan.input_hashes)||
   preflight.sizing_mock_only!==true||preflight.audit_full_matrices_checked_during_offline_capture!==true||
   preflight.blind_capture_manifest?.length!==snapshot.fixtureIds.length*2||preflight.audit_capture_manifest?.length!==snapshot.fixtureIds.length||
   preflight.capture_manifest?.length!==snapshot.fixtureIds.length*3||JSON.stringify(actualBlind)!==JSON.stringify(expectedBlind)||
   JSON.stringify(actualAudit)!==JSON.stringify(expectedAudit)||JSON.stringify(actualCapture)!==JSON.stringify(expectedCapture)||
   preflight.capture_manifest.some(c=>! /^[0-9a-f]{64}$/.test(c.body_hash||'')||!Number.isSafeInteger(c.bytes)||c.bytes<=0||
    !snapshot.fixtureIds.includes(c.fixture_id)||!['openai','gemini'].includes(c.provider)||c.bytes>MAX_INPUT_BODY_BYTES_V77)) fail('registered_preflight_or_input_hash_mismatch');
const results=JSON.parse(readFileSync(resultsPath,'utf8'));
if(results.benchmark?.id!==bound.ids[name]||results.benchmark?.payload_hash!==snapshot.f.payload_hash||
   results.verifier_version!==binding.verifier_version||JSON.stringify(results.contract_binding)!==JSON.stringify(binding)||
   JSON.stringify(results.release_eligibility)!==JSON.stringify(snapshot.f.release_eligibility)) fail('saved_results_contract_mismatch');
// The verifier needs the original local signing key only to derive a topology result.
// Load it after all frozen-input and authorization checks; never print or persist it.
if (kind === 'topology') {
  try { loadEnvFile(resolve(repoRoot, '.env.local')); } catch { /* inherited process environment remains valid */ }
  if (!process.env.CUET_EVIDENCE_SIGNING_KEY) fail('topology_recovery_signing_key_missing');
}
const topologyRows=results.topologies?.dual_blind||[];
const prior=kind==='evaluation'?results.evaluations?.[fixtureId]?.[provider]:topologyRows.find(row=>row.id===fixtureId);
if(prior?.state!=='error'&&kind==='topology'||prior?.status!=='error'&&kind==='evaluation'||!prior?.native_key) fail('only_saved_error_with_exact_native_key_can_be_replayed');
const db=new DatabaseSync(resolve(repoRoot,'data/pipeline-budget.sqlite'),{readOnly:true});
try{
  const row=db.prepare('SELECT state,response_json,reservation_id,provider,request_json FROM provider_requests WHERE id=?').get(prior.native_key);
  if(!row||row.provider!==provider||row.state!=='complete'||!row.response_json) fail('exact_provider_receipt_not_complete');
  const savedRequest=JSON.parse(row.request_json),expectedStage=kind==='topology'?'explanation_support':provider==='openai'?'blind_solution':'independent_evaluation';
  if(savedRequest.config?.key!==prior.native_key||savedRequest.config?.provider!==provider||savedRequest.config?.stage!==expectedStage||
     savedRequest.config?.candidate_id!==`${QUALIFICATION_V77_PREFIX}${fixtureId}`||kind==='topology'&&(provider!=='openai'||expectedStage!=='explanation_support')) fail('saved_provider_request_identity_mismatch');
  const reservation=db.prepare('SELECT state FROM requests WHERE id=?').get(row.reservation_id);
  if(reservation?.state!=='settled') fail('complete_provider_receipt_not_fully_settled');
  const before={requests:db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,providerRequests:db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n};
  const outcome=kind==='evaluation'
    ? await replayV77CompletedEvaluation({fixture,provider,ids:bound.ids,registry:plan.source_registry,db,prices:json('data/pipeline-prices.json'),expectedNativeKey:prior.native_key})
    : await replayV77Topology({fixture,ids:bound.ids,registry:plan.source_registry,db,prices:json('data/pipeline-prices.json'),expectedNativeKey:prior.native_key});
  if(outcome.native_fetches!==0||kind==='evaluation'&&outcome.judgment?.candidate_id!==fixture.candidate.id||
     kind==='topology'&&!['eligible','quarantined'].includes(outcome.verdict?.state)) fail('receipt_replay_identity_or_network_guard_failed');
  const after={requests:db.prepare('SELECT COUNT(*) AS n FROM requests').get().n,providerRequests:db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n};
  if(JSON.stringify(before)!==JSON.stringify(after)) fail('receipt_replay_created_ledger_rows');
  if(kind==='evaluation') {
    appendV77RecoveryHistory(results,{studyId:bound.ids[name],fixtureId,recordKind:`evaluation:${provider}`,priorRecord:prior,nativeKey:prior.native_key});
    results.evaluations[fixtureId][provider]={status:'judged',...outcome.judgment,receipt_recovered:{native_keys:outcome.native_keys,source_status:'complete_durable_response',recovered_at:new Date().toISOString()}};
  } else {
    appendV77RecoveryHistory(results,{studyId:bound.ids[name],fixtureId,recordKind:'topology',priorRecord:prior,nativeKey:prior.native_key});
    const index=topologyRows.findIndex(row=>row.id===fixtureId);
    topologyRows[index]={...prior,...outcome.verdict,receipt_recovered:{native_keys:outcome.native_keys,source_status:'complete_durable_response',recovered_at:new Date().toISOString()}};
    results.topologies.dual_blind=topologyRows;
  }
  saveAtomicArtifact(resultsPath,results);
  console.log(JSON.stringify({study_id:bound.ids[name],fixture_id:fixtureId,provider,kind,status:kind==='evaluation'?'judged':outcome.verdict.state,
    native_fetches:0,ledger_rows_unchanged:true,original_error_preserved:true,native_keys:outcome.native_keys},null,2));
}finally{db.close();}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
