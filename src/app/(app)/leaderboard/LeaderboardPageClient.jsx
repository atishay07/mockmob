"use client";

// Leaderboard (kept under More, owner decision D11). Practice points from recorded mocks; separate
// from any CUET rank. Practice rivals are simulated benchmarks and are labelled on every row.
// Web redesign W2.4: kit page head and states, no numbered badges, the student's own place first.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { PageHead } from '@/components/ui/PageHead';
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { RecordSkeleton, looksOffline } from '../review/RecordParts';
import { boardRows, yourPlace } from './boardModel.mjs';
import './board.css';

export default function LeaderboardPageClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState('loading');
  const load = useCallback(async () => {
    try {
      const data = await apiGet('/api/leaderboard');
      if (!Array.isArray(data)) throw new Error('invalid_board');
      setEntries(data);
      setState('ready');
    } catch (e) {
      setState(looksOffline(e) ? 'offline' : 'error');
    }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; }; }, [load]);
  const retry = () => { setState('loading'); load(); };

  const rows = useMemo(() => boardRows(entries, user?.id), [entries, user?.id]);
  const place = yourPlace(rows);
  const anyRival = rows.some((r) => r.synthetic);

  return (
    <div className="student-page student-page--leaderboard lbx">
      <PageHead
        title="Leaderboard"
        lead="Practice points from recorded mocks. This board is separate from your CUET rank, and a place here says nothing about your exam."
        actions={<Link href="/dashboard" className="ui-btn ui-btn--secondary btn-outline ui-btn--sm"><span className="ui-btn__label">Start practice</span></Link>}
      />
      {state === 'loading' ? <RecordSkeleton label="Loading the leaderboard" thread={false} rows={6} /> : null}
      {state === 'offline' ? <OfflineState message="The board loads again once you are back online." onRetry={retry} /> : null}
      {state === 'error' ? <ErrorState title="The board did not load" message="Check your connection and try again." onRetry={retry} /> : null}
      {state === 'ready' && !rows.length ? (
        <EmptyState title="The board is waiting for a score" message="Finish a timed mock and your practice points start here." actionLabel="Start practice" onAction={() => router.push('/dashboard')} />
      ) : null}
      {state === 'ready' && rows.length > 0 ? (
        <>
          <div className="lbx-summary">
            {place ? <p className="lbx-you">{place}</p> : <p className="lbx-you">You are not on this board yet. Finish a timed mock to join it.</p>}
            {anyRival ? <p className="lbx-note">Rows marked Practice rival are simulated benchmarks, not students or real exam results.</p> : null}
          </div>
          <div className="lbx-table-wrap">
            <table className="lbx-table">
              <caption className="sr-only">Practice leaderboard, highest points first</caption>
              <thead><tr><th scope="col">Place</th><th scope="col">Name</th><th scope="col">Mocks</th><th scope="col">Points</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} data-you={r.you ? 'true' : undefined} data-top={r.place <= 3 ? 'true' : undefined}>
                    <td>{r.place}</td>
                    <th scope="row">
                      <div className="lbx-who">
                        <Avatar name={r.name} size="sm" />
                        <span><b>{r.name}</b><small>{r.kind}</small></span>
                      </div>
                    </th>
                    <td>{r.mocks}</td>
                    <td><b>{r.points}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
