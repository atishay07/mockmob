import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBoardCache, createTtlMemo } from '../ttl_memo.js';
import { standingFor, topContributorCounts } from '../../src/lib/server/standing.js';
import { readCohortWithTime, MAX_CACHED_QUESTIONS } from '../../src/lib/server/cohortStats.js';

// Egress items A12, A13/F16, F17, F18 (20 Oct 2026): small shared reads kept briefly, and column narrowing with dead reads removed.
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIN = 60_000;

test('ttl memo: reused inside the TTL, read again after it, a failed or undefined read is never remembered, bounded', async () => {
  let t = 1_000;
  const memo = createTtlMemo({ ttlMs: 10 * MIN, max: 2, now: () => t, copy: (v) => JSON.parse(JSON.stringify(v)) });
  let reads = 0;
  const read = async () => { reads += 1; return [{ count: 5 }]; };
  const first = await memo.get('top', read);
  first[0].count = 999;
  assert.deepEqual(await memo.get('top', read), [{ count: 5 }], 'each caller gets its own copy');
  assert.equal(reads, 1);
  t += 10 * MIN + 1;
  await memo.get('top', read);
  assert.equal(reads, 2);
  let attempts = 0;
  await assert.rejects(memo.get('flaky', async () => { attempts += 1; throw new Error('down'); }), /down/);
  assert.equal(await memo.get('flaky', async () => { attempts += 1; return undefined; }), undefined);
  assert.equal(await memo.get('flaky', async () => { attempts += 1; return 'ok'; }), 'ok');
  assert.equal(attempts, 3, 'neither the error nor the undefined was remembered');
  await memo.get('a', async () => 1); await memo.get('b', async () => 2); await memo.get('c', async () => 3);
  assert.ok(memo.size <= 2);
});

test('F17: the learning summary keeps the contributor counts thirty minutes, and the counts are the same as from the rows', async () => {
  const route = src('src/app/api/learning/summary/route.js');
  assert.match(route, /const contributorMemo = createTtlMemo\(\{ ttlMs: 30 \* 60 \* 1000, max: 1/);
  assert.match(route, /contributorMemo\.get\('top', async \(\) => \{/);
  assert.match(route, /const topContributors = contributorResult \?\? \[\];/);
  const rows = Array.from({ length: 40 }, (_, i) => ({ uploaded_by: `u${i % 4}`, author_id: null, status: 'live' }));
  const memo = createTtlMemo({ ttlMs: 30 * MIN, max: 1, copy: (v) => JSON.parse(JSON.stringify(v)) });
  let reads = 0;
  const readTop = () => memo.get('top', async () => { reads += 1; return topContributorCounts(rows); });
  assert.deepEqual(await readTop(), topContributorCounts(rows));
  assert.deepEqual(await readTop(), topContributorCounts(rows));
  assert.equal(reads, 1, 'two summaries cost one questions read');
  assert.ok((await readTop()).every((entry) => Object.keys(entry).join() === 'count'), 'bare counts only');
});

test('A12: the AI context reads only the columns its summaries read, and the unused votes read is gone', () => {
  const file = src('src/services/ai/getStudentAIContext.js');
  assert.doesNotMatch(file, /question_votes/);
  assert.doesNotMatch(file, /voteRows/);
  const columns = /PROGRESS_COLUMNS = '([^']+)'/.exec(file)[1].split(',');
  // every field of a progress row that a helper reads is in the column list
  const helpers = ['summarizeWeakness', 'countFastWrong', 'computeSlowness', 'countRepeatedWrong', 'summarizeSkipped'];
  const read = new Set();
  for (const name of helpers) {
    const start = file.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    const body = file.slice(start, file.indexOf('\n}\n', start));
    for (const m of body.matchAll(/(?:row|r)\.([a-z_]+)/g)) read.add(m[1]);
  }
  for (const field of read) assert.ok(columns.includes(field), `${field} is read but not selected`);
  assert.deepEqual(columns.sort(), ['attempt_count', 'best_dwell_ms', 'chapter', 'correct_count', 'skip_count', 'subject']);
  assert.match(file, /safeSelect\('question_bookmarks', userId, 500, 'created_at'\)/);
  assert.match(file, /selectedSubjects: effectiveUser\?\.subjects/, 'the context still builds');
});

test('A13/F16: the board rows are kept two minutes, only the caller\'s own row is live, and the standing is the same as from a fresh board', async () => {
  let t = 5_000_000;
  const cache = createBoardCache({ ttlMs: 2 * MIN, now: () => t });
  const rows = Array.from({ length: 800 }, (_, i) => ({ userId: `u${i}`, name: `Name ${i}`, image: `https://img/${i}`, tests: 1 + (i % 9), totalScore: (i * 37) % 900 }));
  let boardReads = 0;
  const loadRows = async () => { boardReads += 1; return rows; };
  const own = { u10: { tests: rows[10].tests, totalScore: rows[10].totalScore } };
  const loadOwn = async (id) => own[id] ?? (rows.find((r) => r.userId === id) ? { tests: rows.find((r) => r.userId === id).tests, totalScore: rows.find((r) => r.userId === id).totalScore } : { tests: 0, totalScore: 0 });
  const standing = async (id) => standingFor(await cache.rowsFor(id, { loadRows, loadOwn }), id);
  const fresh = (id) => standingFor(rows, id);
  assert.deepEqual(await standing('u10'), fresh('u10'));
  assert.deepEqual(await standing('u500'), fresh('u500'));
  assert.deepEqual(await standing('nobody'), fresh('nobody'));
  assert.equal(boardReads, 1, 'three students inside two minutes cost one board read');
  // The caller finishes a mock: their own row is live, so their rank moves at once
  own.u10 = { tests: rows[10].tests + 1, totalScore: rows[10].totalScore + 400 };
  const moved = await standing('u10');
  assert.equal(moved.you.points, rows[10].totalScore + 400);
  assert.equal(moved.you.tests, rows[10].tests + 1);
  assert.ok(moved.you.rank < fresh('u10').you.rank);
  assert.equal(boardReads, 1);
  // a brand new student appears on the board for themselves
  own.newbie = { tests: 1, totalScore: 55 };
  assert.equal((await standing('newbie')).you.of, rows.length + 1);
  // the other rows come from the cache and are not mutated by the substitution
  assert.equal(rows[10].totalScore, (10 * 37) % 900);
  // a failed own read keeps the cached row; the board is read again after the TTL
  assert.deepEqual(await standingFor(await cache.rowsFor('u10', { loadRows, loadOwn: async () => { throw new Error('down'); } }), 'u10'), fresh('u10'));
  t += 2 * MIN + 1;
  await standing('u10');
  assert.equal(boardReads, 2);
  // rows handed out carry no name or image
  const handed = await cache.rowsFor('u10', { loadRows, loadOwn });
  assert.ok(handed.every((r) => Object.keys(r).sort().join() === 'tests,totalScore,userId'));
});

test('A13/F16: narrowed rows (no name, no image) give the identical standing, and the function is asked for three columns', () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ userId: `u${i}`, name: null, image: null, tests: 1 + (i % 5), totalScore: i * 11 }));
  const withProfile = rows.map((r) => ({ ...r, name: `N${r.userId}`, image: 'x' }));
  for (const id of ['u3', 'u59', 'zzz']) assert.deepEqual(standingFor(rows, id), standingFor(withProfile, id));
  const db = src('data/db.js');
  assert.match(db, /async getLeaderboard\(\{ withProfile = true \} = \{\}\)/);
  assert.match(db, /board\.select\('user_id,tests,total_score'\)/);
  const route = src('src/app/api/leaderboard/route.js');
  assert.match(route, /Database\.getLeaderboard\(\{ withProfile: false \}\)/);
  assert.match(route, /Database\.getAttempts\(id, \{ columns: \['score'\] \}\)/);
  assert.match(route, /standingFor\(rows, session\.user\.id\)/);
});

// ---- F18: the cohort table ---------------------------------------------------------------------------------------------
function statsDb({ refreshedAt, rows }) {
  const calls = [];
  return {
    calls,
    set refreshed(v) { refreshedAt = v; },
    from(table) {
      assert.equal(table, 'question_option_stats');
      const q = { kind: 'rows', ids: null };
      const b = {
        select(columns) { q.kind = /refreshed_at/.test(columns) && !/qid/.test(columns) ? 'newest' : 'rows'; return b; },
        order() { return b; }, limit() { return b; },
        in(_c, ids) { q.ids = ids; return b; },
        then(resolve, reject) {
          calls.push({ kind: q.kind, ids: q.ids });
          const data = q.kind === 'newest' ? [{ refreshed_at: refreshedAt }] : rows.filter((r) => q.ids.includes(r.qid)).map((r) => ({ ...r, refreshed_at: refreshedAt }));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return b;
    },
  };
}

test('F18: the cohort table reads each question once, drops its memo when the table is refreshed, and returns the same cohort as a fresh read', async () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ qid: `q${i}`, key_hash: 'h', n_answered: 40, option_picks: { 0: 10, 1: 20, 2: 6, 3: 4 }, n_first_right: 10, n_timed: 30, n_timed_right: 12, median_ms_right: 30000, q1_ms_right: 20000, q3_ms_right: 40000, right_secs: [20, 30, 40], n_changed: 2, n_moved_off_key: 1, n_strike_basis: 30, n_struck_key: 3 }));
  const attempt = { id: 'a1', subject: 'accountancy', questionsSnapshot: rows.map((r) => ({ id: r.qid, options: ['a', 'b', 'c', 'd'], correctIndex: 1 })), details: rows.map((r) => ({ qid: r.qid, givenIndex: 0, isCorrect: false })) };
  const input = { attempt, allAttempts: [attempt], answerReviews: {} };
  const now = Date.now();
  const sentinel = { sentinel: true };
  const refreshedAt = new Date(now - 3_600_000).toISOString();
  const db = statsDb({ refreshedAt, rows });
  const run = (client) => readCohortWithTime(input, { db: client, now, staticRead: async () => sentinel });
  const first = await run(db);
  const second = await run(db);
  assert.deepEqual(second, first);
  assert.deepEqual(first, await run(statsDb({ refreshedAt, rows })), 'the same cohort as a fresh read of an untouched database');
  assert.notEqual(first, sentinel);
  assert.deepEqual(db.calls.map((c) => c.kind), ['newest', 'rows'], 'the second result page cost no request');
  // another paper whose questions were not read yet reads only those
  const other = { ...input, attempt: { ...attempt, questionsSnapshot: [...attempt.questionsSnapshot, { id: 'q-none', options: ['a', 'b'], correctIndex: 0 }] } };
  await readCohortWithTime(other, { db, now, staticRead: async () => sentinel });
  assert.deepEqual(db.calls.slice(2).map((c) => [c.kind, c.ids]), [['rows', ['q-none']]]);
  // a refresh of the table (the newest refresh moves) drops everything the memo holds, once the five minutes have passed
  assert.ok(MAX_CACHED_QUESTIONS >= 2000);
  const code = src('src/lib/server/cohortStats.js');
  assert.match(code, /if \(memo\.version !== newest\) \{ memo\.rows\.clear\(\); memo\.version = newest; \}/);
  assert.match(code, /NEWEST_MEMO_MS = 5 \* 60 \* 1000/);
});
