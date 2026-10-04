import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createStudyRun, studyTransition } from '../study_engine.js';
import { scheduleReview } from '../study_scheduler.mjs';
const migration=readFileSync(new URL('../../supabase/migrations/20261004154217_connected_study_suite.sql',import.meta.url),'utf8');
test('study transactions preserve owners, immutable retries, scheduling, exposure and daily limits',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create table users(id text primary key);insert into users values('owner'),('other');
      create table learning_episodes(id text,pathway jsonb);create table learning_family_exposure(user_id text,family_id text,reference text,created_at timestamptz default now(),primary key(user_id,family_id));
      grant select,update on users to service_role;grant select on learning_episodes to service_role;grant select,insert on learning_family_exposure to service_role;`);
    await db.exec(migration);
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261004172214_study_review_backlog.sql',import.meta.url),'utf8'));
    await db.exec(`insert into study_units values('u',1,'english','Vocabulary','v','{}','unit-hash','published');`);
    const cards=Array.from({length:6},(_,i)=>({id:`c${i}`,version:1,type:'reveal',answer:'answer',familyId:`study:c${i}`,contentHash:`hash${i}`}));
    for(const c of cards)await db.query("insert into study_cards values($1,1,'u',1,$2,$3)",[c.id,c,c.contentHash]);
    const startRow=(id,selected=cards.slice(0,5),user='owner')=>({id,user_id:user,request_key:`request_${id}_123`,request:{mode:'recall',unitId:'u'},mode:'recall',content:{units:[{id:'u',version:1,contentHash:'unit-hash'}],items:selected},projection:createStudyRun({id,mode:'recall',unitIds:['u'],cardIds:selected.map(c=>c.id)})});
    const states=selected=>selected.map(c=>({card_id:c.id,content_version:1,schedule:{due:new Date().toISOString(),state:0},scheduler_version:'v1'}));
    const day=new Date(Date.now()+19800000).toISOString().slice(0,10);
    const row=startRow('r');
    const call=(r,s=states(r.content.items))=>db.query('select start_study_run($1,$2,$3) as result',[r,s,day]);
    await Promise.all([call(row),call({...row,id:'retry'})]);assert.equal((await db.query('select count(*)::int n from study_runs')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from study_card_states')).rows[0].n,5);assert.equal((await db.query('select count(*)::int n from learning_family_exposure')).rows[0].n,5);
    await assert.rejects(call({...row,request:{mode:'learn',unitId:'different'}}),/idempotency conflict/);
    const input={type:'reveal',itemId:'c0',expectedRevision:0,requestKey:'event_request_123'};
    const next=studyTransition(row.projection,cards[0],input).projection;
    const advance=(user,key,event,revision,projection,result,schedule=null)=>db.query('select advance_study_run($1,$2,$3,$4,$5,$6,$7,$8) as result',[user,'r',key,event,revision,projection,result,schedule]);
    await assert.rejects(advance('other','event',input,0,next,{saved:1}),/run not found/);
    await Promise.all([advance('owner','event',input,0,next,{saved:1}),advance('owner','event',input,0,next,{saved:1})]);
    assert.deepEqual((await advance('owner','event',input,0,next,{saved:9})).rows[0].result,{saved:1});
    await assert.rejects(advance('owner','event',{...input,type:'rate'},0,next,{saved:2}),/idempotency conflict/);
    await assert.rejects(advance('owner','stale',input,0,next,{saved:2}),/revision conflict/);
    const rated=studyTransition(next,cards[0],{...input,type:'rate',rating:3,expectedRevision:1}).projection;
    const schedule={...scheduleReview(null,3),cardId:'c0',contentVersion:1,expectedRevision:0};
    await advance('owner','rating',{rating:3},1,rated,{saved:2},schedule);
    assert.equal((await db.query("select revision from study_card_states where card_id='c0'")).rows[0].revision,1);
    assert.equal((await db.query('select count(*)::int n from study_events')).rows[0].n,2);
    // A scheduling conflict rolls back the run projection and the event together.
    await assert.rejects(advance('owner','bad_schedule',{rating:3},2,{...rated,revision:3},{saved:3},schedule),/card revision conflict/);
    assert.equal((await db.query("select revision from study_runs where id='r'")).rows[0].revision,2);
    await db.exec("update study_runs set projection=jsonb_set(projection,'{state}','\"complete\"') where id='r'");
    await assert.rejects(call(startRow('six',[cards[5]])),/daily new card conflict/);
    await db.exec("insert into learning_episodes values('reserved','{\"checks\":[{\"familyId\":\"study:c5\"}]}')");
    await assert.rejects(call(startRow('reserved',[cards[5]],'other')),/reserved assessment family/);
    await db.exec("update study_units set publication_state='quarantined' where id='u'");
    assert.equal((await db.query("select projection->>'state' as state from study_runs where id='r'")).rows[0].state,'invalidated');
    await assert.rejects(advance('owner','corrected',{},3,{...rated,revision:4},{saved:3}),/content changed/);
    assert.equal((await db.query('select count(*)::int n from study_events')).rows[0].n,3);
    // Withdrawn content cannot leave a permanent invisible backlog for another owner.
    await db.exec("delete from learning_episodes;update study_units set publication_state='published' where id='u';insert into study_units values('withdrawn',1,'english','Vocabulary','v','{}','old-hash','quarantined')");
    for(let i=0;i<21;i++){
      await db.query("insert into study_cards values($1,1,'withdrawn',1,'{}','old-hash')",[`withdrawn-${i}`]);
      await db.query("insert into study_card_states(user_id,card_id,content_version,schedule,introduced_day,scheduler_version) values('other',$1,1,jsonb_build_object('due',now()-interval '3 days'),'yesterday','v1')",[`withdrawn-${i}`]);
    }
    await call(startRow('after_withdrawal',[cards[5]],'other'));
    assert.equal((await db.query("select count(*)::int n from study_runs where id='after_withdrawal'")).rows[0].n,1);
    await db.exec("update study_runs set projection=jsonb_set(projection,'{state}','\"complete\"') where id='after_withdrawal';update study_units set publication_state='published' where id='withdrawn'");
    await assert.rejects(call(startRow('current_backlog',[cards[0]],'other')),/daily new card conflict/);
    await db.exec('set role authenticated');await assert.rejects(db.query('select * from study_runs'),/permission denied/);await assert.rejects(db.query("select record_study_exposure('owner','u',1,'unit-hash')"),/permission denied/);
    await db.exec('reset role;set role service_role');await assert.rejects(db.query("update study_events set event='{}'"),/permission denied/);
  }finally{await db.close();}
});
