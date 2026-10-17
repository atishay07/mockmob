"use client";

// Your standing (W-055: the richer board, refined, with nobody named). Where your recorded mocks put you among the
// students ranked on MockMob, and what it takes to move: your place and band, the points to the next place up, the top
// ten places as anonymous totals, where everyone's averages sit with your band marked, and your own papers over time by
// type. The server answers only places and counts (src/lib/server/standing.js): no other student's name, photo or id
// reaches this page, and on a board of fewer than 20 the ladder and the spread are not sent at all.
// The movement line ("Up 3 places since 14 Oct") compares with the place this device last saw, and says so.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Skeleton, ErrorState } from '@/components/ui/Skeleton';
import ArenaHead from '@/components/arena/ArenaHead';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { TEST_MODES } from '@/../data/test_modes';
import { PaperTrend } from '@/components/ai/RecordGlimpse';
import './leaderboard.css';

const count = (n) => Number(n).toLocaleString('en-IN');
const ordinal = (n) => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${count(n)}th`;
  return `${count(n)}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

// The answer the API gives is { you: { rank, of, tests, average, points? } | null, window, board? }. Anything else is an error.
function readStanding(data) {
  if (!data || typeof data !== 'object' || !('you' in data)) throw new Error('invalid_standing');
  const you = data.you;
  if (you === null) return null;
  const rank = Number(you.rank); const of = Number(you.of); const tests = Number(you.tests); const average = Number(you.average);
  if (![rank, of, tests, average].every(Number.isFinite) || rank < 1 || of < rank) throw new Error('invalid_standing');
  const b = data.board && typeof data.board === 'object' ? data.board : null;
  const ladder = Array.isArray(b?.ladder) ? b.ladder.filter((r) => Number.isFinite(Number(r?.place)) && Number.isFinite(Number(r?.points))) : null;
  const spread = Array.isArray(b?.spread) && b.spread.length ? b.spread.map((r) => ({ from: Number(r.from) || 0, to: Number(r.to) || 0, students: Number(r.students) || 0 })) : null;
  return {
    rank, of, tests, average, points: Number.isFinite(Number(you.points)) ? Number(you.points) : null,
    toNext: Number.isFinite(Number(b?.toNext)) ? Number(b.toNext) : null,
    top: Number.isFinite(Number(b?.top)) ? Number(b.top) : null,
    ladder: ladder && ladder.length ? ladder : null,
    spread,
  };
}

// The place this device saw last time, per account: { rank, at }. A per-viewer convenience; without storage the line is left out.
const seenKey = (id) => `mm:standing:${id}:v1`;
function useMovement(userId, rank) {
  const [moved, setMoved] = useState(null);
  useEffect(() => {
    if (!userId || !rank) return undefined;
    const t = window.setTimeout(() => {
      try {
        const before = JSON.parse(window.localStorage.getItem(seenKey(userId)) || 'null');
        const today = new Date().toDateString();
        if (before && Number.isFinite(before.rank) && new Date(before.at).toDateString() !== today) setMoved({ by: before.rank - rank, since: before.at });
        // Remember today's place once a day, so the comparison is always with an earlier day.
        if (!before || new Date(before.at).toDateString() !== today) window.localStorage.setItem(seenKey(userId), JSON.stringify({ rank, at: Date.now() }));
      } catch { /* no storage: no movement line */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, [userId, rank]);
  return moved;
}

function movementLine(moved) {
  if (!moved) return '';
  const since = `since ${shortDay(moved.since)} on this device`;
  if (moved.by === 0) return `Same place as ${since.replace('since ', 'on ')}.`;
  const n = Math.abs(moved.by);
  return `${moved.by > 0 ? 'Up' : 'Down'} ${count(n)} ${n === 1 ? 'place' : 'places'} ${since}.`;
}

function Ladder({ standing }) {
  const { ladder, rank, points, tests } = standing;
  // Your row in the ten: the first place with your total (equal totals share a place).
  const youAt = ladder.findIndex((r) => r.place === rank && r.points === points);
  const inTop = youAt >= 0;
  const max = Math.max(1, ...ladder.map((r) => r.points), points || 0);
  const row = (r, you, key) => (
    <li key={key} className="lb-ladder__row" data-you={you || undefined}>
      <span className="lb-ladder__place">{ordinal(r.place)}</span>
      <span className="lb-ladder__bar" aria-hidden="true"><i style={{ '--w': `${Math.max(2, Math.round((r.points / max) * 100))}%` }} /></span>
      <span className="lb-ladder__pts"><b>{count(r.points)}</b> points</span>
      <span className="lb-ladder__mocks">{count(r.mocks)} {r.mocks === 1 ? 'mock' : 'mocks'}</span>
      {you ? <span className="lb-ladder__you">You</span> : null}
    </li>
  );
  return (
    <section className="lb-sec" aria-labelledby="lb-ladder-h">
      <h2 className="lb-h2" id="lb-ladder-h">The top 10 places</h2>
      <p className="lb-sub">Total points and mocks at each place. Nobody is named.</p>
      <ol className="lb-ladder">
        {ladder.map((r, i) => row(r, i === youAt, `t${i}`))}
        {!inTop ? (
          <>
            <li className="lb-ladder__gap" aria-hidden="true">{rank - 1 > ladder.length ? `${count(rank - 1 - ladder.length)} more places` : ''}</li>
            {row({ place: rank, points: points ?? 0, mocks: tests }, true, 'you')}
          </>
        ) : null}
      </ol>
    </section>
  );
}

function Spread({ standing }) {
  const { spread, average } = standing;
  const yours = Math.max(0, Math.min(spread.length - 1, Math.floor(average / 10)));
  const max = Math.max(1, ...spread.map((b) => b.students));
  const label = (b, i) => (i === spread.length - 1 ? `${b.from} and above` : `${b.from} to ${b.to}`);
  return (
    <section className="lb-sec" aria-labelledby="lb-spread-h">
      <h2 className="lb-h2" id="lb-spread-h">Where averages sit</h2>
      <p className="lb-sub">Students by their average score per mock. Yours is {count(average)}, in the marked band.</p>
      <ul className="lb-spread" aria-label="Students by average score">
        {spread.map((b, i) => (
          <li key={b.from} className="lb-spread__band" data-you={i === yours || undefined} aria-label={`${label(b, i)}: ${count(b.students)} ${b.students === 1 ? 'student' : 'students'}${i === yours ? ', your band' : ''}`}>
            <span className="lb-spread__n" aria-hidden="true">{b.students ? count(b.students) : ''}</span>
            <span className="lb-spread__bar" aria-hidden="true"><i style={{ '--h': `${b.students ? Math.max(4, Math.round((b.students / max) * 100)) : 0}%` }} /></span>
            <span className="lb-spread__x" aria-hidden="true">{b.from}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Your own papers, newest 20: a line of your marks as a share of each paper's maximum, and how many of each type.
function YourPapers() {
  const [state, setState] = useState({ status: 'loading', items: [] });
  useEffect(() => {
    let alive = true;
    apiGet('/api/attempts/summary?limit=20')
      .then((b) => { if (alive) setState({ status: 'ready', items: Array.isArray(b?.items) ? b.items : [] }); })
      .catch(() => { if (alive) setState({ status: 'error', items: [] }); });
    return () => { alive = false; };
  }, []);
  const view = useMemo(() => {
    const items = state.items.filter((p) => Number(p.maxMarks) > 0).slice().reverse();
    if (items.length < 2) return null;
    const shares = items.map((p) => Math.max(0, Math.min(1, p.marks / p.maxMarks)));
    const W = 280; const H = 64;
    const pts = shares.map((s, i) => `${((i / (shares.length - 1)) * W).toFixed(1)},${(H - 4 - s * (H - 8)).toFixed(1)}`).join(' ');
    const types = {};
    for (const p of items) { const t = TEST_MODES[p.mode]?.label || 'Practice'; types[t] = (types[t] || 0) + 1; }
    const first = Math.round(shares[0] * 100); const last = Math.round(shares[shares.length - 1] * 100);
    return { pts, W, H, n: items.length, first, last, types: Object.entries(types).sort((a, b) => b[1] - a[1]) };
  }, [state.items]);
  if (state.status !== 'ready' || !view) return null;
  return (
    <section className="lb-sec" aria-labelledby="lb-papers-h">
      <h2 className="lb-h2" id="lb-papers-h">Your papers</h2>
      <p className="lb-sub">Your last {view.n} papers, as a share of each paper’s marks: {view.first}% on the first, {view.last}% on the latest.</p>
      <svg className="lb-trend" viewBox={`0 0 ${view.W} ${view.H}`} preserveAspectRatio="none" role="img" aria-label={`Your marks over your last ${view.n} papers, from ${view.first}% to ${view.last}%`}>
        <polyline points={view.pts} />
      </svg>
      <dl className="lb-types">
        {view.types.map(([t, n]) => <div key={t}><dt>{t}</dt><dd>{count(n)}</dd></div>)}
      </dl>
    </section>
  );
}

export default function LeaderboardPageClient() {
  const { user } = useAuth();
  const [standing, setStanding] = useState(null);
  const [state, setState] = useState('loading');
  const load = useCallback(async () => {
    try { setStanding(readStanding(await apiGet('/api/leaderboard'))); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; }; }, [load]);
  const retry = () => { setState('loading'); load(); };
  const moved = useMovement(user?.id, state === 'ready' ? standing?.rank : null);

  return <div className="student-page student-page--leaderboard ranks-page lb">
    <ArenaHead
      title="Your standing"
      lede="Where your recorded mocks place you among MockMob students, and what moves you up. It is separate from your CUET exam rank."
    />
    {state === 'loading' && <div className="lb-stand" aria-busy="true" aria-label="Loading your standing"><Skeleton className="h-12 w-48" /><Skeleton className="h-4 w-full" /></div>}
    {state === 'error' && <ErrorState scene="unreachable" title="Your standing did not load" message="Check your connection and try again." onRetry={retry} />}
    {state === 'ready' && standing && (
      <>
        <section className="lb-stand" aria-labelledby="lb-place">
          <div className="lb-stand__top">
            <p className="lb-stand__place" id="lb-place"><b>{ordinal(standing.rank)}</b> of {count(standing.of)} {standing.of === 1 ? 'student' : 'students'} who {standing.of === 1 ? 'has' : 'have'} sat a mock</p>
            {standing.top != null ? <p className="lb-stand__band"><b>Top {standing.top}%</b><span>of ranked students</span></p> : null}
          </div>
          {moved ? <p className="lb-move" data-dir={moved.by > 0 ? 'up' : moved.by < 0 ? 'down' : 'same'}>{movementLine(moved)}</p> : null}
          <dl className="lb-stand__figs">
            <div><dt>Mocks</dt><dd>{count(standing.tests)}</dd></div>
            <div><dt>Average score</dt><dd>{count(standing.average)}%</dd></div>
            {standing.points != null ? <div><dt>Total points</dt><dd>{count(standing.points)}</dd></div> : null}
          </dl>
          {standing.toNext != null ? (
            <p className="lb-next">{standing.rank === 1 ? 'You hold first place. Every mock you sit adds to your points.' : <>
              <b>{count(standing.toNext)} more {standing.toNext === 1 ? 'point' : 'points'}</b> and you share {ordinal(Math.max(1, standing.rank - 1))} place. Every mock you sit adds its points.</>}</p>
          ) : null}
          <Link href="/dashboard" className="lb-go" data-page-primary="">Start a practice session</Link>
        </section>
        {standing.ladder ? <Ladder standing={standing} /> : null}
        {standing.spread ? <Spread standing={standing} /> : null}
        <YourPapers />
        <p className="lb-note">Ranked by total points across your recorded mocks, all time, so your place moves as you practise. Equal totals share a place. Nobody else is named here, and the top places and bands show only when at least 20 students are ranked.</p>
      </>
    )}
    {/* What moves the place (W-083): the real marks of the student's last papers of one kind, when there are three or
        more. It draws nothing with fewer, so a new student never sees an invented line. */}
    {state === 'ready' && standing ? <div className="lb-record"><PaperTrend /></div> : null}
    {state === 'ready' && !standing && (
      <section className="lb-stand" aria-labelledby="lb-empty">
        <p className="lb-stand__place lb-stand__place--empty" id="lb-empty">You have no recorded mocks yet.</p>
        <p className="lb-note">Your place, the top 10 places and where averages sit appear here after your first recorded mock. Nobody else is named here.</p>
        <Link href="/dashboard" className="lb-go" data-page-primary="">Start a practice session</Link>
      </section>
    )}
  </div>;
}
