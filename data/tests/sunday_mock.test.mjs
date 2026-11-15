// The Sunday Mock's server (src/lib/server/sunday/service.js, store.js, http.js) on in-memory fakes: the claim rows on the
// in-memory Supabase client (it keeps learning_allowances' primary key), the attempts and the practice engine as small fakes.
// Proves: the free start opens only this week's Sunday paper (never another, whatever the request says), only inside the
// window, once a student, subject and Sunday; the same paper for everyone, even when two first starts race; a late send is
// never counted; the 30-sitter floor; the den's privacy; and the route's codes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { createSundayStore } from '../../src/lib/server/sunday/store.js';
import { createSundayService, sundayGenerationKey, SundayError } from '../../src/lib/server/sunday/service.js';
import { handleSunday } from '../../src/lib/server/sunday/http.js';
import { PAPER_COUNT, SUNDAY_KIND, SUNDAY_TAG, claimPeriod, parseClaim, sundayWindow } from '../../src/lib/sundayMock.mjs';
import { practiceCharge } from '../practice_charge.js';
import { firstFullMockApplies } from '../first_full_mock.js';

const IST = (s) => Date.parse(`${s}+05:30`);
const MIN = 60_000;
const WEEK = '2026-11-22';
const OPEN = IST('2026-11-22T10:00:00');
const SECRET = 'test-secret';
const ids = (p, n = PAPER_COUNT) => Array.from({ length: n }, (_, i) => `${p}${String(i).padStart(3, '0')}`);
const SUBJECTS = { accountancy: 'Accountancy', economics: 'Economics', english: 'English' };
const subjectInfo = (raw) => (typeof raw === 'string' && SUBJECTS[raw] ? { ok: true, id: raw, publicId: raw, name: SUBJECTS[raw] } : { ok: false });

/** A world: the clock, the claim rows on the in-memory client, sent attempts, the bank and a practice engine that keeps one session per key. */
function world({ at = OPEN, users = { u1: ['accountancy'], u2: ['accountancy'], u3: ['accountancy', 'economics'] }, bank = ids('a') } = {}) {
  const clock = { t: at };
  const db = fakeDb({}, { now: () => clock.t });
  const attempts = []; // { id, userId, subject, week, correct, wrong, unattempted, total, completedAt, details }
  const state = { bank, withdrawn: new Set(), picks: 0, pickCounts: [], starts: [], sessions: new Map() };
  const base = createSundayStore(db);
  const store = {
    ...base,
    findMine: async (userId, since) => attempts.filter((a) => a.userId === userId && a.completedAt >= since),
    countSat: async (week, subject) => attempts.filter((a) => a.week === week && a.subject === subject).length,
    findSittings: async (week, subject) => attempts.filter((a) => a.week === week && a.subject === subject),
    mobMembers: async (mobId) => (mobId === MOB ? { subject: 'accountancy', members: [
      { userId: 'u1', name: 'Asha', colour: 1, showScore: true },
      { userId: 'u2', name: 'Kabir', colour: 2, showScore: false },
      { userId: 'u3', name: 'Meera', colour: 3, showScore: true },
      { userId: 'u4', name: 'Ravi', colour: 4, showScore: true },
    ] } : null),
    membersSittings: async (userIds, week, subject) => attempts.filter((a) => userIds.includes(a.userId) && a.week === week && a.subject === subject),
  };
  const deps = {
    now: () => clock.t, secret: SECRET, store, subjectInfo,
    loadUser: async (id) => (users[id] ? { subjects: users[id] } : null),
    pickPaper: async (subject, week, { exclude = [], count = PAPER_COUNT } = {}) => {
      state.picks += 1;
      state.pickCounts.push(count);
      return state.bank.filter((id) => !exclude.includes(id)).slice(0, count);
    },
    loadQuestions: async (list) => list.filter((id) => !state.withdrawn.has(id)).map((id) => ({ id, stem: `Q ${id}`, correctIndex: 0, options: ['a', 'b', 'c', 'd'] })),
    serve: (q) => ({ ...q, served: true }),
    // The engine: one session per generation key; a sent one answers SESSION_ALREADY_SUBMITTED, one past its deadline SESSION_EXPIRED.
    startPractice: async (userId, input, server) => {
      state.starts.push({ userId, input: JSON.parse(JSON.stringify(input)), server: JSON.parse(JSON.stringify(server)) });
      const s = state.sessions.get(input.generationKey) || { startedAt: clock.t, sent: false, id: `att_${state.sessions.size + 1}` };
      state.sessions.set(input.generationKey, s);
      if (s.sent) throw Object.assign(new Error('SESSION_ALREADY_SUBMITTED'), { publicDetail: { attemptId: s.id } });
      if (clock.t > s.startedAt + 62 * MIN) throw new Error('SESSION_EXPIRED');
      return { sessionId: s.id, questions: server.mobPaper.questions, startedAt: new Date(s.startedAt).toISOString() };
    },
  };
  const send = (userId, subject, { correct = 30, wrong = 10, total = 50, at: when = clock.t } = {}) => {
    const key = sundayGenerationKey(SECRET, userId, WEEK, subject);
    const s = state.sessions.get(key);
    s.sent = true;
    attempts.push({ id: s.id, userId, subject, week: WEEK, correct, wrong, unattempted: total - correct - wrong, total, completedAt: when, details: [] });
  };
  return { clock, db, attempts, state, deps, store, service: createSundayService(deps), send };
}
const MOB = '6f0a0a2c-1111-4111-8111-111111111111';
const claimsOf = (db) => (db.tables.learning_allowances || []).filter((r) => r.kind === SUNDAY_KIND);
const rejects = (p, code) => assert.rejects(p, (e) => e instanceof SundayError && e.code === code);

test('the free start opens this week\'s Sunday paper and nothing else, whatever the request asks for', async () => {
  const w = world();
  await w.service.start('u1', {
    subject: 'accountancy', mode: 'quick', count: 5, chapters: 'Goodwill', difficulty: 'easy', generationKey: 'mine-chosen-key-123', week: '2026-11-29',
    mobPaper: { mobId: 'x', weekStart: '2026-11-16', questions: [{ id: 'evil' }] }, questions: [{ id: 'evil' }], gameId: 'g', creditAction: 'attempt_full',
  });
  assert.equal(w.state.starts.length, 1);
  const { input, server } = w.state.starts[0];
  assert.deepEqual(input, { experience: 'practice', mode: 'full', count: PAPER_COUNT, subject: 'accountancy', generationKey: sundayGenerationKey(SECRET, 'u1', WEEK, 'accountancy') });
  assert.deepEqual(Object.keys(server), ['mobPaper']);
  assert.deepEqual(Object.keys(server.mobPaper).sort(), ['holdUntil', 'mobId', 'questions', 'weekStart']);
  assert.equal(server.mobPaper.mobId, SUNDAY_TAG);
  assert.equal(server.mobPaper.weekStart, WEEK);
  assert.equal(server.mobPaper.holdUntil, '2026-11-22T17:35:00.000Z', 'held until 11:05 PM IST');
  assert.deepEqual(server.mobPaper.questions.map((q) => q.id), ids('a'));
  assert.ok(server.mobPaper.questions.every((q) => q.served), 'served in the stable option order');
  // The engine's charge for exactly this start: nothing, for Free and Pro; never the free first full mock.
  for (const isPremium of [false, true]) {
    assert.deepEqual(practiceCharge({ isPremium, mobPaper: server.mobPaper, modeId: 'full', creditAction: 'attempt_full', count: 50, subject: 'accountancy', firstFullMock: 'available' }), { creditAction: null, quota: null });
  }
  assert.equal(firstFullMockApplies({ isPremium: false, modeId: 'full', mobPaper: server.mobPaper }), false);
  // The start receipt is the only other thing a request may carry.
  await w.service.start('u1', { subject: 'accountancy', startReceipt: 'r'.repeat(40) });
  assert.equal(w.state.starts[1].input.startReceipt, 'r'.repeat(40));
  await w.service.start('u1', { subject: 'accountancy', startReceipt: 'r'.repeat(2001) });
  assert.equal('startReceipt' in w.state.starts[2].input, false);
});

test('the free path is reachable only from the server: POST /api/sessions never passes the engine a server argument', () => {
  const route = readFileSync(new URL('../../src/app/api/sessions/route.js', import.meta.url), 'utf8');
  assert.match(route, /startPractice\(userId, body\)/);
  assert.doesNotMatch(route, /startPractice\([^)]*,[^)]*,/);
  // Every caller that passes the third argument is a server module: the Mob and the Sunday Mock.
  const callers = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
      if (!/\.(js|jsx|mjs|ts)$/.test(name) || /\.test\./.test(name)) continue;
      if (/startPractice\([^()]*,[^()]*,\s*\{\s*mobPaper/.test(readFileSync(p, 'utf8'))) callers.push(p.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'));
    }
  };
  walk(fileURLToPath(new URL('../../src', import.meta.url)));
  assert.deepEqual(callers.filter((p) => !p.startsWith('src/lib/server/mob/')), ['src/lib/server/sunday/service.js']);
});

test('a first start only inside Sunday 10:00 AM to 9:59 PM IST; refused starts read no paper and write nothing', async () => {
  for (const [at, code] of [['2026-11-21T23:59:59', 'NOT_OPEN'], ['2026-11-22T09:59:59', 'NOT_OPEN'], ['2026-11-22T22:00:00', 'CLOSED'], ['2026-11-23T11:00:00', 'NOT_OPEN']]) {
    const w = world({ at: IST(at) });
    await rejects(w.service.start('u1', { subject: 'accountancy' }), code);
    assert.equal(w.state.picks, 0);
    assert.equal(w.state.starts.length, 0);
    assert.equal(claimsOf(w.db).length, 0);
  }
  const w = world({ at: IST('2026-11-22T21:59:59') });
  await w.service.start('u1', { subject: 'accountancy' });
  assert.equal(w.state.starts.length, 1);
  // The last start keeps its full 60 minutes (the engine keeps the deadline): a send at 10:59 PM is inside the window's last minute.
  assert.equal(sundayWindow(WEEK).lastFinishAt >= IST('2026-11-22T21:59:59') + 60 * MIN, true);
});

test('only the student\'s own subjects, and only real subjects', async () => {
  const w = world();
  await rejects(w.service.start('u1', { subject: 'economics' }), 'NOT_YOUR_SUBJECT');
  await rejects(w.service.start('u1', { subject: 'physics_made_up' }), 'SUBJECT_NOT_SUPPORTED');
  await rejects(w.service.start('u1', { subject: { $ne: 1 } }), 'SUBJECT_NOT_SUPPORTED');
  await rejects(w.service.start('u1', null), 'BODY_INVALID');
  await rejects(w.service.start('nobody', { subject: 'accountancy' }), 'NOT_YOUR_SUBJECT');
  assert.equal(w.state.starts.length, 0);
});

test('one sitting a student, subject and Sunday: the same session every time, refused once sent, and no fresh hour after the time is up', async () => {
  const w = world();
  await w.service.start('u1', { subject: 'accountancy' });
  w.clock.t += 20 * MIN;
  await w.service.start('u1', { subject: 'accountancy' }); // a second device: the same session, its first clock
  const keys = new Set(w.state.starts.map((s) => s.input.generationKey));
  assert.equal(keys.size, 1);
  assert.equal(claimsOf(w.db).length, 1);
  assert.equal(parseClaim(claimsOf(w.db)[0].reference).startedAt, OPEN);
  w.send('u1', 'accountancy');
  const sent = await w.service.start('u1', { subject: 'accountancy' }).catch((e) => e);
  assert.equal(sent.code, 'SESSION_ALREADY_SUBMITTED');
  assert.equal(sent.status, 409);
  assert.deepEqual(sent.detail, { attemptId: 'att_1' });
  assert.equal(claimsOf(w.db).length, 1, 'the claim stays');
  // u2 starts at 9:00 PM and leaves it: after 10:00 PM it resumes until its own deadline, then never again.
  w.clock.t = IST('2026-11-22T21:00:00');
  await w.service.start('u2', { subject: 'accountancy' });
  w.clock.t = IST('2026-11-22T22:01:00');
  await w.service.start('u2', { subject: 'accountancy' });
  w.clock.t = IST('2026-11-22T22:03:00');
  await rejects(w.service.start('u2', { subject: 'accountancy' }), 'PAPER_EXPIRED');
  assert.equal(claimsOf(w.db).filter((r) => r.user_id === 'u2').length, 1, 'an expired sitting keeps its claim');
  // Someone with no start is refused after the close.
  await rejects(w.service.start('u3', { subject: 'accountancy' }), 'CLOSED');
  // Another subject is its own sitting with its own key; another week its own key too.
  w.clock.t = IST('2026-11-22T21:10:00');
  await w.service.start('u3', { subject: 'economics' });
  const k = (u, s, wk = WEEK) => sundayGenerationKey(SECRET, u, wk, s);
  assert.notEqual(k('u3', 'economics'), k('u3', 'accountancy'));
  assert.notEqual(k('u1', 'accountancy'), k('u2', 'accountancy'));
  assert.notEqual(k('u1', 'accountancy'), k('u1', 'accountancy', '2026-11-29'));
  assert.notEqual(sundayGenerationKey('other', 'u1', WEEK, 'accountancy'), k('u1', 'accountancy'));
  assert.match(k('u1', 'accountancy'), /^[a-zA-Z0-9_-]{12,100}$/, 'a key the practice engine accepts');
});

test('the same paper for everyone all day, even after the bank moves and on a server that never saw it', async () => {
  const w = world();
  await w.service.start('u1', { subject: 'accountancy' });
  w.state.bank = ids('b'); // new questions published, votes moved the order
  w.clock.t = IST('2026-11-22T15:00:00');
  await w.service.start('u2', { subject: 'accountancy' });
  const cold = createSundayService(w.deps);
  await cold.start('u3', { subject: 'accountancy' });
  const papers = w.state.starts.map((s) => s.server.mobPaper.questions.map((q) => q.id).join());
  assert.equal(new Set(papers).size, 1);
  assert.equal(papers[0], ids('a').join());
  assert.equal(w.state.picks, 1, 'the bank was drawn once, by the first start');
  assert.ok(claimsOf(w.db).every((r) => parseClaim(r.reference).ids.join() === ids('a').join()), 'every sitter keeps a copy of the paper');
});

test('two first starts at the same moment: the later one serves the earliest row\'s paper', async () => {
  const w = world();
  await w.service.start('u1', { subject: 'accountancy' }); // u1 froze paper a
  // u2's server read no paper (the race) and drew paper b from a moved bank.
  w.state.bank = ids('b');
  let reads = 0;
  const racing = createSundayService({ ...w.deps, store: { ...w.store, readPaper: async (p) => (reads++ === 0 ? null : w.store.readPaper(p)) } });
  w.clock.t += 1000;
  await racing.start('u2', { subject: 'accountancy' });
  const last = w.state.starts.at(-1);
  assert.deepEqual(last.server.mobPaper.questions.map((q) => q.id), ids('a'));
  const u2 = claimsOf(w.db).find((r) => r.user_id === 'u2');
  assert.deepEqual(parseClaim(u2.reference).ids, ids('a'), 'its row now holds the week\'s paper');
});

test('a withdrawn question is replaced from the bank while 45 of 50 still serve; a thin bank or a failed start leaves no row', async () => {
  const w = world({ bank: [...ids('a'), ...ids('z', 10)], users: { u1: ['accountancy'], u2: ['accountancy'], u3: ['accountancy'], u4: ['accountancy'] } });
  w.state.bank = ids('a'); // the first draw is 50 questions
  await w.service.start('u1', { subject: 'accountancy' });
  w.state.withdrawn = new Set(ids('a').slice(0, 3));
  w.state.bank = [...ids('a'), ...ids('z', 10)];
  w.clock.t += 60_000;
  await w.service.start('u2', { subject: 'accountancy' });
  const served = w.state.starts.at(-1).server.mobPaper.questions.map((q) => q.id);
  assert.equal(served.length, PAPER_COUNT);
  assert.deepEqual(served.slice(0, 47), ids('a').slice(3));
  assert.deepEqual(served.slice(47), ids('z', 3));
  assert.deepEqual(w.state.pickCounts, [PAPER_COUNT, 3], 'the replacement draw asks only for the 3 missing');
  // The next start meets the same withdrawn questions: the same replacements, from memory, with no new draw.
  w.state.bank = [...ids('a'), ...ids('y', 10)];
  await w.service.start('u3', { subject: 'accountancy' });
  assert.deepEqual(w.state.starts.at(-1).server.mobPaper.questions.map((q) => q.id), served);
  assert.equal(w.state.picks, 2);
  // One more withdrawn: a new draw for the 4 now missing (u3 resumes its sitting).
  w.state.withdrawn = new Set(ids('a').slice(0, 4));
  await w.service.start('u3', { subject: 'accountancy' });
  assert.deepEqual(w.state.pickCounts, [PAPER_COUNT, 3, 4]);
  assert.deepEqual(w.state.starts.at(-1).server.mobPaper.questions.map((q) => q.id).slice(46), ids('y', 4));
  w.state.bank = [...ids('a'), ...ids('z', 10)];
  w.state.withdrawn = new Set(ids('a').slice(0, 6));
  await rejects(w.service.start('u4', { subject: 'accountancy' }), 'PAPER_UNAVAILABLE');
  assert.equal(claimsOf(w.db).filter((r) => r.user_id === 'u4').length, 0, 'nothing kept for a paper never served');
  const thin = world({ bank: ids('a', 49) });
  await rejects(thin.service.start('u1', { subject: 'accountancy' }), 'PAPER_UNAVAILABLE');
  assert.equal(claimsOf(thin.db).length, 0);
  const broken = world();
  broken.deps.startPractice = async () => { throw new Error('SESSION_CREATE_FAILED'); };
  await rejects(createSundayService(broken.deps).start('u1', { subject: 'accountancy' }), 'UNAVAILABLE');
  assert.equal(claimsOf(broken.db).length, 0);
});

test('the counts open at 11:05 PM, when the last paper is in; a late send is not counted; the share per question needs 30 sitters', async () => {
  const w = world();
  await rejects(w.service.stats('u1', { week: WEEK, subject: 'accountancy' }), 'NOT_CLOSED');
  await rejects(w.service.stats('u1', { week: '2026-11-23', subject: 'accountancy' }), 'BODY_INVALID');
  const win = sundayWindow(WEEK);
  for (let i = 0; i < 29; i += 1) w.attempts.push({ userId: `s${i}`, week: WEEK, subject: 'accountancy', completedAt: win.opensAt + i * MIN, details: [{ qid: 'q1', isCorrect: i < 10 }] });
  // A paper started at 9:59 PM and sent at 10:59 PM counts; a send past the last legal minute does not.
  w.attempts.push({ userId: 's29', week: WEEK, subject: 'accountancy', completedAt: IST('2026-11-22T22:59:00'), details: [{ qid: 'q1', isCorrect: true }] });
  w.attempts.push({ userId: 'late', week: WEEK, subject: 'accountancy', completedAt: win.lastFinishAt + 1, details: [{ qid: 'q1', isCorrect: true }] });
  for (const s of ['2026-11-22T22:00:00', '2026-11-22T22:59:00', '2026-11-22T23:04:59']) {
    w.clock.t = IST(s);
    const e = await w.service.stats('u1', { week: WEEK, subject: 'accountancy' }).catch((x) => x);
    assert.equal(e.code, 'NOT_CLOSED', s);
    assert.deepEqual(e.detail, { answersAt: '2026-11-22T17:35:00.000Z' });
  }
  w.clock.t = IST('2026-11-22T23:05:00');
  const over = await w.service.stats('u1', { week: WEEK, subject: 'accountancy' });
  assert.equal(over.sat, 30);
  assert.deepEqual(over.shares, { q1: Math.round((100 * 11) / 30) });
  assert.equal(over.final, true);
  assert.equal(JSON.stringify(over).match(/rank|percentile|place/i), null);
  // Under the floor: the count, never a share.
  const few = world();
  for (let i = 0; i < 29; i += 1) few.attempts.push({ userId: `s${i}`, week: WEEK, subject: 'accountancy', completedAt: win.opensAt + i * MIN, details: [{ qid: 'q1', isCorrect: true }] });
  few.clock.t = win.answersAt;
  assert.deepEqual((({ sat, shares }) => ({ sat, shares }))(await few.service.stats('u1', { week: WEEK, subject: 'accountancy' })), { sat: 29, shares: null });
});

test('status: each of the student\'s subjects with its state, marks and, after the close, how many sat', async () => {
  const w = world({ at: IST('2026-11-21T18:00:00') });
  let s = await w.service.status('u3');
  assert.equal(s.phase, 'before');
  assert.equal(s.dow, 6);
  assert.deepEqual(s.subjects.map((x) => [x.id, x.state]), [['accountancy', 'soon'], ['economics', 'soon']]);
  w.clock.t = IST('2026-11-22T11:00:00');
  await w.service.start('u3', { subject: 'accountancy' });
  s = await w.service.status('u3');
  assert.deepEqual(s.subjects.map((x) => x.state), ['started', 'open']);
  assert.equal(s.subjects[0].resumeUntil, new Date(IST('2026-11-22T12:02:00')).toISOString());
  w.clock.t = IST('2026-11-22T11:50:00');
  w.send('u3', 'accountancy', { correct: 34, wrong: 10 });
  s = await w.service.status('u3');
  assert.deepEqual(s.subjects[0], { id: 'accountancy', name: 'Accountancy', state: 'sat', resultId: 'att_1', marks: { scored: 160, max: 250 } });
  // 10:00 to 11:05 PM: closed for new starts, and how many sat waits for the last paper.
  for (const at of ['2026-11-22T22:30:00', '2026-11-22T22:59:00', '2026-11-22T23:04:00']) {
    w.clock.t = IST(at);
    s = await w.service.status('u3');
    assert.equal(s.phase, 'closed');
    assert.equal(s.answersAt, '2026-11-22T17:35:00.000Z');
    assert.equal('sat' in s.subjects[0], false, at);
    assert.equal(s.subjects[1].state, 'closed');
  }
  w.clock.t = IST('2026-11-22T23:05:00');
  s = await w.service.status('u3');
  assert.equal(s.subjects[0].sat, 1);
  // Monday: this week's paper is next Sunday's; yesterday's result stays in `previous`.
  w.clock.t = IST('2026-11-23T09:00:00');
  s = await w.service.status('u3');
  assert.equal(s.week, '2026-11-29');
  assert.deepEqual(s.previous, { week: WEEK, subjects: [{ id: 'accountancy', name: 'Accountancy', state: 'sat', resultId: 'att_1', marks: { scored: 160, max: 250 }, sat: 1 }] });
  assert.deepEqual((await w.service.status('nobody')).subjects, []);
});

test('the den (rule F2): only the members who sat, marks only as each shares them, your own row whatever your state, never a user id', async () => {
  const w = world({ at: IST('2026-11-21T12:00:00'), users: { u1: ['accountancy'], u2: ['accountancy'], u3: ['economics'], u4: ['accountancy'] } });
  const before = await w.service.mob('u1', { mob: MOB });
  assert.deepEqual([before.phase, before.members, before.you.state], ['before', [], 'soon']);
  w.clock.t = IST('2026-11-22T12:00:00');
  await w.service.start('u1', { subject: 'accountancy' });
  await w.service.start('u2', { subject: 'accountancy' });
  w.send('u1', 'accountancy', { correct: 40, wrong: 5 });
  w.send('u2', 'accountancy', { correct: 30, wrong: 8 });
  const den = await w.service.mob('u2', { mob: MOB });
  assert.equal(den.subjectName, 'Accountancy');
  // Meera and Ravi have not sat: they are not in the answer at all (no row, no count, no Mob size).
  assert.deepEqual(den.members, [
    { name: 'Asha', colour: 1, you: false, sat: true, marks: { scored: 195, max: 250 } },
    { name: 'Kabir', colour: 2, you: true, sat: true, marks: { scored: 142, max: 250 } },
  ]);
  assert.equal(JSON.stringify(den).includes('Meera') || JSON.stringify(den).includes('Ravi'), false);
  assert.deepEqual(den.you, { state: 'sat', resultId: 'att_2' });
  const asha = await w.service.mob('u1', { mob: MOB });
  assert.deepEqual(asha.members[1], { name: 'Kabir', colour: 2, you: false, sat: true }, 'Kabir keeps his score private');
  // Ravi, who has not sat, sees his own row ("Not yet" and his key), and the two who sat; never Meera.
  const ravi = await w.service.mob('u4', { mob: MOB });
  assert.equal(ravi.you.state, 'open');
  assert.deepEqual(ravi.members.map((m) => [m.name, m.you, m.sat]), [['Asha', false, true], ['Kabir', false, true], ['Ravi', true, false]]);
  assert.equal((await w.service.mob('u3', { mob: MOB })).you.state, 'not_yours');
  assert.equal(JSON.stringify(den).includes('u1'), false);
  await rejects(w.service.mob('stranger', { mob: MOB }), 'NOT_IN_MOB');
  await rejects(w.service.mob('u1', { mob: 'not-a-uuid' }), 'NOT_IN_MOB');
});

test('the routes: off is 404, signed out 401, limits 429, refusals keep their code and plain detail', async () => {
  const w = world();
  const req = (method, body, url = 'https://www.mockmob.in/api/sunday/start') => new Request(url, { method, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  const deps = (over = {}) => ({ enabled: () => true, auth: async () => ({ user: { id: 'u1' } }), rateLimit: async () => ({ allowed: true }), service: w.service, ...over });
  let r = await handleSunday(deps({ enabled: () => false }), 'status', req('GET', undefined, 'https://x/api/sunday'));
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, 'SUNDAY_OFF');
  r = await handleSunday(deps({ auth: async () => null }), 'start', req('POST', { subject: 'accountancy' }));
  assert.equal(r.status, 401);
  r = await handleSunday(deps({ rateLimit: async () => ({ allowed: false }) }), 'start', req('POST', { subject: 'accountancy' }));
  assert.equal(r.status, 429);
  r = await handleSunday(deps(), 'start', req('POST', '{not json'));
  assert.equal(r.status, 400);
  r = await handleSunday(deps(), 'start', req('POST', { subject: 'economics' }));
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { error: 'NOT_YOUR_SUBJECT', detail: { subjectName: 'Economics' } });
  r = await handleSunday(deps(), 'start', req('POST', { subject: 'accountancy' }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  w.send('u1', 'accountancy');
  r = await handleSunday(deps(), 'start', req('POST', { subject: 'accountancy' }));
  assert.equal(r.status, 409);
  assert.deepEqual(await r.json(), { error: 'SESSION_ALREADY_SUBMITTED', message: 'You already sent this paper.', detail: { attemptId: 'att_1' } });
  r = await handleSunday(deps(), 'stats', req('GET', undefined, `https://x/api/sunday/stats?week=${WEEK}&subject=accountancy`));
  assert.equal(r.status, 409);
  r = await handleSunday(deps(), 'status', req('GET', undefined, 'https://x/api/sunday'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).week, WEEK);
});

test('the claim rows on the real table keys: one per student and period, the earliest is the paper', async () => {
  const clock = { t: OPEN };
  const db = fakeDb({}, { now: () => clock.t });
  const store = createSundayStore(db);
  const p = claimPeriod(WEEK, 'accountancy');
  assert.equal(await store.readPaper(p), null);
  assert.equal(await store.insertClaim('u2', p, `v1:${OPEN}:${ids('a').join(',')}`), 'inserted');
  clock.t += 1000;
  assert.equal(await store.insertClaim('u1', p, `v1:${OPEN + 1000}:${ids('b').join(',')}`), 'inserted');
  assert.equal(await store.insertClaim('u1', p, `v1:${OPEN + 2000}:${ids('c').join(',')}`), 'exists');
  assert.deepEqual(await store.readPaper(p), ids('a'));
  assert.deepEqual((await store.readClaim('u1', p)).ids, ids('b'));
  await store.updateClaim('u1', p, `v1:${OPEN + 1000}:${ids('a').join(',')}`);
  assert.deepEqual((await store.readClaim('u1', p)).ids, ids('a'));
  assert.deepEqual([...(await store.readClaims('u1', [p, claimPeriod(WEEK, 'economics')])).keys()], [p]);
  await store.deleteClaim('u2', p);
  assert.deepEqual(await store.readPaper(p), ids('a'));
  assert.equal(db.tables.learning_allowances.length, 1);
});

import { firstFullMockFor, readFirstFullMockFacts } from '../../src/lib/server/firstFullMock.js';

/** attempts and learning_allowances with the query shapes readFirstFullMockFacts uses (eq, in on a json path, contains, head counts). */
function factsDb({ attempts = [], allowances = [], containsFails = false } = {}) {
  const value = (row, key) => (key.includes('->>') ? key.split('->>').reduce((node, k, i) => (i === 0 ? row[k] : node?.[k]), null) : row[key]);
  const covers = (whole, part) => Object.entries(part).every(([k, v]) => (v && typeof v === 'object' ? whole?.[k] && covers(whole[k], v) : whole?.[k] === v));
  return {
    from(table) {
      const filters = [];
      let head = false;
      const q = {
        select(_cols, opts = {}) { head = opts.head === true; return q; },
        eq(k, v) { filters.push((r) => value(r, k) === v); return q; },
        in(k, list) { filters.push((r) => list.includes(value(r, k))); return q; },
        contains(k, part) { if (containsFails) throw new TypeError('contains is not a function'); filters.push((r) => covers(r[k], part)); return q; },
        then(res, rej) {
          const rows = (table === 'attempts' ? attempts : allowances).filter((r) => filters.every((f) => f(r)));
          return Promise.resolve(head ? { data: null, count: rows.length, error: null } : { data: rows, error: null }).then(res, rej);
        },
      };
      return q;
    },
  };
}

test('a Sunday Mock never uses up the free first Full mock; any other Full mock or NTA paper still does', async () => {
  const sundayPaper = (id) => ({ id, user_id: 'u1', subject: 'accountancy', selection_meta: { mode: 'full', mobPaper: { mobId: SUNDAY_TAG, weekStart: WEEK, holdUntil: 'x' } } });
  const ownFull = (id, mode = 'full') => ({ id, user_id: 'u1', subject: 'accountancy', selection_meta: { mode } });
  const mobGame = (id) => ({ id, user_id: 'u1', subject: 'accountancy', selection_meta: { mode: 'full', mobPaper: { mobId: MOB, weekStart: '2026-11-16', gameId: 'g1' } } });
  // Only Sunday papers: the free first Full mock is still available.
  let db = factsDb({ attempts: [sundayPaper('s1'), sundayPaper('s2')] });
  assert.equal((await readFirstFullMockFacts(db, { userId: 'u1', subject: 'accountancy' })).fullPapers, 0);
  assert.equal(await firstFullMockFor(db, { userId: 'u1', subject: 'accountancy' }), 'available');
  // A Full mock of the student's own, an NTA paper or a Mob game's full mock: used, as before.
  for (const other of [ownFull('f1'), ownFull('n1', 'nta'), mobGame('g1')]) {
    db = factsDb({ attempts: [sundayPaper('s1'), other] });
    assert.equal((await readFirstFullMockFacts(db, { userId: 'u1', subject: 'accountancy' })).fullPapers, 1, other.id);
    assert.equal(await firstFullMockFor(db, { userId: 'u1', subject: 'accountancy' }), 'used', other.id);
  }
  // Another student's Sunday paper or another subject's never counts either way.
  db = factsDb({ attempts: [{ ...sundayPaper('x1'), user_id: 'u2' }, { ...ownFull('x2'), subject: 'economics' }] });
  assert.equal(await firstFullMockFor(db, { userId: 'u1', subject: 'accountancy' }), 'available');
  // The Sunday read failing keeps the count as before (the free mock treated as used, never given twice).
  db = factsDb({ attempts: [sundayPaper('s1')], containsFails: true });
  assert.equal((await readFirstFullMockFacts(db, { userId: 'u1', subject: 'accountancy' })).fullPapers, 1);
  assert.equal(await firstFullMockFor(db, { userId: 'u1', subject: 'accountancy' }), 'used');
});

test('the counts route takes only a Sunday from the launch to this week, and refuses any other before a single read', async () => {
  const w = world({ at: IST('2026-11-29T23:30:00') });
  let reads = 0;
  w.store.findSittings = async () => { reads += 1; return []; };
  const service = createSundayService({ ...w.deps, store: w.store });
  for (const week of ['2026-11-15', '2026-11-08', '2025-11-23', '2026-12-06', '2027-01-03', '2026-11-23', 'not-a-week', '']) {
    const e = await service.stats('u1', { week, subject: 'accountancy' }).catch((x) => x);
    assert.equal(e.code, 'BODY_INVALID', week);
    assert.equal(e.status, 400);
  }
  assert.equal(reads, 0, 'no refused week read the attempts');
  // The launch week and this week (after 11:05 PM) are read.
  assert.equal((await service.stats('u1', { week: '2026-11-22', subject: 'accountancy' })).week, '2026-11-22');
  assert.equal((await service.stats('u1', { week: '2026-11-29', subject: 'accountancy' })).week, '2026-11-29');
  assert.equal(reads, 2);
});
