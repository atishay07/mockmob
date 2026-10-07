import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {officialTopics} from '../lib/officialTopics.mjs';
import {detailedCoverage} from '../lib/topicCoverage.mjs';
const registry=JSON.parse(readFileSync('data/source_registry.json'));
test('English numbered sections retain exact chapter-specific official phrases',()=>{
 const s=registry.exam_specs.english;
 assert.deepEqual(officialTopics(s,'english','Factual Passage'),['Factual']);
 assert.deepEqual(officialTopics(s,'english','Narrative Passage'),['Narrative']);
 assert.deepEqual(officialTopics(s,'english','Literary Passage'),['Literary']);
 assert.deepEqual(officialTopics(s,'english','Para Jumbles'),['Rearranging the parts']);
 assert.deepEqual(officialTopics(s,'english','Match the Following'),['Match the following']);
 assert.deepEqual(officialTopics(s,'english','Correct Word Usage'),['Choosing the correct word']);
 assert.deepEqual(officialTopics(s,'english','Vocabulary'),['Synonyms','Antonyms']);
 assert.deepEqual(officialTopics(s,'english','Unlisted grammar unit'),[]);
 assert.deepEqual(officialTopics({included_topics:['Reading Comprehension: Narrative']},'english','Factual Passage'),[]);
});
test('English coverage fills an official section only on independent tag agreement',()=>{
 const q=(id,first,second)=>({id,subject:'english',chapter:'Factual Passage',body:'Distinct stimulus question '+id,
  options:['First','Second','Third','Fourth'],correct_answer:'A',explanation:'Stated in the stimulus.',
  question_type:'reading_comprehension',difficulty:'easy',status:'live',score:0,
  evidence:{record:{checks:{blind_solution:{syllabus_topic:first},independent_evaluation:{syllabus_topic:second}}}}});
 const coverage=detailedCoverage([q('agreed','Reading Comprehension: Factual passage','Factual'),
  q('disagreed','Factual','Narrative'),q('missing','Factual',null)],registry,{eligible:()=>({eligible:true})});
 const cell=coverage.cells.find(c=>c.chapter==='Factual Passage');
 assert.equal(cell.usable,3);assert.equal(cell.topics[0].usable,1);assert.equal(cell.topic_unclassified,2);
 assert.deepEqual(cell.topics[0].formats,{reading_comprehension:1});
 assert.deepEqual(cell.topics[0].difficulties,{easy:1});
});
test('Planning selects its official unit, without management keywords importing other units',()=>{
 const topics=officialTopics(registry.exam_specs.business_studies,'business_studies','Planning');assert.ok(topics.some(t=>/Planning process/.test(t)));assert.ok(topics.every(t=>!/Fayol|Consumer|staffing|financial management/i.test(t)));
});
test('the two Accountancy Unit V alternatives remain separate',()=>{
 const finance=officialTopics(registry.exam_specs.accountancy,'accountancy','Cash Flow Statement'),computer=officialTopics(registry.exam_specs.accountancy,'accountancy','Computerized Accounting System');assert.ok(finance.some(t=>/Cash Flow/i.test(t)));assert.ok(computer.some(t=>/Computerised/i.test(t)));assert.ok(finance.every(t=>!/Computerised/i.test(t)));assert.ok(computer.every(t=>!/Cash Flow/i.test(t)));
});
test('repeated Economics unit numbers and the missing colon preserve exact entitlement',()=>{
 const micro=officialTopics(registry.exam_specs.economics,'economics','Introduction & Theory of Consumer Behaviour'),macro=officialTopics(registry.exam_specs.economics,'economics','National Income & Related Aggregates'),reforms=officialTopics(registry.exam_specs.economics,'economics','Economic Reforms Since 1991');assert.ok(micro.some(t=>/Consumer/.test(t)));assert.ok(macro.some(t=>/Circular flow/.test(t)));assert.ok(reforms.some(t=>/liberalisation/.test(t)));assert.ok(micro.every(t=>!/Circular flow/.test(t)));
});
