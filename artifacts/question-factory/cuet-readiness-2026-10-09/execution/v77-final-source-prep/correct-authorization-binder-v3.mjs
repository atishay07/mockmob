import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
const p='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep/',sha=x=>createHash('sha256').update(x).digest('hex'),raw=readFileSync(p+'bind-authorization-v2.mjs'),text=raw.toString();
const before='execution_plan_hashes, issued_at: new Date().toISOString()';
if(text.split(before).length!==2)throw Error('unexpected_binder_source');
const corrected=text.replace(before,'execution_plan_hashes: executionPlanHashes, issued_at: new Date().toISOString()');
writeFileSync(p+'bind-authorization-v3.mjs',corrected,{flag:'wx'});
writeFileSync(p+'authorization-binder-v3-freeze.json',JSON.stringify({at:new Date().toISOString(),parent_path:p+'bind-authorization-v2.mjs',parent_sha256:sha(raw),file:p+'bind-authorization-v3.mjs',sha256:sha(corrected),change:'Fix remaining undefined execution_plan_hashes shorthand to computed executionPlanHashes. Combined additive V3 fixes only the two object property name/value references. Validation, plan/input property order, study content, pricing, transport and academic rules unchanged.',failure_before_write:true,native_calls:0,registrations_unchanged:true,pre_evaluation:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sha256:sha(corrected),native_calls:0}));
