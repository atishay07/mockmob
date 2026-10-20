import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStudyContentCache, readActiveStudyRuns } from '../study_content_cache.js';

// Egress item A2 (20 Oct 2026): published study units and cards are kept in memory and revalidated with a probe.
// A counting fake of the three supabase queries the cache issues.
function fakeStudyDb({ units, cards, runs = [] }) {
  const log = [];
  const db = {
    log,
    units, cards, runs,
    from(table) {
      const state = { table, select: '*', filters: [], in: null, orders: [], limit: null };
      const q = {
        select(columns) { state.select = columns; return q; },
        eq(column, value) { state.filters.push([column, value]); return q; },
        in(column, values) { state.in = [column, values]; return q; },
        order(column, opts) { state.orders.push([column, opts]); return q; },
        limit(n) { state.limit = n; return q; },
        then(resolve, reject) {
          let rows = table === 'study_units' ? this_units() : table === 'study_cards' ? this_cards() : this_runs();
          function this_units() { return state.filters.reduce((r, [c, v]) => r.filter((x) => x[c] === v), db.units); }
          function this_cards() { return state.in ? db.cards.filter((x) => state.in[1].includes(x[state.in[0]])) : db.cards; }
          function this_runs() { return state.filters.reduce((r, [c, v]) => r.filter((x) => (c === 'projection->>state' ? x.projection.state : x[c]) === v), db.runs); }
          const cols = state.select === '*' ? null : state.select.split(',');
          const out = rows.map((row) => (cols ? Object.fromEntries(cols.map((c) => [c, row[c]])) : row));
          log.push({ table, select: state.select, bytes: JSON.stringify(out).length, filters: state.filters, in: state.in, orders: state.orders, limit: state.limit });
          return Promise.resolve({ data: out, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  return db;
}
const unit = (id, version = 1, hash = `h-${id}`) => ({ id, version, content_hash: hash, publication_state: 'published', content: { id, title: `Lesson ${id}`, blocks: Array.from({ length: 6 }, (_, i) => ({ id: `${id}-b${i}`, text: 'Teaching text. '.repeat(40) })) } });
const card = (id, unitId, version = 1, hash = `h-${id}`) => ({ id, version, unit_id: unitId, unit_version: 1, content_hash: hash, content: { id, prompt: 'Recall this. '.repeat(30) } });
const clock = (start = 1_000_000) => { let t = start; const fn = () => t; fn.advance = (ms) => { t += ms; }; return fn; };
const fixture = () => ({
  units: ['u1', 'u2', 'u3'].map((id) => unit(id)),
  cards: ['u1', 'u2', 'u3'].flatMap((u) => [1, 2, 3, 4].map((n) => card(`${u}-c${n}`, u))),
});
const reads = (db, table, select) => db.log.filter((l) => l.table === table && (!select || l.select === select));

test('A2: a second read inside the TTL costs zero queries; the rows equal a fresh read', async () => {
  const db = fakeStudyDb(fixture());
  const now = clock();
  const cache = createStudyContentCache({ now });
  const first = await cache.publishedUnitRows(db, null);
  const firstCards = await cache.publishedCardRows(db, first.map((u) => u.id));
  const before = db.log.length;
  const second = await cache.publishedUnitRows(db, null);
  const secondCards = await cache.publishedCardRows(db, second.map((u) => u.id));
  assert.equal(db.log.length, before, 'no query inside the TTL');
  assert.deepEqual(second, first);
  assert.deepEqual(secondCards, firstCards);
  assert.deepEqual(second, db.units, 'equals what a fresh select(*) returns');
});

test('A2: after the TTL an unchanged signature costs only the small probe, never the full rows', async () => {
  const db = fakeStudyDb(fixture());
  const now = clock();
  const cache = createStudyContentCache({ now });
  await cache.publishedUnitRows(db, null);
  await cache.publishedCardRows(db, ['u1', 'u2', 'u3']);
  db.log.length = 0;
  now.advance(61_000);
  await cache.publishedUnitRows(db, null);
  await cache.publishedCardRows(db, ['u1', 'u2', 'u3']);
  assert.equal(reads(db, 'study_units', '*').length, 0);
  assert.equal(reads(db, 'study_cards', '*').length, 0);
  assert.deepEqual(db.log.map((l) => [l.table, l.select]), [['study_units', 'id,version,content_hash'], ['study_cards', 'id,version,content_hash,unit_id,unit_version']]);
  const probeBytes = db.log.reduce((n, l) => n + l.bytes, 0);
  const fullBytes = JSON.stringify(db.units).length + JSON.stringify(db.cards).length;
  assert.ok(probeBytes < fullBytes * 0.1, `probe ${probeBytes} B vs full ${fullBytes} B`);
});

test('A2: a changed hash, a new version or a quarantined unit forces a full reload within one probe interval', async () => {
  const data = fixture();
  const db = fakeStudyDb(data);
  const now = clock();
  const cache = createStudyContentCache({ now });
  await cache.publishedUnitRows(db, null);
  // quarantine: the unit leaves the published set
  db.units = data.units.filter((u) => u.id !== 'u2');
  const probeOnly = await cache.publishedUnitRows(db, null);
  assert.equal(probeOnly.length, 3, 'still inside the TTL: memoised');
  now.advance(60_001);
  const after = await cache.publishedUnitRows(db, null);
  assert.deepEqual(after.map((u) => u.id), ['u1', 'u3']);
  // a re-published unit with a new hash
  db.units = [unit('u1', 2, 'new-hash'), ...db.units.filter((u) => u.id !== 'u1')];
  now.advance(60_001);
  const reloaded = await cache.publishedUnitRows(db, null);
  assert.ok(reloaded.some((u) => u.id === 'u1' && u.version === 2 && u.content_hash === 'new-hash'));
  // cards: a card whose hash changed
  await cache.publishedCardRows(db, ['u1']);
  db.cards = db.cards.map((c) => (c.id === 'u1-c1' ? { ...c, content_hash: 'changed', version: 2 } : c));
  now.advance(60_001);
  const cards = await cache.publishedCardRows(db, ['u1']);
  assert.ok(cards.some((c) => c.id === 'u1-c1' && c.version === 2));
});

test('A2: the hard maximum age forces a full reload even when the probe is unchanged', async () => {
  const db = fakeStudyDb(fixture());
  const now = clock();
  const cache = createStudyContentCache({ now, maxAgeMs: 10 * 60_000 });
  await cache.publishedUnitRows(db, null);
  for (let i = 0; i < 9; i += 1) { now.advance(61_000); await cache.publishedUnitRows(db, null); }
  db.log.length = 0;
  now.advance(61_000);
  await cache.publishedUnitRows(db, null);
  assert.equal(reads(db, 'study_units', '*').length, 1);
});

test('A2: subset requests (a run\'s own units) are answered from memory and match the old filtered query', async () => {
  const db = fakeStudyDb(fixture());
  const cache = createStudyContentCache({ now: clock() });
  await cache.publishedUnitRows(db, null);
  db.log.length = 0;
  const subset = await cache.publishedUnitRows(db, ['u3', 'u1', 'u1']);
  assert.equal(db.log.length, 0);
  assert.deepEqual(subset, db.units.filter((u) => ['u1', 'u3'].includes(u.id)));
  assert.deepEqual(await cache.publishedUnitRows(db, []), []);
});

test('A2: cards are keyed by exactly the unit ids asked for; entries are bounded; callers get copies', async () => {
  const db = fakeStudyDb(fixture());
  const cache = createStudyContentCache({ now: clock(), maxCardEntries: 2 });
  const a = await cache.publishedCardRows(db, ['u1']);
  assert.deepEqual(a.map((c) => c.unit_id), ['u1', 'u1', 'u1', 'u1']);
  const ab = await cache.publishedCardRows(db, ['u2', 'u1']);
  assert.equal(ab.length, 8);
  assert.equal(reads(db, 'study_cards', '*').length, 2, 'two different keys, two reads');
  await cache.publishedCardRows(db, ['u3']);
  assert.equal(cache._size().cardKeys, 2, 'bounded');
  a[0].content.prompt = 'MUTATED';
  const again = await cache.publishedCardRows(db, ['u3']);
  again[0].content.prompt = 'MUTATED';
  const fresh = await cache.publishedCardRows(db, ['u3']);
  assert.notEqual(fresh[0].content.prompt, 'MUTATED');
  assert.deepEqual(await cache.publishedCardRows(db, []), []);
});

test('A2: a failed read is thrown and is not remembered', async () => {
  const db = fakeStudyDb(fixture());
  const cache = createStudyContentCache({ now: clock() });
  const real = db.from.bind(db);
  db.from = () => ({ select() { return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ data: null, error: new Error('down') }).then(resolve); } });
  await assert.rejects(cache.publishedUnitRows(db, null), /down/);
  db.from = real;
  assert.equal((await cache.publishedUnitRows(db, null)).length, 3);
});

test('A2: the runs read carries the active filter, drops the limit, and still finds an old active run', async () => {
  const runs = Array.from({ length: 130 }, (_, i) => ({ id: `r${i}`, user_id: 'me', mode: 'learn', content: {}, projection: { state: i === 129 ? 'active' : 'complete' }, updated_at: new Date(Date.UTC(2026, 9, 1) + (200 - i) * 60000).toISOString() }));
  runs.push({ id: 'other-active', user_id: 'someone-else', mode: 'learn', content: {}, projection: { state: 'active' }, updated_at: 'x' });
  const db = fakeStudyDb({ units: [], cards: [], runs });
  const { data, error } = await readActiveStudyRuns(db, 'me');
  assert.equal(error, null);
  assert.deepEqual(data.map((r) => r.id), ['r129'], 'the active run older than the newest 100 is found; another user\'s is not');
  const call = db.log[0];
  assert.deepEqual(call.filters, [['user_id', 'me'], ['projection->>state', 'active']]);
  assert.equal(call.limit, null);
});

test('A2: study.js uses the cache and passes the content it already read instead of reading it again', () => {
  const src = readFileSync(new URL('../../src/lib/server/study.js', import.meta.url), 'utf8');
  assert.match(src, /createStudyContentCache\(\)/);
  assert.doesNotMatch(src, /from\('study_units'\)\.select\('\*'\)/, 'no direct select(*) of study_units remains in study.js');
  assert.doesNotMatch(src, /from\('study_cards'\)\.select\('\*'\)/);
  assert.match(src, /studyRecord\(userId,\{subject:unit\.subject,allUnits:units,allCards\}\)/);
  assert.match(src, /studyRecord\(userId,\{allSubjects:true,allUnits,allCards,prefs\}\)/);
  assert.match(src, /readActiveStudyRuns\(supabaseAdmin\(\),userId\)/);
  assert.doesNotMatch(src, /limit\(100\)/);
});
