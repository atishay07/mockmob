"use client";

// Leaderboard (You > Community, web only). Real students are ranked among themselves, so a simulated rival
// never takes a place above a student. The simulated practice rivals MockMob adds sit apart, under the
// table, in a labelled disclosure that says what they are. Rules in youModel.mjs (splitLeaderboard).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { apiGet } from '@/lib/fetcher';
import { useAuth } from '@/components/AuthProvider';
import { PRACTICE_HREF, YOU_HREF } from '@/lib/navigation';
import { BOARD_COPY, boardTag, splitLeaderboard, yourPlaceLine } from '@/components/profile/youModel.mjs';
import '@/components/profile/you.css';

function BoardTable({ rows, offset = 0, userId, caption }) {
  return (
    <div className="ranks-table-wrap">
      <table className="ranks-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{BOARD_COPY.positionColumn}</th>
            <th scope="col">{BOARD_COPY.nameColumn}</th>
            <th scope="col">{BOARD_COPY.mocksColumn}</th>
            <th scope="col">{BOARD_COPY.pointsColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, index) => (
            <tr key={entry.userId} data-you={Boolean(userId) && entry.userId === userId}>
              <td>{offset + index + 1}</td>
              <th scope="row">
                <div className="ranks-identity">
                  <Avatar name={entry.name} size="sm" />
                  <span><b>{entry.name || 'A student'}</b><small>{boardTag(entry, userId)}</small></span>
                </div>
              </th>
              <td>{entry.tests}</td>
              <td>{entry.totalScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeaderboardPageClient() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState('loading');
  const load = useCallback(async () => {
    try {
      const data = await apiGet('/api/leaderboard');
      if (!Array.isArray(data)) throw new Error('invalid_board');
      setEntries(data);
      setState('ready');
    } catch { setState('error'); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) load(); }); return () => { active = false; }; }, [load]);
  const retry = () => { setState('loading'); load(); };

  const board = useMemo(() => splitLeaderboard(entries, user?.id), [entries, user?.id]);
  const placeLine = yourPlaceLine(board);

  return (
    <div className="student-page student-page--leaderboard you you--narrow">
      <header className="you__head">
        <div className="you__head-text">
          <h1 className="you__title">{BOARD_COPY.title}</h1>
          <p className="you__lede">{BOARD_COPY.lead}</p>
        </div>
        <Link className="you-key" href={YOU_HREF}>Back to You</Link>
      </header>

      {state === 'loading' ? (
        <div className="you-goal__skeleton" aria-busy="true" aria-label="Loading the leaderboard"><span className="you-sk you-sk--line" /><span className="you-sk you-sk--block" /></div>
      ) : null}

      {state === 'error' ? (
        <div className="you-state" role="alert">
          <b>{BOARD_COPY.failedTitle}</b>
          <p>{BOARD_COPY.failedBody}</p>
          <button type="button" className="you-key" onClick={retry}>Try again</button>
        </div>
      ) : null}

      {state === 'ready' ? (
        <section className="you-board" aria-label={BOARD_COPY.studentsLabel}>
          {board.students.length ? (
            <>
              <p className="you-board__place">{placeLine || BOARD_COPY.notOnBoard}</p>
              <BoardTable rows={board.students} userId={user?.id} caption={BOARD_COPY.studentsLabel} />
            </>
          ) : (
            <div className="you-state">
              <b>{BOARD_COPY.emptyTitle}</b>
              <p>{BOARD_COPY.emptyBody}</p>
              <Link className="you-key" href={`${PRACTICE_HREF}?mode=full`}>Set up a full mock</Link>
            </div>
          )}

          {board.rivals.length ? (
            <details className="you-rivals">
              <summary>{BOARD_COPY.rivalsTitle}<ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" /></summary>
              <div className="you-rivals__body">
                <p>{BOARD_COPY.rivalsNote}</p>
                <BoardTable rows={board.rivals} userId={null} caption={BOARD_COPY.rivalsTitle} />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
