"use client";

// Badges and Personal bests on Progress: the website's half of the app's You tab (same names, same
// rules: lib/studyBadges.js). The server's own badge list (/api/me/badges, contract
// docs/design-decisions/badges-api-1016.md) is the authority for the badges: its dates, counts and
// papers. Where that route is not there yet, the badges are worked out from the papers
// (/api/me/study-record, the same rules the app uses) and the rhythm from RhythmCard (/api/me/rhythm).
// The bests, the fastest answer and the per-type marks always come from /api/me/study-record.
// Nothing shows as earned without a record that dates it, a locked badge says exactly what earns it,
// and while the papers are loading the block waits (a badge is never shown locked on a guess).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Check, CircleCheckBig, FileText, LayoutGrid, Monitor, Repeat, ShieldCheck, TrendingUp } from 'lucide-react';
import { apiGet } from '@/lib/fetcher';
import {
  badgePaths, badgePathsFromApi, bestsRows, countEntries, dayMonth, earnedLine, formatLines, fractionOf, mergeDerived,
  milestoneProgress, recordLine, soFarLine,
} from '@/lib/studyBadges';
import './study-badges.css';

// The medal's engraving: a numeral or a plain line icon, as in the app.
const GLYPHS = {
  first_scored_session: '1', first_full_mock: FileText, first_nta: Monitor, sessions_10: '10', full_mocks_5: '5',
  first_repair: Check, repairs_5: '5', repairs_10: '10', repairs_25: '25', first_hold: ShieldCheck,
  first_week_met: CalendarCheck, weeks_met_4: '4', run_weeks_3: Repeat,
  clean_set: CircleCheckBig, four_subjects: LayoutGrid, new_best: TrendingUp,
};

export function Medal({ id, status }) {
  const Glyph = GLYPHS[id];
  return (
    <span className="sb-medal" data-status={status} aria-hidden="true">
      {typeof Glyph === 'string' ? <b>{Glyph}</b> : Glyph ? <Glyph size={17} strokeWidth={1.75} /> : null}
    </span>
  );
}

function BadgeRow({ step, path, record, progress, zone, armed, linkShown }) {
  const earned = step.status === 'earned';
  const unknown = step.status === 'unknown';
  const sequence = path.id !== 'best';
  const lead = earned || unknown ? null : step.status === 'next' && sequence ? 'Next.' : 'Not yet.';
  const fraction = !earned ? fractionOf(step.id, progress) : null;
  const so = !earned ? soFarLine(step.id, progress) : null;
  const paper = earned && record ? recordLine(record, zone) : '';
  return (
    <li className="sb-badge" data-status={step.status} data-sequence={sequence ? 'true' : 'false'}>
      <Medal id={step.id} status={step.status === 'next' && sequence ? 'next' : step.status === 'earned' ? 'earned' : 'later'} />
      <div className="sb-badge__body">
        <b className="sb-badge__name">{step.name}</b>
        {earned ? (
          <p className="sb-badge__state">{step.undated || step.earnedAt == null ? 'Earned. The date is not recorded yet.' : `Earned ${dayMonth(step.earnedAt, zone)}`}</p>
        ) : unknown ? (
          <p className="sb-badge__state">This one could not be checked just now. {step.condition}</p>
        ) : (
          <p className="sb-badge__state"><span className="sb-badge__lead">{lead}</span> {step.condition}</p>
        )}
        {paper ? (
          <p className="sb-badge__paper">{paper}{record.attemptId ? <> <Link className="sb-link" href={`/result/${record.attemptId}`}>Open that paper</Link></> : null}</p>
        ) : null}
        {fraction != null ? (
          <div className="sb-so-far">
            <span className="sb-bar" aria-hidden="true"><span className="sb-bar__fill" data-armed={armed ? 'true' : 'false'} style={{ '--sb-fill': fraction }} /></span>
            <span className="sb-so-far__text">{so}</span>
          </div>
        ) : null}
        {linkShown && path.link ? <p className="sb-badge__go"><Link className="sb-link" href={path.link.href}>{path.link.label}</Link></p> : null}
      </div>
    </li>
  );
}

function Badges({ paths, records, progress, zone, armed }) {
  return (
    <div className="rc-block sb-block" id="badges">
      <div className="sb-head">
        <h3 className="rc-h">Badges</h3>
        <p className="sb-count">{earnedLine(paths)}</p>
      </div>
      <div className="sb-paths">
        {paths.map((path) => {
          const firstNext = path.steps.find((s) => s.status === 'next');
          return (
            <section key={path.id} className="sb-path" aria-label={`${path.title} badges`}>
              <header><b>{path.title}</b><span>{path.earned} of {path.total}</span></header>
              <ol className="sb-list">
                {path.steps.map((step) => (
                  <BadgeRow
                    key={step.id}
                    step={step}
                    path={path}
                    record={records?.[step.id]}
                    progress={progress}
                    zone={zone}
                    armed={armed}
                    linkShown={firstNext?.id === step.id}
                  />
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Bests({ rows, lines, fastest, scored, zone, armed }) {
  if (!rows.length) {
    return (
      <div className="rc-block sb-block" id="bests">
        <h3 className="rc-h">Personal bests</h3>
        <p className="sb-empty">Your bests show after your first scored set. <Link className="sb-link" href="/dashboard">Choose practice</Link></p>
      </div>
    );
  }
  return (
    <div className="rc-block sb-block" id="bests">
      <h3 className="rc-h">Personal bests</h3>
      <ul className="sb-bests">
        {rows.map((r) => (
          <li key={r.key} className="sb-best">
            <b className="sb-best__value">{r.value}</b>
            <div className="sb-best__text">
              <span className="sb-best__label">{r.label}</span>
              <span className="sb-best__note">{r.note}{r.href ? <> <Link className="sb-link" href={r.href}>Open that paper</Link></> : null}</span>
            </div>
          </li>
        ))}
      </ul>
      {fastest ? <p className="sb-foot">Answers under 3 seconds are not counted in your fastest right answer.</p>
        : scored > 0 ? <p className="sb-foot">Fastest right answer: no timed answers yet. Timings are kept from your next paper.</p> : null}
      {lines.length ? (
        <div className="sb-types">
          <h4 className="sb-types__title">By mock type</h4>
          <ul>
            {lines.map((l) => (
              <li key={l.key} className="sb-type">
                <b>{l.title}</b>
                <span className="sb-bar sb-bar--wide" aria-hidden="true">
                  <span className="sb-bar__fill" data-armed={armed ? 'true' : 'false'} style={{ '--sb-fill': l.fraction }} />
                  {l.latestFraction != null ? <span className="sb-bar__tick" style={{ left: `${Math.round(l.latestFraction * 100)}%` }} /> : null}
                </span>
                <span className="sb-type__line">Best {l.best}{l.bestOn ? `, ${l.bestOn}` : ''}{l.latest ? `. Latest ${l.latest}${l.latestOn ? `, ${l.latestOn}` : ''}` : ''}.</span>
              </li>
            ))}
          </ul>
          <p className="sb-foot">These are marks from your own mocks of the same type. A retake of a paper you have seen does not count.</p>
        </div>
      ) : null}
    </div>
  );
}

/** Badges and Personal bests for the student whose rhythm is `rhythm`. */
export default function StudyBadges({ rhythm, armed }) {
  const [state, setState] = useState({ status: 'loading', record: null, badges: null });
  const [attempt, setAttempt] = useState(0);

  // Both reads are waited for together, so a badge is never drawn locked and then flipped. The badge
  // list may be absent (an older server): then the papers answer for the badges.
  useEffect(() => {
    let alive = true;
    Promise.allSettled([apiGet('/api/me/study-record'), apiGet('/api/me/badges')]).then(([record, badges]) => {
      if (!alive) return;
      setState({
        status: record.status === 'fulfilled' || badges.status === 'fulfilled' ? 'ready' : 'error',
        record: record.status === 'fulfilled' ? record.value : null,
        badges: badges.status === 'fulfilled' ? badgePathsFromApi(badges.value) : null,
      });
    });
    return () => { alive = false; };
  }, [attempt]);

  const zone = rhythm?.timeZone;
  const { record, badges } = state;
  const view = useMemo(() => {
    if (state.status !== 'ready' || !rhythm) return null;
    let board = null;
    if (badges) board = { paths: badges.paths, progress: badges.progress, records: badges.records };
    else if (record) board = { paths: badgePaths(mergeDerived(rhythm.milestones, record.derived), rhythm), progress: countEntries(milestoneProgress(record.counts, rhythm)), records: record.records || {} };
    return {
      board,
      bests: record ? {
        rows: bestsRows({ bests: record.bests, fastest: record.fastest, rhythm, timeZone: zone, bestRunEndedWeek: badges?.bestRunEndedWeek }),
        lines: formatLines(record.bests, zone),
      } : null,
    };
  }, [state.status, record, badges, rhythm, zone]);

  if (state.status === 'error') {
    return (
      <div className="rc-block sb-block">
        <h3 className="rc-h">Badges and personal bests</h3>
        <p className="sb-empty" role="alert">Your badges and best marks could not be loaded. Your saved sessions are still in Review.</p>
        <button type="button" className="pr-link sb-retry" onClick={() => { setState({ status: 'loading', record: null, badges: null }); setAttempt((n) => n + 1); }}>Try again</button>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="rc-block sb-block" aria-busy="true" aria-label="Badges and personal bests">
        <span className="rc__skeleton" aria-hidden="true" />
      </div>
    );
  }
  return (
    <>
      {view.board
        ? <Badges paths={view.board.paths} records={view.board.records} progress={view.board.progress} zone={zone} armed={armed} />
        : <Unavailable title="Badges" />}
      {view.bests
        ? <Bests rows={view.bests.rows} lines={view.bests.lines} fastest={record.fastest} scored={record.scoredAttempts} zone={zone} armed={armed} />
        : <Unavailable title="Personal bests" />}
    </>
  );
}

function Unavailable({ title }) {
  return (
    <div className="rc-block sb-block">
      <h3 className="rc-h">{title}</h3>
      <p className="sb-empty">This could not be loaded just now. Reload the page to try again.</p>
    </div>
  );
}
