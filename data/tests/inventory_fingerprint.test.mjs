import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INVENTORY_SELECT, countInventory, readInventoryRows } from '../inventory_count.js';
import { FORCED_RECOUNT_MS, INVENTORY_LOGIC_VERSION, SAFETY_MARGIN_MS, deployHash, minFutureExpiry, recountReason, refreshInventory, withoutFingerprint } from '../inventory_fingerprint.js';
import { servedInventory } from '../../src/lib/server/inventorySnapshot.js';
import { sharedEligibilitySnapshot } from '../evidence_registry.js';
import { SECRET, buildBank, projectRow, setFixtureSecret } from './helpers/egress_fixtures.mjs';

// Egress item F1 (20 Oct 2026): the daily inventory count is skipped when nothing it depends on has changed. A recording fake of the
// tables the refresh touches, over the same generated banks the count tests use (legacy rows and signed evidence records).
const restore = setFixtureSecret();
after(restore);
// The fixtures' signed records expire one real hour after they are built, so the clock of these tests is the real clock and a
// "later run" is minutes later.
const BASE = Date.now();
const MIN = 60_000;
const OLD = '2026-09-01T00:00:00.000Z';
const ENV = { CUET_EVIDENCE_SIGNING_KEY: SECRET };
const VISIBLE = (r) => r.status === 'live' || (r.verification_state === 'verified' && r.exploration_state === 'active');

function world(seed = 7) {
  const questions = buildBank(seed).map((row) => ({ ...row, updated_at: OLD }));
  const holds = questions.filter((r) => r.family_id).filter((_, i) => i % 11 === 0).map((r) => ({ family_id: r.family_id }));
  return { questions, holds, snapshot: null };
}

function fakeFor(state, { failHead = false } = {}) {
  const calls = [];
  const db = {
    calls,
    from(name) {
      const q = { select: '*', opts: {}, filters: [], or: false, order: null, range: null, inList: null };
      const rows = () => {
        let list = (name === 'questions' ? state.questions : name === 'recovery_family_holds' ? state.holds : []).slice();
        for (const [kind, column, value] of q.filters) {
          if (kind === 'eq') list = list.filter((r) => r[column] === value);
          if (kind === 'gte') list = list.filter((r) => r[column] >= value);
        }
        if (q.inList) list = list.filter((r) => q.inList[1].includes(r[q.inList[0]]));
        if (q.or) list = list.filter(VISIBLE);
        if (q.order) list.sort((a, b) => (a[q.order] < b[q.order] ? -1 : a[q.order] > b[q.order] ? 1 : 0));
        if (q.range) list = list.slice(q.range[0], q.range[1] + 1);
        return list;
      };
      const builder = {
        select(columns, opts = {}) { q.select = columns ?? '*'; q.opts = opts; return builder; },
        eq(c, v) { q.filters.push(['eq', c, v]); return builder; },
        gte(c, v) { q.filters.push(['gte', c, v]); return builder; },
        in(c, v) { q.inList = [c, v]; return builder; },
        or(expression) { if (!expression.startsWith('status.eq.live')) throw new Error(`fake or() does not know ${expression}`); q.or = true; return builder; },
        order(c) { q.order = c; return builder; },
        range(a, b) { q.range = [a, b]; return builder; },
        async maybeSingle() {
          calls.push({ table: name, kind: 'row', select: q.select });
          return { data: name === 'public_inventory_snapshot' ? structuredClone(state.snapshot) : null, error: null };
        },
        async upsert(row) { calls.push({ table: name, kind: 'upsert' }); if (name === 'public_inventory_snapshot') state.snapshot = structuredClone({ value: row.value, computed_at: row.computed_at }); return { error: null }; },
        then(resolve, reject) {
          return (async () => {
            if (q.opts.head) {
              calls.push({ table: name, kind: 'count', filters: q.filters.map((f) => f.join('|')), bytes: 0 });
              if (failHead) return { count: null, error: { message: 'down' } };
              return { count: rows().length, error: null };
            }
            const list = rows();
            const data = name === 'questions' ? list.map((r) => projectRow(r, q.select, { strict: true })) : list.map((r) => structuredClone(r));
            calls.push({ table: name, kind: 'rows', select: q.select, rows: data.length, bytes: JSON.stringify(name === 'questions' ? list.map((r) => projectRow(r, q.select, { strict: false })) : list).length });
            return { data, error: null };
          })().then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return db;
}

const bigReads = (db) => db.calls.filter((c) => c.table === 'questions' && c.kind === 'rows');
const totalBytes = (db) => db.calls.reduce((n, c) => n + (c.bytes || 0), 0);
const run = (state, options = {}) => {
  const db = fakeFor(state, options.db);
  return refreshInventory(db, { now: () => options.now ?? BASE, env: options.env ?? ENV, log: () => {}, ...(options.snapshot ? { snapshot: options.snapshot } : {}) }).then((result) => ({ ...result, db }));
};
const fresh = async (state) => countInventory(await readInventoryRows(fakeFor(state)), fakeFor(state), { now: () => new Date(BASE) });
const same = (a, b) => assert.deepEqual({ ...withoutFingerprint(a), checkedAt: 0 }, { ...withoutFingerprint(b), checkedAt: 0 });

test('the first run counts everything and stores a fingerprint; no client can read it', async () => {
  const state = world();
  const first = await run(state);
  assert.equal(first.skipped, false);
  assert.equal(first.reason, 'no_stored_count');
  assert.ok(bigReads(first.db).length >= 1, 'a full read');
  const stored = state.snapshot.value;
  assert.equal(stored.fingerprint.v, 1);
  assert.equal(stored.fingerprint.candidateCount, state.questions.filter((r) => r.is_deleted === false && VISIBLE(r)).length);
  assert.equal(stored.fingerprint.totalRows, state.questions.length);
  assert.match(stored.fingerprint.deployHash, /^[0-9a-f]{64}$/);
  assert.ok(stored.fingerprint.minExpiresAt > BASE - 1, 'the managed fixtures expire in the future');
  same(stored, await fresh(state));
  assert.ok(!('fingerprint' in first.value), 'the returned value has no fingerprint');
  for (const age of [0, 40 * 3_600_000]) {
    const served = await servedInventory({ readStored: async () => ({ value: stored, computed_at: new Date(Date.now() - age).toISOString() }), warn: () => {} });
    assert.ok(!('fingerprint' in served.value), `served value (age ${age}) has no fingerprint`);
    assert.equal(served.value.bankSize, stored.bankSize);
  }
});

test('an unchanged bank costs head counts and the holds ids only: zero reads of the question rows, the stored count re-stamped', async () => {
  const state = world();
  const first = await run(state);
  const before = structuredClone(state.snapshot);
  const later = BASE + 10 * MIN;
  const second = await run(state, { now: later });
  assert.equal(second.skipped, true);
  assert.equal(bigReads(second.db).length, 0, 'no select of INVENTORY_SELECT');
  assert.ok(!second.db.calls.some((c) => c.select === INVENTORY_SELECT));
  assert.deepEqual(new Set(second.db.calls.map((c) => `${c.table}:${c.kind}`)), new Set(['public_inventory_snapshot:row', 'questions:count', 'recovery_family_holds:rows', 'public_inventory_snapshot:upsert']));
  assert.ok(totalBytes(second.db) < totalBytes(first.db) * 0.01, `${totalBytes(second.db)} vs ${totalBytes(first.db)}`);
  const after = state.snapshot;
  assert.equal(after.computed_at, new Date(later).toISOString(), 'computed_at advanced, so the 36 hour staleness rule keeps working');
  assert.equal(after.value.checkedAt, new Date(later).toISOString());
  assert.deepEqual({ ...after.value, checkedAt: 0, fingerprint: 0 }, { ...before.value, checkedAt: 0, fingerprint: 0 }, 'the counts are the stored ones');
  assert.equal(after.value.fingerprint.fullCountAt, before.value.fingerprint.fullCountAt, 'the date of the last full count is kept');
  assert.equal(after.value.fingerprint.readAt, later);
  assert.ok(!('fingerprint' in second.value));
  // a third and a fourth day: still no row read, and still equal to a fresh count
  for (let run_ = 2; run_ <= 5; run_ += 1) {
    const again = await run(state, { now: BASE + (10 * run_) * MIN });
    assert.equal(again.skipped, true, `run ${run_}`);
  }
  same(state.snapshot.value, await fresh(state));
  assert.deepEqual(state.snapshot.value.bankSize, first.value.bankSize);
});

async function afterChange(change, { now = BASE + 10 * MIN, env = ENV, snapshot, dbOptions } = {}) {
  const state = world();
  await run(state);
  change(state);
  const next = await run(state, { now, env, snapshot, db: dbOptions });
  return { state, next };
}

test('every change the count depends on forces a full recount, and the new count is the right one', async () => {
  const stamp = new Date(BASE + 5 * MIN).toISOString();
  const cases = [
    ['a row updated since the last read', (s) => { const r = s.questions.find((x) => x.status === 'live' && !x.family_id); r.explanation = 'The correct answer is A here.'; r.updated_at = stamp; }, 'rows_touched'],
    ['a vote (updated_at inside the margin window)', (s) => { s.questions[3].score = 1; s.questions[3].updated_at = new Date(BASE - SAFETY_MARGIN_MS + 1000).toISOString(); }, 'rows_touched'],
    ['a new row', (s) => { s.questions.push({ ...s.questions.find((x) => x.status === 'live'), id: 'q-new-1', updated_at: stamp }); }, null],
    ['a hard delete of a hidden row', (s) => { s.questions.splice(s.questions.findIndex((x) => !VISIBLE(x)), 1); }, 'row_count_changed'],
    ['a hard delete of a visible row', (s) => { s.questions.splice(s.questions.findIndex((x) => VISIBLE(x) && x.is_deleted === false), 1); }, 'visible_set_changed'],
    ['a row leaving the visible set without a stamp (a trigger bypass)', (s) => { s.questions.find((x) => x.status === 'live' && x.is_deleted === false).status = 'pending'; }, 'visible_set_changed'],
    ['a row turning visible without a stamp', (s) => { const r = s.questions.find((x) => x.status === 'pending'); r.status = 'live'; }, 'visible_set_changed'],
    ['a new hold', (s) => { s.holds.push({ family_id: s.questions.find((x) => x.family_id && !s.holds.some((h) => h.family_id === x.family_id)).family_id }); }, 'holds_changed'],
    ['a removed hold', (s) => { s.holds.pop(); }, 'holds_changed'],
  ];
  for (const [name, change, reason] of cases) {
    const { state, next } = await afterChange(change);
    assert.equal(next.skipped, false, name);
    if (reason) assert.equal(next.reason, reason, name);
    assert.ok(bigReads(next.db).length >= 1, `${name}: full read`);
    same(state.snapshot.value, await fresh(state));
  }
});

test('a changed deploy, environment, key, clock or age forces a full recount', async () => {
  const snapshot = sharedEligibilitySnapshot();
  const changed = JSON.parse(JSON.stringify(snapshot)); changed.registry.__touched = true;
  const cases = [
    ['a changed calibration or source registry', { snapshot: changed }, 'deploy_changed'],
    ['MOCK_AI toggled', { env: { ...ENV, MOCK_AI: 'true' } }, 'deploy_changed'],
    ['the confidence threshold changed', { env: { ...ENV, NTA_LOCAL_ANSWER_CONFIDENCE_THRESHOLD: '0.9' } }, 'deploy_changed'],
    ['the signing key rotated', { env: { CUET_EVIDENCE_SIGNING_KEY: `${SECRET}-rotated` } }, 'deploy_changed'],
    ['an evidence record expired (no row changed)', { now: BASE + 61 * MIN }, 'evidence_expired'],
    ['the last full count is seven days old', { now: BASE + FORCED_RECOUNT_MS + 1000, env: ENV }, null],
  ];
  for (const [name, options, reason] of cases) {
    const state = world();
    await run(state);
    // keep the evidence from expiring in the age case, so the reason under test is the age
    if (name.includes('seven days')) state.snapshot.value.fingerprint.minExpiresAt = null;
    const next = await run(state, { now: BASE + 10 * MIN, ...options });
    assert.equal(next.skipped, false, name);
    if (reason) assert.equal(next.reason, reason, name);
    else assert.equal(next.reason, 'forced_recount', name);
    assert.ok(bigReads(next.db).length >= 1, name);
  }
  assert.equal(deployHash({ env: ENV, snapshot }), deployHash({ env: ENV, snapshot }), 'stable');
  assert.notEqual(deployHash({ env: ENV, snapshot }), deployHash({ env: { ...ENV, MOCK_AI: 'true' }, snapshot }));
  assert.equal(deployHash({ env: ENV, snapshot: undefined }), null, 'an unreadable registry is no skip');
  assert.ok(!deployHash({ env: ENV, snapshot }).includes(SECRET));
});

test('a probe error, a missing fingerprint or an unusable stored count is the old full count', async () => {
  const state = world();
  await run(state);
  const broken = await run(state, { now: BASE + 10 * MIN, db: { failHead: true } });
  assert.equal(broken.skipped, false);
  assert.equal(broken.reason, 'probes_unavailable');
  assert.ok(bigReads(broken.db).length >= 1);
  assert.ok(!state.snapshot.value.fingerprint, 'a run whose probes failed stores no fingerprint, so the next run counts too');
  const next = await run(state, { now: BASE + 20 * MIN });
  assert.equal(next.reason, 'no_fingerprint');
  assert.equal((await run(state, { now: BASE + 30 * MIN })).skipped, true, 'and then the skips resume');
  state.snapshot.value.state = 'unavailable';
  assert.equal((await run(state, { now: BASE + 40 * MIN })).reason, 'no_stored_count');
  assert.equal(recountReason({ stored: null, probes: null, deploy: 'x', now: 1 }), 'no_stored_count');
  const malformed = { value: { state: 'available', fingerprint: { v: 1 } } };
  assert.equal(recountReason({ stored: malformed, probes: { touched: 0 }, deploy: 'x', now: 1 }), 'no_fingerprint');
});

test('a change after a skipped run is still seen (the window moves with each run, with the margin)', async () => {
  const state = world();
  await run(state);
  await run(state, { now: BASE + 10 * MIN });
  await run(state, { now: BASE + 20 * MIN });
  const r = state.questions.find((x) => x.status === 'live' && !x.family_id);
  r.explanation = 'The correct answer is B here.';
  r.updated_at = new Date(BASE + 25 * MIN).toISOString();
  const next = await run(state, { now: BASE + 30 * MIN });
  assert.equal(next.skipped, false);
  assert.equal(next.reason, 'rows_touched');
  // the touched probe asks from (previous read - 15 minutes)
  const probe = next.db.calls.find((c) => c.kind === 'count' && c.filters.some((f) => f.startsWith('gte|updated_at')));
  assert.ok(probe);
  assert.equal(probe.filters.find((f) => f.startsWith('gte|updated_at')), `gte|updated_at|${new Date(BASE + 20 * MIN - SAFETY_MARGIN_MS).toISOString()}`);
});

test('minFutureExpiry ignores records already expired, and recountReason skips only at an exact match', () => {
  const rows = [{ evidence: { record: { expires_at: new Date(BASE + 5000).toISOString() } } }, { evidence: { record: { expires_at: new Date(BASE - 5000).toISOString() } } }, { evidence: null }, {}];
  assert.equal(minFutureExpiry(rows, BASE), BASE + 5000);
  assert.equal(minFutureExpiry([{ evidence: { record: { expires_at: new Date(BASE - 1).toISOString() } } }], BASE), null);
  const fp = { v: 1, readAt: BASE, fullCountAt: BASE, candidateCount: 3, totalRows: 4, holdsHash: 'h', deployHash: 'd', minExpiresAt: BASE + 10 };
  const stored = { value: { state: 'available', fingerprint: fp } };
  const probes = { candidateCount: 3, totalRows: 4, holdsHash: 'h', touched: 0 };
  assert.equal(recountReason({ stored, probes, deploy: 'd', now: BASE + 5 }), null);
  assert.equal(recountReason({ stored, probes, deploy: 'd', now: BASE + 10 }), 'evidence_expired');
  assert.equal(recountReason({ stored, probes: { ...probes, touched: 1 }, deploy: 'd', now: BASE + 5 }), 'rows_touched');
  assert.equal(recountReason({ stored, probes: { ...probes, touched: null }, deploy: 'd', now: BASE + 5 }), 'probes_unavailable');
  assert.equal(recountReason({ stored, probes, deploy: 'd', now: BASE - 1 }), 'forced_recount', 'a clock before the last count is not trusted');
});

// ---- the pin: the count's source files ------------------------------------------------------------------------------
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function closure(entry) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(js|mjs)$/.test(file)) return;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      let target = resolve(dirname(file), m[1]);
      if (!existsSync(target)) target = ['.js', '.mjs', '.json'].map((e) => target + e).find(existsSync) || target;
      if (existsSync(target)) walk(target);
    }
  };
  walk(resolve(root, entry));
  return [...seen].sort();
}
const hashOfClosure = () => {
  const h = createHash('sha256');
  for (const file of closure('data/inventory_count.js')) h.update(`${relative(root, file).replaceAll('\\', '/')}\n${readFileSync(file, 'utf8').replace(/\r\n/g, '\n')}\n`);
  return h.digest('hex');
};
// If this test fails, a file the count depends on changed: bump INVENTORY_LOGIC_VERSION in data/inventory_fingerprint.js (so the next
// cron run counts in full) and then update the two pinned values below.
const PINNED_LOGIC_VERSION = 'inventory-logic-1';
const PINNED_SOURCE_HASH = 'c0290ee74bcdaab00502206deda6cf18695b5d54f10baf016f01e5f8a6134853';

test('the pin: the count\'s source files and INVENTORY_LOGIC_VERSION change together', () => {
  const files = closure('data/inventory_count.js').map((f) => relative(root, f).replaceAll('\\', '/'));
  for (const expected of ['data/inventory_count.js', 'data/practice_library.js', 'data/evidence_registry.js', 'data/content_evidence.js', 'data/answer_integrity.js', 'data/evidence_holds.js', 'data/practice_availability.js', 'data/cuet_controls.js']) assert.ok(files.includes(expected), expected);
  assert.equal(INVENTORY_LOGIC_VERSION, PINNED_LOGIC_VERSION, 'the version was bumped: update PINNED_LOGIC_VERSION and PINNED_SOURCE_HASH');
  assert.equal(hashOfClosure(), PINNED_SOURCE_HASH, 'a source file of the inventory count changed: bump INVENTORY_LOGIC_VERSION, then pin the new hash');
});

test('wiring: the refresh uses the fingerprint module, the served row loses the fingerprint, nothing else about the cron changes', () => {
  const src = (p) => readFileSync(join(root, p), 'utf8');
  assert.match(src('src/lib/server/inventory.js'), /refreshInventory\(supabaseAdmin\(\)\)/);
  assert.match(src('src/lib/server/inventory.js'), /assertFullBankRead\('the inventory refresh'\);\n  const db|assertFullBankRead\('the inventory refresh'\);/);
  assert.match(src('src/lib/server/inventorySnapshot.js'), /withoutFingerprint\(stored\.value\)/);
  assert.match(src('src/app/api/internal/refresh-inventory/route.js'), /inventory = await refreshInventorySnapshot\(\);/);
});
