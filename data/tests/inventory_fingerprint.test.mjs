import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INVENTORY_COLUMNS, INVENTORY_SELECT, countInventory, readInventoryRows } from '../inventory_count.js';
import { FORCED_RECOUNT_MS, INVENTORY_LOGIC_VERSION, SAFETY_MARGIN_MS, deployHash, minFutureExpiry, readContentDigest, recountReason, refreshInventory, withoutFingerprint } from '../inventory_fingerprint.js';
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

// What public.inventory_content_digest() computes (migration 20261020160100; egress_review.test.mjs runs the real SQL): the counted columns of
// the counted rows, with score reduced to the floor the count applies.
const COUNTED_COLUMNS = INVENTORY_COLUMNS.filter((c) => c !== 'score');
const digestOf = (state) => createHash('md5').update(state.questions.filter((r) => r.is_deleted === false && VISIBLE(r)).sort((a, b) => (a.id < b.id ? -1 : 1))
  .map((r) => JSON.stringify([...COUNTED_COLUMNS.map((c) => r[c] ?? null), Number(r.score ?? 0) >= -2])).join('\n')).digest('hex');

function fakeFor(state, { failHead = false, digest = false } = {}) {
  const calls = [];
  const db = {
    calls,
    // digest: false = the function is not applied (PGRST202), 'fail' = it errors, true = it answers
    rpc(fn) {
      calls.push({ table: fn, kind: 'rpc', bytes: 32 });
      if (digest === false) return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
      if (digest === 'fail') return Promise.resolve({ data: null, error: { code: '57014', message: 'statement timeout' } });
      return Promise.resolve({ data: digestOf(state), error: null });
    },
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
const PINNED_LOGIC_VERSION = 'inventory-logic-2';
const PINNED_SOURCE_HASH = 'ede8ec07a5df7e0260790d3e80667071fa134a2f039761c3316d105723e928fd';

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

// ---- a vote touches updated_at and nothing the count reads (review: egress problem 5) -----------------------------------------------
// The fixtures' deliberately stale records expire one real second before the bank is built, which is after BASE when this part of the file
// runs (the suite has been going for seconds), so they would look "future" to the virtual clock: put them clearly in the past.
function stableWorld(seed = 7) {
  const w = world(seed);
  for (const r of w.questions) {
    const rec = r.evidence?.record;
    if (rec && Date.parse(rec.expires_at) < BASE + 30 * MIN) r.evidence = { ...r.evidence, record: { ...rec, expires_at: new Date(BASE - 1000).toISOString() } };
  }
  return w;
}
const VOTE_AT = () => new Date(BASE + 5 * MIN).toISOString();
// A vote on a question that is above the score floor stays above it.
const vote = (s) => { const r = s.questions.find((x) => x.status === 'live' && x.is_deleted === false && Number(x.score ?? 0) >= -1); r.upvotes = (r.upvotes || 0) + 1; r.score = Number(r.score ?? 0) + 1; r.updated_at = VOTE_AT(); return r; };

test('a vote on a question touches updated_at, and the digest of the counted columns keeps the skip: no question row is read', async () => {
  const state = stableWorld();
  const first = await run(state, { db: { digest: true } });
  assert.equal(first.skipped, false);
  assert.match(state.snapshot.value.fingerprint.contentDigest, /^[0-9a-f]{32}$/, 'the digest is stored beside the count');
  assert.ok(!('contentDigest' in first.value) && !JSON.stringify(first.value).includes('contentDigest'), 'and never served');
  vote(state);
  const second = await run(state, { now: BASE + 10 * MIN, db: { digest: true } });
  assert.equal(second.skipped, true, 'the vote alone does not recount');
  assert.equal(bigReads(second.db).length, 0, 'zero question rows read');
  const touchedProbe = second.db.calls.find((c) => c.kind === 'count' && c.filters.some((f) => f.startsWith('gte|updated_at')));
  assert.ok(touchedProbe, 'the touched probe saw the vote');
  assert.equal(second.db.calls.filter((c) => c.kind === 'rpc').length, 1, 'one digest call, 32 bytes');
  assert.ok(totalBytes(second.db) < totalBytes(first.db) * 0.01);
  same(state.snapshot.value, await fresh(state));
  assert.equal(state.snapshot.value.fingerprint.contentDigest, digestOf(state));
  // the touched window reaches 15 minutes before the last read, so the next run still sees the vote and skips the same way
  const third = await run(state, { now: BASE + 30 * MIN, db: { digest: true } });
  assert.equal(third.skipped, true);
  assert.equal(bigReads(third.db).length, 0);
  // and once the vote is behind that window nothing is touched and no digest is asked for
  const fourth = await run(state, { now: BASE + 50 * MIN, db: { digest: true } });
  assert.equal(fourth.skipped, true);
  assert.equal(fourth.db.calls.filter((c) => c.kind === 'rpc').length, 0, 'an untouched bank asks for no digest');
});

test('a touched row that changes something the count reads still forces the full recount', async () => {
  const changes = [
    ['an edited explanation', (s) => { const r = s.questions.find((x) => x.status === 'live' && !x.family_id && x.is_deleted === false); r.explanation = 'The correct answer is A here.'; r.updated_at = VOTE_AT(); }],
    ['a changed answer key', (s) => { const r = s.questions.find((x) => x.status === 'live' && x.is_deleted === false); r.correct_index = (Number(r.correct_index) + 1) % 4; r.updated_at = VOTE_AT(); }],
    ['a vote that sinks a question below the score floor', (s) => { const r = s.questions.find((x) => x.status === 'live' && x.is_deleted === false); r.score = -3; r.downvotes = 3; r.updated_at = VOTE_AT(); }],
    ['an edited evidence record', (s) => { const r = s.questions.find((x) => x.evidence && x.is_deleted === false && VISIBLE(x)); r.evidence = { ...r.evidence, record: { ...r.evidence.record, note: 'edited' } }; r.updated_at = VOTE_AT(); }],
    ['a moderation flag', (s) => { const r = s.questions.find((x) => x.status === 'live' && x.is_deleted === false); r.verification_state = 'disputed'; r.updated_at = VOTE_AT(); }],
  ];
  for (const [name, change] of changes) {
    const state = stableWorld();
    await run(state, { db: { digest: true } });
    change(state);
    const next = await run(state, { now: BASE + 10 * MIN, db: { digest: true } });
    assert.equal(next.skipped, false, name);
    assert.equal(next.reason, 'rows_touched', name);
    assert.ok(bigReads(next.db).length >= 1, name);
    same(state.snapshot.value, await fresh(state));
    assert.equal(state.snapshot.value.fingerprint.contentDigest, digestOf(state), name);
  }
});

test('without the function, a stored digest or a working call, a touched row is the full recount it always was', async () => {
  // function not applied
  let state = stableWorld();
  await run(state);
  assert.ok(!('contentDigest' in state.snapshot.value.fingerprint), 'no digest stored when the function is missing');
  vote(state);
  let next = await run(state, { now: BASE + 10 * MIN });
  assert.equal(next.reason, 'rows_touched');
  assert.ok(bigReads(next.db).length >= 1);
  // the previous count was made before the function existed: no digest to compare
  state = stableWorld();
  await run(state);
  vote(state);
  next = await run(state, { now: BASE + 10 * MIN, db: { digest: true } });
  assert.equal(next.reason, 'rows_touched');
  assert.equal(state.snapshot.value.fingerprint.contentDigest, digestOf(state), 'and this count stores one, so the next vote is a skip');
  vote(state);
  assert.equal((await run(state, { now: BASE + 20 * MIN, db: { digest: true } })).skipped, true);
  // the function fails (timeout)
  state = stableWorld();
  await run(state, { db: { digest: true } });
  vote(state);
  next = await run(state, { now: BASE + 10 * MIN, db: { digest: 'fail' } });
  assert.equal(next.reason, 'rows_touched');
  assert.ok(bigReads(next.db).length >= 1);
  assert.ok(!('contentDigest' in state.snapshot.value.fingerprint), 'a failed digest is not stored');
  // a digest that is not 32 hex characters is no digest
  assert.equal(await readContentDigest({ rpc: async () => ({ data: 'oops', error: null }) }), null);
  assert.equal(await readContentDigest({ rpc: async () => { throw new Error('down'); } }), null);
  assert.equal(await readContentDigest({}), null);
});

test('with equal digests the other reasons still win: an expired evidence record or a week-old count recounts', async () => {
  let state = stableWorld();
  await run(state, { db: { digest: true } });
  vote(state);
  let next = await run(state, { now: BASE + 61 * MIN, db: { digest: true } });
  assert.equal(next.reason, 'evidence_expired');
  state = stableWorld();
  await run(state, { db: { digest: true } });
  state.snapshot.value.fingerprint.minExpiresAt = null;
  vote(state);
  next = await run(state, { now: BASE + FORCED_RECOUNT_MS + 1000, db: { digest: true } });
  assert.equal(next.reason, 'forced_recount');
  const fp = { v: 1, readAt: BASE, fullCountAt: BASE, candidateCount: 3, totalRows: 4, holdsHash: 'h', deployHash: 'd', minExpiresAt: null, contentDigest: 'a'.repeat(32) };
  const stored = { value: { state: 'available', fingerprint: fp } };
  const probes = { candidateCount: 3, totalRows: 4, holdsHash: 'h', touched: 2 };
  assert.equal(recountReason({ stored, probes, deploy: 'd', now: BASE + 5, contentDigest: 'a'.repeat(32) }), null);
  assert.equal(recountReason({ stored, probes, deploy: 'd', now: BASE + 5, contentDigest: 'b'.repeat(32) }), 'rows_touched');
  assert.equal(recountReason({ stored, probes, deploy: 'd', now: BASE + 5 }), 'rows_touched', 'no digest asked for, none compared');
  assert.equal(recountReason({ stored, probes: { ...probes, holdsHash: 'x' }, deploy: 'd', now: BASE + 5, contentDigest: 'a'.repeat(32) }), 'holds_changed', 'a changed hold is not hidden by an equal digest');
});
