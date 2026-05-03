"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { SkeletonCard, ErrorState } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';

export default function LeaderboardPageClient() {
  const { user: currentUser } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    apiGet('/api/leaderboard')
      .then(data => { if (alive) { setLeaderboard(data); setStatus('ready'); } })
      .catch(e => { if (alive) { setError(e.message); setStatus('error'); } });
    return () => { alive = false; };
  }, []);

  if (status === 'loading') {
    return (
      <div className="container-narrow">
        <div className="text-center mb-10 pt-6">
          <div className="eyebrow mb-3">{'// The Mob'}</div>
          <div className="h-12 w-64 skeleton mx-auto mb-3" />
          <div className="h-4 w-72 skeleton mx-auto" />
        </div>
        <SkeletonCard lines={6} />
      </div>
    );
  }
  if (status === 'error') return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const hasPracticeRivals = leaderboard.some((entry) => entry.isSynthetic);

  return (
    <div className="container-narrow">
      <div className="text-center mb-10 pt-6">
        <div className="eyebrow mb-3">{'// The Mob'}</div>
        <h1 className="display-lg mb-3">Global <span className="text-volt italic">Rankings.</span></h1>
        <p className="text-zinc-400">Total points across all mocks. Top 3 get the podium.</p>
        {hasPracticeRivals ? (
          <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-zinc-500">
            Practice rivals fill empty ranks until more real MockMob attempts land. Beat their totals to climb faster.
          </p>
        ) : null}
      </div>

      {leaderboard.length === 0 ? (
        <div className="glass p-12 text-center text-zinc-500">No scores yet. Drop the first mock.</div>
      ) : (
        <>
          <div className="flex items-end justify-center gap-2 mb-12 h-48 max-w-lg mx-auto">
            {leaderboard[1] && (
              <Podium rank={2} user={leaderboard[1]} heightPct={70} />
            )}
            {leaderboard[0] && (
              <Podium rank={1} user={leaderboard[0]} heightPct={100} isTop />
            )}
            {leaderboard[2] && (
              <Podium rank={3} user={leaderboard[2]} heightPct={55} />
            )}
          </div>

          <div className="glass overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-white/5 mono-label">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-6">Mobber</div>
              <div className="col-span-2 text-right">Tests</div>
              <div className="col-span-3 text-right">Score</div>
            </div>

            {leaderboard.map((entry, i) => {
              const isMe = currentUser?.id === entry.userId;
              return (
                <div key={entry.userId} className={`grid grid-cols-12 gap-4 p-4 items-center border-b border-white/5 last:border-0 ${isMe ? 'bg-volt/5' : ''}`}>
                  <div className="col-span-1 text-center font-display font-bold text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <Avatar name={entry.name} size="sm" />
                    <div className={`font-display font-bold truncate ${isMe ? 'text-volt' : 'text-white'}`}>
                      {entry.name}
                      {isMe && <span className="ml-2 pill volt">YOU</span>}
                      {entry.isSynthetic && <span className="ml-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">Rival</span>}
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-zinc-400 font-mono text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>{entry.tests}</div>
                  <div className="col-span-3 text-right font-display font-bold text-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>{entry.totalScore}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Podium({ rank, user, heightPct, isTop }) {
  const size = isTop ? 'lg' : rank === 2 ? 'md' : 'sm';
  const nameClass = isTop ? 'text-volt truncate w-24' : 'text-sm truncate w-20';
  return (
    <div
      className="podium text-center"
      style={{
        height: `${heightPct}%`,
        borderColor: isTop ? 'var(--volt)' : undefined,
        background: isTop ? 'linear-gradient(to bottom, rgba(210,240,0,0.1), rgba(255,255,255,0.01))' : undefined,
      }}
    >
      <div className="flex flex-col items-center">
        {isTop && <Icon name="trophy" style={{ color: 'var(--volt)', marginBottom: '8px' }} />}
        <Avatar name={user.name} size={size} className={`mb-2 ${isTop ? 'ring-2 ring-volt ring-offset-2 ring-offset-ink' : ''}`} />
        <div className={`font-display font-bold ${nameClass}`}>{user.name.split(' ')[0]}</div>
        {user.isSynthetic ? <div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Rival</div> : null}
        <div className="text-xs text-zinc-500 mb-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{user.totalScore}{isTop ? ' pts' : ''}</div>
        <div className={`rounded-full flex items-center justify-center font-bold ${isTop ? 'w-10 h-10 bg-volt text-black text-lg' : 'w-8 h-8 bg-white/5 text-zinc-400'}`}>{rank}</div>
      </div>
    </div>
  );
}
