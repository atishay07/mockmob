"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DAILY_FIVE_PATH } from '@/lib/dailyFive.mjs';
import { DAILY_FIVE_MOB_ROUTE, acceptStrip } from '@/lib/dailyFiveAccount.mjs';
import './daily-strip.css';

// The Mob den's Daily Five strip (15 Nov 2026, lane daily): one quiet card under the den's quest strip. Which members played
// today's five, each as the five right or wrong squares (no question, no score line), "Not yet" for the others, "Played" for a
// member who keeps their score to themselves. Members only (GET /api/daily/mob checks the membership, as the den does), in the
// den's own member order, never sorted by score. One quiet link to /daily, never volt (the den's game card holds the volt key).
// States: loading (the rows' shape, one per member, so nothing moves when they arrive), error (one line and Try again), ready.
// It reads again when the tab comes back, so a friend's five arrives without a reload.

const initialOf = (name) => (String(name || '').trim()[0] || '?').toUpperCase();

function Squares({ marks }) {
  return (
    <span className="dfs__squares" aria-hidden="true">
      {marks.map((right, i) => <i key={i} data-right={right ? 'true' : 'false'} />)}
    </span>
  );
}

const marksWords = (marks) => `${marks.filter(Boolean).length} of 5 right`;

export default function DailyFiveStrip({ mobId, size = 1 }) {
  const [state, setState] = useState({ status: 'loading' }); // loading | ready | failed
  const read = useCallback(async () => {
    try {
      const response = await fetch(`${DAILY_FIVE_MOB_ROUTE}?mob=${encodeURIComponent(mobId)}`, { cache: 'no-store' });
      if (response.status === 404) { setState({ status: 'gone' }); return; }
      const body = response.ok ? acceptStrip(await response.json()) : null;
      setState(body ? { status: 'ready', ...body } : { status: 'failed' });
    } catch {
      setState({ status: 'failed' });
    }
  }, [mobId]);

  useEffect(() => {
    if (!mobId) return undefined;
    const t = window.setTimeout(read, 0);
    const back = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', back);
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', back); };
  }, [mobId, read]);

  // The Mob is off, or this student is not in it (any more): the den shows nothing here.
  if (!mobId || state.status === 'gone') return null;
  const you = state.status === 'ready' ? state.members.find((m) => m.you) : null;
  const youPlayed = Boolean(you && you.state !== 'not_yet');

  return (
    <section className="dfs" aria-labelledby="dfs-title" aria-busy={state.status === 'loading' ? 'true' : undefined}>
      <div className="dfs__head">
        <h3 id="dfs-title" className="dfs__title">Daily Five today</h3>
        {state.status === 'ready' ? (
          <Link className="mob-link dfs__go" href={DAILY_FIVE_PATH}>{youPlayed ? 'See your five' : 'Play today’s five'}</Link>
        ) : null}
      </div>
      {state.status === 'failed' ? (
        <p className="dfs__note" role="status">
          Couldn’t load your Mob’s Daily Five.{' '}
          <button type="button" className="mob-link dfs__again" onClick={() => { setState({ status: 'loading' }); read(); }}>Try again</button>
        </p>
      ) : (
        <ul className="dfs__list">
          {state.status === 'loading'
            ? Array.from({ length: Math.max(1, Math.min(5, size)) }, (_, i) => (
              <li key={i} className="dfs__row" data-loading="true"><span className="mob-disc dfs__disc" aria-hidden="true" /><span className="dfs__name"><i /></span></li>
            ))
            : state.members.map((m, i) => (
              <li key={`${i}-${m.name}`} className="dfs__row">
                <span className="mob-disc dfs__disc" data-colour={m.colour} aria-hidden="true">{initialOf(m.name)}</span>
                <span className="dfs__name">{m.name}{m.you ? <span className="dfs__you"> (you)</span> : null}</span>
                {m.state === 'marks' ? (
                  <span className="dfs__state"><Squares marks={m.marks} /><span className="sr-only">{marksWords(m.marks)}</span></span>
                ) : (
                  <span className="dfs__state dfs__word" data-state={m.state}>{m.state === 'played' ? 'Played' : 'Not yet'}</span>
                )}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
