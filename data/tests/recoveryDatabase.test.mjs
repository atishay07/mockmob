import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('migration enforces owner access, atomic charge and exactly-once score/progress', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table users(id text primary key,credit_balance int);
      create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,explanation text);
      create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb);
      create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz,last_attempted_at timestamptz,updated_at timestamptz,primary key(user_id,question_id));
      create table credit_transactions(user_id text,amount int,type text,reference text primary key,action text,credit_delta int);
      insert into users values('owner',100),('other',100);insert into questions(id) values('q1');`);
    await db.exec(readFileSync(new URL('../../supabase/migrations/0036_mode_aware_credits.sql',import.meta.url),'utf8'));
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261001105920_score_recovery_foundations.sql',import.meta.url),'utf8'));
    const row={id:'session',user_id:'owner',request_key:'request-key',subject:'economics',mode:'quick',state:'active',questions:[{id:'q1',chapter:'Money'}],selection_meta:{},created_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()};
    await db.query('select start_recovery_session($1,$2)',[row,'attempt']);
    await db.query('select start_recovery_session($1,$2)',[{...row,id:'retry'},'attempt']);
    assert.equal((await db.query("select credit_balance from users where id='owner'")).rows[0].credit_balance,90);
    const event={seq:1,qid:'q1',type:'answer',answer:0,at:0};
    await db.query('select record_recovery_events($1,$2,$3)',['session','owner',[event]]);
    await db.query('select record_recovery_events($1,$2,$3)',['session','owner',[event]]);
    await assert.rejects(db.query('select record_recovery_events($1,$2,$3)',['session','owner',[{...event,answer:1}]]),/event conflict/);
    const result={expected_event_count:1,score:100,correct:1,wrong:0,unattempted:0,total:1,details:[{qid:'q1',givenIndex:0,isCorrect:true}],selectionMeta:{scoringVersion:'server_snapshot_v1'}};
    await assert.rejects(db.query('select finish_recovery_session($1,$2,$3)',['session','other',result]),/session not found/);
    await db.query('select finish_recovery_session($1,$2,$3)',['session','owner',result]);
    await db.query('select finish_recovery_session($1,$2,$3)',['session','owner',result]);
    assert.equal((await db.query('select count(*)::int as n from attempts')).rows[0].n,1);
    assert.equal((await db.query('select attempt_count from user_question_progress')).rows[0].attempt_count,1);
    // Quarantine archives every dependent variant and refuses a stale dry run.
    const options=['one','two','three','four'];
    const evidence={record:{state:'eligible',family_id:'family'}};
    await db.query("update questions set subject='economics',chapter='Money & Banking',body='Question?',options=$1,correct_answer='A',explanation='Reason.',evidence=$2 where id='q1'",[options,evidence]);
    await db.query("insert into questions(id,subject,chapter,body,options,correct_answer,explanation,evidence) values('q2','economics','Money & Banking','Variant?',$1,'A','Reason.',$2)",[options,evidence]);
    const change={id:'q1',expected_content:{subject:'economics',chapter:'Money & Banking',concept:'',body:'Question?',explanation:'Reason.'},expected_options:options,expected_key:'A',reason:'test defect'};
    await assert.rejects(db.query('select quarantine_recovery_questions($1)',[[{...change,expected_key:'D'}]]),/snapshot stale/);
    assert.equal((await db.query('select count(*)::int as n from question_version_history')).rows[0].n,0);
    await db.query('select quarantine_recovery_questions($1)',[[change]]);
    assert.equal((await db.query("select count(*)::int as n from questions where evidence->'record'->>'state'='quarantined'")).rows[0].n,2);
    assert.equal((await db.query("select count(*)::int as n from recovery_family_holds where family_id='family'")).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int as n from attempts')).rows[0].n,1);
    const history=(await db.query("select id from question_version_history where question_id='q1'")).rows[0].id;
    await db.query('select restore_recovery_question($1)',[history]);
    assert.equal((await db.query("select evidence->'record'->>'state' as state from questions where id='q1'")).rows[0].state,'eligible');
    // Restoring one item cannot silently reopen an unsafe template.
    assert.equal((await db.query("select count(*)::int as n from recovery_family_holds where family_id='family'")).rows[0].n,1);
    await db.exec('create table passage_groups(id text primary key,passage_text text); alter table questions add column passage_group_id text;');
    const passage={id:'passage',passage_text:'A software fixture passage.'};
    const child=id=>({id,passage_group_id:'passage',passage_text:passage.passage_text,evidence:{signature:'software-fixture',record:{state:'eligible',route:'passage'}}});
    await assert.rejects(db.query('select publish_recovery_passage($1,$2)',[passage,[child('q3'),child('q1')]]),/duplicate key/);
    assert.equal((await db.query('select count(*)::int as n from passage_groups')).rows[0].n,0);
    assert.equal((await db.query("select count(*)::int as n from questions where id='q3'")).rows[0].n,0);
    await db.query('select publish_recovery_passage($1,$2)',[passage,[child('q3'),child('q4')]]);
    assert.equal((await db.query('select count(*)::int as n from passage_groups')).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int as n from questions where passage_group_id='passage'")).rows[0].n,2);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from recovery_sessions'),/permission denied/);
  } finally { await db.close(); }
});
