import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { validateRivalAnswers } from '../rival_answers.js';
import { solveReasoningStep } from '../recovery_solvers.js';
import { deriveCorrectedScore } from '../answer_corrections.js';
test('rival rejects repeated, missing and unauthorized IDs',()=>{
  const q=[{id:'q',options:['a','b']}];
  assert.throws(()=>validateRivalAnswers(['q'],[{qid:'q',selectedIndex:0},{qid:'q',selectedIndex:0}],q));
  assert.throws(()=>validateRivalAnswers(['q','q'],[],q));
  assert.throws(()=>validateRivalAnswers(['q'],[{qid:'other',selectedIndex:0}],q));
  assert.throws(()=>validateRivalAnswers(['q'],[{qid:'q',selectedIndex:3}],q));
  assert.throws(()=>validateRivalAnswers(['q'],[],[]));
});
test('rival concurrent submission is atomic, retry safe and owner bound',async()=>{
  const db=new PGlite();try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table rival_battles(id uuid primary key,user_id text,status text,user_score int,user_accuracy int,user_time_seconds int,result text,submitted_at timestamptz,metadata jsonb);
      create table rival_battle_answers(battle_id uuid,user_id text,question_id text,selected_answer int,is_correct boolean,time_spent_seconds int);
      insert into rival_battles(id,user_id,status,metadata) values('00000000-0000-0000-0000-000000000001','owner','in_progress','{}');
      grant all on rival_battles,rival_battle_answers to service_role;`);
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261002122000_rival_atomic_submission.sql',import.meta.url),'utf8'));
    const id='00000000-0000-0000-0000-000000000001',answers=[{question_id:'q',selected_answer:0,is_correct:true,time_spent_seconds:5}],update={user_score:10,user_accuracy:100,user_time_seconds:5,result:'win'},response={ok:true,result:'win'};
    const submit=user=>db.query('select submit_rival_battle($1,$2,$3,$4,$5)',[id,user,answers,update,response]);
    await assert.rejects(submit('other'),/not found/);await Promise.all([submit('owner'),submit('owner')]);
    assert.equal((await db.query('select count(*)::int as n from rival_battle_answers')).rows[0].n,1);
    await assert.rejects(db.query('select submit_rival_battle($1,$2,$3,$4,$5)',[id,'owner',[],update,response]),/conflict/);
    await db.exec('set role authenticated');await assert.rejects(submit('owner'),/permission denied/);
  }finally{await db.close();}
});
test('independent arithmetic boundaries and revalidated corrections preserve original scores',()=>{
  assert.equal(solveReasoningStep({kind:'real_value',nominal:120,priceIndex:120}),100);
  assert.throws(()=>solveReasoningStep({kind:'real_value',nominal:120,priceIndex:0}));
  assert.equal(solveReasoningStep({kind:'sacrificing_ratio',oldShare:.5,newShare:.25}),.25);
  assert.equal(solveReasoningStep({kind:'gaining_ratio',oldShare:.5,newShare:.75}),.25);
  assert.equal(solveReasoningStep({kind:'revaluation_result',assets:[10,-5],liabilities:[3,-2]}),4);
  const q={id:'q',options:['a','b'],correctIndex:0},a={id:'a',score:100,questionsSnapshot:[q],details:[{qid:'q',givenIndex:0}]};
  assert.throws(()=>deriveCorrectedScore(a,[{...q,correctIndex:1}],()=>false),/REVALIDATION/);
  const revised=deriveCorrectedScore(a,[{...q,correctIndex:1}],()=>true);assert.equal(revised.rawScore,-1);assert.equal(a.score,100);assert.equal(a.questionsSnapshot[0].correctIndex,0);
  assert.throws(()=>deriveCorrectedScore(a,[{...q,options:['b','a'],correctIndex:1}],()=>true),/NOT_COMPARABLE/);
  assert.throws(()=>deriveCorrectedScore(a,[{...q,text:'Changed condition',correctIndex:1}],()=>true),/NOT_COMPARABLE/);
});
