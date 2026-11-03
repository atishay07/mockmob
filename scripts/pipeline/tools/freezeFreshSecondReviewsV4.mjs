// Freeze every raw independent first pass before opening candidate marking schemes.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-2024-25-source-keys-v4');
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=readFileSync(join(root,'independent-second-review-packet.json')),packet=JSON.parse(bytes);
const names=['independent-english-first-pass.json','independent-accountancy-first-pass.json','independent-business-economics-first-pass.json'];
const reviews=names.map(name=>{const body=readFileSync(join(root,name)),d=JSON.parse(body),input=d.review_input_sha256||d.input_sha256_full_bytes||d.input_packet_sha256;
 if(input?.toLowerCase()!==sha(bytes)||d.official_keys_seen!==false||d.first_solver_decisions_seen!==false||d.validator_results_seen!==false)throw Error('answer_blind_first_pass_required:'+name);
 return {path:join(root,name),sha256:sha(body),records:d.items||d.records,reported_metadata:{at:d.at,reviewer_model:d.reviewer_model,effort:d.effort}};
});
const ids=reviews.flatMap(r=>r.records.map(i=>i.item_id));
if(ids.length!==32||new Set(ids).size!==32||packet.items.some(i=>!ids.includes(i.item_id)))throw Error('all_32_raw_first_passes_required');
const target=join(root,'SECOND-REVIEW-FREEZE.json');if(existsSync(target))throw Error('immutable_second_review_freeze_exists');
const record={schema:'all-raw-independent-first-passes-frozen-v4',frozen_at:new Date().toISOString(),raw_denominator:32,input_packet_sha256:sha(bytes),contract_binding:packet.contract_binding,
 first_derivation_freeze_sha256:sha(readFileSync(join(root,'FIRST-DERIVATION-FREEZE.json'))),reviews:reviews.map(({records,...r})=>({...r,raw_records:records.length})),
 official_candidate_marking_schemes_read:false,paid_CUET_validator_results_seen:false,publication:false,
 actual_dispatch_metadata:{english:{model:'gpt-6-luna',reasoning_effort:'medium'},accountancy:{model:'gpt-6-luna',reasoning_effort:'high'},business_economics:{model:'gpt-6-luna',reasoning_effort:'high'}},
 record_integrity_disclosures:[
 'Agent-reported model names do not match the dispatch model; actual dispatch settings are separately recorded without changing the frozen reviews.',
 'Accountancy reported at=12:00Z even though review completion was received around 11:07Z; that timestamp is not accepted as custody time. This freeze uses the local clock.',
 'Accountancy Q6 includes a wrong intermediate forfeiture claim before a correct final derivation. Preserve the record and exclude Q6 from positive release controls; no overwrite or substitute first pass.',
 'An automatic approval reviewer rejected rewriting the frozen Accountancy first pass and prohibited a workaround. The original bytes are retained.'
 ],positive_control_additional_exclusions:[{id:'cbse24-ac-q06',reason:'independent first-pass record has an erroneous intermediate assertion; preserved as held construction evidence'}],
 limitation:'Independent source solves and official-key comparison are not proof of perfect accuracy. All raw exclusions remain in construction accounting.'};
writeFileSync(target,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:target,sha256:sha(readFileSync(target)),raw_denominator:32,official_keys_read:false,paid_calls:0}));
