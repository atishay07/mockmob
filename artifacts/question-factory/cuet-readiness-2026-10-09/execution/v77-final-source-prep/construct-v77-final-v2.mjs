import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root='artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep';
const sha=s=>createHash('sha256').update(s).digest('hex');
const hashJSON=x=>sha(Buffer.from(JSON.stringify(x)));
const readJSON=p=>JSON.parse(readFileSync(p,'utf8'));
const write=(name,value)=>writeFileSync(join(root,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const v1=readJSON(join(root,'draft-cases-v1-PRIVATE.json'));
const packet1=readJSON(join(root,'blind-review-packet-v1.json'));
const overlay1=readJSON(join(root,'source-overlay-v1.json'));
const pagesRoot=join(root,'ncert');
const ncertDocs={leac206:{url:'https://ncert.nic.in/textbook/pdf/leac206.pdf',pdf:`${pagesRoot}/leac206.pdf`,pages:`${pagesRoot}/leac206.pages.json`},lebs106:{url:'https://ncert.nic.in/textbook/pdf/lebs106.pdf',pdf:`${pagesRoot}/lebs106.pdf`,pages:`${pagesRoot}/lebs106.pages.json`},lebs203:{url:'https://ncert.nic.in/textbook/pdf/lebs203.pdf',pdf:`${pagesRoot}/lebs203.pdf`,pages:`${pagesRoot}/lebs203.pages.json`},leec202:{url:'https://ncert.nic.in/textbook/pdf/leec202.pdf',pdf:`${pagesRoot}/leec202.pdf`,pages:`${pagesRoot}/leec202.pages.json`}};
const pageData=Object.fromEntries(Object.entries(ncertDocs).map(([id,s])=>[id,readJSON(s.pages)]));
const page=(doc,n)=>{const x=pageData[doc].find(p=>p.page===n);if(!x?.text)throw Error(`page_text_missing:${doc}:${n}`);return x.text;};
function exact(doc,n,start,end){const t=page(doc,n),a=t.indexOf(start);if(a<0)throw Error(`quote_start_missing:${doc}:${n}:${start}`);const b=end?t.indexOf(end,a+start.length):-1;if(end&&b<0)throw Error(`quote_end_missing:${doc}:${n}:${end}`);const stop=end?b+end.length:a+start.length;const quote=t.slice(a,stop);if(!quote.trim()||t.indexOf(quote)!==a)throw Error(`quote_not_exact:${doc}:${n}`);return {doc,page:n,quote,start:a,end:stop};}
const excerpts={
  ac_cash:exact('leac206',3,'Cash equivalents’ means short-term highly liquid investments','from the date of acquisition.'),
  ac_shares:exact('leac206',3,'Investments in shares are excluded from cash equivalents','unless they are in substantial cash equivalents.'),
  ac_operating:exact('leac206',4,'Operating activities are the activities that constitute the primary or main activities of an enterprise.','not investing or financing activities.'),
  ac_operating_examples:exact('leac206',4,'Examples of cash flows from operating activities are:','Cash payments to suppliers for goods and services.'),
  ac_investing_disposal:exact('leac206',5,'Examples of cash flows arising from investing activities are:','Cash receipt from disposal of fixed assets including intangibles.'),
  ac_investing_purchase:exact('leac206',5,'Cash payments to acquire fixed assets including intangibles','capitalised research and development.'),
  ac_financing:exact('leac206',5,'financing activities relate to long-term funds or capital of an enterprise','repayment of bank loan, etc.'),
  ac_purpose:exact('leac206',2,'The primary objective of cash flow statement','financing activities.'),
  bs_staffing:exact('lebs106',2,'Staffing has been described as','organisation structure.'),
  bs_training:exact('lebs106',28,'Training is any process by which the aptitudes, skills and abilities','specific jobs are increased.'),
  bs_rights_1_3:exact('lebs203',7,'These rights include the following:','from amongst these.'),
  bs_rights_4_6:exact('lebs203',8,'4. Right to be heard:','consumers in this respect.'),
  ec_mu:exact('leec202',2,'Marginal utility (MU) is the change in total utility','Therefore, marginal utility of the 5th banana is 2 units.'),
  ec_dmu:exact('leec202',3,'marginal utility from consuming each additional unit of a commodity declines as its consumption increases,','while keeping consumption of other commodities constant.'),
  ec_ordinal:exact('leec202',4,'Cardinal utility analysis is simple to understand, but suffers from a major drawback in the form of quantification of utility in numbers.','Ordinal Utility Analysis.'),
  ec_indifference:exact('leec202',6,'All points on an indifference curve represent bundles','by the consumer.'),
  ec_place_time:exact('leec202',2,'utility that one individual gets from the commodity can change with change in place and time.','summer or winter (time).'),
};

// The four passages were authored in the V1 construction source after the freezes. V1's tuple assembly
// omitted them from four valid candidates; this file restores the authored text without changing stems/options.
const passages={
  library:'Every afternoon, Mira opened the reading-room windows for twenty minutes before shelving returned books. Once a week she checked the paper strips placed inside the map boxes. When a strip felt damp, she moved that box away from the outside wall and entered the move in a ledger. No map had yet been damaged. When a donor asked whether the old maps were safe, Mira replied that these steps reduced the risk; they could not remove it entirely.',
  ferry:'At the river landing, Dev kept a small board listing the ferry times. The printed timetable had been washed away in the monsoon, so he copied the operator’s new schedule in chalk each morning. When the current grew too strong, the operator cancelled the noon crossing and Dev crossed that line through. A visitor complained that the board had changed. Dev pointed to the fresh date written at the top and said that an accurate change was more useful than a familiar but unsafe promise.',
  orchard:'Leela’s first harvest came in uneven batches. Rather than send every basket to market at once, she asked buyers to choose a collection window and wrote each promise beside the buyer’s name. The first week, one buyer arrived early. Leela did not scold him; she showed him the list and offered the next available slot. By the end of the month, buyers had begun checking the list before setting out. Leela kept the system because it made small delays visible while there was still time to adjust.',
  workshop:'When the village clock stopped, Arun carried it to the repair room and placed its screws in a shallow tray. His apprentice wanted to replace the whole mechanism immediately. Arun first asked her to compare the movement of the second hand with the sound of the escapement. They found a thread caught near one gear. After removing it, they watched the clock for an hour before declaring the repair complete. The apprentice later said the waiting had taught her as much as the repair.'
};
const originalStimuli={schema:'v77-original-stimuli-v2',authored_at:v1.case_construction_started_at,restored_at:new Date().toISOString(),note:'Passage text is copied exactly from the authored source embedded in construct-v77-final.mjs. Four passages were omitted from valid V1 packet objects by tuple assembly; V2 restores those exact originals and retains the original V1 IDs and stems/options.',passages};
const stimulusPath=join(root,'original-stimuli-v2.json');if(existsSync(stimulusPath)){const priorStimuli=readJSON(stimulusPath);if(hashJSON(priorStimuli.passages)!==hashJSON(passages))throw Error('preexisting_original_stimuli_v2_mismatch');}else write('original-stimuli-v2.json',originalStimuli);
const originalIdentity=hashJSON(passages);

const rightsRefKeys=['bs_right_safety','bs_right_informed','bs_right_choose','bs_right_heard','bs_right_redressal','bs_right_education'];
const keysByCase={
  'v77f-ad344a8b5f2d':['ac_cash'], 'v77f-2105354e5de1':['ac_operating','ac_operating_examples','ac_investing_disposal','ac_financing'],
  'v77f-662880a2c5fb':['ac_purpose'], 'v77f-073bdc31e03c':['ac_investing_purchase','ac_operating','ac_financing'],
  'v77f-3546cbf8ea19':['bs_staffing'], 'v77f-c6d21440345d':['bs_training'],
  'v77f-a20de9004938':['bs_rights_1_3','bs_rights_4_6'],
  'v77f-9a31e9a4c29b':['bs_rights_1_3','bs_rights_4_6'],
  'v77f-ea8f75b17d74':['ec_mu'], 'v77f-b123137834cc':['ec_ordinal'],
  'v77f-466fab2284fd':['ec_indifference'], 'v77f-2d806114710e':['ec_place_time'],
  'v77f-4c09b80e91ce':['english:library'], 'v77f-a99cc144f9e5':['english:library'],
  'v77f-1ed13162f85d':['english:ferry'], 'v77f-dfcca21b749e':['english:orchard'],
  'v77f-84e9ba57542c':['ac_operating','ac_operating_examples','ac_investing_disposal','ac_financing'],
  'v77f-59b58a25bbb3':['ac_cash'], 'v77f-e77493e30567':['ac_operating','ac_operating_examples'],
  'v77f-1db3dc389725':['bs_staffing'],
  'v77f-e9ef75026c19':['bs_rights_1_3','bs_rights_4_6'],
  'v77f-3e505228c987':['bs_staffing'],
  'v77f-63d002be451c':['ec_mu'], 'v77f-98a231fa15fa':['ec_dmu'], 'v77f-fcf957a734d5':['ec_ordinal'],
  'v77f-c519f01371f2':['english:workshop'], 'v77f-2ca94e8b4e72':['english:ferry'], 'v77f-56f266269b74':['english:workshop']
};

const oldSyllabus=readJSON('artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-source-prep/blind-syllabus-v1.json');
const sourceRegistry=readJSON('data/source_registry.json');
const syllabusTerms={accountancy:['Cash Flow Statement'],business_studies:['Unit VI: Staffing','Unit XII: Consumer Protection'],economics:['Unit I: Introduction, Theory of Consumer Behaviour'],english:['There will be three types of passages','b. Narrative']};
function syllabusPages(subject){const src=sourceRegistry.sources[`cuet2026-${subject}-syllabus`];const full=src.facts['full-syllabus'].text;const pages=full.split(/(?=PAGE \d+\r?\n)/).filter(Boolean);return syllabusTerms[subject].map(term=>{const normalized=term.toLowerCase().replace(/\s+/g,'\\s+');const re=new RegExp(normalized,'i');const raw=pages.find(x=>re.test(x));if(!raw)throw Error(`syllabus_term_missing:${subject}:${term}`);const pageNo=Number(raw.match(/^PAGE (\d+)/)?.[1]);return{physical_pdf_page:pageNo,text:raw.trim(),matched_term:term};});}
const blindSyllabus={schema:'v77-blind-syllabus-v2',created_at:new Date().toISOString(),subjects:{}};
mkdirSync(join(root,'syllabus-v2'),{recursive:true});
for(const subject of ['accountancy','business_studies','economics','english']){
 const sourceId=`cuet2026-${subject}-syllabus`,reg=sourceRegistry.sources[sourceId];
 const priorPdf=join(root,'syllabus',`${subject}.pdf`),copiedPdf=join(root,'syllabus-v2',`${subject}.pdf`);if(!existsSync(priorPdf))throw Error(`verified_syllabus_pdf_missing:${subject}`);if(existsSync(copiedPdf)){if(sha(readFileSync(copiedPdf))!==reg.identity_sha256)throw Error(`preexisting_syllabus_copy_mismatch:${subject}`);}else copyFileSync(priorPdf,copiedPdf);if(sha(readFileSync(copiedPdf))!==reg.identity_sha256)throw Error(`syllabus_pdf_identity_mismatch:${subject}`);
 blindSyllabus.subjects[subject]={exam_spec:oldSyllabus[subject].exam_spec,syllabus_excerpt:syllabusPages(subject),syllabus_source:{id:sourceId,url:reg.url,pdf_identity_sha256:reg.identity_sha256,extraction_file:reg.extraction_file,extraction_sha256:reg.extraction_sha256,copied_pdf:`${root}/syllabus-v2/${subject}.pdf`},format_reference:packet1.format_reference[subject]};
}

// Add source records with exact raw page substring, one physical PDF page per citation.
const sourceRows={};
for(const [key,x]of Object.entries(excerpts)){
 const d=ncertDocs[x.doc],base=`v77v2src-${x.doc}-p${x.page}-${key}`;
 sourceRows[key]={id:base,kind:'reference',state:'active',version:1,title:x.doc,source_url:d.url,identity_sha256:sha(readFileSync(d.pdf)),extraction_file:d.pages,extraction_sha256:sha(readFileSync(d.pages)),physical_pdf_page:x.page,raw_start_offset:x.start,raw_end_offset:x.end,exact_quote:x.quote,source_pack_id:`v77-final-v2-pack-${x.doc==='leac206'?'accountancy':x.doc.startsWith('lebs')?'business_studies':'economics'}`,permission:{basis:'Attributed official NCERT source for local educational validation; no unrestricted republication claim'}};
}
const syllabusSourceRows={};
for(const subject of ['accountancy','business_studies','economics','english']){
 const r=blindSyllabus.subjects[subject].syllabus_source;
 const k=`syllabus_${subject}`;
 syllabusSourceRows[k]=blindSyllabus.subjects[subject].syllabus_excerpt.map((pg,i)=>({id:`v77v2src-${k}-p${pg.physical_pdf_page}`,kind:'syllabus',state:'active',version:1,title:`CUET UG 2026 ${subject} syllabus`,source_url:r.url,identity_sha256:r.pdf_identity_sha256,extraction_file:r.extraction_file,extraction_sha256:r.extraction_sha256,physical_pdf_page:pg.physical_pdf_page,exact_quote:pg.text,source_pack_id:`v77-final-v2-pack-${subject}`,permission:{basis:'Official CUET 2026 syllabus copy used only for local benchmark entitlement review'}}));
}
const englishRows={};
for(const [name,text]of Object.entries(passages))englishRows[`english:${name}`]={id:`v77v2src-english-${name}`,kind:'authored-stimulus',state:'active',version:1,title:`Original V77 narrative stimulus: ${name}`,source_url:null,identity_sha256:originalIdentity,locator:name,exact_quote:text,source_pack_id:'v77-final-v2-pack-english',permission:{basis:'Original locally authored source text; no third-party or PYQ passage claim'}};

const learning={
 'v77f-ad344a8b5f2d':['Analysis of Financial Statements','Determine cash-equivalent eligibility using liquidity, risk, and maturity from acquisition.',null,'The choice requires applying the three-month maturity ceiling and the liquid, low-risk criteria to the deposit.'],
 'v77f-2105354e5de1':['Analysis of Financial Statements','Classify cash receipts from core sales and disposal of a long-term asset.',null,'The answer requires distinguishing principal revenue activity from disposal of a fixed asset and excluding financing.'],
 'v77f-662880a2c5fb':['Analysis of Financial Statements','Explain the purpose of the three cash-flow activity headings.',null,'The answer depends on the statement’s stated objective and its operating, investing, and financing classification.'],
 'v77f-073bdc31e03c':['Analysis of Financial Statements','Classify cash payments to acquire long-term fixed assets.',null,'The answer requires applying the investing-activity rule and distinguishing it from operating and financing categories.'],
 'v77f-3546cbf8ea19':['Staffing','Identify staffing as the function that fills positions after workforce requirements are identified.',null,'The sequence in the stem matches the defined staffing function.'],
 'v77f-c6d21440345d':['Staffing','Recognise training and development as a staffing activity that upgrades skills and prepares staff for responsibility.',null,'The stem describes the purpose of staff training and development.'],
 'v77f-a20de9004938':['Consumer Protection','Distinguish the right to seek redressal from the other consumer rights.',null,'The requested relief after a shortfall is the defining outcome of redressal; all named rights are supplied for comparison.'],
 'v77f-9a31e9a4c29b':['Consumer Protection','Identify the right to be heard when a dissatisfied consumer files a complaint.',null,'The answer depends on the right’s explicit complaint-and-hearing description, distinguished from relief/redressal.'],
 'v77f-ea8f75b17d74':['Introductory Microeconomics','Calculate marginal utility as the change in total utility from one additional unit.',null,'The fifth-unit answer requires subtracting the four-unit total utility from the five-unit total utility.'],
 'v77f-b123137834cc':['Introductory Microeconomics','Identify ordinal utility analysis from ranking bundles without numerical utility measurement.',null,'The answer requires distinguishing ranking from cardinal numerical measurement.'],
 'v77f-466fab2284fd':['Introductory Microeconomics','Interpret points on one indifference curve as bundles the consumer regards as indifferent.',null,'The answer follows from the definition of an indifference curve.'],
 'v77f-2d806114710e':['Introductory Microeconomics','Recognise that utility may vary with place and time for the same individual.',null,'Both location and season in the scenario instantiate the stated contextual variation.'],
 'v77f-4c09b80e91ce':['Reading Comprehension','Infer the meaning of a word from a narrative context.','ledger','The meaning must be inferred from Mira entering each preventive move into it.'],
 'v77f-a99cc144f9e5':['Reading Comprehension','Infer a character’s purpose from details in a narrative passage.',null,'The answer requires connecting preventive checks and recording before any damage occurred.'],
 'v77f-1ed13162f85d':['Reading Comprehension','Retrieve an explicit event and its reason from a narrative passage.',null,'The passage directly states the cancellation and the unsafe current.'],
 'v77f-dfcca21b749e':['Reading Comprehension','Identify a narrative’s central practical purpose from supporting details.',null,'The final sentence states the purpose of the list, and earlier details illustrate it.'],
 'v77f-84e9ba57542c':['Analysis of Financial Statements','Classify cash receipts from core sales and disposal of a long-term asset.',null,'This is the same customer-receipt versus fixed-asset-disposal objective as its disclosed root control.'],
 'v77f-59b58a25bbb3':['Analysis of Financial Statements','Determine cash-equivalent eligibility using maturity, liquidity, and risk.',null,'The candidate deliberately withholds the decisive maturity period from acquisition.'],
 'v77f-e77493e30567':['Analysis of Financial Statements','Calculate net operating cash from specified receipts and payments.',null,'The calculation requires subtracting payments to suppliers from customer receipts.'],
 'v77f-1db3dc389725':['Staffing','Recognise the staffing function from workforce requirement, recruitment, selection, and placement.',null,'This is the same staffing-sequence objective as its disclosed root control.'],
 'v77f-e9ef75026c19':['Consumer Protection','Distinguish consumer rights when a complaint and a demand for relief occur together.',null,'The scenario intentionally invokes both hearing and redressal; it is retained as a defect candidate for blind review.'],
 'v77f-3e505228c987':['Staffing','Assess whether an advanced named method is within the published CUET scope.',null,'The stem requires a specialised statistical method rather than the listed staffing objectives; label remains provisional pending independent review.'],
 'v77f-63d002be451c':['Introductory Microeconomics','Calculate marginal utility from consecutive total-utility values.',null,'This is the same fifth-unit computation and values as its disclosed root control.'],
 'v77f-98a231fa15fa':['Introductory Microeconomics','Apply diminishing marginal utility with the stated ceteris-paribus condition.',null,'The law itself requires other-commodity consumption to be held constant, which the stem omits.'],
 'v77f-fcf957a734d5':['Introductory Microeconomics','Identify ordinal utility analysis from ranking bundles without numerical measurement.',null,'This is the same ranking-versus-numerical-measurement objective as its disclosed root control.'],
 'v77f-c519f01371f2':['Reading Comprehension','Retrieve a specific narrative detail.',null,'The answer depends on the passage’s explicit comparison request.'],
 'v77f-2ca94e8b4e72':['Reading Comprehension','Infer a target word’s contextual meaning and verify explanation support.','fresh','The answer depends on the date written that morning; the additional paint claim is not established by the passage.'],
 'v77f-56f266269b74':['Reading Comprehension','Apply reading-comprehension scope to a narrative-passage route.',null,'The question instead requires a technical grammar label; the scope label is retained for independent audit.']
};

const familyIds={
 'v77f-2105354e5de1':'v77-final-v2-family-customer-receipts-machine-sale','v77f-84e9ba57542c':'v77-final-v2-family-customer-receipts-machine-sale',
 'v77f-3546cbf8ea19':'v77-final-v2-family-workforce-staffing-sequence','v77f-1db3dc389725':'v77-final-v2-family-workforce-staffing-sequence',
 'v77f-ea8f75b17d74':'v77-final-v2-family-marginal-utility-28-30','v77f-63d002be451c':'v77-final-v2-family-marginal-utility-28-30',
 'v77f-b123137834cc':'v77-final-v2-family-ordinal-ranking','v77f-fcf957a734d5':'v77-final-v2-family-ordinal-ranking',
 'v77f-a20de9004938':'v77-final-v2-family-consumer-rights','v77f-9a31e9a4c29b':'v77-final-v2-family-consumer-rights','v77f-e9ef75026c19':'v77-final-v2-family-consumer-rights',
 'v77f-ad344a8b5f2d':'v77-final-v2-family-cash-equivalent-eligibility','v77f-59b58a25bbb3':'v77-final-v2-family-cash-equivalent-eligibility',
 'v77f-4c09b80e91ce':'v77-final-v2-family-library-passage','v77f-a99cc144f9e5':'v77-final-v2-family-library-passage',
 'v77f-1ed13162f85d':'v77-final-v2-family-ferry-passage','v77f-2ca94e8b4e72':'v77-final-v2-family-ferry-passage',
 'v77f-c519f01371f2':'v77-final-v2-family-workshop-passage','v77f-56f266269b74':'v77-final-v2-family-workshop-passage'
};
const passageFor={
 'v77f-4c09b80e91ce':'library','v77f-a99cc144f9e5':'library','v77f-1ed13162f85d':'ferry','v77f-dfcca21b749e':'orchard',
 'v77f-c519f01371f2':'workshop','v77f-2ca94e8b4e72':'ferry','v77f-56f266269b74':'workshop'
};
const resolvedExcerpts={...excerpts};
function citationsFor(c){const base=keysByCase[c.id].map(key=>{
 if(key.startsWith('english:')){const name=key.split(':')[1];const quote=passages[name];return{id:englishRows[key].id,version:1,locator:`original-stimulus:${name}`,support_hash:hashJSON(quote)};}
 const x=resolvedExcerpts[key];const quote=x.quote;return{id:sourceRows[key].id,version:1,locator:`physical-pdf-page-${x.page}`,support_hash:hashJSON(quote)};
});
const subject=c.subject==='business_studies'?'business_studies':c.subject;
return [...base,...syllabusSourceRows[`syllabus_${subject}`].map(s=>({id:s.id,version:1,locator:`CUET-2026-syllabus-physical-page-${s.physical_pdf_page}`,support_hash:hashJSON(s.exact_quote)}))];}
const questionTypeById={
 'v77f-ad344a8b5f2d':'conceptual_mcq','v77f-2105354e5de1':'application_based','v77f-662880a2c5fb':'conceptual_mcq','v77f-073bdc31e03c':'application_based','v77f-84e9ba57542c':'application_based','v77f-59b58a25bbb3':'conceptual_mcq','v77f-e77493e30567':'numerical_one_step',
 'v77f-3546cbf8ea19':'concept_identification','v77f-c6d21440345d':'case_application','v77f-a20de9004938':'case_application','v77f-9a31e9a4c29b':'case_application','v77f-1db3dc389725':'case_application','v77f-e9ef75026c19':'case_application','v77f-3e505228c987':'concept_identification',
 'v77f-ea8f75b17d74':'numerical_calculation','v77f-b123137834cc':'direct_recall','v77f-466fab2284fd':'direct_recall','v77f-2d806114710e':'direct_recall','v77f-63d002be451c':'numerical_calculation','v77f-98a231fa15fa':'direct_recall','v77f-fcf957a734d5':'direct_recall',
 'v77f-4c09b80e91ce':'vocabulary_in_context','v77f-a99cc144f9e5':'passage_comprehension','v77f-1ed13162f85d':'passage_comprehension','v77f-dfcca21b749e':'passage_comprehension','v77f-c519f01371f2':'passage_comprehension','v77f-2ca94e8b4e72':'vocabulary_in_context','v77f-56f266269b74':'passage_comprehension'
};
const casesV2=v1.cases.map(old=>{
 const c=structuredClone(old),cand=c.candidate;
 const passKey=passageFor[c.id],passage=passKey?passages[passKey]:null;
 const refs=citationsFor(c);
 const [unit,objective,target,why]=learning[c.id];
 cand.route=cand.subject==='english'?'passage':(cand.route==='numerical'||cand.question_type?.startsWith('numerical')?'numerical':'conceptual');
 cand.question_type=questionTypeById[c.id];if(!cand.question_type)throw Error(`question_type_mapping_missing:${c.id}`);
 if(cand.subject==='english')c.chapter='Narrative Passage';
 cand.options=cand.options.map((text,i)=>({key:'ABCD'[i],text}));
 cand.passage_text=passage;
 cand.family_id=familyIds[c.id]||`v77-final-v2-family-${c.id}`;
 cand.source_refs=refs;
 cand.learning_objective={syllabus_unit:unit,objective,target_term:target,why_answer_requires_it:why};
 cand.provenance={kind:'original_practice',anchor_id:refs[0].id,adaptation_family:cand.family_id,adaptation_type:'source-grounded-original-practice',syllabus_version:'cuet-2026',pattern_version:'cuet-2024-authenticated-bookA-v1',source_pack_id:`v77-final-v2-pack-${cand.subject}`,source_pack_version:1};
 c.oracle.source_refs=refs;
 const invalidUniqueKeys={'v77f-84e9ba57542c':'A','v77f-1db3dc389725':'A','v77f-e77493e30567':'A','v77f-63d002be451c':'A','v77f-fcf957a734d5':'B','v77f-c519f01371f2':'A','v77f-2ca94e8b4e72':'A','v77f-56f266269b74':'A'};
 if(Object.hasOwn(invalidUniqueKeys,c.id))c.oracle.key=invalidUniqueKeys[c.id];
 if(c.id==='v77f-e9ef75026c19'){c.oracle.key=null;c.oracle.defensible_answers=['A','B'];}
 if(c.id==='v77f-59b58a25bbb3'){c.oracle.key=null;c.oracle.defensible_answers=['A','B'];}
 if(c.id==='v77f-98a231fa15fa'){c.oracle.key=null;c.oracle.key_status='underdetermined';delete c.oracle.defensible_answers;}
 if(c.id==='v77f-56f266269b74'){
   c.category='unsupported_source_and_objective_mismatch';
   c.oracle.basis='The item asks for a technical grammar label while this candidate is routed and sourced as a Narrative Passage task. The supplied CUET syllabus says its language topics are not limited to the examples listed; this label rests on source and objective mismatch, not a categorical claim that grammar is out of syllabus.';
 }
 c.source_item_id=refs[0].id;
 c.case_v1_sha256=hashJSON(old);
 c.case_v2_sha256=hashJSON(c);
 return c;
});

const familyCaseMap={};for(const c of casesV2)(familyCaseMap[c.candidate.family_id]||=[]).push(c.id);
for(const c of casesV2){const prior=v1.cases.find(x=>x.id===c.id);if(c.expected_valid!==prior.expected_valid)throw Error(`expected_valid_changed:${c.id}`);}
const familyDisclosure={schema:'v77-case-lineage-v2',created_at:new Date().toISOString(),claim_boundary:'The 28 cases are not 28 independent semantic roots. The reviewer found four root-mutant pairs and additional within-objective/passage relationships; these are disclosed as families and remain correlated evidence.',review_source:'execution/v77-final-source-prep/freshness-review-v1.json',families:Object.entries(familyCaseMap).map(([id,case_ids])=>({id,case_ids,relationship:case_ids.length>1?'shared source, passage, objective, or reviewer-flagged root-mutant relationship':'single case lineage; no independence claim'})),reviewer_flagged_mutant_pairs:[['v77f-2105354e5de1','v77f-84e9ba57542c'],['v77f-3546cbf8ea19','v77f-1db3dc389725'],['v77f-ea8f75b17d74','v77f-63d002be451c'],['v77f-b123137834cc','v77f-fcf957a734d5']],reviewer_flagged_objective_overlap:['v77f-a20de9004938','v77f-9a31e9a4c29b','v77f-e9ef75026c19']};

const familyObj={};for(const [id,case_ids]of Object.entries(familyCaseMap))familyObj[id]={id,kind:'original-practice-family',version:1,case_ids,correlated:case_ids.length>1};
const overlaySources={};for(const [k,s]of Object.entries(sourceRows))overlaySources[s.id]={id:s.id,kind:s.kind,state:s.state,version:s.version,title:s.title,url:s.source_url,identity_sha256:s.identity_sha256,extraction_file:s.extraction_file,extraction_sha256:s.extraction_sha256,source_pack_id:s.source_pack_id,facts:{[s.physical_pdf_page?`physical-pdf-page-${s.physical_pdf_page}`:'source']:{text:s.exact_quote}},supports:{[s.physical_pdf_page?`physical-pdf-page-${s.physical_pdf_page}`:'source']:hashJSON(s.exact_quote)},permission:s.permission,physical_pdf_page:s.physical_pdf_page,raw_start_offset:s.raw_start_offset,raw_end_offset:s.raw_end_offset};
for(const rows of Object.values(syllabusSourceRows))for(const s of rows)overlaySources[s.id]={id:s.id,kind:s.kind,state:s.state,version:s.version,title:s.title,url:s.source_url,identity_sha256:s.identity_sha256,extraction_file:s.extraction_file,extraction_sha256:s.extraction_sha256,physical_pdf_page:s.physical_pdf_page,source_pack_id:s.source_pack_id,facts:{[`physical-pdf-page-${s.physical_pdf_page}`]:{text:s.exact_quote}},supports:{[`physical-pdf-page-${s.physical_pdf_page}`]:hashJSON(s.exact_quote)},permission:s.permission};
for(const s of Object.values(englishRows))overlaySources[s.id]={id:s.id,kind:s.kind,state:s.state,version:s.version,title:s.title,url:s.source_url,identity_sha256:s.identity_sha256,source_pack_id:s.source_pack_id,facts:{[s.locator]:{text:s.exact_quote}},supports:{[s.locator]:hashJSON(s.exact_quote)},permission:s.permission};
const packObj={};for(const subject of ['accountancy','business_studies','economics','english'])packObj[`v77-final-v2-pack-${subject}`]={id:`v77-final-v2-pack-${subject}`,version:1,state:'active',subject,source_ids:Object.values(overlaySources).filter(s=>s.source_pack_id===`v77-final-v2-pack-${subject}`).map(s=>s.id),syllabus_source_ids:syllabusSourceRows[`syllabus_${subject}`].map(s=>s.id),format_reference:packet1.format_reference[subject]};
const overlayV2={schema:'v77-final-source-overlay-v2',created_at:new Date().toISOString(),parent_overlay:'source-overlay-v1.json',parent_overlay_sha256:sha(readFileSync(join(root,'source-overlay-v1.json'))),contract_freeze_sha256:v1.contract_freeze_sha256,transport_freeze_sha256:v1.transport_freeze_sha256,sources:overlaySources,families:familyObj,packs:packObj};

const draftV2={schema:'v77-final-private-draft-v2',created_at:new Date().toISOString(),parent_draft:'draft-cases-v1-PRIVATE.json',parent_draft_sha256:sha(readFileSync(join(root,'draft-cases-v1-PRIVATE.json'))),case_construction_started_at:v1.case_construction_started_at,v2_correction_started_at:new Date().toISOString(),contract_freeze_sha256:v1.contract_freeze_sha256,validation_contract_hash:v1.validation_contract_hash,transport_freeze_sha256:v1.transport_freeze_sha256,scope:'Additive schema/source/passage correction. V1 IDs, stems, options, proposed answers, explanations, labels, and defect categories are carried forward unchanged. No study registration or native evaluation.',cases:casesV2};
const changes=casesV2.map((c,i)=>({case_id:c.id,v1_sha256:hashJSON(v1.cases[i]),v2_sha256:c.case_v2_sha256,changes:['source_refs replaced with exact contiguous source spans and JSON support hashes','candidate route and question_type normalized to factory schema','learning_objective normalized to structured object','options represented as keyed objects in original order','provenance bound to active source pack and family','family_id bound to disclosed lineage family',...(c.candidate.passage_text!==v1.cases[i].candidate.passage_text?['passage_text restored from original authored stimulus']:[])] ,semantic_preservation:{stem_unchanged:true,option_text_and_order_unchanged:true,proposed_answer_unchanged:true,label_and_defect_category_unchanged:true}}));

const blindCases=casesV2.map(c=>({id:c.id,subject:c.subject,chapter:c.chapter,body:c.candidate.body,options:c.candidate.options,difficulty:c.candidate.difficulty,passage_text:c.candidate.passage_text,route:c.candidate.route,question_type:c.candidate.question_type,learning_objective:c.candidate.learning_objective,sources:c.candidate.source_refs.map(r=>{const s=overlaySources[r.id];return{id:r.id,version:r.version,locator:r.locator,quote:s.facts[Object.keys(s.facts)[0]].text,source_url:s.url||null,identity_sha256:s.identity_sha256};})}));
const comparatorTypes={accountancy:['conceptual_mcq','application_based','numerical_one_step'],business_studies:['case_application','concept_identification'],economics:['direct_recall','numerical_calculation'],english:['passage_comprehension','vocabulary_in_context']};
const comparatorRefs={};
for(const subject of Object.keys(comparatorTypes))for(const type of comparatorTypes[subject]){
 const ex=sourceRegistry.examples.find(e=>e.subject===subject&&e.year===2024&&e.question_type===type&&e.generation_ready===true)||sourceRegistry.examples.find(e=>e.subject===subject&&e.year===2024&&e.question_type===type);
 if(!ex)throw Error(`authenticated_format_comparator_missing:${subject}:${type}`);
 const paper=sourceRegistry.sources[ex.source_id];if(!paper||paper.authentication?.type!=='corroborated_mirror')throw Error(`comparator_authentication_not_verified:${ex.source_id}`);
 comparatorRefs[`${subject}:${type}`]={id:ex.id,subject,question_type:type,year:2024,body:ex.body,options:ex.options,passage_text:ex.passage_text||null,paper_reference:{source_id:paper.id,source_url:paper.url,identity_sha256:paper.identity_sha256,authentication_class:paper.authentication.type,catalog_url:paper.authentication.catalog?.url||null,catalog_quote:paper.authentication.catalog?.quote||null},use:'Format calibration only for original practice; not a claim that this candidate or its content is an authenticated PYQ.'};
}
const blindV2={schema:'v77-final-blind-review-v2',created_at:new Date().toISOString(),parent_packet:'blind-review-packet-v1.json',parent_packet_sha256:sha(readFileSync(join(root,'blind-review-packet-v1.json'))),case_construction_started_at:v1.case_construction_started_at,v2_correction_started_at:new Date().toISOString(),contract_freeze_sha256:v1.contract_freeze_sha256,validation_contract_hash:v1.validation_contract_hash,transport_freeze_sha256:v1.transport_freeze_sha256,instructions:'Derive answers independently before judging labels. Review every option under its strongest reasonable reading; verify each exact quoted source span, complete decisive support, assumptions, syllabus entitlement, calculations, narrative completeness and presentation. This is a corrected additive V2 of V1; IDs and option text/order are preserved. Do not assume cases are independent where they share a disclosed source family.',syllabus_file:'blind-syllabus-v2b.json',syllabus:blindSyllabus.subjects,format_reference:packet1.format_reference,authenticated_format_comparators:comparatorRefs,lineage_file:'case-lineage-v2b.json',cases:blindCases};

const copyManifest1=readJSON(join(root,'exact-source-copies-manifest-v1.json'));
const copyManifestV2={schema:'v77-final-exact-source-copies-v2',created_at:new Date().toISOString(),parent_manifest:'exact-source-copies-manifest-v1.json',parent_manifest_sha256:sha(readFileSync(join(root,'exact-source-copies-manifest-v1.json'))),files:copyManifest1.files,additional_source_artifacts:[{path:join(root,'original-stimuli-v2.json'),sha256:sha(readFileSync(join(root,'original-stimuli-v2.json'))),kind:'original-authored-source-record'}]};

write('case-lineage-v2b.json',familyDisclosure);
write('draft-cases-v2b-PRIVATE.json',draftV2);
write('source-overlay-v2b.json',overlayV2);
write('blind-review-packet-v2b.json',blindV2);
write('blind-syllabus-v2b.json',blindSyllabus);
write('v1-to-v2b-change-map.json',changes);
write('exact-source-copies-manifest-v2b.json',copyManifestV2);
console.log(JSON.stringify({created_at:blindV2.created_at,counts:Object.fromEntries(['accountancy','business_studies','economics','english'].map(s=>[s,{total:casesV2.filter(c=>c.subject===s).length,passages:casesV2.filter(c=>c.subject===s&&c.candidate.passage_text).length}])),citations:casesV2.reduce((n,c)=>n+c.candidate.source_refs.length,0),families:Object.keys(familyObj).length,original_stimuli_sha256:sha(readFileSync(join(root,'original-stimuli-v2.json'))),packet:'blind-review-packet-v2b.json'}));
