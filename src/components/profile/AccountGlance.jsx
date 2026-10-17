"use client";
// Account > Your progress (W-053: "You" leads with study days, badges, milestones and personal bests; plan and billing sit
// lower). One block under your sheet: this week's study days as the ring Today and Progress draw, the badges earned with
// the latest three, and your best paper. Every figure is the server's own (rhythm, study record, badge list), read once;
// nothing shows as earned without a date, and a read that fails says so with Try again. The full shelf stays on Progress.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { Medal } from '@/components/StudyBadges';
import {
  BADGE_STEPS, badgePaths, badgePathsFromApi, bestsRows, dayMonth, mergeDerived,
} from '@/lib/studyBadges';
import '@/components/study-badges.css';
import './account.css';

const R = 26;
const C = 2 * Math.PI * R;

function Ring({ done, goal }) {
  const share = goal > 0 ? Math.min(1, done / goal) : 0;
  return (
    <svg className="acct-glance__ring" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r={R} className="acct-glance__ring-base" />
      <circle cx="32" cy="32" r={R} className="acct-glance__ring-on" style={{ strokeDasharray: `${(C * share).toFixed(2)} ${C.toFixed(2)}` }} />
    </svg>
  );
}

export default function AccountGlance({ userId }) {
  const [state, setState] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    Promise.allSettled([apiGet('/api/me/rhythm'), apiGet('/api/me/study-record'), apiGet('/api/me/badges')]).then(([rhythm, record, badges]) => {
      if (!alive) return;
      if (rhythm.status !== 'fulfilled' && record.status !== 'fulfilled') { setState({ status: 'error' }); return; }
      setState({
        status: 'ready',
        rhythm: rhythm.status === 'fulfilled' ? rhythm.value : null,
        record: record.status === 'fulfilled' ? record.value : null,
        badges: badges.status === 'fulfilled' ? badgePathsFromApi(badges.value) : null,
      });
    });
    return () => { alive = false; };
  }, [userId, attempt]);

  const view = useMemo(() => {
    if (state.status !== 'ready') return null;
    const { rhythm, record, badges } = state;
    const zone = rhythm?.timeZone;
    let paths = null;
    if (badges) paths = badges.paths;
    else if (record && rhythm) paths = badgePaths(mergeDerived(rhythm.milestones, record.derived), rhythm);
    const steps = paths ? paths.flatMap((p) => p.steps) : [];
    const earned = steps.filter((s) => s.status === 'earned');
    const latest = [...earned].sort((a, b) => (b.earnedAt ?? 0) - (a.earnedAt ?? 0)).slice(0, 3);
    const next = paths ? paths.map((p) => p.next).find(Boolean) || null : null;
    const best = record && rhythm ? bestsRows({ bests: record.bests, fastest: record.fastest, rhythm, timeZone: zone })[0] || null : null;
    return { rhythm, zone, earned: earned.length, total: paths ? steps.length : BADGE_STEPS.length, latest, next, best, known: Boolean(paths) };
  }, [state]);

  if (state.status === 'error') {
    return (
      <section className="glass acct-card acct-glance" id="progress-glance" aria-labelledby="acct-glance-h">
        <h2 className="acct-h2" id="acct-glance-h">Your progress</h2>
        <p className="acct-glance__note" role="status">Your study days and badges did not load. <button type="button" className="acct-link acct-link--inline" onClick={() => { setState({ status: 'loading' }); setAttempt((n) => n + 1); }}>Try again</button></p>
      </section>
    );
  }

  const r = view?.rhythm;
  return (
    <section className="glass acct-card acct-glance" id="progress-glance" aria-labelledby="acct-glance-h" aria-busy={!view || undefined}>
      <header className="acct-glance__head">
        <h2 className="acct-h2" id="acct-glance-h">Your progress</h2>
        <Link className="acct-link" href="/progress">See all on Progress</Link>
      </header>
      <div className="acct-glance__grid">
        <div className="acct-glance__cell">
          {r ? (
            <Link className="acct-glance__week" href="/progress" aria-label={`This week, ${r.studyDays} of ${r.daysGoal} study days. Open your weeks.`}>
              <span className="acct-glance__ring-wrap"><Ring done={r.studyDays} goal={r.daysGoal} /><b aria-hidden="true">{r.studyDays}</b></span>
              <span className="acct-glance__text" aria-hidden="true"><b>{r.studyDays} of {r.daysGoal}</b><span>study days this week</span></span>
            </Link>
          ) : view ? <p className="acct-glance__note">Study days show after your first scored set.</p> : <span className="acct-sk acct-sk--glance skeleton" aria-hidden="true" />}
        </div>
        <div className="acct-glance__cell">
          {view ? (
            view.known ? (
              <Link className="acct-glance__badges" href="/progress#badges" aria-label={`${view.earned} of ${view.total} badges earned${view.latest.length ? `, latest ${view.latest.map((b) => b.name).join(', ')}` : ''}. Open your badges.`}>
                <span className="acct-glance__medals" aria-hidden="true">
                  {view.latest.length ? view.latest.map((b) => <Medal key={b.id} id={b.id} status="earned" />) : <Medal id={view.next?.id || 'first_scored_session'} status="next" />}
                </span>
                <span className="acct-glance__text" aria-hidden="true">
                  <b>{view.earned} of {view.total} badges</b>
                  <span>{view.latest[0] ? `Latest: ${view.latest[0].name}${view.latest[0].earnedAt ? `, ${dayMonth(view.latest[0].earnedAt, view.zone)}` : ''}` : view.next ? `Next: ${view.next.name}` : 'Every badge earned'}</span>
                </span>
              </Link>
            ) : <p className="acct-glance__note">Badges show after your first scored set.</p>
          ) : <span className="acct-sk acct-sk--glance skeleton" aria-hidden="true" />}
        </div>
        <div className="acct-glance__cell">
          {view ? (
            view.best ? (
              <Link className="acct-glance__best" href={view.best.href || '/progress#bests'} aria-label={`Personal best: ${view.best.value}, ${view.best.label}. ${view.best.note}`}>
                <b className="acct-glance__fig" aria-hidden="true">{view.best.value}</b>
                <span className="acct-glance__text" aria-hidden="true"><b>{view.best.label}</b><span>{view.best.note}</span></span>
              </Link>
            ) : <p className="acct-glance__note">Your best marks show after your first scored set. <Link className="acct-link acct-link--inline" href="/dashboard">Choose practice</Link></p>
          ) : <span className="acct-sk acct-sk--glance skeleton" aria-hidden="true" />}
        </div>
      </div>
    </section>
  );
}
