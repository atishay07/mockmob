"use client";

// Your standing: where your recorded mocks put you among the students ranked on MockMob. The server answers
// only for the signed-in student (rank, how many are ranked, their own mocks and average). Nobody else's
// name, photo or id reaches this page, and nothing here can be used to look another student up.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton, ErrorState } from '@/components/ui/Skeleton';
import ArenaHead from '@/components/arena/ArenaHead';
import { apiGet } from '@/lib/fetcher';
import './leaderboard.css';

const count = (n) => Number(n).toLocaleString('en-IN');
const ordinal = (n) => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${count(n)}th`;
  return `${count(n)}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
};

// The answer the API gives is { you: { rank, of, tests, average } | null, window }. Anything else is an error.
function readStanding(data) {
  if (!data || typeof data !== 'object' || !('you' in data)) throw new Error('invalid_standing');
  const you = data.you;
  if (you === null) return null;
  const rank = Number(you.rank); const of = Number(you.of); const tests = Number(you.tests); const average = Number(you.average);
  if (![rank, of, tests, average].every(Number.isFinite) || rank < 1 || of < rank) throw new Error('invalid_standing');
  return { rank, of, tests, average };
}

export default function LeaderboardPageClient() {
  const [standing, setStanding] = useState(null);
  const [state, setState] = useState('loading');
  const load = useCallback(async () => {
    try { setStanding(readStanding(await apiGet('/api/leaderboard'))); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; }; }, [load]);
  const retry = () => { setState('loading'); load(); };

  return <div className="student-page student-page--leaderboard ranks-page lb">
    <ArenaHead
      title="Your standing"
      lede="Where your recorded mocks place you among MockMob students. It is separate from your CUET exam rank."
    />
    {state === 'loading' && <div className="lb-stand" aria-busy="true" aria-label="Loading your standing"><Skeleton className="h-12 w-48" /><Skeleton className="h-4 w-full" /></div>}
    {state === 'error' && <ErrorState scene="unreachable" title="Your standing did not load" message="Check your connection and try again." onRetry={retry} />}
    {state === 'ready' && standing && (
      <section className="lb-stand" aria-labelledby="lb-place">
        <p className="lb-stand__place" id="lb-place"><b>{ordinal(standing.rank)}</b> of {count(standing.of)} {standing.of === 1 ? 'student' : 'students'} who {standing.of === 1 ? 'has' : 'have'} sat a mock</p>
        <dl className="lb-stand__figs">
          <div><dt>Mocks</dt><dd>{count(standing.tests)}</dd></div>
          <div><dt>Average score</dt><dd>{count(standing.average)}%</dd></div>
        </dl>
        <p className="lb-note">Ranked by total points across your recorded mocks, so your place moves as you practise. Nobody else is named here.</p>
        <Link href="/dashboard" className="lb-go" data-page-primary="">Start a practice session</Link>
      </section>
    )}
    {state === 'ready' && !standing && (
      <section className="lb-stand" aria-labelledby="lb-empty">
        <p className="lb-stand__place lb-stand__place--empty" id="lb-empty">You have no recorded mocks yet.</p>
        <p className="lb-note">Your standing appears here after your first recorded mock. Nobody else is named here.</p>
        <Link href="/dashboard" className="lb-go" data-page-primary="">Start a practice session</Link>
      </section>
    )}
  </div>;
}
