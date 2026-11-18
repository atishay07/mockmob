// Marks trend's analysis blocks (lane insight, 18 Nov 2026): GET /api/analytics's additive `insight` part. The real route
// runs with auth, the database client and data/db replaced by in-memory stand-ins (the pattern of sec_1115_feed_hold).
//   - no session, no read; the app's bearer works as the cookie does (auth(request))
//   - every read is the signed-in student's own: another student's answers, attempts or options never count, and a
//     ?userId= of someone else changes nothing
//   - Free gets the map and the marks split; the pace rows and changed answers are Pro's and are not in a Free body
//   - a held Mob paper's answers stay out of the chapter counts
// And source pins: the page renders the three new blocks, from this body.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mobWeek, nextOpensAt } from '../../src/lib/mob/model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTENSIONS = ['', '.js', '.mjs', '/index.js'];
const probe = (base) => {
  for (const extension of EXTENSIONS) {
    const file = base + extension;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return pathToFileURL(file).href;
  }
  return null;
};
const stub = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const STUBS = {
  '@/lib/auth': 'export const auth = async (request) => { globalThis.__i.authCalls += 1; return globalThis.__i.who(request); };',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__i.db;',
  '@/../data/db': [
    'export const Database = {',
    '  getUserById: async (id) => { globalThis.__i.userReads.push(id); return globalThis.__i.users[id] || null; },',
    '  getAttempts: async (userId, options) => { globalThis.__i.attemptReads.push([userId, options]); return structuredClone(globalThis.__i.attempts.filter((a) => a.userId === userId)); },',
    '};',
  ].join('\n'),
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    if (specifier === 'next/server') return next('next/server.js', context);
    if (STUBS[specifier]) return { url: stub(STUBS[specifier]), shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const url = probe(path.join(ROOT, 'src', specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

// A small PostgREST-like fake: select with aliases and json paths; eq, gt, gte, not is null, order, range.
const evalPath = (row, p) => {
  const parts = String(p).trim().split(/->>?/);
  let v = row?.[parts[0]];
  for (const key of parts.slice(1)) v = v == null ? null : v[key];
  return v === undefined ? null : v;
};
function project(row, select) {
  if (!select || select.trim() === '*') return structuredClone(row);
  const out = {};
  for (const raw of select.split(',')) {
    const item = raw.trim();
    if (!item) continue;
    const at = item.indexOf(':');
    const [alias, p] = at > 0 ? [item.slice(0, at), item.slice(at + 1)] : [item.split(/->>?/).pop(), item];
    const value = evalPath(row, p);
    out[alias] = value === null ? null : structuredClone(value);
  }
  return out;
}
function fakeDb(tables) {
  const calls = [];
  return {
    calls,
    from(name) {
      const s = { select: '*', eq: [], gt: [], gte: [], notNull: [], range: null };
      const run = () => {
        let rows = (tables[name] || []).slice();
        for (const [c, v] of s.eq) rows = rows.filter((r) => evalPath(r, c) === v);
        for (const [c, v] of s.gt) rows = rows.filter((r) => evalPath(r, c) !== null && evalPath(r, c) > v);
        for (const [c, v] of s.gte) rows = rows.filter((r) => evalPath(r, c) !== null && evalPath(r, c) >= v);
        for (const c of s.notNull) rows = rows.filter((r) => evalPath(r, c) !== null);
        if (s.range) rows = rows.slice(s.range[0], s.range[1] + 1);
        calls.push({ table: name, eq: s.eq.map((x) => [...x]) });
        return { data: rows.map((r) => project(r, s.select)), error: null };
      };
      const q = {
        select(columns) { s.select = columns ?? '*'; return q; },
        eq(c, v) { s.eq.push([c, v]); return q; },
        gt(c, v) { s.gt.push([c, v]); return q; },
        gte(c, v) { s.gte.push([c, v]); return q; },
        not(c, op, v) { assert.equal(op, 'is'); assert.equal(v, null); s.notNull.push(c); return q; },
        order() { return q; },
        range(a, b) { s.range = [a, b]; return q; },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return q;
    },
  };
}

// ---------------------------------------------------------------- fixtures
const NOW = Date.now();
const HOUR = 3_600_000;
const WEEK = mobWeek(NOW);
const iso = (ms) => new Date(ms).toISOString();
const progress = (userId, i, chapter, correct, subject = 'accountancy') => ({ user_id: userId, question_id: `${userId}-${chapter}-${i}`, subject, chapter, attempt_count: 1, last_correct: correct, last_attempted_at: iso(NOW - HOUR) });
const rows = (userId, chapter, right, wrong) => [
  ...Array.from({ length: right }, (_, i) => progress(userId, i, chapter, true)),
  ...Array.from({ length: wrong }, (_, i) => progress(userId, right + i, chapter, false)),
];
const attempt = (id, userId, items, extra = {}) => ({
  id, userId, subject: 'accountancy', score: 40, correct: items.filter((i) => i[2] === true).length, wrong: items.filter((i) => i[2] === false).length,
  unattempted: items.filter((i) => i[2] === null).length, total: items.length, completedAt: NOW - 2 * HOUR,
  questionsSnapshot: items.map(([qid, chapter]) => ({ id: qid, subject: 'accountancy', chapter, difficulty: 'easy' })),
  details: items.map(([qid, , isCorrect]) => ({ qid, isCorrect, givenIndex: isCorrect === null ? null : isCorrect ? 0 : 1 })),
  selectionMeta: { mode: 'quick', scoringVersion: 'server_practice_v1' }, ...extra,
});
const MINE = attempt('att-mine', 'u1', [['m1', 'Goodwill Valuation', false], ['m2', 'Goodwill Valuation', null], ['m3', 'Goodwill Valuation', true]]);
const THEIRS = attempt('att-theirs', 'u2', Array.from({ length: 20 }, (_, i) => [`t${i}`, 'Share Capital', false]));
// A Mob paper of u1 still held for the Mob: its answers are in progress too (Admission of Partner, all wrong).
const HELD = attempt('att-held', 'u1', Array.from({ length: 8 }, (_, i) => [`h${i}`, 'Admission of Partner', false]), {
  selectionMeta: { mode: 'quick', scoringVersion: 'server_practice_v1', mobPaper: { mobId: 'mob-a', weekStart: WEEK, holdUntil: nextOpensAt(WEEK) } }, completedAt: NOW - HOUR,
});

const tables = () => ({
  user_question_progress: [
    ...rows('u1', 'Partnership Fundamentals', 12, 0),
    ...rows('u1', 'Goodwill Valuation', 2, 1),
    ...HELD.details.map((d) => ({ user_id: 'u1', question_id: d.qid, subject: 'accountancy', chapter: 'Admission of Partner', attempt_count: 1, last_correct: false, last_attempted_at: iso(NOW - HOUR) })),
    ...rows('u2', 'Share Capital', 0, 20),
    ...rows('u2', 'Debentures', 30, 0),
  ],
  student_subject_options: [{ user_id: 'u1', subject: 'accountancy', option: 'AFS' }, { user_id: 'u2', subject: 'accountancy', option: 'CAS' }],
  attempts: [{ id: 'att-held', user_id: 'u1', completed_at: iso(NOW - HOUR), selection_meta: HELD.selectionMeta, details: HELD.details }],
});
const USERS = {
  u1: { id: 'u1', isPremium: false, subjects: ['accountancy'] },
  u2: { id: 'u2', isPremium: true, subjects: ['accountancy', 'business_studies'] },
};
const who = (request) => {
  const a = request.headers.get('authorization');
  if (a === 'Bearer u1-token') return { user: { id: 'u1' } };
  if (a === 'Bearer u2-token') return { user: { id: 'u2' } };
  if (!a && (request.headers.get('cookie') || '').includes('sb-auth=u1')) return { user: { id: 'u1' } };
  return null;
};
function reset({ users = USERS } = {}) {
  globalThis.__i = { db: fakeDb(tables()), who, users: structuredClone(users), attempts: [MINE, THEIRS, HELD], authCalls: 0, userReads: [], attemptReads: [] };
  return globalThis.__i;
}
reset();
const route = await import(pathToFileURL(path.join(ROOT, 'src/app/api/analytics/route.js')).href);
const get = (headers, query = '') => route.GET(new Request(`https://www.mockmob.in/api/analytics${query}`, { headers }));
const chaptersOf = (body) => Object.fromEntries(body.insight.chapters.subjects.flatMap((s) => s.chapters).map((c) => [c.name, c]));

test('no session is 401 and nothing is read', async () => {
  const f = reset();
  const response = await get({});
  assert.equal(response.status, 401);
  assert.equal(f.authCalls, 1);
  assert.deepEqual([f.db.calls.length, f.userReads.length, f.attemptReads.length], [0, 0, 0]);
});

test('the cookie and the app\'s bearer read the same body: auth(request), as every route', async () => {
  reset();
  const cookie = await (await get({ cookie: 'sb-auth=u1' })).json();
  reset();
  const bearer = await (await get({ authorization: 'Bearer u1-token' })).json();
  assert.deepEqual(bearer.insight, cookie.insight);
  assert.match(read('src/app/api/analytics/route.js'), /const session = await auth\(request\);/);
});

test('only the caller\'s rows: another student\'s answers, papers and options never count, whatever ?userId= says', async () => {
  const f = reset();
  const response = await get({ authorization: 'Bearer u1-token' }, '?userId=u2');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(f.attemptReads.map(([id]) => id), ['u1']);
  assert.deepEqual(f.userReads, ['u1']);
  for (const call of f.db.calls) assert.deepEqual(call.eq.find(([c]) => c === 'user_id'), ['user_id', 'u1'], `${call.table} is read by the signed-in id`);
  const chapters = chaptersOf(body);
  assert.equal(chapters['Partnership Fundamentals'].state, 'strong');
  assert.deepEqual([chapters['Goodwill Valuation'].n, chapters['Goodwill Valuation'].right, chapters['Goodwill Valuation'].state], [3, 2, 'thin']);
  assert.equal(chapters['Share Capital'].state, 'none', 'u2\'s twenty wrong answers are not u1\'s');
  assert.equal(chapters.Debentures.n, 0);
  assert.equal(chapters['Share Capital'].lost, 0, 'u2\'s papers price nothing for u1');
  assert.equal(chapters['Goodwill Valuation'].lost, 6 + 5, 'u1\'s own paper: one wrong, one blank');
  assert.ok(!('Computerized Accounting System' in chapters), 'u1\'s own option (AFS), not u2\'s (CAS)');
  assert.deepEqual(body.insight.chapters.subjects.map((s) => s.id), ['accountancy'], 'u1\'s subjects only');
  assert.doesNotMatch(JSON.stringify(body), /u2-|att-theirs/);
});

test('a held Mob paper\'s answers stay out of the chapter counts; its marks still show in the split, as the header counts them', async () => {
  reset();
  const body = await (await get({ authorization: 'Bearer u1-token' })).json();
  const admission = chaptersOf(body)['Admission of Partner'];
  assert.deepEqual([admission.n, admission.state, admission.lost, admission.papers], [0, 'none', 0, 0]);
  assert.doesNotMatch(JSON.stringify(body.insight), /"h\d"/);
  assert.equal(body.insight.marks.papers, 2, 'both of u1\'s papers are on record');
  assert.equal(body.insight.marks.wrong.count, body.totals.wrong);
  assert.equal(body.insight.marks.blank.count, body.totals.unattempted);
});

test('Free: the map and the split, no pace rows and no changed answers in the body; Pro: both', async () => {
  reset();
  const free = await (await get({ authorization: 'Bearer u1-token' })).json();
  assert.equal(free.insight.plan, 'free');
  assert.deepEqual(free.insight.pace, { state: 'locked', paceSec: 72 });
  assert.equal(free.insight.marks.changes, null);
  reset({ users: { ...USERS, u1: { ...USERS.u1, isPremium: true } } });
  const pro = await (await get({ authorization: 'Bearer u1-token' })).json();
  assert.equal(pro.insight.plan, 'pro');
  assert.equal(pro.insight.pace.state, 'ready');
  assert.ok(Array.isArray(pro.insight.pace.papers));
  // The older fields are untouched by the new part.
  for (const key of ['weakChapters', 'subjects', 'timeline', 'totals', 'totalAttempts', 'scoring', 'insights']) assert.ok(key in pro, key);
});

test('the account unread: the map is a failed read with its retry, never an empty map; the rest still answers', async () => {
  reset({ users: {} });
  const body = await (await get({ authorization: 'Bearer u1-token' })).json();
  assert.deepEqual([body.insight.chapters.state, body.insight.pace.state, body.insight.marks.state], ['error', 'error', 'ready']);
  assert.equal(body.timeline.length, 2);
});

test('source pins: the page renders the three new blocks from GET /api/analytics, in the phone order the brief sets', () => {
  const page = read('src/app/(app)/analytics/AnalyticsPageClient.jsx');
  for (const name of ['YourChapters', 'YourPace', 'WhereMarksGo']) assert.match(page, new RegExp(`<${name}\\b`), name);
  assert.match(page, /apiGet\(`\/api\/analytics/);
  // Phones: totals, score by session, the chapter map, pace, where marks go, by subject (the record's answer sheet and what stands
  // out follow inside RecordView's main column).
  const main = page.slice(page.indexOf('const main ='));
  const order = ['<YourChapters', '<YourPace', '<WhereMarksGo', 'rd-subj'].map((s) => main.indexOf(s));
  assert.ok(order.every((at) => at > 0), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const record = read('src/components/ai/RecordView.jsx');
  assert.match(record, /desk\.side/);
  assert.match(record, /desk\.main/);
  assert.ok(record.indexOf('desk.main') < record.indexOf('<AnswerSheet', record.indexOf('desk.main')), 'the new blocks come before the answer sheet');
  for (const file of ['YourChapters.jsx', 'YourPace.jsx', 'WhereMarksGo.jsx']) {
    const src = read(`src/app/(app)/analytics/${file}`);
    assert.doesNotMatch(src.split('\n').filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n'), /[0-9]+%|percent/i, `${file} prints no percentage`);
    assert.doesNotMatch(src, /chart\.js|recharts|d3/, `${file}: no chart library`);
  }
});
