"use client";

// Account > Credits (audit findings 12 and 13): both balances with what they are for and when the AI credits renew,
// then the history, newest first, 30 lines a page. Two names only: "Practice credits" and "AI credits".
// Reads GET /api/me/credits once, then ?cursor= for "Show more". Unknown is never shown as 0.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditMark } from '@/components/ui/Glyph';
import { apiGet } from '@/lib/fetcher';
import {
  CREDITS_COPY, CREDITS_URL, FILTERS, appendPage, creditTiles, creditsFromResponse, filterHistory, historyLine,
} from './creditsModel.mjs';
import './credits.css';

const EMPTY = { status: 'loading', data: null, history: [], next: null, moreStatus: 'idle' };

export default function CreditsSection({ userId }) {
  const [state, setState] = useState(EMPTY);
  const [filter, setFilter] = useState('all');
  const sequence = useRef(0);

  const load = useCallback(() => {
    const mine = ++sequence.current;
    setState((prev) => (prev.data ? prev : EMPTY));
    apiGet(CREDITS_URL)
      .then((body) => {
        if (mine !== sequence.current) return;
        const data = creditsFromResponse(body);
        setState(data
          ? { status: 'ready', data, history: data.history, next: data.nextCursor, moreStatus: 'idle' }
          : { ...EMPTY, status: 'failed' });
      })
      .catch(() => { if (mine === sequence.current) setState({ ...EMPTY, status: 'failed' }); });
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    const timer = window.setTimeout(load, 0);
    return () => { window.clearTimeout(timer); sequence.current += 1; };
  }, [userId, load]);

  const more = () => {
    if (!state.next || state.moreStatus === 'loading') return;
    const mine = sequence.current;
    setState((prev) => ({ ...prev, moreStatus: 'loading' }));
    apiGet(`${CREDITS_URL}?cursor=${encodeURIComponent(state.next)}`)
      .then((body) => {
        if (mine !== sequence.current) return;
        const page = creditsFromResponse(body);
        setState((prev) => (page
          ? { ...prev, history: appendPage(prev.history, page.history), next: page.nextCursor, moreStatus: 'idle' }
          : { ...prev, moreStatus: 'failed' }));
      })
      .catch(() => { if (mine === sequence.current) setState((prev) => ({ ...prev, moreStatus: 'failed' })); });
  };

  const tiles = state.data ? creditTiles(state.data) : null;
  const lines = filterHistory(state.history, filter).map(historyLine);

  return (
    <section className="glass acct-card cr" id="credits" aria-labelledby="cr-h" aria-busy={state.status === 'loading' || undefined}>
      <h2 className="acct-h2" id="cr-h">{CREDITS_COPY.heading}</h2>

      {state.status === 'loading' ? (
        <div className="cr-tiles" role="status" aria-label={CREDITS_COPY.loading}>
          <span className="cr-sk skeleton" aria-hidden="true" />
          <span className="cr-sk skeleton" aria-hidden="true" />
        </div>
      ) : null}

      {state.status === 'failed' ? (
        <div className="cr-failed" role="alert">
          <p>{CREDITS_COPY.failed}</p>
          <button type="button" className="acct-key" onClick={load}>{CREDITS_COPY.retry}</button>
        </div>
      ) : null}

      {tiles ? (
        <>
          <div className="cr-tiles">
            {tiles.map((tile) => (
              <div className="cr-tile" key={tile.pool} data-pool={tile.pool} data-state={tile.state}>
                <p className="cr-tile__name"><CreditMark kind={tile.pool === 'ai' ? 'prepos' : 'practice'} size={16} />{tile.name}</p>
                <p className="cr-tile__figure">{tile.figure ?? <span className="cr-tile__unknown">Unknown</span>}</p>
                {tile.lines.map((text) => <p className="cr-tile__line" key={text}>{text}</p>)}
              </div>
            ))}
          </div>

          <div className="cr-history">
            <div className="cr-history__head">
              <h3>{CREDITS_COPY.history}</h3>
              <div className="cr-filter" role="group" aria-label="Show history for">
                {FILTERS.map((f) => (
                  <button type="button" key={f.id} className="cr-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
                ))}
              </div>
            </div>

            {lines.length ? (
              <ol className="cr-list">
                {lines.map((l) => (
                  <li className="cr-line" key={l.key} data-pool={l.pool}>
                    <div className="cr-line__what">
                      <b>{l.what}</b>
                      <span className="cr-line__meta">{l.when ? <span>{l.when}</span> : null}<span className="cr-line__pool">{l.poolName}</span></span>
                    </div>
                    <div className="cr-line__num" data-sign={l.change > 0 ? 'up' : l.change < 0 ? 'down' : 'flat'}>
                      <b aria-hidden="true">{l.changeText}</b>
                      <span className="sr-only">{l.spokenChange}</span>
                      {l.after ? <span className="cr-line__after">{l.after}</span> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="acct-note">{state.history.length ? CREDITS_COPY.emptyFilter : CREDITS_COPY.empty}</p>
            )}

            {state.next ? (
              <div className="cr-more">
                <button type="button" className="acct-key" onClick={more} disabled={state.moreStatus === 'loading'}>
                  {state.moreStatus === 'loading' ? CREDITS_COPY.moreLoading : CREDITS_COPY.more}
                </button>
                {state.moreStatus === 'failed' ? <p className="acct-note" data-tone="err" role="alert">{CREDITS_COPY.moreFailed}</p> : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
