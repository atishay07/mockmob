import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preferences, recallQueue, createStudyRun, studyTransition, publicStudyItem, istDay, guidedSequence } from '../study_engine.js';
import { scheduleReview } from '../study_scheduler.mjs';
import { canonicalStudyJSON } from '../study_content.js';
import { createHash } from 'node:crypto';
const at=Date.parse('2026-10-04T10:00:00Z');
const cards=Array.from({length:30},(_,i)=>({id:`c${i}`,version:1,type:'reveal',answer:'answer',familyId:`study:${i}`}));
const run=()=>createStudyRun({id:'r',mode:'recall',unitIds:['u'],cardIds:['c0','c1'],at});
const event=(type,revision=0,extras={})=>({type,itemId:'c0',expectedRevision:revision,requestKey:'request-key-1234',...extras});
test('IST introduction boundary and five-card cap do not punish missed days',()=>{
  assert.equal(istDay('2026-10-04T18:29:59Z'),'2026-10-04');assert.equal(istDay('2026-10-04T18:30:00Z'),'2026-10-05');
  assert.equal(recallQueue(cards,[],at).items.length,5);
  assert.equal(recallQueue(cards,[],at,4).items.length,1);
  assert.equal(recallQueue(cards,[],at,5).items.length,0);
  const overdue=cards.slice(0,21).map(c=>({card_id:c.id,content_version:1,schedule:{due:new Date(at-2*86400000).toISOString()}}));
  const queue=recallQueue(cards,overdue,at);assert.equal(queue.pausedNew,true);assert.equal(queue.newAllowance,0);assert.equal(queue.items.length,10);
});
test('corrected cards start a fresh version instead of silently preserving old scheduling claims',()=>{
  const queue=recallQueue([{...cards[0],version:2}],[{card_id:'c0',content_version:1,schedule:{due:new Date(at+86400000).toISOString()}}],at);
  assert.equal(queue.items.length,1);assert.equal(queue.items[0].stored,null);
});
test('guided backlog is shared across subjects and excludes withdrawn or superseded card versions',()=>{
  const at=Date.now(),reviewCards=Array.from({length:21},(_,i)=>({id:`other-${i}`,version:2}));
  const states=reviewCards.map(card=>({card_id:card.id,content_version:2,schedule:{due:new Date(at-172800000).toISOString()}}));
  const selected=[{id:'new-English',version:1}];
  assert.equal(recallQueue(selected,states,at,0,10,reviewCards).newAllowance,0);
  assert.equal(recallQueue(selected,states,at,0,10,reviewCards.map(card=>({...card,version:3}))).newAllowance,5);
  assert.equal(recallQueue(selected,states,at,0,10,[]).newAllowance,5);
});
test('ratings cannot reveal an answer or certify repair',()=>{
  assert.throws(()=>studyTransition(run(),cards[0],event('rate',0,{rating:4})),/INVALID/);
  assert.equal(publicStudyItem(cards[0]).answer,undefined);
  assert.equal(publicStudyItem({...cards[0],explanation:'feedback',sourceFact:'private'}).explanation,undefined);
  assert.equal(publicStudyItem({...cards[0],type:'text',word:'secret',answer:'secret'}).word,undefined);
  const revealed=studyTransition(run(),cards[0],event('reveal')).projection;
  assert.equal(revealed.cursor,0);assert.equal(revealed.feedback.answer,'answer');
  const rated=studyTransition(revealed,cards[0],event('rate',1,{rating:3}));
  assert.equal(rated.rating,3);assert.equal(rated.projection.cursor,1);assert.equal(rated.projection.revealed,false);
  assert.equal(rated.projection.mastery,undefined);assert.equal(rated.projection.repaired,undefined);
});
test('objectively checked answers schedule exactly once and assisted correct answers are Hard',()=>{
  const item={...cards[0],type:'text',answer:'candid',explanation:'Direct speech'};
  const wrong=studyTransition(run(),item,event('answer',0,{value:'candit'}));assert.equal(wrong.rating,1);assert.equal(wrong.projection.feedback.correct,false);
  assert.equal(studyTransition(run(),item,event('answer',0,{value:' CANDID '})).rating,3);
  assert.equal(studyTransition(run(),item,event('answer',0,{value:'candid',assisted:true})).rating,2);
  assert.throws(()=>studyTransition(wrong.projection,item,event('answer',1,{value:'candid'})),/INVALID/);
  const continued=studyTransition(wrong.projection,item,event('continue',1));assert.equal(continued.rating,null);assert.equal(continued.projection.cursor,1);
});
test('invalid keys, stale revisions and wrong steps are recoverable failures',()=>{
  assert.throws(()=>studyTransition(run(),cards[0],event('reveal',9)),/REVISION_CONFLICT/);
  assert.throws(()=>studyTransition(run(),cards[0],{...event('reveal'),itemId:'other'}),/STEP_CONFLICT/);
  assert.throws(()=>studyTransition(run(),cards[0],{...event('reveal'),requestKey:'x'}),/INVALID_REQUEST/);
  const choice={...cards[0],type:'choice',options:['a','b'],answer:0};
  assert.throws(()=>studyTransition(run(),choice,event('answer',0,{value:3})),/INVALID_ANSWER/);
});
test('FSRS persists default parameters, retention target and JSON round trips',()=>{
  const first=scheduleReview(null,3,at);assert.equal(first.schedulerVersion,'fsrs-5.4.2-retention-090-v1');assert.ok(+new Date(first.schedule.due)>at);
  const second=scheduleReview(JSON.parse(JSON.stringify(first.schedule)),1,+new Date(first.schedule.due));assert.equal(second.schedule.reps,2);assert.ok(Number.isFinite(second.schedule.stability));
});
test('Free preferences stay free while saved weekly plans require existing Pro entitlement',()=>{
  const basic=preferences({subjects:['english'],minutes:10});assert.equal(basic.newCardsPerDay,5);assert.equal(basic.revision,1);
  const weekly=Array.from({length:7},()=>({subject:'english',minutes:20}));
  assert.throws(()=>preferences({weeklyPlan:weekly}),/PREMIUM_REQUIRED/);
  assert.deepEqual(preferences({weeklyPlan:weekly},undefined,true).weeklyPlan,weekly);
  assert.throws(()=>preferences({subjects:[]}),/INVALID_SUBJECTS/);assert.throws(()=>preferences({minutes:5}),/INVALID_MINUTES/);
});
test('Today keeps active work and formal checks ahead of recall and allocates a realistic practice block',()=>{
  const study={active:{id:'saved',mode:'learn'},queue:{items:cards.slice(0,2)},nextUnit:{id:'u',title:'Concept'}};
  assert.equal(guidedSequence({primary:{kind:'resume_session',href:'/test'}},study,10)[0].kind,'resume_session');
  assert.equal(guidedSequence({primary:{kind:'fresh_check',href:'/recovery'}},{...study,active:null},10)[0].kind,'fresh_check');
  const sequence=guidedSequence({primary:{kind:'ordinary_practice',href:'/dashboard',title:'Practice'}},{...study,active:null},20);
  assert.deepEqual(sequence.map(s=>s.estimatedMinutes),[4,6,10]);assert.equal(sequence[2].href,'/dashboard?mode=quick&count=10');
  for(const primary of [{kind:'resume_session',href:'/test'},{kind:'fresh_check',href:'/recovery'},{kind:'repair',href:'/repair'}]){
    const steps=guidedSequence({primary},study,20);
    assert.equal(steps.reduce((sum,step)=>sum+step.estimatedMinutes,0),20);
    assert.equal(steps.filter(step=>step.kind==='learn').length,0);
    assert.equal(steps.filter(step=>step.kind==='ordinary_practice').length,0);
  }
  assert.deepEqual(guidedSequence({primary:{kind:'ordinary_practice'}},{...study,active:{id:'saved',mode:'recall'}},20).map(step=>step.kind),['resume_study','learn','ordinary_practice']);
});
test('canonical content digests survive jsonb key ordering and every released item is bound to the current pilot',()=>{
  assert.equal(canonicalStudyJSON({b:[{z:1,a:2}],a:3}),canonicalStudyJSON({a:3,b:[{a:2,z:1}]}));
  const pilot=JSON.parse(readFileSync(new URL('../study/pilot.json',import.meta.url)));
  const release=JSON.parse(readFileSync(new URL('../study/release.json',import.meta.url)));
  assert.ok(pilot.cards.every(c=>c.familyId.startsWith('study:')));
  assert.ok(pilot.units.every(unit=>!unit.checks && !unit.probes));
  for(const unit of pilot.units) assert.equal(release.units[`${unit.id}@${unit.version}`]?.contentHash,createHash('sha256').update(canonicalStudyJSON(unit)).digest('hex'),unit.id);
  for(const card of pilot.cards) assert.equal(release.cards[`${card.id}@${card.version}`]?.contentHash,createHash('sha256').update(canonicalStudyJSON(card)).digest('hex'),card.id);
  assert.ok(Object.values(release.units).every(u=>/no formal recovery certification|WordNet|Original practice passages/.test(u.validation)));
  for(const subject of ['english','accountancy','business_studies','economics']) assert.ok(pilot.units.filter(u=>u.subject===subject).length>=2,subject);
});
