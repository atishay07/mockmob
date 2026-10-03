"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { SkeletonCard, ErrorState, EmptyState } from '@/components/ui/Skeleton';
import ArenaHead from '@/components/arena/ArenaHead';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';

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
  return <div className="student-page student-page--leaderboard ranks-page">
    <ArenaHead eyebrow="The mob · practice points" title="Keep good company. Keep practising." lede="Total MockMob points across recorded mocks. This board is separate from your CUET exam rank." aside={<Link href="/dashboard" className="ex-action">Start a practice session ↗</Link>} />
    {state === 'loading' && <SkeletonCard lines={6} />}
    {state === 'error' && <ErrorState message="The board did not load. Check your connection and try again." onRetry={retry} />}
    {state === 'ready' && !entries.length && <EmptyState title="The board is waiting for a score." message="Complete a timed mock to begin your practice record." />}
    {state === 'ready' && entries.length > 0 && <>
      {entries.some((entry) => entry.isSynthetic) && <p className="ranks-note">Entries marked Practice rival are simulated benchmarks, not students or real exam results.</p>}
      <ol className="ranks-leaders" aria-label="Top three practice scores">{entries.slice(0, 3).map((entry, index) => <li key={entry.userId}><span className="ranks-place">{String(index + 1).padStart(2, '0')}</span><div><b>{entry.name || 'Mobber'}</b><small>{entry.isSynthetic ? 'Practice rival' : 'Recorded practice'}</small></div><strong>{entry.totalScore}<small>points</small></strong></li>)}</ol>
      <div className="ranks-table-wrap"><table className="ranks-table"><caption className="sr-only">MockMob practice leaderboard</caption><thead><tr><th scope="col">Position</th><th scope="col">Mobber</th><th scope="col">Mocks</th><th scope="col">Points</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={entry.userId} data-you={entry.userId === user?.id}><td>{index + 1}</td><th scope="row"><div className="ranks-identity"><Avatar name={entry.name} size="sm" /><span><b>{entry.name || 'Mobber'}</b><small>{entry.userId === user?.id ? 'You' : entry.isSynthetic ? 'Practice rival' : 'Mobber'}</small></span></div></th><td>{entry.tests}</td><td>{entry.totalScore}</td></tr>)}</tbody></table></div>
    </>}
  </div>;
}
