// Read-only diagnostic: apply the current deterministic idea inspection to saved
// eligible campaign exports and the reassessed legacy bank's ordering items.
// Prints a report; frozen campaign files, outcomes and publication state are never changed.
import {readFileSync} from 'node:fs';
import {inspectBatch,keyedOrder,BATCH_INSPECTION_CONTRACT} from '../lib/batchInspection.mjs';
const root='artifacts/question-factory/';
const campaigns={A:'cuet-readiness-baseline-100-2026-10-08',B:'cuet-readiness-improved-100-2026-10-08',C:'cuet-readiness-cost-source-c-100-2026-10-08'};
const opts={eligible:()=>({eligible:true})};
const eligible=Object.fromEntries(Object.entries(campaigns).map(([k,d])=>[k,JSON.parse(readFileSync(root+d+'/all-candidates.json','utf8')).filter(j=>j.state==='eligible').map(j=>({...j,id:k+':'+j.id}))]));
// Bank records carry no question_type: four pure letter-sequence options mark an ordering task.
const latest=new Map();
for(const line of readFileSync(root+'cuet-readiness-2026-10-08/reassessment/results.jsonl','utf8').split(/\r?\n/).filter(Boolean)){const q=JSON.parse(line);latest.set(q.id,q);}
const bank=[...latest.values()].filter(q=>q.options?.length===4&&q.options.every((_,i)=>keyedOrder({options:q.options,correct_answer:'ABCD'[i]}).length===4))
 .map(q=>({id:'bank:'+q.id,state:'eligible',reassessment_state:q.state,candidate:{subject:q.subject,chapter:q.chapter,question_type:'sequence_ordering',body:q.body,options:q.options,correct_answer:q.key}}));
const ordering=rows=>rows.filter(j=>/order|jumble|sequence/i.test(j.candidate?.question_type||''));
const pairsOf=rows=>inspectBatch(rows,opts).duplicate_pairs.filter(p=>p.rule==='repeated_ordering_task').map(({a,b})=>({a,b}));
const all=[...bank,...Object.values(eligible).flat()],byId=new Map(all.map(j=>[j.id,j]));
const combined=pairsOf(all);
// Connected components: every item in a group repeats one ordering idea.
const parent=new Map(),find=x=>parent.get(x)===x?x:find(parent.get(x));
for(const {a,b} of combined){for(const x of [a,b])if(!parent.has(x))parent.set(x,x);parent.set(find(b),find(a));}
const groups={};for(const x of parent.keys())(groups[find(x)]??=[]).push(x);
const describe=id=>{const j=byId.get(id),q=j.candidate;return {id,subject:q.subject,chapter:q.chapter,state:j.reassessment_state||j.state,first_step:String(q.body).match(/^\s*\(A\)\s*(.+)$/m)?.[1]?.slice(0,90)||null};};
console.log(JSON.stringify({contract:BATCH_INSPECTION_CONTRACT,generated_at:new Date().toISOString(),
 per_campaign:Object.fromEntries(Object.entries(eligible).map(([k,v])=>[k,{eligible:v.length,ordering_items:ordering(v).length,repeated_ordering_pairs:pairsOf(v)}])),
 bank_ordering_items:bank.length,bank_ordering_by_state:bank.reduce((m,j)=>(m[j.reassessment_state]=(m[j.reassessment_state]||0)+1,m),{}),
 combined:{ordering_items:all.length,repeated_ordering_pairs:combined.length,groups:Object.values(groups).length,items_in_groups:parent.size,surplus_items:parent.size-Object.values(groups).length,
  group_details:Object.values(groups).map(g=>g.map(describe))},
 limitation:'Deterministic diagnostic only. The rule was written from the confirmed C bookmark pair, so C detection is not independent evidence; flagged groups need reading before any reclassification. Frozen outcomes, bank state and publication are unchanged.'},null,1));
