import test from 'node:test';
import assert from 'node:assert/strict';
import { profilePatch } from '../../src/lib/server/profilePatch.js';

test('profile updates accept only a name and listed subjects', () => {
  assert.deepEqual(profilePatch({ name: '  Asha ' }), { patch: { name: 'Asha' } });
  assert.deepEqual(profilePatch({ subjects: ['english', 'english', 'accountancy'] }).patch, { subjects: ['english', 'accountancy'] });
  for (const forged of [{ isPremium: true }, { role: 'admin' }, { subscriptionStatus: 'active' }, { premiumUntil: '2030-01-01' }, { email: 'x@y.z' }, { razorpaySubscriptionId: 'sub_1' }]) {
    assert.equal(profilePatch(forged).error, 'Nothing to update.');
  }
  const mixed = profilePatch({ name: 'Asha', isPremium: true, role: 'admin' });
  assert.deepEqual(mixed, { patch: { name: 'Asha' } });
  assert.match(profilePatch({ subjects: ['not_a_subject'] }).error, /listed subjects/);
  // The public id the website sends for the General Test must be accepted, as must the internal one.
  assert.deepEqual(profilePatch({ subjects: ['general_test', 'english'] }).patch, { subjects: ['general_test', 'english'] });
  assert.deepEqual(profilePatch({ subjects: ['gat'] }).patch, { subjects: ['gat'] });
  assert.match(profilePatch({ subjects: ['english', 'accountancy', 'economics', 'business_studies', 'history', 'political_science'] }).error, /up to 5/);
  assert.match(profilePatch({ name: '' }).error, /1 to 80/);
  assert.equal(profilePatch(null).error, 'Send a JSON object.');
});
