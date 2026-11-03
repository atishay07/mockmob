import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const original='scripts/pipeline/tools/runFreshCuetReadinessV77.mjs',output='scripts/pipeline/tools/runFreshCuetReadinessV77Integrated.mjs',prep='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/',sha=x=>createHash('sha256').update(x).digest('hex'),raw=readFileSync(original);let text=raw.toString();
const change=(before,after)=>{if(text.split(before).length!==2)throw Error('unexpected_original_fragment');text=text.replace(before,after);};
change("const action = process.argv[2] || 'report';",`// Additive offline harness correction: bind this executable independently of the unchanged original transport freeze.
const additiveFreezePath = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/offline-preflight-correction-freeze.json';
const additiveFreezeRaw = readFileSync(additiveFreezePath), additiveFreeze = JSON.parse(additiveFreezeRaw);
const additiveSelfHash = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
if (additiveFreeze.file !== 'scripts/pipeline/tools/runFreshCuetReadinessV77Integrated.mjs' || additiveFreeze.sha256 !== additiveSelfHash || additiveFreeze.academic_change !== false || additiveFreeze.paid_transport_change !== false)
  throw new Error('additive_offline_preflight_runner_binding_mismatch');
const additiveAuthIndex = process.argv.indexOf('--authorization');
if (['prepare','preflight','execute','recover'].includes(process.argv[2])) {
  if (additiveAuthIndex < 0 || !process.argv[additiveAuthIndex+1]) throw new Error('scope_bound_additive_runner_authorization_required');
  const additiveAuth = JSON.parse(readFileSync(process.argv[additiveAuthIndex+1]));
  if (additiveAuth.additive_offline_preflight_runner_sha256 !== additiveSelfHash || additiveAuth.additive_offline_preflight_freeze_sha256 !== createHash('sha256').update(additiveFreezeRaw).digest('hex'))
    throw new Error('scope_bound_additive_runner_authorization_required');
}
const action = process.argv[2] || 'report';`);
change("const ledger = { getCache: key => key.includes('evaluation:') ? cacheJudgment : null, setCache: () => { throw new Error('offline_cache_write_forbidden'); } };","let offlineAuditCacheEnabled = false;\n    const ledger = { getCache: key => offlineAuditCacheEnabled && key.includes('evaluation:') ? cacheJudgment : null, setCache: () => { throw new Error('offline_cache_write_forbidden'); } };");
change("    for (const fixture of s.f.fixtures) {\n      const adapters = createFactoryEvidenceV77({ registry: plan.source_registry, ledger, transport, topology: TOPOLOGIES.dual_blind, calibrationPurpose: true, efforts: effortsFor(fixture.candidate) });\n      const view = blindViewV77(fixture.candidate, fixture.candidate.source_refs), matrix", "    offlineAuditCacheEnabled = true; // Only the synthetic explanation sizing pass may reuse mock blind judgments.\n    for (const fixture of s.f.fixtures) {\n      const adapters = createFactoryEvidenceV77({ registry: plan.source_registry, ledger, transport, topology: TOPOLOGIES.dual_blind, calibrationPurpose: true, efforts: effortsFor(fixture.candidate) });\n      const view = blindViewV77(fixture.candidate, fixture.candidate.source_refs), matrix");
writeFileSync(output,text,{flag:'wx'});
writeFileSync(prep+'offline-preflight-correction-freeze.json',JSON.stringify({at:new Date().toISOString(),file:output,sha256:sha(text),original_file:original,original_sha256:sha(raw),academic_change:false,paid_transport_change:false,source_cases_keys_labels_pricing_and_guards_unchanged:true,changes:['Require exact additive executable and freeze hashes in concrete scope authorization.','During blind offline capture, return no synthetic cached evaluation.','Enable synthetic evaluation cache only during offline explanation-audit sizing.'],demonstrated_original_fault:{blind_captures:0,required_blind_captures:56,audit_captures:28,required_audit_captures:28},native_calls:0,original_transport_freeze_unchanged:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:output,sha256:sha(text),native_calls:0}));
