// Late papers (bugs-core B8, 15 Nov 2026; data/late_paper.js has the rule): a device-held paper that reached the server after
// its upload grace keeps its result, Review and repairs, and earns nothing that rewards or compares: no place on the board, no
// study day, no badge, no chain day, no Fold, no Mob hours. Where those are summed in the database, the late papers are read
// here and taken back out. Late papers are rare, so this is one small read (the partial index attempts_late_idx in
// 20261115200000_late_papers_out_of_cohort_stats.sql serves the all-students read). No 'server-only' and no '@/' imports, so
// node:test drives it (data/tests/late_paper_1115.test.mjs, data/tests/late_paper_rewards_1115.test.mjs).
const PAGE = 1000;
// The filter matches the partial index's own predicate, so the planner can use it (a jsonb containment would not).
const LATE_KEY = 'selection_meta->>late';
/** For a PostgREST `.not('selection_meta', 'cs', LATE_JSON)`: every attempt that is not a late paper. */
export const LATE_JSON = JSON.stringify({ late: true });
const COLUMNS = 'id,user_id,score,total,unattempted,completed_at,mode:selection_meta->>mode';
const MOCK_MODES = ['full', 'nta'];
const IST_MS = 330 * 60 * 1000; // India has no daylight saving: an IST day is the UTC day of the instant plus 5:30

/** Every late paper's { id, user_id, score, total, unattempted, completed_at, mode }, or only `userId`'s. Throws the database error. */
export async function readLatePapers(db, { userId = null } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from('attempts').select(COLUMNS).eq(LATE_KEY, 'true');
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * readLatePapers that never throws (SESS-FOLLOWUP 3): a failed read is logged with its code only and gives null, so a caller
 * serves its answer without the subtraction (the board) or holds back what it would store for good (a chain best, a Fold).
 */
export async function readLatePapersSoft(db, opts, warn = console.warn) {
  try { return await readLatePapers(db, opts); } catch (error) {
    warn('late_papers_read_failed', typeof error?.code === 'string' ? error.code : 'error');
    return null;
  }
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

/** The ids of `late` as a Set (for filtering a student's own attempts list). */
export const lateIds = (late) => new Set((Array.isArray(late) ? late : []).map((p) => String(p?.id || '')).filter(Boolean));

const istDay = (iso) => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? new Date(t + IST_MS).toISOString().slice(0, 10) : null;
};

/**
 * The chain's daily counts (chain_daily: [{ day, answered }], IST days, answered = total - unattempted of each attempt by its
 * completed_at, plus Mob answers) without the student's late papers: each late paper's answered count comes off its IST day,
 * never below 0. A fresh array.
 */
export function dailyWithoutLate(daily, late) {
  const list = Array.isArray(daily) ? daily.map((d) => ({ ...d })) : [];
  if (!Array.isArray(late) || !late.length) return list;
  const less = new Map();
  for (const paper of late) {
    const day = istDay(paper?.completed_at);
    if (!day) continue;
    less.set(day, (less.get(day) || 0) + Math.max(0, (Number(paper.total) || 0) - (Number(paper.unattempted) || 0)));
  }
  for (const d of list) {
    const day = String(d?.day || '').slice(0, 10);
    const n = less.get(day);
    if (!n) continue;
    const take = Math.min(n, Math.max(0, Number(d.answered) || 0));
    d.answered = Math.max(0, (Number(d.answered) || 0) - take);
    less.set(day, n - take);
  }
  return list;
}

const isMock = (mode) => MOCK_MODES.includes(String(mode || ''));

/**
 * mob_unlock_facts without the late papers. Only `full_mocks` (the first full mock Fold) and `beat_best` (beat your own best
 * mock) read attempts. full_mocks loses the late mocks. beat_best is worked out again from `mocks` (the student's Full mock and
 * NTA papers: [{ subject, score, completed_at, late }]) the way the SQL does it, late ones left out: a paper beats the best of the
 * same subject's earlier papers. With no `mocks` (the read failed) beat_best is false this time. Unchanged without a late mock.
 */
export function unlockFactsWithoutLate(facts, late, mocks) {
  if (!facts || typeof facts !== 'object') return facts;
  const lateMocks = (Array.isArray(late) ? late : []).filter((p) => isMock(p?.mode));
  if (!lateMocks.length) return facts;
  const fullMocks = Math.max(0, (Number(facts.full_mocks) || 0) - lateMocks.length);
  let beatBest = false;
  if (Array.isArray(mocks)) {
    const kept = mocks.filter((m) => m && String(m.late) !== 'true')
      .map((m) => ({ subject: m.subject, score: m.score == null ? Number.NaN : Number(m.score), at: Date.parse(m.completed_at || '') }))
      .filter((m) => Number.isFinite(m.score) && Number.isFinite(m.at));
    beatBest = kept.some((a) => {
      const before = kept.filter((b) => b.subject === a.subject && b.at < a.at);
      return before.length > 0 && a.score > Math.max(...before.map((b) => b.score));
    });
  }
  return { ...facts, full_mocks: fullMocks, beat_best: beatBest };
}

/** A student's Full mock and NTA papers for unlockFactsWithoutLate: [{ subject, score, completed_at, late }]. Throws the database error. */
export async function readMockScores(db, userId) {
  const { data, error } = await db.from('attempts').select('subject,score,completed_at,late:selection_meta->>late')
    .eq('user_id', userId).in('selection_meta->>mode', MOCK_MODES).order('completed_at', { ascending: true }).limit(2000);
  if (error) throw error;
  return data || [];
}
