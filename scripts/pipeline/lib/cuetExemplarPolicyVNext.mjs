import {hashJSON} from '../../../data/question_factory_policy.mjs';

// Draft-only IDs. This module is intentionally not imported by v7 or any runtime path.
export const CUET_EXEMPLAR_POLICY_VNEXT='cuet-exemplar-selection-vnext-1';
export const CUET_NUMERIC_ROUTE_POLICY_VNEXT='cuet-numeric-route-format-diagnostic-v1';
export const CUET_VNEXT_VALIDATOR_VERSION='cuet-fit-validator-vnext-exemplar-policy-1';

const normalized=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,'_');
const authenticated=example=>example?.source_kind==='authentic_pyq'&&example?.final_key_matched===true&&
  example?.authentication?.independently_matched===true&&example?.authentication?.option_order_checked===true;
const blindExampleView=example=>({id:example.id,year:example.year,subject:example.subject,question_type:example.question_type,
  route:example.route,difficulty:example.difficulty,body:example.body,options:example.options,passage_text:example.passage_text||null});

/**
 * Original practice may proceed without any global authenticated exemplar.
 * Every non-original provenance remains strict: it must resolve its exact authenticated anchor.
 * Returned exemplar views never contain keys or key-source data.
 */
export function chooseCuetExemplarsVNext(question,globalExamples=[],{limit=3}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>10)throw new Error('bounded_exemplar_count_required');
  const provenance=question?.provenance||question?.evidence?.record?.provenance||{};
  const kind=provenance.kind||null;
  const pool=Array.isArray(globalExamples)?globalExamples.filter(authenticated):[];
  if(kind==='original_practice'){
    const matches=pool.filter(ex=>ex.subject===question.subject&&normalized(ex.question_type)===normalized(question.question_type)).slice(0,limit);
    return {policy:CUET_EXEMPLAR_POLICY_VNEXT,kind,required:false,allowed:true,
      status:matches.length?'optional_comparators_attached':'no_matching_optional_comparators',
      exemplar_ids:matches.map(ex=>ex.id),blind_exemplars:matches.map(blindExampleView)};
  }
  const anchor=provenance.anchor_id||question?.anchor_id||(kind==='authentic_pyq'?question?.id:null)||null;
  const exact=anchor?pool.find(ex=>ex.id===anchor&&ex.subject===question.subject):null;
  if(!exact)return {policy:CUET_EXEMPLAR_POLICY_VNEXT,kind,required:true,allowed:false,
    status:'authenticated_anchor_required',anchor_id:anchor,exemplar_ids:[],blind_exemplars:[]};
  if(normalized(exact.question_type)!==normalized(question.question_type))return {policy:CUET_EXEMPLAR_POLICY_VNEXT,kind,required:true,allowed:false,
    status:'anchored_exemplar_format_mismatch',anchor_id:anchor,exemplar_ids:[exact.id],blind_exemplars:[]};
  return {policy:CUET_EXEMPLAR_POLICY_VNEXT,kind,required:true,allowed:true,status:'exact_authenticated_anchor_matched',
    anchor_id:anchor,exemplar_ids:[exact.id],blind_exemplars:[blindExampleView(exact)]};
}

const NUMERIC_FORMAT=/^(numerical(?:_|$)|numeric(?:_|$)|single_correct_numerical$|calculation(?:_|$))/;
const CALCULATION_REQUEST=/\b(calculate|compute|how much|determine (?:the )?(?:amount|gain|loss|profit|value)|find (?:the )?(?:amount|ratio|value))\b/i;
const NUMERIC_LITERAL=/\d|₹|\bRs\.?\s*\d/i;

/** Classification only: a route/format mismatch is surfaced, never silently rewritten or rejected here. */
export function numericRouteFormatVNext(question){
  const route=normalized(question?.route),format=normalized(question?.question_type||question?.format);
  const text=[question?.body,...(question?.options||[]).map(option=>typeof option==='string'?option:option?.text),question?.passage_text].filter(Boolean).join(' ');
  const routeRequestsNumeric=route==='numerical';
  const formatRequestsNumeric=NUMERIC_FORMAT.test(format);
  const calculationTextRequestsNumeric=CALCULATION_REQUEST.test(question?.body||'')&&NUMERIC_LITERAL.test(text);
  const numericRequired=routeRequestsNumeric||formatRequestsNumeric||calculationTextRequestsNumeric;
  let status='aligned';
  if(!route)status=numericRequired?'route_missing_for_numeric_item':'route_unspecified';
  else if(route==='numerical'&&!formatRequestsNumeric&&!calculationTextRequestsNumeric)status='numeric_route_non_numeric_format_review';
  else if(route!=='numerical'&&(formatRequestsNumeric||calculationTextRequestsNumeric))status='numeric_item_non_numeric_route_review';
  return {policy:CUET_NUMERIC_ROUTE_POLICY_VNEXT,route:route||null,format:format||null,numeric_required:numericRequired,
    route_requests_numeric:routeRequestsNumeric,format_requests_numeric:formatRequestsNumeric,
    calculation_text_requests_numeric:calculationTextRequestsNumeric,status,classification_only:true,rewrote_metadata:false};
}

/**
 * Bind these draft semantics into a new contract before authoring or judging.
 * Pass the complete frozen parent contract hash; never mutate or reuse a v7 hash.
 */
export function bindCuetExemplarContractVNext(parentContractHash){
  if(typeof parentContractHash!=='string'||!/^[a-f0-9]{64}$/.test(parentContractHash))throw new Error('frozen_parent_contract_hash_required');
  const binding={verifier_version:CUET_VNEXT_VALIDATOR_VERSION,parent_contract_hash:parentContractHash,
    exemplar_policy:CUET_EXEMPLAR_POLICY_VNEXT,numeric_route_policy:CUET_NUMERIC_ROUTE_POLICY_VNEXT};
  return {...binding,contract_hash:hashJSON(binding)};
}
