import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBoardCache, createTtlMemo } from '../ttl_memo.js';
import { standingFor, topContributorCounts } from '../../src/lib/server/standing.js';
import { readCohortWithTime, MAX_CACHED_QUESTIONS } from '../../src/lib/server/cohortStats.js';
import { ITEM_COLUMNS, SEED_COLUMNS, getRevise, itemChunk } from '../../src/lib/server/revise.js';
import { fakeDb as reviseFakeDb } from '../../scripts/mistake-lab/fake-db.mjs';
import { USER, REVISE_NOW, reviseWorld } from '../../scripts/mistake-lab/build-s4-fixtures.mjs';
import { rng } from './helpers/egress_fixtures.mjs';
import { repairStubRows, repairedCounts, savedRepairsForAttempt, SAVED_REPAIR_SELECT } from '../../src/lib/server/repairSaved.js';
import { buildRepairRecord, mistakeKey } from '../../src/lib/server/repairRecord.js';
import { repairsById } from '../../src/lib/server/review.js';

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

test('F15: Revise reads a chunk of the room plus a few, finds the same items and skips as reading a hundred, and the columns are narrower', async () => {
  // The loop of getRevise over a due list: walk in order, ask what is eligible, stop at `room`. Old: chunks of 100. New: itemChunk.
  const walk = (due, room, eligible, chunkSize) => {
    const items = []; let skipped = 0; let rowsRead = 0;
    for (let at = 0; at < due.length && items.length < room;) {
      const size = chunkSize(items.length);
      const chunk = due.slice(at, at + size); at += size; rowsRead += chunk.length;
      for (const c of chunk) { if (items.length >= room) break; if (eligible(c)) items.push(c); else skipped += 1; }
    }
    return { items, skipped, rowsRead };
  };
  const rand = rng(15);
  for (let round = 0; round < 300; round += 1) {
    const due = Array.from({ length: Math.floor(rand() * 250) }, (_, i) => i);
    const room = [5, 10][Math.floor(rand() * 2)];
    const bad = rand() * 0.9;
    const blocked = new Set(due.filter(() => rand() < bad));
    const ok = (c) => !blocked.has(c);
    const old = walk(due, room, ok, () => 100);
    const next = walk(due, room, ok, (have) => itemChunk(room, have, 100));
    assert.deepEqual({ items: next.items, skipped: next.skipped }, { items: old.items, skipped: old.skipped }, `round ${round}`);
    assert.ok(next.rowsRead <= old.rowsRead);
  }
  assert.equal(itemChunk(10, 0), 14);
  assert.equal(itemChunk(10, 9), 5);
  assert.equal(itemChunk(5, 0, 3), 3);
  assert.equal(itemChunk(10, 10), 4);
  // the real getRevise: same body as before on the fixture world, and the questions are asked for the narrow lists
  const world = reviseWorld();
  const db = reviseFakeDb({ questions: world.questions, progress: world.progress, cards: world.cards });
  const got = await getRevise(USER, { db, now: REVISE_NOW });
  assert.deepEqual(got.body.items.map((i) => i.questionId), ['r-q5', 'r-q1', 'r-q2', 'r-q3']);
  assert.equal(SEED_COLUMNS.includes('explanation') || SEED_COLUMNS.includes('passage_text'), false);
  assert.equal(ITEM_COLUMNS.includes('passage_text') && !ITEM_COLUMNS.includes('explanation'), true);
  const code = src('src/lib/server/revise.js');
  assert.match(code, /loadQuestions\(db, candidates\.map\(\(c\) => c\.question_id\), SEED_COLUMNS\)/);
  assert.match(code, /ITEM_COLUMNS\);/);
  assert.match(code, /loadQuestions\(client_, \[questionId\]\)\)\.get\(questionId\)/, 'answering still reads the explanation');
});

test('A10: the saved-repair readers give the same answers from stub receipts as from the full repair bodies', () => {
  const userId = 'u1';
  const attempts = Array.from({ length: 6 }, (_, a) => ({
    id: `a${a}`, subject: 'accountancy', completed_at: `2026-10-0${a + 1}T10:00:00Z`,
    details: Array.from({ length: 8 }, (_, k) => ({ qid: `q${a}-${k}`, isCorrect: k % 3 === 0 ? true : k % 3 === 1 ? false : null, givenIndex: 1 })),
    questions_snapshot: Array.from({ length: 8 }, (_, k) => ({ id: `q${a}-${k}`, chapter: `Chapter ${k % 3}` })),
  }));
  const full = [];
  for (const a of attempts) for (const d of a.details) {
    if (d.isCorrect !== false || full.length >= 9) continue;
    full.push({ operation_key: `repair:${mistakeKey(userId, a.id, d.qid)}:req${full.length}`, updated_at: `2026-10-1${full.length}T09:00:00Z`, receipt: { repair: { why_right: 'x'.repeat(2500), rule: 'A rule.' }, check: { right: full.length % 2 === 0, answeredAt: '2026-10-19T10:00:00Z', explanation: 'y'.repeat(1500) } } });
  }
  const stubs = repairStubRows(full.map(({ operation_key, updated_at }) => ({ operation_key, updated_at })));
  assert.equal(stubs.length, full.length);
  const attempt = attempts[0];
  assert.deepEqual(savedRepairsForAttempt({ userId, attempt, reservations: stubs }), savedRepairsForAttempt({ userId, attempt, reservations: full }));
  assert.deepEqual(repairedCounts({ userId, attempts, reservations: stubs }), repairedCounts({ userId, attempts, reservations: full }));
  assert.deepEqual(buildRepairRecord({ userId, reservations: stubs, attempts, limit: 50 }), buildRepairRecord({ userId, reservations: full, attempts, limit: 50 }));
  assert.ok(Object.keys(repairedCounts({ userId, attempts, reservations: stubs })).length > 2);
  // Review keeps the check: the two json paths give the receipt shape repairsById reads
  const asReview = full.map((r) => ({ operation_key: r.operation_key, updated_at: r.updated_at, receipt: { repair: {}, check: { right: r.receipt.check.right, answeredAt: r.receipt.check.answeredAt } } }));
  assert.deepEqual([...repairsById(asReview)], [...repairsById(full)]);
  assert.ok([...repairsById(full).values()].some((v) => v.check?.right === true) && [...repairsById(full).values()].some((v) => v.check?.right === false));
  assert.equal(SAVED_REPAIR_SELECT, 'operation_key,updated_at');
  for (const file of ['src/lib/server/repairSaved.js', 'src/lib/server/repairRecord.js']) assert.match(src(file), /SAVED_REPAIR_SELECT|select\('operation_key'\)/, file);
  assert.match(src('src/lib/server/review.js'), /chk_right:receipt->check->right,chk_at:receipt->check->>answeredAt/);
  assert.match(src('src/lib/server/ruleBook.js'), /repair:receipt->repair/, 'the Rule book still reads the repair body it shows');
});
