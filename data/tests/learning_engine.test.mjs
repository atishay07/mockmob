import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePathway, createEpisode, advanceEpisode, permittedStep, diagnosis, nextProbe, publicEpisode, allowancePeriod, learningPlan, gradeStep } from '../learning_engine.js';
import { newOfferReleased, CAPABILITIES } from '../capabilities.js';
// Software fixture only: deliberately not stored in production content or sources.
export const fixture = () => ({ id:'fixture',subject:'economics',title:'Software fixture',version:1,sourceVersion:'fixture',ruleVersion:1,hypotheses:['a','b'],explanation:'Fixture distinction',workedContrast:'Fixture contrast',
  probes:[1,2,3].map(n => ({id:`probe${n}`,questionId:`p${n}`,familyId:`pf${n}`,contentHash:'fixture',type:'choice',prompt:'Probe?',options:['a','b'],answer:0,matrix:{a:[0],b:[1]}})),
  repair:[{id:'repair',questionId:'r',familyId:'rf',contentHash:'fixture',type:'numeric_step',prompt:'Step?',answer:2,tolerance:0}],
  checks:[1,2,3,4,5,6].map(n => ({id:`check${n}`,questionId:`c${n}`,familyId:`cf${n}`,contentHash:'fixture',type:'choice',prompt:'Check?',options:['a','b'],answer:0})) });
const day=86400000;
function respond(p,e,value,at){ const s=permittedStep(p,e,at);return advanceEpisode(p,e,{itemId:s.id,type:s.type,value},at); }
function repaired(p){let e=createEpisode(p,{id:'e',at:0});e=respond(p,e,0,0);e=respond(p,e,0,0);return respond(p,e,2,0);}
test('hypotheses need two distinct families; conflicts abstain; tie stable ID',()=>{
  const p=fixture();let e=createEpisode(p,{id:'e',at:0});assert.equal(nextProbe(p,[]).id,'probe1');
  e=respond(p,e,0,0);assert.equal(diagnosis(p,e.observations).supported,null);
  e=respond(p,e,1,1);assert.equal(e.state,'repairing');assert.equal(e.diagnosis.conflict,true);
  const observations=[1,2].map(n=>({kind:'probe',itemId:`probe${n}`,value:0}));
  assert.equal(diagnosis({...p,probes:p.probes.map(i=>({...i,familyId:'same'}))},observations).supported,null);
});
test('ambiguous matrix stops at three probes',()=>{
  const p=fixture();p.probes=p.probes.map(i=>({...i,matrix:{a:[0,1],b:[0,1]}}));
  let e=createEpisode(p,{id:'e',at:0});for(let n=0;n<3;n++)e=respond(p,e,0,n);
  assert.equal(e.state,'repairing');assert.equal(nextProbe(p,e.observations),null);
});
test('fresh checks enforce delayed timing, assistance and failure reopening',()=>{
  const p=fixture();let e=repaired(p);e=respond(p,e,0,0);assert.equal(e.nextDueAt,day);
  assert.throws(()=>advanceEpisode(p,e,{itemId:'check2',type:'choice',value:0},day-1),/NOT_DUE/);
  assert.throws(()=>advanceEpisode(p,e,{itemId:'check2',type:'choice',value:0,assisted:true},day),/ASSISTED/);
  e=respond(p,e,0,4*day);assert.equal(e.nextDueAt,5*day);
  e=respond(p,e,0,5*day);assert.equal(publicEpisode(p,e,5*day).evidenceLabel,'Passed two fresh checks');
  e=respond(p,e,1,12*day);assert.equal(e.state,'needs_repair');assert.equal(publicEpisode(p,e,12*day).sampleSize,0);
  e=respond(p,e,2,12*day);assert.equal(permittedStep(p,e,12*day).id,'check5');
});
test('freshness exhausted content and public view never leak keys',()=>{
  const p=fixture();assert.throws(()=>createEpisode(p,{id:'e',at:0,seenFamilies:['cf1']}),/FRESH_CONTENT/);
  assert.throws(()=>createEpisode(p,{id:'e',at:0,seenIds:['p1']}),/FRESH_CONTENT/);
  const view=publicEpisode(p,createEpisode(p,{id:'e',at:0}),0);assert.equal(view.step.answer,undefined);assert.equal(view.step.matrix,undefined);assert.equal(view.checks,undefined);
  const freshView=publicEpisode(p,repaired(p),0);assert.equal(freshView.step.prompt,undefined);assert.equal(freshView.step.options,undefined);
  p.checks=p.checks.slice(0,3);let e=repaired(p);e=respond(p,e,1,0);e=respond(p,e,2,1);e=respond(p,e,1,1);e=respond(p,e,2,2);e=respond(p,e,1,2);e=respond(p,e,2,3);assert.equal(e.state,'blocked_content');
});
test('numeric boundaries and approved alternatives reject arbitrary text',()=>{
  const item={type:'numeric_step',answer:2,tolerance:.01};assert.equal(gradeStep(item,{type:item.type,value:2}),true);assert.equal(gradeStep(item,{type:item.type,value:2.02}),false);assert.throws(()=>gradeStep(item,{type:item.type,value:'2'}));
  const span={type:'evidence_span',spans:[{id:'a'},{id:'b'},{id:'c'}],acceptedSpans:['a','b']};assert.equal(gradeStep(span,{type:span.type,value:'b'}),true);assert.throws(()=>gradeStep(span,{type:span.type,value:'unmapped'}));
  const p=fixture();p.checks[1].familyId=p.checks[0].familyId;assert.throws(()=>createEpisode(p,{id:'e',at:0}),/OVERLAP/);assert.equal(validatePathway(fixture()).id,'fixture');
});

test('unanswered and expired checks reopen repair without inventing a wrong answer',()=>{
  const p=fixture(); const e=repaired(p);
  assert.throws(()=>advanceEpisode(p,e,{itemId:'check1',type:'choice',value:null},0),/INVALID_CHOICE/);
  for(const reason of ['unanswered','expired']) {
    const next=advanceEpisode(p,e,{itemId:'check1',type:'choice',value:null},0,{incompleteCheck:reason});
    assert.equal(next.state,'needs_repair');assert.equal(next.checks[0].incompleteReason,reason);assert.equal(next.observations.at(-1).value,null);
    const repairedAgain=respond(p,next,2,1);assert.equal(permittedStep(p,repairedAgain,1).id,'check2');
  }
});
test('IST allowances and plan priority are deterministic and released offer stays closed',()=>{
  const instant=Date.parse('2026-10-04T18:30:00Z');assert.equal(allowancePeriod('daily_practice',instant),'2026-10-05');assert.equal(allowancePeriod('weekly_episode',instant),'2026-10-05');assert.equal(allowancePeriod('baseline:english',instant),'cuet_2027');
  const input={activeSession:{id:'s',href:'/test'},episodes:[{id:'e',state:'delayed_check_1',nextDueAt:1}],now:2};assert.equal(learningPlan(input).primary.kind,'resume_session');assert.equal(learningPlan({...input,activeSession:null}).primary.kind,'fresh_check');assert.equal(learningPlan({}).primary.kind,'ordinary_practice');assert.equal(newOfferReleased(),false);assert.equal(CAPABILITIES.recovery.state,'blocked_content');
});
