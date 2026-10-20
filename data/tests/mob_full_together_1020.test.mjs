// Full mock together's price on the Mob server (owner D174, D175, 20 Oct 2026): a Pro member starts it; Free members pay
// 50 credits to sit it; Pro members sit free; no free first full mock. The Mob service on the real Mob migrations
// (PGlite) and, behind its practice start, the real credits ledger (PGlite, production's spend_credits) charged exactly
// the way src/lib/server/practiceSessions.js charges a device-held start (practiceCharge, then spend under
// `practice_<id>`, the id fixed by the key). Plus the payload, the route's status and the web's wiring.
// Run: node --test data/tests/mob_full_together_1020.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERRORS, MobError, errorBody } from '../../src/lib/mob/model.mjs';
import { createMobService } from '../../src/lib/server/mob/service.js';
import { handleMob } from '../../src/lib/server/mob/http.js';
import { practiceCharge, spendWithLegacyFallback } from '../practice_charge.js';
import { practiceCreditAction } from '../test_modes.js';
import { FORMAT_COPY, formatTiles, mockPriceOf } from '../../src/components/mob/v3/play/formats.mjs';
import { DEN_ERRORS } from '../../src/lib/mob/v3/denCopy.mjs';
import { ledger, ledgerDatabase, ledgerUser, spendCredits, spendable } from './helpers/credits_ledger.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const MIGRATIONS = ['20261017100000_mob', '20261017190000_mob_fix_1017', '20261020100000_mob_v3_core', '20261020100100_mob_v3_games',
  '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime', '20261020100400_mob_v3_live', '20261020140000_mob_v3_formats'];
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));
const NOW = Date.parse('2026-10-22T08:35:00Z'); // Thursday 22 Oct 2026, 2:05 PM IST
const MIN = 60_000;
const STUBS = `
create schema if not exists realtime;
create table if not exists realtime.messages (id bigint generated always as identity primary key, topic text, extension text, payload jsonb, event text, private boolean);
create table if not exists realtime.sent (id bigint generated always as identity primary key, topic text, event text, payload jsonb);
create or replace function realtime.topic() returns text language sql stable as $$ select current_setting('rt.topic', true) $$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean) returns void language sql as $$
  insert into realtime.sent (topic, event, payload) values (topic, event, payload) $$;
grant usage on schema realtime to authenticated;
grant select, insert on realtime.messages to authenticated;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('rt.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
`;

async function mobDatabase() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,12) g;");
  await db.exec(`create table public.attempts (id text primary key, user_id text references public.users(id), subject text, score int, correct int, wrong int,
      unattempted int, total int, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  await db.exec(STUBS);
  for (const f of MIGRATIONS) await db.exec(read(`supabase/migrations/${f}.sql`));
  return db;
}
function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const values = keys.map((k) => {
      const v = params[k];
      if (['p_picks', 'p_keys', 'p_days'].includes(k) && Array.isArray(v)) return `{${v.join(',')}}`;
      return v && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    return (await db.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values)).rows[0].r;
  };
}
const CHAPTERS = ['Goodwill', 'Cash Flow Statement', 'Ratios'];
const BANK = Array.from({ length: 120 }, (_, i) => ({
  id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, chapter: CHAPTERS[i % 3], explanation: `EXPLAIN-q${i + 1}`,
  options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: `Option ${t}${i}` })),
}));
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * The practice start behind the Mob, from the charge on, as practiceSessions.js does it for a device-held start: the id
 * from the key and the paper's tags, the charge from practiceCharge (the plan read again), the spend under
 * `practice_<id>`, refused with INSUFFICIENT_CREDITS when short. `failBeforeCharge` makes the next start fail before it
 * reaches the charge (a session that could not be built), as the real start does when the set cannot be served.
 */
function practiceStart(ledgerDb, { pro, calls, failBeforeCharge }) {
  const spend = spendCredits(ledgerDb);
  return async (userId, input, server) => {
    calls.push({ userId, input, server });
    const mobPaper = server.mobPaper;
    const id = `practice_${createHash('sha256').update([userId, input.generationKey, mobPaper.mobId, mobPaper.gameId || ''].join(':')).digest('hex').slice(0, 24)}`;
    if (failBeforeCharge.next) { failBeforeCharge.next = false; throw new Error('SESSION_CREATE_FAILED'); }
    const charge = practiceCharge({ isPremium: pro(userId), mobPaper, modeId: input.mode, creditAction: practiceCreditAction(input.mode, input.count), count: input.count, subject: input.subject });
    if (charge.creditAction) {
      const paid = await spendWithLegacyFallback(spend, userId, charge.creditAction, `practice_${id}`);
      if (!paid) throw new Error('INSUFFICIENT_CREDITS');
    }
    return { sessionId: id, mode: input.mode, count: mobPaper.questions.length };
  };
}

async function setup({ billing = true, formats = true, pro = new Set(['u1']), balances = {} } = {}) {
  const db = await mobDatabase();
  const ledgerDb = await ledgerDatabase();
  for (const u of ['u1', 'u2', 'u3', 'u4']) await ledgerUser(ledgerDb, u, { balance: balances[u] ?? 100 });
  const clock = { now: NOW };
  const calls = [];
  const failBeforeCharge = { next: false };
  const bank = { short: false };
  const flags = { billing, formats };
  let seed = 1;
  const isPro = (u) => pro.has(u);
  const svc = createMobService({
    rpc: pgRpc(db), now: () => clock.now, secret: 'test-secret', blocklist,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 97 + 13) % 256)),
    subjectInfo: (s) => (s === 'accountancy' ? { ok: true, id: s, name: 'Accountancy' } : { ok: false }),
    loadUser: async (id) => ({ subjects: ['accountancy'], isPremium: isPro(id) }),
    validChapter: (_s, c) => CHAPTERS.includes(c),
    pickQuestionIds: async (_s, { count = 10, key = null, exclude = [] } = {}) => {
      const skip = new Set(exclude);
      const start = key ? hash(key) % BANK.length : 0;
      return Array.from({ length: BANK.length }, (_, i) => BANK[(start + i) % BANK.length].id).filter((id) => !skip.has(id)).slice(0, count);
    },
    loadQuestions: async (ids) => (bank.short ? ids.slice(1) : ids).map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
    sectionsFor: (_s, qs) => qs.map(() => null),
    trapNameFor: async () => null,
    findAttempts: async () => [],
    startPractice: practiceStart(ledgerDb, { pro: isPro, calls, failBeforeCharge }),
    v3Enabled: () => true, billingOn: () => flags.billing, liveEnabled: () => true, formatsEnabled: () => flags.formats,
  });
  const mobId = (await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 3, nameKey: 0, fold: 'dart' })).mob.id;
  const inv = await svc.invite('u1', { mob: mobId });
  for (const [u, name] of [['u2', 'Aarav'], ['u3', 'Kabir'], ['u4', 'Zoya']]) await svc.join(u, { code: inv.code, name, colour: 1 });
  const close = async () => { await db.close(); await ledgerDb.close(); };
  return { svc, db, ledgerDb, clock, calls, failBeforeCharge, bank, flags, mobId, close };
}
const code = (c) => (e) => { assert.ok(e instanceof MobError, String(e)); assert.equal(e.code, c); return true; };
const FREE_START = { costCredits: 50, sitCredits: 50, proRequiredToStart: true, canStart: false, proSitsFree: true };

test('start: a Pro member starts a Full mock together; a Free member is refused MOCK_PRO_REQUIRED (403) with the price, billing on or off', async () => {
  for (const billing of [true, false]) {
    const t = await setup({ billing });
    try {
      await assert.rejects(t.svc.v3.openGame('u2', { mob: t.mobId, format: 'mock' }), (e) => {
        code('MOCK_PRO_REQUIRED')(e);
        assert.equal(e.status, 403);
        assert.deepEqual(e.extra.detail, FREE_START);
        return true;
      }, `billing ${billing}`);
      const free = (await t.svc.view('u2', { mobId: t.mobId })).mob.v3.starts;
      assert.deepEqual([free.locked.includes('mock'), free.formats.includes('mock'), free.mock], [true, false, FREE_START], `billing ${billing}: the den says so`);
      const g = (await t.svc.v3.openGame('u1', { mob: t.mobId, format: 'mock' })).game;
      assert.deepEqual([g.format, g.count, g.minutes, g.price], ['mock', 50, 60, { costCredits: 0, sitCredits: 50, proSitsFree: true }]);
      const pro = (await t.svc.view('u1', { mobId: t.mobId })).mob.v3.starts.mock;
      assert.deepEqual([pro.costCredits, pro.canStart], [0, true]);
      // A Free member's race and round are untouched by this rule.
      assert.equal((await t.svc.v3.openGame('u2', { mob: t.mobId, format: 'race', minutes: 5 })).game.format, 'race');
      // Starting charges nobody anything.
      for (const u of ['u1', 'u2']) assert.deepEqual(await ledger(t.ledgerDb, u), []);
    } finally { await t.close(); }
  }
});

test('the route sends 403 with the code, the sentence and the price, so a client can offer Pro', async () => {
  const req = new Request('http://localhost/api/mob/game', { method: 'POST', body: JSON.stringify({ format: 'mock' }) });
  const deps = { enabled: () => true, v3Enabled: () => true, liveEnabled: () => true, auth: async () => ({ user: { id: 'u2' } }), rateLimit: async () => ({ allowed: true }), cors: () => ({}),
    service: { v3: { openGame: async () => { throw new MobError('MOCK_PRO_REQUIRED', { detail: FREE_START }); } } } };
  const res = await handleMob(deps, 'gameOpen', req);
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), errorBody('MOCK_PRO_REQUIRED', { detail: FREE_START }));
  assert.equal(ERRORS.MOCK_CREDITS[0], 402);
});

test('sit: a Free member pays 50 credits once, when the sitting starts (not on joining or opening the card); a retry is never charged twice', async () => {
  const t = await setup();
  try {
    const g = (await t.svc.v3.openGame('u1', { mob: t.mobId, format: 'mock' })).game;
    // Joined and looked at the card: nothing charged yet, and the price says 50.
    assert.deepEqual((await t.svc.v3.getGame('u2', g.id)).game.price, { costCredits: 50, sitCredits: 50, proSitsFree: true });
    const den = (await t.svc.view('u2', { mobId: t.mobId })).mob.v3.games.find((x) => x.id === g.id);
    assert.equal(den.price.costCredits, 50);
    assert.equal(await spendable(t.ledgerDb, 'u2'), 100);
    const first = await t.svc.startPaper('u2', { mob: t.mobId, game: g.id });
    assert.equal(await spendable(t.ledgerDb, 'u2'), 50);
    // The retry (a lost response, a second tab, a resume) is the same session and the same reference.
    const again = await t.svc.startPaper('u2', { mob: t.mobId, game: g.id });
    assert.equal(again.sessionId, first.sessionId);
    assert.equal(t.calls[0].input.generationKey, t.calls[1].input.generationKey, 'the key is fixed per game and member');
    assert.equal(await spendable(t.ledgerDb, 'u2'), 50, 'charged once');
    const rows = await ledger(t.ledgerDb, 'u2');
    assert.deepEqual(rows.map((r) => [r.action, r.credit_delta]), [['attempt_full', -50]]);
    assert.match(rows[0].reference, /^practice_practice_[0-9a-f]{24}$/);
    // Once started, the card asks nothing more.
    assert.equal((await t.svc.v3.getGame('u2', g.id)).game.price.costCredits, 0);
    assert.equal((await t.svc.v3.getGame('u2', g.id)).game.you.run, 'playing');
    // A second Full mock together is a second sitting: charged again, once.
    t.clock.now += 5 * MIN;
    const g2 = (await t.svc.v3.openGame('u1', { mob: t.mobId, format: 'mock' })).game;
    await t.svc.startPaper('u2', { mob: t.mobId, game: g2.id });
    await t.svc.startPaper('u2', { mob: t.mobId, game: g2.id });
    assert.equal(await spendable(t.ledgerDb, 'u2'), 0);
    assert.equal((await ledger(t.ledgerDb, 'u2')).length, 2);
  } finally { await t.close(); }
});

test('sit: a Pro member sits free, with any balance', async () => {
  const t = await setup({ pro: new Set(['u1', 'u3']), balances: { u3: 0 } });
  try {
    const g = (await t.svc.v3.openGame('u1', { mob: t.mobId, format: 'mock' })).game;
    await t.svc.startPaper('u1', { mob: t.mobId, game: g.id });
    await t.svc.startPaper('u3', { mob: t.mobId, game: g.id });
    assert.equal(t.calls.every((c) => c.server.mobPaper.creditAction === null), true);
    assert.deepEqual([await ledger(t.ledgerDb, 'u1'), await ledger(t.ledgerDb, 'u3')], [[], []]);
    assert.equal(await spendable(t.ledgerDb, 'u3'), 0);
    assert.equal((await t.svc.v3.getGame('u3', g.id)).game.you.run, 'playing');
  } finally { await t.close(); }
});

test('insufficient credits: MOCK_CREDITS (402) with the price, nothing charged, no run started, the price still shown', async () => {
  const t = await setup({ balances: { u2: 20 } });
  try {
    const g = (await t.svc.v3.openGame('u1', { mob: t.mobId, format: 'mock' })).game;
    await assert.rejects(t.svc.startPaper('u2', { mob: t.mobId, game: g.id }), (e) => {
      code('MOCK_CREDITS')(e);
      assert.equal(e.status, 402);
      assert.deepEqual(e.extra.detail, { costCredits: 50, sitCredits: 50, proSitsFree: true });
      return true;
    });
    assert.equal(await spendable(t.ledgerDb, 'u2'), 20);
    assert.deepEqual(await ledger(t.ledgerDb, 'u2'), []);
    const view = (await t.svc.v3.getGame('u2', g.id)).game;
    assert.deepEqual([view.you.run, view.price.costCredits], ['none', 50]);
    assert.match(ERRORS.MOCK_CREDITS[1], /50 credits/);
    assert.match(ERRORS.MOCK_CREDITS[1], /Nothing was charged\.$/);
  } finally { await t.close(); }
});

test('a start that cannot happen takes nothing: too late, closed, paper not built, a session that failed; the retry then pays once', async () => {
  const t = await setup();
  try {
    const g = (await t.svc.v3.openGame('u1', { mob: t.mobId, format: 'mock' })).game;
    // The practice start failed before its charge (the session could not be built): nothing taken, nothing playing.
    t.failBeforeCharge.next = true;
    await assert.rejects(t.svc.startPaper('u2', { mob: t.mobId, game: g.id }), code('UNAVAILABLE'));
    assert.deepEqual(await ledger(t.ledgerDb, 'u2'), []);
    assert.equal((await t.svc.v3.getGame('u2', g.id)).game.you.run, 'none');
    // The paper cannot be built: refused before the practice start.
    t.bank.short = true;
    await assert.rejects(t.svc.startPaper('u3', { mob: t.mobId, game: g.id }), code('PAPER_UNAVAILABLE'));
    t.bank.short = false;
    assert.deepEqual(await ledger(t.ledgerDb, 'u3'), []);
    // The retry goes through and pays exactly once.
    await t.svc.startPaper('u2', { mob: t.mobId, game: g.id });
    assert.equal(await spendable(t.ledgerDb, 'u2'), 50);
    // Under an hour to the close: too late to start, nothing taken.
    t.clock.now = Date.parse(g.closesAt) - 59 * MIN;
    const before = t.calls.length;
    await assert.rejects(t.svc.startPaper('u4', { mob: t.mobId, game: g.id }), code('MOCK_TOO_LATE'));
    // Closed: refused, nothing taken.
    t.clock.now = Date.parse(g.closesAt) + 1;
    await assert.rejects(t.svc.startPaper('u3', { mob: t.mobId, game: g.id }), code('GAME_CLOSED'));
    assert.equal(t.calls.length, before, 'never reached the practice start');
    assert.deepEqual([await ledger(t.ledgerDb, 'u3'), await ledger(t.ledgerDb, 'u4')], [[], []]);
  } finally { await t.close(); }
});

test('MOB_FORMATS_ENABLED off: unchanged; no Full mock together for anyone, no price block, the weekly paper and the question games free as before', async () => {
  const t = await setup({ formats: false });
  try {
    await assert.rejects(t.svc.v3.openGame('u1', { mob: t.mobId, format: 'mock' }), code('BODY_INVALID'), 'even for Pro, as before');
    await assert.rejects(t.svc.v3.openGame('u2', { mob: t.mobId, format: 'mock' }), code('BODY_INVALID'));
    const starts = (await t.svc.view('u2', { mobId: t.mobId })).mob.v3.starts;
    assert.deepEqual([starts.formats, starts.locked, starts.mock], [['sprint', 'round'], [], undefined]);
    // A Free member's sprint and the weekly paper: free, as before.
    const sprint = (await t.svc.v3.openGame('u2', { mob: t.mobId, format: 'sprint' })).game;
    assert.equal(sprint.price, undefined);
    await t.svc.startPaper('u2', { mob: t.mobId });
    assert.equal(t.calls.at(-1).server.mobPaper.creditAction, undefined);
    assert.deepEqual(await ledger(t.ledgerDb, 'u2'), []);
  } finally { await t.close(); }
});

test('the web shows the price and one plain way to Pro, from the server\'s numbers only', () => {
  // The sheet's tiles: the full mock carries the Pro tag whenever the server says only Pro starts it, billing off too.
  const off = formatTiles({ billingOn: false, can: true, formats: ['sprint', 'round', 'rematch', 'race'], locked: ['mock'], mock: FREE_START });
  assert.deepEqual(off.find((x) => x.format === 'mock'), { format: 'mock', can: false, locked: true, pro: true });
  assert.equal(formatTiles({ billingOn: false, can: true, formats: ['sprint', 'race'], locked: [] }).some((x) => x.pro), false, 'an older server: as before');
  assert.deepEqual(mockPriceOf(FREE_START), { cost: 50, list: 50, canStart: false, proRequired: true });
  assert.deepEqual(mockPriceOf({ costCredits: 0, sitCredits: 50, proSitsFree: true }), { cost: 0, list: 50, canStart: false, proRequired: false });
  assert.equal(mockPriceOf(null), null);
  assert.equal(mockPriceOf({ costCredits: 'x' }), null);
  const lines = [FORMAT_COPY.mockLockedLine(50), FORMAT_COPY.mockHostLine(50), FORMAT_COPY.mockSitPrice(50), FORMAT_COPY.sitMockFor(50), FORMAT_COPY.getPro, FORMAT_COPY.sitFreeWithPro,
    ERRORS.MOCK_PRO_REQUIRED[1], ERRORS.MOCK_CREDITS[1], DEN_ERRORS.MOCK_PRO_REQUIRED, DEN_ERRORS.MOCK_CREDITS];
  for (const l of lines) {
    assert.doesNotMatch(l, /[!→]|->|—|₹|\bRs\b|unlock|hurry|only today|best value/i, l);
    assert.doesNotMatch(l, /[\u{1F300}-\u{1FAFF}]/u, l);
  }
  assert.equal(FORMAT_COPY.mockLockedLine(50), 'Only a Pro member can start one. Anyone in your Mob can sit it: 50 credits, or free with Pro.');
  assert.equal(FORMAT_COPY.sitMockFor(50), 'Sit the full mock for 50 credits');
  // The sheet, the card and the runner are wired to them.
  const sheet = read('src/components/mob/den/DenSheets.jsx');
  assert.match(sheet, /mockPriceOf\(s\.mock\)/);
  assert.match(sheet, /t\.format === 'mock' && t\.pro && mockPrice/);
  assert.match(sheet, /href="\/pricing" data-pro-feature="mob_full_mock"/);
  assert.match(sheet, /FORMAT_COPY\.mockHostLine\(mockPrice\.list\)/);
  const card = read('src/components/mob/v3/play/GameRun.jsx');
  assert.match(card, /mockPriceOf\(game\.price\)/);
  assert.match(card, /FORMAT_COPY\.sitMockFor\(sitCost\)/);
  assert.match(card, /FORMAT_COPY\.mockSitPrice\(sitCost\)/);
  assert.match(card, /href="\/pricing" data-pro-feature="mob_full_mock">\{FORMAT_COPY\.sitFreeWithPro\}/);
  const runner = read('src/app/(app)/test/TestPageClient.jsx');
  assert.match(runner, /e\?\.code === 'MOCK_CREDITS'/);
  assert.match(runner, /href="\/wallet" className="ui-state__action ui-state__action--primary">Add credits</);
  assert.match(runner, /href="\/pricing" className="ui-state__action" data-pro-feature="mob_full_mock">Get Pro</);
});
