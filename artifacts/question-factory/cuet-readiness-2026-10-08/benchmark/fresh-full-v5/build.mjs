import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import registry from '../../../../../data/source_registry.json' with {type:'json'};
import {expectedReleaseBinding,REQUIRED_SUBJECTS} from '../../../../../scripts/pipeline/lib/releaseEvidenceV7.mjs';
import {hashJSON,FACTORY_POLICY} from '../../../../../data/question_factory_policy.mjs';
import {getCanonicalChapters} from '../../../../../data/canonical_syllabus.js';

const out=resolve(dirname(fileURLToPath(import.meta.url))), sha=x=>createHash('sha256').update(x).digest('hex');
const topics=[
['accountancy','Partnership Fundamentals','ncert-leac101','pdf-page-1','Accounting for partnership firms has it’s own peculiarities, as the partnership firm comes into existence when two or more persons come together to establish business and share its profits.',
[
['Which description is supported?',['Two or more persons establish a business and share profits','A company issues shares to creditors','One person operates a corporation','Partners receive a fixed dividend'],'A','The excerpt describes two or more persons establishing a business and sharing its profits.','conceptual','direct_recall'],
['The deed is silent; a partner loan is ₹20,000 for one full year. Using the stated default rate, interest due is:',['₹1,200','₹2,000','₹2,400','₹12,000'],'C','The cited partnership rule states 12% per annum on a partner loan when the deed is silent; ₹20,000 × 12% = ₹2,400.','numerical','numerical_mcq'],
['Match: (A) multiple persons (B) business (C) profit.',['A—partners; B—establish; C—share','A—creditors; B—lend; C—interest','A—directors; B—issue; C—capital','A—one owner; B—public issue; C—dividend'],'A','The passage connects partners to establishing business and sharing profits.','conceptual','matching'],
['(1) The excerpt describes two or more persons. (2) It includes sharing profits. Which are supported?',['Only 1','Only 2','Both 1 and 2','Neither'],'C','Both statements restate the excerpt.','conceptual','statement_mcq']]],
['accountancy','Change in Profit Sharing Ratio','ncert-leac102','span-72d2f4711e2e','When new partner is admitted he acquires his share in profits from the old partners. In other words, on the admission of a new partner, the old partners sacrifice a share of their profit in favour of the new partner.',
[
['From whom does an incoming partner acquire a profit share?',['The old partners','The creditors','The registrar','The customers'],'A','The excerpt says the incoming partner acquires the share from the old partners.','conceptual','direct_recall'],
['A and B share 3:2. A newcomer receives 1/5 from them in their old ratio. Their respective sacrifices are:',['3/25 and 2/25','1/5 and 1/5','2/25 and 3/25','3/5 and 2/5'],'A','A gives 3/5 × 1/5 = 3/25 and B gives 2/5 × 1/5 = 2/25.','numerical','numerical_mcq'],
['Match admission with its stated effect.',['A—old partners gain; share—from creditors','A—new partner joins; share—from old partners','A—firm dissolves; share—from customers','A—shares issue; share—from reserves'],'B','The source links admission with a new partner acquiring a profit share from old partners.','conceptual','matching'],
['(1) The new share comes from existing partners. (2) Existing partners sacrifice a share for the newcomer.',['Only 1','Only 2','Both 1 and 2','Neither'],'C','Both statements follow from the cited excerpt.','conceptual','statement_mcq']]],
['accountancy','Share Capital','ncert-leac201','pdf-page-4','Authorised capital is the amount of share capital which a company is authorised to issue by its Memorandum of Association. The company cannot raise more than the amount of capital as specified in the Memorandum of Association.',
[
['Which defines authorised capital?',['Capital authorised for issue by the Memorandum','Capital actually received on calls','Money refunded to applicants','Profit transferred to reserve'],'A','The excerpt defines authorised capital by reference to the company’s Memorandum.','conceptual','direct_recall'],
['Authorised capital is ₹12 lakh and ₹9 lakh has been issued. Maximum additional issue without changing it?',['₹1 lakh','₹2 lakh','₹3 lakh','₹21 lakh'],'C','₹12 lakh − ₹9 lakh = ₹3 lakh; the source caps issue at the authorised amount.','numerical','numerical_mcq'],
['Match the term with the evidence: authorised capital.',['Amount paid up','Maximum authorised issue specified by Memorandum','Bank balance','Unissued profit'],'B','The cited definition ties the authorised amount to the Memorandum.','conceptual','matching'],
['(1) A company may raise more than the amount in its Memorandum. (2) Authorised capital concerns the amount it may issue.',['Only 1','Only 2','Both','Neither'],'B','The excerpt expressly caps the amount at what the Memorandum specifies.','conceptual','statement_mcq']]],
['accountancy','Accounting Ratios','ncert-leac205','pdf-page-27','Average Collection Period = 365 Trade Receivables Turnover Ratio = 365 8.18 = 45 days',
[
['The example converts receivables turnover into which measure?',['Average collection period','Current ratio','Debt-equity ratio','Inventory value'],'A','The excerpt labels 365 divided by turnover as average collection period.','conceptual','direct_recall'],
['Trade receivables turnover is 5 times. Using the cited 365-day convention, collection period is:',['5 days','73 days','365 days','1,825 days'],'B','Average collection period = 365 ÷ 5 = 73 days.','numerical','numerical_mcq'],
['Match 365 ÷ trade receivables turnover ratio to:',['Average collection period','Gross profit ratio','Working capital','Current assets'],'A','The cited worked example gives this relationship.','conceptual','matching'],
['(1) At turnover 10, the formula gives 36.5 days. (2) The formula multiplies 365 by turnover.',['Only 1','Only 2','Both','Neither'],'A','365 ÷ 10 = 36.5; the cited relationship is division.','numerical','statement_mcq']]],
['business_studies','Planning','ncert-lebs104-focused-v1','definition','not likely to be repeated in future',
[
['A one-time event unlikely to recur uses a:',['Single-use plan','Standing plan','Organisation chart','Chain of command'],'A','The excerpt defines a single-use plan for a one-time, non-recurring situation.','conceptual','direct_recall'],
['A college plans one seminar on one day. Which plan type fits the cited example?',['Single-use plan','Standing plan','Permanent structure','No plan'],'A','The cited source gives organising a one-day seminar as a single-use-plan example.','conceptual','case_application'],
['Match single-use plan with its use.',['Repeated routine','One-time non-recurring event or project','Permanent authority relationship','Daily supervision'],'B','The source characterises these plans as one-time and non-recurring.','conceptual','matching'],
['(1) A one-time seminar may use a single-use plan. (2) Such plans are expected to recur routinely.',['Only 1','Only 2','Both','Neither'],'A','The source gives a one-day seminar example and says the plan is not likely to recur.','conceptual','statement_mcq']]],
['business_studies','Organising','ncert-lebs105','pdf-page-27','Assignment of Duties',
[
['Which is part of the source definition of organising?',['Grouping activities and establishing authority relationships','Issuing currency','Preparing a cash flow statement','Setting exchange rates'],'A','The excerpt defines organising through grouping activities and establishing authority relationships.','conceptual','direct_recall'],
['How many steps are listed in the cited process?',['Two','Three','Four','Five'],'C','The source lists four steps.','numerical','counting_mcq'],
['Departmentalisation and assignment of duties occur in which positions?',['1st and 2nd','2nd and 3rd','3rd and 4th','4th and 1st'],'B','The cited sequence places departmentalisation second and assignment of duties third.','conceptual','matching'],
['After identification and division of work, select the remaining order.',['Duties → departmentalisation → reporting','Departmentalisation → duties → reporting','Reporting → duties → departmentalisation','Departmentalisation → reporting → duties'],'B','The source orders departmentalisation, assignment of duties, then reporting relationships.','conceptual','ordering_mcq']]],
['business_studies','Directing','ncert-lebs107','normative-a72a9103340a296e','directing refers to the process of instructing, guiding, counselling, motivating and leading people in the organisation to achieve its objectives.',
[
['Which description best matches directing?',['Instructing, guiding, counselling, motivating and leading toward objectives','Only recording transactions','Only issuing shares','Classifying receipts'],'A','The cited excerpt lists these elements of directing.','conceptual','direct_recall'],
['How many action words are listed in the first description?',['Three','Four','Five','Six'],'C','The list contains five actions.','numerical','counting_mcq'],
['Match: directing is more than communication; directing links to:',['Organisational objectives','Only bank deposits','Share forfeiture','Foreign trade'],'A','The cited excerpt says directing encompasses more than communication and aims at organisational objectives.','conceptual','matching'],
['(1) Motivation and leadership are included. (2) Directing is limited to communication alone.',['Only 1','Only 2','Both','Neither'],'A','The source names motivation and leadership and says directing is not merely communication.','conceptual','statement_mcq']]],
['business_studies','Marketing Management','ncert-lebs202','pdf-page-15','selection of dealers or intermediaries to reach the customers',
[
['Which element covers making products available to target customers?',['Place','Product','Promotion','Packaging'],'A','The excerpt defines place as activities making products available to target customers.','conceptual','direct_recall'],
['A firm selects 3 dealers in each of 4 regions. How many dealer-region placements?',['7','12','16','34'],'B','3 × 4 = 12 placements; the cited source supports dealer selection as a place decision.','numerical','numerical_mcq'],
['Selecting intermediaries to reach buyers is a decision about:',['Place','Promotion','Product','Price'],'A','The excerpt explicitly includes dealer or intermediary selection in physical distribution.','conceptual','matching'],
['(1) Place decisions can include selecting dealers. (2) The excerpt defines place as setting price.',['Only 1','Only 2','Both','Neither'],'A','Dealer selection is named; setting price is not the cited definition of place.','conceptual','statement_mcq']]],
['economics','Money & Banking','ncert-leec103','pdf-page-3','In a modern economy, money comprises cash and bank deposits.',
[
['Which pair comprises money in the excerpt?',['Cash and bank deposits','Shares and debentures','Taxes and subsidies','Exports and imports'],'A','The source says money comprises cash and bank deposits.','conceptual','direct_recall'],
['A household holds ₹4,000 cash and ₹6,000 in deposits. Total under the excerpt’s description?',['₹2,000','₹6,000','₹10,000','₹24,000'],'C','₹4,000 + ₹6,000 = ₹10,000.','numerical','numerical_mcq'],
['Which institutions are named in the money-creation system?',['Central bank and commercial banking system','Only firms','Only households','Stock exchange and insurers'],'A','The source names the central bank and commercial banking system.','conceptual','matching'],
['(1) Deposits are included in money. (2) The described system includes commercial banks.',['Only 1','Only 2','Both','Neither'],'C','Both statements are explicit in the cited excerpt.','conceptual','statement_mcq']]],
['economics','Income Determination','ncert-leec104','pdf-page-10','The last column measures the increments in the value of the output of final goods (and hence the income of the economy) in each round.',
[
['What does the cited table’s last column measure?',['Output increments of final goods and hence income each round','Only tax receipts','Only imports','Currency stock'],'A','The excerpt identifies the last column as output increments and hence income.','conceptual','direct_recall'],
['In a two-sector model MPC is 0.8. Using k = 1/(1−MPC), k equals:',['2','4','5','8'],'C','1/(1−0.8) = 5.','numerical','numerical_mcq'],
['Match the source’s relationship: final-goods output increment and income increment.',['Equal in value in the stated account','Unrelated','Only imports count','Only taxes count'],'A','The passage says the output value is hence the income of the economy.','conceptual','matching'],
['(1) The cited passage links final-goods output with income. (2) It defines the last column as tax revenue.',['Only 1','Only 2','Both','Neither'],'A','The source states the output-income link; it does not define the column as tax revenue.','conceptual','statement_mcq']]],
['economics','Government Budget & the Economy','ncert-leec105-focused-v1','definition','The goal of measuring primary deficit is to focus on present fiscal imbalances.',
[
['How is primary deficit calculated?',['Fiscal deficit minus interest payments','Fiscal deficit plus interest payments','Revenue receipts minus capital receipts','Exports minus imports'],'A','The cited source gives fiscal deficit minus interest payments.','conceptual','direct_recall'],
['Fiscal deficit is ₹90 crore and interest payments are ₹25 crore. Primary deficit?',['₹65 crore','₹90 crore','₹115 crore','₹3,600 crore'],'A','₹90 crore − ₹25 crore = ₹65 crore.','numerical','numerical_mcq'],
['The stated focus of primary deficit is:',['Present fiscal imbalances','Dealer selection','Cash only','Exports only'],'A','The excerpt says it focuses on present fiscal imbalances.','conceptual','matching'],
['(1) Interest payments are subtracted from fiscal deficit. (2) The result is primary deficit.',['Only 1','Only 2','Both','Neither'],'C','Both statements follow from the cited formula.','conceptual','statement_mcq']]],
['economics','Balance of Payments','ncert-leec106','pdf-page-8','This exchange rate is determined by the market forces of demand and supply.',
[
['What determines a flexible exchange rate according to the excerpt?',['Market demand and supply','A fixed legal ratio only','Company share capital','Tax receipts only'],'A','The source says flexible rates are determined by market demand and supply.','conceptual','direct_recall'],
['Demand for foreign currency rises while supply is unchanged. What follows from the cited principle?',['The market-determined rate can change','The rate must remain fixed','The current account becomes zero','No market effect is possible'],'A','The excerpt says rate is determined by demand and supply; changing demand can change the market-determined rate, though its direction is not supplied here.','conceptual','case_application'],
['Flexible exchange rate is also called:',['Floating exchange rate','Primary deficit','Authorised capital','Single-use plan'],'A','The excerpt gives floating exchange rate as the alternate name.','conceptual','matching'],
['(1) Demand and supply determine the rate. (2) Flexible rate is also called floating rate.',['Only 1','Only 2','Both','Neither'],'C','Both are explicit in the excerpt.','conceptual','statement_mcq']]
]];
const passages=[
['Factual Passage','A district library tested two ways to remind readers about book returns. At one branch, a notice was placed beside the exit. At another, readers received a printed reminder at checkout. Over four weeks, staff recorded late returns, but the branches served different numbers of readers. The library compared late returns per one hundred loans rather than raw totals. The exit-notice branch moved from 14 to 10 late returns per hundred loans; the checkout-reminder branch moved from 12 to 9. The staff report described a decline at both sites and noted that readers were not randomly assigned to branches.'],
['Narrative Passage','When the school radio stopped working, Kavya carried it to the repair room. She noted that the indicator light remained on while the speaker was silent. The technician asked her to test one connection at a time: first the power lead, then the volume control, and finally the speaker wire. The loose speaker wire was the cause. Kavya tightened it and tested the radio again. She added the sequence to the room’s repair notebook so the next student could repeat the checks. The radio worked, but the notebook became the part she was most pleased to leave behind.'],
['Literary Passage','At dusk, the courtyard filled with the sound of chairs being moved. The caretaker placed one beneath the neem tree, then carried it inside when the wind lifted the first dry leaves. A child asked why the gathering had to end. He pointed to the open windows: the voices had not vanished; they had travelled indoors. From the corridor came the same song, softer now, threaded with the clink of cups. The child folded the paper invitation in her pocket and followed the sound. Outside, the tree kept its quiet place in the dark.'],
['Factual Passage','A student group compared three labels for its seed collection. One showed only the plant name, another added the sowing date, and a third recorded both. During the next month, members checked whether each label helped identify the correct tray without opening the seed log. The combined label succeeded in 18 of 20 checks, the date-only label in 11, and the name-only label in 15. The group cautioned that the small trial covered only its own collection and one month. It chose the combined label for the next planting cycle.']
];
const pqs=[
[['Which measure did the library use?',['Late returns per one hundred loans','Raw readers','Staff per branch','Reminders printed'],'A','Different branch readership led the library to compare late returns per one hundred loans.','direct'],
['Which result is supported?',['Both branches had fewer late returns per hundred loans at the end','Only exit notice improved','Branches served equal readers','Readers were randomly assigned'],'A','The passage reports 14 to 10 and 12 to 9 and says assignment was not random.','statement'],
['Why avoid raw totals?',['Branches served different reader counts','No late returns were recorded','One branch had no loans','Trial lasted one day'],'A','The passage says branches served different numbers of readers.','inference'],
['Which limitation was reported?',['Readers were not randomly assigned','No returns were recorded','No comparison measure was used','Only one method was tested'],'A','The passage identifies lack of random assignment.','detail']],
[['What remained on while the speaker was silent?',['Indicator light','Notebook','Volume control','School bell'],'A','The passage says the indicator light remained on.','detail'],
['What was the order of checks?',['Power lead, volume control, speaker wire','Speaker wire, power lead, volume control','Volume control, speaker wire, power lead','Power lead, speaker wire, volume control'],'A','The passage gives this exact order.','order'],
['Why record the sequence?',['So the next student could repeat checks','To record the radio price','To replace the technician','To show repair was impossible'],'A','Kavya wanted the next student to repeat the checks.','inference'],
['What does “leave behind” refer to?',['The notebook entry','The broken radio','The loose wire','A room key'],'A','The notebook is named as what she was most pleased to leave behind.','vocabulary_in_context']],
[['Where was the chair first placed?',['Beneath the neem tree','In the corridor','By the cups','At the gate'],'A','The passage states this in its opening sentence.','detail'],
['What does “voices had travelled indoors” mean?',['The gathering continued inside','The song stopped','The chairs disappeared','The tree moved indoors'],'A','The child hears the same song in the corridor and follows it.','inference'],
['Select the reported sequence.',['Chair outside; wind lifts leaves; chair inside; child follows song','Child follows song; chair outside; cups removed','Wind lifts leaves; song stops; child leaves','Invitation folded; tree moved; gathering begins'],'A','This follows the passage’s stated sequence.','order'],
['“Threaded with the clink of cups” suggests:',['Song and cup sounds were heard together','Cups were made of thread','Song was replaced by silence','Child was outside'],'A','The passage describes cup sounds alongside the softer song.','vocabulary_in_context']],
[['Which label passed most checks?',['Name and sowing date','Date only','Plant name only','Seed log alone'],'A','The combined label passed 18 checks, more than 11 or 15.','detail'],
['What did the group choose next?',['Combined label','Date-only label','Name-only label','No labels'],'A','The passage says it chose the combined label.','detail'],
['Which limitation did the group mention?',['One collection and one month','No labels tested','Several years of data','Every seed collection'],'A','The trial covered only its own collection and one month.','statement'],
['How many more checks did the combined label pass than the name-only label?',['3','7','11','18'],'A','18 − 15 = 3.','numerical']]
];

const overlay={sources:{},packs:{},families:{}}, candidates=[];
function sourceRef(id,loc,original=false,allowSyllabus=false){
 const s=original?overlay.sources[id]:registry.sources[id],f=s?.facts?.[loc];
 if(!s||(!original&&!(s.kind==='reference'||allowSyllabus&&s.kind==='syllabus')||(!original&&s.state!=='active')||(!original&&s.reuse_permitted!==true))||!f?.text)throw Error('source_missing_or_unavailable:'+id+':'+loc);
 return {id,version:s.version,locator:loc,support_hash:s.supports[loc]};
}
function add({id,subject,chapter,body,options,key,explanation,route,type,passage='',refs}){
 candidates.push({id,subject,chapter,concept_id:null,body,options:options.map((text,i)=>({key:'ABCD'[i],text})),correct_answer:key,explanation,route,difficulty:'medium',question_type:type,passage_text:passage,family_id:'fresh-full-v5-family-'+id,source_refs:refs,provenance:{kind:'original_practice',anchor_id:null,adaptation_family:null,adaptation_type:null,syllabus_version:registry.exam_specs[subject].syllabus_version,pattern_version:registry.exam_specs[subject].pattern_version,source_pack_id:'fresh-full-v5-'+subject+'-overlay',source_pack_version:1}});
}
for(const t of topics){
 const [subject,chapter,sid,loc,quote,items]=t;
 if(!getCanonicalChapters(subject).includes(chapter))throw Error('chapter_not_entitled:'+subject+':'+chapter);
 if(!registry.sources[sid]?.facts?.[loc]?.text?.includes(quote))throw Error('quote_not_in_current_registry:'+sid+':'+loc);
 items.forEach((x,i)=>{const [body,options,key,explanation,route,type]=x;const refs=[sourceRef(sid,loc)];if(subject==='accountancy'&&chapter==='Partnership Fundamentals'&&i===1)refs.push(sourceRef('ncert-leac101','pdf-page-5'));add({id:'fresh-v5-'+subject+'-'+chapter.toLowerCase().replace(/[^a-z]+/g,'-')+'-'+(i+1),subject,chapter,body,options,key,explanation,route,type,refs});});
}
const englishSyllabus=sourceRef('cuet2026-english-syllabus','full-syllabus',false,true);
for(let i=0;i<passages.length;i++){
 const [chapter,text]=passages[i],id='fresh-full-v5-en-passage-'+(i+1),support=hashJSON(text);
 if(text.trim().split(/\s+/).length>300)throw Error('passage_over_300_words');
 overlay.sources[id]={id,kind:'reference',state:'active',version:1,chapters:[chapter],url:'local://fresh-full-v5/'+id,title:'Original benchmark passage',identity_sha256:sha(text),extraction_sha256:sha(text),extraction_checked:true,reuse_permitted:true,permission:{basis:'Original passage written for this benchmark',reference:'fresh-full-v5/build.mjs'},facts:{stimulus:{text}},supports:{stimulus:support},source_pack_id:'fresh-full-v5-english-overlay'};
 for(let j=0;j<4;j++){const [body,options,key,explanation,qtype]=pqs[i][j];add({id:'fresh-v5-english-'+(i+1)+'-'+(j+1),subject:'english',chapter,body,options,key,explanation,route:'passage',type:'passage_'+qtype,passage:text,refs:[sourceRef(id,'stimulus',true),englishSyllabus]});}
}
if(candidates.length!==64)throw Error('valid_root_count:'+candidates.length);

const categoryCycle=['wrong_key','overlapping_options','unsupported_explanation','missing_assumptions','out_of_syllabus','numeric_fault','wrong_key','overlapping_options'], defects=[];
for(const subject of REQUIRED_SUBJECTS){
 const roots=candidates.filter(c=>c.subject===subject);
 for(let i=0;i<8;i++){
  const category=categoryCycle[i];let base;
  if(category==='numeric_fault')base=roots.find(x=>x.question_type.includes('numerical')&&(/[0-9]/.test(x.body)||/[0-9]/.test(x.passage_text)))||roots.find(x=>x.route==='numerical'&&/[0-9]/.test(x.body))||roots[0];
  else if(category==='missing_assumptions')base=subject==='business_studies'?roots.find(x=>x.body.includes('one seminar on one day')):subject==='economics'?roots.find(x=>x.body.includes('supply is unchanged')):subject==='english'?roots.find(x=>x.id==='fresh-v5-english-1-2'):roots.find(x=>x.route==='numerical'&&x.question_type==='numerical_mcq')||roots[0];
  else base=roots[(i*2)%roots.length];
  base ||= roots[0];const c=structuredClone(base);
  c.id=base.id+'--defect-'+category+'-'+(i+1);c.family_id='fresh-full-v5-family-'+c.id;
  const mutation={category,derived_from:base.id};
  if(category==='wrong_key'){c.correct_answer='ABCD'[('ABCD'.indexOf(c.correct_answer)+1)%4];mutation.operation='change_proposed_key';}
  let overlapTarget=null;
  if(category==='overlapping_options'){const keyIndex='ABCD'.indexOf(base.correct_answer);overlapTarget=keyIndex===3?2:3;c.options[overlapTarget].text=c.options[keyIndex].text;mutation.operation='duplicate_keyed_option_into_distractor';mutation.duplicate_option='ABCD'[overlapTarget];}
  if(category==='unsupported_explanation'){c.explanation+=' The source also proves this always increases national welfare.';mutation.operation='append_unentailed_claim';}
  if(category==='missing_assumptions'){
   if(c.body.includes('The deed is silent;'))c.body=c.body.replace('The deed is silent; ','');
   else if(c.body.includes('in their old ratio'))c.body=c.body.replace('in their old ratio','');
   else if(c.body.includes('without changing authorised capital'))c.body=c.body.replace('without changing authorised capital','');
   else if(c.body.includes('Using the cited 365-day convention'))c.body=c.body.replace('Using the cited 365-day convention, ','');
   else if(c.body.includes('one seminar on one day'))c.body=c.body.replace('one seminar on one day','an event');
   else if(c.body.includes('supply is unchanged'))c.body=c.body.replace('while supply is unchanged','');
   else if(c.id==='fresh-v5-english-1-2')c.body='Which reminder caused a reduction in late returns?';
   mutation.operation='remove_decisive_condition_or_observation_window';
  }
  if(category==='out_of_syllabus'){c.chapter=subject==='accountancy'?'Financial Markets':'Computerized Accounting System';mutation.operation='relabel_to_topic_not_entitled_for_subject';}
  if(category==='numeric_fault'){const field=/\d/.test(c.body)?'body':'passage_text',m=c[field].match(/\d+/);if(m)c[field]=c[field].replace(m[0],String(Number(m[0])+1));else c.body+=' [unresolved numeric value]';mutation.operation='change_stem_numeric_input_without_rekeying';}
  const oracleKey=category==='wrong_key'?c.correct_answer:['missing_assumptions','numeric_fault'].includes(category)?'none_or_indeterminate':base.correct_answer;
  defects.push({id:c.id,group:'controlled_defect',category,expected_valid:false,candidate:c,derived_from:base.id,mutation,oracle:{key:oracleKey,base_key:base.correct_answer,...(category==='overlapping_options'?{defensible_keys:[base.correct_answer,mutation.duplicate_option]}:{}),basis:'Controlled mutation of a frozen root; exact underlying evidence is in source-certificates.json.',source_refs:c.source_refs}});
 }
}
for(const s of REQUIRED_SUBJECTS){const ids=s==='english'?Object.keys(overlay.sources):[...new Set(candidates.filter(c=>c.subject===s).flatMap(c=>c.source_refs.map(r=>r.id)))];overlay.packs['fresh-full-v5-'+s+'-overlay']={id:'fresh-full-v5-'+s+'-overlay',subject:s,version:1,state:'active',registered_at:'2026-10-08T00:00:00.000Z',document_ids:ids};}
const fixtures=[...candidates.map(c=>({id:c.id,group:'authored_valid',category:'valid',expected_valid:true,candidate:c,oracle:{key:c.correct_answer,basis:'Author oracle from the cited checked excerpt and explicit stem data; independent key review is pending.',source_refs:c.source_refs}})),...defects];
for(const f of fixtures)overlay.families[f.candidate.family_id]={state:'active',version:1,source_pack_id:f.candidate.provenance.source_pack_id,kind:'original_practice'};
const binding=expectedReleaseBinding(), prereg={id:'fresh-full-v5-prereg-2026-10-08',approved_before_evaluation:true,approved_at:'2026-10-08T00:00:00.000Z',evaluation_started:false,previously_read:false,tuned_on:false,scope:'full_cuet_release',classification:'fresh',independent_key_audit:'pending; author oracle is not independent',denominator_rule:'All 96 frozen fixtures remain in all reports, including abstentions, defects, failures and retries.',label_rule:'No defect labels, keys or expected-valid values may be changed after any paid evaluation.',release_policy:{fresh_controlled_defect_false_accepts_max:0,valid_survival_min:0.85,per_subject_valid_survival_min:0.70,topology:binding.topology,verifier_version:binding.verifier_version},paid_evaluation_authorized:false};
const frozen={id:'fresh-full-v5-2026-10-08',created_at:'2026-10-08T00:00:00.000Z',frozen:true,classification:'fresh',scope:'full_cuet_release',contract_binding:binding,verifier_version:binding.verifier_version,release_eligibility:{scope:'full_cuet_release',classification:'fresh',approved_before_evaluation:true,previously_read:false,tuned_on:false,preregistration_id:prereg.id},benchmark_contract:{policy_version:FACTORY_POLICY,denominator:96,valid_roots:64,controlled_defects:32,roots_per_subject:{english:16,accountancy:16,business_studies:16,economics:16},syllabus_baseline:'CUET 2026 official syllabus is provisional for 2027; revalidate before student-facing use.',accountancy_branch:'financial_analysis_only; no valid root uses the alternative computerized-accounting branch',development_partition:'none; no fixture from this corpus is used for tuning',independent_key_audit_required:true,all_candidates_retained_after_evaluation:true},fixtures};
frozen.payload_hash=hashJSON(fixtures.map(f=>({id:f.id,group:f.group,category:f.category,expected_valid:f.expected_valid,candidate:f.candidate,oracle:f.oracle})));
const certificates={registry_version:registry.version,syllabus_baseline:'CUET 2026 official syllabus; provisional for CUET UG 2027',source_family_correlation:'Commerce cases share textbook sources and chapter families. English original passages are separate authored stimuli. No source-family independence claim.',sources:{}};
const conciseQuotes=Object.fromEntries(topics.map(t=>[t[2]+':'+t[3],[t[4]]]));
conciseQuotes['ncert-leac101:pdf-page-5']=['Interest on partner’s loan is to be given @ 12% p.a., if the deed is silent about the rate.'];
conciseQuotes['ncert-lebs104-focused-v1:definition'].push('one day, such as, organising an event or a seminar or conference.');
conciseQuotes['ncert-lebs105:pdf-page-27'].push('Organising is the process of defining and grouping activities and establishing authority relationships among them.');
conciseQuotes['ncert-lebs105:pdf-page-27'].push('Identification and division of work (b) Departmentalisation (c) Assignment of Duties (d) Establishing reporting relationships');
conciseQuotes['ncert-leec103:pdf-page-3'].push('central bank of the economy and the commercial banking system');
conciseQuotes['ncert-leec105-focused-v1:definition']=['The goal of measuring primary deficit is to focus on present fiscal imbalances.','It is simply the fiscal deficit minus the interest payments'];
for(const f of fixtures)for(const r of f.candidate.source_refs){const certKey=r.id+':'+r.locator;if(certificates.sources[certKey])continue;const s=overlay.sources[r.id]||registry.sources[r.id];const fact=s.facts[r.locator].text,quotes=overlay.sources[r.id]?[fact]:(conciseQuotes[r.id+':'+r.locator]||[fact]);if(quotes.some(quote=>!fact.includes(quote)))throw Error('certificate_quote_not_exact:'+r.id+':'+r.locator);certificates.sources[certKey]={id:r.id,version:s.version,kind:s.kind,chapter:s.chapters?.[0]||null,locator:r.locator,concise_quote:quotes[0],supporting_quotes:quotes,concise_quote_sha256:sha(quotes[0]),supporting_quote_sha256s:quotes.map(sha),exact_excerpt:fact,support_hash:s.supports[r.locator],registered_fact_sha256:hashJSON(fact),identity_sha256:s.identity_sha256||null,extraction_sha256:s.extraction_sha256||null,origin:overlay.sources[r.id]?'original_benchmark_overlay':'current_data_source_registry',url:s.url||null,permission:s.permission||null};}
const syllabusText=registry.sources['cuet2026-english-syllabus'].facts['full-syllabus'].text;
const syllabusClause=syllabusText.match(/1\. Reading Comprehension:[\s\S]*?d\. Synonyms and Antonyms/);
if(!syllabusClause)throw Error('english_syllabus_clause_not_found');
certificates.english_syllabus_clause={source_id:'cuet2026-english-syllabus',version:registry.sources['cuet2026-english-syllabus'].version,locator:'full-syllabus',support_hash:englishSyllabus.support_hash,exact_clause:syllabusClause[0],sha256:sha(syllabusClause[0])};
const blind=fixtures.filter(f=>f.group==='authored_valid').map(f=>{const c=f.candidate;return {id:c.id,subject:c.subject,chapter:c.chapter,body:c.body,options:c.options,route:c.route,question_type:c.question_type,difficulty:c.difficulty,passage_text:c.passage_text,source_refs:c.source_refs};});
const report={benchmark_id:frozen.id,fixtures:fixtures.length,valid_roots:candidates.length,controlled_defects:defects.length,per_subject:Object.fromEntries(REQUIRED_SUBJECTS.map(s=>[s,{roots:candidates.filter(c=>c.subject===s).length,defects:defects.filter(f=>f.candidate.subject===s).length}])),format_counts:{},topic_counts:{},problems:[]};
for(const c of candidates){report.format_counts[c.question_type]=(report.format_counts[c.question_type]||0)+1;report.topic_counts[c.subject+':'+c.chapter]=(report.topic_counts[c.subject+':'+c.chapter]||0)+1;if(c.options.length!==4||new Set(c.options.map(o=>o.text.trim().toLowerCase())).size!==4||!c.options.some(o=>o.key===c.correct_answer))report.problems.push('structure:'+c.id);}
if(new Set(fixtures.map(f=>f.id)).size!==96||report.problems.length)throw Error(JSON.stringify(report));
const outputs={'cases.json':{benchmark_id:frozen.id,fixtures},'frozen.json':frozen,'scratch-registry-overlay.json':overlay,'source-certificates.json':certificates,'blind-review-packet.json':{benchmark_id:frozen.id,scope:'valid_roots_only',contains_answers:false,contains_explanations:false,contains_labels:false,items:blind},'structural-report.json':report,'preregistration.json':prereg};
mkdirSync(out,{recursive:true});for(const [name,value] of Object.entries(outputs))writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({...report,payload_hash:frozen.payload_hash,contract_binding:binding},null,2));
