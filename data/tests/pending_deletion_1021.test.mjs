import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingDeletionAt } from '../../src/lib/server/pendingDeletion.mjs';

// A tiny stand-in for the supabase query builder: from().select().eq().eq().maybeSingle().
function dbAnswering(result) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result };
  return { from: () => chain };
}

test('a pending request reads as its ISO time', async () => {
  assert.equal(await pendingDeletionAt('u1', dbAnswering({ data: { requested_at: '2026-10-20T17:50:00+00:00' }, error: null })), '2026-10-20T17:50:00.000Z');
});

test('no request, a read error or a throw all read as null', async () => {
  assert.equal(await pendingDeletionAt('u1', dbAnswering({ data: null, error: null })), null);
  assert.equal(await pendingDeletionAt('u1', dbAnswering({ data: null, error: { message: 'down' } })), null);
  assert.equal(await pendingDeletionAt('u1', { from: () => { throw new Error('boom'); } }), null);
});
