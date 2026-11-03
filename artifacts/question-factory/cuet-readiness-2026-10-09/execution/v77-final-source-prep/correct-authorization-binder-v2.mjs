import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const p='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/',sha=x=>createHash('sha256').update(x).digest('hex'),raw=readFileSync(p+'bind-authorization.mjs'),text=raw.toString();
const before='study_ids: [ids.fresh, ids.regression], study_payloads, transport_freeze_hash: transport.raw_sha256,';
if(text.split(before).length!==2)throw Error('unexpected_binder_source');
const corrected=text.replace(before,'study_ids: [ids.fresh, ids.regression], study_payloads: studyPayloads, transport_freeze_hash: transport.raw_sha256,');
writeFileSync(p+'bind-authorization-v2.mjs',corrected,{flag:'wx'});
writeFileSync(p+'authorization-binder-v2-freeze.json',JSON.stringify({at:new Date().toISOString(),parent_path:p+'bind-authorization.mjs',parent_sha256:sha(raw),file:p+'bind-authorization-v2.mjs',sha256:sha(corrected),change:'Fix only the undefined study_payloads shorthand to the already computed studyPayloads object. All validation, plan/input property order, study content, pricing, transport and academic rules unchanged.',failure_before_write:true,native_calls:0,registrations_unchanged:true,pre_evaluation:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sha256:sha(corrected),native_calls:0}));
