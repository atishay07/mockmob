"use client";

// The leaderboard: practice points across recorded mocks. The top three read as a ranking, not three
// equal cards: first place leads, the next two sit beside it. Below, every position in one ruled table.
// "Your place" is only said when the signed-in student is on the board, with the denominator (how many
// are listed). Simulated "Practice rival" entries are always labelled, in the row and in one plain line.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { SkeletonCard, ErrorState, EmptyState } from '@/components/ui/Skeleton';
import ArenaHead from '@/components/arena/ArenaHead';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import './leaderboard.css';

const ordinal = (n) => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
};
const kindOf = (entry, you) => (entry.userId === you ? 'You' : entry.isSynthetic ? 'Practice rival' : 'Recorded practice');
const points = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN') : '0');

function YourPlace({ entries, userId }) {
  const index = userId ? entries.findIndex((entry) => entry.userId === userId) : -1;
  return (
    <aside className="lb-you" aria-label="Your place">
      {index >= 0 ? (
        <>
          <p className="lb-you__place"><b>{ordinal(index + 1)}</b> of {entries.length} listed</p>
          <p className="lb-you__pts">{points(entries[index].totalScore)} points from {entries[index].tests} {entries[index].tests === 1 ? 'mock' : 'mocks'}</p>
        </>
      ) : (
        <p className="lb-you__pts">{userId ? 'You appear here after your first recorded mock.' : 'Sign in to see your place.'}</p>
      )}
      <Link href="/dashboard" className="lb-go">Start a practice session</Link>
    </aside>
  );
}

export default function LeaderboardPageClient() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState('loading');
  const load = useCallback(async () => {
    try { const data = await apiGet('/api/leaderboard'); if (!Array.isArray(data)) throw new Error('invalid_board'); setEntries(data); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; }; }, [load]);
  const retry = () => { setState('loading'); load(); };
  const ready = state === 'ready' && entries.length > 0;
  const top = entries.slice(0, 3);
  return <div className="student-page student-page--leaderboard ranks-page lb">
    <ArenaHead
      title="Keep good company. Keep practising."
      lede="Total MockMob points across recorded mocks. This board is separate from your CUET exam rank."
      aside={ready ? <YourPlace entries={entries} userId={user?.id} /> : <Link href="/dashboard" className="lb-go">Start a practice session</Link>}
    />
    {state === 'loading' && <SkeletonCard lines={6} />}
    {state === 'error' && <ErrorState scene="unreachable" message="The board did not load. Check your connection and try again." onRetry={retry} />}
    {state === 'ready' && !entries.length && <EmptyState scene="nothingYet" title="The board is waiting for a score." message="Complete a timed mock to begin your practice record." />}
    {ready && <>
      <ol className="lb-top" aria-label="Top three practice scores">
        {top.map((entry, index) => (
          <li key={entry.userId} data-rank={index + 1} data-you={entry.userId === user?.id || undefined}>
            <span className="lb-top__rank" aria-label={`Rank ${index + 1}`}>{index === 0 ? '1st place' : index + 1}</span>
            <div className="lb-top__who"><b>{entry.name || 'Mobber'}</b><small>{kindOf(entry, user?.id)}</small></div>
            <strong className="lb-top__pts">{points(entry.totalScore)}<small>points</small></strong>
          </li>
        ))}
      </ol>
      <div className="lb-table-wrap">
        <table className="lb-table">
          <caption className="sr-only">MockMob practice leaderboard</caption>
          <thead><tr><th scope="col">Rank</th><th scope="col">Mobber</th><th scope="col">Mocks</th><th scope="col">Points</th></tr></thead>
          <tbody>{entries.map((entry, index) => (
            <tr key={entry.userId} data-you={entry.userId === user?.id}>
              <td>{index + 1}</td>
              <th scope="row"><div className="lb-who"><Avatar name={entry.name} size="sm" /><span><b>{entry.name || 'Mobber'}</b><small>{entry.userId === user?.id ? 'You' : entry.isSynthetic ? 'Practice rival' : 'Mobber'}</small></span></div></th>
              <td>{entry.tests}</td>
              <td>{points(entry.totalScore)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {entries.some((entry) => entry.isSynthetic) && <p className="lb-note">Practice rivals are simulated benchmarks, not students or real exam results.</p>}
    </>}
  </div>;
}
