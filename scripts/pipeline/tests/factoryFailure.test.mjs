import test from 'node:test';import assert from 'node:assert/strict';
import {stopsFactory} from '../lib/factoryFailure.mjs';
test('only a reconciled conservative hold permits unrelated items after uncertain acceptance',()=>{
 const error=Error('provider_request_unresolved_do_not_resubmit');
 assert.equal(stopsFactory(error,{assertHistoryReconciled(){}}),false);
 assert.equal(stopsFactory(error,{assertHistoryReconciled(){throw Error('unbounded');}}),true);
 assert.equal(stopsFactory(Error('batch_submission_unresolved'),{assertHistoryReconciled(){}}),false);
});
test('an affordable hold never bypasses the ceiling, input bound, pricing or live-worker guards',()=>{
 const ledger={assertHistoryReconciled(){}};
 for(const message of ['budget_exhausted','pricing_expired','input_bound_exceeded','history_unreconciled','factory_worker_already_running'])assert.equal(stopsFactory(Error(message),ledger),true);
 assert.equal(stopsFactory(Error('provider_request_rejected_before_inference'),ledger),false);
});
