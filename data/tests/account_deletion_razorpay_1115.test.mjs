// M2 (security audit 15 Nov 2026): deleting an account cancels its website (Razorpay) subscription first, through the
// cancel Account uses; if Razorpay does not confirm, nothing is deleted and the request stays pending. Razorpay is a fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DELETION_STEPS, executeDeletion, formatPlan, planDeletion, processRequests, stopRazorpayRenewals, supabaseAdapter,
} from '../../src/lib/server/accountDeletion.js';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

/** A Razorpay client fake: subscriptions by id, every call logged, cancels that can be refused. */
function fakeRazorpay(states, { refuse = new Set(), fetchFails = new Set() } = {}) {
  const calls = [];
  const subs = new Map(Object.entries(states).map(([id, status]) => [id, { id, entity: 'subscription', status }]));
  return {
    calls,
    subscriptions: {
      async fetch(id) {
        calls.push(['fetch', id]);
        if (fetchFails.has(id) || !subs.has(id)) throw new Error(`no subscription ${id}`);
        return { ...subs.get(id) };
      },
      async cancel(id, atCycleEnd) {
        calls.push(['cancel', id, atCycleEnd]);
        if (refuse.has(id)) throw Object.assign(new Error('refused'), { error: { description: 'This subscription cannot be cancelled' } });
        subs.set(id, { ...subs.get(id), status: 'cancelled' });
        return { id, status: 'cancelled' };
      },
    },
  };
}

/** The processor's adapter with the database part faked: what it would run, in order. */
function fakeAdapter(subscriptionIds, log = []) {
  return {
    log,
    async listPendingRequests() { return [{ id: 1, user_id: 'u1', requested_at: '2026-11-01T00:00:00Z', status: 'pending' }]; },
    async getUser(id) { log.push(['getUser', id]); return { id, email: `${id}@example.com` }; },
    async listRazorpaySubscriptions(userId) { log.push(['listRazorpaySubscriptions', userId]); return subscriptionIds; },
    async run(request, steps, apply) {
      log.push(['run', apply]);
      return { steps: steps.map((s) => ({ table: s.table, rows: 0, present: true })), unclassified: [] };
    },
  };
}
const REQUEST = { id: 1, user_id: 'u1', requested_at: '2026-11-01T00:00:00Z', status: 'pending' };

test('every subscription that may still charge is cancelled at once; ended and never-started ones are left alone', async () => {
  const rz = fakeRazorpay({ sub_live: 'active', sub_retrying: 'pending', sub_paused: 'paused', sub_old: 'cancelled', sub_done: 'completed', sub_abandoned: 'created' });
  const adapter = fakeAdapter(['sub_live', 'sub_retrying', 'sub_paused', 'sub_old', 'sub_done', 'sub_abandoned', 'sub_live']);
  const outcomes = await stopRazorpayRenewals({ adapter, razorpay: rz, userId: 'u1' });
  assert.deepEqual(outcomes.map((o) => [o.id, o.outcome]), [
    ['sub_live', 'cancelled'], ['sub_retrying', 'cancelled'], ['sub_paused', 'cancelled'],
    ['sub_old', 'renewal_already_off'], ['sub_done', 'renewal_already_off'], ['sub_abandoned', 'renewal_already_off'],
  ]);
  assert.deepEqual(rz.calls.filter((c) => c[0] === 'cancel'), [['cancel', 'sub_live', false], ['cancel', 'sub_retrying', false], ['cancel', 'sub_paused', false]]);
});

test('an account with no website subscription needs no Razorpay key; one with a subscription and no key is refused', async () => {
  assert.deepEqual(await stopRazorpayRenewals({ adapter: fakeAdapter([]), razorpay: null, userId: 'u1' }), []);
  await assert.rejects(stopRazorpayRenewals({ adapter: fakeAdapter(['sub_live']), razorpay: null, userId: 'u1' }), (e) => e.code === 'razorpay_not_configured');
});

test('a refused cancel, or a subscription Razorpay cannot be asked about, stops the deletion', async () => {
  await assert.rejects(
    stopRazorpayRenewals({ adapter: fakeAdapter(['sub_live']), razorpay: fakeRazorpay({ sub_live: 'active' }, { refuse: new Set(['sub_live']) }), userId: 'u1' }),
    (e) => e.code === 'razorpay_cancel_failed' && /sub_live/.test(e.message),
  );
  await assert.rejects(
    stopRazorpayRenewals({ adapter: fakeAdapter(['sub_x']), razorpay: fakeRazorpay({ sub_x: 'active' }, { fetchFails: new Set(['sub_x']) }), userId: 'u1' }),
    (e) => e.code === 'razorpay_cancel_failed',
  );
  // A refusal for a subscription that turns out to be cancelled already counts as done (the Account cancel's own rule).
  const rz = fakeRazorpay({ sub_live: 'active' }, { refuse: new Set(['sub_live']) });
  rz.subscriptions.cancel = async (id) => { rz.calls.push(['cancel', id]); throw new Error('already cancelled'); };
  const fetchOnce = rz.subscriptions.fetch;
  let n = 0;
  rz.subscriptions.fetch = async (id) => (n++ === 0 ? fetchOnce(id) : { id, status: 'cancelled' });
  assert.deepEqual((await stopRazorpayRenewals({ adapter: fakeAdapter(['sub_live']), razorpay: rz, userId: 'u1' })).map((o) => o.outcome), ['cancelled']);
});

test('the deletion cancels the subscription before the login and the data go', async () => {
  const log = [];
  const adapter = fakeAdapter(['sub_live'], log);
  const rz = fakeRazorpay({ sub_live: 'active' });
  const deleteAuthUser = async ({ userId }) => { log.push(['deleteAuthUser', userId]); return { deleted: true, ids: ['a1'] }; };
  const razorpayRenewals = async (userId) => {
    const out = await stopRazorpayRenewals({ adapter, razorpay: rz, userId });
    log.push(['razorpay', out.map((o) => o.outcome).join(',')]);
    return out;
  };
  const done = await executeDeletion({ adapter, request: REQUEST, deleteAuthUser, razorpayRenewals });
  assert.deepEqual(done.razorpay.map((o) => [o.id, o.outcome]), [['sub_live', 'cancelled']]);
  const order = log.map((l) => l[0]);
  assert.ok(order.indexOf('razorpay') < order.indexOf('deleteAuthUser'), 'cancel first');
  assert.ok(order.indexOf('deleteAuthUser') < order.lastIndexOf('run'));
  assert.deepEqual(log.filter((l) => l[0] === 'run').map((l) => l[1]), [false, true], 'the plan (dry), then the apply');
});

test('if Razorpay does not confirm, nothing is deleted: no login removed, no data run, and the run reports and stops', async () => {
  const log = [];
  const adapter = fakeAdapter(['sub_live'], log);
  const rz = fakeRazorpay({ sub_live: 'active' }, { refuse: new Set(['sub_live']) });
  const failures = [];
  const auth = [];
  const run = await processRequests({
    adapter, due: [REQUEST, { ...REQUEST, id: 2, user_id: 'u2' }], apply: true,
    deleteAuthUser: async (x) => { auth.push(x); return { deleted: true, ids: [] }; },
    razorpayRenewals: (userId) => stopRazorpayRenewals({ adapter, razorpay: rz, userId }),
    onFail: (request, message) => failures.push([request.id, message]),
  });
  assert.equal(run.failed, 1);
  assert.equal(run.aborted, true);
  assert.equal(run.skipped, 1, 'the next request is not touched');
  assert.equal(auth.length, 0);
  assert.equal(log.filter((l) => l[0] === 'run' && l[1] === true).length, 0, 'the data transaction never ran');
  assert.match(failures[0][1], /^razorpay_cancel_failed: Razorpay did not cancel subscription sub_live/);
  assert.equal(run.results[0].status, 'failed');
});

test('a website subscription with no way to cancel it is refused, where before the account was deleted while it kept charging', async () => {
  const log = [];
  const adapter = fakeAdapter(['sub_live'], log);
  await assert.rejects(executeDeletion({ adapter, request: REQUEST, deleteAuthUser: async () => ({ deleted: true }) }), (e) => e.code === 'razorpay_not_configured');
  assert.equal(log.filter((l) => l[0] === 'run' && l[1] === true).length, 0);
  // The plan says what will happen.
  const plan = await planDeletion(adapter, REQUEST);
  assert.equal(plan.razorpayToCheck, 1);
  assert.match(formatPlan(plan), /Website: 1 Razorpay subscription\(s\) on record; each is checked with Razorpay/);
  // An account with none still deletes without Razorpay.
  const none = fakeAdapter([]);
  const out = await executeDeletion({ adapter: none, request: REQUEST });
  assert.deepEqual(out.razorpay, []);
  assert.ok(DELETION_STEPS.length > 0);
});

test('the Supabase adapter lists the users row subscription and every payments row subscription, once each', async () => {
  const queries = [];
  const client = {
    from(table) {
      const q = { table, filters: [] };
      queries.push(q);
      const chain = {
        select(cols) { q.cols = cols; return chain; },
        eq(col, val) { q.filters.push(['eq', col, val]); return chain; },
        not(col, op, val) { q.filters.push(['not', col, op, val]); return chain; },
        async maybeSingle() { return { data: { razorpay_subscription_id: 'sub_b' }, error: null }; },
        then(resolve) { resolve({ data: [{ subscription_id: 'sub_a' }, { subscription_id: 'sub_b' }, { subscription_id: 'sub_a' }], error: null }); },
      };
      return chain;
    },
  };
  const ids = await supabaseAdapter(client).listRazorpaySubscriptions('u1');
  assert.deepEqual(ids.sort(), ['sub_a', 'sub_b']);
  assert.deepEqual(queries.map((q) => q.table), ['users', 'payments']);
  assert.deepEqual(queries[1].filters, [['eq', 'user_id', 'u1'], ['not', 'subscription_id', 'is', null]]);
});

test('the operator script wires the Razorpay cancel in, and the public page says so in one plain sentence', () => {
  const script = read('scripts/ops/process-account-deletions.mjs');
  assert.match(script, /stopRazorpayRenewals\(\{ adapter, razorpay, userId \}\)/);
  assert.match(script, /deleteAuthUser, playRenewals, razorpayRenewals,/);
  const page = read('src/app/account-deletion/page.js');
  assert.match(page, /<h2>A website subscription<\/h2>/);
  assert.match(page, /If you pay for Pro every month on the website, we cancel that subscription before we delete your account, so no further payment is taken, and you can also cancel it yourself first in Account\./);
});
