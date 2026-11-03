import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';import {CampaignController} from '../lib/campaignController.mjs';
test('only one live scheduler may create cohorts; a dead scheduler can recover',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mockmob-controller-')),a=new BudgetLedger(join(dir,'ledger.sqlite')),b=new BudgetLedger(join(dir,'ledger.sqlite'));let live=true;
 try{const first=new CampaignController(a,{pid:7001,alive:()=>live}),second=new CampaignController(b,{pid:7002,alive:()=>live});first.claim();assert.throws(()=>second.claim(),/already_running/);live=false;second.claim();first.release();assert.equal(b.db.prepare('SELECT owner FROM factory_campaign_controller').get().owner,second.owner);second.release();assert.equal(b.db.prepare('SELECT count(*) n FROM factory_campaign_controller').get().n,0);}finally{a.close();b.close();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));rmSync(dir,{recursive:true,force:true});}
});
