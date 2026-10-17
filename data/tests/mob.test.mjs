// The Mob (docs/design-decisions/pass-1016e/SOCIAL-SPEC.md): the pure rules (src/lib/mob/model.mjs), the migration and
// its functions on a real Postgres (PGlite), the service on top of them (src/lib/server/mob/service.js), the route
// handler (src/lib/server/mob/http.js), the account-deletion steps, and the app contract fixtures
// data/tests/fixtures/mob/*.json (written once with MOB_WRITE_FIXTURE=1, then compared byte for byte).
// Run: node --test data/tests/mob.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLOSED_LINE, CLOSES_LINE, CODE_RE, ERRORS, MAX_MEMBERS, buildView, checkName, closesAt, codeFromBytes, computeTogether, computeTrap, costLine,
  errorBody, finishedInWindow, initialOf, inviteExpiryLine, istDateTime, mobWeek, nameBlocked, nextOpensAt, normalizeCode,
  nudgeLine, picksFromAttempt, ringLine, seatsLine, togetherLine, tooLateToStart, trapLine, trapPayload,
} from '../../src/lib/mob/model.mjs';
import { buildCompare } from '../../src/lib/mob/compare.mjs';
import { createMobService, memberIdFor } from '../../src/lib/server/mob/service.js';
import { ACTIONS, LIMITS, handleMob } from '../../src/lib/server/mob/http.js';
import { DELETION_STEPS } from '../../src/lib/server/accountDeletion.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
// The Mob's migration and the 17 Oct fix on top of it, in the order they are applied.
const migration = `${read('supabase/migrations/20261017100000_mob.sql')}
${read('supabase/migrations/20261017190000_mob_fix_1017.sql')}`;
// Undo in reverse: the fix first, then the Mob.
const fixUndo = read('supabase/undo/20261017190000_mob_fix_1017.undo.sql');
const baseUndo = read('supabase/undo/20261017100000_mob.undo.sql');
const undo = `${fixUndo}\n${baseUndo}`;
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));
const FIXTURE_DIR = resolve(root, 'data/tests/fixtures/mob');

// Tuesday 13 Oct 2026, 7:30 PM IST. The week is Monday 12 Oct; the paper closes Sunday 18 Oct, 11:59 PM IST.
const NOW = Date.parse('2026-10-13T14:00:00Z');
const WEEK = '2026-10-12';

// ---------------------------------------------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------------------------------------------

test('the week runs Monday to Sunday in IST and closes Sunday 11:59 PM', () => {
  assert.equal(mobWeek(NOW), WEEK);
  assert.equal(mobWeek(Date.parse('2026-10-18T18:29:00Z')), WEEK, 'Sunday 11:59 PM IST is still this week');
  assert.equal(mobWeek(Date.parse('2026-10-18T18:30:00Z')), '2026-10-19', 'Monday 12:00 AM IST is next week');
  assert.equal(mobWeek(Date.parse('2026-10-11T19:00:00Z')), WEEK, 'Monday 12:30 AM IST, still Sunday in UTC');
  assert.equal(closesAt(WEEK), '2026-10-18T18:29:59.000Z');
  assert.equal(nextOpensAt(WEEK), '2026-10-18T18:30:00.000Z');
  assert.equal(finishedInWindow(WEEK, Date.parse('2026-10-18T18:29:59Z')), true);
  assert.equal(finishedInWindow(WEEK, Date.parse('2026-10-18T18:30:00Z')), false, 'a sitting after the close is not recorded');
  assert.equal(tooLateToStart(WEEK, Date.parse('2026-10-18T18:10:00Z')), false, '20 minutes left: a 12-minute paper still fits');
  assert.equal(tooLateToStart(WEEK, Date.parse('2026-10-18T18:20:00Z')), true, '10 minutes left: it could never count');
});

test('display names: 2 to 18 letters, the blocklist, and no impersonation', () => {
  for (const ok of ['Riya', 'Al', 'Mary-Jane', "D'Souza", 'A. Kumar', 'अनन्या', 'Randip', 'Rapeti Sai', 'Mobina', '  Asha   Rao  ']) {
    assert.equal(checkName(ok, blocklist).ok, true, ok);
  }
  assert.equal(checkName('  Asha   Rao  ', blocklist).name, 'Asha Rao');
  for (const bad of ['', 'A', 'x'.repeat(19), '1Riya', 'Riya!', 'Riya 2', '-Riya', 'Riya😀', '<b>Riya</b>', 'riya@mail', null, 7]) {
    assert.equal(checkName(bad, blocklist).code, 'NAME_INVALID', String(bad));
  }
  for (const refused of ['MockMob Team', 'Admin', 'Mobi', 'Randi', 'Bhenchod', 'Official Riya', 'Mod Erator']) {
    assert.equal(checkName(refused, blocklist).code, 'NAME_REFUSED', refused);
  }
  assert.equal(nameBlocked('Kuttiyamma', blocklist), false, 'a short word inside a real name is fine');
  assert.equal(nameBlocked('Kutti', blocklist), true);
});

test('invite codes: 8 Crockford characters, 40 bits, typed loosely', () => {
  assert.equal(codeFromBytes([0, 0, 0, 0, 0]), '00000000');
  assert.equal(codeFromBytes([255, 255, 255, 255, 255]), 'ZZZZZZZZ');
  for (let i = 0; i < 200; i += 1) {
    const bytes = Array.from({ length: 5 }, () => Math.floor(Math.random() * 256));
    assert.match(codeFromBytes(bytes), CODE_RE);
  }
  assert.equal(normalizeCode(' 7kq2-m9xr '), '7KQ2M9XR');
  assert.equal(normalizeCode('7KQ2M9XO'), '7KQ2M9X0', 'O reads as zero');
  assert.equal(normalizeCode('7KQ2M9XL'), '7KQ2M9X1', 'L reads as one');
  for (const bad of ['7KQ2M9X', '7KQ2M9XRR', '7KQ2M9XU', '../etc', '', null, 12345678]) assert.equal(normalizeCode(bad), null, String(bad));
});

test('the shared trap: 3 sitters, an option picked by 2 and by half, the lowest question on a tie, no names', () => {
  const keys = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1];
  const sit = (...picks) => ({ picks: [...picks, ...keys.slice(picks.length)] }); // unlisted questions answered right
  assert.equal(computeTrap([sit(1), sit(1)], keys), null, 'under 3 sitters there is no trap');
  // Question 1: 2 of 3 picked B (index 1). Question 2: 2 of 3 picked A. Tie on count: question 1 wins.
  const three = [sit(1, 0), sit(1, 0), sit(0, 1)];
  assert.deepEqual(computeTrap(three, keys), { questionNumber: 1, questionIndex: 0, optionIndex: 1, count: 2, of: 3 });
  // 2 of 5 is under half: no trap.
  const five = [sit(1), sit(1), sit(0), sit(0), sit(0)];
  assert.equal(computeTrap(five, keys), null);
  // A higher count wins over a lower question number.
  // Question 1: 2 of 4 picked B (key A). Question 3: 4 of 4 picked A (key C).
  const later = [sit(1, 1, 0), sit(1, 1, 0), sit(0, 1, 0), sit(0, 1, 0)];
  assert.deepEqual(computeTrap(later, keys), { questionNumber: 3, questionIndex: 2, optionIndex: 0, count: 4, of: 4 });
  // Blanks never count, and a question without a key names nothing.
  assert.equal(computeTrap([sit(-1), sit(-1), sit(-1)], keys), null);
  assert.equal(computeTrap([sit(1), sit(1), sit(1)], [-1, ...keys.slice(1)]), null);
  const payload = trapPayload(computeTrap(three, keys), { questionId: 'q1', trapName: 'A look-alike term', youPicked: 1, key: 0 });
  assert.deepEqual(payload, { questionNumber: 1, questionId: 'q1', option: 'B', count: 2, of: 3, trapName: 'A look-alike term', youPickedIt: true, youGotItRight: false });
  assert.equal(trapLine(payload), "Your Mob's trap: 2 of 3 picked B on question 1.");
});

test('the copy is plain: no arrows, no exclamation marks, 12-hour IST times', () => {
  const lines = [CLOSED_LINE, CLOSES_LINE, ringLine(3, 4), seatsLine(1), seatsLine(2), nudgeLine('Riya'), inviteExpiryLine('2026-10-23T16:10:00Z'),
    costLine({ type: 'included' }), costLine({ type: 'allowance' }), costLine({ type: 'credits', credits: 10, balance: 40 }), costLine({ type: 'credits', credits: 10, balance: 4 }),
    ...Object.values(ERRORS).map((e) => e[1])];
  for (const line of lines) {
    assert.doesNotMatch(line, /[!→⟶»]|->|—/, line);
    assert.doesNotMatch(line, /\b([01]\d|2[0-3]):[0-5]\d\b(?!\s?(AM|PM))/, line);
  }
  assert.equal(istDateTime('2026-10-23T16:10:00Z'), 'Fri 23 Oct, 9:40 PM');
  assert.equal(inviteExpiryLine('2026-10-23T16:10:00Z'), 'Link works until Fri 23 Oct, 9:40 PM');
  assert.equal(costLine({ type: 'credits', credits: 10, balance: 40 }), '10 credits. You have 40.');
  assert.equal(costLine(null), '', 'no cost is drawn when the server sent none');
  assert.equal(initialOf('  asha'), 'A');
  assert.deepEqual(errorBody('MOB_FULL'), { error: { code: 'MOB_FULL', message: ERRORS.MOB_FULL[1] } });
  assert.deepEqual(errorBody('nonsense'), { error: { code: 'UNAVAILABLE', message: ERRORS.UNAVAILABLE[1] } });
});

// A fixed state: what mob_state returns for a 4-member Mob, 3 of whom sat, rows deliberately out of order.
const MOB_ID = '7b0c5d8e-1f2a-4b3c-9d4e-5f6a7b8c9d0e';
const ids = { u1: 'U1', u2: 'U2', u3: 'U3', u4: 'U4' };
const at = (h) => `2026-10-1${h}T10:00:00.000Z`;
function fixedState({ sat = ['u1', 'u2', 'u3'], showScore = ['u2'], nudges = [] } = {}) {
  const members = [
    { user_id: 'u3', display_name: 'Kabir', colour: 2, role: 'member', show_score: showScore.includes('u3'), nudges_muted: false, joined_at: at(3) },
    { user_id: 'u1', display_name: 'Riya', colour: 0, role: 'owner', show_score: showScore.includes('u1'), nudges_muted: false, joined_at: at(1) },
    { user_id: 'u4', display_name: 'Meera', colour: 5, role: 'member', show_score: showScore.includes('u4'), nudges_muted: false, joined_at: at(4) },
    { user_id: 'u2', display_name: 'Asha', colour: 1, role: 'member', show_score: showScore.includes('u2'), nudges_muted: false, joined_at: at(2) },
  ];
  const scores = { u1: 9, u2: 7, u3: 4, u4: 6 };
  return {
    week: WEEK,
    mob: { id: MOB_ID, subject: 'accountancy', created_at: at(1) },
    members,
    paper: { question_ids: Array.from({ length: 10 }, (_, i) => `q${i + 1}`), subject: 'accountancy' },
    sittings: sat.map((u) => ({ user_id: u, session_id: `practice_${u}`, score: scores[u], max_score: 10, picks: Array(10).fill(0), sat_at: at(5) })),
    invite: { code: '7KQ2M9XR', expires_at: '2026-10-20T16:10:00.000Z', max_uses: 3, uses: 2 },
    nudges,
  };
}
const fixedIds = (u) => ids[u];

test('the view: join order, never by score; scores only when their owner opted in; you always see your own', () => {
  const view = buildView(fixedState(), { userId: 'u3', now: NOW, memberIdFor: fixedIds, cost: null, subjectName: 'Accountancy' }).mob;
  assert.deepEqual(view.members.map((m) => m.name), ['Riya', 'Asha', 'Kabir', 'Meera'], 'join order');
  assert.equal(view.members.find((m) => m.name === 'Riya').score, undefined, 'Riya scored 9 but did not opt in');
  assert.deepEqual(view.members.find((m) => m.name === 'Asha').score, { value: 7, of: 10 }, 'Asha opted in');
  assert.deepEqual(view.members.find((m) => m.you).score, { value: 4, of: 10 }, 'your own score is yours');
  assert.equal(view.members.find((m) => m.name === 'Meera').sat, false);
  assert.equal(view.week.sat, 3);
  assert.equal(view.week.size, 4);
  assert.equal(view.seatsLeft, 1);
  assert.equal(view.you.role, 'member');
  assert.equal(view.members[0].owner, true);
  const text = JSON.stringify(view);
  for (const leak of ['u1', 'u2', 'u4', 'picks', 'user_id', 'session_id', 'practice_u1', 'practice_u2']) assert.equal(text.includes(leak), false, leak);
  assert.equal(view.invite.usesLeft, 1, 'uses left never exceeds seats left');
  assert.equal(view.week.yourResultId, 'practice_u3', 'your own result, so "See your answers" can open it');
});

test('the view: a non-sitter is never named; the nudge shows once to someone who has not sat', () => {
  const nudges = [{ from_user: 'u1', sent_at: at(6), seen: false }];
  const meera = buildView(fixedState({ nudges }), { userId: 'u4', now: NOW, memberIdFor: fixedIds }).mob;
  assert.deepEqual(meera.nudge.received, { fromName: 'Riya' });
  assert.equal(meera.nudge.canSend, false);
  assert.equal(meera.nudge.reason, 'not_sat');
  const seen = buildView(fixedState({ nudges: [{ ...nudges[0], seen: true }] }), { userId: 'u4', now: NOW, memberIdFor: fixedIds }).mob;
  assert.equal(seen.nudge.received, null);
  const riya = buildView(fixedState({ nudges }), { userId: 'u1', now: NOW, memberIdFor: fixedIds }).mob;
  assert.equal(riya.nudge.reason, 'sent');
  assert.equal(riya.nudge.received, null);
  assert.equal(JSON.stringify(riya.nudge).includes('Meera'), false, 'the sender never learns who has not sat');
  const asha = buildView(fixedState({ nudges }), { userId: 'u2', now: NOW, memberIdFor: fixedIds }).mob;
  assert.equal(asha.nudge.canSend, true);
  const all = buildView(fixedState({ sat: ['u1', 'u2', 'u3', 'u4'] }), { userId: 'u2', now: NOW, memberIdFor: fixedIds }).mob;
  assert.equal(all.nudge.reason, 'everyone_sat');
  assert.equal(buildView(null, { userId: 'u1' }).mob, null);
  assert.equal(buildView(fixedState(), { userId: 'stranger', now: NOW, memberIdFor: fixedIds }).mob, null);
});

test('together: only between sitters who show their score, a count and one shared miss, never a rank', () => {
  const keys = [0, 1, 2, 3, 0, 1, 2, 3, 0, -1];
  const asha = { user_id: 'u2', picks: [0, 1, 2, 3, 0, 1, 2, 0, 1, 2] }; // right on 1 to 7; wrong on 8 and 9
  const riya = { user_id: 'u1', picks: [0, 1, 2, 0, 0, 1, 2, 0, 1, 0] }; // wrong on 4, 8 and 9
  const kabir = { user_id: 'u3', picks: [0, 1, 2, 3, 0, 0, 2, 3, 0, 0] };
  const both = computeTogether([asha, riya], keys, { userId: 'u2', optedIn: ['u1', 'u2'] });
  assert.deepEqual(both, { with: 1, sameRight: 6, of: 9, sharedMiss: 8 }, 'the unreadable key (question 10) is left out');
  assert.equal(togetherLine(both), 'You and 1 other member both got the same 6 questions right. You both missed question 8.');
  assert.equal(computeTogether([asha, riya], keys, { userId: 'u2', optedIn: ['u2'] }), null, 'the other member keeps their score private');
  assert.equal(computeTogether([asha, riya], keys, { userId: 'u2', optedIn: ['u1'] }), null, 'you keep yours private, so you compare with nobody');
  assert.equal(computeTogether([riya], keys, { userId: 'u2', optedIn: ['u1', 'u2'] }), null, 'you have not sat');
  const three = computeTogether([asha, riya, kabir], keys, { userId: 'u2', optedIn: new Set(['u1', 'u2', 'u3']) });
  assert.deepEqual(three, { with: 2, sameRight: 5, of: 9, sharedMiss: null });
  assert.equal(togetherLine(three), 'You and 2 other members all got the same 5 questions right.');
  assert.equal(togetherLine({ with: 1, sameRight: 1, of: 10, sharedMiss: null }), 'You and 1 other member both got the same question right.');
  assert.equal(togetherLine({ with: 1, sameRight: 0, of: 10, sharedMiss: 2 }), 'You and 1 other member got no question right in common. You both missed question 2.');
  for (const line of [togetherLine(both), togetherLine(three)]) {
    assert.doesNotMatch(line, /Riya|Kabir|better|worse|ahead|behind|rank|first/i, line);
    assert.doesNotMatch(line, /[!→]|—/, line);
  }
  // The view carries it only to a sitter, and leaves the key out otherwise (the contract shape is unchanged).
  const t = { with: 1, sameRight: 6, of: 9, sharedMiss: 8 };
  assert.deepEqual(buildView(fixedState(), { userId: 'u2', now: NOW, memberIdFor: fixedIds, together: t }).mob.together, t);
  assert.equal('together' in buildView(fixedState(), { userId: 'u2', now: NOW, memberIdFor: fixedIds }).mob, false);
  assert.equal('together' in buildView(fixedState(), { userId: 'u4', now: NOW, memberIdFor: fixedIds, together: t }).mob, false, 'Meera has not sat');
});

test('picks follow the paper order, blanks are -1', () => {
  const picks = picksFromAttempt(['q1', 'q2', 'q3'], { details: [{ qid: 'q3', givenIndex: 2 }, { qid: 'q1', givenIndex: null }] });
  assert.deepEqual(picks, [-1, -1, 2]);
});

// ---------------------------------------------------------------------------------------------------------------
// The migration on PGlite
// ---------------------------------------------------------------------------------------------------------------

async function database(users = 8) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(`create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,${users}) g;`);
  await db.exec(migration);
  await db.exec(migration);
  return db;
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]?.r;
// Starting: free 1, Pro 3, the API passes the cap in. Joining: the API passes the safety ceiling (12). The helpers return
// the status text, as the old ones did.
const join = async (db, user, code, name = 'Friend', max = 12) => (await one(db, 'select mob_join($1,$2,$3,0::smallint,$4::int) r', [user, code, name, max])).status;
const create = async (db, user, name = 'Riya', max = 1, subject = 'accountancy') => (await one(db, 'select mob_create($1,$2,$3,0::smallint,$4::int) r', [user, subject, name, max])).status;
const mobOf = (db, user, nth = 0) => one(db, 'select mob_id::text r from mob_members where user_id = $1 order by joined_at, mob_id offset $2 limit 1', [user, nth]);
const invite = async (db, user, code, expires = "now() + interval '7 days'", mob = null) => one(db, `select mob_invite_new($1,$2::uuid,$3,${expires}) r`, [user, mob || await mobOf(db, user), code]);

test('anon and authenticated get permission denied on every Mob table and function', async () => {
  const db = await database();
  try {
    const tables = ['mobs', 'mob_members', 'mob_invites', 'mob_papers', 'mob_sittings', 'mob_nudges', 'mob_nudge_seen', 'mob_blocks', 'mob_reports',
      'mob_extras', 'mob_extra_sittings', 'mob_free_claims', 'mob_samples', 'mob_departures', 'mob_data_moves'];
    const fns = (await db.query("select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'mob\\_%' or p.proname like 'rate\\_limit\\_%')")).rows.map((r) => r.sig);
    assert.equal(fns.length, 26, '22 Mob functions, mob_started_count and mob_metrics, and the two rate-limit helpers');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const t of tables) await assert.rejects(db.query(`select * from public.${t}`), /permission denied/, `${role} ${t}`);
      await assert.rejects(db.query("select public.mob_invite_lookup('ABCDEFGH')"), /permission denied/, `${role} lookup`);
      await assert.rejects(db.query("select public.mob_state('u1', current_date, null)"), /permission denied/, `${role} state`);
      await assert.rejects(db.query("select public.mob_free_claim('u1', gen_random_uuid(), current_date)"), /permission denied/, `${role} claim`);
      await assert.rejects(db.query("select public.mob_history('u1', gen_random_uuid(), current_date, 5)"), /permission denied/, `${role} history`);
      await db.exec('reset role');
    }
    for (const sig of fns) {
      const acl = (await db.query("select proacl::text a from pg_proc where oid = $1::regprocedure", [sig])).rows[0].a || '';
      assert.doesNotMatch(acl, /(^|[{,])(anon|authenticated)=|(^|[{,])=X/, sig);
      assert.match(acl, /service_role=X/, sig);
    }
    for (const t of tables) assert.equal((await db.query('select relrowsecurity r from pg_class where relname=$1', [t])).rows[0].r, true, `${t} has RLS on`);
  } finally { await db.close(); }
});

test('joining: a 6th member is full, a second Mob is already, an expired code is expired, a block either way is blocked', async () => {
  const db = await database();
  try {
    assert.equal(await create(db, 'u1'), 'created');
    assert.equal(await create(db, 'u1'), 'limit', 'free starts one Mob');
    assert.equal(await invite(db, 'u1', 'AAAAAAAA'), 'ok');
    assert.equal((await one(db, "select mob_invite_lookup('AAAAAAAA') r")).seats_left, 4);
    assert.equal(await join(db, 'u2', 'AAAAAAAA'), 'joined');
    assert.equal(await join(db, 'u3', 'AAAAAAAA'), 'joined');
    assert.equal(await join(db, 'u2', 'AAAAAAAA'), 'already');
    // A new invite revokes the old one.
    assert.equal(await invite(db, 'u2', 'BBBBBBBB'), 'ok');
    assert.equal(await join(db, 'u4', 'AAAAAAAA'), 'invalid');
    assert.equal((await one(db, "select mob_invite_lookup('AAAAAAAA') r")).status, 'invalid');
    assert.equal(await join(db, 'u4', 'BBBBBBBB'), 'joined');
    assert.equal(await join(db, 'u5', 'BBBBBBBB'), 'joined');
    assert.equal((await one(db, "select count(*)::int r from mob_members")), 5);
    // Give the code a use left; the Mob has 5, so the 6th is still refused.
    await db.exec("update mob_invites set max_uses = 4 where code = 'BBBBBBBB'");
    assert.equal(await join(db, 'u6', 'BBBBBBBB'), 'full');
    assert.equal((await one(db, "select mob_invite_lookup('BBBBBBBB') r")).status, 'full', 'a full Mob says full, never a used-up link');
    // Back to 4 uses: the link is used up AND the Mob is full; full is the reason the joiner hears.
    await db.exec("update mob_invites set max_uses = 3 where code = 'BBBBBBBB'");
    assert.equal(await join(db, 'u6', 'BBBBBBBB'), 'full');
    assert.equal((await one(db, "select mob_invite_lookup('BBBBBBBB') r")).status, 'full');
    assert.equal(await invite(db, 'u1', 'CCCCCCCC'), 'full');
    // A second Mob: u6 starts one; a free member of the first may join it too (free starts one and joins any).
    assert.equal(await create(db, 'u6', 'Kabir'), 'created');
    assert.equal(await invite(db, 'u6', 'DDDDDDDD'), 'ok');
    assert.equal(await join(db, 'u2', 'DDDDDDDD'), 'joined', 'joining is open to a free student who is in a Mob');
    assert.equal(await join(db, 'u3', 'DDDDDDDD', 'Friend', 1), 'limit', 'the ceiling the API passes still holds');
    // A free student who joined two Mobs can still start one of their own; one they started counts, one they joined does not.
    assert.equal(await create(db, 'u2', 'Asha'), 'created');
    assert.equal(await create(db, 'u2', 'Asha'), 'limit');
    assert.equal(await one(db, "select mob_started_count('u2') r"), 1);
    // A used-up link to a Mob with seats is still a used-up link.
    assert.equal(await invite(db, 'u2', 'FFFFFFFF', "now() + interval '7 days'", await one(db, "select id::text r from mobs where created_by = 'u2'")), 'ok');
    await db.exec("update mob_invites set uses = max_uses where code = 'FFFFFFFF'");
    assert.equal(await join(db, 'u8', 'FFFFFFFF'), 'expired');
    // Blocks, either way.
    await db.exec("insert into mob_blocks values ('u6','u7')");
    assert.equal(await join(db, 'u7', 'DDDDDDDD'), 'blocked');
    await db.exec("delete from mob_blocks; insert into mob_blocks values ('u8','u6')");
    assert.equal(await join(db, 'u8', 'DDDDDDDD'), 'blocked');
    // Expired.
    assert.equal(await invite(db, 'u6', 'EEEEEEEE', "now() - interval '1 minute'"), 'ok');
    assert.equal(await join(db, 'u7', 'EEEEEEEE'), 'expired');
    assert.equal(await join(db, 'u7', 'ZZZZZZZZ'), 'invalid');
    const lookup = JSON.stringify(await one(db, "select mob_invite_lookup('DDDDDDDD') r"));
    for (const leak of ['Kabir', 'u6', 'user', 'name']) assert.equal(lookup.includes(leak), false, leak);
  } finally { await db.close(); }
});

test('leaving: the owner passes the role on, the last leave deletes the Mob and everything under it', async () => {
  const db = await database();
  try {
    await create(db, 'u1');
    await invite(db, 'u1', 'AAAAAAAA');
    await join(db, 'u2', 'AAAAAAAA');
    await join(db, 'u3', 'AAAAAAAA');
    const mob = await one(db, 'select id::text r from mobs');
    await db.query("select mob_paper_put($1::uuid, '2026-10-12', 'accountancy', $2::jsonb)", [mob, JSON.stringify(Array.from({ length: 10 }, (_, i) => `q${i}`))]);
    assert.equal(await one(db, "select mob_record_sitting('u1',$1::uuid,'2026-10-12','s1',7,10,'{0,1,2,3,0,1,2,3,0,1}'::smallint[],now()) r", [mob]), 'recorded');
    assert.equal(await one(db, "select mob_record_sitting('u1',$1::uuid,'2026-10-12','s1b',9,10,'{0,1,2,3,0,1,2,3,0,1}'::smallint[],now()) r", [mob]), 'exists');
    assert.equal((await one(db, "select (mob_nudge('u1',$1::uuid,'2026-10-12'))->>'status' r", [mob])), 'sent');
    assert.equal(await one(db, "select mob_leave('u1',$1::uuid) r", [mob]), 'left');
    assert.equal(await one(db, "select role r from mob_members where user_id='u2'"), 'owner', 'the earliest remaining member');
    assert.equal(await one(db, "select count(*)::int r from mob_sittings"), 0, 'the leaver\'s sittings leave with them');
    assert.equal(await one(db, "select count(*)::int r from mob_nudges"), 0);
    assert.equal(await one(db, "select mob_remove('u3',$1::uuid,'u2') r", [mob]), 'not_owner');
    assert.equal(await one(db, "select mob_remove('u2',$1::uuid,'u3') r", [mob]), 'removed');
    assert.equal(await one(db, "select mob_leave('u2',$1::uuid) r", [mob]), 'left_and_closed');
    for (const t of ['mobs', 'mob_members', 'mob_invites', 'mob_papers']) assert.equal(await one(db, `select count(*)::int r from ${t}`), 0, t);
    assert.equal(await one(db, "select mob_leave('u2',$1::uuid) r", [mob]), 'not_member');
  } finally { await db.close(); }
});

test('the undo drops everything cleanly and the migration re-applies', async () => {
  const db = await database();
  try {
    // The fix's undo on its own puts the 17 Oct 10:00 rules back: free is one Mob in all, sharing is off by default.
    assert.equal(await create(db, 'u1'), 'created');
    assert.equal(await invite(db, 'u1', 'AAAAAAAA'), 'ok');
    assert.equal(await join(db, 'u2', 'AAAAAAAA'), 'joined');
    await db.exec("update mob_members set show_score = false, share_moved_1017 = false where user_id = 'u2'");
    await db.exec(fixUndo);
    await db.exec(fixUndo);
    assert.equal(await create(db, 'u2'), 'limit', 'undone: a free member of one Mob cannot start another');
    assert.equal(await one(db, "select column_default r from information_schema.columns where table_name='mob_members' and column_name='show_score'"), 'false');
    assert.equal(await one(db, "select count(*)::int r from information_schema.columns where table_name='mobs' and column_name='created_by'"), 0);
    // Then the Mob's own undo drops the rest, twice over, and both migrations re-apply.
    await db.exec(baseUndo);
    assert.equal(await one(db, "select count(*)::int r from pg_tables where schemaname='public' and tablename like 'mob%'"), 0);
    assert.equal(await one(db, "select count(*)::int r from pg_proc where proname like 'mob\\_%' or proname like 'rate\\_limit\\_%'"), 0);
    await db.exec(baseUndo);
    await db.exec(migration);
    assert.equal(await create(db, 'u1'), 'created');
  } finally { await db.close(); }
});

test('account deletion: Mob rows go, report links are nulled, and nothing Mob-shaped blocks the delete', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.users (id text primary key, name text not null default 'x', email text unique, username text unique, image text,
        subjects jsonb not null default '[]'::jsonb, role text not null default 'student', last_active_at timestamptz);
      insert into users (id, email, username) values ('u1','a@x.test','a'),('u2','b@x.test','b'),('u3','c@x.test','c');`);
    await db.exec(read('supabase/migrations/20261012121000_app_preferences_and_rhythm.sql'));
    await db.exec(read('supabase/migrations/20261013120000_deletion_processor.sql'));
    await db.exec(migration);
    await create(db, 'u1');
    await invite(db, 'u1', 'AAAAAAAA');
    await join(db, 'u2', 'AAAAAAAA');
    await join(db, 'u3', 'AAAAAAAA');
    const mob = await one(db, 'select id::text r from mobs');
    await db.query("select mob_paper_put($1::uuid, '2026-10-12', 'accountancy', $2::jsonb)", [mob, JSON.stringify(Array.from({ length: 10 }, (_, i) => `q${i}`))]);
    for (const u of ['u1', 'u2']) await db.query("select mob_record_sitting($1,$2::uuid,'2026-10-12','s',7,10,'{0,1,2,3,0,1,2,3,0,1}'::smallint[],now())", [u, mob]);
    await db.query("select mob_nudge('u1',$1::uuid,'2026-10-12')", [mob]);
    await db.query("select mob_nudge_seen_mark('u3',$1::uuid,'2026-10-12')", [mob]);
    await db.query("select mob_report('u2',$1::uuid,'u1','name')", [mob]);
    await db.query("select mob_report('u1',$1::uuid,'u3','nudge')", [mob]);
    await db.query("select mob_block('u1','u3')");
    // The Free and Pro tables: the free weekly claim, the free sample, an extra paper and a sitting on it.
    await db.query("select mob_free_claim('u1',$1::uuid,'2026-10-12')", [mob]);
    await db.query("select mob_sample_claim('u1',$1::uuid,'2026-10-12')", [mob]);
    const extra = await one(db, "select (mob_extra_put('u1',$1::uuid,'2026-10-12','Chapter',$2::jsonb, now() + interval '7 days', 3))->>'id' r", [mob, JSON.stringify(['a', 'b', 'c', 'd', 'e'])]);
    await db.query("select mob_extra_record('u1',$1::uuid,'s',3,5,'{0,1,2,3,0}'::smallint[],now(),null)", [extra]);
    await db.query("select mob_extra_record('u2',$1::uuid,'s',3,5,'{0,1,2,3,0}'::smallint[],now(),null)", [extra]);
    await db.exec("insert into account_deletion_requests (user_id, requested_at, source) values ('u1', now() - interval '2 days', 'web')");
    const req = (await db.query("select id from account_deletion_requests where user_id='u1'")).rows[0].id;
    const r = (await db.query('select public.account_deletion_run($1::bigint, $2, $3::jsonb, true) as r', [req, 'u1', JSON.stringify(DELETION_STEPS)])).rows[0].r;
    assert.deepEqual(r.unclassified, []);
    for (const [t, where] of [['mob_members', "user_id='u1'"], ['mob_sittings', "user_id='u1'"], ['mob_nudges', "from_user='u1'"], ['mob_nudge_seen', "from_user='u1' or to_user='u1'"], ['mob_blocks', "blocker_id='u1' or blocked_id='u1'"], ['mob_invites', "created_by='u1'"], ['mob_reports', "reporter_id='u1' or reported_id='u1'"]]) {
      assert.equal(await one(db, `select count(*)::int r from ${t} where ${where}`), 0, t);
    }
    for (const t of ['mob_extra_sittings', 'mob_free_claims', 'mob_samples']) assert.equal(await one(db, `select count(*)::int r from ${t} where user_id='u1'`), 0, t);
    assert.equal(await one(db, "select count(*)::int r from mob_extra_sittings where user_id='u2'"), 1, 'the other members sittings stay');
    assert.equal(await one(db, 'select count(*)::int r from mob_extras where created_by is null'), 1, 'the extra paper stays with the Mob, with no creator');
    assert.equal(await one(db, 'select count(*)::int r from mob_reports'), 2, 'both reports stay, with the reason and the name');
    assert.equal(await one(db, "select count(*)::int r from mob_members where user_id in ('u2','u3')"), 2, 'the others stay in the Mob');
    assert.equal(await one(db, "select count(*)::int r from mob_sittings where user_id='u2'"), 1);
    // The tombstoned owner is gone, so the next read gives the earliest remaining member the owner's controls.
    const state = await one(db, "select mob_state('u2','2026-10-12', null) r");
    const view = buildView({ ...state, week: WEEK }, { userId: 'u2', now: NOW, memberIdFor: (u) => u.toUpperCase().padEnd(12, '0') }).mob;
    assert.equal(view.you.role, 'owner');
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// The service on PGlite
// ---------------------------------------------------------------------------------------------------------------

function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const args = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const values = keys.map((k) => {
      const v = params[k];
      if (k === 'p_picks') return `{${v.join(',')}}`;
      if (v && typeof v === 'object') return JSON.stringify(v);
      return v;
    });
    return (await db.query(`select public.${name}(${args}) as r`, values)).rows[0].r;
  };
}

const BANK = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: `Option ${t}${i}` })) }));
// 20 questions for the weekly paper (the first 10) and extra papers of 5 to 20.
const EXTRA_BANK = Array.from({ length: 20 }, (_, i) => BANK[i] || { id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, options: BANK[0].options });
function serviceFor(db, { clock = { now: NOW }, attempts = [], balance = 40, premium = false, started = [] } = {}) {
  let seed = 1;
  return createMobService({
    rpc: pgRpc(db), now: () => clock.now, secret: 'test-secret', blocklist,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 97 + 13) % 256)),
    subjectInfo: (s) => (['accountancy', 'economics'].includes(s) ? { ok: true, id: s, name: s === 'accountancy' ? 'Accountancy' : 'Economics' } : { ok: false }),
    loadUser: async (id) => ({ subjects: ['accountancy', 'economics'], isPremium: typeof premium === 'function' ? premium(id) : premium, creditBalance: balance }),
    validChapter: (subject, chapter) => subject === 'accountancy' && ['Partnership Accounts', 'Cash Flow Statement'].includes(chapter),
    pickQuestionIds: async (_s, { count = 10 } = {}) => EXTRA_BANK.slice(0, count).map((q) => q.id),
    loadQuestions: async (ids) => ids.map((id) => EXTRA_BANK.find((q) => q.id === id)).filter(Boolean),
    trapNameFor: async (q, i) => (q.id === 'q2' && i === 3 ? 'A look-alike term' : null),
    findAttempts: async (userIds) => attempts.filter((a) => userIds.includes(a.userId)),
    startPractice: async (userId, input, server) => {
      started.push({ userId, input, server });
      return { id: `practice_${input.generationKey.slice(4, 12)}`, questions: server.mobPaper.questions, meta: { mode: 'quick', storage: 'device' } };
    },
  });
}
const expectCode = (code) => (e) => e?.code === code;

test('the service: start, invite, join, sit, ring, trap, nudge, leave and block, with no user id ever leaving', async () => {
  const db = await database();
  const started = [];
  const attempts = [];
  const svc = serviceFor(db, { started, attempts, premium: true }); // Pro sees the trap; the Free view of the same Mob is checked at the end
  try {
    assert.deepEqual(await svc.view('u1'), { mob: null });
    await assert.rejects(svc.create('u1', { subject: 'physics', name: 'Riya', colour: 0 }), expectCode('SUBJECT_INVALID'));
    await assert.rejects(svc.create('u1', { subject: 'accountancy', name: 'R', colour: 0 }), expectCode('NAME_INVALID'));
    await assert.rejects(svc.create('u1', { subject: 'accountancy', name: 'Admin', colour: 0 }), expectCode('NAME_REFUSED'));
    await assert.rejects(svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 9 }), expectCode('COLOUR_INVALID'));
    const made = await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 0 });
    assert.equal(made.mob.week.size, 1);
    assert.equal(made.mob.you.role, 'owner');
    assert.deepEqual(made.mob.week.paper.cost, { type: 'free' }, 'the weekly Mob paper costs no credits');
    const inv = await svc.invite('u1');
    assert.match(inv.code, CODE_RE);
    assert.equal(inv.url, `https://www.mockmob.in/join/${inv.code}`);
    assert.equal(inv.usesLeft, 4);
    assert.equal(Date.parse(inv.expiresAt), NOW + 7 * 86_400_000);
    const pub = await svc.lookup(inv.code.toLowerCase());
    assert.deepEqual(Object.keys(pub).sort(), ['code', 'expiresAt', 'seatsLeft', 'size', 'subject', 'subjectName', 'valid']);
    for (const [u, name] of [['u2', 'Asha'], ['u3', 'Kabir'], ['u4', 'Meera']]) await svc.join(u, { code: inv.code, name, colour: 1 });
    await assert.rejects(svc.join('u5', { code: 'ZZZZZZZZ', name: 'Dev', colour: 1 }), expectCode('INVITE_INVALID'));

    // Every member gets the same paper: same ids, same option order, one key per member and week.
    for (const u of ['u1', 'u2', 'u3']) await svc.startPaper(u, {});
    assert.equal(started.length, 3);
    const papers = started.map((s) => JSON.stringify(s.server.mobPaper.questions));
    assert.equal(new Set(papers).size, 1, 'identical questions and option order');
    assert.equal(started[0].server.mobPaper.weekStart, WEEK);
    assert.equal(new Set(started.map((s) => s.input.generationKey)).size, 3, 'one key per member');
    await svc.startPaper('u1', {});
    assert.equal(started[3].input.generationKey, started[0].input.generationKey, 'a retry resumes the same session');
    assert.equal(started[0].input.mode, 'quick');
    assert.equal(started[0].input.count, 10);

    // Sittings arrive through finishPractice's hook and through the durable-path sync on read.
    const attempt = (u, picks, extra = {}) => ({ id: `att_${u}`, userId: u, correct: picks.filter((p, i) => p === BANK[i].correctIndex).length, total: 10, completedAt: NOW + 60_000,
      details: picks.map((p, i) => ({ qid: BANK[i].id, givenIndex: p < 0 ? null : p })), selectionMeta: { mobPaper: { mobId: started[0].server.mobPaper.mobId, weekStart: WEEK } }, ...extra });
    // Key per question: 0,1,2,3,0,1,2,3,0,1. On question 2 (key B) three of us pick D.
    const right = BANK.map((q) => q.correctIndex);
    const withTrap = [...right]; withTrap[1] = 3;
    assert.equal(await svc.recordFromAttempt('u1', attempt('u1', withTrap)), 'recorded');
    assert.equal(await svc.recordFromAttempt('u1', attempt('u1', withTrap)), 'exists');
    assert.equal(await svc.recordFromAttempt('u2', attempt('u2', withTrap, { completedAt: Date.parse(nextOpensAt(WEEK)) + 1 })), 'late', 'after the close it does not count');
    attempts.push(attempt('u2', withTrap));
    let asha = await svc.view('u2');
    assert.equal(asha.mob.week.sat, 2, 'the durable-path sitting was picked up on read');
    assert.equal(asha.mob.trap, null, 'under 3 sitters there is no trap');
    assert.equal((await svc.view('u4')).mob.trap, null);
    assert.equal(await svc.recordFromAttempt('u3', attempt('u3', right)), 'recorded');
    asha = await svc.view('u2');
    assert.equal(asha.mob.week.sat, 3);
    assert.deepEqual(asha.mob.trap, { questionNumber: 2, questionId: 'q2', option: 'D', count: 2, of: 3, trapName: 'A look-alike term', youPickedIt: true, youGotItRight: false });
    assert.equal((await svc.view('u3')).mob.trap.youGotItRight, true);
    const meera = await svc.view('u4');
    assert.equal(meera.mob.trap, null, 'P7: the trap never spoils the paper for someone who has not sat');
    assert.ok(meera.mob.week.paper.cost);
    assert.equal(asha.mob.week.paper.cost, null, 'no cost line once you have sat');
    await assert.rejects(svc.startPaper('u2', {}), expectCode('PAPER_ALREADY_SAT'));

    // Scores: shared by default (17 Oct), never sorted; a member who turns sharing off is never shown.
    assert.equal((await svc.view('u4')).mob.you.showScore, true, 'sharing is on for a new member');
    assert.deepEqual((await svc.view('u4')).mob.members.map((m) => [m.name, m.score?.value ?? null]), [['Riya', 9], ['Asha', 9], ['Kabir', 10], ['Meera', null]]);
    await svc.patchMe('u1', { showScore: false });
    await svc.patchMe('u2', { showScore: false });
    const scores = (await svc.view('u4')).mob.members.map((m) => [m.name, m.score?.value ?? null]);
    assert.deepEqual(scores, [['Riya', null], ['Asha', null], ['Kabir', 10], ['Meera', null]]);
    assert.equal((await svc.view('u2')).mob.members.find((m) => m.you).score.value, 9, 'your own score is always yours');
    await assert.rejects(svc.patchMe('u3', {}), expectCode('BODY_INVALID'));
    await assert.rejects(svc.patchMe('u3', { showScore: 'yes' }), expectCode('BODY_INVALID'));
    await svc.patchMe('u3', { name: 'Kabir S', colour: 4 });

    // Nudges: you sit first; once a week; the reply is a count only.
    await assert.rejects(svc.nudge('u4'), expectCode('NOT_SAT_YET'));
    const sent = await svc.nudge('u1');
    assert.deepEqual(sent, { sent: true, to: 1 });
    await assert.rejects(svc.nudge('u1'), expectCode('ALREADY_NUDGED'));
    assert.deepEqual((await svc.view('u4')).mob.nudge.received, { fromName: 'Riya' });
    await svc.nudgeSeen('u4');
    assert.equal((await svc.view('u4')).mob.nudge.received, null);

    // Remove, report, leave and block. Members are addressed by memberId only.
    const view1 = await svc.view('u1');
    const meeraId = view1.mob.members.find((m) => m.name === 'Meera').memberId;
    assert.equal(meeraId, memberIdFor('test-secret', started[0].server.mobPaper.mobId, 'u4'));
    await assert.rejects(svc.remove('u2', { memberId: meeraId }), expectCode('NOT_OWNER'));
    await assert.rejects(svc.report('u2', { memberId: meeraId, reason: 'rude' }), expectCode('REASON_INVALID'));
    await assert.rejects(svc.report('u2', { memberId: 'NOTAMEMBER00', reason: 'name' }), expectCode('NOT_FOUND'));
    assert.deepEqual(await svc.report('u2', { memberId: meeraId, reason: 'name' }), { reported: true, left: false });
    const ashaId = view1.mob.members.find((m) => m.name === 'Asha').memberId;
    assert.deepEqual(await svc.leave('u4', { block: ashaId }), { left: true });
    assert.equal((await svc.view('u1')).mob.week.size, 3);
    // Meera blocked Asha: Meera can never come back into this Mob, and the refusal reads like a bad code.
    const again = await svc.invite('u1');
    await assert.rejects(svc.join('u4', { code: again.code, name: 'Meera', colour: 5 }), expectCode('INVITE_INVALID'));
    const after = await svc.remove('u1', { memberId: (await svc.view('u1')).mob.members.find((m) => m.name === 'Kabir S').memberId });
    assert.equal(after.mob.week.size, 2);
    // The same Mob for a Free student: the ring and the teaser, not the trap or the together line (those are Pro).
    const free = await serviceFor(db, { started, attempts, premium: false }).view('u2');
    assert.equal(free.mob.trap, null);
    assert.equal('together' in free.mob, false);
    assert.equal(free.mob.plan.pro, false);
    const everything = JSON.stringify(await svc.view('u1'));
    for (const leak of ['"u1"', '"u2"', 'u3', 'u4', 'att_u2', 'att_u3', 'picks']) assert.equal(everything.includes(leak), false, leak);
  } finally { await db.close(); }
});

test('the service: the week closing, credits and a paper the bank cannot build', async () => {
  const db = await database();
  const clock = { now: Date.parse('2026-10-18T18:25:00Z') }; // Sunday 11:55 PM IST
  try {
    const svc = serviceFor(db, { clock });
    await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 0 });
    assert.equal((await svc.view('u1')).mob.week.closed, true);
    await assert.rejects(svc.startPaper('u1', {}), expectCode('WEEK_CLOSED'));
    clock.now = Date.parse('2026-10-19T03:00:00Z'); // Monday morning: a new week
    const fresh = await svc.view('u1');
    assert.equal(fresh.mob.week.start, '2026-10-19');
    assert.equal(fresh.mob.week.closed, false);
    const broke = createMobService({ ...serviceDeps(db, clock), startPractice: async () => { throw new Error('INSUFFICIENT_CREDITS'); } });
    await assert.rejects(broke.startPaper('u1', {}), expectCode('CREDITS'));
    const short = createMobService({ ...serviceDeps(db, clock), pickQuestionIds: async () => ['q1', 'q2'] });
    await db.exec('delete from mob_papers');
    await assert.rejects(short.startPaper('u1', {}), expectCode('PAPER_UNAVAILABLE'));
    assert.equal(await one(db, 'select count(*)::int r from mob_papers'), 0, 'nothing frozen when the bank fell short');
    const pro = serviceFor(db, { clock, premium: true });
    assert.deepEqual((await pro.view('u1')).mob.week.paper.cost, { type: 'free' });
    assert.equal((await pro.view('u1')).mob.plan.pro, true);
  } finally { await db.close(); }
});
function serviceDeps(db, clock) {
  return {
    rpc: pgRpc(db), now: () => clock.now, secret: 's', blocklist, randomBytes: (n) => new Uint8Array(n).fill(7),
    subjectInfo: (s) => ({ ok: true, id: s, name: s }), loadUser: async () => ({ subjects: ['accountancy', 'economics'], isPremium: false, creditBalance: 0 }),
    pickQuestionIds: async () => BANK.map((q) => q.id), loadQuestions: async (ids) => ids.map((id) => EXTRA_BANK.find((q) => q.id === id)).filter(Boolean),
    findAttempts: async () => [], startPractice: async () => ({}),
  };
}

test('the service: a missing migration is MIGRATION, never a crash', async () => {
  const svc = createMobService({ rpc: async () => { throw { code: 'PGRST202', message: 'Could not find the function public.mob_state' }; }, now: () => NOW, secret: 's' });
  await assert.rejects(svc.view('u1'), expectCode('MIGRATION'));
});

// ---------------------------------------------------------------------------------------------------------------
// The route handler
// ---------------------------------------------------------------------------------------------------------------

const req = (method = 'GET', body) => new Request('http://localhost/api/mob', { method, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
function httpDeps({ enabled = true, user = 'u1', allow = true, service = {} } = {}) {
  const limits = [];
  return {
    limits,
    enabled: () => enabled,
    auth: async () => (user ? { user: { id: user } } : null),
    rateLimit: async (_r, opts) => { limits.push(opts); return allow === true || (Array.isArray(allow) && !allow.includes(opts.route)) ? { allowed: true } : { allowed: false }; },
    cors: () => ({}),
    service: new Proxy({}, { get: (_t, k) => service[k] || (async () => ({ ok: k })) }),
  };
}

test('routes: MOB_ENABLED off is 404 everywhere; signed out is 401 except the public lookup', async () => {
  for (const action of Object.keys(ACTIONS)) {
    const off = await handleMob(httpDeps({ enabled: false }), action, req(ACTIONS[action][0]), { code: 'AAAAAAAA' });
    assert.equal(off.status, 404, action);
    assert.equal((await off.json()).error.code, 'MOB_DISABLED');
    const out = await handleMob(httpDeps({ user: null }), action, req(ACTIONS[action][0], ACTIONS[action][0] === 'GET' ? undefined : {}), { code: 'AAAAAAAA' });
    assert.equal(out.status, action === 'lookup' ? 200 : 401, action);
    assert.equal(out.headers.get('cache-control'), 'no-store');
  }
});

test('routes: rate limits answer 429 with Retry-After, on the limits P11 names', async () => {
  assert.deepEqual([LIMITS.invite.limit, LIMITS.lookup.limit, LIMITS.join.limit, LIMITS.report.limit, LIMITS.write.limit], [5, 120, 10, 10, 60]);
  assert.equal(LIMITS.lookup.by, 'ip');
  const deps = httpDeps({ allow: false });
  const res = await handleMob(deps, 'invite', req('POST'));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), String(24 * 3600));
  assert.equal((await res.json()).error.code, 'RATE_LIMITED');
  assert.deepEqual(deps.limits[0].keyParts, ['u1']);
  const lookupDeps = httpDeps({ allow: false, user: null });
  const res2 = await handleMob(lookupDeps, 'lookup', req('GET'), { code: 'AAAAAAAA' });
  assert.equal(res2.status, 429);
  assert.equal(res2.headers.get('retry-after'), '600');
  assert.deepEqual(lookupDeps.limits[0].keyParts, [], 'the public lookup is limited per IP');
});

test('routes: errors use the one shape; bad bodies are 422; create answers 201', async () => {
  const bad = await handleMob(httpDeps(), 'join', req('POST', '{nope'));
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys((await bad.json()).error).sort(), ['code', 'message']);
  assert.equal((await handleMob(httpDeps(), 'join', req('POST', '[1]'))).status, 422);
  assert.equal((await handleMob(httpDeps(), 'join', req('POST', 'x'.repeat(5000)))).status, 422);
  assert.equal((await handleMob(httpDeps(), 'create', req('POST', {}))).status, 201);
  const thrown = await handleMob(httpDeps({ service: { join: async () => { throw new Error('boom'); } } }), 'join', req('POST', {}));
  assert.equal(thrown.status, 503);
  assert.equal((await thrown.json()).error.message.includes('boom'), false, 'internals never reach the student');
});

test('routes on PGlite: the public lookup never carries a name (50 codes), the nudge reply is a count', async () => {
  const db = await database(8);
  try {
    const svc = serviceFor(db);
    await svc.create('u1', { subject: 'accountancy', name: 'Riya Sharma', colour: 0 });
    const inv = await svc.invite('u1');
    await svc.join('u2', { code: inv.code, name: 'Asha Verma', colour: 2 });
    const deps = { ...httpDeps({ user: null }), service: svc };
    const codes = [inv.code, ...Array.from({ length: 49 }, (_, i) => codeFromBytes([i, i * 3, i * 7, 200 - i, 99]))];
    for (const code of codes) {
      const res = await handleMob(deps, 'lookup', req('GET'), { code });
      const text = await res.text();
      for (const leak of ['Riya', 'Asha', 'Sharma', 'Verma', 'u1', 'u2', 'memberId', 'name"']) assert.equal(text.includes(leak), false, `${code} ${leak}`);
      if (code === inv.code) assert.equal(JSON.parse(text).seatsLeft, 3);
      else assert.equal(res.status, 404, code);
    }
    const nudge = await handleMob({ ...httpDeps({ user: 'u1' }), service: svc }, 'nudge', req('POST'));
    assert.equal(nudge.status, 409, 'you sit first');
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// The app contract (data/tests/fixtures/mob). Built from the same functions the routes answer with.
// ---------------------------------------------------------------------------------------------------------------

const memberIds = { u1: 'K7Q2M9XR4T1A', u2: 'B3N8D2WQ6Z0C', u3: 'H5P1R7SV2E9F', u4: 'M2X6G4KJ8N3D' };
const fixtureView = (userId, opts = {}, stateOpts = {}) => buildView(fixedState(stateOpts), {
  userId, now: NOW, memberIdFor: (u) => memberIds[u], subjectName: 'Accountancy', ...opts,
});
// A Pro student in two Mobs, with extra papers, and the side-by-side of a Mob of three who share their answers.
const SECOND_MOB = '3c9e1a52-7d40-4f6b-8a1e-2b5d9c0f7e14';
const STEMS = ["A partner's salary is charged to which account?", "Goodwill is valued at 3 years' purchase of average profit.", 'Interest on drawings is calculated from the date of withdrawal.',
  'Which ratio compares current assets to current liabilities?', 'On dissolution, realisation expenses paid by a partner are debited to which account?', 'Capital reserves are created by which transaction?',
  'The profit-sharing ratio of Asha and Riya is 3 to 2. Their sacrificing ratio on admitting Kabir is', 'A bonus issue of shares is made out of', 'Depreciation is charged on', 'The accounting equation is'];
function compareFixture() {
  const members = fixedState().members.map((m) => ({ ...m, show_score: m.user_id !== 'u4' }));
  const keys = [0, 1, 2, 3, 0, 2, 2, 3, 0, 1];
  const t = (...n) => ({ t: n, c: [0, 0, 0, 1, 0, 0, 0, 0, 2, 0] });
  const sittings = [
    { user_id: 'u1', picks: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1], detail: { t: [38, 22, 41, 30, 25, 71, 44, 19, 52, 28], c: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0] } },
    { user_id: 'u2', picks: [0, 1, 2, 0, 0, 1, 2, 3, 0, 1], detail: { ...t(45, 20, 36, 88, 31, 63, 52, 27, 40, 33), c: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0] } },
    { user_id: 'u3', picks: [0, 2, 2, 3, 0, 1, 2, 3, 3, 1], detail: { ...t(30, 64, 29, 41, 22, 59, 38, 24, 77, 26), c: [0, 1, 0, 0, 0, 0, 0, 0, 2, 0] } },
  ];
  return buildCompare({
    members, sittings, ids: keys.map((_, i) => `q${i + 1}`), questions: keys.map((k, i) => ({ id: `q${i + 1}`, stem: STEMS[i], correctIndex: k })),
    userId: 'u2', memberIdFor: (u) => memberIds[u], access: 'full', week: WEEK, trapName: 'A look-alike term', nameOf: (u) => members.find((m) => m.user_id === u).display_name,
  });
}
function fixtures() {
  const trap = { questionNumber: 6, questionId: 'q6', option: 'B', count: 3, of: 3, trapName: 'A look-alike term', youPickedIt: true, youGotItRight: false };
  const teaser = { split: 3, of: 10, with: null, text: 'Your Mob split on 3 of 10 questions.' };
  const mobs = [{ id: MOB_ID, subject: 'accountancy', subjectName: 'Accountancy' }, { id: SECOND_MOB, subject: 'economics', subjectName: 'Economics' }];
  const extras = [
    { id: 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35', chapter: 'Partnership Accounts', count: 10, createdByYou: true, createdAt: '2026-10-13T08:00:00.000Z', closesAt: '2026-10-20T08:00:00.000Z', closed: false, sat: 1, youSat: false, yourResultId: null, compare: null },
    { id: 'd5f2b8a1-6c37-4a90-8e14-7b3c9d0a5f62', chapter: null, count: 5, createdByYou: false, createdAt: '2026-10-12T15:00:00.000Z', closesAt: '2026-10-19T15:00:00.000Z', closed: false, sat: 3, youSat: true, yourResultId: 'practice_u2x',
      compare: { available: true, access: 'full', youShare: true, needsShare: false, teaser: { split: 1, of: 5, with: null, text: 'Your Mob split on 1 of 5 questions.' } } },
  ];
  return {
    'get_v1.json': fixtureView('u2', { trap, compare: { available: true, access: 'offer', youShare: true, needsShare: true, teaser } }, { nudges: [] }),
    'get_not_sat_v1.json': fixtureView('u4', { cost: { type: 'free' } }, { nudges: [{ from_user: 'u1', sent_at: at(6), seen: false }] }),
    'get_alone_v1.json': buildView({ ...fixedState({ sat: [] }), members: [fixedState().members[1]], invite: null }, { userId: 'u1', now: NOW, memberIdFor: (u) => memberIds[u], subjectName: 'Accountancy', cost: { type: 'free' } }),
    'get_pro_v2.json': { mob: { ...fixtureView('u2', { trap, plan: { pro: true }, mobs, extras, compare: { available: true, access: 'full', youShare: true, needsShare: false, teaser } }, { nudges: [] }).mob, pastWeeks: 2 } },
    'compare_v2.json': { compare: { ...compareFixture(), mobId: MOB_ID, yourResultId: 'practice_u2' } },
    'history_v2.json': {
      mobId: MOB_ID,
      weeks: [
        { week: '2026-10-05', closedAt: closesAt('2026-10-05'), sat: 4, extras: 1, you: { sat: true, score: { value: 8, of: 10 }, resultId: 'practice_u2_w1' } },
        { week: '2026-09-28', closedAt: closesAt('2026-09-28'), sat: 2, extras: 0, you: { sat: false } },
      ],
    },
    'get_none_v1.json': { mob: null },
    'lookup_v1.json': { valid: true, code: '7KQ2M9XR', subject: 'accountancy', subjectName: 'Accountancy', size: 3, seatsLeft: 2, expiresAt: '2026-10-20T16:10:00.000Z' },
    'errors_v1.json': Object.fromEntries(Object.keys(ERRORS).map((code) => [code, { status: ERRORS[code][0], body: errorBody(code) }])),
  };
}
if (process.env.MOB_WRITE_FIXTURE === '1') {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  for (const [name, body] of Object.entries(fixtures())) writeFileSync(resolve(FIXTURE_DIR, name), `${JSON.stringify(body, null, 2)}\n`);
}

test('the contract fixtures are exactly what the view functions produce', () => {
  for (const [name, body] of Object.entries(fixtures())) {
    const file = resolve(FIXTURE_DIR, name);
    assert.ok(existsSync(file), `run once with MOB_WRITE_FIXTURE=1 (${name})`);
    assert.equal(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), `${JSON.stringify(body, null, 2)}\n`, name);
  }
  const get = JSON.parse(readFileSync(resolve(FIXTURE_DIR, 'get_v1.json'), 'utf8'));
  assert.equal(get.mob.members.length, 4);
  assert.ok(get.mob.members.length <= MAX_MEMBERS);
  assert.equal(get.mob.week.paper.count, 10);
});
