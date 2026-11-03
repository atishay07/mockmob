// Publication is an academic decision. A finished failed call on a quarantined
// item may retain a proven maximum hold, while unrelated approved items publish.
// Pending accepted requests, unknown acceptance, overruns and missing bounds fail
// closed. This never converts a hold into settled cost.
export function cohortAccounting(requests,{jobs,budget}){
 const states=new Map(jobs.map(j=>[j.id,j.state])),blocked=[],held=[];
 if(budget.unbounded_unresolved||budget.committed_micro>budget.limit_micro)blocked.push('budget_not_bounded');
 for(const row of requests){
  if(row.state==='settled')continue;
  const receipt=row.receipt||{},record=receipt.provider_batch_record;
  const terminal=['completed','failed','expired','cancelled'].includes(receipt.provider_batch_status);
  const failed=record&&(record.error||record.response?.status_code!==200);
  const bounded=row.hold_maximum_micro===row.reserved&&row.reserved>0&&(row.actual||0)<=row.reserved;
  const identity=record?.custom_id===row.provider_key&&receipt.provider_batch_id===row.provider_id;
  if(row.state==='unresolved'&&terminal&&failed&&bounded&&identity&&states.get(row.candidate_id)==='quarantined')held.push(row.id);
  else blocked.push(row.id);
 }
 return {ready:blocked.length===0,settled:requests.every(r=>r.state==='settled'),bounded_terminal_failure_holds:held,blocked_requests:blocked,
  basis:'Only terminal failed requests for quarantined items can retain proven maximum holds while unaffected approved items publish. Every hold stays committed and unsettled.'};
}

export function readCohortAccounting(ledger,jobs){
 const ids=new Set(jobs.map(j=>j.id));
 const rows=ledger.db.prepare(`SELECT r.*,p.provider_key,p.provider_id,p.candidate_id,h.maximum_micro AS hold_maximum_micro FROM requests r
 JOIN (SELECT reservation_id,id AS provider_key,provider_id,json_extract(request_json,'$.config.candidate_id') AS candidate_id,json_extract(request_json,'$.config.purpose') AS purpose FROM provider_batches
 UNION ALL SELECT reservation_id,id,NULL,json_extract(request_json,'$.config.candidate_id'),json_extract(request_json,'$.config.purpose') FROM provider_requests) p ON p.reservation_id=r.id
 LEFT JOIN conservative_holds h ON h.reservation_id=r.id WHERE p.purpose='candidate'`).all().filter(r=>ids.has(r.candidate_id)).map(r=>({...r,receipt:r.receipt_json?JSON.parse(r.receipt_json):{}}));
 return cohortAccounting(rows,{jobs,budget:ledger.snapshot()});
}
