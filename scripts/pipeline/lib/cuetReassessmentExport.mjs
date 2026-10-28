const terminalStates = new Set(['eligible','quarantined']);
const money = (requests) => {
  const settled_micro=requests.reduce((sum,r)=>sum+(r.settled_micro||0),0);
  const held_micro=requests.reduce((sum,r)=>sum+(r.held_micro||0),0);
  return {settled_micro,held_micro,committed_micro:settled_micro+held_micro,request_count:requests.length,receipt_complete:requests.every(r=>r.state==='settled')};
};

export function selectLatestResults(rows) {
  const latest=new Map();
  for (const row of rows) {
    if (!row?.id) continue;
    latest.set(row.id,row);
  }
  return latest;
}

export function makeDryRunWithholdingPlan(cases) {
  const groups=new Map();
  for (const item of cases) {
    const group=item.metadata?.passage_group_id??item.legacy?.passage_group_id;
    const key=group?`passage:${group}`:`item:${item.id}`;
    if(!groups.has(key))groups.set(key,{kind:group?'passage_group':'standalone',passage_group_id:group||null,items:[]});
    groups.get(key).items.push(item);
  }
  const decisions=[];
  for (const group of groups.values()) {
    const {items:groupItems,...groupMetadata}=group;
    const pending=groupItems.filter(item=>!item.assessment.terminal);
    const rejected=groupItems.filter(item=>item.assessment.state==='quarantined');
    const action=pending.length?'withhold_until_assessed':rejected.length?'withhold':'no_withhold';
    decisions.push({
      ...groupMetadata,
      item_ids:groupItems.map(item=>item.id),
      action,
      reason:pending.length?'At least one member lacks a matching terminal v7 result; keep the entire unit out of any v7-qualified set.':
        rejected.length?'At least one member is quarantined; passage-linked questions are withheld as one atomic unit.':
        'Every member is eligible under the frozen but unreleased v7 contract; this is not a publication instruction.',
      triggering_ids:pending.length?pending.map(item=>item.id):rejected.map(item=>item.id),
      would_withhold_ids:action==='no_withhold'?[]:groupItems.map(item=>item.id),
      publication_writes:0,
    });
  }
  return {mode:'dry_run_only',atomic_passage_groups:true,publication_writes:0,decisions};
}

export function buildReassessmentExport({bankItems,results,profile,scopedCost,ledgerRows=[],trailingPartialLineIgnored=false,expectedContractPrefix='6f27a6'}) {
  if(!profile||typeof profile.contract!=='string'||!profile.contract.startsWith(expectedContractPrefix)) throw new Error('frozen_reassessment_contract_mismatch');
  if(!Array.isArray(bankItems)||bankItems.length!==profile.denominator) throw new Error('reassessment_denominator_source_mismatch');
  const ids=bankItems.map(row=>(row.candidate||row).id||row.id);
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length) throw new Error('reassessment_bank_ids_must_be_unique');
  const latest=selectLatestResults(results),contractHashes=new Map(profile.content_hashes||[]);
  const rawCosts=scopedCost?.requests||[];
  const ledgerById=new Map(ledgerRows.map(row=>[row.id,row]));
  const costsByCandidate=new Map();
  const unattributed=[];
  for(const request of rawCosts){
    const ledger=ledgerById.get(request.reservation_id)||{};
    const enriched={...request,reserved_micro:ledger.reserved??null,actual_micro:ledger.actual??null,
      conservative_hold:ledger.hold_proof?{maximum_micro:ledger.hold_maximum,proof:ledger.hold_proof}:null};
    if(!request.candidate_id){unattributed.push(enriched);continue;}
    if(!costsByCandidate.has(request.candidate_id))costsByCandidate.set(request.candidate_id,[]);
    costsByCandidate.get(request.candidate_id).push(enriched);
  }
  const cases=bankItems.map((legacyRow,index)=>{
    const candidate=legacyRow.candidate||legacyRow,id=candidate.id||legacyRow.id,row=latest.get(id)||null;
    const contentHash=contractHashes.get(id);
    const matching=Boolean(row&&row.verifier===profile.verifier&&row.contract===profile.contract&&row.content_hash===contentHash);
    const state=matching?row.state:row?.state==='provider_error'?'provider_error':'pending';
    const isTerminal=matching&&terminalStates.has(state);
    const requests=costsByCandidate.get(id)||[];
    const cost=money(requests);
    const record=row?.new_evidence?.record||row?.result?.question?.evidence?.record||null;
    return {
      ordinal:index+1,id,content_hash:contentHash||row?.content_hash||null,
      question:{stem:row?.body??candidate.body??legacyRow.body??null,options:row?.options??candidate.options??legacyRow.options??null,
        key:row?.key??candidate.correct_answer??legacyRow.key??legacyRow.correct_answer??null,
        explanation:row?.explanation??candidate.explanation??legacyRow.explanation??null,
        passage:row?.passage_text??candidate.passage_text??legacyRow.passage_text??null},
      metadata:{subject:row?.subject??candidate.subject??legacyRow.subject??null,chapter:row?.chapter??candidate.chapter??legacyRow.chapter??null,
        topic:candidate.topic??legacyRow.topic??null,difficulty:candidate.difficulty??legacyRow.difficulty??null,
        format:legacyRow.format??candidate.question_type??null,question_type:candidate.question_type??null,
        passage_group_id:candidate.passage_group_id??legacyRow.passage_group_id??null,order_index:candidate.order_index??legacyRow.order_index??null},
      legacy:{snapshot_state:legacyRow.state||null,published_in_legacy_snapshot:legacyRow.state==='published',
        passage_group_id:candidate.passage_group_id??legacyRow.passage_group_id??null,
        cohort:legacyRow.cohort||null,cohort_complete:legacyRow.cohort_complete===true,
        availability_claim:'Source snapshot status only; does not establish current student-facing or production availability.',
        source_refs:row?.source_refs??candidate.source_refs??legacyRow.source_refs??[],
        supporting_excerpts:row?.supporting_excerpts??legacyRow.supporting_excerpts??[],
        original_evidence:row?.original_evidence??candidate.evidence??legacyRow.evidence??null},
      assessment:{state,terminal:isTerminal,eligible_under_unreleased_v7_contract:matching&&state==='eligible',
        matching_result:matching,verifier:row?.verifier??null,contract:row?.contract??null,
        reasons:matching?(row.reasons||[]):[],failed_stage:matching?(row.failed_stage||null):null,
        cuet_fit:record?.cuet_fit||null,full_validation_result:matching?(row.result||null):null,
        v7_evidence:matching?(row.new_evidence||null):null,last_record_at:row?.at||null,
        stale_or_mismatched_latest:row?!matching:false},
      cost:{...cost,by_model:Object.fromEntries([...new Set(requests.map(r=>r.model||'unknown'))].map(model=>[model,money(requests.filter(r=>(r.model||'unknown')===model))])),requests},
    };
  });
  const terminal=cases.filter(item=>item.assessment.terminal).length;
  const costReconciled=money(rawCosts).committed_micro===scopedCost.committed_micro&&
    money(rawCosts).settled_micro===scopedCost.settled_micro&&money(rawCosts).held_micro===scopedCost.held_micro;
  if(!costReconciled)throw new Error('scoped_cost_totals_do_not_reconcile');
  const withholdingPlan=makeDryRunWithholdingPlan(cases);
  return {
    schema:'cuet-bank-reassessment-export-v1',captured_at:new Date().toISOString(),
    run:{status:terminal===cases.length?'complete':'incomplete',complete:terminal===cases.length,denominator:cases.length,terminal,
      eligible:cases.filter(item=>item.assessment.eligible_under_unreleased_v7_contract).length,
      quarantined:cases.filter(item=>item.assessment.terminal&&item.assessment.state==='quarantined').length,
      pending:cases.length-terminal,latest_result_rows:results.length,unique_result_ids:latest.size,
      provider_errors:cases.filter(item=>item.assessment.state==='provider_error').length,
      mismatched_or_stale:cases.filter(item=>item.assessment.stale_or_mismatched_latest).length,
      trailing_partial_jsonl_line_ignored:trailingPartialLineIgnored,
      contract:profile.contract,verifier:profile.verifier,topology:profile.topology,publication:'never',
      status_note:terminal===cases.length?'All denominator entries have matching terminal results under this frozen contract.':'Interim export: missing, provider-error, or mismatched rows remain pending; no complete-yield claim is made.'},
    scoped_cost:{...money(rawCosts),receipt_complete:scopedCost.receipt_complete,cost_reconciled:costReconciled,
      unattributed_requests:unattributed,unattributed_totals:money(unattributed)},
    distinctions:{legacy_availability:'Published in the input bank snapshot is a legacy-source status, not proof of current/live availability.',
      v7_eligibility:'Eligibility is only under the exact frozen v7 contract and does not publish or release the item.',
      withholding:'The attached plan is dry-run only; it does not update a database or publication manifest.'},
    withholding_plan:withholdingPlan,cases,
  };
}
