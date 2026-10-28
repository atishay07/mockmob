// Owner-requested one-off independent review; never a publication or release.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';

const base='artifacts/question-factory/cuet-readiness-2026-10-08/execution';
const snapshot=base+'/reassessment/snapshot-20261008T060712941Z';
const output=base+'/owner-127-review';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const bank=read(snapshot+'/bank-reassessment-export.json');
const plan=read(snapshot+'/dry-run-withholding-plan.json');
const registry=read('data/source_registry.json');
const ids=new Set(plan.decisions.flatMap(row=>row.would_withhold_ids));
const cases=bank.cases.filter(row=>ids.has(row.id));
if(ids.size!==127 || cases.length!==127 || new Set(cases.map(row=>row.id)).size!==127)throw Error('exact_127_review_set_required');
if(existsSync(output+'/manifest.json'))throw Error('review_packet_already_frozen');
mkdirSync(output,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=[];
const write=(name,value)=>{const bytes=JSON.stringify(value,null,2)+'\n';writeFileSync(output+'/'+name,bytes);files.push({name,sha256:sha(bytes)});};
const subjects=['accountancy','business_studies','economics','english'];
const counts={};
for(const subject of subjects){
 const rows=cases.filter(row=>row.metadata.subject===subject);counts[subject]=rows.length;
 for(let offset=0;offset<rows.length;offset+=10){
  const batch=rows.slice(offset,offset+10),sources={};
  const blind=batch.map(row=>{
   const refs=(row.legacy.source_refs||[]).map(ref=>{
    const identity=ref.id+':'+ref.version+':'+ref.locator+':'+ref.support_hash;
    const excerpt=(row.legacy.supporting_excerpts||[]).find(x=>x.id===ref.id&&x.locator===ref.locator);
    const source=registry.sources?.[ref.id];
    sources[identity]={...ref,text:excerpt?.text??null,url:excerpt?.url??null,publisher:excerpt?.publisher??null,
     excerpt_matches_saved_support_hash:typeof excerpt?.text==='string'&&hashJSON(excerpt.text)===ref.support_hash,
     current_registry_matches:source?.version===ref.version&&source?.supports?.[ref.locator]===ref.support_hash&&source?.facts?.[ref.locator]?.text===excerpt?.text,
     current_registry_state:source?.state??null,registered_permission:source?.reuse_permitted===true,registered_identity_sha256:source?.identity_sha256??null};
    return identity;
   });
   const {key,explanation,...question}=row.question;
   return {id:row.id,content_hash:row.content_hash,metadata:row.metadata,question,source_keys:refs};
  });
  const prefix=subject+'-'+String(offset/10+1).padStart(2,'0');
  write(prefix+'.blind.json',{schema:'owner-one-off-127-blind-review-v1',subject,offset,total:rows.length,notice:'Original keys, rationales and previous judgments are intentionally withheld. Establish a source-grounded solution and every defensible option before opening comparison data. This is not a fresh benchmark or publication approval.',sources,cases:blind});
  write(prefix+'.comparison.json',{schema:'owner-one-off-127-post-solve-comparison-v1',notice:'Read only AFTER saving and freezing the independent solutions for this batch.',cases:batch.map(row=>({id:row.id,content_hash:row.content_hash,key:row.question.key,explanation:row.question.explanation,prior_assessment:row.assessment,withholding_group:plan.decisions.find(d=>d.would_withhold_ids.includes(row.id))}))});
 }
}
write('manifest.json',{schema:'owner-one-off-127-review-manifest-v1',frozen_at:new Date().toISOString(),total:127,counts,source_snapshot_sha256:sha(readFileSync(snapshot+'/bank-reassessment-export.json')),withholding_plan_sha256:sha(readFileSync(snapshot+'/dry-run-withholding-plan.json')),registry_sha256:sha(readFileSync('data/source_registry.json')),files:[...files],publication_writes:0,paid_factory_calls:0,current_release_qualification:false});
console.log(JSON.stringify({output,total:127,counts,files:files.length,publication_writes:0,paid_factory_calls:0}));
