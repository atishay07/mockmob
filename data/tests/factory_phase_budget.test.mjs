import test from 'node:test';import assert from 'node:assert/strict';import {phaseBudgetFits} from '../factory_phase_budget.mjs';
test('a 10,000 target forecast cannot deadlock an affordable 1,000 checkpoint',()=>{
 const s={budget:{committed_micro:7122859},forecast_usd:103.1596,cost_per_published_usd:.01031596};
 assert.equal(phaseBudgetFits(s,'release_1000',50),true);assert.equal(phaseBudgetFits(s,'release_10000',50),false);
});
test('phase budgets retain conservative holds and fail closed on missing or invalid measurements',()=>{
 const s={budget:{committed_micro:49900000},cost_per_published_usd:.01};
 assert.equal(phaseBudgetFits(s,'release_1000',990),true);assert.equal(phaseBudgetFits(s,'release_1000',989),false);
 assert.equal(phaseBudgetFits({...s,cost_per_published_usd:null},'release_1000',990),false);
 assert.equal(phaseBudgetFits({...s,budget:{committed_micro:NaN}},'release_1000',990),false);
});
