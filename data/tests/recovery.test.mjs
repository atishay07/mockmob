import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSession, scorePracticeSubmission, improvementEvidence } from '../recovery.js';
import { attemptScoring, isRecoverySession } from '../attempt_scoring.js';

const questions = [{ id:'q1', correctIndex:0, options:['one','two','three','four'] }, {id:'q2',correctIndex:1,options:['a','b','c','d']}];
test('server snapshot scores answers; a correct-to-wrong change loses six marks', () => {
  const result=scoreSession(questions,{q1:1,q2:1},[
    {seq:1,qid:'q1',at:0,type:'answer',answer:0},
    {seq:2,qid:'q1',at:1000,type:'answer',answer:1},
  ],2000);
  assert.equal(result.rawScore,4); assert.equal(result.correct,1);
  assert.equal(result.recovery.observed.answerChanges[0].markEffect,-6);
});
test('missing event answers cannot invent score effects', () => {
  const result=scoreSession(questions,{q1:1},[{seq:1,qid:'q1',at:0,type:'answer',answer:0}]);
  assert.equal(result.rawScore,-1); assert.equal(result.recovery.telemetry,'inconsistent');
  assert.deepEqual(result.recovery.timeline,[]);
});
test('unknown questions, duplicate sequence, out-of-bounds answer and future events fail', () => {
  assert.throws(()=>scoreSession(questions,{other:0}));
  assert.throws(()=>scoreSession(questions,{q1:4}));
  assert.throws(()=>scoreSession(questions,{},[{seq:1,qid:'q1',at:20,type:'visit'}],10));
  assert.throws(()=>scoreSession(questions,{},[{seq:1,qid:'q1',at:0,type:'visit'},{seq:1,qid:'q1',at:0,type:'visit'}]));
});
test('repeats, assisted answers and same-family variants cannot demonstrate improvement', () => {
  const base={correct:true,fresh:true,assisted:false,questionId:'q1',familyId:'f1',at:0};
  assert.equal(improvementEvidence([base,{...base,at:86400000}]).state,'more_evidence_needed');
  assert.equal(improvementEvidence([base,{...base,questionId:'q2',at:86400000}]).state,'more_evidence_needed');
  assert.equal(improvementEvidence([base,{...base,questionId:'q2',familyId:'f2',assisted:true,at:86400000}]).state,'more_evidence_needed');
  assert.equal(improvementEvidence([base,{...base,questionId:'q2',familyId:'f2',at:86400000}]).state,'improvement_demonstrated');
  assert.equal(improvementEvidence([base,{correct:false,at:20},{...base,questionId:'q2',familyId:'f2',at:86400000}]).state,'more_evidence_needed');
});
test('practice submission survives a clock-skewed event log but never an invalid answer', () => {
  const skewed=[{seq:1,qid:'q1',at:9000,type:'answer',answer:0}];
  assert.throws(()=>scoreSession(questions,{q1:0},skewed,2000));
  const result=scorePracticeSubmission(questions,{q1:0},skewed,2000);
  assert.equal(result.correct,1); assert.equal(result.rawScore,5); assert.deepEqual(result.recovery.timeline,[]);
  assert.throws(()=>scorePracticeSubmission(questions,{q1:7},skewed,2000));
  assert.throws(()=>scorePracticeSubmission(questions,{other:0},[],2000));
});
test('attempt provenance separates server practice, recovery sessions and browser-scored history', () => {
  assert.equal(attemptScoring({selectionMeta:{scoringVersion:'server_practice_v1'}}),'server');
  assert.equal(attemptScoring({selectionMeta:{scoringVersion:'server_snapshot_v1'}}),'server');
  assert.equal(attemptScoring({selectionMeta:{}}),'device');
  assert.equal(attemptScoring(null),'device');
  assert.equal(isRecoverySession({selectionMeta:{scoringVersion:'server_practice_v1'}}),false);
  assert.equal(isRecoverySession({selectionMeta:{scoringVersion:'server_snapshot_v1'}}),true);
});
