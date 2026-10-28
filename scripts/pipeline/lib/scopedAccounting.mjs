// Attribution from persisted dispatch contracts, including the first reassessment's
// malformed metadata. Never infer spending from a concurrent lifetime delta.
export function bodyCandidateId(provider, body) {
  if (!body || typeof body !== 'object') return null;
  const raw = provider === 'openai' ? body.input?.find(r => r.role === 'user')?.content : provider === 'anthropic' ? body.messages?.[0]?.content : body.contents?.[0]?.parts?.[0]?.text;
  try { const input = JSON.parse(raw); return input.candidate_id || input.job_id || input.candidate?.id || null; } catch { return null; }
}
export function scopedAccounting(ledger, prefix, candidateId = null) {
  if (!prefix || typeof prefix !== 'string') throw Error('accounting_scope_required');
  const metadataRows = ledger.db.prepare(`SELECT r.*,p.request_json FROM requests r JOIN
    (SELECT reservation_id,request_json FROM provider_requests UNION ALL SELECT reservation_id,request_json FROM provider_batches) p ON p.reservation_id=r.id
    WHERE substr(json_extract(p.request_json,'$.config.candidate_id'),1,?)=?`).all(prefix.length,prefix);
  const receiptOnlyRows = ledger.db.prepare(`WITH metadata_ids(reservation_id) AS MATERIALIZED (
      SELECT reservation_id FROM provider_requests UNION SELECT reservation_id FROM provider_batches
    )
    SELECT r.*,NULL AS request_json FROM requests r
    WHERE r.receipt_json IS NOT NULL
      AND substr(CASE WHEN json_valid(r.receipt_json) THEN json_extract(r.receipt_json,'$.candidate_id') END,1,?)=?
      AND r.id NOT IN (SELECT reservation_id FROM metadata_ids)`).all(prefix.length,prefix);
  const rows=[...metadataRows,...receiptOnlyRows];
  const selected = new Map();
  for (const r of rows) {
    let requestId=null, attributedId=null, stage=null, provider=null;
    if (r.request_json) {
      let saved;try { saved=JSON.parse(r.request_json); } catch { continue; }
      const {config={},body} = saved;
      const scopedConfigId=typeof config.candidate_id==='string'&&config.candidate_id.startsWith(prefix);
      const bodyId=bodyCandidateId(config.provider,body);
      const scopedBodyId=typeof bodyId==='string'&&bodyId.startsWith(prefix);
      if (!scopedConfigId&&!scopedBodyId) continue;
      if (candidateId && bodyId !== candidateId && config.candidate_id !== prefix + candidateId) continue;
      // The persisted body is the candidate identity when a legacy tag says "undefined".
      requestId=config.key||null;
      const taggedId=typeof config.candidate_id==='string'&&config.candidate_id.startsWith(prefix)?config.candidate_id.slice(prefix.length):null;
      attributedId=bodyId||(taggedId&&taggedId!=='undefined'?taggedId:null);stage=config.stage||null;provider=config.provider||null;
    } else {
      let receipt;try { receipt=JSON.parse(r.receipt_json||'null'); } catch { continue; }
      const receiptCandidate=typeof receipt?.candidate_id==='string'?receipt.candidate_id:null;
      if (!receiptCandidate?.startsWith(prefix)) continue; // Unknown/unprefixed receipts are never guessed into this scope.
      if (candidateId && receiptCandidate!==prefix+candidateId && receiptCandidate!==candidateId) continue;
      requestId=receipt.idempotency_key||null;
      attributedId=receiptCandidate.startsWith(prefix)?receiptCandidate.slice(prefix.length):receiptCandidate;
      stage=receipt.stage||null;provider=receipt.provider||null;
    }
    selected.set(r.id,{reservation_id:r.id,request_id:requestId,candidate_id:attributedId,stage,provider,model:r.model,state:r.state,settled_micro:r.state==='settled'?(r.actual||0):0,held_micro:r.state==='settled'?0:Math.max(r.reserved,r.actual||0)});
  }
  const requests = [...selected.values()];
  const settled_micro=requests.reduce((n,r)=>n+r.settled_micro,0), held_micro=requests.reduce((n,r)=>n+r.held_micro,0);
  return {settled_micro,held_micro,committed_micro:settled_micro+held_micro,requests,receipt_complete:requests.every(r=>r.state==='settled')};
}
