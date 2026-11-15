import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAST_SIGN_IN_KEY, PENDING_SIGN_IN_KEY, PENDING_TTL_MS, commitPendingSignIn, forgetLastSignIn, lastSignInLine, lastSignInParts, maskEmail,
  notePendingSignIn, parseLastSignIn, readLastSignIn,
} from './lastSignIn.mjs';

function memoryStore() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}

test('O8: an address is masked to its first letter and its domain', () => {
  assert.equal(maskEmail('asha.k@gmail.com'), 'a***@gmail.com');
  assert.equal(maskEmail(' Rohan99@Yahoo.co.in '), 'r***@yahoo.co.in');
  assert.equal(maskEmail('x@school.edu.in'), 'x***@school.edu.in');
  for (const bad of ['', 'asha', 'asha@', '@gmail.com', 'asha@gmail', null, undefined]) assert.equal(maskEmail(bad), null, String(bad));
});

test('O8: a sign-in is remembered only once a session is confirmed, and never with the full address', () => {
  const store = memoryStore();
  const now = 5_000_000;
  notePendingSignIn(store, 'email', 'asha.k@gmail.com', now);
  assert.equal(readLastSignIn(store), null, 'nothing remembered while the code is on its way');
  assert.doesNotMatch(store.map.get(PENDING_SIGN_IN_KEY), /asha\.k/);
  assert.deepEqual(commitPendingSignIn(store, now + 60_000), { method: 'email', email: 'a***@gmail.com', at: now + 60_000 });
  assert.deepEqual(readLastSignIn(store), { method: 'email', email: 'a***@gmail.com', at: now + 60_000 });
  assert.equal(store.map.has(PENDING_SIGN_IN_KEY), false, 'the pending note is used once');
  assert.equal(commitPendingSignIn(store, now + 120_000), null, 'a later session check changes nothing');
  for (const value of store.map.values()) assert.doesNotMatch(value, /asha\.k/);

  notePendingSignIn(store, 'google', 'asha.k@gmail.com', now);
  commitPendingSignIn(store, now + 1000);
  assert.deepEqual(readLastSignIn(store), { method: 'google', email: null, at: now + 1000 }, 'Google keeps no address');
});

test('O8: a stale or broken pending note is dropped; an unknown method is not kept', () => {
  const store = memoryStore();
  notePendingSignIn(store, 'email', 'a@b.in', 0);
  assert.equal(commitPendingSignIn(store, PENDING_TTL_MS + 1), null);
  assert.equal(store.map.has(PENDING_SIGN_IN_KEY), false);
  notePendingSignIn(store, 'password', 'a@b.in', 0);
  assert.equal(store.map.has(PENDING_SIGN_IN_KEY), false);
  store.setItem(PENDING_SIGN_IN_KEY, '{not json');
  assert.equal(commitPendingSignIn(store, 1), null);
  store.setItem(LAST_SIGN_IN_KEY, JSON.stringify({ method: 'email', email: 'asha.k@gmail.com', at: 1 }));
  assert.deepEqual(readLastSignIn(store), { method: 'email', email: null, at: 1 }, 'a full address in storage is never shown');
  assert.equal(parseLastSignIn('{"method":"sms"}'), null);
  assert.equal(parseLastSignIn(null), null);
  assert.deepEqual(parseLastSignIn('{"method":"google","at":3}'), { method: 'google', email: null, at: 3 });
});

test('O8: "Not you?" forgets the way and any sign-in under way; storage that throws is ignored', () => {
  const store = memoryStore();
  notePendingSignIn(store, 'google', null, 1);
  commitPendingSignIn(store, 2);
  notePendingSignIn(store, 'email', 'a@b.in', 3);
  forgetLastSignIn(store);
  assert.equal(store.map.size, 0);
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  assert.doesNotThrow(() => { notePendingSignIn(broken, 'google'); commitPendingSignIn(broken); forgetLastSignIn(broken); });
  assert.equal(readLastSignIn(broken), null);
  assert.equal(readLastSignIn(null), null);
});

test('O8: the line /login shows', () => {
  assert.equal(lastSignInLine({ method: 'google', email: null }), 'Last time you used Google.');
  assert.equal(lastSignInLine({ method: 'email', email: 'a***@gmail.com' }), 'Last time you used the email code for a***@gmail.com.');
  assert.equal(lastSignInLine({ method: 'email', email: null }), 'Last time you used the email code.');
  assert.equal(lastSignInLine(null), null);
  assert.deepEqual(lastSignInParts({ method: 'email', email: 'a***@gmail.com' }), { lead: 'Last time you used the email code for', who: 'a***@gmail.com' });
  assert.deepEqual(lastSignInParts({ method: 'google', email: null }), { lead: 'Last time you used Google', who: null });
  assert.equal(lastSignInParts(null), null);
});
