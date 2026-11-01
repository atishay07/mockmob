// Today in one call (speed.md item 4, LK28): GET /api/today authenticates once and runs the eight reads together; each part keeps
// its own status, the page reads it through useToday, and every later refresh calls the part's own route as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMove } from '../../src/lib/today/move.mjs';
import { leadOf, stakeOf } from '../../src/lib/today/lead.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const reads = read('src/lib/server/todayReads.js');
const hook = read('src/components/today/useToday.js');
const route = read('src/app/api/today/route.js');

const PARTS = {
  plan: '/api/learning/plan',
  papers: '/api/attempts/summary?limit=20',
  rhythm: '/api/me/rhythm',
  goal: '/api/me/goal',
  road: '/api/me/road',
  revise: '/api/me/revise',
  facts: '/api/me/timed-mock',
  record: '/api/me/repair-record?limit=100',
};

test('one route: one auth, the rate limit beside the reads, every part in one Promise.all', () => {
  assert.equal((route.match(/await auth\(request\)/g) || []).length, 1);
  assert.match(route, /await Promise\.all\(\[\s+checkPersistentRateLimit\(request, \{ route: '\/api\/today', limit: 60, keyParts: \[userId\] \}\),\s+todayReads\(userId\),\s+\]\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 429/);
  assert.match(route, /'Cache-Control': 'no-store'/);
  assert.match(reads, /export const TODAY_PARTS = \['plan', 'papers', 'rhythm', 'goal', 'road', 'revise', 'facts', 'record'\];/);
  assert.match(reads, /await Promise\.all\(TODAY_PARTS\.map\(\(name\) => reads\[name\]\(userId\)\.catch\(\(\) => unavailable\)\)\)/, 'a failing part never holds the others');
});

test('each part reads what its own route reads, with the same arguments the page sent', () => {
  // plan: GET /api/learning/plan with no query is learningRecord(userId, { subject: null, minutes: Number(null) = 0 }).
  assert.match(read('src/app/api/learning/plan/route.js'), /learningRecord\(userId, \{ subject: url\.searchParams\.get\('subject'\), minutes: Number\(url\.searchParams\.get\('minutes'\)\) \}\)/);
  assert.match(reads, /learningRecord\(userId, \{ subject: null, minutes: 0 \}\)/);
  assert.match(reads, /catch \(error\) \{ return learningFailure\(error\); \}/, 'a failed plan answers the status learningHttp would');
  // papers: the expired-session finaliser first (and the badge reset), then the first page of 20.
  const summary = read('src/app/api/attempts/summary/route.js');
  for (const call of ['finaliseExpiredSessionsForUser(supabaseSessionStore(supabaseAdmin(), {', 'onEpisodeCheck: reportFinalisedEpisodeCheck', 'forgetBadges(']) {
    assert.ok(summary.includes(call) && reads.includes(call), call);
  }
  assert.match(reads, /listAttemptSummaries\(supabaseAdmin\(\), userId, \{ cursor: null, limit: '20' \}\)/);
  for (const [file, call] of [['src/app/api/me/rhythm/route.js', 'getRhythm('], ['src/app/api/me/goal/route.js', 'getGoal('], ['src/app/api/me/road/route.js', 'getRoad('], ['src/app/api/me/timed-mock/route.js', 'timedMockFacts(']]) {
    assert.ok(read(file).includes(call) && reads.includes(call), `${file}: ${call}`);
  }
  assert.match(reads, /getRepairRecord\(userId, \{ limit: parseLimit\('100'\) \}\)/);
  // revise: the plain body (no ?queue=1) with today's key cards while the flag is on, and its own 503 body on a failure.
  assert.match(reads, /getRevise\(userId, \{ cap: capFrom\(null\), keyCards: readKeyCards, queue: null \}\)/);
  assert.match(reads, /\{ version: 1, state: 'unavailable', message: COPY\.revise\.unavailable, items: \[\] \}/);
  assert.match(read('src/lib/server/learningHttp.js'), /const \{ status, body \} = learningFailure\(error\);/);
});

test('useToday asks /api/today once and seeds each read at its own path; later asks call the old routes', () => {
  assert.equal((hook.match(/apiGet\('\/api\/today'\)/g) || []).length, 1);
  for (const [name, path] of Object.entries(PARTS)) {
    assert.ok(hook.includes(`from('${name}', '${path}')`), `${name} is seeded at ${path}`);
  }
  // Only the first ask (key 0, the first path) uses the seed, and never after the read fetched on its own.
  assert.match(hook, /const seeded = seed !== null && key === 0 && path === seedPath && !state\.own;/);
  assert.match(hook, /if \(!userId \|\| !path \|\| seeded\) return undefined;/);
  // A part is ready on a 2xx and an error with its code otherwise: unknown is never shown as zero.
  assert.match(hook, /if \(part\.status >= 200 && part\.status < 300\) return \{ path: seedPath, key: 0, status: 'ready', data: map\(part\.body\) \};/);
  assert.match(hook, /return \{ path: seedPath, key: 0, status: 'error', data: null, code: part\.status \|\| 0 \};/);
  // If /api/today fails, every part fetches its own route (seedFor answers null).
  assert.match(hook, /\.catch\(\(\) => \{ if \(alive\) setState\(\{ userId, status: 'error', parts: null \}\); \}\);/);
  assert.match(hook, /return part && Number\.isInteger\(part\.status\) \? part : null;/);
  // The preview answers /api/today from its own fixtures, so preview equals live.
  assert.match(read('src/app/preview/arena/ArenaPreviewClient.jsx'), /url\.pathname === '\/api\/today' && method === 'GET'/);
});

test('ruling 12: a brand-new student is shown no history and no marks, and the repair stake is the real per-wrong loss', () => {
  const now = Date.parse('2026-11-01T10:00:00Z');
  const move = buildMove({ facts: { sessions: 0, mocks: 0 }, papers: [], repaired: new Map(), firstSubject: 'accountancy', now });
  const lead = leadOf(move);
  assert.equal(move.id, 'dayOne');
  assert.equal(stakeOf(move), null, 'no marks line for a student with no papers');
  assert.doesNotMatch(JSON.stringify(lead), /mistakes? to repair|marks they cost you|marks lost/);
  // A repair counts wrong answers only (openMistakes reads paper.wrong), 6 marks each: the same rule as data/review_chapters.mjs
  // ("6 per wrong answer (5 not earned + the 1 penalty)"), so "marks they cost you" is the real figure.
  assert.match(read('data/review_chapters.mjs'), /marks lost\s+= 6 per wrong answer/);
  assert.match(read('src/lib/today/move.mjs'), /return Math\.max\(0, paper\.wrong - repaired\);/);
  assert.deepEqual(stakeOf({ id: 'repair', number: 3 }), { value: 18, word: 'marks they cost you' });
  // The preview's brand-new student on Today has no papers (it used to show a returning student's repair).
  const preview = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(preview, /fixture\.get\('student'\) === 'new' && fixture\.get\('view'\) === 'today' \? 'empty' : null/, 'no papers');
  assert.match(preview, /const state = fixture\.get\('data'\) \|\| \(newOnToday \? 'empty' : null\);/, 'no papers, sessions or chapters');
  assert.match(preview, /if \(kind === 'down' \|\| \(state === 'empty' && !newOnToday\)\)/, 'and Revise is empty, not unavailable');
});
