"use client";

// Badges and Personal bests on Progress: the website's half of the app's You tab (same names, same
// rules: lib/studyBadges.js). BADGES-REFINE-1018 gave the badges a section of Progress of their own (after the
// record, no longer inside the week card). Lane "badges" (16 Nov 2026) redrew them as one family of marks pressed
// onto the desk paper (Medal.jsx, lib/badgeArt.js) and laid the collection out as the four paths in four rows:
// earned first, the next one drawn in ink with its exact count round its edge, the rest blind, each row ending
// with what its next badge needs. Above them, once something is earned, the one badge closest to done. A fresh
// account is told what the badges are, never "0 of 16". On a phone "All badges" opens every badge with its words
// as a sheet. A tap on any mark opens its detail (BadgeDetail.jsx), where an earned badge can be shared.
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
import { BadgeStamp, Medal } from '@/components/Medal';
import { BadgeDetailBody, BadgeLayer, useLayerClose } from '@/components/BadgeDetail';
import {
  badgePaths, badgePathsFromApi, bestsRows, countEntries, dayMonth, earnedLine, formatLines, fractionOf, mergeDerived,
  milestoneProgress, recordLine, soFarLine,
} from '@/lib/studyBadges';
import { DEFAULT_ZONE, countLeft, detailOf, earnedShelf, ghostLine, headLine, pickNext, shortDay } from '@/lib/badgeShelf';
import { NEEDS } from '@/lib/badgeMoment';
import './study-badges.css';

export { Medal };

const WIDE = '(min-width: 761px)';

/** A path's badges, earned first (in path order), then the one to earn next (`lead`), then the rest in path order. */
const earnedFirst = (steps, lead = null) => {
  const leadId = lead || steps.find((s) => s.status === 'next')?.id;
  return [...steps.filter((s) => s.status === 'earned'), ...steps.filter((s) => s.id === leadId && s.status !== 'earned'), ...steps.filter((s) => s.status !== 'earned' && s.id !== leadId)];
};

/** How a mark is drawn: on "Your best work" every badge not earned is "next" in the rules, but only the closest one is inked. */
const markOf = (step, path, lead) => (step.status === 'earned' ? 'earned' : step.status === 'next' && (path.id !== 'best' || step.id === lead) ? 'next' : 'later');

function BadgeRow({ step, path, record, progress, zone, armed, linkShown, onOpen, lead }) {
  const earned = step.status === 'earned';
  const unknown = step.status === 'unknown';
  const sequence = path.id !== 'best';
  const leadWord = earned || unknown ? null : step.status === 'next' && sequence ? 'Next.' : 'Not yet.';
  // A count is shown once there is one: "0 of 10 so far" is never drawn (a fresh account meets what earns it, not zeros).
  const counted = !earned && fractionOf(step.id, progress) > 0;
  const fraction = counted ? fractionOf(step.id, progress) : null;
  const so = counted ? soFarLine(step.id, progress) : null;
  const paper = earned && record ? recordLine(record, zone) : '';
  return (
    <li className="sb-badge" data-status={step.status} data-sequence={sequence ? 'true' : 'false'}>
      <BadgeStamp id={step.id} status={markOf(step, path, lead)} fraction={fraction} />
      <div className="sb-badge__body">
        {/* The whole row is the control (a stretched button on the name); the links inside stay their own. */}
        <b className="sb-badge__name"><button type="button" className="sb-badge__open" aria-haspopup="dialog" onClick={(event) => onOpen(step.id, event.currentTarget)}>{step.name}</button></b>
        {earned ? (
          <p className="sb-badge__state">{step.undated || step.earnedAt == null ? 'Earned. The date is not recorded yet.' : `Earned ${dayMonth(step.earnedAt, zone)}`}</p>
        ) : unknown ? (
          <p className="sb-badge__state">This one could not be checked just now. {step.condition}</p>
        ) : (
          <p className="sb-badge__state"><span className="sb-badge__lead">{leadWord}</span> {NEEDS[step.id] || step.condition}</p>
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
        const lead = pathLead(path, progress)?.id;
        const steps = hideEarned ? path.steps.filter((s) => s.status !== 'earned') : earnedFirst(path.steps, lead);
        return (
          <section key={path.id} className="sb-path" aria-label={`${path.title} badges`}>
            <header><b>{path.title}</b><span>{path.earned ? `${path.earned} of ${path.total}` : `${path.total} badges`}</span></header>
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
                  lead={lead}
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

/** The path's own next badge: the closest one where an exact count exists, else the first not earned (pickNext on one path). */
const pathLead = (path, entries) => pickNext([path], entries)?.step || null;

/** The line under a path's marks: what its next badge needs, with the exact count where one exists. */
function rowLine(path, entries) {
  const lead = pathLead(path, entries);
  if (!lead) return path.steps.every((s) => s.status === 'earned') ? 'Every badge on this path is earned.' : '';
  const c = countLeft(lead.id, entries);
  return `Next: ${lead.name}. ${c ? `${c.short} so far.` : NEEDS[lead.id] || lead.condition}`;
}

/** What a mark's cell says under its name (shown from tablets up): the day it was earned, the count, or what it needs. */
function cellNote(step, entries, zone, mark) {
  if (step.status === 'earned') return step.earnedAt != null && !step.undated ? shortDay(step.earnedAt, zone) : 'Earned';
  if (step.status === 'unknown') return 'Could not be checked just now';
  const c = mark === 'next' ? countLeft(step.id, entries) : null;
  return c ? `${c.so} so far` : NEEDS[step.id] || step.condition;
}

/**
 * The collection: the four paths as four rows of marks, earned first, then the next one (drawn in ink, its exact count running
 * round its edge), then the rest as blind marks. Each mark opens its own sheet. Under each row, what its next badge needs.
 */
function PathRows({ paths, entries, zone, onOpen }) {
  return (
    <div className="sb-rows">
      {paths.map((path) => {
        const lead = pathLead(path, entries)?.id;
        const line = rowLine(path, entries);
        return (
          <section key={path.id} className="sb-row" aria-labelledby={`sb-row-${path.id}`}>
            <header className="sb-row__head">
              <h3 id={`sb-row-${path.id}`}>{path.title}</h3>
              <span>{path.earned ? `${path.earned} of ${path.total}` : `${path.total} badges`}</span>
            </header>
            <ol className="sb-row__marks" style={{ '--sb-n': path.steps.length }}>
              {earnedFirst(path.steps, lead).map((step) => {
                const mark = markOf(step, path, lead);
                const note = cellNote(step, entries, zone, mark);
                return (
                  <li key={step.id} className="sb-cell" data-mark={mark}>
                    <button type="button" className="sb-cell__btn" aria-haspopup="dialog" aria-label={`${step.name}. ${mark === 'earned' ? `Earned${note && note !== 'Earned' ? ` ${note}` : ''}` : mark === 'next' ? `Next. ${note}` : `Not yet. ${note}`}`} onClick={(event) => onOpen(step.id, event.currentTarget)}>
                      <BadgeStamp id={step.id} status={mark} size="lg" fraction={mark === 'next' ? fractionOf(step.id, entries) : null} />
                      <span className="sb-cell__name" aria-hidden="true">{step.name}</span>
                      <span className="sb-cell__note" aria-hidden="true">{note}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {line ? (
              <p className="sb-row__line">
                {line}
                {lead && path.link ? <> <Link className="sb-link sb-link--tap" href={path.link.href}>{path.link.label}</Link></> : null}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/** The next badge: the one closest to done, drawn in ink with its exact count running round its own edge, and one line. */
function NextBadge({ pick, entries, onOpen }) {
  const { step, path } = pick;
  const count = countLeft(step.id, entries);
  const fraction = count && count.current > 0 ? count.fraction : null;
  return (
    <div className="sb-next">
      <button type="button" className="sb-next__btn" aria-haspopup="dialog" onClick={(event) => onOpen(step.id, event.currentTarget)}>
        <span className="sb-ghost" aria-hidden="true">
          <BadgeStamp id={step.id} status="next" size={68} fraction={fraction} />
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
          <p>{earnedLine(paths) === 'None earned yet' ? `${paths.reduce((n, p) => n + p.total, 0)} badges on four paths` : earnedLine(paths)}</p>
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
  const fresh = shelf.length === 0;
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
        {/* A fresh account is never greeted with "0 of 16": the head is the word, and the line under it says what the badges are. */}
        <h2 id="sb-h">{fresh ? 'Badges' : headLine(paths)}</h2>
        {wide ? null : <button type="button" className="sb-all" onClick={openAll} aria-haspopup="dialog">All badges</button>}
      </div>
      {fresh ? <p className="sb-lead">{total} badges on four paths, each for something you did: papers, repairs, weeks at your goal and your best work.</p> : null}

      {fresh ? null : pick ? <NextBadge pick={pick} entries={entries} onOpen={openDetail} /> : shelf.length === total ? <p className="sb-note">You have earned every badge.</p> : null}
      {unknown ? <p className="sb-note">{unknown === 1 ? 'One badge' : `${unknown} badges`} could not be checked just now, so {unknown === 1 ? 'it is' : 'they are'} not counted above.</p> : null}

      <PathRows paths={paths} entries={entries} zone={zone} onOpen={openDetail} />

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
