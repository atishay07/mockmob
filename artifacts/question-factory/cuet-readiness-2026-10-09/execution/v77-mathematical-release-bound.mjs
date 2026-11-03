import {readFileSync,existsSync,writeFileSync} from 'node:fs';
const base='artifacts/question-factory/cuet-readiness-2026-10-09/v77-qualification';
const read=p=>JSON.parse(readFileSync(p));
const all=[];
for(const role of ['fresh','regression']){
 const dir=`${base}/v77-qualification-2026-10-09-final-${role}-integrated`,f=read(dir+'/frozen.json');
 const path=dir+'/run/results.json',r=existsSync(path)?read(path):{},rows=r.topologies?.dual_blind||[];
 const ids=new Set(f.fixtures.map(x=>x.id));
 if(ids.size!==f.fixtures.length||new Set(rows.map(x=>x.id)).size!==rows.length||rows.some(x=>!ids.has(x.id)))throw Error('fixed_dataset_or_result_identity_invalid');
 for(const x of f.fixtures){const row=rows.find(y=>y.id===x.id);all.push({role,id:x.id,subject:x.candidate.subject,expected_valid:x.expected_valid,state:row?.state||'unfinished'});}
}
const positives=all.filter(x=>x.expected_valid===true),negatives=all.filter(x=>x.expected_valid===false);
const bound=rows=>({valid_controls:rows.length,eligible:rows.filter(x=>x.state==='eligible').length,quarantined:rows.filter(x=>x.state==='quarantined').length,unfinished:rows.filter(x=>!['eligible','quarantined'].includes(x.state)).length,maximum_possible_eligible:rows.filter(x=>x.state!=='quarantined').length,maximum_possible_survival:rows.length?rows.filter(x=>x.state!=='quarantined').length/rows.length:null});
const pooled=bound(positives),subjects=Object.fromEntries([...new Set(positives.map(x=>x.subject))].map(s=>[s,bound(positives.filter(x=>x.subject===s))]));
const output={at:new Date().toISOString(),scope:'Read-only mathematical bound; does not replace the frozen release assessor or relabel unfinished cases.',denominator:all.length,pooled_floor:0.85,subject_floor:0.70,pooled,subjects,rule_already_impossible:pooled.maximum_possible_survival<0.85||Object.values(subjects).some(x=>x.maximum_possible_survival<0.70),defect_coverage:{registered:negatives.length,evaluated_terminal:negatives.filter(x=>['eligible','quarantined'].includes(x.state)).length,accepted_ids:negatives.filter(x=>x.state==='eligible').map(x=>x.id),safety_demonstrated:false},unfinished_ids:all.filter(x=>!['eligible','quarantined'].includes(x.state)).map(x=>x.id),decision:'No pilot/release/publication. Complete accepted receipts; no further paid qualification under final-attempt authorization.'};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(output,null,2));
