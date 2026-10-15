"use client";

// Your submissions (the second tab of Contribute questions, was My uploads). The latest 20 questions the
// student sent and where each one stands: In review, Live, or Not published. The words are the glossary's
// (data/glossary.mjs UPLOAD_STATUS) and a status is never softer than the server said. A refresh keeps the
// list on screen while it loads; a failed load never looks like an empty list.
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { apiGet } from '@/lib/fetcher';
import {
  SUBMISSIONS_COPY, SUBMISSIONS_PATH, SUBMISSION_FILTERS, filterSubmissions, submissionCounts, submissionsFromServer,
} from './youModel.mjs';
import './you.css';

export default function Submissions({ onWrite = null }) {
  const [state, setState] = useState({ status: 'loading', rows: [] });
  const [filter, setFilter] = useState('all');
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    let alive = true;
    apiGet(SUBMISSIONS_PATH)
      .then((body) => {
        if (!alive) return;
        const rows = submissionsFromServer(body);
        setState(rows ? { status: 'ready', rows } : (s) => ({ status: 'error', rows: s.rows }));
      })
      .catch(() => { if (alive) setState((s) => ({ status: 'error', rows: s.rows })); });
    return () => { alive = false; };
  }, []);

  useEffect(() => load(), [load, attempt]);

  const refresh = () => { setState((s) => ({ status: 'refreshing', rows: s.rows })); setAttempt((n) => n + 1); };

  if (state.status === 'loading') {
    return <div className="you-goal__skeleton" aria-busy="true" aria-label={SUBMISSIONS_COPY.loadingLabel}><span className="you-sk you-sk--line" /><span className="you-sk you-sk--block" /></div>;
  }
  if (state.status === 'error' && !state.rows.length) {
    return (
      <div className="you-state" role="alert">
        <b>{SUBMISSIONS_COPY.failedTitle}</b>
        <p>{SUBMISSIONS_COPY.failedBody}</p>
        <button type="button" className="you-key" onClick={() => { setState({ status: 'loading', rows: [] }); setAttempt((n) => n + 1); }}>Try again</button>
      </div>
    );
  }

  const counts = submissionCounts(state.rows);
  const shown = filterSubmissions(state.rows, filter);
  const busy = state.status === 'refreshing';

  return (
    <div className="you-panel">
      {state.status === 'error' ? (
        <p className="you-note" role="alert" data-tone="err">{SUBMISSIONS_COPY.failedTitle}. {SUBMISSIONS_COPY.failedBody} The list below is from your last load.</p>
      ) : null}

      {state.rows.length ? (
        <div className="you-filters" role="group" aria-label="Filter your submissions">
          {SUBMISSION_FILTERS.map((option) => (
            <button key={option.id} type="button" className="you-filter" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
              {option.label}<span>{counts[option.id]}</span>
            </button>
          ))}
          <button type="button" className="you-filter" disabled={busy} onClick={refresh}>{busy ? SUBMISSIONS_COPY.refreshing : SUBMISSIONS_COPY.refresh}</button>
        </div>
      ) : null}

      {!state.rows.length ? (
        <div className="you-state">
          <b>{SUBMISSIONS_COPY.emptyTitle}</b>
          <p>{SUBMISSIONS_COPY.emptyBody}</p>
          {onWrite ? <button type="button" className="you-key" onClick={onWrite}>{SUBMISSIONS_COPY.emptyKey}</button> : null}
        </div>
      ) : !shown.length ? (
        <div className="you-state">
          <b>{SUBMISSIONS_COPY.groupEmptyTitle}</b>
          <p>{SUBMISSIONS_COPY.groupEmptyBody}</p>
          <button type="button" className="you-key" onClick={() => setFilter('all')}>{SUBMISSIONS_COPY.showAll}</button>
        </div>
      ) : (
        <ul className="you-subs" aria-busy={busy}>
          {shown.map((row) => (
            <li key={row.id}>
              <details className="you-sub" data-state={row.state}>
                <summary>
                  <span>
                    <span className="you-sub__q">{row.text}</span>
                    <span className="you-sub__meta">{row.meta}</span>
                  </span>
                  <span className="you-sub__end">
                    <span className="you-status" data-state={row.state}>{row.statusLabel}</span>
                    <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </summary>
                <div className="you-sub__detail">
                  <p>{row.detail}</p>
                  {row.submitted ? <dl><div><dt>Sent</dt><dd>{row.submitted}</dd></div></dl> : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

