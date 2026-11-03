import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {QUALIFICATION_V77_PREFIX,verifyV77Freeze,verifyV77TransportFreeze,V77_TRANSPORT_DEPENDENCIES} from '../../../../scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs';
const arg=k=>process.argv[process.argv.indexOf(k)+1],read=p=>JSON.parse(readFileSync(p)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
for(const k of ['--fresh-dir','--regression-dir','--out'])if(!process.argv.includes(k))throw Error('missing_'+k);
const root=resolve('.'),fixed=resolve('artifacts/question-factory/cuet-readiness-2026-10-09/v77-qualification');
verifyV77Freeze(root);verifyV77TransportFreeze(root,V77_TRANSPORT_DEPENDENCIES);
const dirs={fresh:resolve(arg('--fresh-dir')),regression:resolve(arg('--regression-dir'))};
for(const dir of Object.values(dirs)){const rel=relative(fixed,dir);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('outside_fixed_scope');}
const outDir=resolve(arg('--out'));if(existsSync(outDir))throw Error('preserve_prior_export');
const outRel=relative(root,outDir);if(!outRel||outRel.startsWith('..')||isAbsolute(outRel))throw Error('outside_repo_export');
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true}),base=read('data/source_registry.json');
const costs=db.prepare("SELECT p.id,p.provider,p.state,p.request_json,p.response_json,r.state AS budget_state,r.reserved,r.actual,r.receipt_json FROM provider_requests p JOIN requests r ON r.id=p.reservation_id WHERE json_extract(p.request_json,'$.config.candidate_id') LIKE ?").all(QUALIFICATION_V77_PREFIX+'%').map(x=>{const req=JSON.parse(x.request_json),resp=x.response_json?JSON.parse(x.response_json):{};return{native_key:x.id,provider:x.provider,stage:req.config.stage,candidate_id:req.config.candidate_id,state:x.state,budget_state:x.budget_state,reserved_usd:x.reserved/1e6,actual_usd:x.budget_state==='settled'?x.actual/1e6:null,held_usd:x.budget_state==='settled'?0:Math.max(x.reserved,x.actual||0)/1e6,served_tier:resp.service_tier||null,usage:resp.usage||resp.usageMetadata||null,receipt:x.receipt_json?JSON.parse(x.receipt_json):null};});
db.close();
const all=[];
for(const [role,dir]of Object.entries(dirs)){
 const f=read(join(dir,'frozen.json')),r=existsSync(join(dir,'run/results.json'))?read(join(dir,'run/results.json')):null,o=read(join(dir,'scratch-registry-overlay.json')),sources={...base.sources,...o.sources};
 for(const item of f.fixtures){const c=item.candidate,v=r?.topologies?.dual_blind?.find(x=>x.id===item.id)||null,receipts=costs.filter(x=>x.candidate_id===QUALIFICATION_V77_PREFIX+item.id);all.push({study_id:f.id,classification:role,fixture:item,validation:v,independent_native_solutions:r?.evaluations?.[item.id]||null,recovery_history:(r?.recovery_history||[]).filter(x=>x.fixture_id===item.id),decisive_excerpts:(c.source_refs||[]).map(ref=>{const s=sources[ref.id];return{source_ref:ref,text:s?.facts?.[ref.locator]?.text||null,url:s?.url||null,publisher:s?.publisher||null,identity_sha256:s?.identity_sha256||null,permission:s?.permission||null};}),item_costs:{settled_usd:receipts.reduce((s,x)=>s+(x.actual_usd||0),0),held_usd:receipts.reduce((s,x)=>s+x.held_usd,0),requests:receipts},input_sha256:{frozen:sha(join(dir,'frozen.json')),execution_plan:existsSync(join(dir,'run/execution-plan.json'))?sha(join(dir,'run/execution-plan.json')):null}});}
}
const terminal=all.filter(x=>['eligible','quarantined'].includes(x.validation?.state)).length;
const eligibleValid=all.filter(x=>x.fixture.expected_valid===true&&x.validation?.state==='eligible');
const criteria={};for(const item of eligibleValid)for(const c of item.validation.question?.evidence?.record?.criteria||[]){const stat=criteria[c.id]||={kind:c.kind,applicable:0,passed:0,levels:[]};if(c.applicable!==false){stat.applicable++;if(c.passed===true)stat.passed++;if(Number.isFinite(c.level))stat.levels.push(c.level);}}
for(const c of Object.values(criteria))if(c.levels.length)c.mean_level=c.levels.reduce((s,x)=>s+x,0)/c.levels.length;
const summary={at:new Date().toISOString(),scope:'Fixed qualification evidence, not generated pilot or publication. Correlated root/defect pairs and shared source passages.',denominator:all.length,terminal,pending:all.length-terminal,eligible_valid:eligibleValid.length,valid_controls:all.filter(x=>x.fixture.expected_valid===true).length,accepted_invalid_ids:all.filter(x=>x.fixture.expected_valid===false&&x.validation?.state==='eligible').map(x=>x.fixture.id),settled_usd:costs.reduce((s,x)=>s+(x.actual_usd||0),0),held_usd:costs.reduce((s,x)=>s+x.held_usd,0),provider_requests:costs.length,quality_on_eligible_valid_only:criteria,limitations:'Model criteria are conditional on eligibility and do not prove correctness or observed student performance. A high score never compensates academic failure. Full qualification decision is in release assessment, requiring fixed-denominator complete outcomes and receipts.'};
const attributed=all.reduce((s,x)=>s+x.item_costs.requests.length,0);if(attributed!==costs.length)throw Error('unattributed_or_duplicate_provider_costs');
mkdirSync(outDir,{recursive:true});
const save=(name,data)=>writeFileSync(join(outDir,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
save('all-cases.json',{...summary,all_cases:all});save('summary.json',summary);
const headers=['study','id','subject','chapter','format','difficulty','expected_valid','category','body','passage','A','B','C','D','proposed_key','oracle_key','explanation','state','luna_key','gemini_key','rejection_reasons','decisive_excerpts','settled_usd','held_usd'];
const escape=x=>'"'+String(x??'').replaceAll('"','""')+'"';
const rows=all.map(x=>{const f=x.fixture,c=f.candidate,v=x.validation,s=x.independent_native_solutions;return[x.classification,f.id,c.subject,c.chapter,c.question_type,c.difficulty,f.expected_valid,f.category,c.body,c.passage_text,...'ABCD'.split('').map(k=>(c.options||[]).find(o=>o.key===k)?.text),c.correct_answer,f.oracle?.key,c.explanation,v?.state||'unfinished',s?.openai?.solved_key,s?.gemini?.solved_key,JSON.stringify([...(v?.reasons||[]),...(v?.failure_details||[])]),JSON.stringify(x.decisive_excerpts),x.item_costs.settled_usd,x.item_costs.held_usd].map(escape).join(',');});
writeFileSync(join(outDir,'all-cases.csv'),[headers.map(escape).join(','),...rows].join('\n')+'\n',{flag:'wx'});
save('manifest.json',{at:new Date().toISOString(),denominator:all.length,terminal,files:['all-cases.json','summary.json','all-cases.csv'].map(name=>({name,sha256:sha(join(outDir,name))}))});
console.log(JSON.stringify({outDir,denominator:all.length,terminal,settled_usd:summary.settled_usd,held_usd:summary.held_usd,provider_requests:costs.length}));
