import test from 'node:test';
import assert from 'node:assert/strict';
import { listAttemptSummaries, formatIdFor, encodeCursor, decodeCursor, parseLimit } from '../../src/lib/server/attemptSummary.js';

// Minimal in-memory stand-in for the supabase query builder (eq, or keyset, order, limit).
function fakeDb(rows, log = []) {
  return { from() {
    const st = { eq: [], or: null, limit: null };
    const b = {
      select(cols) { log.push(cols); return b; },
      eq(k, v) { st.eq.push([k, v]); return b; },
      or(s) { st.or = s; return b; },
      order() { return b; },
      limit(n) { st.limit = n; return b; },
      then(res) {
        let r = rows.filter(x => st.eq.every(([k, v]) => x[k] === v));
        if (st.or) {
          const m = st.or.match(/completed_at\.lt\."([^"]+)",and\(completed_at\.eq\."([^"]+)",id\.gt\."([^"]+)"\)/);
          assert.ok(m, 'keyset filter shape');
          const t = Date.parse(m[1]);
          r = r.filter(x => Date.parse(x.completed_at) < t || (Date.parse(x.completed_at) === t && x.id > m[3]));
        }
        r = [...r].sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at) || (a.id < b.id ? -1 : 1));
        res({ data: r.slice(0, st.limit), error: null });
      },
    };
    return b;
  } };
}

const row = (id, at, extra = {}) => ({ id, user_id: 'u1', subject: 'Accountancy', correct: 3, wrong: 1, unattempted: 1, total: 5,
  completed_at: at, mode: 'practice', scoringVersion: 'server_practice_v1', ...extra });

test('marks, maxMarks and shape; no heavy columns requested', async () => {
  const log = [];
  const out = await listAttemptSummaries(fakeDb([row('a', '2026-10-10T10:00:00.123456+00:00')], log), 'u1');
  assert.deepEqual(Object.keys(out.items[0]), ['id', 'subject', 'mode', 'correct', 'wrong', 'unattempted', 'total', 'marks', 'maxMarks', 'completedAt', 'formatId']);
  assert.equal(out.items[0].marks, 14);
  assert.equal(out.items[0].maxMarks, 25);
  assert.equal(out.items[0].completedAt, Date.parse('2026-10-10T10:00:00.123Z'));
  assert.equal(out.nextCursor, null);
  assert.doesNotMatch(log[0], /details|questions_snapshot|\*/);
});

test('paging newest first with ties on timestamp and no duplicates or gaps', async () => {
  const same = '2026-10-10T10:00:00.500000+00:00';
  const rows = [row('c', same), row('a', same), row('b', same), row('z', '2026-10-11T00:00:00+00:00'), row('y', '2026-10-01T00:00:00+00:00'), row('x', '2026-09-01T00:00:00+00:00')];
  const db = fakeDb(rows);
  const seen = []; let cursor = null; let pages = 0;
  do {
    const p = await listAttemptSummaries(db, 'u1', { cursor, limit: 2 });
    assert.ok(p.items.length <= 2);
    seen.push(...p.items.map(i => i.id)); cursor = p.nextCursor; pages++;
  } while (cursor);
  assert.deepEqual(seen, ['z', 'a', 'b', 'c', 'y', 'x']);
  assert.equal(pages, 3);
});

test('exact page boundary gives null nextCursor', async () => {
  const p = await listAttemptSummaries(fakeDb([row('a', '2026-10-10T00:00:00Z'), row('b', '2026-10-09T00:00:00Z')]), 'u1', { limit: 2 });
  assert.equal(p.items.length, 2);
  assert.equal(p.nextCursor, null);
});

test('ownership filter: other users rows never appear', async () => {
  const rows = [row('mine', '2026-10-10T00:00:00Z'), row('theirs', '2026-10-11T00:00:00Z', { user_id: 'u2' })];
  const p = await listAttemptSummaries(fakeDb(rows), 'u1');
  assert.deepEqual(p.items.map(i => i.id), ['mine']);
  await assert.rejects(() => listAttemptSummaries(fakeDb(rows), ''), /attempt_owner_required/);
});

test('limit defaults to 20 and caps at 50; bad cursors are rejected', async () => {
  assert.equal(parseLimit(undefined), 20);
  assert.equal(parseLimit('0'), 20);
  assert.equal(parseLimit('abc'), 20);
  assert.equal(parseLimit('500'), 50);
  assert.equal(parseLimit('7'), 7);
  const db = fakeDb([]);
  const evil = 'a"),id.gt.(x';
  for (const bad of ['!!!', encodeCursor('not a date', 'a'), encodeCursor('2026-10-10T00:00:00Z', evil), Buffer.from('{}').toString('base64url')]) {
    assert.deepEqual(await listAttemptSummaries(db, 'u1', { cursor: bad }), { error: 'bad_cursor' });
  }
  assert.deepEqual(decodeCursor(encodeCursor('2026-10-10T00:00:00Z', 'a_1')), { at: '2026-10-10T00:00:00Z', id: 'a_1' });
});

test('formatId is stable across time and score, and differs by mode, subject, count and scoring version', () => {
  const base = { subject: 'Business Studies', total: 50, selection_meta: { mode: 'full', scoringVersion: 'server_snapshot_v1' } };
  const id = formatIdFor(base);
  assert.equal(id, 'full:business_studies:q50:server_snapshot_v1');
  assert.equal(formatIdFor({ ...base, correct: 1, completed_at: 'x', id: 'q' }), id);
  assert.equal(formatIdFor({ subject: 'Business Studies', total: 50, selectionMeta: base.selection_meta }), id);
  assert.equal(formatIdFor({ subject: 'business studies', total: '50', mode: 'full', scoringVersion: 'server_snapshot_v1' }), id);
  for (const d of [{ subject: 'Economics' }, { total: 40 }, { selection_meta: { mode: 'quick', scoringVersion: 'server_snapshot_v1' } }, { selection_meta: { mode: 'full', scoringVersion: 'v2' } }]) {
    assert.notEqual(formatIdFor({ ...base, ...d }), id);
  }
  assert.equal(formatIdFor({ subject: 'Economics', total: 10 }), 'unknown:economics:q10:historical_device');
});
