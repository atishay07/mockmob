// Security pass, 15 Nov 2026 (lane SF-A): the Explore feed, Saved, POST /api/questions and the record readers.
//   L3 / social S1  GET /api/questions/feed answered anyone, cached signed-out answers on the CDN for 5 minutes, searched
//                   the bank for anyone and read every column (the 35 KB signed records too). Now: signed-in only (cookie or
//                   the app's bearer), never cacheable, search limited per reader, the page read without the heavy records.
//   L3 / social S2  the feed and Saved gave the key of a question the reader's Mob still holds (or that sits in their running
//                   session). Now such a question is left out (src/lib/server/heldQuestions.js).
//   social S2       POST /api/questions wrote into the bank with no flag, no limit and the body's own id and source.
//   L5 (+ cross)    /api/prepos/insights, /api/analytics and /api/compass/pro read held Mob papers' per-question results.
// The real route modules run here with auth, the database client, the limiter and data/db replaced by in-memory stand-ins.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mobWeek, nextOpensAt } from '../../src/lib/mob/model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTENSIONS = ['', '.js', '.mjs', '.ts', '/index.js'];
const probe = (base) => {
  for (const extension of EXTENSIONS) {
    const file = base + extension;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return pathToFileURL(file).href;
  }
  return null;
};
const stub = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---------------------------------------------------------------- stand-ins
const STUBS = {
  '@/lib/auth': 'export const auth = async (request) => { globalThis.__f.authCalls += 1; return globalThis.__f.who(request); };',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__f.db; export const supabase = new Proxy({}, { get: (_, k) => globalThis.__f.db[k] });',
  '@/lib/server/rateLimit': [
    'export const checkRateLimit = () => ({ allowed: true, limit: 180, remaining: 179 });',
    'export const checkPersistentRateLimit = async (request, options) => { globalThis.__f.limitCalls.push(options); return globalThis.__f.limit(options); };',
    'export const rateLimitHeaders = (r) => ({ "X-RateLimit-Limit": String(r.limit) });',
  ].join('\n'),
  '@/lib/server/requestDiagnostics': 'export const startRequestDiagnostics = () => ({}); export const finishRequestDiagnostics = () => {}; export const failRequestDiagnostics = () => {};',
  '@/../data/db': [
    'export const Database = {',
    '  getUserVotes: async () => new Map(),',
    '  getUserById: async (id) => ({ id, isPremium: globalThis.__f.premium === true }),',
    '  addPendingQuestion: async (q) => { globalThis.__f.inserted.push(q); return { id: "q_server_made", status: "pending" }; },',
    '  getAttempts: async (userId, options) => { globalThis.__f.attemptReads.push(options); return structuredClone(globalThis.__f.attempts); },',
    '};',
  ].join('\n'),
  // The publication gate, reduced to the one thing these tests need from it: a row that carries a record (its light stub says so)
  // passes only when it reaches the gate WHOLE, as the real gate needs the record to check its signature.
  '@/../data/practice_library': 'export async function readablePracticeQuestions(rows) { return rows.filter((r) => !r.unreadable && (!(r.ev_policy || r.prov_kind) || r.evidence || r.provenance)); }',
  '@/../scripts/pipeline/lib/bankSnapshot.mjs': 'export const attachBankPassages = async (db, rows) => rows;',
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

// A small PostgREST-like fake: select with column lists, aliases and json paths; eq, in, gt, gte, not is null, range, limit.
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
function fakeDb(tables, { errors = {} } = {}) {
  const calls = [];
  return {
    calls,
    from(name) {
      const s = { select: '*', eq: [], in: [], gt: [], gte: [], notNull: [], or: [], range: null, limit: null };
      const run = () => {
        if (errors[name]) return { data: null, error: errors[name] };
        let rows = (tables[name] || []).slice();
        for (const [c, v] of s.eq) rows = rows.filter((r) => evalPath(r, c) === v);
        for (const [c, v] of s.in) rows = rows.filter((r) => v.includes(evalPath(r, c)));
        for (const [c, v] of s.gt) rows = rows.filter((r) => evalPath(r, c) !== null && evalPath(r, c) > v);
        for (const [c, v] of s.gte) rows = rows.filter((r) => evalPath(r, c) !== null && evalPath(r, c) >= v);
        for (const c of s.notNull) rows = rows.filter((r) => evalPath(r, c) !== null);
        if (s.range) rows = rows.slice(s.range[0], s.range[1] + 1);
        if (s.limit !== null) rows = rows.slice(0, s.limit);
        calls.push({ table: name, select: s.select, in: s.in.map(([c, v]) => [c, [...v]]), or: [...s.or] });
        return { data: rows.map((r) => project(r, s.select)), error: null };
      };
      const q = {
        select(columns) { s.select = columns ?? '*'; return q; },
        eq(c, v) { s.eq.push([c, v]); return q; },
        in(c, v) { s.in.push([c, v]); return q; },
        gt(c, v) { s.gt.push([c, v]); return q; },
        gte(c, v) { s.gte.push([c, v]); return q; },
        not(c, op, v) { assert.equal(op, 'is'); assert.equal(v, null); s.notNull.push(c); return q; },
        or(expression) { s.or.push(expression); return q; },
        order() { return q; },
        range(a, b) { s.range = [a, b]; return q; },
        limit(n) { s.limit = n; return q; },
        maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error }; },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return q;
    },
  };
}

// ---------------------------------------------------------------- fixtures
const NOW = Date.now();
const WEEK = mobWeek(NOW);
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3_600_000;
const question = (id, extra = {}) => ({
  id, subject: 'accountancy', chapter: 'Accounting Ratios', question: `Stem of ${id}`, body: null,
  options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_index: 1, correct_answer: 'B',
  explanation: `Why ${id}`, difficulty: 'easy', status: 'live', is_deleted: false, verification_state: 'verified',
  exploration_state: 'active', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
  upvotes: 0, downvotes: 0, score: 0, tags: [], evidence: null, provenance: null, ...extra,
});
const RECORD = { record: { state: 'verified', policy_version: 'factory-v9', family_id: 'fam1', checks: { key: true, arithmetic: true }, sources: ['ncert:12:acc:4'], signature: 'x'.repeat(2000) } };
const BANK = [
  question('q1'), // nobody holds it
  question('q2'), // this week's Mob paper of u-app's Mob
  question('q3'), // an open game of that Mob
  question('q4'), // an open extra paper of that Mob
  question('q5'), // a held Mob paper u-app finished (another Mob, since left)
  question('q6'), // u-app's running durable session
  question('q7'), // a closed game: its hold is over
  question('q8', { evidence: RECORD, provenance: { kind: 'factory' } }), // a managed row: read whole for the gate
];
const appTables = () => ({
  questions: structuredClone(BANK),
  mob_members: [{ mob_id: 'mob-a', user_id: 'u-app' }, { mob_id: 'mob-a', user_id: 'u-friend' }],
  mob_papers: [{ mob_id: 'mob-a', week_start: WEEK, question_ids: ['q2'] }, { mob_id: 'mob-a', week_start: '2026-01-05', question_ids: ['q7'] }],
  mob_extras: [{ mob_id: 'mob-a', closes_at: iso(NOW + 2 * 24 * HOUR), question_ids: ['q4'] }],
  mob_games: [{ mob_id: 'mob-a', closes_at: iso(NOW + HOUR), question_ids: ['q3'] }, { mob_id: 'mob-a', closes_at: iso(NOW - HOUR), question_ids: ['q7'] }],
  recovery_sessions: [
    { user_id: 'u-app', state: 'active', expires_at: iso(NOW + HOUR), questions: [{ id: 'q6' }] },
    { user_id: 'u-app', state: 'submitted', expires_at: iso(NOW + HOUR), questions: [{ id: 'q1' }] },
    { user_id: 'u-app', state: 'active', expires_at: iso(NOW - HOUR), questions: [{ id: 'q1' }] },
  ],
  attempts: [{ id: 'att-held', user_id: 'u-app', completed_at: iso(NOW - HOUR), selection_meta: { mobPaper: { mobId: 'mob-old', weekStart: WEEK, holdUntil: nextOpensAt(WEEK) } }, details: [{ qid: 'q5', isCorrect: true }] }],
  question_bookmarks: [],
  passage_groups: [],
});

const COOKIE = 'sb-abcd-auth-token=base64-session';
const who = (request) => {
  const authorization = request.headers.get('authorization');
  if (authorization === 'Bearer app-token') return { user: { id: 'u-app' } };
  if (authorization === 'Bearer friend-token') return { user: { id: 'u-friend' } };
  if (authorization === 'Bearer stranger-token') return { user: { id: 'u-stranger' } };
  if (!authorization && (request.headers.get('cookie') || '').includes(COOKIE)) return { user: { id: 'u-app' } };
  return null;
};
function reset({ tables = appTables(), errors = {}, limit = () => ({ allowed: true, limit: 20, remaining: 19 }), attempts = [], premium = false } = {}) {
  globalThis.__f = { db: fakeDb(tables, { errors }), who, authCalls: 0, limitCalls: [], limit, inserted: [], attempts, attemptReads: [], premium };
  return globalThis.__f;
}
reset();

const feed = await import(pathToFileURL(path.join(ROOT, 'src/app/api/questions/feed/route.js')).href);
const bookmarks = await import(pathToFileURL(path.join(ROOT, 'src/app/api/bookmarks/route.js')).href);
const questions = await import(pathToFileURL(path.join(ROOT, 'src/app/api/questions/route.js')).href);
const insights = await import(pathToFileURL(path.join(ROOT, 'src/app/api/prepos/insights/route.js')).href);
const analytics = await import(pathToFileURL(path.join(ROOT, 'src/app/api/analytics/route.js')).href);
const compass = await import(pathToFileURL(path.join(ROOT, 'src/app/api/compass/pro/route.js')).href);
const { readHeldQuestionIds } = await import(pathToFileURL(path.join(ROOT, 'src/lib/server/heldQuestions.js')).href);

const feedRequest = (query = 'subject=accountancy&limit=20', headers = {}) => new Request(`https://www.mockmob.in/api/questions/feed?${query}`, { headers });
const app = { authorization: 'Bearer app-token' };
const noSharedCache = (response) => {
  assert.equal(response.headers.get('cdn-cache-control'), null, 'no CDN-Cache-Control');
  assert.equal(response.headers.get('vercel-cdn-cache-control'), null);
  const cache = response.headers.get('cache-control') || '';
  assert.match(cache, /no-store/);
  assert.match(cache, /private/);
  assert.doesNotMatch(cache, /public|s-maxage|stale-while-revalidate/);
};

// ---------------------------------------------------------------- the feed: who may read it
test('feed: no session and no bearer is 401 with a JSON error, nothing is read and nothing may be cached', async () => {
  const f = reset();
  for (const headers of [{}, { authorization: 'Bearer forged' }, { cookie: 'sb-abcd-auth-token=' }, { cookie: 'theme=dark' }]) {
    const response = await feed.GET(feedRequest('subject=accountancy&limit=50&offset=0', headers));
    assert.equal(response.status, 401, JSON.stringify(headers));
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
    noSharedCache(response);
  }
  assert.equal(f.db.calls.length, 0, 'no question, hold or bookmark read for a refused caller');
  const searched = await feed.GET(feedRequest('subject=accountancy&search=goodwill%20is'));
  assert.equal(searched.status, 401, 'search too');
  assert.equal(f.limitCalls.length, 0);
});

test('feed: the app bearer still gets keys and explanations for questions nobody holds, in the same shape, never cacheable', async () => {
  reset();
  const response = await feed.GET(feedRequest('subject=accountancy&limit=20', { authorization: 'Bearer stranger-token' }));
  assert.equal(response.status, 200);
  noSharedCache(response);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['hasMore', 'nextOffset', 'questions', 'total']);
  assert.deepEqual(body.questions.map((q) => q.id), BANK.map((q) => q.id), 'a stranger to the Mob has nothing held');
  const q1 = body.questions.find((q) => q.id === 'q1');
  assert.deepEqual(Object.keys(q1).sort(), ['ai_score', 'ai_tier', 'body', 'chapter', 'correct_answer', 'difficulty', 'downvotes', 'explanation', 'id', 'option_order', 'options', 'order_index', 'passage_group_id', 'passage_text', 'saved', 'score', 'source_refs', 'subject', 'tags', 'upvotes', 'userVote', 'verification_methods', 'verification_state'].sort());
  assert.match(q1.correct_answer, /^[A-D]$/);
  assert.equal(q1.explanation, 'Why q1');
  assert.equal(body.nextOffset, BANK.length);
});

test('feed: a signed-in website reader (session cookie) is served', async () => {
  reset();
  const response = await feed.GET(feedRequest('subject=accountancy', { cookie: COOKIE }));
  assert.equal(response.status, 200);
  noSharedCache(response);
});

// ---------------------------------------------------------------- the feed: held questions
test('feed: a question the reader\'s Mob holds, a held paper of theirs or their running session is left out; nextOffset still counts it', async () => {
  reset();
  const body = await (await feed.GET(feedRequest('subject=accountancy&limit=20', app))).json();
  assert.deepEqual(body.questions.map((q) => q.id), ['q1', 'q7', 'q8']);
  const text = JSON.stringify(body);
  for (const id of ['q2', 'q3', 'q4', 'q5', 'q6']) {
    assert.ok(!text.includes(`"${id}"`), `${id} absent`);
    assert.ok(!text.includes(`Why ${id}`), `${id}'s explanation absent`);
  }
  assert.equal(body.nextOffset, BANK.length, 'paging advances over the raw rows');
  assert.equal(body.hasMore, false);
  // Another member of the same Mob: its paper, game and extra are held for them too, but not u-app's own paper or session.
  const friend = await (await feed.GET(feedRequest('subject=accountancy&limit=20', { authorization: 'Bearer friend-token' }))).json();
  assert.deepEqual(friend.questions.map((q) => q.id), ['q1', 'q5', 'q6', 'q7', 'q8']);
});

test('feed: when the holds cannot be read, no key is sent (500)', async () => {
  reset({ errors: { mob_members: { code: '57014', message: 'statement timeout' } } });
  const response = await feed.GET(feedRequest('subject=accountancy', app));
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.doesNotMatch(text, /correct_answer|Why q/);
  noSharedCache(response);
});

// ---------------------------------------------------------------- the feed: what it reads
test('feed: the page is never read with every column; only rows that carry a record are read whole, and keep their fields', async () => {
  const f = reset();
  const body = await (await feed.GET(feedRequest('subject=accountancy', { authorization: 'Bearer stranger-token' }))).json();
  const reads = f.db.calls.filter((c) => c.table === 'questions');
  const page = reads[0];
  assert.notEqual(page.select.trim(), '*');
  const columns = page.select.split(',').map((c) => c.trim());
  assert.ok(!columns.includes('evidence') && !columns.includes('provenance') && !columns.some((c) => c.startsWith('*')), 'no heavy record in the page read');
  for (const needed of ['id', 'question', 'options', 'correct_index', 'correct_answer', 'explanation', 'upvotes', 'downvotes', 'score']) assert.ok(columns.includes(needed), needed);
  const whole = reads.filter((c) => c.select.trim() === '*');
  assert.equal(whole.length, 1, 'one whole read');
  assert.deepEqual(whole[0].in, [['id', ['q8']]], 'only the managed row is read whole');
  const q8 = body.questions.find((q) => q.id === 'q8');
  assert.equal(q8.verification_state, 'verified');
  assert.deepEqual(q8.verification_methods, ['key', 'arithmetic']);
  assert.deepEqual(q8.source_refs, ['ncert:12:acc:4']);
  assert.ok(!JSON.stringify(body).includes('signature'), 'the record itself never leaves');
  assert.equal(body.questions.find((q) => q.id === 'q1').verification_state, 'legacy');
});

// ---------------------------------------------------------------- the feed: search
test('feed: search is limited per reader in the database limiter; a refused search reads nothing', async () => {
  let f = reset();
  await feed.GET(feedRequest('subject=accountancy', app));
  assert.equal(f.limitCalls.length, 0, 'a plain page costs no limiter call');
  await feed.GET(feedRequest('subject=accountancy&search=a', app));
  assert.equal(f.limitCalls.length, 0, 'a one-letter search is no search');
  const ok = await feed.GET(feedRequest('subject=accountancy&search=ratio%20analysis', app));
  assert.equal(ok.status, 200);
  assert.equal(f.limitCalls.length, 2);
  for (const options of f.limitCalls) {
    assert.deepEqual(options.keyParts, ['u-app']);
    assert.equal(options.identityOnly, true);
    assert.equal(options.fallback, 'memory');
    assert.equal(options.persistent, process.env.NODE_ENV === 'production');
  }
  assert.deepEqual(f.limitCalls.map((o) => [o.limit, o.windowMs]), [[20, 600_000], [60, 86_400_000]]);
  f = reset({ limit: (o) => ({ allowed: o.windowMs !== 86_400_000, limit: o.limit, remaining: 0, retryAfterSeconds: 3600 }) });
  const refused = await feed.GET(feedRequest('subject=accountancy&search=ratio%20analysis', app));
  assert.equal(refused.status, 429);
  assert.match((await refused.json()).error, /Too many searches/);
  noSharedCache(refused);
  assert.equal(f.db.calls.filter((c) => c.table === 'questions').length, 0, 'no question read after a refusal');
});

test('feed source: auth first, no CDN header, no signed-out branch', () => {
  const src = read('src/app/api/questions/feed/route.js');
  assert.doesNotMatch(src, /CDN-Cache-Control|s-maxage|SIGNED_OUT_CACHE|signedOutReader/);
  assert.doesNotMatch(src, /select\(\s*'\*'|baseSelect = '\*'/);
  assert.ok(src.indexOf('await auth(request)') < src.indexOf('await buildQuery(true)'));
  assert.ok(src.indexOf("{ error: 'Unauthorized' }, { status: 401 }") < src.indexOf('await buildQuery(true)'));
});

// ---------------------------------------------------------------- Saved
test('Saved: a saved question the reader\'s Mob holds comes back without its key (left out); the others keep theirs', async () => {
  const tables = appTables();
  tables.question_bookmarks = ['q1', 'q2', 'q5', 'q6'].map((id, i) => ({ user_id: 'u-app', question_id: id, created_at: iso(NOW - i * HOUR) }));
  reset({ tables });
  const response = await bookmarks.GET(new Request('https://www.mockmob.in/api/bookmarks', { headers: app }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.questionIds, ['q1', 'q2', 'q5', 'q6'], 'the saved ids and the count are unchanged');
  assert.equal(body.count, 4);
  assert.deepEqual(body.questions.map((q) => q.id), ['q1']);
  assert.match(body.questions[0].correct_answer, /^[A-D]$/);
  assert.equal(body.questions[0].explanation, 'Why q1');
  const text = JSON.stringify(body.questions);
  for (const id of ['q2', 'q5', 'q6']) assert.ok(!text.includes(`Why ${id}`) && !text.includes(`Stem of ${id}`), id);
  // A member who is not holding anything gets every saved question with its key.
  const others = appTables();
  others.question_bookmarks = [{ user_id: 'u-stranger', question_id: 'q2', created_at: iso(NOW) }];
  reset({ tables: others });
  const stranger = await (await bookmarks.GET(new Request('https://www.mockmob.in/api/bookmarks', { headers: { authorization: 'Bearer stranger-token' } }))).json();
  assert.deepEqual(stranger.questions.map((q) => [q.id, q.explanation]), [['q2', 'Why q2']]);
});

test('Saved: when the holds cannot be read, the list fails instead of sending keys', async () => {
  const tables = appTables();
  tables.question_bookmarks = [{ user_id: 'u-app', question_id: 'q2', created_at: iso(NOW) }];
  reset({ tables, errors: { mob_papers: { code: '57014', message: 'statement timeout' } } });
  const response = await bookmarks.GET(new Request('https://www.mockmob.in/api/bookmarks', { headers: app }));
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /Why q2/);
});

// ---------------------------------------------------------------- the hold reader
test('the hold reader: tables that are not there hold nothing; nothing for no user', async () => {
  const missing = { code: '42P01', message: 'relation does not exist' };
  const db = fakeDb(appTables(), { errors: { mob_games: missing, recovery_sessions: missing } });
  assert.deepEqual([...(await readHeldQuestionIds(db, 'u-app'))].sort(), ['q2', 'q4', 'q5']);
  assert.equal((await readHeldQuestionIds(db, null)).size, 0);
  assert.equal((await readHeldQuestionIds(null, 'u-app')).size, 0);
});

// ---------------------------------------------------------------- POST /api/questions
const post = (body, headers = app) => new Request('https://www.mockmob.in/api/questions', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const goodQuestion = { subject: 'accountancy', chapter: 'Accounting Ratios', question: 'What does a current ratio of 2:1 mean?', options: ['One', 'Two', 'Three', 'Four'], correctIndex: 1 };

test('POST /api/questions is 404 while CONTRIBUTE_ENABLED is not true, before any auth or write', async () => {
  for (const value of [undefined, '', 'false', '1', 'TRUE']) {
    if (value === undefined) delete process.env.CONTRIBUTE_ENABLED; else process.env.CONTRIBUTE_ENABLED = value;
    const f = reset();
    const response = await questions.POST(post({ ...goodQuestion, id: 'q_mine', source: 'pyq' }));
    assert.equal(response.status, 404, String(value));
    assert.equal(f.authCalls, 0);
    assert.equal(f.inserted.length, 0);
    assert.equal(f.limitCalls.length, 0);
  }
  delete process.env.CONTRIBUTE_ENABLED;
  assert.equal((await questions.GET()).status, 409, 'GET keeps its 409');
});

test('POST /api/questions switched on: ignores id and source, caps every field and the body, limits per student', async () => {
  process.env.CONTRIBUTE_ENABLED = 'true';
  try {
    let f = reset();
    const created = await questions.POST(post({ ...goodQuestion, id: 'q_mine', source: 'pyq', status: 'live', uploadedBy: 'someone-else' }));
    assert.equal(created.status, 201);
    assert.equal(f.inserted.length, 1);
    const row = f.inserted[0];
    assert.equal(row.id, undefined);
    assert.equal(row.source, undefined);
    assert.equal(row.status, undefined);
    assert.equal(row.uploadedBy, 'u-app');
    assert.deepEqual(Object.keys(row).sort(), ['chapter', 'correctIndex', 'difficulty', 'explanation', 'options', 'question', 'subject', 'uploadedBy']);
    assert.deepEqual(f.limitCalls.map((o) => [o.limit, o.windowMs, o.keyParts[0], o.identityOnly, o.fallback]), [[30, 60_000, 'u-app', true, 'memory'], [200, 86_400_000, 'u-app', true, 'memory']]);

    const tooBig = [
      { ...goodQuestion, question: 'x'.repeat(2_001) },
      { ...goodQuestion, options: ['a'.repeat(501), 'b', 'c', 'd'] },
      { ...goodQuestion, options: ['a', 'b', 'c', 'd', 'e', 'f'], correctIndex: 0 },
      { ...goodQuestion, explanation: 'y'.repeat(3_001) },
      { ...goodQuestion, chapter: 'z'.repeat(161) },
      { ...goodQuestion, subject: 's'.repeat(61) },
      { ...goodQuestion, difficulty: 'impossible' },
    ];
    for (const body of tooBig) {
      f = reset();
      const response = await questions.POST(post(body));
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80));
      assert.equal(f.inserted.length, 0);
    }
    f = reset();
    const huge = await questions.POST(post(JSON.stringify({ ...goodQuestion, padding: 'p'.repeat(20_000) })));
    assert.equal(huge.status, 413);
    assert.equal(f.inserted.length, 0);

    f = reset({ limit: (o) => ({ allowed: false, limit: o.limit, remaining: 0, retryAfterSeconds: 60 }) });
    const limited = await questions.POST(post(goodQuestion));
    assert.equal(limited.status, 429);
    assert.equal(f.inserted.length, 0);

    f = reset();
    assert.equal((await questions.POST(post(goodQuestion, {}))).status, 401);
    assert.equal(f.inserted.length, 0);
  } finally {
    delete process.env.CONTRIBUTE_ENABLED;
  }
});

// ---------------------------------------------------------------- the record readers (L5 and the cross-lane note)
const snap = (id, chapter) => ({ id, subject: 'accountancy', chapter, difficulty: 'easy' });
const attempt = (id, items, extra = {}) => ({
  id, userId: 'u-app', subject: 'accountancy', score: 0, correct: items.filter((i) => i[2] === true).length, wrong: items.filter((i) => i[2] === false).length,
  unattempted: items.filter((i) => i[2] === null).length, total: items.length, completedAt: NOW - 2 * HOUR,
  questionsSnapshot: items.map(([qid, chapter]) => snap(qid, chapter)),
  details: items.map(([qid, , isCorrect], index) => ({ qid, isCorrect, givenIndex: isCorrect === null ? -1 : index % 4 })),
  selectionMeta: { mode: 'quick', scoringVersion: 'server_practice_v1' }, ...extra,
});
const heldTag = { mode: 'quick', scoringVersion: 'server_practice_v1', mobPaper: { mobId: 'mob-a', weekStart: WEEK, holdUntil: nextOpensAt(WEEK) } };
// An open paper on Ratios (many questions), a held Mob paper by its tag (Partnership chapter, all wrong) and a held Mob paper whose
// tag the summary-function tier dropped (Goodwill chapter): only the attempts table still knows it is held.
const OPEN = attempt('att-open', Array.from({ length: 30 }, (_, i) => [`r${i}`, 'Accounting Ratios', i % 3 === 0 ? false : true]));
const HELD = attempt('att-held-tag', Array.from({ length: 5 }, (_, i) => [`p${i}`, 'Admission of a Partner', false]), { selectionMeta: heldTag, completedAt: NOW - HOUR });
const UNTAGGED = attempt('att-held-id', Array.from({ length: 5 }, (_, i) => [`g${i}`, 'Goodwill Valuation', false]), { completedAt: NOW - 30 * 60_000 });
const recordTables = () => ({
  ...appTables(),
  attempts: [{ id: 'att-held-id', user_id: 'u-app', completed_at: iso(NOW - 30 * 60_000), selection_meta: { mobPaper: { mobId: 'mob-a', weekStart: WEEK, gameId: 'g1', holdUntil: iso(NOW + HOUR) } }, details: UNTAGGED.details }],
});
const heldQids = [...HELD.details, ...UNTAGGED.details].map((d) => d.qid);
const leaksNoHeldQuestion = (text) => {
  for (const qid of heldQids) assert.ok(!text.includes(`"${qid}"`), qid);
  assert.doesNotMatch(text, /Admission of a Partner|Goodwill Valuation|att-held/);
};

test('/api/prepos/insights: a held Mob paper (by its tag, or by its id when the tag was dropped) is not in the record', async () => {
  const f = reset({ tables: recordTables(), attempts: [UNTAGGED, HELD, OPEN] });
  const response = await insights.GET(new Request('https://www.mockmob.in/api/prepos/insights', { headers: app }));
  assert.equal(response.status, 200);
  const text = await response.text();
  leaksNoHeldQuestion(text);
  const body = JSON.parse(text);
  assert.equal(body.insights.sessions, 1);
  assert.ok(body.insights.chapters.ranked.some((c) => c.chapter === 'Accounting Ratios'));
  assert.deepEqual(f.attemptReads, [{ limit: 60, slim: 'insights' }]);
  // Without any held paper the record is exactly as before.
  reset({ tables: { ...appTables(), attempts: [] }, attempts: [OPEN] });
  assert.equal((await (await insights.GET(new Request('https://www.mockmob.in/api/prepos/insights', { headers: app }))).json()).insights.sessions, 1);
  // A failed hold read is the route's own 503, never the unfiltered record.
  reset({ tables: recordTables(), attempts: [UNTAGGED, HELD, OPEN], errors: { attempts: { code: '57014' } } });
  assert.equal((await insights.GET(new Request('https://www.mockmob.in/api/prepos/insights', { headers: app }))).status, 503);
});

test('/api/analytics: chapters are counted without held papers; their marks and counts still show', async () => {
  reset({ tables: recordTables(), attempts: [UNTAGGED, HELD, OPEN] });
  const response = await analytics.GET(new Request('https://www.mockmob.in/api/analytics', { headers: app }));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.doesNotMatch(text, /Admission of a Partner|Goodwill Valuation/, 'no chapter of a held paper');
  const body = JSON.parse(text);
  assert.deepEqual(body.weakChapters.map((c) => c.chapter), ['Accounting Ratios']);
  assert.equal(body.totalAttempts, 3, 'the timeline keeps every paper\'s marks');
  assert.equal(body.timeline.length, 3);
  assert.deepEqual(body.totals, { correct: 20, wrong: 20, unattempted: 0 }, 'the counts a held result shows anyway');
});

test('/api/compass/pro: the next move is ranked without held papers; the projection keeps subject totals', async () => {
  reset({ tables: recordTables(), attempts: [UNTAGGED, HELD, OPEN], premium: true });
  const response = await compass.GET(new Request('https://www.mockmob.in/api/compass/pro', { headers: app }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.locked, false);
  assert.equal(body.projection.next.chapter.name, 'Accounting Ratios');
  assert.doesNotMatch(JSON.stringify(body), /Admission of a Partner|Goodwill Valuation/);
  assert.equal(body.projection.papers[0].n, 40, 'subject totals: the held papers\' counts are part of the paper projection');
});

test('record readers source: each filters held papers by tag and by id', () => {
  for (const file of ['src/app/api/prepos/insights/route.js', 'src/app/api/analytics/route.js', 'src/app/api/compass/pro/route.js']) {
    const src = read(file);
    assert.match(src, /readHeldMobPapers\(supabaseAdmin\(\), (session\.user\.id|userId)\)/, file);
    assert.match(src, /openAttemptsOnly\(\w+\)\.filter\(\(a\) => !held\.byId\.has\(a\.id\)\)/, file);
  }
});
