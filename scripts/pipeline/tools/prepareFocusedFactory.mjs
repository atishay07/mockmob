import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';
import {coverageSnapshot,focusedBriefs,focusedExcerpts} from '../lib/focusedCoverage.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {freezeCompactBenchmark} from '../lib/compactBenchmark.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
try{loadEnvFile('.env.local');}catch{}
const directory='artifacts/question-factory/execution-2026-10-07';mkdirSync(directory,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const ledger=new BudgetLedger(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
try{
 if(existsSync(`${directory}/campaign.json`))throw Error('campaign_already_preregistered_use_resume');
 const registry=read('data/source_registry.json');save(`${directory}/registry-before.json`,registry);
 // Extend the excerpt cache from identity-checked NCERT files without changing historical versions.
 function extendExcerpt(originalId,normalizedFile,start,end){
  const old=registry.sources[originalId],root='data/question-factory-runtime/';
  if(createHash('sha256').update(readFileSync(root+old.file)).digest('hex')!==old.identity_sha256)throw Error('reference_identity_changed');
  const text=readFileSync(normalizedFile,'utf8'),a=text.indexOf(start),b=text.indexOf(end,a);
  if(a<0||b<a)throw Error('decisive_span_missing:'+originalId);
  const excerpt=text.slice(a,b),id=originalId+'-focused-v1',locator='definition',file=`${directory}/${id}.txt`;
  writeFileSync(file,excerpt);const sha=createHash('sha256').update(excerpt).digest('hex');
  registry.sources[id]={...old,id,version:1,facts:{[locator]:{text:excerpt}},supports:{[locator]:hashJSON(excerpt)},extraction_file:file,extraction_sha256:sha,
   extraction_basis:{normalized_file:normalizedFile,normalized_sha256:createHash('sha256').update(text).digest('hex'),start:a,end:b,original_id:originalId}};
  return id;
 }
 const primarySource=extendExcerpt('ncert-leec105','data/question-factory-runtime/reference-downloads/leec105.normalized.txt','Primary Deficit :','Box 5.1:');
 const planningSource=extendExcerpt('ncert-lebs104','data/question-factory-runtime/business-economics-auth-work/official-ncert/lebs104.normalized.txt','Single-use Plan:','Policy:');
 const passages={
  'Factual Passage':'In a fictional school library, a trial reading programme ran for four weeks. Students could borrow two books at a time. Each Friday they returned at least one book and wrote a short note about it. The librarian recorded the number of books returned, but did not grade the notes. At the end of the trial, the borrowing records showed an increase in returns during the second and third weeks, followed by a small decrease in the fourth. The librarian said the records showed when books were returned, rather than how carefully they had been read. She proposed discussing a few notes with students before deciding whether to continue the programme. The proposal therefore combined a numerical record with evidence about the students’ experience.',
  'Narrative Passage':'Mira had promised to bring her grandfather’s repaired radio home before sunset. At the workshop she found that the repairer had finished the electrical work, but the wooden case still needed to dry. “It will play,” he said, “but carrying it now may spoil the finish.” Mira looked at the dark clouds and then at the road to her village. She could reach home in time if she left immediately. Instead, she telephoned her grandfather and explained the delay. “A promise includes care,” he replied. She sat beside the workshop window until the case was ready. On the journey home the rain began, and she covered the radio with her coat. When she arrived, her grandfather switched it on. Neither of them mentioned the missed sunset; they listened quietly to the music.',
  'Literary Passage':'The small courtyard held a single neem tree. Every morning its shadow crossed the cracked stones like a slow hand searching for something. Arun used to hurry past it on his way to school. After his grandmother left to stay with his uncle, he began to stop there. He noticed a cup-shaped hollow in the trunk, the fallen leaves caught in a corner, and a bird that returned to the same branch. The courtyard had not changed, yet it seemed larger. One evening he placed his grandmother’s empty chair beneath the tree. He did not sit in it. He stood nearby until the shadow reached the chair’s legs, then went inside to write her a letter.'
 };
 // Original fictional stimuli are authoritative only about their own narrative.
 // They are never attributed to a textbook, publisher, past paper, or real event.
 for(const [chapter,text] of Object.entries(passages)){
  const id=`mockmob-original-stimulus-${chapter.toLowerCase().replaceAll(' ','-')}`,file=`${directory}/${id}.txt`;writeFileSync(file,text);
  const sha=createHash('sha256').update(text).digest('hex');
  registry.sources[id]={id,kind:'reference',state:'active',version:1,chapters:[chapter],url:`local://mockmob/original-stimuli/${id}`,title:'MockMob original fictional reading stimulus',
   identity_sha256:sha,extraction_sha256:sha,extraction_checked:true,reuse_permitted:true,file,extraction_file:file,
   permission:{basis:'Original fictional prose created for MockMob practice; no outside factual or publisher claim',reference:file},facts:{stimulus:{text}},supports:{stimulus:hashJSON(text)},source_pack_id:'original-english-reference-v1'};
 }
 for(const subject of ['english','accountancy','business_studies','economics']){
  const id=`original-${subject}-reference-v1`,old=Object.values(registry.packs).find(p=>p.subject===subject&&p.state==='active');
  registry.packs[id]={id,subject,version:1,state:'active',kind:'authoritative_reference',registered_at:new Date().toISOString(),document_ids:Object.values(registry.sources).filter(s=>s.kind==='reference'&&s.state==='active'&&s.chapters?.some(c=>read('data/question_factory_scope.json').subjects[subject].chapters.includes(c))).map(s=>s.id),syllabus_pack:old?.id};
 }
 const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 let coverage;
 if(existsSync(`${directory}/inventory-coverage-before.json`))coverage=read(`${directory}/inventory-coverage-before.json`);
 else{const rows=await readBankSnapshot(db),holds=await readAllRows(db,'recovery_family_holds','family_id','family_id');coverage=coverageSnapshot(rows,{heldFamilies:holds.map(h=>h.family_id)});save(`${directory}/inventory-coverage-before.json`,coverage);}
 const jobs=focusedBriefs(coverage,registry,{campaignId:'cuet-gap-batch-100-2026-10-07',branch:'financial_analysis'});
 for(const job of jobs){
  job.source_pack_id=`original-${job.subject}-reference-v1`;job.source_pack_version=1;
  const retrieved=focusedExcerpts(registry,job,ledger);job.source_refs=retrieved.refs;job.research=retrieved;
  if(passages[job.chapter])job.passage_text=passages[job.chapter];
  registry.families[job.family_id]={state:'active',version:1,source_pack_id:job.source_pack_id,kind:'original_practice'};
 }
 // Reuse each stimulus as one preregistered atomic group where it has siblings.
 for(const chapter of Object.keys(passages)){
  const siblings=jobs.filter(j=>j.subject==='english'&&j.chapter===chapter);if(siblings.length<2)continue;
  const id=`focused-passage-${hashJSON(chapter).slice(0,16)}`;
  siblings.forEach((j,i)=>{j.passage_group_id=id;j.order_index=i;});
  registry.passage_groups[id]={id,state:'active',kind:'original_practice',candidate_ids:siblings.map(j=>j.id),passage_text:passages[chapter],source_pack_id:'original-english-reference-v1',version:1};
 }
 const normalize=s=>s.toLowerCase().replace(/[\s\-‐‑–—]+/g,'');
 const ref=(id,phrase)=>{const s=registry.sources[id],entry=Object.entries(s.facts).find(([,f])=>normalize(f.text).includes(normalize(phrase)));if(!entry)throw Error(`decisive_excerpt_not_found:${id}:${phrase}`);return {id,version:s.version,locator:entry[0],support_hash:s.supports[entry[0]]};};
 const items=[];
 function positive(subject,chapter,body,options,key,explanation,refs,{route='conceptual',difficulty='medium',type='conceptual_mcq',passage=''}={}){
  const id=`fresh-v6-${items.length+1}`,family_id=`heldout:${id}`,spec=registry.exam_specs[subject];
  const candidate={id,subject,chapter,body,options,correct_answer:key,explanation,route,difficulty,question_type:type,passage_text:passage,family_id,source_refs:refs,
   provenance:{kind:'original_practice',anchor_id:null,adaptation_family:family_id,adaptation_type:null,syllabus_version:spec.syllabus_version,pattern_version:spec.pattern_version,source_pack_id:`original-${subject}-reference-v1`,source_pack_version:1}};
  registry.families[family_id]={state:'active',version:1,kind:'heldout_source_oracle'};
  items.push({id,category:`valid_${difficulty}`,expected_valid:true,candidate,oracle:{key,source_refs:refs,basis:explanation,independently_established_before_validation:true},state:'queued'});
 }
 positive('english','Correct Word Usage','Choose the correct completion: If Ria had checked the address, she ______ the wrong parcel.',['would not have collected','will not collect','did not collect','does not collect'],'A','A third conditional uses if with past perfect and would have with a past participle.',[ref('cuet2024-english-bookA-q45-reference','past perfect')],{difficulty:'easy',type:'correct_word_usage'});
 positive('english','Vocabulary','Choose the word closest in meaning to "prudent".',['rash','cautious','careless','impulsive'],'B','Prudent means sensible and careful in decisions, avoiding unnecessary risks; cautious has the closest meaning.',[ref('oxford-quality-prudent','careful')],{difficulty:'easy',type:'synonym'});
 const bp='Asha’s class planned a visit to the old observatory. The first bus was cancelled because its driver was ill. The teacher booked another bus and moved the departure from eight o’clock to nine. Asha complained that they would miss the morning demonstration. The observatory manager agreed to repeat it in the afternoon, but asked the class to spend the morning examining the exhibition instead. When Asha returned, she said the unexpected change had given her more time to study the models before seeing them work.';
 const bid='mockmob-fresh-benchmark-stimulus';registry.sources[bid]={...registry.sources['mockmob-original-stimulus-narrative-passage'],id:bid,chapters:['Narrative Passage'],facts:{stimulus:{text:bp}},supports:{stimulus:hashJSON(bp)},identity_sha256:createHash('sha256').update(bp).digest('hex'),title:'Separate original held-out reading stimulus'};
 const benchmarkStimulusFile=`${directory}/${bid}.txt`;writeFileSync(benchmarkStimulusFile,bp);Object.assign(registry.sources[bid],{file:benchmarkStimulusFile,extraction_file:benchmarkStimulusFile,extraction_sha256:registry.sources[bid].identity_sha256,url:`local://mockmob/heldout/${bid}`});registry.packs['original-english-reference-v1'].document_ids.push(bid);
 const br={id:bid,version:1,locator:'stimulus',support_hash:hashJSON(bp)};
 positive('english','Narrative Passage','According to the passage, why did the first bus not run?',['The observatory was closed.','The class arrived late.','Its driver was ill.','The exhibition had ended.'],'C','The passage explicitly states that the first bus was cancelled because its driver was ill.',[br],{route:'passage',difficulty:'easy',type:'reading_comprehension',passage:bp});
 positive('english','Narrative Passage','Which inference best reflects Asha’s experience?',['Every delay improves a visit.','Examining the models first helped her understand the demonstration.','The teacher had planned to miss the demonstration.','She preferred travelling to studying the models.'],'B','Asha says the change gave her more time to study the models before seeing them work; this supports that particular benefit, without generalising to every delay.',[br],{route:'passage',type:'reading_comprehension',passage:bp});
 const sr=ref('ncert-leac102','Old Share of Profit');
 positive('accountancy','Admission of Partner','A and B share profits in the ratio 3:2. They admit C and agree on a new ratio of 5:3:2 for A, B and C respectively. What is the sacrificing ratio of A and B?',['1:1','3:2','5:3','2:1'],'A','A sacrifices 3/5 − 5/10 = 1/10 and B sacrifices 2/5 − 3/10 = 1/10. Their sacrificing ratio is 1:1.',[sr],{route:'numerical',type:'numerical_calculation'});
 positive('accountancy','Admission of Partner','A and B share profits in the ratio 7:5. C is admitted for a 1/6 share, acquired as 1/12 from A and 1/12 from B. What is the new profit-sharing ratio of A, B and C?',['7:5:2','3:2:1','6:5:1','5:4:3'],'B','A retains 7/12 − 1/12 = 6/12, B retains 5/12 − 1/12 = 4/12 and C has 2/12. The ratio 6:4:2 simplifies to 3:2:1.',[sr],{route:'numerical',difficulty:'hard',type:'numerical_calculation'});
 const cr=ref('ncert-leac206','investing activities');
 positive('accountancy','Cash Flow Statement','A company pays ₹2,40,000 by bank transfer to purchase equipment for use in production. How is this cash flow classified?',['Operating inflow','Financing outflow','Investing outflow','Investing inflow'],'C','Purchasing production equipment is acquisition of a long-term asset, an investing activity; paying by bank transfer causes a cash outflow.',[cr],{difficulty:'easy'});
 const ur=ref('ncert-leec202','MU = TU');
 positive('economics','Introduction & Theory of Consumer Behaviour','Total utility from four units is 42 utils and from five units is 47 utils. What is the marginal utility of the fifth unit?',['47 utils','42 utils','9.4 utils','5 utils'],'D','Marginal utility is the change in total utility from one additional unit: 47 − 42 = 5 utils.',[ur],{route:'numerical',type:'numerical_calculation',difficulty:'easy'});
 const fr=ref('ncert-leec105','Fiscal deficit');
 positive('economics','Government Budget & the Economy','A government has total expenditure of ₹920 crore, revenue receipts of ₹650 crore and non-debt capital receipts of ₹70 crore. What is its fiscal deficit?',['₹270 crore','₹200 crore','₹340 crore','₹850 crore'],'B','Fiscal deficit is total expenditure minus revenue receipts and non-debt capital receipts: 920 − 650 − 70 = ₹200 crore.',[fr],{route:'numerical',type:'numerical_calculation'});
 positive('economics','Government Budget & the Economy','Total expenditure is ₹1,050 crore, revenue receipts ₹730 crore, non-debt capital receipts ₹80 crore and interest payments ₹90 crore, with no interest receipts. What is the primary deficit?',['₹150 crore','₹240 crore','₹330 crore','₹320 crore'],'A','Fiscal deficit is 1,050 − 730 − 80 = ₹240 crore. Primary deficit excludes interest payments, so it is 240 − 90 = ₹150 crore.',[fr,ref(primarySource,'Primary deficit')],{route:'numerical',type:'numerical_calculation',difficulty:'hard'});
 const pl=ref(planningSource,'single-use');
 positive('business_studies','Planning','Which plan is prepared for a one-time event or project rather than recurring activities?',['Policy','Rule','Single-use plan','Standing plan'],'C','A single-use plan is developed for a one-time event or project. Standing plans guide recurring activities.',[pl],{difficulty:'easy'});
 const tr=ref('ncert-lebs106','selection tests');
 positive('business_studies','Staffing','A company first applies selection tests, then interviews shortlisted applicants, checks references and finally makes its selection decision. Which stage follows the interview in this sequence?',['Selection tests','Reference checking','Preliminary screening','Selection decision'],'B','The stated sequence places reference checking immediately after the interview, consistent with the selection process described in the source.',[tr]);
 const ctrl=ref('ncert-lebs108','critical point');
 positive('business_studies','Controlling','A manager concentrates on departures from standards in the activities most important to achieving organisational goals. Which controlling approach is illustrated?',['Critical point control','Universal supervision','Informal communication','Decentralisation'],'A','Critical point control focuses on key result areas critical to organisational success; not every activity warrants the same level of attention.',[ctrl]);
 // Two examples per defect category; no regeneration or repair of benchmark items.
 const clone=(index,category,change,basis)=>{const original=items[index],id=`fresh-v6-defect-${items.length+1}`,candidate=structuredClone(original.candidate);candidate.id=id;candidate.family_id=`heldout:${id}`;candidate.provenance.adaptation_family=candidate.family_id;change(candidate);registry.families[candidate.family_id]={state:'active',version:1,kind:'heldout_source_oracle'};items.push({id,category,expected_valid:false,candidate,oracle:{...original.oracle,basis},state:'queued'});};
 clone(4,'wrong_key',q=>q.correct_answer='D','Independent subtraction of old/new shares gives 1:1, option A; the saved D key is deliberately wrong.');
 clone(8,'wrong_key',q=>q.correct_answer='A','Independent fiscal-deficit calculation gives ₹200 crore, option B; key A is deliberately wrong.');
 clone(7,'multiple_correct',q=>q.options=['5 utils','More than 4 utils','47 utils','42 utils'],'Both 5 utils and more than 4 utils are correct for a marginal utility of 5.');
 clone(1,'multiple_correct',q=>q.options=['cautious','careful','careless','rash'],'Cautious and careful both express the supplied definition of prudent.');
 clone(4,'missing_assumptions',q=>q.body='A and B share profits in the ratio 3:2. They admit C. What is the sacrificing ratio of A and B?','The incoming share or new sharing ratio is absent; the sacrificing ratio cannot be determined.');
 clone(8,'missing_assumptions',q=>q.body='Total government expenditure is ₹920 crore and capital receipts are ₹70 crore. What is the fiscal deficit?','Revenue receipts and whether capital receipts include borrowings are omitted.');
 clone(2,'unsupported_explanation',q=>q.explanation='The driver was ill because all observatory trips take place in winter.','Illness is in the stimulus; season and the general claim about all trips have no support.');
 clone(10,'unsupported_explanation',q=>q.explanation='Single-use plans are required because every Indian company must discard its policies at the end of each year.','The purported legal rule and policy-expiry claim are not in the excerpts.');
 clone(1,'out_of_syllabus',q=>{q.subject='english';q.chapter='Vocabulary';q.body='Which chemical symbol represents sodium?';q.options=['Na','N','S','K'];q.correct_answer='A';q.explanation='Sodium is represented by Na.';},'Chemistry factual recall is outside the supplied English syllabus and references.');
 clone(10,'out_of_syllabus',q=>{q.body='Which quantum number determines the orientation of an atomic orbital?';q.options=['Principal','Azimuthal','Magnetic','Spin'];q.correct_answer='C';q.explanation='The magnetic quantum number determines orientation.';},'Atomic orbital quantum numbers are outside Business Studies and unsupported by planning excerpts.');
 clone(7,'numerical_fault',q=>{q.options=['47 utils','42 utils','9.4 utils','6 utils'];q.correct_answer='D';q.explanation='47 minus 42 is 6 utils.';},'47 − 42 equals 5, absent from all four choices; the calculation and key are broken.');
 clone(9,'numerical_fault',q=>{q.correct_answer='B';q.explanation='The primary deficit is 1,050 − 730 − 80 = ₹240 crore; interest payments are not deducted.';},'₹240 is the fiscal deficit, not the primary deficit; deduct ₹90 interest to get ₹150.');
 registry.version+=1;
 const registration=freezeCompactBenchmark(items,{registry,ledger});
 save(`${directory}/benchmark.json`,{registration,fixtures:items});save(`${directory}/registry.json`,registry);save('data/source_registry.json',registry);
 const campaign={id:'cuet-gap-batch-100-2026-10-07',preregistered_at:new Date().toISOString(),verifier:FACTORY_VERIFIER_VERSION,registry_version:registry.version,
  denominator:100,per_subject:25,branch:'financial_analysis',budget_start:ledger.snapshot(),request_ids_before:ledger.db.prepare('SELECT id FROM requests').all().map(r=>r.id),
  source_retrieval_cost_usd:0,planning_cost_usd:0,maximum_repairs_per_candidate:1,no_regeneration:true,jobs};
 save(`${directory}/campaign.json`,campaign);console.log(JSON.stringify({preregistered:jobs.length,benchmark:items.length,inventory_usable:coverage.total_usable,registry:registry.version,api_spend_usd:0}));
}finally{ledger.close();}
