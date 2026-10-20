// Privacy hotfix, 17 Oct 2026: GET /api/leaderboard was public and returned every ranked student's name,
// user id and photo (many are minors), plus invented "Practice rival" students beside the real ones.
// /api/learning/summary returned other users' ids and names in topContributors.
// The real route modules run here with auth and the database replaced by in-memory stand-ins.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
// State the stand-ins read, set per test.
globalThis.__lb = { session: null, rows: [], failBoard: false };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    if (specifier === 'next/server') return next('next/server.js', context);
    if (specifier === '@/lib/auth') return { url: stub('export const auth = async () => globalThis.__lb.session;'), shortCircuit: true };
    if (specifier === '@/../data/db') {
      return { url: stub('export const Database = { getLeaderboard: async () => { if (globalThis.__lb.failBoard) throw new Error("boom"); return structuredClone(globalThis.__lb.rows); } };'), shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const url = probe(path.join(ROOT, 'src', specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const { GET } = await import(pathToFileURL(path.join(ROOT, 'src/app/api/leaderboard/route.js')).href);
const { standingFor, topContributorCounts } = await import(pathToFileURL(path.join(ROOT, 'src/lib/server/standing.js')).href);

// Rows as Database.getLeaderboard returns them: names, images and ids are present at the source.
const ROWS = [
  { userId: 'u-top', name: 'Aanya Rao', image: 'https://img.example/aanya.png', tests: 9, totalScore: 720, avg: 80 },
  { userId: 'u-me', name: 'Me Myself', image: 'https://img.example/me.png', tests: 4, totalScore: 260, avg: 65 },
  { userId: 'u-tie', name: 'Tie Twin', image: null, tests: 2, totalScore: 260, avg: 130 },
  { userId: 'u-low', name: 'Low Score', image: null, tests: 1, totalScore: 40, avg: 40 },
  { userId: 'ghost', name: 'Unknown User', image: null, tests: 1, totalScore: 10, avg: 10 },
];
const request = () => new Request('https://www.mockmob.in/api/leaderboard');
const keysDeep = (value, found = new Set()) => {
  if (Array.isArray(value)) value.forEach((item) => keysDeep(item, found));
  else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) { found.add(key); keysDeep(inner, found); }
  return found;
};
const BANNED = ['name', 'image', 'userId', 'user_id', 'id', 'email', 'isSynthetic', 'label', 'avatar'];

test('signed out: 401, and nothing about any student is in the body', async () => {
  globalThis.__lb = { session: null, rows: ROWS, failBoard: false };
  const response = await GET(request());
  assert.equal(response.status, 401);
  const text = await response.text();
  for (const row of ROWS) { assert.ok(!text.includes(row.name)); assert.ok(!text.includes(row.userId)); }
});

test('a session with no user id is also refused', async () => {
  globalThis.__lb = { session: { user: {} }, rows: ROWS, failBoard: false };
  assert.equal((await GET(request())).status, 401);
});

test('a signed-in caller gets their own rank and the total, in the new shape only', async () => {
  globalThis.__lb = { session: { user: { id: 'u-me' } }, rows: ROWS, failBoard: false };
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  const body = await response.json();
  assert.deepEqual(body, { you: { rank: 2, of: 5, tests: 4, average: 65, points: 260 }, window: 'all time', board: { toNext: 460, top: 40, ladder: null, spread: null } });
});

test('equal points share a rank: the tied student is also 2nd, not 3rd', () => {
  assert.equal(standingFor(ROWS, 'u-tie').you.rank, 2);
  assert.equal(standingFor(ROWS, 'u-low').you.rank, 4);
  assert.equal(standingFor(ROWS, 'u-top').you.rank, 1);
});

test('the response has no name, image, userId or user_id key anywhere, and no student text', async () => {
  globalThis.__lb = { session: { user: { id: 'u-me' } }, rows: ROWS, failBoard: false };
  const body = await (await GET(request())).json();
  const keys = keysDeep(body);
  for (const banned of BANNED) assert.ok(!keys.has(banned), `unexpected key: ${banned}`);
  assert.deepEqual([...keys].sort(), ['average', 'board', 'ladder', 'of', 'points', 'rank', 'spread', 'tests', 'toNext', 'top', 'window', 'you']);
  const text = JSON.stringify(body);
  for (const row of ROWS) {
    assert.ok(!text.includes(row.name));
    assert.ok(!text.includes(row.userId));
    if (row.image) assert.ok(!text.includes(row.image));
  }
});

test('no synthetic rows: the invented practice rivals are gone from the route and from the answer', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/app/api/leaderboard/route.js'), 'utf8');
  assert.doesNotMatch(source, /PRACTICE_RIVALS|isSynthetic|Practice rival|practice_rival/);
  globalThis.__lb = { session: { user: { id: 'u-me' } }, rows: ROWS, failBoard: false };
  const body = await (await GET(request())).json();
  assert.equal(body.you.of, ROWS.length, 'the total counts real students only');
  assert.ok(!JSON.stringify(body).includes('synthetic'));
});

test('a signed-in student with no mocks gets you: null, and still no list', async () => {
  globalThis.__lb = { session: { user: { id: 'u-new' } }, rows: ROWS, failBoard: false };
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { you: null, window: 'all time' });
  assert.deepEqual(standingFor([], 'u-me'), { you: null, window: 'all time' });
  assert.deepEqual(standingFor(null, 'u-me'), { you: null, window: 'all time' });
});

test('a database failure is a 500 with a plain message and no student data', async () => {
  globalThis.__lb = { session: { user: { id: 'u-me' } }, rows: ROWS, failBoard: true };
  const originalError = console.error;
  console.error = () => {};
  try {
    // A fresh copy of the route: the board rows are kept two minutes per server (egress A13), and a server that holds none has
    // nothing to fall back on. (A server that does hold them keeps answering from them, which is the point of keeping them.)
    const { GET: freshGET } = await import(`${pathToFileURL(path.join(ROOT, 'src/app/api/leaderboard/route.js')).href}?no-cached-board`);
    const response = await freshGET(request());
    assert.equal(response.status, 500);
    const text = await response.text();
    for (const row of ROWS) assert.ok(!text.includes(row.name));
  } finally { console.error = originalError; }
});

test('topContributors keeps only counts: no id, no name, no image', () => {
  const rows = [
    ...Array.from({ length: 5 }, () => ({ uploaded_by: 'u-a' })),
    ...Array.from({ length: 3 }, () => ({ author_id: 'u-b' })),
    ...Array.from({ length: 2 }, () => ({ uploaded_by: 'u-c' })),
    { uploaded_by: 'u-d' },
    { uploaded_by: null, author_id: null },
  ];
  const top = topContributorCounts(rows);
  assert.deepEqual(top, [{ count: 5 }, { count: 3 }, { count: 2 }]);
  const keys = keysDeep(top);
  for (const banned of ['id', 'name', 'image', 'userId', 'user_id', 'uploaded_by', 'author_id']) assert.ok(!keys.has(banned));
  assert.deepEqual(topContributorCounts(undefined), []);
});

test('the learning summary route builds topContributors from counts and no longer reads other users', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/app/api/learning/summary/route.js'), 'utf8');
  assert.match(source, /topContributorCounts\(/);
  assert.doesNotMatch(source, /name: 'Contributor'|userMap|\.from\('users'\)/, 'no lookup of other users remains');
  assert.match(source, /auth\(request\)/);
});

test('no client still reads a student list from /api/leaderboard', () => {
  for (const file of ['src/app/(app)/leaderboard/LeaderboardPageClient.jsx', 'src/app/(app)/dashboard/DashboardPageClient.jsx', 'src/app/preview/arena/ArenaPreviewClient.jsx']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /isSynthetic|realBoard|entries\.filter/, `${file} still reads a student list`);
  }
});

test('the board is anonymous places and counts, and a small board shows no ladder or spread (W-055)', async () => {
  const { boardFor, LADDER_MIN, LADDER_SIZE } = await import(pathToFileURL(path.join(ROOT, 'src/lib/server/standing.js')).href);
  const small = standingFor(ROWS, 'u-me');
  assert.equal(small.board.ladder, null, 'five students: no ladder anyone could be read off');
  assert.equal(small.board.spread, null);
  const many = Array.from({ length: LADDER_MIN + 5 }, (_, i) => ({ userId: `u${i}`, name: `Student ${i}`, image: `https://img.example/${i}.png`, tests: 2, totalScore: 200 - i * 4 }));
  const mine = standingFor(many, 'u12');
  assert.equal(mine.you.rank, 13);
  assert.equal(mine.board.toNext, 4, 'four points shares the next place up');
  assert.equal(mine.board.top, Math.ceil((13 / many.length) * 100));
  assert.equal(mine.board.ladder.length, LADDER_SIZE);
  assert.deepEqual(mine.board.ladder[0], { place: 1, points: 200, mocks: 2 });
  assert.equal(mine.board.spread.reduce((n, b) => n + b.students, 0), many.length, 'every ranked student is in one band');
  const text = JSON.stringify(mine);
  for (const row of many) { assert.ok(!text.includes(row.name)); assert.ok(!text.includes(row.image)); assert.ok(!text.includes(`"${row.userId}"`)); }
  for (const banned of BANNED) assert.ok(!keysDeep(mine).has(banned), `unexpected key: ${banned}`);
  assert.equal(boardFor([], 0).top, 100);
  assert.equal(standingFor(many, 'u0').board.toNext, 0, 'first place needs nothing');
});
