// Usage data and consent. D183 (owner, 20 Oct 2026): usage data is on for people who say they are 18 or older and for people
// who choose "Rather not say" (age band 'unknown' with an answer); it is off only for a student who says they are under 18
// (age band 'minor'); anyone can switch it off, and switching it off deletes what was collected.
// This file holds: the original migration, the D183 migration and its undo against a real Postgres (PGlite), the pure rule
// (canCollect), the batch normaliser, the consent route (PUT and GET) and the events route against a fake PostgREST, and the
// website's privacy section and privacy page.
// Run: node --test data/tests/usage_consent.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canCollect, normalizeBatch, POLICY_VERSION, EVENT_NAMES, AGE_BANDS } from '../../src/lib/server/usage.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const BASE_SQL = read('supabase/migrations/20261012120000_usage_consent_and_events.sql');
const D183_SQL = read('supabase/migrations/20261020160000_usage_consent_d183.sql');
const D183_UNDO = read('supabase/undo/20261020160000_usage_consent_d183.undo.sql');

async function freshDatabase(users) {
  const db = new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role;');
  await db.exec('create table public.users(id text primary key);');
  for (const id of users) await db.query('insert into public.users values($1)', [id]);
  return db;
}
const eventRow = (id) => ({ event_id: id, name: 'app_opened', platform: 'android', app_version: '1', occurred_at: new Date().toISOString(), props: { screen: 'home' } });
const rpc = (db, user, rows) => db.query('select insert_usage_events($1, $2::jsonb) n', [user, JSON.stringify(rows)]).then((r) => Number(r.rows[0].n));
const countEvents = (db, user) => db.query('select count(*)::int n from usage_events where user_id = $1', [user]).then((r) => r.rows[0].n);

test('migration, constraints, dedupe, purge', async () => {
  const db = await freshDatabase(['u1']);
  try {
    await db.exec(BASE_SQL); await db.exec(BASE_SQL); // idempotent
    // Before D183 the table check allowed usage data for adults only.
    await assert.rejects(db.query("insert into usage_consent(user_id,age_band,analytics_allowed,policy_version) values('u1','minor',true,'x')"), /usage_consent_adult_only|check/);
    await assert.rejects(db.query("insert into usage_consent(user_id,age_band,analytics_allowed,policy_version) values('u1','unknown',true,'x')"), /usage_consent_adult_only|check/);
    await db.exec(D183_SQL); await db.exec(D183_SQL); // idempotent
    // After D183: never for under 18, allowed for 18 or older and for "Rather not say".
    await assert.rejects(db.query("insert into usage_consent(user_id,age_band,analytics_allowed,policy_version) values('u1','minor',true,'x')"), /usage_consent_minor_off|check/);
    await assert.rejects(db.query("insert into usage_consent(user_id,age_band,analytics_allowed,policy_version) values('u1','teen',false,'x')"), /check/);
    await db.query("insert into usage_consent(user_id,age_band,analytics_allowed,policy_version) values('u1','unknown',true,'x')");
    await db.query("update usage_consent set age_band='adult' where user_id='u1'");
    await assert.rejects(db.query("update usage_consent set age_band='minor' where user_id='u1'"), /usage_consent_minor_off|check/);
    const ins = id => db.query("insert into usage_events(event_id,user_id,name,platform,occurred_at) values($1,'u1','app_opened','android',now()) on conflict (event_id) do nothing", [id]);
    await ins('e1'); await ins('e1'); await ins('e2');
    assert.equal((await db.query('select count(*)::int n from usage_events')).rows[0].n, 2);
    await assert.rejects(db.query("insert into usage_events(event_id,user_id,name,platform,occurred_at) values('p','u1','x','ios',now())"), /check/);
    await assert.rejects(db.query("insert into usage_events(event_id,user_id,name,platform,occurred_at,props) values('big','u1','x','web',now(),$1)", [JSON.stringify({ a: 'x'.repeat(1100) })]), /check/);
    await db.exec("delete from usage_events");
    assert.equal(await rpc(db, 'u1', [eventRow('r1'), eventRow('r2')]), 2);
    assert.equal(await rpc(db, 'u1', [eventRow('r1')]), 0);
    await db.exec("update usage_consent set analytics_allowed=false, withdrawn_at=now() where user_id='u1'");
    assert.equal(await rpc(db, 'u1', [eventRow('r3')]), 0);
    await db.exec("update usage_consent set analytics_allowed=true, withdrawn_at=null where user_id='u1'");
    await db.exec("delete from usage_events");
    await ins('e1'); await ins('e2');
    await db.exec("update usage_events set received_at = now() - interval '200 days' where event_id='e1'");
    assert.equal(Number((await db.query('select purge_usage_events() n')).rows[0].n), 1);
    assert.equal((await db.query('select count(*)::int n from usage_events')).rows[0].n, 1);
    await db.exec("delete from public.users where id='u1'");
    assert.equal((await db.query('select count(*)::int n from usage_events')).rows[0].n, 0);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from usage_events'), /permission denied/);
  } finally { await db.close(); }
});

test('D183 migration: the consent-gated insert collects for 18 or older and Rather not say, never for under 18, withdrawn or no row', async () => {
  const db = await freshDatabase(['adult', 'unknown', 'minor', 'norow', 'adultOff', 'unknownOff', 'unknownWithdrawn', 'adultWithdrawn']);
  try {
    await db.exec(BASE_SQL); await db.exec(D183_SQL);
    const consent = (user, band, allowed, withdrawn = false) => db.query(
      `insert into usage_consent(user_id,age_band,analytics_allowed,policy_version,decided_at,withdrawn_at) values($1,$2,$3,'x',now(),${withdrawn ? 'now()' : 'null'})`, [user, band, allowed]);
    await consent('adult', 'adult', true);
    await consent('unknown', 'unknown', true);          // "Rather not say" with usage data on
    await consent('minor', 'minor', false);             // under 18: off
    await consent('adultOff', 'adult', false);
    await consent('unknownOff', 'unknown', false);      // "Rather not say", switched off
    await consent('unknownWithdrawn', 'unknown', true, true);   // withdrawn_at set: never collects, whatever the flag says
    await consent('adultWithdrawn', 'adult', true, true);
    assert.equal(await rpc(db, 'adult', [eventRow('a1'), eventRow('a2')]), 2);
    assert.equal(await rpc(db, 'unknown', [eventRow('u1'), eventRow('u2'), eventRow('u3')]), 3);
    for (const [user, id] of [['minor', 'm1'], ['norow', 'n1'], ['adultOff', 'o1'], ['unknownOff', 'o2'], ['unknownWithdrawn', 'w1'], ['adultWithdrawn', 'w2']]) {
      assert.equal(await rpc(db, user, [eventRow(id)]), 0, user);
      assert.equal(await countEvents(db, user), 0, user);
    }
    // Switching off ("Rather not say" keeps its band) stops collection straight away.
    await db.exec("update usage_consent set analytics_allowed=false, withdrawn_at=now() where user_id='unknown'");
    assert.equal(await rpc(db, 'unknown', [eventRow('u4')]), 0);
    // The row the route writes when a student under 18 is on file never allows collection, whatever the RPC is asked.
    await assert.rejects(db.query("update usage_consent set analytics_allowed=true where user_id='minor'"), /usage_consent_minor_off|check/);
    // The browser roles still cannot call it.
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select insert_usage_events('adult', '[]'::jsonb)"), /permission denied/);
  } finally { await db.close(); }
});

test('D183 undo: the adult-only rule comes back, non-adults who had it on are switched off with their events deleted, adults are kept', async () => {
  const db = await freshDatabase(['adult', 'unknown', 'minor']);
  try {
    await db.exec(BASE_SQL); await db.exec(D183_SQL);
    await db.exec(`insert into usage_consent(user_id,age_band,analytics_allowed,policy_version,decided_at) values
      ('adult','adult',true,'x',now()), ('unknown','unknown',true,'x',now()), ('minor','minor',false,'x',now())`);
    await rpc(db, 'adult', [eventRow('a1'), eventRow('a2')]);
    await rpc(db, 'unknown', [eventRow('u1')]);
    assert.equal(await countEvents(db, 'unknown'), 1);
    await db.exec(D183_UNDO); await db.exec(D183_UNDO); // idempotent
    const rows = (await db.query('select user_id, age_band, analytics_allowed, withdrawn_at is not null as withdrawn from usage_consent order by user_id')).rows;
    assert.deepEqual(rows, [
      { user_id: 'adult', age_band: 'adult', analytics_allowed: true, withdrawn: false },
      { user_id: 'minor', age_band: 'minor', analytics_allowed: false, withdrawn: false },
      { user_id: 'unknown', age_band: 'unknown', analytics_allowed: false, withdrawn: true },
    ]);
    assert.equal(await countEvents(db, 'adult'), 2);
    assert.equal(await countEvents(db, 'unknown'), 0);
    await assert.rejects(db.query("update usage_consent set analytics_allowed=true where user_id='unknown'"), /usage_consent_adult_only|check/);
    assert.equal(await rpc(db, 'adult', [eventRow('a3')]), 1);
    // The gate is adult-only again: even a row forced past the constraint check would not collect for another band.
    await db.exec('alter table usage_consent drop constraint usage_consent_adult_only');
    await db.exec("update usage_consent set analytics_allowed=true, withdrawn_at=null where user_id='unknown'");
    assert.equal(await rpc(db, 'unknown', [eventRow('u2')]), 0);
    // And the D183 migration applies cleanly again afterwards.
    await db.exec("update usage_consent set analytics_allowed=false where user_id='unknown'");
    await db.exec(D183_SQL);
    await db.exec("update usage_consent set analytics_allowed=true where user_id='unknown'");
    assert.equal(await rpc(db, 'unknown', [eventRow('u3')]), 1);
  } finally { await db.close(); }
});

const NOW = Date.UTC(2026, 9, 12, 12);
const ev = (o = {}) => ({ event_id: 'a1', name: 'app_opened', platform: 'android', occurred_at: new Date(NOW - 1000).toISOString(), props: { screen: 'home', minutes: 3 }, ...o });

test('canCollect: 18 or older and Rather not say collect when allowed, never under 18, withdrawn, off or no row', () => {
  assert.equal(POLICY_VERSION, '2026-10-12');
  assert.deepEqual(AGE_BANDS, ['adult', 'minor', 'unknown']);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'adult', withdrawn_at: null }), true);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'unknown', withdrawn_at: null }), true); // Rather not say, D183
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'unknown' }), true);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'minor' }), false);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'minor', withdrawn_at: null }), false);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'adult', withdrawn_at: '2026-10-01' }), false);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'unknown', withdrawn_at: '2026-10-01' }), false);
  assert.equal(canCollect({ analytics_allowed: false, age_band: 'adult' }), false);
  assert.equal(canCollect({ analytics_allowed: false, age_band: 'unknown' }), false);
  assert.equal(canCollect({ analytics_allowed: true }), false);                       // no band on the row
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'teen' }), false);     // not one of the known bands
  assert.equal(canCollect({ analytics_allowed: 'true', age_band: 'adult' }), false);  // must be the boolean true
  assert.equal(canCollect({}), false);
  assert.equal(canCollect(null), false);
  assert.equal(canCollect(undefined), false);
  assert.equal(EVENT_NAMES.size, 19);
});

test('normalizeBatch edge cases', () => {
  const r = normalizeBatch([ev(), ev(), ev({ event_id: 'b' })], 'u1', NOW);
  assert.equal(r.rows.length, 2); assert.equal(r.dropped, 1);
  const bad = [
    ev({ event_id: undefined }), ev({ name: 'free_text_click' }), ev({ platform: 'ios' }),
    ev({ occurred_at: new Date(NOW + 6 * 60000).toISOString() }),
    ev({ occurred_at: new Date(NOW - 8 * 86400000).toISOString() }),
    ev({ props: { email: 'a@b.c' } }), ev({ props: { subject: 'x'.repeat(65) } }),
    ev({ props: { minutes: '3' } }), ev({ props: { subject: { a: 1 } } }), ev({ occurred_at: 'nope' }),
  ].map((e, i) => (e.event_id === undefined ? e : { ...e, event_id: 'x' + i }));
  const out = normalizeBatch(bad, 'u1', NOW);
  assert.equal(out.rows.length, 0); assert.equal(out.dropped, bad.length);
  assert.ok(normalizeBatch(Array.from({ length: 51 }, (_, i) => ev({ event_id: 'k' + i })), 'u1', NOW).error);
  assert.equal(normalizeBatch(Array.from({ length: 50 }, (_, i) => ev({ event_id: 'k' + i })), 'u1', NOW).rows.length, 50);
  assert.ok(normalizeBatch('x', 'u1').error);
  assert.equal(normalizeBatch([ev({ occurred_at: new Date(NOW + 4 * 60000).toISOString() })], 'u1', NOW).rows.length, 1);
});

// ---------------------------------------------------------------- the routes, against a fake PostgREST

const HOOKS = `
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
const ROOT = ${JSON.stringify(pathToFileURL(`${root}/`).href)};
const STUBS = {
  'server-only': 'export {};',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__fakeSupabase;',
  '@/lib/auth': 'export const auth = async () => globalThis.__session;',
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) };',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) if (isFile(base + ext)) return { url: base + ext, shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  return next(url, context);
}
`;

// The part of PostgREST the two routes use, over plain maps. The consent table refuses analytics for under 18 the way the
// D183 table check does; `inserted` lists what the consent-gated insert accepted.
function fakeSupabase({ consent = {}, events = {} } = {}) {
  const consentRows = new Map(Object.entries(consent));
  const eventRows = new Map(Object.entries(events).map(([user, n]) => [user, n]));
  const log = { upserts: [], deletes: [], rpc: [] };
  return {
    log, consentRows, eventRows,
    from(name) {
      const state = { op: 'select', id: null, row: null };
      const run = () => {
        if (name === 'usage_consent') {
          if (state.op === 'upsert') {
            if (state.row.analytics_allowed && state.row.age_band === 'minor') return { data: null, error: { code: '23514', message: 'usage_consent_minor_off' } };
            log.upserts.push({ ...state.row });
            consentRows.set(state.row.user_id, { ...(consentRows.get(state.row.user_id) || {}), ...state.row });
            return { data: { ...consentRows.get(state.row.user_id) }, error: null };
          }
          const row = consentRows.get(state.id);
          return { data: row ? { ...row } : null, error: null };
        }
        if (name === 'usage_events' && state.op === 'delete') {
          const n = eventRows.get(state.id) || 0;
          eventRows.set(state.id, 0);
          log.deletes.push(state.id);
          return { data: Array.from({ length: n }, (_, i) => ({ id: i })), error: null };
        }
        return { data: null, error: { message: 'unexpected ' + name } };
      };
      const builder = {
        select() { return builder; },
        upsert(row) { state.op = 'upsert'; state.row = row; return builder; },
        delete() { state.op = 'delete'; return builder; },
        eq(_c, id) { state.id = id; return builder; },
        maybeSingle: async () => run(),
        single: async () => run(),
        then(resolveFn, rejectFn) { return Promise.resolve(run()).then(resolveFn, rejectFn); },
      };
      return builder;
    },
    async rpc(fn, args) {
      log.rpc.push({ fn, user: args.p_user_id, rows: args.p_rows.length });
      return { data: args.p_rows.length, error: null };
    },
  };
}

let consentRoute;
let eventsRoute;
async function loadRoutes() {
  if (consentRoute) return;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  consentRoute = await import(pathToFileURL(resolve(root, 'src/app/api/me/consent/route.js')).href);
  eventsRoute = await import(pathToFileURL(resolve(root, 'src/app/api/events/route.js')).href);
}
const as = (userId) => { globalThis.__session = userId ? { user: { id: userId } } : null; };
const put = (body) => consentRoute.PUT(new Request('http://localhost/api/me/consent', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const getConsent = () => consentRoute.GET(new Request('http://localhost/api/me/consent'));
const postEvents = (events) => eventsRoute.POST(new Request('http://localhost/api/events', { method: 'POST', body: JSON.stringify({ events }) }));
const reply = async (response) => ({ status: response.status, body: await response.json() });

test('consent route: "Rather not say" with usage data on is accepted and keeps the unknown band', async () => {
  await loadRoutes();
  globalThis.__fakeSupabase = fakeSupabase();
  as('u1');
  const r = await reply(await put({ ageBand: 'unknown', analyticsAllowed: true }));
  assert.equal(r.status, 200);
  assert.equal(r.body.ageBand, 'unknown');
  assert.equal(r.body.analyticsAllowed, true);
  assert.equal(r.body.withdrawnAt, null);
  assert.ok(r.body.decidedAt, 'an answer carries a decision time, so "Rather not say" reads as answered');
  assert.equal(r.body.deletedEvents, 0, 'nothing is deleted when usage data is on');
  const read = await reply(await getConsent());
  assert.deepEqual([read.status, read.body.ageBand, read.body.analyticsAllowed], [200, 'unknown', true]);
});

test('consent route: 18 or older with usage data on is still accepted', async () => {
  await loadRoutes();
  globalThis.__fakeSupabase = fakeSupabase();
  as('u1');
  const r = await reply(await put({ ageBand: 'adult', analyticsAllowed: true }));
  assert.deepEqual([r.status, r.body.ageBand, r.body.analyticsAllowed], [200, 'adult', true]);
});

test('consent route: under 18 with usage data on is refused with the new sentence and nothing is written', async () => {
  await loadRoutes();
  const sb = fakeSupabase({ events: { u1: 3 } });
  globalThis.__fakeSupabase = sb;
  as('u1');
  const r = await reply(await put({ ageBand: 'minor', analyticsAllowed: true }));
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Usage data stays off for students under 18.');
  assert.equal(sb.log.upserts.length, 0);
  assert.equal(sb.log.deletes.length, 0);
  assert.equal(sb.eventRows.get('u1'), 3);
  // The old sentence is gone.
  assert.doesNotMatch(JSON.stringify(r.body), /only be turned on for adults/);
});

test('consent route: saying under 18 saves usage data off and deletes what was collected', async () => {
  await loadRoutes();
  const sb = fakeSupabase({ consent: { u1: { user_id: 'u1', age_band: 'unknown', analytics_allowed: true, withdrawn_at: null } }, events: { u1: 4 } });
  globalThis.__fakeSupabase = sb;
  as('u1');
  const r = await reply(await put({ ageBand: 'minor', analyticsAllowed: false }));
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.ageBand, r.body.analyticsAllowed, r.body.deletedEvents], ['minor', false, 4]);
  assert.ok(r.body.withdrawnAt, 'turning usage data off after it was on records a withdrawal');
  assert.equal(sb.eventRows.get('u1'), 0);
});

test('consent route: anyone can switch it off, and "Rather not say" keeps its band and deletes the events', async () => {
  await loadRoutes();
  const sb = fakeSupabase({ consent: { u1: { user_id: 'u1', age_band: 'unknown', analytics_allowed: true, withdrawn_at: null } }, events: { u1: 2 } });
  globalThis.__fakeSupabase = sb;
  as('u1');
  const off = await reply(await put({ ageBand: 'unknown', analyticsAllowed: false }));
  assert.deepEqual([off.status, off.body.ageBand, off.body.analyticsAllowed, off.body.deletedEvents], [200, 'unknown', false, 2]);
  assert.ok(off.body.withdrawnAt);
  const on = await reply(await put({ ageBand: 'unknown', analyticsAllowed: true }));
  assert.deepEqual([on.status, on.body.ageBand, on.body.analyticsAllowed, on.body.withdrawnAt], [200, 'unknown', true, null]);
});

test('consent route: unchanged checks (sign-in, bad bodies)', async () => {
  await loadRoutes();
  globalThis.__fakeSupabase = fakeSupabase();
  as(null);
  assert.equal((await reply(await put({ ageBand: 'adult', analyticsAllowed: true }))).status, 401);
  as('u1');
  for (const bad of ['not json', {}, { ageBand: 'teen', analyticsAllowed: true }, { ageBand: 'adult' }, { ageBand: 'adult', analyticsAllowed: 'yes' }, { analyticsAllowed: false }]) {
    assert.equal((await reply(await put(bad))).status, 400, JSON.stringify(bad));
  }
});

test('events route: collects for 18 or older and Rather not say when on; never for under 18, withdrawn, off or no row', async () => {
  await loadRoutes();
  const NOWISO = () => new Date().toISOString();
  const evts = [{ event_id: 'r1', name: 'app_opened', platform: 'android', occurred_at: NOWISO(), props: { screen: 'home' } }];
  const consent = {
    adult: { age_band: 'adult', analytics_allowed: true, withdrawn_at: null },
    unknown: { age_band: 'unknown', analytics_allowed: true, withdrawn_at: null },
    minor: { age_band: 'minor', analytics_allowed: false, withdrawn_at: null },
    minorForced: { age_band: 'minor', analytics_allowed: true, withdrawn_at: null }, // cannot exist (table check), still never collects
    unknownOff: { age_band: 'unknown', analytics_allowed: false, withdrawn_at: null },
    unknownWithdrawn: { age_band: 'unknown', analytics_allowed: false, withdrawn_at: '2026-10-20T10:00:00Z' },
    adultWithdrawn: { age_band: 'adult', analytics_allowed: true, withdrawn_at: '2026-10-20T10:00:00Z' },
  };
  const sb = fakeSupabase({ consent });
  globalThis.__fakeSupabase = sb;
  for (const user of ['adult', 'unknown']) {
    as(user);
    const r = await reply(await postEvents(evts));
    assert.deepEqual([r.status, r.body.accepted, r.body.collecting], [202, 1, true], user);
  }
  for (const user of ['minor', 'minorForced', 'unknownOff', 'unknownWithdrawn', 'adultWithdrawn', 'norow']) {
    as(user);
    const r = await reply(await postEvents(evts));
    assert.deepEqual([r.status, r.body.accepted, r.body.collecting], [202, 0, false], user);
  }
  assert.deepEqual(sb.log.rpc.map((c) => c.user), ['adult', 'unknown'], 'only the two that may collect reach the database insert');
});

// ---------------------------------------------------------------- the website's words

test('profile: three age answers, the switch follows D183, and the band the student gave is never rewritten', () => {
  const page = read('src/app/(app)/profile/ProfilePageClient.jsx');
  const section = page.slice(page.indexOf('function UsageDataSection'), page.indexOf('function DeleteAccountSection'));
  // three answers, mapped to adult, minor and unknown
  assert.match(section, /I am 18 or older/);
  assert.match(section, /I am under 18/);
  assert.match(section, /Rather not say/);
  assert.match(section, /save\('adult', allowed\)/);
  assert.match(section, /save\('minor', false\)/);
  assert.match(section, /save\('unknown', allowed\)/);
  // "never answered" is the unknown band with no decision time
  assert.match(section, /const answered = ageBand !== 'unknown' \|\| !!decidedAt;/);
  assert.match(section, /const switchAvailable = answered && ageBand !== 'minor';/);
  assert.match(section, /disabled=\{!switchAvailable\}/);
  // turning it on or off, and the withdraw button, keep the band
  assert.match(section, /onChange=\{\(e\) => save\(ageBand, e\.target\.checked\)\}/);
  assert.match(section, /save\(ageBand, false, \{ refocus: true \}\)/);
  assert.doesNotMatch(section, /save\('adult', e\.target\.checked\)|save\('adult', false, \{ refocus/);
  // the two notes
  assert.match(section, /Usage data stays off because you said you are under 18\./);
  assert.match(section, /Answer the age question to choose\./);
  // the old adult-only wording is gone
  assert.doesNotMatch(section, /Confirm you are 18 or older to turn this on|Only available to people who confirm|ageBand !== 'adult'/);
  assert.match(section, /It can be on for anyone who is 18 or older or who chooses Rather not say, and it stays off for anyone who says they are under 18\./);
});

test('privacy page: the optional usage data section tells the D183 rule, and no legal page contradicts it', () => {
  const privacy = read('src/app/privacy/page.js');
  const section = privacy.slice(privacy.indexOf('<h2>Optional usage data'), privacy.indexOf('</section>', privacy.indexOf('<h2>Optional usage data')));
  assert.match(section, /<h2>Optional usage data \(updated 20 October 2026\)<\/h2>/);
  assert.match(section, /on for people who say they are 18 or older and for people who choose Rather not say/);
  assert.match(section, /off for anyone who says they are under 18/);
  assert.match(section, /Anyone can turn it off at any time/);
  assert.match(section, /Profile on the website/);
  assert.match(section, /You, then Privacy, in the app/);
  assert.match(section, /turning it off deletes what was collected/);
  assert.match(section, /We never collect answers, marks, free text or contacts\./);
  assert.match(section, /first-party only: no third-party tracking and no advertising/);
  assert.match(section, /We keep it for 180 days\./);
  assert.doesNotMatch(section, /If you confirm you are 18 or older|off by default|have not said/);
  assert.match(privacy, /Last updated: 20 October 2026/);
  const deletion = read('src/app/account-deletion/page.js');
  assert.match(deletion, /Any usage data we collected\./);
  assert.doesNotMatch(deletion, /if you had allowed it/);
  for (const file of ['src/app/privacy/page.js', 'src/app/account-deletion/page.js', 'src/app/terms/page.js', 'src/app/refunds/page.js']) {
    assert.doesNotMatch(read(file), /adults only|only for adults|only be turned on for adults|18 or older to turn/i, file);
  }
});

test('the server never gates usage data or app error reports on the adult band alone', () => {
  for (const file of ['src/lib/server/usage.js', 'src/lib/server/appErrors.js', 'src/app/api/me/consent/route.js', 'src/app/api/events/route.js', 'src/lib/server/appErrorsStore.js']) {
    assert.doesNotMatch(read(file), /age_band === 'adult'|ageBand !== 'adult'|ageBand === 'adult'|age_band = 'adult'/, file);
  }
  assert.match(read('src/lib/server/appErrors.js'), /canCollect\(consent\)/);
  assert.match(read('src/app/api/me/consent/route.js'), /body\.analyticsAllowed && body\.ageBand === 'minor'/);
});
