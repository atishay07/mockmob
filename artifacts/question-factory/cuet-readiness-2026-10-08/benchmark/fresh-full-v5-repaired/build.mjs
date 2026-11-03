// Pre-evaluation reconstruction of the unrun v5 draft, preserving that draft.
// This does not tune a validator or change any production/source registry file.
import { readFileSync,writeFileSync,mkdirSync,existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashJSON } from '../../../../../data/question_factory_policy.mjs';
import { expectedReleaseBinding } from '../../../../../scripts/pipeline/lib/releaseEvidenceV7.mjs';
import { payloadHash } from '../../../../../scripts/pipeline/lib/cuetFitBenchmark.mjs';
const here=dirname(fileURLToPath(import.meta.url)),parent=here+'/../fresh-full-v5';
const read=p=>JSON.parse(readFileSync(p,'utf8')),registry=read('data/source_registry.json'),draft=read(parent+'/frozen.json');
if(existsSync(here+'/frozen.json'))throw Error('benchmark_already_built_no_overwrite');
const overlay=read(parent+'/scratch-registry-overlay.json'),changes=[];
const roots=draft.fixtures.filter(f=>f.expected_valid).map(f=>structuredClone(f));
function find(subject,topic,n){return roots.find(f=>f.id===`fresh-v5-${subject}-${topic}-${n}`);}
function patch(subject,topic,n,update,reason){const f=find(subject,topic,n);if(!f)throw Error('root_not_found');Object.assign(f.candidate,update);changes.push({parent_id:f.id,reason,fields:Object.keys(update)});return f;}
function ref(id,locator){const s=registry.sources[id];if(!s?.facts?.[locator])throw Error('source_missing');return{id,version:s.version,locator,support_hash:s.supports[locator]};}
function choices(texts){return texts.map((text,i)=>({key:'ABCD'[i],text}));}
function task(subject,topic,n,body,texts,key,explanation,type='conceptual_mcq',extra={}){
 return patch(subject,topic,n,{body,options:choices(texts),correct_answer:key,explanation,question_type:type,...extra},'Self-contained CUET task and parallel, within-subject distractors; source-backed answer.');
}
function matching(subject,topic,n,list1,list2,key,explanation){
 const maps=['(A)-(I), (B)-(II), (C)-(III), (D)-(IV)','(A)-(II), (B)-(I), (C)-(IV), (D)-(III)','(A)-(III), (B)-(IV), (C)-(I), (D)-(II)','(A)-(IV), (B)-(III), (C)-(II), (D)-(I)'];
 return task(subject,topic,n,'Match List-I with List-II.\nList-I\n'+list1.map((x,i)=>'('+ 'ABCD'[i]+') '+x).join('\n')+'\nList-II\n'+list2.map((x,i)=>'('+['I','II','III','IV'][i]+') '+x).join('\n')+'\nChoose the correct answer from the options given below:',maps,key,explanation,'matching',{difficulty:'medium'});
}
task('accountancy','partnership-fundamentals',1,'Which arrangement describes a partnership?',[
 'Two or more persons agree to carry on business and share its profits','One proprietor employs a salaried manager','Shareholders subscribe to a company’s equity capital','A lender advances money to a sole proprietor'],'A','A partnership involves two or more persons joining to conduct a business and share profits. Employment, share subscription and lending alone do not establish that arrangement.');
const loan=task('accountancy','partnership-fundamentals',2,'A partner lends ₹20,000 to the firm for business purposes for one full year. The partnership deed is silent about interest on the loan. What interest is payable?',[
 '₹1,200','₹2,000','₹2,400','₹12,000'],'A','The default rate on a partner’s business loan is 6% per annum. Interest is ₹20,000 × 6/100 × 1 = ₹1,200.','numerical_calculation',{route:'numerical'});
loan.candidate.source_refs=[ref('ncert-leac101','quality-v4-63927dc5d1aa')];
task('accountancy','partnership-fundamentals',3,'In a partnership, the persons who join to establish a business are called:',[
 'Partners','Debenture holders','Equity shareholders','Employees'],'A','The persons who join to establish the partnership business are partners.');
patch('accountancy','partnership-fundamentals',4,{body:'Consider these statements about partnership:\n(1) Two or more persons join to establish a business.\n(2) They agree to share its profits.\nWhich statements are correct?'},'Remove reference to an unprinted excerpt.');
task('accountancy','change-in-profit-sharing-ratio',1,'On admission to a partnership firm, an incoming partner acquires a share of profit from:',[
 'The existing partners','The firm’s trade creditors','The firm’s customers','The firm’s employees'],'A','The incoming partner acquires a profit share from the existing partners, who sacrifice part of their shares.');
task('accountancy','change-in-profit-sharing-ratio',3,'A new partner acquires a profit share from the existing partners. The existing partners’ reduction in profit share is called:',[
 'Gaining share','Sacrificing share','Capital reserve','Revaluation surplus'],'B','The existing partners sacrifice the share acquired by the incoming partner.');
patch('accountancy','change-in-profit-sharing-ratio',4,{body:'On admission of a new partner, consider these statements:\n(1) The new partner acquires a profit share from the existing partners.\n(2) The existing partners sacrifice the share so acquired.\nWhich statements are correct?'},'Make statement-selection instruction explicit.');
matching('accountancy','share-capital',3,['Authorised capital','Issued capital','Subscribed capital','Called-up capital'],[
 'Amount actually subscribed by the public','Amount called for payment on subscribed shares','Maximum issue authorised by the Memorandum','Part offered for subscription'],'C','Authorised capital is the Memorandum limit; issued capital is offered for subscription; subscribed capital is taken by the public; called-up capital is requested for payment.');
patch('accountancy','share-capital',4,{body:'Without changing its authorised capital, consider these statements about a company:\n(1) It may issue share capital exceeding the amount specified in its Memorandum.\n(2) Authorised capital limits the amount of share capital it may issue.\nWhich statements are correct?'},'State the unchanged-authorisation condition explicitly.');
task('accountancy','accounting-ratios',1,'Which measure is calculated by dividing 365 by the trade receivables turnover ratio?',[
 'Average collection period','Average payment period','Inventory turnover ratio','Capital employed turnover ratio'],'A','Average collection period = 365 ÷ trade receivables turnover ratio.');
task('accountancy','accounting-ratios',3,'Using a 365-day year, which formula gives the average collection period?',[
 '365 ÷ trade receivables turnover ratio','365 × trade receivables turnover ratio','Trade receivables turnover ratio ÷ 365','365 ÷ trade payables turnover ratio'],'A','The collection-period formula divides 365 by trade receivables turnover. The payables formula measures payment period.');
patch('accountancy','accounting-ratios',4,{body:'Use average collection period = 365 ÷ trade receivables turnover ratio.\n(1) A turnover ratio of 10 gives 36.5 days.\n(2) A turnover ratio of 5 gives 1,825 days.\nWhich statements are correct?'},'Print the formula and numerical propositions.');
task('business_studies','planning',1,'A plan is prepared for an event that is not expected to recur. Which type of plan is it?',[
 'Single-use plan','Standing plan','Policy','Procedure'],'A','A single-use plan is prepared for a one-time, non-recurring event or project.');
task('business_studies','planning',2,'A college prepares a plan for a one-day seminar that it does not intend to repeat. Which type of plan is appropriate?',[
 'Single-use plan','Standing plan','Recruitment policy','Routine admissions procedure'],'A','A non-recurring seminar calls for a single-use plan.','case_application');
matching('business_studies','planning',3,['Policy','Procedure','Method','Rule'],[
 'Chronological steps for carrying out work','General guide to thinking and decisions','Specific statement allowing no discretion','Prescribed way to perform one task'],'B','Policy guides decisions; procedure gives steps; method specifies how a task is done; a rule permits no flexibility.');
task('business_studies','organising',1,'Which activity belongs to organising?',[
 'Grouping activities and establishing authority relationships','Motivating employees to initiate action','Comparing actual results with standards','Setting objectives and choosing a course of action'],'A','Organising defines and groups activities and establishes authority relationships among them.');
task('business_studies','organising',2,'After departmentalisation in the organising process, which step comes next?',[
 'Identification and division of work','Establishing reporting relationships','Assignment of duties','Selection of a planning alternative'],'C','The organising sequence is identification/division, departmentalisation, assignment of duties, then reporting relationships.');
task('business_studies','organising',3,'Departmentalisation and assignment of duties are respectively which steps in the organising process?',[
 'First and second','Second and third','Third and fourth','Fourth and first'],'B','Departmentalisation follows division of work; assignment of duties follows departmentalisation.');
patch('business_studies','organising',4,{body:'In the organising process, work has been identified and divided. Choose the correct order of the remaining steps.'},'Name the process explicitly.');
task('business_studies','directing',1,'Which description identifies directing?',[
 'Instructing, guiding, counselling, motivating and leading people toward organisational objectives','Grouping activities and establishing authority relationships','Setting objectives and selecting an appropriate course of action','Comparing actual performance with predetermined standards'],'A','Directing instructs, guides, counsels, motivates and leads people to achieve organisational objectives.');
task('business_studies','directing',2,'Which managerial function initiates action while planning, organising and staffing prepare the setting for action?',[
 'Planning','Organising','Directing','Staffing'],'C','The supplied NCERT description states that directing initiates action.');
task('business_studies','directing',3,'In an organisation, directing is performed:',[
 'At every level where superior–subordinate relationships exist','Only by the top executive','Only by first-line supervisors','Only when managerial personnel change'],'A','Every manager, from top executives to supervisors, directs where superior–subordinate relations exist.');
task('business_studies','marketing-management',2,'A manufacturer appoints dealers and arranges storage and transportation so its products reach target customers. Which marketing-mix element is illustrated?',[
 'Product','Place','Price','Promotion'],'B','Place includes dealer selection, storage and transportation to make products available to target customers.','case_application');
task('business_studies','marketing-management',3,'Selecting intermediaries to make products available to customers is mainly a decision about:',[
 'Place','Promotion','Product','Price'],'A','The place element includes selection of dealers or intermediaries to reach target customers.');
patch('business_studies','marketing-management',4,{body:'Consider these statements about the marketing mix:\n(1) Place decisions include selecting dealers.\n(2) Place means setting the selling price.\nWhich statements are correct?'},'Remove an unprinted excerpt reference.');
task('economics','money-banking',1,'In a modern economy, money comprises which of the following?',[
 'Cash and bank deposits','Company shares and debentures','Government taxes and subsidies','Exports and imports'],'A','The supplied NCERT definition states that money comprises cash and bank deposits.');
task('economics','money-banking',2,'A household holds ₹4,000 in cash and ₹6,000 in bank deposits. Using a measure that includes both these holdings, their total money holding is:',[
 '₹2,000','₹6,000','₹10,000','₹24,000'],'C','₹4,000 + ₹6,000 = ₹10,000. The measure and included holdings are stated.','numerical_calculation',{route:'numerical'});
matching('economics','money-banking',3,['Central bank','Commercial bank','Reserve money','Interest spread'],[
 'Currency issued by the central bank as a basis for credit creation','Difference between lending and deposit interest rates','Institution that accepts deposits and lends part of them','Institution that issues the country’s currency'],'D','The central bank issues currency; commercial banks take deposits and lend; reserve money is central-bank currency; the spread is the lending/deposit rate difference.');
patch('economics','money-banking',4,{body:'Consider these statements about money supply in a modern economy:\n(1) Bank deposits are included in measures of money.\n(2) Commercial banks form part of the money-creating system.\nWhich statements are correct?'},'Name the system.');
task('economics','income-determination',1,'The investment multiplier is the ratio of:',[
 'Total increase in equilibrium output to the initial increase in autonomous expenditure','Initial increase in autonomous expenditure to total increase in equilibrium output','Consumption expenditure to total tax receipts','Money supply to currency held by the public'],'A','NCERT defines the investment multiplier as the total increment in equilibrium output divided by the initial autonomous-expenditure increment.');
task('economics','income-determination',3,'In the investment-multiplier mechanism, successive rounds of consumption expenditure generate additional:',[
 'Final-goods output and income','Only tax receipts','Only foreign-exchange reserves','Only currency issued by the central bank'],'A','The NCERT multiplier account links additional consumption demand to final-goods output and income.');
patch('economics','income-determination',4,{body:'In the investment-multiplier account, consider these statements:\n(1) Additional final-goods output is also additional income.\n(2) The output-income increment is defined as tax revenue.\nWhich statements are correct?'},'Remove references to an unprinted table or passage.');
patch('economics','government-budget-the-economy',2,{body:'Gross fiscal deficit is ₹90 crore. Interest payments are ₹25 crore and government interest receipts are zero. What is the gross primary deficit?',explanation:'Net interest liabilities are ₹25 crore − zero = ₹25 crore. Gross primary deficit = ₹90 crore − ₹25 crore = ₹65 crore.'},'Align exactly with the source’s net-interest definition.');
task('economics','government-budget-the-economy',3,'Primary deficit is measured to focus on:',[
 'Present fiscal imbalances excluding interest obligations on past debt','The entire accumulated stock of public debt','The value of all government assets','The balance between exports and imports'],'A','The source states that primary deficit focuses on present fiscal imbalances by removing the interest component.');
patch('economics','balance-of-payments',1,{body:'Under a flexible exchange-rate system, what determines the exchange rate?'},'Remove an unprinted excerpt reference.');
patch('economics','balance-of-payments',2,{body:'In a completely flexible exchange-rate system, demand for foreign currency increases while its supply curve is unchanged. Which statement is correct?',options:choices(['The market-determined exchange rate can change','The exchange rate must remain fixed','Central-bank intervention fixes the rate by definition','Demand changes cannot affect the exchange rate'])},'State the exchange-rate regime; keep the supported directional claim.');
patch('economics','balance-of-payments',3,{question_type:'conceptual_mcq'},'This is a direct synonym question, not a matching task.');
// Remove remaining false matching labels; actual complete matching tasks above are retained.
for(const f of roots)if(f.candidate.question_type==='matching'&&!f.candidate.body.includes('List-II'))throw Error('incomplete_matching_not_resolved:'+f.id);
// Clarify the fourth original stimulus without changing any reported result.
const sid='fresh-full-v5-en-passage-4',src=overlay.sources[sid];
const old=src.facts.stimulus.text,newText=old.replace('One showed only the plant name, another added the sowing date, and a third recorded both.','One showed only the plant name, another showed only the sowing date, and a third recorded both.');
if(old===newText)throw Error('stimulus_patch_not_applied');src.facts.stimulus.text=newText;src.supports.stimulus=hashJSON(newText);
// Original stimulus identity/extraction hashes use SHA-256 bytes, not canonical JSON.
const {createHash}=await import('node:crypto');const sha=s=>createHash('sha256').update(s).digest('hex');src.identity_sha256=sha(newText);src.extraction_sha256=sha(newText);
for(const f of roots)if(f.candidate.id.startsWith('fresh-v5-english-4-')){f.candidate.passage_text=newText;f.candidate.source_refs.find(r=>r.id===sid).support_hash=src.supports.stimulus;changes.push({parent_id:f.id,reason:'Clarify mutually distinct label designs; preserve reported observations.',fields:['passage_text','source_refs']});}
// Rotate answer positions deterministically after the substantive key was checked.
for(const [i,f] of roots.entries()){
 const c=f.candidate,oldKey=c.correct_answer,correct=c.options.find(o=>o.key===oldKey)?.text;
 if(!correct)throw Error('correct_option_missing');const oldIndex='ABCD'.indexOf(oldKey),wanted=i%4,shift=(wanted-oldIndex+4)%4,rotated=[];
 for(let j=0;j<4;j++)rotated[(j+shift)%4]={key:'ABCD'[(j+shift)%4],text:c.options[j].text};
 c.options=rotated;c.correct_answer='ABCD'[wanted];
 if(c.options[wanted].text!==correct)throw Error('answer_rotation_changed_semantics');
 f.parent_id=f.id;f.id=f.id.replace('fresh-v5-','fresh-v5r-');c.id=f.id;c.family_id='fresh-v5r-family-'+f.id;c.provenance.source_pack_id='fresh-v5r-'+c.subject+'-overlay';c.difficulty=['numerical','passage'].includes(c.route)||c.question_type==='matching'?'medium':'easy';
 f.oracle={key:c.correct_answer,basis:'NCERT normative unit or printed original passage; arithmetic independently recomputed in the pre-evaluation root review.',source_refs:c.source_refs};
 f.group='authored_valid';f.category='valid';f.expected_valid=true;
}
const defects=[];
for(const subject of ['accountancy','business_studies','economics','english']){
 const list=roots.filter(f=>f.candidate.subject===subject);
 const specs=[['wrong_key',0],['wrong_key',1],['overlapping_options',2],['overlapping_options',3],['unsupported_explanation',4],['missing_assumptions',5],['out_of_syllabus',6],['numeric_fault',7]];
 for(const [category,index]of specs){const base=list[index],c=structuredClone(base.candidate);c.id=base.id+'--'+category;c.family_id='fresh-v5r-family-'+c.id;
  let basis;
  if(category==='wrong_key'){c.correct_answer='ABCD'[('ABCD'.indexOf(c.correct_answer)+1)%4];basis='Only proposed key changed; independently solved base key remains correct.';}
  if(category==='overlapping_options'){const k='ABCD'.indexOf(c.correct_answer),other=(k+1)%4;c.options[other].text=c.options[k].text;basis='Two separate choices now have the same correct proposition.';}
  if(category==='unsupported_explanation'){c.explanation+=' This also proves that national welfare always rises.';basis='The appended universal welfare claim follows from neither stimulus nor source.';}
  if(category==='missing_assumptions'){
   if(subject==='accountancy'){c.body='A and B share profits in the ratio 3:2. A newcomer receives 1/5. What fractions do A and B sacrifice respectively?';basis='How the newcomer acquires the share is not specified; the supplied NCERT convention may make this arguable. Use a different decisive missing-value control instead.';c.body='A and B share profits in the ratio 3:2. A newcomer receives an unspecified share, acquired from A and B in their old ratio. What fractions do A and B sacrifice respectively?';basis='The newcomer’s share value is absent; no convention supplies it.';}
   if(subject==='business_studies'){c.body='Choose the correct next step in the process.';basis='No managerial process or current step is identified.';}
   if(subject==='economics'){c.body='In a two-sector model, using k = 1/(1−MPC), the investment multiplier equals:';basis='The value of MPC is absent; its value changes the answer.';}
   if(subject==='english'){c.body='In what year did Kavya repair the radio?';c.options=choices(['2023','2024','2025','2026']);c.correct_answer='A';basis='The passage gives no year and no other supplied source establishes one.';}
  }
  if(category==='out_of_syllabus'){c.chapter=subject==='english'?'Share Capital':subject==='accountancy'?'Computerised Accounting System':subject==='business_studies'?'Chemical Kinetics':'Trigonometric Functions';c.body=subject==='english'?'Which chemical formula represents sodium chloride?':subject==='accountancy'?'In a computerised accounting database, which SQL command removes a table?':subject==='business_studies'?'What is the molecular geometry of methane?':'What is the derivative of sin(x) with respect to x?';c.options=choices(subject==='english'?['NaCl','KCl','NaOH','HCl']:subject==='accountancy'?['DROP TABLE','SELECT','INSERT','UPDATE']:subject==='business_studies'?['Tetrahedral','Linear','Trigonal planar','Square planar']:['cos(x)','−cos(x)','sin(x)','−sin(x)']);c.correct_answer='A';basis='The task is outside the currently registered subject/Accountancy branch, irrespective of general academic correctness.';}
  if(category==='numeric_fault'){
   if(subject==='accountancy'){c.body='Using average collection period = 365 ÷ turnover, a turnover of 5 gives what collection period?';c.options=choices(['72 days','74 days','75 days','76 days']);c.correct_answer='A';c.source_refs=[ref('ncert-leac205','pdf-page-27')];basis='365/5=73, and no offered value is correct.';}
   if(subject==='business_studies'){c.body='A firm appoints 3 dealers in each of 4 separate regions. How many dealer-region placements are there?';c.options=choices(['11','13','14','15']);c.correct_answer='A';basis='3×4=12 and all offered totals are wrong.';}
   if(subject==='economics'){c.body='Gross fiscal deficit is ₹90 crore; net interest liabilities are ₹25 crore. What is gross primary deficit?';c.options=choices(['₹64 crore','₹66 crore','₹67 crore','₹68 crore']);c.correct_answer='A';c.source_refs=[ref('ncert-leec105-focused-v1','definition')];basis='90−25=65, and all offered amounts are wrong.';}
   if(subject==='english'){c.passage_text=roots.find(r=>r.id==='fresh-v5r-english-4-4').candidate.passage_text;c.source_refs=structuredClone(roots.find(r=>r.id==='fresh-v5r-english-4-4').candidate.source_refs);c.body='How many more checks did the combined label pass than the name-only label?';c.options=choices(['2','4','5','6']);c.correct_answer='A';basis='18−15=3 and no choice states 3.';}
  }
  defects.push({id:c.id,group:'controlled_defect',category,expected_valid:false,derived_from:base.id,candidate:c,oracle:{key:['wrong_key','unsupported_explanation'].includes(category)?base.candidate.correct_answer:'none_or_indeterminate',basis,source_refs:c.source_refs}});
 }
}
for(const subject of ['accountancy','business_studies','economics','english']){const oldPack=overlay.packs['fresh-full-v5-'+subject+'-overlay'];overlay.packs['fresh-v5r-'+subject+'-overlay']={...oldPack,id:'fresh-v5r-'+subject+'-overlay'};}
for(const f of [...roots,...defects])overlay.families[f.candidate.family_id]={state:'active',version:1,source_pack_id:f.candidate.provenance.source_pack_id,kind:'original_practice'};
const fixtures=[...roots,...defects],binding=expectedReleaseBinding(),id='fresh-full-v5-repaired-2026-10-08';
const frozen={id,verifier_version:binding.verifier_version,contract_binding:binding,created_at:new Date().toISOString(),fixtures,payload_hash:payloadHash(fixtures),release_eligibility:{scope:'full_cuet_release',classification:'fresh',approved_before_evaluation:true,previously_read:false,tuned_on:false,preregistration_id:id},construction_history:{parent_id:draft.id,parent_hash:draft.payload_hash,parent_never_evaluated:true,pre_evaluation_repairs:changes,answer_positions:'deterministic balanced permutation; not a model outcome',disclosure:'Root revised the draft before any native validator evaluation. Author/source audits are required benchmark construction, not measured reliability. The source families and paired controls are correlated.'}};
const blind={benchmark_id:id,contains_answers:false,contains_explanations:false,contains_labels:false,items:roots.map(f=>{const{correct_answer,explanation,...c}=f.candidate;return c;})};
const sourcePack={benchmark_id:id,contains_answers:false,by_candidate:{}};
for(const q of blind.items)sourcePack.by_candidate[q.id]=q.source_refs.map(r=>{const s=overlay.sources[r.id]||registry.sources[r.id];if(s.supports[r.locator]!==r.support_hash)throw Error('support_hash_mismatch');return{...r,title:s.title,url:s.url,kind:s.kind,permission:s.permission,exact_excerpt:s.facts[r.locator].text};});
const counts={denominator:fixtures.length,valid:roots.length,defects:defects.length,by_subject:Object.fromEntries(['accountancy','business_studies','economics','english'].map(s=>[s,{valid:roots.filter(f=>f.candidate.subject===s).length,defects:defects.filter(f=>f.candidate.subject===s).length}])),positions:Object.fromEntries('ABCD'.split('').map(k=>[k,roots.filter(f=>f.candidate.correct_answer===k).length])),formats:[...new Set(roots.map(f=>f.candidate.question_type))]};
if(fixtures.length!==96||roots.length!==64||defects.length!==32||Object.values(counts.by_subject).some(x=>x.valid!==16||x.defects!==8))throw Error('denominator_mismatch');
mkdirSync(here,{recursive:true});for(const[name,obj]of Object.entries({'frozen.json':frozen,'scratch-registry-overlay.json':overlay,'blind-review-packet.json':blind,'blind-source-excerpts.json':sourcePack,'structural-report.json':counts,'preregistration.json':{id,paid_evaluation_authorized:false,evaluation_started:false,independent_key_audit:'pending',cap_usd:3,maximum_repairs:0,publication:'never',construction_history:frozen.construction_history}}))writeFileSync(here+'/'+name,JSON.stringify(obj,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...counts,payload_hash:frozen.payload_hash,paid_evaluation_authorized:false}));
