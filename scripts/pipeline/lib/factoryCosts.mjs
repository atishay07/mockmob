// Settled token-priced spending and open holds remain distinct. Reasoning tokens
// are a subset of output tokens and are never charged a second time here.
export function factoryCostReport(ledger) {
  const rows=ledger.db.prepare('SELECT * FROM requests').all();
  const pending=new Map(ledger.db.prepare('SELECT reservation_id,request_json FROM provider_batches UNION ALL SELECT reservation_id,request_json FROM provider_requests').all().map(row=>[row.reservation_id,JSON.parse(row.request_json).config]));
  const stages=new Map();
  for(const row of rows) {
    const receipt=row.receipt_json?JSON.parse(row.receipt_json):{},config=pending.get(row.id) || {};
    const stage=receipt.stage || config.stage || (row.model==='historical'?'historical':'unclassified');
    const provider=receipt.provider || config.provider || null;
    const key=`${provider || 'unknown'}:${row.model}:${stage}`;
    if(!stages.has(key))stages.set(key,{stage,provider,model:row.model,settled_requests:0,open_requests:0,settled_usd:0,held_usd:0,input_tokens:0,output_tokens:0,reasoning_tokens:0,usage_missing_requests:0});
    const item=stages.get(key);
    if(row.state!=='settled'){item.open_requests++;item.held_usd+=Math.max(row.actual || 0,row.reserved)/1e6;continue;}
    item.settled_requests++;item.settled_usd+=row.actual/1e6;
    const usage=receipt.usage;
    if(!usage){item.usage_missing_requests++;continue;}
    item.input_tokens+=usage.input_tokens ?? usage.promptTokenCount ?? 0;
    item.output_tokens+=usage.output_tokens ?? ((usage.candidatesTokenCount || 0)+(usage.thoughtsTokenCount || 0));
    item.reasoning_tokens+=usage.output_tokens_details?.reasoning_tokens ?? usage.thoughtsTokenCount ?? 0;
  }
  return {basis:'Settled provider usage at recorded token rates; open holds are not invoices.',stages:[...stages.values()]};
}
