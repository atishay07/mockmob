// Writes (or refuses to write) a measured release for one validator topology into data/calibration_manifest.json under
// cuet_fit_releases. Legacy manifest fields are never edited. The rule is the one preregistered in
// artifacts/question-factory/cuet-fit-2026-10-07/PREREGISTRATION-study-2.md; no threshold is relaxed to reach a number.
// Usage: node scripts/pipeline/tools/releaseCuetFitTopology.mjs --topology single_luna --tag v7.1 [--dry-run]
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {FACTORY_VERIFIER_VERSION_V7,V7_PROMPT_HASH} from '../lib/factoryEvidenceV7.mjs';
import {CUET_FIT_VERSION} from '../../../data/cuet_fit_rubric.mjs';
import {PRODUCTION_TOPOLOGIES,EFFORT_POLICY_ID,MEDIUM_EFFORT_FORMATS} from '../../../data/cuet_fit_evidence.mjs';
const arg=n=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:null;};
const topology=arg('--topology'),tag=arg('--tag')||'v7.1',dry=process.argv.includes('--dry-run');
const dir='artifacts/question-factory/cuet-fit-2026-10-07/benchmark',read=p=>JSON.parse(readFileSync(p,'utf8'));
const registry=read('data/source_registry.json');
const need=p=>{if(!existsSync(p))throw Error('measurement_missing:'+p);return read(p);};
const fresh=arg('--fresh')||'v3',v2=need(`${dir}/results-${tag}-${fresh}.json`),regression=need(`${dir}/results-${tag}-regression.json`),frozenV2=read(`${dir}/frozen-${fresh}.json`),frozenReg=read(`${dir}/regression-frozen.json`);
const rowsV2=v2.topologies[topology],rowsReg=regression.topologies[topology];
if(!rowsV2||!rowsReg)throw Error('topology_not_measured_on_both_sets');
if(!PRODUCTION_TOPOLOGIES.includes(topology)&&!dry)throw Error('only_the_full_validator_topology_may_be_released');
// Pre-registered classifications.
const REGRESSION_DERIVED=new Set(fresh==='v2'?['v7c-acc-forfeiture-shares--conditional_answer']:[]);              // the audited item, kept in v2 for completeness
const CONTRACT_LEVEL=['v7r-audit-e539e791','v7r-audit-2681477c'];                                 // chapter label inside one unit; AND/OR wording, answer unchanged
const meta=Object.fromEntries([...frozenV2.fixtures,...frozenReg.fixtures].map(f=>[f.id,f]));
const approved=r=>r.state==='eligible';
const freshDefects=rowsV2.filter(r=>meta[r.id].group==='controlled_defect'&&!meta[r.id].contested&&!REGRESSION_DERIVED.has(r.id)),contested=rowsV2.filter(r=>meta[r.id].contested);
const regDefects=rowsReg.filter(r=>!r.expected_valid&&!CONTRACT_LEVEL.some(p=>r.id.startsWith(p))).concat(rowsV2.filter(r=>REGRESSION_DERIVED.has(r.id)));
const contractLevel=rowsReg.filter(r=>CONTRACT_LEVEL.some(p=>r.id.startsWith(p)));
const valid=[...rowsV2.filter(r=>meta[r.id].group==='authored_valid'),...rowsReg.filter(r=>r.expected_valid)];
const subjectOf=r=>meta[r.id].candidate.subject,bySubject={};for(const r of valid){(bySubject[subjectOf(r)]??={n:0,ok:0}).n++;if(approved(r))bySubject[subjectOf(r)].ok++;}
const POLICY=Object.freeze({policy:'cuet-fit-release-v2',fresh_false_accepts_max:0,regression_false_accepts_max:0,valid_survival_min:.85,per_subject_valid_survival_min:.7});
const survival=valid.filter(approved).length/valid.length,freshAccepted=freshDefects.filter(approved),regAccepted=regDefects.filter(approved);
const problems=[];
if(freshAccepted.length>POLICY.fresh_false_accepts_max)problems.push(`fresh_defect_false_accepts_${freshAccepted.length}`);
if(regAccepted.length>POLICY.regression_false_accepts_max)problems.push(`regression_defect_false_accepts_${regAccepted.length}`);
if(!(survival>=POLICY.valid_survival_min))problems.push(`valid_survival_${survival.toFixed(3)}_below_${POLICY.valid_survival_min}`);
for(const [s,v] of Object.entries(bySubject))if(v.ok/v.n<POLICY.per_subject_valid_survival_min)problems.push(`subject_survival_${s}_${v.ok}/${v.n}`);
const efforts={policy:EFFORT_POLICY_ID,blind:'high; medium for English '+MEDIUM_EFFORT_FORMATS.join('/'),explanation:'high',gemini:'medium'};
const release={state:problems.length?'paused':'released',topology,effort_policy:EFFORT_POLICY_ID,efforts,verifier_version:FACTORY_VERIFIER_VERSION_V7,cuet_fit_contract:CUET_FIT_VERSION,prompt_hash:V7_PROMPT_HASH,source_registry_version:registry.version,
  critical_false_accepts:freshAccepted.length+regAccepted.length,release_policy:POLICY,problems,
  benchmark:{id:v2.benchmark.id,state:'completed',payload_hash:v2.benchmark.payload_hash,fresh_defects:freshDefects.length,contested_defects:contested.length,regression_defects:regDefects.length,contract_level_regression:contractLevel.length,valid_items:valid.length,tag},
  measured:{valid_survival:survival,valid_by_subject:bySubject,fresh_false_accepts:freshAccepted.map(r=>r.id),regression_false_accepts:regAccepted.map(r=>r.id),contested_accepted:contested.filter(approved).map(r=>r.id),contract_level_accepted:contractLevel.filter(approved).map(r=>r.id)},at:new Date().toISOString(),
  limitation:'Small author-keyed benchmark; zero observed false accepts still carry a wide upper bound. Model agreement is not truth; this release does not establish perfect accuracy or uniformly premium quality.'};
console.log(JSON.stringify(release,null,1));
if(dry)process.exit(problems.length?2:0);
const path='data/calibration_manifest.json',manifest=read(path);
manifest.cuet_fit_releases={...(manifest.cuet_fit_releases||{}),[topology]:release};
writeFileSync(path+'.tmp',JSON.stringify(manifest,null,2)+'\n');renameSync(path+'.tmp',path);
writeFileSync(`${dir}/release-${topology}-${tag}.json`,JSON.stringify(release,null,2)+'\n');
process.exit(problems.length?2:0);
