// A paper finished offline is not lost (bugs-core B8, owner option a, 15 Nov 2026). A device-held paper sent after its upload
// grace is accepted for 7 days as a late paper: the sealed ticket proves the start, only events stamped by the deadline are
// scored, and the attempt is marked late, which keeps it out of everything that compares students. Runs the REAL finishPractice
// (src/lib/server/practiceSessions.js) with only the edges stood in (the Database, the Supabase client, the Mob hook), the real
// leaderboard arithmetic (src/lib/server/latePapers.js) and the cohort table's refresh with the late filter on PGlite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { LATE_WINDOW_MS, SUBMISSION_GRACE_MS, isLatePaper, lateSubmission, submitTiming } from '../late_paper.js';
import { sealPractice } from '../practice_ticket.js';
import { ownWithoutLate, readLatePapers, withoutLatePapers } from '../../src/lib/server/latePapers.js';
import { KEEP_AFTER_END_MS } from '../../src/lib/paper/draft.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

// ---------------------------------------------------------------------------------------------------------------------
// The rule (pure)
// ---------------------------------------------------------------------------------------------------------------------
test('timing: on time through the 2-minute grace, late for 7 days after the deadline, then refused; the device keeps its draft exactly as long', () => {
  const end = Date.parse('2026-11-15T10:00:00Z');
  assert.equal(SUBMISSION_GRACE_MS, 2 * MIN);
  assert.equal(LATE_WINDOW_MS, 7 * DAY);
  assert.equal(KEEP_AFTER_END_MS, LATE_WINDOW_MS, 'the runner keeps a late draft as long as the server takes it');
  assert.equal(submitTiming(end, end - 1), 'on_time');
  assert.equal(submitTiming(end, end + 2 * MIN), 'on_time');
  assert.equal(submitTiming(end, end + 2 * MIN + 1), 'late');
  assert.equal(submitTiming(end, end + 7 * DAY), 'late');
  assert.equal(submitTiming(end, end + 7 * DAY + 1), 'expired');
  assert.equal(submitTiming(Number.NaN, end), 'expired');
  assert.equal(isLatePaper({ selectionMeta: { late: true } }), true);
  assert.equal(isLatePaper({ selection_meta: { late: true } }), true);
  assert.equal(isLatePaper({ late: true }), true);
  assert.equal(isLatePaper({ selectionMeta: { late: 'true' } }), false);
  assert.equal(isLatePaper({ selection_meta: null }), false);
  assert.equal(isLatePaper(null), false);
});

const Q = (id) => ({ id, question: `Question ${id}`, options: ['A', 'B', 'C', 'D'], correctIndex: 1, correct_answer: 'B' });
const ev = (seq, at, type, qid, extra = {}) => ({ seq, at, type, qid, ...extra });

test('a late send scores only the answers its events hold by the deadline; everything from the first event past it is dropped', () => {
  const questions = [Q('q1'), Q('q2'), Q('q3')];
  const events = [
    ev(1, 0, 'visit', 'q1'), ev(2, 1000, 'answer', 'q1', { answer: 1 }),
    ev(3, 2000, 'visit', 'q2'), ev(4, 3000, 'answer', 'q2', { answer: 0 }), ev(5, 4000, 'answer', 'q2', { answer: null }),
    ev(6, 5000, 'answer', 'nope', { answer: 1 }), ev(7, 5500, 'answer', 'q3', { answer: 9 }),
    ev(8, 6000, 'end', 'q3', { reason: 'time_up' }),
    ev(9, 6001, 'answer', 'q3', { answer: 1 }), // after the 6 s paper's deadline
    ev(10, 100, 'answer', 'q3', { answer: 1 }), // and nothing after that counts, even with an earlier clock
  ];
  const out = lateSubmission(questions, events, 6000);
  assert.deepEqual(out.answers, { q1: 1 }, 'q2 was cleared, q3 had no valid answer by the deadline, an unknown id is ignored');
  assert.deepEqual(out.events.map((e) => e.seq), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(lateSubmission(questions, 'junk', 6000), { answers: {}, events: [] });
  assert.deepEqual(lateSubmission(questions, events, 0), { answers: {}, events: [] });
  assert.deepEqual(lateSubmission(questions, [null, ev(1, 0, 'answer', 'q1', { answer: 1 })], 6000).answers, {}, 'a broken event ends the record');
});

// ---------------------------------------------------------------------------------------------------------------------
// The real finishPractice
// ---------------------------------------------------------------------------------------------------------------------
const STUBS = {
  'src/lib/supabase.js': 'export const supabaseAdmin = () => globalThis.__late.client; export const supabase = null;',
  'data/db.js': 'export const Database = globalThis.__late.Database;',
  'src/lib/server/learning.js': "export const durableLearningEnabled = () => false; export async function episodeCheckQuestion() { return null; }",
  'src/lib/server/mob/deps.js': 'export async function recordMobSitting(userId, attempt) { globalThis.__late.mob.push({ userId, id: attempt.id }); return "recorded"; }',
};
const EXTENSIONS = ['', '.js', '.mjs', '.jsx', '.ts', '/index.js'];
const probe = (base) => {
  for (const ext of EXTENSIONS) { const f = base + ext; if (existsSync(f) && statSync(f).isFile()) return f; }
  return null;
};
const ours = (url) => typeof url === 'string' && url.startsWith(pathToFileURL(ROOT).href) && !url.includes('/node_modules/');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    let found = null;
    if (specifier.startsWith('@/')) found = probe(path.join(ROOT, 'src', specifier.slice(2)));
    else if (/^\.\.?\//.test(specifier) && ours(context.parentURL)) found = probe(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (found) {
      const rel = path.relative(ROOT, found).split(path.sep).join('/');
      if (Object.hasOwn(STUBS, rel)) return { url: `data:text/javascript,${encodeURIComponent(STUBS[rel])}`, shortCircuit: true };
      return { url: pathToFileURL(found).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const SECRET = 'late-paper-test-secret-0123456789abcdef';
process.env.PRACTICE_SESSION_SECRET = SECRET;
delete process.env.SESSION_CHECK_ENABLED;
const attempts = new Map();
let writes = 0;
// The Supabase client: only the B13 checked-answer log is read on this path.
const checkedLog = [];
const client = {
  from(table) {
    const where = {};
    const q = {
      select() { return q; },
      eq(k, v) { where[k] = v; return q; },
      then(resolve, reject) {
        const data = table === 'session_check_log' ? checkedLog.filter((r) => r.session_id === where.session_id && r.user_id === where.user_id).map(({ qid, answer }) => ({ qid, answer })) : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
};
globalThis.__late = {
  client,
  mob: [],
  Database: {
    async getAttemptById(id) { return attempts.get(id) || null; },
    async addAttempt(a) {
      writes += 1;
      if (attempts.has(a.id)) throw Object.assign(new Error('duplicate'), { code: '23505' });
      const saved = { ...structuredClone(a), completedAt: new Date(Date.now()).toISOString() };
      attempts.set(a.id, saved);
      return saved;
    },
  },
};
const { finishPractice } = await import(pathToFileURL(path.join(ROOT, 'src', 'lib', 'server', 'practiceSessions.js')).href);

const realNow = Date.now;
let clock = Date.parse('2026-11-15T09:00:00Z');
Date.now = () => clock;
test.after(() => { Date.now = realNow; });

const HOUR = 60 * MIN;
/** A device-held paper exactly as startPractice seals it: three questions, one hour. */
function paper(id, { user = 'stu', startedAt = clock, mobPaper = null } = {}) {
  const row = {
    id, user_id: user, subject: 'accountancy', mode: 'full', created_at: new Date(startedAt).toISOString(), expires_at: new Date(startedAt + HOUR).toISOString(),
    questions: [Q('q1'), Q('q2'), Q('q3')],
    selection_meta: { mode: 'full', scoringVersion: 'server_practice_v1', scoringAuthority: 'server_snapshot', ...(mobPaper ? { mobPaper } : {}) },
  };
  return { row, ticket: sealPractice(row, SECRET), startedAt };
}
// Answered q1 right and q2 wrong in the hour; q3 answered on the device after the timer (a clock-skewed or tampered event).
const sitting = () => [
  ev(1, 0, 'visit', 'q1'), ev(2, 60_000, 'answer', 'q1', { answer: 1 }),
  ev(3, 70_000, 'visit', 'q2'), ev(4, 120_000, 'answer', 'q2', { answer: 0 }),
  ev(5, HOUR, 'end', 'q2', { reason: 'time_up' }),
  ev(6, HOUR + 5000, 'answer', 'q3', { answer: 1 }),
];
const send = (p, body = {}, user = 'stu') => finishPractice(user, { sessionId: p.row.id, sessionTicket: p.ticket, answers: { q1: 1, q2: 0, q3: 1 }, events: sitting(), ...body });

test('three days late: accepted, marked late with its arrival, scored only from what the events hold by the deadline', async () => {
  const p = paper('att_practice_late_1');
  clock = p.startedAt + HOUR + 3 * DAY;
  const saved = await send(p);
  assert.equal(saved.id, p.row.id);
  assert.deepEqual([saved.correct, saved.wrong, saved.unattempted, saved.rawScore], [1, 1, 1, 4], 'q3, answered after the timer, is not scored even though the device sent it');
  assert.equal(saved.selectionMeta.late, true);
  assert.equal(saved.selectionMeta.lateArrivedAt, new Date(clock).toISOString());
  assert.equal(saved.selectionMeta.endedBy, 'time_up');
  assert.equal(saved.selectionMeta.recovery.telemetry, 'self_reported');
  assert.deepEqual(saved.selectionMeta.recovery.timeline.map((e) => e.seq), [1, 2, 3, 4], 'the scored record ends at the deadline');
  assert.equal(saved.questionsSnapshot.length, 3, 'the student\'s own record: result, Review and repairs read this attempt as any other');
  assert.equal(isLatePaper(saved), true);
});

test('an answer the device holds with no event before the deadline is not scored on a late paper; a server-checked answer stays final', async () => {
  const p = paper('att_practice_late_2');
  checkedLog.push({ session_id: p.row.id, user_id: 'stu', qid: 'q2', answer: 1 });
  clock = p.startedAt + HOUR + 10 * MIN;
  const saved = await send(p, { answers: { q1: 1, q2: 1, q3: 1 }, events: [ev(1, 0, 'visit', 'q1'), ev(2, 60_000, 'answer', 'q1', { answer: 1 })] });
  assert.deepEqual([saved.correct, saved.wrong, saved.unattempted], [2, 0, 1], 'q1 from its event, q2 from the check log, q3 dropped');
  assert.equal(saved.selectionMeta.late, true);
});

test('on time (inside the 2-minute grace) nothing changes: the answers sent are scored and nothing is marked late', async () => {
  const p = paper('att_practice_ontime');
  clock = p.startedAt + HOUR + 90_000;
  const saved = await send(p, { events: sitting().slice(0, 5) });
  assert.deepEqual([saved.correct, saved.wrong, saved.unattempted], [2, 1, 0]);
  assert.equal(saved.selectionMeta.late, undefined);
  assert.equal(saved.selectionMeta.lateArrivedAt, undefined);
  assert.equal(isLatePaper(saved), false);
});

test('refused: more than 7 days late, another student\'s ticket, an edited ticket; a second send returns the first result unchanged', async () => {
  const old = paper('att_practice_too_late');
  clock = old.startedAt + HOUR + 7 * DAY + 1;
  await assert.rejects(send(old), /SESSION_EXPIRED/);
  assert.equal(attempts.has(old.row.id), false);

  const mine = paper('att_practice_mine');
  clock = mine.startedAt + HOUR + DAY;
  await assert.rejects(send(mine, {}, 'someone_else'), /SESSION_NOT_FOUND/);
  const parts = mine.ticket.split('.');
  parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
  await assert.rejects(send({ ...mine, ticket: parts.join('.') }), /INVALID_PRACTICE_SESSION/);
  await assert.rejects(finishPractice('stu', { sessionId: 'att_practice_other', sessionTicket: mine.ticket, answers: {}, events: [] }), /SESSION_NOT_FOUND/);
  assert.equal(attempts.has(mine.row.id), false);

  const first = await send(mine);
  const before = writes;
  clock += DAY;
  const again = await send(mine, { answers: { q1: 1, q2: 1, q3: 1 }, events: [ev(1, 0, 'answer', 'q1', { answer: 1 }), ev(2, 1, 'answer', 'q2', { answer: 1 }), ev(3, 2, 'answer', 'q3', { answer: 1 })] });
  assert.equal(writes, before, 'no second write');
  assert.deepEqual([again.correct, again.wrong, again.selectionMeta.lateArrivedAt], [first.correct, first.wrong, first.selectionMeta.lateArrivedAt]);
  clock += 30 * DAY;
  assert.equal((await send(mine)).id, mine.row.id, 'a retry of a saved paper is answered with it, whenever it comes');
});

test('a late Mob paper never reaches the Mob\'s marks; an on-time one does', async () => {
  globalThis.__late.mob.length = 0;
  const tag = { mobId: 'mob1', weekStart: '2026-11-09' };
  const late = paper('att_practice_mob_late', { mobPaper: tag });
  clock = late.startedAt + HOUR + 5 * MIN;
  assert.equal((await send(late)).selectionMeta.late, true);
  const onTime = paper('att_practice_mob_ontime', { mobPaper: tag });
  clock = onTime.startedAt + HOUR - MIN;
  await send(onTime, { events: sitting().slice(0, 4) });
  assert.deepEqual(globalThis.__late.mob, [{ userId: 'stu', id: 'att_practice_mob_ontime' }]);
  // The Mob's read of sittings (findAttempts, used for the durable path and Full mock together) leaves late papers out too.
  assert.match(file('src/lib/server/mob/deps.js'), /\.filter\(\(r\) => r\.selection_meta\?\.late !== true\)/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The points board (standing, rank, "top N%"): late papers out
// ---------------------------------------------------------------------------------------------------------------------
test('the board loses each student\'s late papers; a student with only late papers leaves it; the caller\'s own row too', async () => {
  const rows = [
    { userId: 'a', tests: 3, totalScore: 210, avg: 70 },
    { userId: 'b', tests: 1, totalScore: 90, avg: 90 },
    { userId: 'c', tests: 2, totalScore: 100, avg: 50 },
  ];
  const late = [{ user_id: 'a', score: 90 }, { user_id: 'b', score: 90 }, { user_id: 'zz', score: 10 }];
  assert.deepEqual(withoutLatePapers(rows, late), [{ userId: 'a', tests: 2, totalScore: 120, avg: 60 }, { userId: 'c', tests: 2, totalScore: 100, avg: 50 }]);
  assert.deepEqual(withoutLatePapers(rows, []), rows);
  assert.notEqual(withoutLatePapers(rows, [])[0], rows[0], 'copies, never the cached rows');
  assert.deepEqual(ownWithoutLate({ tests: 3, totalScore: 210 }, [{ score: 90 }]), { tests: 2, totalScore: 120 });
  assert.deepEqual(ownWithoutLate({ tests: 3, totalScore: 210 }, []), { tests: 3, totalScore: 210 });

  // The read: only attempts whose selection_meta holds late: true, paged, and only the caller's when asked.
  const calls = [];
  const db = { from(table) {
    const call = { table, filters: [] };
    calls.push(call);
    const q = {
      select(cols) { call.cols = cols; return q; },
      contains(col, v) { call.filters.push(['cs', col, v]); return q; },
      eq(col, v) { call.filters.push(['eq', col, v]); return q; },
      order() { return q; },
      range(from, to) { call.range = [from, to]; return q; },
      then(resolve, reject) { return Promise.resolve({ data: call.range[0] === 0 ? Array.from({ length: 1000 }, (_, i) => ({ id: `x${i}`, user_id: 'a', score: 1 })) : [{ id: 'y', user_id: 'b', score: 2 }], error: null }).then(resolve, reject); },
    };
    return q;
  } };
  assert.equal((await readLatePapers(db)).length, 1001);
  assert.deepEqual(calls.map((c) => [c.table, c.cols, c.filters, c.range]), [
    ['attempts', 'id,user_id,score', [['cs', 'selection_meta', { late: true }]], [0, 999]],
    ['attempts', 'id,user_id,score', [['cs', 'selection_meta', { late: true }]], [1000, 1999]],
  ]);
  calls.length = 0;
  await readLatePapers(db, { userId: 'a' });
  assert.deepEqual(calls[0].filters, [['cs', 'selection_meta', { late: true }], ['eq', 'user_id', 'a']]);
  const failing = { from: () => { const q = { select: () => q, contains: () => q, order: () => q, range: () => q, then: (res, rej) => Promise.resolve({ data: null, error: new Error('boom') }).then(res, rej) }; return q; } };
  await assert.rejects(readLatePapers(failing), /boom/);
  // The route applies both.
  const route = file('src/app/api/leaderboard/route.js');
  assert.match(route, /withoutLatePapers\(await Database\.getLeaderboard\(\{ withProfile: false \}\), await readLatePapers\(supabaseAdmin\(\)\)\)/);
  assert.match(route, /ownWithoutLate\(.*readLatePapers\(supabaseAdmin\(\), \{ userId: id \}\)\)/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The cohort table (pick shares, first-answer rights, cohort times): the migration, not applied, leaves late papers out
// ---------------------------------------------------------------------------------------------------------------------
test('the cohort refresh with the late filter counts the same answers as v2, less the late papers; its undo restores v2', async () => {
  const MIGRATION = 'supabase/migrations/20261115200000_late_papers_out_of_cohort_stats.sql';
  const UNDO = 'supabase/undo/20261115200000_late_papers_out_of_cohort_stats.undo.sql';
  assert.match(file(MIGRATION), /NOT APPLIED/);
  const v2 = file('supabase/migrations/20261016130000_question_option_stats_refresh_v2.sql');
  const body = (sql) => sql.slice(sql.indexOf('create or replace function public.refresh_question_option_stats()'));
  assert.equal(body(file(MIGRATION)).replace("      and coalesce(a.selection_meta->>'late', '') <> 'true'\n", ''), body(v2), 'v2 plus the one line');
  assert.equal(body(file(UNDO)), body(v2));

  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.questions (id text primary key, body text, question text, options jsonb, correct_index int, correct_answer text,
        status text default 'live', is_deleted boolean default false, verification_state text default 'verified');
      create table public.attempts (id text primary key, user_id text not null, subject text default 'x', score int default 0, correct int default 0,
        wrong int default 0, unattempted int default 0, total int default 0, details jsonb not null, questions_snapshot jsonb not null,
        completed_at timestamptz not null, selection_meta jsonb not null default '{}');`);
    await db.exec(file('supabase/migrations/20261016120000_question_option_stats.sql'));
    await db.exec(v2);
    const q = { id: 'cq1', question: 'Which is right?', options: ['A one', 'B two', 'C three', 'D four'], correctIndex: 1 };
    await db.query('insert into public.questions (id, question, options, correct_index) values ($1,$2,$3,$4)', [q.id, q.question, JSON.stringify(q.options), 1]);
    const when = new Date(Date.parse('2026-11-14T10:00:00Z')).toISOString();
    for (let i = 0; i < 12; i += 1) {
      await db.query('insert into public.attempts (id, user_id, details, questions_snapshot, completed_at, selection_meta) values ($1,$2,$3,$4,$5,$6)',
        [`att${i}`, `u${i}`, JSON.stringify([{ qid: 'cq1', givenIndex: i % 2 }]), JSON.stringify([q]), when, JSON.stringify(i < 2 ? { late: true, lateArrivedAt: when } : {})]);
    }
    const answered = async () => (await db.query("select n_answered from public.question_option_stats where qid='cq1'")).rows[0]?.n_answered;
    await db.query('select public.refresh_question_option_stats()');
    assert.equal(await answered(), 12, 'v2 (today on production) counts the 2 late papers');
    await db.exec(file(MIGRATION));
    await db.query('select public.refresh_question_option_stats()');
    assert.equal(await answered(), 10, 'with the migration they are out');
    await db.exec(file(UNDO));
    await db.query('select public.refresh_question_option_stats()');
    assert.equal(await answered(), 12);
  } finally { await db.close(); }
});
