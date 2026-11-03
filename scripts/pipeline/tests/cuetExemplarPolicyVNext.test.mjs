import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCuetExemplarContractVNext,chooseCuetExemplarsVNext,numericRouteFormatVNext,CUET_EXEMPLAR_POLICY_VNEXT} from '../lib/cuetExemplarPolicyVNext.mjs';

const authenticatedExample={id:'official-1',year:2024,subject:'business_studies',question_type:'conceptual_mcq',route:'conceptual',difficulty:'medium',
  body:'Official example stem',options:['one','two','three','four'],correct_answer:'B',final_key_source_id:'key-pdf',final_key_matched:true,
  source_kind:'authentic_pyq',authentication:{independently_matched:true,option_order_checked:true}};

test('original practice works without a global authenticated comparator and keys never enter blind views',()=>{
 const q={id:'original-1',subject:'business_studies',question_type:'conceptual_mcq',provenance:{kind:'original_practice'}};
 const empty=chooseCuetExemplarsVNext(q,[]);
 assert.equal(empty.allowed,true);assert.equal(empty.required,false);assert.equal(empty.status,'no_matching_optional_comparators');
 const compared=chooseCuetExemplarsVNext(q,[authenticatedExample]);
 assert.equal(compared.policy,CUET_EXEMPLAR_POLICY_VNEXT);assert.equal(compared.allowed,true);assert.deepEqual(compared.exemplar_ids,['official-1']);
 assert.equal('correct_answer' in compared.blind_exemplars[0],false);assert.equal('final_key_source_id' in compared.blind_exemplars[0],false);
});

test('authentic and adapted PYQ provenance still require an exact authenticated anchor and matching format',()=>{
 const base={id:'adapted-1',subject:'business_studies',question_type:'conceptual_mcq',provenance:{kind:'authentic_pyq',anchor_id:'official-1'}};
 const exact=chooseCuetExemplarsVNext(base,[authenticatedExample]);assert.equal(exact.allowed,true);assert.equal(exact.required,true);
 assert.equal(chooseCuetExemplarsVNext({...base,id:'official-1',provenance:{kind:'authentic_pyq'}},[authenticatedExample]).allowed,true);
 assert.equal(chooseCuetExemplarsVNext({...base,provenance:{kind:'pyq_adapted'}},[authenticatedExample]).status,'authenticated_anchor_required');
 assert.equal(chooseCuetExemplarsVNext({...base,question_type:'matching'},[authenticatedExample]).status,'anchored_exemplar_format_mismatch');
 const invalid={...authenticatedExample,final_key_matched:false};
 assert.equal(chooseCuetExemplarsVNext(base,[invalid]).allowed,false);
});

test('numeric route and format disagreement is visible without rewriting or overriding required checks',()=>{
 const observedBusinessStudies=[
  {route:'numerical',question_type:'conceptual_mcq',body:'Which management step follows?',options:['A','B','C','D']},
  {route:'numerical',question_type:'case_application',body:'Which marketing element is illustrated?',options:['A','B','C','D']},
 ];
 for(const q of observedBusinessStudies){const audit=numericRouteFormatVNext(q);assert.equal(audit.numeric_required,true);assert.equal(audit.status,'numeric_route_non_numeric_format_review');assert.equal(audit.rewrote_metadata,false);}
 const formatOnly=numericRouteFormatVNext({route:'conceptual',question_type:'numerical_calculation',body:'Compute the value from the supplied data.'});
 assert.equal(formatOnly.numeric_required,true);assert.equal(formatOnly.status,'numeric_item_non_numeric_route_review');
 const explicit=numericRouteFormatVNext({route:'conceptual',question_type:'case_application',body:'Calculate the profit if sales are Rs. 500.',options:[]});
 assert.equal(explicit.numeric_required,true);assert.equal(explicit.status,'numeric_item_non_numeric_route_review');
 const aligned=numericRouteFormatVNext({route:'numerical',question_type:'numerical_one_step',body:'Find the ratio.'});
 assert.equal(aligned.status,'aligned');
 assert.equal(numericRouteFormatVNext({route:'conceptual',question_type:'numeric_calculation',body:'Find the value.'}).numeric_required,true);
});

test('prospective binding is deterministic and refuses missing frozen parent hashes',()=>{
 const parent='a'.repeat(64),one=bindCuetExemplarContractVNext(parent),two=bindCuetExemplarContractVNext(parent);
 assert.equal(one.contract_hash,two.contract_hash);assert.match(one.contract_hash,/^[a-f0-9]{64}$/);
 assert.notEqual(one.contract_hash,bindCuetExemplarContractVNext('b'.repeat(64)).contract_hash);
 assert.throws(()=>bindCuetExemplarContractVNext('v7'),/frozen_parent_contract_hash_required/);
});
