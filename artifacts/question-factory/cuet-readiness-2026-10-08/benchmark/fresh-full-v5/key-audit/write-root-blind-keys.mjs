// Independent first pass from blind-review-packet + exact blind source pack only.
// No import or read of the author oracle, frozen fixtures, cases, or builder.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=here+'/..';
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const packet=read(root+'/blind-review-packet.json'),sources=read(root+'/blind-source-excerpts.json');
const solutions=[
 ['A','The supplied partnership definition describes two or more persons establishing business and sharing profits.','unidentified_excerpt'],
 ['C','The supplied page says loan interest is 12%; 20000×.12=2400. This cannot certify an academic key: the numbered statement appears to be an unkeyed true/false exercise and the usual silent-deed rule is 6%.','exercise_statement_not_a_verified_rule'],
 ['A','Persons are partners, they establish a business and share profits.','matching_lists_incomplete'],
 ['C','Both propositions occur in the definition.','unprinted_excerpt'],
 ['A','The source expressly says the incoming share comes from old partners.'],
 ['A','Old-ratio sacrifices are (1/5)(3/5)=3/25 and (1/5)(2/5)=2/25.'],
 ['B','Admission is a new partner joining and taking a share from old partners.','matching_lists_incomplete'],
 ['C','The source establishes both acquisition from and sacrifice by existing partners.'],
 ['A','The Memorandum authorises the maximum share-capital issue.'],
 ['C','12−9=3 lakh remains within the stated unchanged authorised capital.'],
 ['B','The corresponding definition is maximum authorised issue specified in the Memorandum.','direct_question_labelled_matching'],
 ['B','Under the stated unchanged capital limit, only statement 2 is true.'],
 ['A','The source example computes average collection period from receivables turnover.','unprinted_example'],
 ['B','365/5=73 days; the 365-day convention is explicit.'],
 ['A','The cited formula is 365 divided by trade receivables turnover.','direct_question_labelled_matching'],
 ['A','365/10=36.5, not 365×10.'],
 ['A','A single-use plan is for a one-time non-recurring event.'],
 ['A','A one-day non-recurring seminar fits a single-use plan.','unidentified_cited_example'],
 ['B','The defined use is a one-time non-recurring event or project.','direct_question_labelled_matching'],
 ['A','Statement 1 is supported; statement 2 contradicts non-recurring use.'],
 ['A','Organising groups activities and establishes authority relationships.','unidentified_source_reference'],
 ['C','The source lists identification/division, departmentalisation, duties and reporting: four.','unprinted_process'],
 ['B','Departmentalisation is second; assigning duties is third in organising.','process_not_named'],
 ['B','The organising sequence after division is departmentalisation, duties, reporting.','process_not_named'],
 ['A','The excerpt defines directing through five actions toward organisational objectives.'],
 ['C','Instructing, guiding, counselling, motivating and leading are five.','unprinted_description'],
 ['A','Directing aims at organisational objectives.','direct_question_labelled_matching'],
 ['A','Motivation and leadership are included, and the source denies communication-only scope.'],
 ['A','Place/physical distribution makes products available to target customers.'],
 ['B','3 dealer-region placements per region×4 regions=12.','arithmetic_without_business_studies_construct'],
 ['A','Selecting distribution intermediaries is a place decision.','direct_question_labelled_matching'],
 ['A','Dealer selection is part of place; place is not pricing.','unprinted_excerpt'],
 ['A','The supplied NCERT money description includes cash and bank deposits.','unprinted_excerpt'],
 ['C','4000+6000=10000 within the cash/deposit description.','unprinted_excerpt'],
 ['A','The source names the central bank and commercial banking system.','direct_question_labelled_matching'],
 ['C','The source includes both bank deposits and commercial banks.','unidentified_system'],
 ['A','The last column of the supplied table tracks final-goods output/income increments.','unprinted_table'],
 ['C','1/(1−.8)=5; both the formula and two-sector scope are stated.'],
 ['A','The stated output increments equal the income increments in the NCERT account.','unprinted_source_and_direct_question_labelled_matching'],
 ['A','The source links final-goods output to income, not tax revenue.','unprinted_passage'],
 ['A','The supplied paragraph defines primary deficit as fiscal deficit less interest payments.'],
 ['A','Under the stated textbook formula 90−25=65 crore. The same excerpt distinguishes net interest liabilities; clarify that receipts are absent or that 25 is net.','net_interest_clarity'],
 ['A','The paragraph explicitly identifies present fiscal imbalances as the focus.','unprinted_source_and_direct_question_labelled_matching'],
 ['C','Subtracting interest from fiscal deficit yields primary deficit.'],
 ['A','Market demand and supply determine the flexible exchange rate.'],
 ['A','A demand shift under a flexible rate with unchanged supply can change the rate.'],
 ['A','Flexible is also called floating exchange rate.','direct_question_labelled_matching'],
 ['C','The excerpt establishes both demand/supply determination and the floating synonym.'],
 ['A','The passage explicitly uses late returns per one hundred loans.'],
 ['A','Both branch rates declined (14→10 and 12→9).'],
 ['A','The branches served different reader counts, so raw totals are not comparable.'],
 ['A','The report expressly notes non-random reader assignment.'],
 ['A','The printed passage says the indicator light remained on.'],
 ['A','The technician specifies power lead, volume control, speaker wire in that order.'],
 ['A','The notebook allows the next student to repeat the checks.'],
 ['A','The notebook entry is the useful thing left behind.'],
 ['A','The caretaker first places the chair beneath the neem tree.'],
 ['A','The voices continue indoors and the same song is heard from the corridor.'],
 ['A','Chair outside precedes wind/leaves, moving it inside, then the child follows the song.'],
 ['A','Threaded means the song and cup sounds were heard together.'],
 ['A','The numerical results identify the combined name/date label at 18/20.','inconsistent_label_design_description'],
 ['A','The last sentence chooses the combined label.','inconsistent_label_design_description'],
 ['A','The limitation is one collection and one month.','inconsistent_label_design_description'],
 ['A','18−15=3 additional successful checks.','inconsistent_label_design_description']
];
if(packet.items.length!==64||solutions.length!==64)throw Error('blind_key_denominator_mismatch');
const output={review_mode:'blind-first-pass-before-programmatic-unblind',reviewer:'root assistant; independent from benchmark-author Luna subagent',at:new Date().toISOString(),input_hashes:{packet:sha(root+'/blind-review-packet.json'),sources:sha(root+'/blind-source-excerpts.json')},oracle_read_before_first_pass:false,paid_calls:0,keys:packet.items.map((q,i)=>({id:q.id,key:solutions[i][0],proof:solutions[i][1],review_flags:solutions[i][2]?[solutions[i][2]]:[],source_refs:q.source_refs}))};
mkdirSync(here,{recursive:true});
writeFileSync(here+'/independent-keys.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
writeFileSync(here+'/first-pass-proof.json',JSON.stringify({at:output.at,sha256:sha(here+'/independent-keys.json'),oracle_not_read:true,records:64},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({records:64,flags:output.keys.filter(k=>k.review_flags.length).length,sha256:sha(here+'/independent-keys.json'),oracle_read:false}));
