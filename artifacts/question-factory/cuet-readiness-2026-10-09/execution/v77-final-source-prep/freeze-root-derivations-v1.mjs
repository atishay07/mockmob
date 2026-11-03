import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const prep='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep';
const raw=readFileSync(prep+'/blind-review-packet-v1.json'),p=JSON.parse(raw),sha=x=>createHash('sha256').update(x).digest('hex');
const rows=[
['A',true,'Two months from acquisition satisfies the normally three-month maturity test, with convertibility and insignificant value risk stated. Other options fail the described nature/maturity.'],
['B',false,'Customer receipts are operating by the quoted rule. Machine disposal would be investing but that decisive principle is absent from this case excerpt; add verified investing excerpt before construction completion.'],
['B',true,'The excerpt states cash inflows/outflows under operating, investing and financing as the primary objective. Profit-only/year-end-only and replacement claims do not express that objective.'],
['B',true,'Cash payment for a multi-year delivery van is acquisition of a fixed asset, explicitly classified as investing by the excerpt.'],
['A',true,'Identifying workforce requirements followed by recruitment and selection is the stated staffing process.'],
['A',true,'Updating skills and preparing for higher responsibilities directly matches training and development.'],
['A',true,'Obtaining relief when the product falls short is expressly seek-redressal in the supplied source.'],
['A',true,'The opportunity to present a complaint is expressly the right to be heard.'],
['A',true,'Marginal utility of the fifth unit equals 30 minus28 =2 under the supplied change-in-total-utility definition.'],
['A',true,'Ranking without numerical measurement is the stated ordinal approach.'],
['A',true,'Same-curve bundles are indifferent by the supplied interpretation. Equal price or identical quantities are not entailed by indifference; the question asks what this interpretation says.'],
['A',true,'The excerpt explicitly allows utility to change with place and time. A room heater in summer versus winter instantiates that principle.'],
['A',false,'Ledger normally means written record book, but this passage question has no passage/excerpt, so its required contextual source evidence is missing.'],
['',false,'No library passage is supplied; why Mira moves and records the box cannot be derived from stem/options.'],
['',false,'No ferry passage is supplied for this case; the cause of cancelling noon crossing cannot be established. Another case contains a ferry passage but may not be silently attached.'],
['',false,'No orchard passage is supplied; the purpose of Leela list is not independently answerable.'],
['A',false,'Customer cash is operating; machine disposal should be investing, but the investing principle is absent from this case source evidence.'],
['',false,'Short term/low risk alone does not establish the normally three-month acquisition maturity, known cash amount and insignificant value risk. Yes can hold for some investments, no for others; equity/over-one-year clauses do not resolve the missing facts.'],
['A',true,'The stem explicitly calls both transactions operating. Net =12000 minus4500 =7500. No unstated transaction status is imported.'],
['A',true,'Identifying requirements, recruitment, selection and placement match the staffing definition.'],
['AB',true,'The stem asks both complaint/hearing and relief. A fits hearing; B fits relief using the redressal quote supplied elsewhere in this same blind packet. Two defensible rights; no single correct answer.'],
['A',false,'Causal forest is plausibly the advanced causal method, but the supplied staffing excerpt cannot establish this key and the named specialist method has no stated CUET entitlement.'],
['A',true,'Marginal utility =30 minus28 =2.'],
['',false,'The stated diminishing-MU law assumes other commodities consumption held constant. The stem does not establish that model, and asks what must follow; unconditional decline is not justified.'],
['B',true,'Ranking without numerical measurement is ordinal utility by the excerpt.'],
['A',true,'The workshop passage explicitly requests comparing second-hand movement with escapement sound.'],
['A',true,'Fresh date means newly/recently written in the daily updating context, rather than temperature or damage.'],
['A',false,'Mandative subjunctive uses base form be after recommended that. The passage offers no grammar-rule evidence and the supplied English syllabus excerpt concerns narrative comprehension, not this specialist rule.']
];
if(rows.length!==p.cases.length)throw Error('case_count');
const result={at:new Date().toISOString(),packet_sha256:sha(raw),proposed_keys_or_private_labels_seen:false,other_reviewer_derivations_seen:false,scope:'Independent root derivation from blind packet only before proposed answers/labels. Evidence sufficiency is case-local; no hidden passage import.',cases:p.cases.map((c,i)=>({id:c.id,proposed_keys:rows[i][0].split(''),unique_answer:rows[i][0].length===1,source_evidence_sufficient:rows[i][1],derivation:rows[i][2]}))};
const body=JSON.stringify(result,null,2)+'\n';writeFileSync(prep+'/root-derivations-v1-PRIVATE.json',body,{flag:'wx'});writeFileSync(prep+'/root-derivations-v1-PRIVATE.json.sha256',sha(body)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:result.cases.length,packet_sha256:result.packet_sha256,derivations_sha256:sha(body),frozen_before_proposed_answers:true}));
