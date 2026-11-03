// Read-only accounting of the persistent budget ledger: receipt-settled usage versus conservative holds, split by purpose and period.
// node --experimental-sqlite scripts/pipeline/tools/ledgerSummary.mjs [--since "2026-10-07 15:00:00"]
import {DatabaseSync} from 'node:sqlite';import {writeFileSync} from 'node:fs';
const sinceIndex=process.argv.indexOf('--since'),since=sinceIndex>=0?process.argv[sinceIndex+1]:null;
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
const meta=new Map(db.prepare("SELECT reservation_id,json_extract(request_json,'$.config.purpose') p FROM provider_batches UNION ALL SELECT reservation_id,json_extract(request_json,'$.config.purpose') FROM provider_requests").all().map(r=>[r.reservation_id,r.p]));
const rows=db.prepare('SELECT id,model,reserved,actual,state,created_at,receipt_json FROM requests').all().map(r=>{const rc=r.receipt_json?JSON.parse(r.receipt_json):{};return {...r,purpose:rc.purpose||meta.get(r.id)||(r.model==='historical'?'historical_reconciliation':'unattributed')};});
const sum=a=>a.reduce((n,r)=>n+(r.state==='settled'?r.actual:0),0)/1e6,held=a=>a.reduce((n,r)=>n+(r.state==='settled'?0:Math.max(r.reserved,r.actual||0)),0)/1e6;
const by=f=>{const o={};for(const r of rows.filter(f)){const k=r.purpose;(o[k]??=[]).push(r);}return Object.fromEntries(Object.entries(o).map(([k,a])=>[k,{requests:a.length,settled_usd:Math.round(sum(a)*1e6)/1e6,held_usd:Math.round(held(a)*1e6)/1e6}]));};
const all=rows,out={at:new Date().toISOString(),limit_usd:50,lifetime:{requests:all.length,settled_usd:Math.round(sum(all)*1e6)/1e6,held_usd:Math.round(held(all)*1e6)/1e6,committed_usd:Math.round((sum(all)+held(all))*1e6)/1e6,unresolved:all.filter(r=>r.state==='unresolved').length},by_purpose_lifetime:by(()=>true),
 ...(since?{since,by_purpose_since:by(r=>r.created_at>=since),since_total:{requests:rows.filter(r=>r.created_at>=since).length,settled_usd:Math.round(sum(rows.filter(r=>r.created_at>=since))*1e6)/1e6,held_usd:Math.round(held(rows.filter(r=>r.created_at>=since))*1e6)/1e6}}:{}),
 invoices:'No provider invoice has been obtained. Usage receipts and holds are not invoices; an uncertain call is never assumed free.'};
writeFileSync('artifacts/question-factory/cuet-fit-2026-10-07/ledger-summary.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,1));
