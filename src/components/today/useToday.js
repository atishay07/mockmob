"use client";
// Every read Today makes, once per visit, each with its own status so a slow or failed read never shows as zero
// (TODAY-1017 4.2 and 4.3; unknown is never zero). The move is decided from these in src/lib/today/move.mjs.
//   plan     GET /api/learning/plan          the shared next step (resume, checks, tonight's session)
//   papers   GET /api/attempts/summary       the newest papers (the move's reason, Last paper)
//   rhythm   GET /api/me/rhythm              this week, the first saved session, days away
//   goal     GET /api/me/goal                the weekly goal and the chosen weekdays
//   road     GET /api/me/road                the exam date and mock target on the account (P0, feature-detected)
//   revise   GET /api/me/revise              questions due today
//   facts    GET /api/me/timed-mock          sessions and mocks saved
//   repaired GET /api/me/repair-record       repairs per paper (F17: a repaired mistake is never offered again)
//   attempt  GET /api/attempts/{id}          lazy, cached per visit: the biggest leak on Last paper and the weak-chapter stems
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/fetcher';
import { reviseRecalled } from '@/lib/today/firstWeek.mjs';

const idle = { status: 'loading', data: null };

function useRead(path, userId, { map = (x) => x, key = 0 } = {}) {
  const [state, setState] = useState({ path: null, key: 0, ...idle });
  useEffect(() => {
    if (!userId || !path) return undefined;
    let alive = true;
    apiGet(path)
      .then((body) => { if (alive) setState({ path, key, status: 'ready', data: map(body) }); })
      .catch((error) => { if (alive) setState({ path, key, status: 'error', data: null, code: error?.status || 0 }); });
    return () => { alive = false; };
    // `map` is a pure shape function chosen by the caller; it never changes between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, userId, key]);
  // A new path (another length) keeps the last answer on screen while it loads, so the card never collapses.
  return state.path === path && state.key === key ? state : { path, status: 'loading', data: state.data, stale: Boolean(state.data) };
}

const repairedMap = (body) => {
  const out = new Map();
  for (const r of body?.repairs || []) if (r?.attemptId) out.set(r.attemptId, (out.get(r.attemptId) || 0) + 1);
  return out;
};
// Revise today: `due` is what is still asked today (the API caps it at 10), `dueTotal` every card due, `answeredToday` the
// ones already recalled today (they count against the cap), and when the next ones come back.
const reviseDue = (body) => (body?.state === 'unavailable' ? null : {
  due: Array.isArray(body?.items) ? body.items.length : 0,
  dueTotal: Number.isInteger(body?.due) ? body.due : null,
  answeredToday: Number.isInteger(body?.answeredToday) ? body.answeredToday : 0,
  minutes: Number.isInteger(body?.minutes) ? body.minutes : null,
  nextDayLabel: typeof body?.nextDayLabel === 'string' ? body.nextDayLabel : null,
  // The subjects of today's questions, most first: the lead card shows their objects (what comes back, not a guess).
  subjects: Array.isArray(body?.items) ? subjectsByCount(body.items) : [],
  // The chapters of today's questions, most first ({ chapter, n }): "Why this?" names which mistakes come back (release 9).
  chapters: Array.isArray(body?.items) ? chaptersByCount(body.items) : [],
  // Revise has been used: a question asked today, or an active card above box 1 (a right recall moved it up; a wrong one drops it back).
  // Unknown (null) when the body has no box counts and nothing was asked today: the first-week path ticks Revise only on a true.
  recalled: reviseRecalled(body),
});
function chaptersByCount(items) {
  const n = new Map();
  for (const i of items) if (i?.chapter && typeof i.chapter === 'string') n.set(i.chapter, (n.get(i.chapter) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([chapter, count]) => ({ chapter, n: count }));
}
function subjectsByCount(items) {
  const n = new Map();
  for (const i of items) if (i?.subject) n.set(i.subject, (n.get(i.subject) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}

export function useToday(userId) {
  const [planKey, setPlanKey] = useState(0);
  const [minutes, setMinutes] = useState(null);
  const [rhythmKey, setRhythmKey] = useState(0);
  const [all, setAll] = useState(0); // a retry of the failed card reads everything again
  const plan = useRead(`/api/learning/plan${minutes ? `?minutes=${minutes}` : ''}`, userId, { key: planKey * 1000 + all });
  const papers = useRead('/api/attempts/summary?limit=20', userId, { map: (b) => (Array.isArray(b?.items) ? b.items : []), key: all });
  const rhythm = useRead('/api/me/rhythm', userId, { key: rhythmKey * 1000 + all });
  const goal = useRead('/api/me/goal', userId, { key: rhythmKey });
  const road = useRead('/api/me/road', userId);
  const revise = useRead('/api/me/revise', userId, { map: reviseDue });
  const facts = useRead('/api/me/timed-mock', userId, { key: all });
  // One read: repairs per paper for the move (F17), and the rows with their times for the weekly receipt.
  const record = useRead('/api/me/repair-record?limit=100', userId, { map: (b) => ({ byAttempt: repairedMap(b), rows: Array.isArray(b?.repairs) ? b.repairs : [] }) });
  const repaired = { ...record, data: record.data?.byAttempt ?? null };
  const repairRows = record.status === 'ready' ? record.data.rows : null;
  const retryPlan = useCallback(() => setPlanKey((n) => n + 1), []);
  const retryAll = useCallback(() => setAll((n) => n + 1), []);
  const retryWeek = useCallback(() => setRhythmKey((n) => n + 1), []);
  // One paper in full (its questions and answers), read at most once per visit and shared by every block that asks.
  const attempts = useRef(new Map());
  const loadAttempt = useCallback((id) => {
    if (!id) return Promise.reject(new Error('no attempt'));
    const cache = attempts.current;
    if (!cache.has(id)) {
      const p = apiGet(`/api/attempts/${encodeURIComponent(id)}`);
      p.catch(() => cache.delete(id)); // a failed read is tried again on the next ask
      cache.set(id, p);
    }
    return cache.get(id);
  }, []);
  return { plan, papers, rhythm, goal, road, revise, facts, repaired, repairRows, minutes, setMinutes, retryPlan, retryWeek, retryAll, loadAttempt };
}
