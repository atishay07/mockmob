import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalStudyJSON } from '../../data/study_content.js';
const digest=value=>createHash('sha256').update(canonicalStudyJSON(value)).digest('hex');
const content=JSON.parse(readFileSync('data/study/pilot.json','utf8'));
const dictionary=JSON.parse(readFileSync('data/study/sources/wordnet-excerpts.json','utf8'));
const registry=JSON.parse(readFileSync('data/study/sources/registry.json','utf8'));
for(const unit of content.units){
  if(!content.syllabus.some(subject=>subject.subject===unit.subject && subject.chapters.some(chapter=>chapter.title===unit.chapter)) || !Number.isInteger(unit.version) || unit.version<1 || !unit.conceptId || !unit.blocks.length)throw new Error('INVALID_UNIT_IDENTITY');
  if(!unit.sourceRefs?.length || unit.sourceRefs.some(ref=>!registry.sources[ref.id]?.permission || registry.sources[ref.id].url!==ref.url))throw new Error('UNREGISTERED_SOURCE');
  if(new Set(unit.blocks.map(block=>block.id)).size!==unit.blocks.length)throw new Error('DUPLICATE_BLOCK_ID');
  for(const block of unit.blocks)if(!['reading','choice','text'].includes(block.type) || !['explanation','worked_example','contrast','diagram','knowledge_check'].includes(block.kind))throw new Error('INVALID_STRUCTURED_BLOCK');
}
const report={version:1,validator:'study-source-contract-v1',createdAt:new Date().toISOString(),units:{},cards:{},quarantined:[],scope:'Teaching and recall only; no academic recovery certification or full-syllabus claim',paidCalls:0};
const vocabulary=content.units.find(u=>u.id==='english-vocabulary-01');
const words=content.cards.filter(c=>c.unitId===vocabulary.id);
if(words.length!==20 || new Set(words.map(c=>c.word)).size!==20) throw new Error('TWENTY_DISTINCT_WORDS_REQUIRED');
if(!dictionary.license.includes('Permission to use, copy, modify and distribute')) throw new Error('LICENSE_UNAVAILABLE');
for(const card of words){
  const fact=dictionary.facts.find(f=>f.word===card.word && f.offset===card.sourceFact);
  if(!fact || !fact.line.startsWith(fact.offset+' ') || !fact.line.split('|')[0].split(' ').includes(card.word) || createHash('sha256').update(fact.line).digest('hex')!==fact.sha256 || fact.line.split('|')[1].trim().split('; "')[0]!==fact.definition || card.answer!==(card.type==='text'?fact.word:fact.definition) || card.sourceRefs[0].license!==dictionary.license) throw new Error(`DICTIONARY_SUPPORT_CHANGED:${card.id}`);
  report.cards[`${card.id}@${card.version}`]={contentHash:digest(card),sourceIdentity:`WordNet3.0:adj:${fact.offset}`,sourceHash:fact.sha256};
}
report.units[`${vocabulary.id}@${vocabulary.version}`]={contentHash:digest(vocabulary),sourceIdentity:'WordNet3.0',validation:'Exact selected dictionary senses and spelling keys, licensed attribution present'};
// Teaching requires bound primary-source reconciliation as well as arithmetic.
// This never releases the separate formal recovery pathway or its assessment families.
const ratio=content.units.find(u=>u.conceptId==='sacrificing_gaining');
let ratioProof;
if(existsSync('data/study/sources/ratio-validation.json'))ratioProof=JSON.parse(readFileSync('data/study/sources/ratio-validation.json','utf8'));
const ratioCards=content.cards.filter(c=>c.unitId===ratio.id);
if(ratioProof?.state==='passed' && ratioProof.unitHash===digest(ratio) && ratioCards.every(c=>ratioProof.cards[c.id]===digest(c))){
  report.units[`${ratio.id}@${ratio.version}`]={contentHash:digest(ratio),sourceIdentity:'NCERT2026-27:leac102:2.4;leac103:3.3',validation:'Bound primary-source teaching reconciliation and exact arithmetic; no formal recovery certification'};
  for(const card of ratioCards)report.cards[`${card.id}@${card.version}`]={contentHash:digest(card),sourceIdentity:report.units[`${ratio.id}@${ratio.version}`].sourceIdentity};
}else report.quarantined.push({id:ratio.id,reason:'Primary-source teaching reconciliation missing or content changed; no automatic promotion'});
const allItems=[...content.units.flatMap(u=>u.blocks),...content.cards];
if(new Set(content.cards.map(c=>c.id)).size!==content.cards.length)throw new Error('DUPLICATE_CARD_ID');
for(const item of allItems)if(item.type==='choice' && (!Number.isInteger(item.answer) || !item.options[item.answer]))throw new Error('INVALID_KEY');
for(const card of content.cards)if(!card.familyId.startsWith('study:') || !card.objective || !card.sourceRefs?.length)throw new Error('INVALID_TEACHING_IDENTITY');
mkdirSync('artifacts/study-suite',{recursive:true});
writeFileSync('data/study/release.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('artifacts/study-suite/content-dry-run.json',JSON.stringify(report,null,2)+'\n');
const imports={units:content.units.filter(u=>report.units[`${u.id}@${u.version}`]).map(u=>({id:u.id,version:u.version,subject:u.subject,chapter:u.chapter,concept_id:u.conceptId,content:u,content_hash:digest(u),publication_state:'published'})),cards:content.cards.filter(c=>report.cards[`${c.id}@${c.version}`]).map(c=>({id:c.id,version:c.version,unit_id:c.unitId,unit_version:content.units.find(u=>u.id===c.unitId).version,content:c,content_hash:digest(c)}))};
writeFileSync('artifacts/study-suite/content-import-dry-run.json',JSON.stringify(imports,null,2)+'\n');
console.log(JSON.stringify({validatedUnits:imports.units.length,validatedCards:imports.cards.length,quarantined:report.quarantined,productionWrites:0}));
