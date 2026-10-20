import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  snapshotDecision, servedInventory, inventoryFallback, SNAPSHOT_STALE_MS, SNAPSHOT_CLOCK_SKEW_MS, SERVE_MEMO_MS,
} from '../../src/lib/server/inventorySnapshot.js';
import { buildPracticeQuote } from '../practice_quote.js';

const now = Date.parse('2026-10-15T10:00:00Z');
const counts = { state: 'available', bankSize: 10, subjectCounts: { accountancy: 600 }, checkedAt: '2026-10-15T09:59:00Z' };
const snap = (ageMs, value = counts) => ({ value, computed_at: new Date(now - ageMs).toISOString() });
const source = rel => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const body = (src, name) => {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next = src.indexOf('\nexport ', start + 1);
  return src.slice(start, next < 0 ? undefined : next);
};

test('a usable stored snapshot is always served, and the request path never asks for a recount', () => {
  assert.deepEqual(snapshotDecision(snap(60_000), now), { use: 'snapshot', stale: false });
  // Before 15 Oct an hour-old row triggered a whole-bank refresh; now it is simply served.
  assert.deepEqual(snapshotDecision(snap(60 * 60_000), now), { use: 'snapshot', stale: false });
  // A normal day: the cron runs within its hour, so a row can be about 25 hours old.
  assert.deepEqual(snapshotDecision(snap(25 * 3600_000), now), { use: 'snapshot', stale: false });
  // A missed daily run: still served, marked stale. Before, a row older than a day was recomputed inline.
  assert.deepEqual(snapshotDecision(snap(SNAPSHOT_STALE_MS + 1), now), { use: 'snapshot', stale: true });
  assert.deepEqual(snapshotDecision(snap(30 * 24 * 3600_000), now), { use: 'snapshot', stale: true });
  for (const decision of [snapshotDecision(snap(1), now), snapshotDecision(null, now)]) assert.equal('refresh' in decision, false);
});

test('without a usable snapshot the decision is the fallback, never a computation', () => {
  assert.deepEqual(snapshotDecision(null, now), { use: 'fallback', reason: 'snapshot_missing' });
  assert.deepEqual(snapshotDecision({ computed_at: new Date(now).toISOString() }, now), { use: 'fallback', reason: 'snapshot_missing' });
  assert.deepEqual(snapshotDecision(snap(60_000, { state: 'unavailable' }), now), { use: 'fallback', reason: 'snapshot_missing' });
  assert.deepEqual(snapshotDecision({ value: counts, computed_at: 'not a date' }, now), { use: 'fallback', reason: 'snapshot_missing' });
  assert.deepEqual(snapshotDecision(snap(-(SNAPSHOT_CLOCK_SKEW_MS + 1)), now), { use: 'fallback', reason: 'snapshot_untrusted' }, 'a future timestamp is not trusted');
  assert.deepEqual(snapshotDecision(snap(-60_000), now), { use: 'snapshot', stale: false }, 'a minute of clock skew between servers is tolerated');
});

test('servedInventory returns the stored counts or the fallback, and only stored counts are kept in memory', async () => {
  const warnings = [];
  const warn = line => warnings.push(line);
  const fresh = await servedInventory({ readStored: async () => snap(60_000), now, warn });
  assert.deepEqual(fresh, { value: counts, memo: true });
  assert.equal(warnings.length, 0);

  const stale = await servedInventory({ readStored: async () => snap(SNAPSHOT_STALE_MS + 60_000), now, warn });
  assert.deepEqual(stale, { value: { ...counts, stale: true }, memo: true });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^\[inventory\] .*daily refresh has not run/);

  for (const readStored of [async () => null, async () => { throw new Error('network'); }, async () => snap(0, { state: 'unavailable' })]) {
    const served = await servedInventory({ readStored, now, warn });
    assert.deepEqual(served, { value: inventoryFallback('snapshot_missing'), memo: false });
  }
  assert.equal(inventoryFallback().state, 'unavailable');
  assert.ok(SERVE_MEMO_MS >= 60_000 && SERVE_MEMO_MS <= 15 * 60_000);
});

test('the fallback is safe for the practice quote: launch is blocked as "unknown", nothing is charged', () => {
  const user = { id: 'u1', isPremium: false, premiumUntil: null, creditBalance: 40 };
  const blocked = buildPracticeQuote({ user, subject: 'accountancy', mode: 'quick', count: 10, inventory: inventoryFallback(), token: 'tok-123456789012', now: 0 });
  assert.equal(blocked.launchable, false);
  assert.equal(blocked.reasonCode, 'inventory_unknown');
  assert.equal(blocked.idempotencyToken, null);
  // Stale stored counts still serve practice: a count is a necessary condition only, the set is built at launch.
  const served = buildPracticeQuote({ user, subject: 'accountancy', mode: 'quick', count: 10, inventory: { ...counts, stale: true }, token: 'tok-123456789012', now: 0 });
  assert.equal(served.launchable, true);
});

test('wiring: requests serve the stored row; only the daily cron recounts, behind the production guard', () => {
  const inventory = source('src/lib/server/inventory.js');
  assert.doesNotMatch(inventory, /\bafter\(|next\/server|scheduleRefresh/, 'no background refresh after a response');
  const serve = body(inventory, 'publicInventory');
  assert.doesNotMatch(serve, /computeInventory|refreshInventory|from\('questions'\)/, 'publicInventory never counts');
  assert.match(serve, /servedInventory\(/);
  const refresh = body(inventory, 'refreshInventorySnapshot');
  const guard = refresh.indexOf("assertFullBankRead('the inventory refresh')");
  assert.ok(guard >= 0 && guard < refresh.indexOf('refreshInventory('), 'the guard runs before any read');
  // the write moved with the count into data/inventory_fingerprint.js (egress F1): still reported, never ignored
  assert.match(source('data/inventory_fingerprint.js'), /if \(error\) throw new Error\('INVENTORY_STORE_FAILED'\)/, 'a failed write is reported, not ignored');

  // The cron route is the only caller of the refresh.
  const callers = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(js|jsx|mjs)$/.test(name) && readFileSync(path, 'utf8').includes('refreshInventorySnapshot')) callers.push(`src/${path.slice(root.length + 1).split(sep).join('/')}`);
    }
  };
  const root = fileURLToPath(new URL('../../src', import.meta.url));
  walk(root);
  assert.deepEqual(callers.sort(), ['src/app/api/internal/refresh-inventory/route.js', 'src/lib/server/inventory.js']);

  const cron = source('src/app/api/internal/refresh-inventory/route.js');
  assert.match(cron, /isFullBankReadBlocked\(error\)[\s\S]*status: 409/, 'a blocked refresh is a clear 409, not a silent success');
  const stats = source('src/app/api/stats/route.js');
  assert.match(stats, /inventory\?\.state !== 'available'[\s\S]*status: 503[\s\S]*'Cache-Control': 'no-store'/, 'the fallback is never cached by browsers or the CDN');
});
