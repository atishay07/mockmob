import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
test('runtime guard blocks unknown funding/prices and preserves every reservation/receipt',async()=>{
  const db=new PGlite();try{
    await db.exec('create role anon;create role authenticated;create role service_role;');
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261002121000_runtime_ai_guard.sql',import.meta.url),'utf8'));
    await assert.rejects(db.query('select reserve_runtime_ai($1,$2,$3,$4,$5)',['physical1','fixture','fixture',200,200]),/verified model price/);
    // Prices and funding below are software fixtures, not deployment authorization.
    await db.exec("insert into runtime_ai_prices values('fixture','fixture',1,1,'https://example.invalid/software-fixture',now())");
    await assert.rejects(db.query('select reserve_runtime_ai($1,$2,$3,$4,$5)',['physical1','fixture','fixture',200,200]),/budget exhausted/);
    await db.exec("update runtime_ai_budget set funded_usd=.001");
    const reserve=key=>db.query('select reserve_runtime_ai($1,$2,$3,$4,$5)',[key,'fixture','fixture',200,200]);
    const concurrent=await Promise.allSettled([reserve('physical1'),reserve('physical2'),reserve('physical3')]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,2);
    const retry=await reserve('physical1');assert.equal(retry.rows[0].reserve_runtime_ai.dispatch,false);
    await db.query('select receipt_runtime_ai($1,$2,$3)',['physical1',.0002,{usage:'fixture'}]);
    await db.query('select receipt_runtime_ai($1,$2,$3)',['physical1',.0002,{usage:'retry'}]);
    assert.equal(Number((await db.query('select spent_usd from runtime_ai_budget')).rows[0].spent_usd),.0002);
    await db.query('select receipt_runtime_ai($1,$2,$3)',['physical2',null,{error:'unknown physical outcome'}]);
    assert.equal(Number((await db.query('select spent_usd from runtime_ai_budget')).rows[0].spent_usd),.0006);
    assert.equal((await db.query('select paused from runtime_ai_budget')).rows[0].paused,true);
    await assert.rejects(reserve('another'),/funding unavailable/);
    const limits=await Promise.all(Array.from({length:4},()=>db.query('select take_rate_limit($1,$2,$3)',['bucket',2,60000])));assert.equal(limits.filter(r=>r.rows[0].take_rate_limit).length,2);
    await db.exec('set role authenticated');await assert.rejects(reserve('client'),/permission denied/);
  }finally{await db.close();}
});
