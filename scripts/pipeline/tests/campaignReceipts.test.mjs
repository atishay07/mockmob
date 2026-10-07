import test from 'node:test';import assert from 'node:assert/strict';import {campaignReceipts} from '../lib/campaignReceipts.mjs';
test('a concurrent cohort is not added to preparation or gross costs of an earlier cohort',()=>{
 const rows=[{id:'a',receipt:{purpose:'candidate',candidate_id:'own'}},{id:'b',receipt:{purpose:'candidate',candidate_id:'later'}},{id:'c',receipt:{purpose:'calibration',candidate_id:'fixture'}},{id:'d',receipt:{purpose:'calibration',candidate_id:'other-fixture'}}];
 assert.deepEqual(campaignReceipts(rows,new Map(),{candidateIds:new Set(['own']),calibrationIds:new Set(['fixture'])}).map(r=>r.id),['a','c']);
});
test('pending holds and failed receipts use persisted request identity without assuming zero',()=>{
 const rows=[{id:'held',state:'unresolved',reserved:900},{id:'failed',receipt:{purpose:'candidate',candidate_id:'own',http_status:500}}];
 const result=campaignReceipts(rows,new Map([['held',{purpose:'candidate',candidate_id:'own'}]]),{candidateIds:new Set(['own']),calibrationIds:new Set()});
 assert.equal(result.length,2);assert.equal(result[0].reserved,900);assert.equal(result[1].receipt.http_status,500);
});
