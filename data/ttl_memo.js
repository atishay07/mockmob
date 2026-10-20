// Small bounded memos for reads that are the same for everyone (egress items A12, A13, F16, F17, F18; 20 Oct 2026).
// No 'server-only' and no alias imports, so node:test can load it.
//
//  createTtlMemo      one value per key, kept `ttlMs`, at most `max` keys, a failed or undefined read is never remembered.
//                     Hold only content that is the same for every student (counts, public aggregates). Never put a response
//                     for one person, a name or an id in it: callers key it by what was asked and nothing else.
//  createBoardCache   the leaderboard rows for `ttlMs`, with the caller's own row replaced by a live read so a student sees their
//                     own new rank at once (the rows of others are at most `ttlMs` old, and are never returned).
export function createTtlMemo({ ttlMs = 5 * 60 * 1000, max = 50, now = Date.now, copy = (v) => v } = {}) {
  const entries = new Map();
  return {
    async get(key, read) {
      const at = now();
      const hit = entries.get(key);
      if (hit && at - hit.at < ttlMs) return copy(hit.value);
      const value = await read();
      if (value !== undefined) {
        entries.delete(key);
        entries.set(key, { value, at: now() });
        while (entries.size > max) entries.delete(entries.keys().next().value);
      }
      return value === undefined ? undefined : copy(value);
    },
    forget(key) { if (key === undefined) entries.clear(); else entries.delete(key); },
    get size() { return entries.size; },
  };
}

/**
 * The rows standingFor reads ({ userId, tests, totalScore }), the cached copy with `userId`'s own row replaced by `own` ({ tests,
 * totalScore } from the caller's own attempts, a few bytes each) when that read worked. The result is a fresh array: the cached
 * rows are never mutated and never leave this module except through standingFor's per-caller arithmetic.
 */
export function createBoardCache({ ttlMs = 120 * 1000, now = Date.now } = {}) {
  const memo = createTtlMemo({ ttlMs, max: 1, now });
  return {
    async rowsFor(userId, { loadRows, loadOwn }) {
      const rows = await memo.get('board', async () => (await loadRows()).map((r) => ({ userId: r.userId, tests: Number(r.tests) || 0, totalScore: Number(r.totalScore) || 0 })));
      let own = null;
      try { own = await loadOwn(userId); } catch { own = null; }
      if (!own || !Number.isFinite(own.tests)) return rows.map((r) => ({ ...r }));
      const out = rows.filter((r) => r.userId !== userId).map((r) => ({ ...r }));
      if (own.tests > 0) out.push({ userId, tests: own.tests, totalScore: own.totalScore });
      return out;
    },
    forget() { memo.forget(); },
  };
}
