import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotDecision, SNAPSHOT_FRESH_MS, SNAPSHOT_MAX_AGE_MS } from '../../src/lib/server/inventorySnapshot.js';

test('inventory snapshot is served when usable and refreshed in the background when old', () => {
  const now = Date.parse('2026-10-13T10:00:00Z');
  const snap = (ageMs, value = { state: 'available', bankSize: 10 }) => ({ value, computed_at: new Date(now - ageMs).toISOString() });
  assert.deepEqual(snapshotDecision(null, now), { use: 'compute', refresh: false });
  assert.deepEqual(snapshotDecision(snap(60_000), now), { use: 'snapshot', refresh: false });
  assert.deepEqual(snapshotDecision(snap(SNAPSHOT_FRESH_MS + 1), now), { use: 'snapshot', refresh: true });
  assert.deepEqual(snapshotDecision(snap(SNAPSHOT_MAX_AGE_MS + 1), now), { use: 'compute', refresh: false });
  assert.deepEqual(snapshotDecision(snap(60_000, { state: 'unavailable' }), now), { use: 'compute', refresh: false });
  assert.deepEqual(snapshotDecision(snap(-120_000), now), { use: 'compute', refresh: false }, 'a future timestamp is not trusted');
  assert.deepEqual(snapshotDecision({ value: { state: 'available' }, computed_at: 'not a date' }, now), { use: 'compute', refresh: false });
});
