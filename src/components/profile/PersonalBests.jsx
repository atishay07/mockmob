"use client";

// Personal bests (the app's You > Personal bests): the best and latest marks of each mock type,
// from /api/me/bests. Observed marks with their denominators, mocks only, first sittings only. No
// percentile, no rank and no comparison with other students. The strongest best leads; the rest are
// plain rows. Nothing renders until the server answered, and an empty list says what to do.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/fetcher';
import { useCountUp } from '@/lib/motion';
import { PRACTICE_HREF } from '@/lib/navigation';
import { BESTS_COPY, BESTS_PATH, bestBody, bestDatesLine, bestsFromServer, marksNumber, marksText } from './youModel.mjs';
import './you.css';

const share = (mark) => `${Math.max(0, Math.min(100, (mark.marks / mark.max) * 100))}%`;

function Bar({ label, mark, best }) {
  return (
    <div className="you-bar" data-best={best ? 'true' : 'false'}>
      <span>{label}</span>
      <span className="you-bar__track" aria-hidden="true"><i className="you-bar__fill" style={{ '--you-w': share(mark) }} /></span>
      <span>{marksText(mark)}</span>
    </div>
  );
}

function Lead({ row }) {
  const rolled = useCountUp(row.best.marks, { from: 0, duration: 800 });
  const dates = bestDatesLine(row);
  return (
    <div className="you-best">
      <h3 className="you-best__title">{row.title}</h3>
      <p className="you-best__figure" aria-label={marksText(row.best)}><b aria-hidden="true">{marksNumber(rolled)}</b><span aria-hidden="true">of {row.best.max} marks</span></p>
      {row.attempts >= 2 ? (
        <div className="you-best__bars">
          <Bar label="Best" mark={row.best} best />
          <Bar label="Latest" mark={row.latest} best={false} />
        </div>
      ) : null}
      <p className="you-best__text">{bestBody(row)}</p>
      {dates ? <p className="you-best__dates">{dates}</p> : null}
    </div>
  );
}

function Row({ row }) {
  const dates = bestDatesLine(row);
  return (
    <li className="you-best-row">
      <h4 className="you-best__title">{row.title}</h4>
      <p className="you-best__text">{bestBody(row)}</p>
      {dates ? <p className="you-best__dates">{dates}</p> : null}
    </li>
  );
}

export default function PersonalBests() {
  const [state, setState] = useState({ status: 'loading', rows: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    api(BESTS_PATH)
      .then((body) => { if (alive) setState({ status: 'ready', rows: bestsFromServer(body) }); })
      .catch(() => { if (alive) setState({ status: 'error', rows: [] }); });
    return () => { alive = false; };
  }, [attempt]);

  if (state.status === 'loading') {
    return <div className="you-goal__skeleton" aria-busy="true" aria-label="Loading your personal bests"><span className="you-sk you-sk--line" /><span className="you-sk you-sk--block" /></div>;
  }
  if (state.status === 'error') {
    return (
      <div className="you-state" role="alert">
        <b>{BESTS_COPY.failedTitle}</b>
        <p>{BESTS_COPY.failedBody}</p>
        <button type="button" className="you-key" onClick={() => { setState({ status: 'loading', rows: [] }); setAttempt((n) => n + 1); }}>Try again</button>
      </div>
    );
  }
  if (!state.rows.length) {
    return (
      <div className="you-state">
        <b>{BESTS_COPY.emptyTitle}</b>
        <p>{BESTS_COPY.emptyBody}</p>
        <Link className="you-key" href={`${PRACTICE_HREF}?mode=full`}>Set up a full mock</Link>
      </div>
    );
  }
  const [lead, ...others] = state.rows;
  return (
    <div className="you-bests">
      <Lead row={lead} />
      {others.length ? (
        <div>
          <h3 className="you-bests__sub">{BESTS_COPY.other}</h3>
          <ul className="you-list" style={{ marginTop: 10 }}>{others.map((row) => <Row key={row.key} row={row} />)}</ul>
        </div>
      ) : null}
      <p className="you-bests__foot">{BESTS_COPY.footnote}</p>
    </div>
  );
}
