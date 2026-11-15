// Late papers (bugs-core B8, 15 Nov 2026; data/late_paper.js has the rule): a device-held paper that reached the server after
// its upload grace counts for the student's own record but is kept out of everything that compares students. The points
// board (GET /api/leaderboard: rank, places, "top N%") is summed in the database (mm_leaderboard), so its late papers are read
// here and taken back out of each student's row. Late papers are rare, so this is one small read. No 'server-only' and no '@/'
// imports, so node:test drives it (data/tests/late_paper_1115.test.mjs).
const PAGE = 1000;
const LATE = { late: true };

/** Every late paper's { user_id, score }, or only `userId`'s. Throws the database error. */
export async function readLatePapers(db, { userId = null } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from('attempts').select('id,user_id,score').contains('selection_meta', LATE);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * The board rows ({ userId, tests, totalScore, ... }) without the late papers in `late` ([{ user_id, score }]): each student's
 * tests and points lose their late papers, and a student left with no paper leaves the board. A fresh array; rows are copied.
 */
export function withoutLatePapers(rows, late) {
  const list = Array.isArray(rows) ? rows : [];
  if (!Array.isArray(late) || !late.length) return list.map((r) => ({ ...r }));
  const less = new Map();
  for (const paper of late) {
    if (!paper?.user_id) continue;
    const t = less.get(paper.user_id) || { tests: 0, points: 0 };
    t.tests += 1;
    t.points += Number(paper.score) || 0;
    less.set(paper.user_id, t);
  }
  const out = [];
  for (const row of list) {
    const t = less.get(row?.userId);
    if (!t) { out.push({ ...row }); continue; }
    const tests = Math.max(0, (Number(row.tests) || 0) - t.tests);
    if (tests === 0) continue;
    const totalScore = (Number(row.totalScore) || 0) - t.points;
    out.push({ ...row, tests, totalScore, ...('avg' in row ? { avg: Math.round(totalScore / tests) } : {}) });
  }
  return out;
}

/** The caller's own { tests, totalScore } without their late papers. */
export function ownWithoutLate(own, late) {
  if (!own || !Array.isArray(late) || !late.length) return own;
  const points = late.reduce((sum, paper) => sum + (Number(paper?.score) || 0), 0);
  return { tests: Math.max(0, own.tests - late.length), totalScore: own.totalScore - points };
}
