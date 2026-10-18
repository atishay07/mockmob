"use client";

// Badges and Personal bests on Progress: the website's half of the app's You tab (same names, same
// rules: lib/studyBadges.js). BADGES-REFINE-1018: the badges are a section of Progress of their own (after the
// record, no longer inside the week card): the earned medals on a shelf, newest first, then the next one to earn
// as a ghost medal with its count; on a desktop the four paths follow inline, on a phone "All badges" opens them
// as a sheet. A tap on any medal opens its detail (BadgeDetail.jsx). Nothing is removed: all sixteen, the four
// paths and the Medal art stay.
// The server's own badge list (/api/me/badges, contract docs/design-decisions/badges-api-1016.md) is the
// authority for the badges: its dates, counts and papers. Where that route is not there yet, the badges are
// worked out from the papers (/api/me/study-record, the same rules the app uses) and the rhythm from
// RhythmCard (/api/me/rhythm). The bests, the fastest answer and the per-type marks always come from
// /api/me/study-record. Nothing shows as earned without a record that dates it, a locked badge says exactly
// what earns it, and while the papers are loading the block waits (a badge is never shown locked on a guess).
// A failed read says so in one line with Try again: unknown is never drawn as zero.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { useInView } from '@/lib/motion/useInView';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { useMedia } from '@/lib/useMedia';
import { Medal } from '@/components/Medal';
import { BadgeDetailBody, BadgeLayer, useLayerClose } from '@/components/BadgeDetail';
import {
  badgePaths, badgePathsFromApi, bestsRows, countEntries, dayMonth, earnedLine, formatLines, fractionOf, mergeDerived,
  milestoneProgress, recordLine, soFarLine,
} from '@/lib/studyBadges';
import { DEFAULT_ZONE, countLeft, detailOf, earnedShelf, ghostLine, headLine, pickNext, shortDay } from '@/lib/badgeShelf';
import './study-badges.css';

export { Medal };

const WIDE = '(min-width: 761px)';

function BadgeRow({ step, path, record, progress, zone, armed, linkShown, onOpen }) {
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
        {/* The whole row is the control (a stretched button on the name); the links inside stay their own. */}
        <b className="sb-badge__name"><button type="button" className="sb-badge__open" aria-haspopup="dialog" onClick={(event) => onOpen(step.id, event.currentTarget)}>{step.name}</button></b>
        {earned ? (
          <p className="sb-badge__state">{step.undated || step.earnedAt == null ? 'Earned. The date is not recorded yet.' : `Earned ${dayMonth(step.earnedAt, zone)}`}</p>
        ) : unknown ? (
          <p className="sb-badge__state">This one could not be checked just now. {step.condition}</p>
        ) : (
          <p className="sb-badge__state"><span className="sb-badge__lead">{lead}</span> {step.condition}</p>
        )}
        {paper ? (
          <p className="sb-badge__paper">{paper}{record.attemptId ? <> <Link className="sb-link sb-link--tap" href={`/result/${record.attemptId}`}>Open that paper</Link></> : null}</p>
        ) : null}
        {fraction != null ? (
          <div className="sb-so-far">
            <span className="sb-bar" aria-hidden="true"><span className="sb-bar__fill" data-armed={armed ? 'true' : 'false'} style={{ '--sb-fill': fraction }} /></span>
            <span className="sb-so-far__text">{so}</span>
          </div>
        ) : null}
        {linkShown && path.link ? <p className="sb-badge__go"><Link className="sb-link sb-link--tap" href={path.link.href}>{path.link.label}</Link></p> : null}
      </div>
    </li>
  );
}

/**
 * The four paths, as before: two ruled columns on a desktop, one on a phone. `hideEarned` is the page's inline copy (desktop),
 * where the shelf right above already shows every earned medal: nothing is shown twice (release 9), so the lists keep the next,
 * the locked and the unknown rows, and the header keeps the count ("3 of 4"). The All badges sheet lists everything.
 */
function Paths({ paths, records, progress, zone, armed, onOpen, hideEarned = false }) {
  return (
    <div className="sb-paths" data-earned-hidden={hideEarned ? 'true' : undefined}>
      {paths.map((path) => {
        const firstNext = path.steps.find((s) => s.status === 'next');
        const steps = hideEarned ? path.steps.filter((s) => s.status !== 'earned') : path.steps;
        return (
          <section key={path.id} className="sb-path" aria-label={`${path.title} badges`}>
            <header><b>{path.title}</b><span>{path.earned} of {path.total}</span></header>
            {steps.length === 0 ? <p className="sb-path__done">All {path.total} earned.</p> : (
            <ol className="sb-list">
              {steps.map((step) => (
                <BadgeRow
                  key={step.id}
                  step={step}
                  path={path}
                  record={records?.[step.id]}
                  progress={progress}
                  zone={zone}
                  armed={armed}
                  linkShown={firstNext?.id === step.id}
                  onOpen={onOpen}
                />
              ))}
            </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** The next badge: a ghost medal (dashed, never a padlock) with a thin ring for the exact count, and one line. */
function NextBadge({ pick, entries, armed, onOpen }) {
  const { step, path } = pick;
  const count = countLeft(step.id, entries);
  const fraction = count && count.current > 0 ? count.fraction : null;
  return (
    <div className="sb-next">
      <button type="button" className="sb-next__btn" aria-haspopup="dialog" onClick={(event) => onOpen(step.id, event.currentTarget)}>
        <span className="sb-ghost" aria-hidden="true">
          <Medal id={step.id} status="later" size="lg" />
          {fraction != null ? (
            <svg className="sb-ghost__ring" viewBox="0 0 68 68" focusable="false">
              <circle className="sb-ghost__track" cx="34" cy="34" r="32" />
              <circle className="sb-ghost__arc" cx="34" cy="34" r="32" pathLength="1" data-armed={armed ? 'true' : 'false'} style={{ '--sb-fill': fraction }} />
            </svg>
          ) : null}
        </span>
        <span className="sb-next__text">
          <span className="sb-next__lead">Next badge</span>
          <b>{step.name}</b>
          <span className="sb-next__line">{ghostLine(step, path, entries)}</span>
        </span>
      </button>
    </div>
  );
}

function Shelf({ shelf, zone, onOpen }) {
  return (
    <ul className="sb-shelf" aria-label="Badges you have earned, newest first">
      {shelf.map(({ step }) => (
        <li key={step.id}>
          <button type="button" className="sb-shelf__item" aria-haspopup="dialog" onClick={(event) => onOpen(step.id, event.currentTarget)}>
            <Medal id={step.id} status="earned" size="lg" />
            <span className="sb-shelf__name">{step.name}</span>
            <span className="sb-shelf__date">{step.earnedAt != null && !step.undated ? shortDay(step.earnedAt, zone) : 'Date not recorded'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The badge's words inside the layer: its close is the layer's own. */
function DetailInLayer({ detail, onBack }) {
  const close = useLayerClose();
  return <BadgeDetailBody detail={detail} onClose={close} onBack={onBack} backLabel="All badges" />;
}

/** All badges, as the phone's sheet: the four paths, each row opening its badge in the same sheet. */
function AllSheet({ paths, records, progress, zone, onOpen }) {
  const close = useLayerClose();
  return (
    <div className="sb-all-sheet">
      <div className="sb-all-sheet__head">
        <div>
          <h3>All badges</h3>
          <p>{earnedLine(paths)}</p>
        </div>
        <button type="button" className="sb-detail__close" onClick={close} aria-label="Close" data-first="">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <Paths paths={paths} records={records} progress={progress} zone={zone} armed onOpen={onOpen} />
    </div>
  );
}

function BadgesSection({ board, zone, armed }) {
  const { paths, records, progress } = board;
  const wide = useMedia(WIDE);
  const [overlay, setOverlay] = useState(null); // { kind: 'detail', id, anchor, from } | { kind: 'all', anchor }
  const entries = useMemo(() => countEntries(progress), [progress]);
  const shelf = useMemo(() => earnedShelf(paths), [paths]);
  const pick = useMemo(() => pickNext(paths, entries), [paths, entries]);
  const unknown = useMemo(() => paths.flatMap((p) => p.steps).filter((s) => s.status === 'unknown').length, [paths]);
  const total = paths.reduce((n, p) => n + p.total, 0);
  const openDetail = useCallback((id, anchor) => setOverlay({ kind: 'detail', id, anchor, from: 'page' }), []);
  const openAll = useCallback((event) => setOverlay({ kind: 'all', anchor: event.currentTarget }), []);
  // From a row inside the All badges sheet: the detail replaces the list in the same sheet, and "All badges" brings it back.
  const rowOpen = useCallback((id, anchor) => setOverlay((cur) => (cur?.kind === 'all' ? { kind: 'detail', id, anchor: cur.anchor, from: 'all' } : { kind: 'detail', id, anchor, from: 'page' })), []);

  const showLayer = overlay && !(overlay.kind === 'all' && wide);
  const detail = overlay?.kind === 'detail' ? detailOf(paths, overlay.id, { entries, records, zone }) : null;
  const closeThis = overlay ? () => setOverlay((cur) => (cur === overlay ? null : cur)) : null;

  return (
    <section className="rv-sec sb-sec" id="badges" aria-labelledby="sb-h">
      <div className="rv-sec__head">
        <h2 id="sb-h">{headLine(paths)}</h2>
        {wide ? null : <button type="button" className="sb-all" onClick={openAll} aria-haspopup="dialog">All badges</button>}
      </div>

      {shelf.length ? <Shelf shelf={shelf} zone={zone} onOpen={openDetail} /> : null}
      {pick ? <NextBadge pick={pick} entries={entries} armed={armed} onOpen={openDetail} /> : shelf.length === total ? <p className="sb-note">You have earned every badge.</p> : null}
      {unknown ? <p className="sb-note">{unknown === 1 ? 'One badge' : `${unknown} badges`} could not be checked just now, so {unknown === 1 ? 'it is' : 'they are'} not counted above.</p> : null}

      {wide ? <Paths paths={paths} records={records} progress={progress} zone={zone} armed={armed} onOpen={openDetail} hideEarned /> : null}

      {showLayer ? (
        <BadgeLayer
          key={wide ? `${overlay.kind}:${overlay.id}` : 'sheet'}
          anchor={overlay.anchor}
          wide={wide}
          tall={overlay.kind === 'all'}
          viewKey={`${overlay.kind}:${overlay.id || ''}`}
          label={overlay.kind === 'all' ? 'All badges' : detail?.name || 'Badge'}
          onClose={closeThis}
        >
          {overlay.kind === 'all' ? (
            <AllSheet paths={paths} records={records} progress={progress} zone={zone} onOpen={rowOpen} />
          ) : detail ? (
            <DetailInLayer detail={detail} onBack={overlay.from === 'all' ? () => setOverlay({ kind: 'all', anchor: overlay.anchor }) : null} />
          ) : null}
        </BadgeLayer>
      ) : null}
    </section>
  );
}

function Bests({ rows, lines, fastest, scored, zone, armed }) {
  if (!rows.length) {
    return (
      <section className="rv-sec sb-sec" id="bests" aria-labelledby="sb-bests-h">
        <div className="rv-sec__head"><h2 id="sb-bests-h">Personal bests</h2></div>
        <p className="sb-empty">Your bests show after your first scored set. <Link className="sb-link" href="/dashboard">Choose practice</Link></p>
      </section>
    );
  }
  return (
    <section className="rv-sec sb-sec" id="bests" aria-labelledby="sb-bests-h">
      <div className="rv-sec__head"><h2 id="sb-bests-h">Personal bests</h2></div>
      <ul className="sb-bests">
        {rows.map((r) => (
          <li key={r.key} className="sb-best">
            <b className="sb-best__value">{r.value}</b>
            <div className="sb-best__text">
              <span className="sb-best__label">{r.label}</span>
              <span className="sb-best__note">{r.note}{r.href ? <> <Link className="sb-link sb-link--tap" href={r.href}>Open that paper</Link></> : null}</span>
            </div>
          </li>
        ))}
      </ul>
      {fastest ? <p className="sb-foot">Answers under 3 seconds are not counted in your fastest right answer.</p>
        : scored > 0 ? <p className="sb-foot">Fastest right answer: no timed answers yet. Timings are kept from your next paper.</p> : null}
      {lines.length ? (
        <div className="sb-types">
          <h3 className="sb-types__title">By mock type</h3>
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
    </section>
  );
}

/**
 * Badges and Personal bests. `rhythm` is the week the page already read (RhythmCard hands it up); `rhythmFailed`
 * says that read failed, so the badges do not wait for it (the server's list needs only the time zone).
 */
export default function StudyBadges({ rhythm = null, rhythmFailed = false }) {
  const [state, setState] = useState({ status: 'loading', record: null, badges: null });
  const [attempt, setAttempt] = useState(0);
  const { reduced } = useMobiPrefs();
  const [ref, inView] = useInView({ threshold: 0.15 });
  const armed = inView || reduced;

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

  const retry = () => { setState({ status: 'loading', record: null, badges: null }); setAttempt((n) => n + 1); };
  const zone = rhythm?.timeZone || DEFAULT_ZONE;
  const { record, badges } = state;
  const waiting = !rhythm && !rhythmFailed;
  const view = useMemo(() => {
    if (state.status !== 'ready' || waiting) return null;
    let board = null;
    if (badges) board = { paths: badges.paths, progress: badges.progress, records: badges.records };
    else if (record && rhythm) board = { paths: badgePaths(mergeDerived(rhythm.milestones, record.derived), rhythm), progress: countEntries(milestoneProgress(record.counts, rhythm)), records: record.records || {} };
    return {
      board,
      bests: record ? {
        rows: bestsRows({ bests: record.bests, fastest: record.fastest, rhythm, timeZone: zone, bestRunEndedWeek: badges?.bestRunEndedWeek }),
        lines: formatLines(record.bests, zone),
      } : null,
    };
  }, [state.status, waiting, record, badges, rhythm, zone]);

  // Arriving at #badges or #bests (the result's "See your badges", the Account glance): the sections appear after their
  // reads, so the page goes to the one asked for once they are there, and only the first time.
  const went = useRef(false);
  const ready = !!view;
  useEffect(() => {
    if (!ready || went.current) return;
    went.current = true;
    const id = window.location.hash.replace('#', '');
    if (id === 'badges' || id === 'bests') document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [ready]);

  if (state.status === 'error') {
    return (
      <section className="rv-sec sb-sec" id="badges" aria-labelledby="sb-h">
        <div className="rv-sec__head"><h2 id="sb-h">Badges</h2></div>
        <p className="sb-empty" role="alert">Your badges and best marks could not be loaded just now.</p>
        <button type="button" className="sb-retry" onClick={retry}>Try again</button>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="rv-sec sb-sec" id="badges" aria-busy="true" aria-label="Badges and personal bests">
        <span className="rc__skeleton sb-skel" aria-hidden="true" />
      </section>
    );
  }
  return (
    <div ref={ref} className="sb-wrap">
      {view.board
        ? <BadgesSection board={view.board} zone={zone} armed={armed} />
        : <Unavailable title="Badges" onRetry={retry} />}
      {view.bests
        ? <Bests rows={view.bests.rows} lines={view.bests.lines} fastest={record.fastest} scored={record.scoredAttempts} zone={zone} armed={armed} />
        : <Unavailable title="Personal bests" onRetry={retry} />}
    </div>
  );
}

function Unavailable({ title, onRetry }) {
  return (
    <section className="rv-sec sb-sec">
      <div className="rv-sec__head"><h2>{title}</h2></div>
      <p className="sb-empty">This could not be loaded just now.</p>
      <button type="button" className="sb-retry" onClick={onRetry}>Try again</button>
    </section>
  );
}
