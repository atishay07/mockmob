import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base='https://www.mockmob.in',subjects=['english','accountancy','business_studies','economics'];
const rows=await Promise.all(subjects.map(async subject=>{
 const response=await fetch(base+'/api/questions/feed?subject='+subject+'&limit=5&offset=0',{signal:AbortSignal.timeout(45000)});
 assert.equal(response.status,200,subject);const body=await response.json();
 assert.ok(body.questions?.length>0,'Existing '+subject+' library must remain readable');
 return {subject,returned:body.questions.length,ids:body.questions.map(q=>q.id),evidence_tiers:body.questions.map(q=>q.selection_evidence_tier??null)};
}));
const proof={at:new Date().toISOString(),base,passed:true,checks:rows,scope:'Existing library compatibility only; this does not certify legacy academic quality or prove new factory availability.',paid_provider_calls:0,production_writes:0};
writeFileSync('artifacts/question-factory/execution-2026-10-07/production/legacy-library-retrieval.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
