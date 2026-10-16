"use client";
// Mob history (Pro): the weekly papers that closed, newest first. Opens on a tap so the page does not read them until
// asked. Each week says how many sat and your own result; a week with 2 or more sitters opens as a side-by-side.
import { useState } from 'react';
import Link from 'next/link';
import { resultHref } from '@/lib/mob/model.mjs';
import { countLabel, weekLabel } from './mobFormat';

export function HistoryCard({ data, load, onCompare, comparing }) {
  const [state, setState] = useState({ status: 'closed', weeks: [], error: null });
  if (!data.plan.pro || !data.pastWeeks) return null;
  const show = async () => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    const r = await load();
    if (r.ok) setState({ status: 'open', weeks: r.data.weeks || [], error: null });
    else setState({ status: 'error', weeks: [], error: r.message });
  };
  return (
    <section className="glass mob-card" aria-labelledby="mob-history-h">
      <header className="mob-head">
        <h2 id="mob-history-h" className="mob-h2">Past weeks</h2>
        <span className="mob-count">{countLabel(data.pastWeeks, 'week')}</span>
      </header>
      {state.status === 'closed' ? <button type="button" className="mob-key mob-invite-row" onClick={show}>Show past weeks</button> : null}
      {state.status === 'loading' ? <div className="mob-loading" aria-busy="true" aria-label="Loading past weeks">{[0, 1, 2].map((i) => <span key={i} className="mob-skel mob-skel--row" />)}</div> : null}
      {state.status === 'error' ? (
        <div className="mob-actions" role="alert">
          <p className="mob-note">{state.error}</p>
          <button type="button" className="mob-key" onClick={show}>Try again</button>
        </div>
      ) : null}
      {state.status === 'open' ? (
        state.weeks.length ? (
          <ul className="mob-extras">
            {state.weeks.map((w) => (
              <li key={w.week} className="mob-extra">
                <div className="mob-extra__text">
                  <b>{weekLabel(w.week)}</b>
                  <span>{w.sat} {w.sat === 1 ? 'member' : 'members'} sat.{w.you.sat ? ` You scored ${w.you.score.value} of ${w.you.score.of}.` : ' You did not sit it.'}{w.extras ? ` ${countLabel(w.extras, 'extra paper')}.` : ''}</span>
                </div>
                <div className="mob-extra__actions">
                  {w.you.sat && w.you.resultId ? <Link className="mob-key" href={resultHref(w.you.resultId)}>See your answers</Link> : null}
                  {w.you.sat && w.sat >= 2 ? (
                    <button type="button" className="mob-key" onClick={() => onCompare(w.week)} disabled={comparing === w.week} aria-busy={comparing === w.week || undefined}>{comparing === w.week ? 'Opening' : 'Side by side'}</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="mob-note">Past weeks appear here after the first week closes.</p>
      ) : null}
    </section>
  );
}
