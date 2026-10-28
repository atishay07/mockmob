// Local, zero-model authoring. Dictionary senses come verbatim from licensed WordNet.
// This writes candidates only. Validation and a reviewed migration/import report are separate.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CANONICAL_SYLLABUS } from '../../data/canonical_syllabus.js';
import { CONCEPT_BLUEPRINTS } from '../../data/learning_engine.js';
const sha = value => createHash('sha256').update(value).digest('hex');
const offsets = { candid:'00764484', lucid:'00429355', ambiguous:'00102201', diligent:'00754107', prudent:'01898129', frugal:'02421364', concise:'00546646', obscure:'00431004', resilient:'02280566', meticulous:'00984879', benevolent:'02661446', arbitrary:'00718924', coherent:'00464513', inevitable:'00343015', substantial:'00625055', abundant:'00013887', reluctant:'00811969', obsolete:'00669021', impartial:'01723308', sceptical:'02463847' };
const lines = readFileSync('data/study/sources/dict/data.adj','utf8').split('\n');
const license = readFileSync('data/study/sources/WORDNET-LICENSE.txt','utf8');
const facts = Object.entries(offsets).map(([word, offset]) => {
  const line = lines.find(l => l.startsWith(offset+' '));
  if (!line || !line.split('|')[0].split(' ').includes(word)) throw new Error(`Missing dictionary sense: ${word}`);
  return { word, offset, definition: line.split('|')[1].trim().split('; "')[0], line, sha256:sha(line) };
});
mkdirSync('data/study', { recursive:true });
writeFileSync('data/study/sources/wordnet-excerpts.json',JSON.stringify({ version:'3.0', facts, license },null,2)+'\n');
const sourceRefs = [{id:'wordnet-3.0',url:'https://wordnet.princeton.edu/',label:'WordNet 3.0',permission:'WordNet license',license}, {id:'ncert-admission',url:'https://ncert.nic.in/textbook/pdf/leac102.pdf',label:'NCERT Accountancy: Admission of a Partner, section 2.4',permission:'reference only; MockMob explanations and examples are original'}, {id:'ncert-retirement',url:'https://ncert.nic.in/textbook/pdf/leac103.pdf',label:'NCERT Accountancy: Retirement / Death of a Partner, section 3.3',permission:'reference only; MockMob explanations and examples are original'}];
const vocabulary = {id:'english-vocabulary-01',version:1,subject:'english',chapter:'Vocabulary',conceptId:'vocabulary_context',title:'Twenty words, used precisely',summary:'Build a small, useful vocabulary. Retrieve a meaning or reconstruct a spelling before checking.',estimatedMinutes:6,sourceRefs:[sourceRefs[0]],state:'candidate',blocks:[
  {id:'vocab-method',type:'reading',kind:'explanation',title:'Recall before you look',body:'Read a word, pause and try to say its meaning. Then reveal the answer and grade your recall honestly. For spelling tasks, type the word from its definition. These are learning activities, not scored CUET questions.'},
  {id:'vocab-senses',type:'reading',kind:'contrast',title:'A word can have more than one meaning',body:'This deck names the sense being studied. “Candid” here describes direct speech; in photography it can describe an unposed picture. Read a word in its sentence before deciding which meaning fits.'},
  {id:'vocab-check',type:'choice',kind:'knowledge_check',title:'Check the method',prompt:'When is it most useful to try recalling the meaning?',options:['Before revealing the answer','Only after reading the answer'],answer:0,explanation:'Trying first makes the card a retrieval task. This check is unscored.'}
]};
const cards = facts.map((fact,i) => ({id:`english-word-${fact.word}`,version:1,unitId:vocabulary.id,subject:'english',chapter:'Vocabulary',conceptId:'vocabulary_context',familyId:`study:english:word:${fact.word}:v1`,objective:i%3===2?'Reconstruct the spelling of a word from its meaning':'Recall the selected meaning of a word',type:i%3===2?'text':'reveal',prompt:i%3===2?`Which word means: ${fact.definition}?`:`What does “${fact.word}” mean in this sense?`,answer:i%3===2?fact.word:fact.definition,word:fact.word,explanation:`${fact.word}: ${fact.definition}. This is one selected sense; context can call for another.`,cue:'Say the word, then make your own sentence using this meaning.',sourceFact:fact.offset,sourceRefs:[sourceRefs[0]]}));
const ratio = {id:'accountancy-sacrificing-gaining',version:1,subject:'accountancy',chapter:'Change in Profit Sharing Ratio',conceptId:'sacrificing_gaining',title:'Sacrificing and gaining ratios',summary:'Compare each partner’s old and new shares. Let the change tell you which ratio to use.',estimatedMinutes:6,state:'candidate',sourceRefs:sourceRefs.slice(1),blocks:[
  {id:'ratio-rule',type:'reading',kind:'explanation',title:'Start with the change in share',body:'For each partner, sacrifice = old share − new share. Gain = new share − old share. Use a common denominator before subtracting. A positive sacrifice means the share fell; a negative sacrifice means it rose.'},
  {id:'ratio-worked',type:'reading',kind:'worked_example',title:'Work one partner at a time',body:'A and B used to share 3:2. C joins, and the new ratio A:B:C is 5:3:2. A: 3/5 − 5/10 = 1/10. B: 2/5 − 3/10 = 1/10. A and B sacrifice equally, so the sacrificing ratio is 1:1.',rows:[['Partner','Old share','New share','Sacrifice'],['A','6/10','5/10','1/10'],['B','4/10','3/10','1/10']]},
  {id:'ratio-contrast',type:'reading',kind:'contrast',title:'The old ratio is not a universal shortcut',body:'The old ratio describes the starting shares. The new ratio describes the final shares. Neither automatically describes the change. When a new ratio is given, compare the shares. Use the old ratio as the sacrificing ratio when the incoming share is taken in that ratio.'},
  {id:'ratio-check',type:'choice',kind:'knowledge_check',title:'Try it',prompt:'A partner’s old share is 3/5 and new share is 1/2. What did the partner sacrifice?',options:['1/10','1/2','−1/10','3/5'],answer:0,explanation:'3/5 − 1/2 = 6/10 − 5/10 = 1/10. This is an unscored learning check.'}
]};
cards.push(...[
  ['sacrifice','Complete the formula: sacrifice = …','old share minus new share'],
  ['gain','Complete the formula: gain = …','new share minus old share'],
  ['contrast','When a new sharing ratio is stated, what should you compare?','Each partner’s old share and new share']
].map(([id,prompt,answer]) => ({id:`accountancy-ratio-${id}`,version:1,unitId:ratio.id,subject:'accountancy',chapter:ratio.chapter,conceptId:ratio.conceptId,familyId:`study:accountancy:ratio:${id}:v1`,type:'reveal',objective:'Distinguish a change in share from a sharing ratio',prompt,answer,explanation:'Use a common denominator and calculate the change for each continuing partner.',cue:'Sacrifice looks back: old minus new. Gain looks forward: new minus old.',sourceRefs:ratio.sourceRefs})));
const units = [vocabulary,ratio];
const syllabus = CANONICAL_SYLLABUS.filter(s=>['english','accountancy','economics','business_studies'].includes(s.subject_id)).map(s=>({subject:s.subject_id,title:s.subject_name,chapters:s.units.flatMap(u=>u.chapters.map(c=>({id:`${s.subject_id}:${c}`,title:c,unitTitle:u.unit_name}))),basis:'CUET UG 2026; 2027 provisional'}));
writeFileSync('data/study/pilot.json',JSON.stringify({version:1,units,cards,syllabus,blueprints:CONCEPT_BLUEPRINTS},null,2)+'\n');
console.log(JSON.stringify({units:units.length,englishWords:facts.length,cards:cards.length,state:'candidate',paidCalls:0}));
