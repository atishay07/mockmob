// The welcome and day-2 emails (15 Nov 2026): the switch, never twice, the caps, the unsubscribe signature and the day-2
// selection, against an in-memory database (a small Supabase-shaped fake with the migration's primary keys) and a fake mail
// transport. Nothing here touches a network.
//   node --test src/lib/email/studentMail.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS, EMAILS_DAILY_CAP_DEFAULT, answeredSince, dailySlotBucket, dayTwoState, dayTwoWindow, emailsDailyCap, emailsEnabled,
  idempotencyKey, istDay, istDayStart, pickDayTwo, signInCeilingBucket, signInRoom, unsubscribeHeaders, unsubscribeToken,
  unsubscribeUrl, verifyUnsubscribe,
} from './studentMailModel.mjs';
import { buildStudentEmail, studentEmailWords, unsubscribePage } from './studentMailWords.mjs';
import { DAY2_SPACING_MS, runDayTwo, sendStudentEmail } from './studentMail.mjs';
import { createStudentMailStore } from './studentMailStore.js';
import { mistakeKey } from '../server/repairRecord.js';
import { FIRST_SET_HREF } from '../firstSet.mjs';

const ON = { EMAILS_ENABLED: 'true', NEXTAUTH_SECRET: 'test-secret-1' };
const ORIGIN = 'https://www.mockmob.in';
// 15 Nov 2026, 6:00 pm India time (12:30 UTC).
const SIX_PM = Date.parse('2026-11-15T12:30:00Z');
const YESTERDAY = Date.parse('2026-11-14T09:00:00Z'); // 2:30 pm India time, 14 Nov

// ------------------------------------------------------------------------------------------------ an in-memory database
const KEYS = { email_sends: ['user_id', 'kind'], email_optouts: ['user_id'] };
const get = (row, path) => path.split('->').reduce((v, k) => (v == null ? v : v[k]), row);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function memoryDb(tables = {}, { missing = [], fail = () => false } = {}) {
  const t = (name) => tables[name] || (tables[name] = []);
  const buckets = new Map();
  const calls = [];
  class Q {
    constructor(name) { this.name = name; this.f = []; this.op = 'select'; this.n = Infinity; this.ord = null; }
    select() { if (this.op !== 'select') this.ret = true; return this; }
    eq(k, v) { this.f.push((r) => get(r, k) === v); return this; }
    in(k, list) { this.f.push((r) => list.includes(get(r, k))); return this; }
    gte(k, v) { this.f.push((r) => get(r, k) != null && cmp(get(r, k), v) >= 0); return this; }
    lt(k, v) { this.f.push((r) => get(r, k) != null && cmp(get(r, k), v) < 0); return this; }
    is(k, v) { this.f.push((r) => (v === null ? get(r, k) == null : get(r, k) === v)); return this; }
    not(k, op, v) { assert.equal(op, 'is'); this.f.push((r) => (v === null ? get(r, k) != null : get(r, k) !== v)); return this; }
    order(k, o = {}) { this.ord = { k, asc: o.ascending !== false }; return this; }
    limit(n) { this.n = n; return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    upsert(row, o = {}) { this.op = 'upsert'; this.row = row; this.o = o; return this; }
    then(resolve, reject) { return Promise.resolve().then(() => this.run()).then(resolve, reject); }
    run() {
      calls.push({ table: this.name, op: this.op });
      if (missing.includes(this.name)) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${this.name}' in the schema cache` } };
      if (fail(this)) return { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
      const all = t(this.name);
      const key = KEYS[this.name];
      const clash = (row) => key && all.some((r) => key.every((k) => r[k] === row[k]));
      if (this.op === 'insert') {
        if (clash(this.row)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        all.push({ ...this.row });
        return { data: this.ret ? [{ ...this.row }] : null, error: null };
      }
      if (this.op === 'upsert') {
        if (!clash(this.row)) all.push({ ...this.row });
        else if (!this.o.ignoreDuplicates) Object.assign(all.find((r) => key.every((k) => r[k] === this.row[k])), this.row);
        return { data: null, error: null };
      }
      let rows = all.filter((r) => this.f.every((f) => f(r)));
      if (this.op === 'update') { rows.forEach((r) => Object.assign(r, this.patch)); return { data: null, error: null }; }
      if (this.ord) rows = [...rows].sort((a, b) => (this.ord.asc ? 1 : -1) * cmp(get(a, this.ord.k), get(b, this.ord.k)));
      return { data: rows.slice(0, this.n).map((r) => ({ ...r })), error: null };
    }
  }
  return {
    tables,
    calls,
    buckets,
    from: (name) => new Q(name),
    // take_rate_limit and rate_limit_give_back, as the migration writes them (one statement each).
    async rpc(name, args) {
      calls.push({ rpc: name });
      if (name === 'take_rate_limit') {
        const b = buckets.get(args.p_bucket) || { count: 0 };
        b.count += 1;
        buckets.set(args.p_bucket, b);
        return { data: b.count <= args.p_limit, error: null };
      }
      if (name === 'rate_limit_give_back') {
        const b = buckets.get(args.p_bucket);
        if (b && b.count > 0) b.count -= 1;
        return { data: null, error: null };
      }
      return { data: null, error: { code: '42883', message: 'no such function' } };
    },
  };
}

function fakeMail({ fail = null, throws = false } = {}) {
  const sent = [];
  return {
    sent,
    configured: () => true,
    async send(message, options) {
      if (throws) throw new Error('network down');
      if (fail) return { data: null, error: { name: fail, statusCode: 422 } };
      sent.push({ ...message, options });
      return { data: { id: `re_${sent.length}` }, error: null };
    },
  };
}

const student = (id, extra = {}) => ({ id, email: `${id}@example.com`, subjects: [], created_at: new Date(YESTERDAY).toISOString(), deleted_at: null, ...extra });
const depsFor = (db, mail = fakeMail(), extra = {}) => ({ store: createStudentMailStore(db, { env: {} }), mail, origin: ORIGIN, sleep: async () => {}, ...extra });

// ------------------------------------------------------------------------------------------------------------- the switch
test('the switch: unset or anything but "true" sends nothing and touches nothing', async () => {
  for (const value of [undefined, '', 'TRUE', '1', 'yes', 'false', ' true']) {
    const env = { ...ON, EMAILS_ENABLED: value };
    if (value === undefined) delete env.EMAILS_ENABLED;
    assert.equal(emailsEnabled(env), false, String(value));
    const db = memoryDb({ users: [student('u1')] });
    const mail = fakeMail();
    assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(db, mail), env, now: SIX_PM }), { sent: false, reason: 'off' });
    assert.deepEqual(await runDayTwo({ deps: depsFor(db, mail), env, now: SIX_PM }), { enabled: false, sent: 0 });
    assert.equal(mail.sent.length, 0);
    assert.equal(db.calls.length, 0, 'not even a read');
  }
  assert.equal(emailsEnabled(ON), true);
});

test('with the switch on: no secret, no provider or the migration not applied each send nothing', async () => {
  const db = memoryDb();
  const user = student('u1');
  assert.equal((await sendStudentEmail({ kind: 'welcome', user, deps: depsFor(db), env: { EMAILS_ENABLED: 'true' }, now: SIX_PM })).reason, 'no_secret');
  assert.equal((await sendStudentEmail({ kind: 'welcome', user, deps: depsFor(db, { configured: () => false, send: () => assert.fail('sent') }), env: ON, now: SIX_PM })).reason, 'no_provider');
  const missing = memoryDb({}, { missing: ['email_sends', 'email_optouts'] });
  const mail = fakeMail();
  assert.equal((await sendStudentEmail({ kind: 'welcome', user, deps: depsFor(missing, mail), env: ON, now: SIX_PM })).reason, 'not_set_up');
  assert.deepEqual(await runDayTwo({ deps: depsFor(missing, mail), env: ON, now: SIX_PM }), { enabled: true, skipped: 'not_set_up', sent: 0 });
  assert.equal(mail.sent.length, 0);
  assert.equal((await sendStudentEmail({ kind: 'welcome', user: { id: 'u1', email: 'not an address' }, deps: depsFor(db), env: ON, now: SIX_PM })).reason, 'no_address');
  assert.equal((await sendStudentEmail({ kind: 'weekly', user, deps: depsFor(db), env: ON, now: SIX_PM })).reason, 'unknown_kind');
});

// ------------------------------------------------------------------------------------------------------------ never twice
test('never twice: a second welcome, five at once, and two day-2 runs at once each send one email', async () => {
  const db = memoryDb({ users: [student('u1'), student('u2'), student('u3')] });
  const mail = fakeMail();
  const deps = depsFor(db, mail);
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps, env: ON, now: SIX_PM }), { sent: true });
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps, env: ON, now: SIX_PM }), { sent: false, reason: 'already_sent' });
  const burst = await Promise.all(Array.from({ length: 5 }, () => sendStudentEmail({ kind: 'welcome', user: student('u2'), deps, env: ON, now: SIX_PM })));
  assert.equal(burst.filter((r) => r.sent).length, 1);
  assert.equal(mail.sent.filter((m) => m.to === 'u2@example.com').length, 1);
  // A slot taken for a send that then found the email claimed is given back.
  assert.equal(db.buckets.get(dailySlotBucket(istDay(SIX_PM))).count, 2);

  const [a, b] = await Promise.all([runDayTwo({ deps, env: ON, now: SIX_PM }), runDayTwo({ deps, env: ON, now: SIX_PM })]);
  assert.equal(a.sent + b.sent, 3);
  for (const id of ['u1', 'u2', 'u3']) assert.equal(mail.sent.filter((m) => m.to === `${id}@example.com` && /yesterday/.test(m.text)).length, 1, id);
  assert.deepEqual(await runDayTwo({ deps, env: ON, now: SIX_PM + 60_000 }), { enabled: true, day: '2026-11-14', candidates: 0, sent: 0, skipped: {} });
  const rows = db.tables.email_sends;
  assert.equal(rows.length, 5, "two welcomes and three day-2 emails");
  assert.ok(rows.every((r) => r.sent_at && r.provider_id && r.claimed_at <= r.sent_at));
});

test('never twice across a crash: the claim is written before the send, so a claimed but unsent email is never sent', async () => {
  const db = memoryDb({ users: [student('u1')], email_sends: [{ user_id: 'u1', kind: 'welcome', claimed_at: new Date(SIX_PM - 1000).toISOString() }] });
  const mail = fakeMail();
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(db, mail), env: ON, now: SIX_PM }), { sent: false, reason: 'already_sent' });
  assert.equal(mail.sent.length, 0);
  // The order inside one send: claim (insert) before the provider is called.
  const order = [];
  const watched = memoryDb({ users: [student('u2')] });
  const store = createStudentMailStore(watched, { env: {} });
  const spy = { ...store, claim: async (...args) => { order.push('claim'); return store.claim(...args); } };
  await sendStudentEmail({ kind: 'welcome', user: student('u2'), deps: { ...depsFor(watched), store: spy, mail: { configured: () => true, send: async () => { order.push('send'); return { data: { id: 'x' } }; } } }, env: ON, now: SIX_PM });
  assert.deepEqual(order, ['claim', 'send']);
});

test('a failed or uncertain send is recorded and never retried; the provider gets a stable idempotency key', async () => {
  const db = memoryDb();
  const failing = fakeMail({ fail: 'validation_error' });
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(db, failing), env: ON, now: SIX_PM }), { sent: false, reason: 'send_failed' });
  assert.match(db.tables.email_sends[0].failure, /^provider:validation_error$/);
  const ok = fakeMail();
  assert.equal((await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(db, ok), env: ON, now: SIX_PM + 1 })).reason, 'already_sent');
  assert.equal(ok.sent.length, 0);
  const thrown = fakeMail({ throws: true });
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u2'), deps: depsFor(db, thrown), env: ON, now: SIX_PM }), { sent: false, reason: 'send_uncertain' });
  assert.match(db.tables.email_sends.find((r) => r.user_id === 'u2').failure, /^uncertain:/);
  await sendStudentEmail({ kind: 'welcome', user: student('u3'), deps: depsFor(db, ok), env: ON, now: SIX_PM });
  assert.equal(ok.sent[0].options.idempotencyKey, idempotencyKey('welcome', 'u3'));
  assert.equal(idempotencyKey('welcome', 'u3'), idempotencyKey('welcome', 'u3'));
  assert.notEqual(idempotencyKey('welcome', 'u3'), idempotencyKey('day2', 'u3'));
  assert.doesNotMatch(idempotencyKey('welcome', 'u3'), /u3/, 'no id in the provider key');
});

test('a database error before the claim sends nothing; after a successful send a failed record still reports it sent', async () => {
  const broken = memoryDb({}, { fail: (q) => q.name === 'email_optouts' && q.op === 'select' && q.f.length > 0 });
  const mail = fakeMail();
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(broken, mail), env: ON, now: SIX_PM }), { sent: false, reason: 'store_error' });
  assert.equal(mail.sent.length, 0);
  const late = memoryDb({}, { fail: (q) => q.name === 'email_sends' && q.op === 'update' });
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(late, mail), env: ON, now: SIX_PM }), { sent: true });
  assert.equal((await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(late, mail), env: ON, now: SIX_PM })).reason, 'already_sent');
  assert.equal(mail.sent.length, 1);
});

// --------------------------------------------------------------------------------------------------------------- the caps
test('EMAILS_DAILY_CAP: default 40, 0 sends none, a bad value is the default; the cap is per India day', async () => {
  assert.equal(EMAILS_DAILY_CAP_DEFAULT, 40);
  assert.equal(emailsDailyCap({}), 40);
  assert.equal(emailsDailyCap({ EMAILS_DAILY_CAP: '0' }), 0);
  assert.equal(emailsDailyCap({ EMAILS_DAILY_CAP: '12' }), 12);
  for (const bad of ['-1', 'ten', '4.5', '5000', '']) assert.equal(emailsDailyCap({ EMAILS_DAILY_CAP: bad }), 40, bad);

  const db = memoryDb();
  const mail = fakeMail();
  const env = { ...ON, EMAILS_DAILY_CAP: '2' };
  const results = [];
  for (const id of ['a', 'b', 'c']) results.push(await sendStudentEmail({ kind: 'welcome', user: student(id), deps: depsFor(db, mail), env, now: SIX_PM }));
  assert.deepEqual(results.map((r) => r.reason || 'sent'), ['sent', 'sent', 'cap']);
  assert.equal(db.tables.email_sends.length, 2, 'a capped email is not claimed, so it is not lost for good');
  // The next India day has its own cap (the day turns at 6:30 pm UTC).
  const nextDay = Date.parse('2026-11-15T18:31:00Z');
  assert.equal(istDay(nextDay), '2026-11-16');
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('c'), deps: depsFor(db, mail), env, now: nextDay }), { sent: true });
  assert.equal((await sendStudentEmail({ kind: 'welcome', user: student('d'), deps: depsFor(db, mail), env: { ...ON, EMAILS_DAILY_CAP: '0' }, now: nextDay })).reason, 'cap');
});

test('sign-in codes first: these emails stop while sign-in emails are near their daily ceiling', async () => {
  const now = SIX_PM;
  const live = new Date(now + 3_600_000).toISOString();
  // Ceiling 2000 (default), cap 40: room is kept for the larger of 40 and a fifth of 2000.
  assert.equal(signInRoom({ use: null, ceiling: 2000, cap: 40, now }).open, true);
  assert.equal(signInRoom({ use: { count: 1599, resetAt: live }, ceiling: 2000, cap: 40, now }).open, true);
  assert.equal(signInRoom({ use: { count: 1600, resetAt: live }, ceiling: 2000, cap: 40, now }).open, false);
  assert.equal(signInRoom({ use: { count: 1999, resetAt: new Date(now - 1).toISOString() }, ceiling: 2000, cap: 40, now }).open, true, 'a passed window counts as 0');
  assert.equal(signInRoom({ use: { count: 0, resetAt: live }, ceiling: 30, cap: 40, now }).open, false, 'a ceiling below the cap never leaves room');
  assert.equal(signInRoom({ use: { count: 59, resetAt: live }, ceiling: 100, cap: 40, now }).open, true);
  assert.equal(signInRoom({ use: { count: 60, resetAt: live }, ceiling: 100, cap: 40, now }).open, false);

  const db = memoryDb({ persistent_rate_limits: [{ bucket: signInCeilingBucket({}), count: 1700, reset_at: live }] });
  const mail = fakeMail();
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(db, mail), env: ON, now }), { sent: false, reason: 'sign_in_busy' });
  assert.equal(mail.sent.length, 0);
  assert.equal(db.buckets.size, 0, 'no slot of the cap was taken');
  assert.equal(db.tables.email_sends?.length || 0, 0);
  // AUTH_EMAIL_DAILY_CEILING moves the line.
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(db, mail), env: { ...ON, AUTH_EMAIL_DAILY_CEILING: '5000' }, now }), { sent: true });
  // A failed read of the sign-in count sends nothing.
  const blind = memoryDb({}, { fail: (q) => q.name === 'persistent_rate_limits' });
  assert.equal((await sendStudentEmail({ kind: 'welcome', user: student('u9'), deps: depsFor(blind, mail), env: ON, now })).reason, 'store_error');
});

// ------------------------------------------------------------------------------------------------------------ unsubscribe
test('the unsubscribe signature: one student, one secret, constant shape; tampering fails', () => {
  const token = unsubscribeToken('user-1', 's1');
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(verifyUnsubscribe('user-1', token, 's1'), true);
  assert.equal(verifyUnsubscribe('user-2', token, 's1'), false, 'another student');
  assert.equal(verifyUnsubscribe('user-1', token, 's2'), false, 'another secret');
  assert.equal(verifyUnsubscribe('user-1', `${token.slice(0, 31)}${token[31] === 'A' ? 'B' : 'A'}`, 's1'), false);
  assert.equal(verifyUnsubscribe('user-1', token.slice(0, 31), 's1'), false);
  assert.equal(verifyUnsubscribe('user-1', token, ''), false, 'no secret, nothing verifies');
  assert.equal(unsubscribeToken('user-1', ''), null);
  assert.equal(verifyUnsubscribe('', token, 's1'), false);
  assert.equal(verifyUnsubscribe('a\nb', unsubscribeToken('a\nb', 's1') || '', 's1'), false);
  const url = unsubscribeUrl(`${ORIGIN}/`, 'user 1', 's1');
  assert.equal(url, `${ORIGIN}/api/email/unsubscribe?u=user%201&t=${unsubscribeToken('user 1', 's1')}`);
  const parsed = new URL(url);
  assert.equal(verifyUnsubscribe(parsed.searchParams.get('u'), parsed.searchParams.get('t'), 's1'), true);
  assert.deepEqual(unsubscribeHeaders(url), { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
});

test('every email carries the one-click headers and the signed link; an unsubscribed student never gets either email', async () => {
  const db = memoryDb({ users: [student('u1'), student('u2')] });
  const mail = fakeMail();
  await sendStudentEmail({ kind: 'welcome', user: student('u1'), deps: depsFor(db, mail), env: ON, now: SIX_PM });
  const [sentMail] = mail.sent;
  const link = sentMail.headers['List-Unsubscribe'].slice(1, -1);
  assert.equal(sentMail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(new URL(link).origin, ORIGIN);
  assert.equal(verifyUnsubscribe(new URL(link).searchParams.get('u'), new URL(link).searchParams.get('t'), ON.NEXTAUTH_SECRET), true);
  assert.ok(sentMail.html.includes(link.replace(/&/g, '&amp;')), 'the link is in the HTML');
  assert.ok(sentMail.text.includes(link), 'and in the text part');

  const store = createStudentMailStore(db, { env: {} });
  await store.optOut('u2');
  await store.optOut('u2'); // idempotent
  assert.equal(db.tables.email_optouts.length, 1);
  assert.deepEqual(await sendStudentEmail({ kind: 'welcome', user: student('u2'), deps: depsFor(db, mail), env: ON, now: SIX_PM }), { sent: false, reason: 'unsubscribed' });
  const run = await runDayTwo({ deps: depsFor(db, mail), env: ON, now: SIX_PM });
  assert.equal(run.sent, 1, 'u1 only');
  assert.equal(mail.sent.filter((m) => m.to === 'u2@example.com').length, 0);
});

// ----------------------------------------------------------------------------------------------------- the day-2 selection
test('the day-2 window: yesterday in India, today from midnight India time, and only 5:00 pm to 9:00 pm', () => {
  const w = dayTwoWindow(SIX_PM);
  assert.equal(w.today, '2026-11-15');
  assert.equal(w.yesterday, '2026-11-14');
  assert.equal(new Date(w.startToday).toISOString(), '2026-11-14T18:30:00.000Z');
  assert.equal(w.startToday - w.startYesterday, DAY_MS);
  assert.equal(w.hour, 18);
  assert.equal(w.inHours, true);
  assert.equal(istDayStart('2026-11-15'), w.startToday);
  // The Hobby cron fires anywhere in its hour: 12:00 to 12:59 UTC is 5:30 to 6:29 pm India time.
  assert.equal(dayTwoWindow(Date.parse('2026-11-15T12:00:00Z')).inHours, true);
  assert.equal(dayTwoWindow(Date.parse('2026-11-15T13:29:00Z')).inHours, true);
  assert.equal(dayTwoWindow(Date.parse('2026-11-15T11:29:00Z')).inHours, false, '4:59 pm');
  assert.equal(dayTwoWindow(Date.parse('2026-11-15T15:30:00Z')).inHours, false, '9:00 pm');
  assert.equal(dayTwoWindow(Date.parse('2026-11-14T20:30:00Z')).inHours, false, '2:00 am');
});

test('the day-2 job never sends outside 5:00 pm to 9:00 pm India time, whoever calls it', async () => {
  const db = memoryDb({ users: [student('u1')] });
  const mail = fakeMail();
  const night = await runDayTwo({ deps: depsFor(db, mail), env: ON, now: Date.parse('2026-11-14T20:30:00Z') });
  assert.equal(night.skipped, 'outside_hours');
  assert.equal(mail.sent.length, 0);
  assert.equal(db.calls.length, 0);
});

test('answered since: any answered question, progress row or repair today; a blank paper or yesterday does not count', () => {
  const since = Date.parse('2026-11-14T18:30:00Z');
  const today = '2026-11-15T05:00:00Z';
  const before = '2026-11-14T18:29:59Z';
  assert.equal(answeredSince({}, since), false);
  assert.equal(answeredSince({ attempts: [{ completed_at: today, correct: 0, wrong: 1 }] }, since), true);
  assert.equal(answeredSince({ attempts: [{ completed_at: today, correct: 0, wrong: 0 }] }, since), false, 'a paper submitted blank');
  assert.equal(answeredSince({ attempts: [{ completed_at: before, correct: 9, wrong: 1 }] }, since), false, 'yesterday');
  assert.equal(answeredSince({ progress: [{ last_attempted_at: today }] }, since), true);
  assert.equal(answeredSince({ repairs: [{ updated_at: today }] }, since), true);
  assert.equal(answeredSince({ repairs: [{ updated_at: 'not a date' }] }, since), false);
});

test('pickDayTwo: a real address, not unsubscribed, not sent, no pending deletion, oldest sign-up first', () => {
  const users = [
    student('late', { created_at: '2026-11-14T15:00:00Z' }), student('early', { created_at: '2026-11-13T19:00:00Z' }),
    student('noaddr', { email: null }), student('gone', { deleted_at: '2026-11-15T00:00:00Z' }),
    student('out'), student('done'), student('leaving'),
  ];
  const picked = pickDayTwo({ users, optedOut: new Set(['out']), sent: new Set(['done']), pendingDeletion: new Set(['leaving']) });
  assert.deepEqual(picked.map((u) => u.id), ['early', 'late']);
});

test('dayTwoState: the first set, the newest set with questions still open (repaired ones left out), or today\'s set', () => {
  assert.deepEqual(dayTwoState({ attempts: [] }), { kind: 'first' });
  const older = { id: 'a1', subject: 'economics', completed_at: '2026-11-14T08:00:00Z', details: [{ qid: 'q1', isCorrect: false }] };
  const newer = { id: 'a2', subject: 'accountancy', completed_at: '2026-11-14T10:00:00Z', details: [{ qid: 'q1', isCorrect: true }, { qid: 'q2', isCorrect: true }, { qid: 'q3', isCorrect: false }, { qid: 'q4', isCorrect: null }, { qid: 'q5', isCorrect: false }] };
  assert.deepEqual(dayTwoState({ attempts: [older, newer] }), { kind: 'repair', attemptId: 'a2', subject: 'accountancy', open: 3, position: 3 });
  const repaired = new Set([mistakeKey('u1', 'a2', 'q3')]);
  const isRepaired = (attemptId, qid) => repaired.has(mistakeKey('u1', attemptId, qid));
  assert.deepEqual(dayTwoState({ attempts: [older, newer], isRepaired }), { kind: 'repair', attemptId: 'a2', subject: 'accountancy', open: 2, position: 4 });
  const allRepaired = (attemptId) => attemptId === 'a2';
  assert.deepEqual(dayTwoState({ attempts: [newer, older], isRepaired: allRepaired }), { kind: 'repair', attemptId: 'a1', subject: 'economics', open: 1, position: 1 });
  assert.deepEqual(dayTwoState({ attempts: [newer, older], isRepaired: () => true }), { kind: 'next', subject: 'accountancy' });
});

test('the day-2 job end to end: who gets it, and each one\'s single action from their own record', async () => {
  const startToday = Date.parse('2026-11-14T18:30:00Z');
  const at = (ms) => new Date(ms).toISOString();
  const db = memoryDb({
    users: [
      student('never', { subjects: ['accountancy'] }),
      student('mistakes'),
      student('perfect'),
      student('back'),
      student('progress'),
      student('older', { created_at: '2026-11-13T12:00:00Z' }), // 13 Nov, 5:30 pm India time: two days ago
      student('today', { created_at: at(startToday + 3_600_000) }),
      student('leaving'),
    ],
    attempts: [
      { id: 'm1', user_id: 'mistakes', subject: 'accountancy', completed_at: at(YESTERDAY), correct: 7, wrong: 3, details: [{ qid: 'a', isCorrect: true }, { qid: 'b', isCorrect: false }, { qid: 'c', isCorrect: false }] },
      { id: 'p1', user_id: 'perfect', subject: 'economics', completed_at: at(YESTERDAY), correct: 2, wrong: 0, details: [{ qid: 'a', isCorrect: true }, { qid: 'b', isCorrect: true }] },
      { id: 'b1', user_id: 'back', subject: 'economics', completed_at: at(startToday + 1000), correct: 1, wrong: 0, details: [{ qid: 'a', isCorrect: true }] },
    ],
    user_question_progress: [{ user_id: 'progress', question_id: 'x', last_attempted_at: at(startToday + 5000) }],
    ai_credit_reservations: [{ user_id: 'mistakes', state: 'committed', action: 'score_recovery_repair', operation_key: `repair:${mistakeKey('mistakes', 'm1', 'b')}:r1`, receipt: { repair: {} }, updated_at: at(YESTERDAY + 1000) }],
    account_deletion_requests: [{ user_id: 'leaving', status: 'pending' }],
  });
  const mail = fakeMail();
  const slept = [];
  const result = await runDayTwo({ deps: depsFor(db, mail, { sleep: async (ms) => { slept.push(ms); } }), env: ON, now: SIX_PM });
  assert.deepEqual(result, { enabled: true, day: '2026-11-14', candidates: 5, sent: 3, skipped: { came_back: 2 } });
  assert.deepEqual(slept, [DAY2_SPACING_MS, DAY2_SPACING_MS, DAY2_SPACING_MS], 'a gap after each send leaves the provider room for sign-in codes');
  const to = (id) => mail.sent.find((m) => m.to === `${id}@example.com`);
  assert.deepEqual(mail.sent.map((m) => m.to.split('@')[0]).sort(), ['mistakes', 'never', 'perfect']);
  assert.equal(to('never').subject, 'Your first set is ready when you are');
  assert.ok(to('never').text.includes(`${ORIGIN}/dashboard?subject=accountancy&mode=quick&count=10`));
  assert.match(to('never').text, /Start 10 Accountancy questions/);
  // b was repaired yesterday: one question is still open, at number 3 on the paper.
  assert.equal(to('mistakes').subject, '1 question from yesterday to fix');
  assert.ok(to('mistakes').text.includes(`${ORIGIN}/result/m1?q=3`));
  assert.match(to('mistakes').text, /Your Accountancy set yesterday left 1 question wrong or blank/);
  assert.equal(to('perfect').subject, 'Ready for today’s set?');
  assert.ok(to('perfect').text.includes(`${ORIGIN}/dashboard?subject=economics&mode=quick&count=10`));
  assert.equal(db.tables.email_sends.filter((r) => r.kind === 'day2').length, 3);
});

test('the day-2 job stops at the cap and when sign-in codes need the room, and keeps to its time budget', async () => {
  const users = ['a', 'b', 'c', 'd'].map((id) => student(id));
  const capped = memoryDb({ users: [...users] });
  const mail = fakeMail();
  const r1 = await runDayTwo({ deps: depsFor(capped, mail), env: { ...ON, EMAILS_DAILY_CAP: '2' }, now: SIX_PM });
  assert.deepEqual([r1.sent, r1.stopped, r1.skipped], [2, 'cap', { cap: 1 }]);
  const busy = memoryDb({ users: [...users], persistent_rate_limits: [{ bucket: signInCeilingBucket({}), count: 1900, reset_at: new Date(SIX_PM + 60_000).toISOString() }] });
  const r2 = await runDayTwo({ deps: depsFor(busy, mail), env: ON, now: SIX_PM });
  assert.deepEqual([r2.sent, r2.stopped], [0, 'sign_in_busy']);
  let t = 0;
  const slow = memoryDb({ users: [...users] });
  const r3 = await runDayTwo({ deps: depsFor(slow, fakeMail(), { clock: () => t, sleep: async () => { t += 30_000; } }), env: ON, now: SIX_PM });
  assert.deepEqual([r3.sent, r3.stopped], [2, 'time']);
});

// ---------------------------------------------------------------------------------------------------------------- the words
const visible = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');
const SAMPLES = [
  ['welcome', {}],
  ['day2', { kind: 'first' }],
  ['day2', { kind: 'first', subject: 'accountancy', subjectName: 'Accountancy' }],
  ['day2', { kind: 'repair', attemptId: 'a b', open: 4, position: 2, subjectName: 'Accountancy' }],
  ['day2', { kind: 'repair', attemptId: 'a1', open: 1, position: 7 }],
  ['day2', { kind: 'next', subject: 'economics', subjectName: 'Economics' }],
];

test('the words: plain and short, sentence case, no exclamation marks, emoji, arrows or middle dots, one button', () => {
  const unsubscribe = unsubscribeUrl(ORIGIN, 'u1', 's');
  for (const [kind, state] of SAMPLES) {
    const w = studentEmailWords(kind, state);
    const mail = buildStudentEmail({ kind, state, origin: ORIGIN, unsubscribe });
    const words = [w.subject, w.preheader, w.heading, ...w.paras, w.button, w.note, w.why].join(' ');
    assert.doesNotMatch(words, /[!→←↗➜»·•]|\p{Extended_Pictographic}/u, `${kind} ${state.kind}`);
    assert.match(w.subject, /^[A-Z0-9]/);
    assert.doesNotMatch(w.subject.slice(1), /\b(?!MockMob|CUET|Accountancy|Economics)[A-Z][a-z]+/, 'sentence case');
    assert.ok(w.subject.length <= 50, w.subject);
    assert.ok(words.split(/\s+/).length < 110, 'short');
    assert.equal((mail.html.match(/class="em-btn"/g) || []).length, 1, 'one button');
    assert.ok(mail.html.includes(`href="${ORIGIN}${w.path.replace(/&/g, '&amp;')}"`), 'the button is an absolute link');
    assert.ok(mail.text.includes(`${ORIGIN}${w.path}`));
    assert.match(visible(mail.html), /This email is from MockMob, www\.mockmob\.in\./, 'who it is from');
    assert.match(visible(mail.html), /You are getting this because/, 'why they got it');
    assert.match(visible(mail.html), /Turn off these emails ?\. Sign-in codes still come when you ask for one\./);
    assert.match(mail.html, /<meta name="color-scheme" content="light dark" \/>/);
    assert.match(mail.html, /@media \(prefers-color-scheme: dark\)/);
  }
  assert.equal(studentEmailWords('welcome').path, FIRST_SET_HREF);
  assert.equal(studentEmailWords('welcome').button, 'Start 10 questions');
  assert.equal(studentEmailWords('day2', SAMPLES[3][1]).path, '/result/a%20b?q=2');
  assert.equal(studentEmailWords('day2', SAMPLES[3][1]).subject, '4 questions from yesterday to fix');
  assert.equal(studentEmailWords('day2', SAMPLES[4][1]).button, 'Go over your mistake');
  assert.throws(() => studentEmailWords('weekly'));
});

test('the HTML escapes what it is given', () => {
  const mail = buildStudentEmail({ kind: 'day2', state: { kind: 'repair', attemptId: 'x', open: 2, position: 1, subjectName: '<b>Acc</b>' }, origin: ORIGIN, unsubscribe: `${ORIGIN}/api/email/unsubscribe?u=1&t="x"` });
  assert.doesNotMatch(mail.html, /<b>Acc<\/b>/);
  assert.match(mail.html, /&lt;b&gt;Acc&lt;\/b&gt;/);
  assert.match(mail.html, /t=&quot;x&quot;/);
});

test('the unsubscribe page: done, a bad link with a way out, and an error with Try again', () => {
  const done = visible(unsubscribePage('done'));
  assert.match(done, /These emails are off/);
  assert.match(done, /Sign-in codes still come when you ask for one\./);
  const bad = visible(unsubscribePage('invalid'));
  assert.match(bad, /This link did not work/);
  assert.match(bad, /support@mockmob\.in/);
  const error = unsubscribePage('error', { retry: `${ORIGIN}/api/email/unsubscribe?u=1&t=2` });
  assert.match(error, /We could not turn these emails off just now/);
  assert.match(error, /href="https:\/\/www\.mockmob\.in\/api\/email\/unsubscribe\?u=1&amp;t=2"[^>]*>Try again</);
  for (const page of [done, bad, visible(error)]) assert.doesNotMatch(page, /!/);
  assert.match(unsubscribePage('done'), /<meta name="robots" content="noindex" \/>/);
});
