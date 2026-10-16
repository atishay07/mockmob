"use client";

// Your weekly study rhythm, from the real record (/api/me/rhythm) and nothing else.
// Full form (Progress): a week ring with one arc per goal day, seven day bubbles, a 12-week
// ribbon, and three milestone paths with the exact condition for the next step.
// Compact form (Today): the ring, the seven days and one line.
// Nothing shows, and Mobi does not react, until the server has answered. A day is "counted" only
// when the server listed it; a week is "met" only when the server said so.
// Mobi is the app's week Mobi (lib/mobiMoments.js weekMobi, the same rules as the app's
// rhythm/logic/week_mobi.dart): paused rests, a met week gets proud once, late at night he is
// asleep (a tap wakes him), a welcome-back is a hello once a day, a week that can no longer reach
// the goal gets encouragement, and an on-track week gets nobody. The compact card (Today) has no
// Mobi: that screen already has one.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import MobiReact from '@/components/brand/MobiReact';
import { useCountUp } from '@/lib/motion/useCountUp';
import { useInView } from '@/lib/motion/useInView';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { weekMobi } from '@/lib/mobiMoments';
import { helloToday, speakOnce } from '@/lib/mobiRation';
import { buildPaths, buildRibbon, buildWeek, dayKeyNow, shortDate, weekStatus } from '@/lib/rhythmView';

const R = 46;
const C = 60;
const polar = (deg) => [C + R * Math.cos((deg * Math.PI) / 180), C + R * Math.sin((deg * Math.PI) / 180)];
const r2 = (n) => Math.round(n * 100) / 100;

/** One arc per goal day, round the ring from the top. */
function arcs(goal) {
  const n = Math.min(7, Math.max(1, goal || 1));
  const gap = n > 1 ? 14 : 0;
  const span = n === 1 ? 359.9 : (360 - gap * n) / n;
  return Array.from({ length: n }, (_, i) => {
    const a0 = -90 + gap / 2 + i * (span + gap);
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a0 + span);
    return `M${r2(x0)} ${r2(y0)}A${R} ${R} 0 ${span > 180 ? 1 : 0} 1 ${r2(x1)} ${r2(y1)}`;
  });
}

function WeekRing({ rhythm, armed, size }) {
  const goal = rhythm.daysGoal;
  const paths = useMemo(() => arcs(goal), [goal]);
  const shown = useCountUp(armed ? rhythm.studyDays : 0, { duration: 900 });
  return (
    <div className="rc-ring" style={{ '--rc-size': `${size}px` }} role="img" aria-label={`${rhythm.studyDays} of ${goal} study days this week`}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        {paths.map((d, i) => <path key={`t${i}`} d={d} className="rc-ring__track" />)}
        {paths.map((d, i) => (
          <path
            key={`f${i}`}
            d={d}
            pathLength="1"
            className="rc-ring__fill"
            data-on={i < rhythm.studyDays ? 'true' : 'false'}
            data-met={rhythm.metThisWeek ? 'true' : 'false'}
            data-armed={armed ? 'true' : 'false'}
            style={{ '--rc-i': i }}
          />
        ))}
      </svg>
      <span className="rc-ring__count" aria-hidden="true">
        <b>{shown}</b>
        <small>of {goal} days</small>
      </span>
    </div>
  );
}

// What a day says about itself. Today always says so, counted or not ("Today, Thu 15, counted").
const dayWords = (d) => (d.isToday && !d.chip.startsWith('Today') ? `Today, ${d.chip}` : d.chip);

function DayBubbles({ week, armed, picked, onPick }) {
  return (
    <ul className="rc-days" aria-label="This week, day by day">
      {week.map((d, i) => (
        <li key={d.key}>
          <button
            type="button"
            className="rc-day"
            data-state={d.state}
            data-today={d.isToday ? 'true' : undefined}
            data-picked={picked === i ? 'true' : 'false'}
            data-armed={armed ? 'true' : 'false'}
            style={{ '--rc-i': i }}
            aria-label={dayWords(d)}
            aria-current={d.isToday ? 'date' : undefined}
            onClick={() => onPick(i)}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') onPick(i); }}
            onFocus={() => onPick(i)}
          >
            <span className="rc-day__dot" aria-hidden="true">
              {d.state === 'counted' ? (
                <svg viewBox="0 0 24 24" focusable="false"><path d="M6 12.5l4 4 8-9" pathLength="1" /></svg>
              ) : null}
            </span>
            <span className="rc-day__name" aria-hidden="true">{d.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The caption sits under the day it describes, on the same seven columns as the dots: centred under a
 * middle day, held to the strip's edge under the first two and the last two so it never leaves the card.
 * It re-enters (a short settle) each time the day changes, so the eye follows it to the new day.
 */
function DayCaption({ week, index }) {
  const d = index >= 0 ? week[index] : null;
  let column = '1 / 8';
  let align = 'start';
  if (d) {
    if (index <= 1) column = `${index + 1} / 8`;
    else if (index >= 5) { column = `1 / ${index + 2}`; align = 'end'; }
    else { const k = Math.min(index, 6 - index); column = `${index + 1 - k} / ${index + 2 + k}`; align = 'center'; }
  }
  return (
    <div className="rc-caption" role="status" aria-live="polite">
      {d ? <p key={index} className="rc-chip" data-align={align} data-today={d.isToday ? 'true' : undefined} style={{ gridColumn: column }}>{dayWords(d)}</p> : null}
    </div>
  );
}

// Each week is a labelled column (its start date, or "This week"), so the row reads without a tap.
// The heading carries the count over its denominator: finished weeks only, the open week is still running.
function Ribbon({ ribbon, armed }) {
  const [picked, setPicked] = useState(null);
  const shown = picked != null ? ribbon[picked] : null;
  const pick = useCallback((i) => setPicked(i), []);
  const closed = ribbon.filter((w) => !w.current);
  const metClosed = closed.filter((w) => w.met).length;
  const title = closed.length === 0 ? 'Your first week'
    : `Goal met in ${metClosed} of ${ribbon.length >= 12 ? `the last ${closed.length}` : `your ${closed.length}`} finished week${closed.length === 1 ? '' : 's'}`;
  return (
    <div className="rc-block">
      <h3 className="rc-h">{title}</h3>
      <ol className="rc-ribbon" aria-label="Weeks, oldest first" data-many={ribbon.length > 8 ? 'true' : undefined} data-few={ribbon.length < 4 ? 'true' : undefined} style={{ '--rc-weeks': ribbon.length }}>
        {ribbon.map((w, i) => (
          <li key={w.key}>
            <button
              type="button"
              className="rc-wk"
              data-met={w.met ? 'true' : 'false'}
              data-paused={w.paused ? 'true' : 'false'}
              data-current={w.current ? 'true' : 'false'}
              data-armed={armed ? 'true' : 'false'}
              data-picked={picked === i ? 'true' : 'false'}
              style={{ '--rc-i': i, '--rc-fill': w.fill }}
              aria-label={w.words}
              onClick={() => pick(i)}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') pick(i); }}
              onFocus={() => pick(i)}
            >
              <span className="rc-wk__fill" aria-hidden="true" />
            </button>
            <span className="rc-wk__label" aria-hidden="true" data-current={w.current ? 'true' : 'false'}>{w.current ? 'This week' : shortDate(w.key)}</span>
          </li>
        ))}
      </ol>
      <p className="rc-chip" role="status" aria-live="polite">{shown ? shown.words : 'A full bar means the goal was met. Tap a week for its days.'}</p>
    </div>
  );
}

function Paths({ paths, armed }) {
  const done = paths.reduce((n, p) => n + p.doneCount, 0);
  const all = paths.reduce((n, p) => n + p.steps.length, 0);
  return (
    <div className="rc-block">
      <h3 className="rc-h">Milestones: {done} of {all} steps done</h3>
      <div className="rc-paths">
        {paths.map((p) => (
          <section key={p.id} className="rc-path" aria-label={`${p.title} path`}>
            <header><b>{p.title}</b><span>{p.doneCount} of {p.steps.length}</span></header>
            <ol className="rc-steps" style={{ '--rc-n': p.steps.length }}>
              {p.steps.map((s, i) => (
                <li key={s.id} data-done={s.done ? 'true' : 'false'} data-next={p.next?.id === s.id ? 'true' : 'false'} data-armed={armed ? 'true' : 'false'} style={{ '--rc-i': i }}>
                  <span className="rc-step__dot" aria-hidden="true">
                    {s.done ? <svg viewBox="0 0 24 24" focusable="false"><path d="M6 12.5l4 4 8-9" pathLength="1" /></svg> : null}
                  </span>
                  <span className="rc-step__label">{s.short}<span className="sr-only">{s.done ? ', done' : p.next?.id === s.id ? ', next' : ', later'}</span></span>
                </li>
              ))}
            </ol>
            <p className="rc-next">{p.next ? <><span>Next</span> {p.next.condition}</> : 'Every step on this path is done.'}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Which Mobi, what he does and what he says, once, when the week arrives from the server. The gates
 * (hello once a day, a line once a run) are asked here, in the fetch callback, never in render.
 */
function pickMobi(rhythm, { cheered, hello, counted, hour }) {
  const today = dayKeyNow(rhythm.timeZone);
  const week = buildWeek(rhythm, today);
  const todayIndex = week.findIndex((d) => d.isToday);
  const met = rhythm.metThisWeek;
  // Days from today to Sunday that are not counted yet. The plan's chosen study days are not in this
  // response, so "one short and today is planned" (the app's nudge) cannot be said truthfully: no nudge.
  const daysLeft = todayIndex >= 0 ? week.filter((d, i) => i >= todayIndex && d.state !== 'counted').length : null;
  const found = weekMobi(
    { status: rhythm.paused ? 'paused' : met ? 'met' : 'open', studyDays: rhythm.studyDays, goal: rhythm.daysGoal, daysLeft, todayPlanned: false },
    { hour, returning: hello },
  );
  if (!found && !counted) return null;
  if (!found) return { kind: 'counted', act: 'correct', mood: 'happy', line: '', wakeLine: '' };
  // A met week is proud once; after that he just stands there, proud in his posture.
  const act = found.kind === 'proud' && cheered ? 'idle' : found.act;
  const mood = found.kind === 'proud' ? 'proud' : found.kind === 'sleep' ? 'sleepy' : 'calm';
  const line = found.line && (found.lineIsState || speakOnce(`rhythm:${found.kind}`)) ? found.line : '';
  return { kind: found.kind, act, mood, line, wakeLine: found.wakeLine || '' };
}

// Full form takes `between`: what the page puts after this week (Progress puts the next step there, so the
// action that earns the next study day sits right under the count), before the weeks and the paths.
// `quietMet` (Today): the page's companion is saying the met week right now, so the card leaves out its own
// "Week met" sentence; the ring and the day dots already show it.
export default function RhythmCard({ compact = false, mobi = !compact, between = null, quietMet = false }) {
  const { reduced } = useMobiPrefs();
  const [wakeLine, setWakeLine] = useState('');
  const [state, setState] = useState({ status: 'loading', rhythm: null, cheered: true, pick: null });
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.25 });
  const [moreRef, moreInView] = useInView({ threshold: 0.15 });

  useEffect(() => {
    let alive = true;
    apiGet('/api/me/rhythm')
      .then((rhythm) => {
        if (!alive) return;
        // Has Mobi already cheered for this week on this device? Storage may be blocked: then he cheers again.
        let cheered = false;
        try { cheered = window.localStorage.getItem(`mm:rhythm-cheer:${rhythm.weekStart}`) === '1'; } catch { cheered = false; }
        // A welcome-back hello once a day. A study day counted since he last looked is a small hop.
        const hello = Boolean(mobi && rhythm.returning && rhythm.studyDays === 0 && !rhythm.metThisWeek && helloToday('rhythm'));
        let counted = false;
        try {
          const seen = window.localStorage.getItem(`mm:rhythm-days:${rhythm.weekStart}`);
          counted = seen != null && rhythm.studyDays > Number(seen);
          window.localStorage.setItem(`mm:rhythm-days:${rhythm.weekStart}`, String(rhythm.studyDays));
        } catch { counted = false; }
        setState({ status: 'ready', rhythm, cheered, pick: mobi ? pickMobi(rhythm, { cheered, hello, counted, hour: new Date().getHours() }) : null });
      })
      .catch(() => { if (alive) setState({ status: 'error', rhythm: null, cheered: true, pick: null }); });
    return () => { alive = false; };
  }, [attempt, mobi]);

  const rhythm = state.rhythm;
  const cheered = state.cheered;
  const weekKey = rhythm?.weekStart;
  const markCheered = useCallback(() => {
    setState((prev) => ({ ...prev, cheered: true }));
    try { if (weekKey) window.localStorage.setItem(`mm:rhythm-cheer:${weekKey}`, '1'); } catch { /* He just may cheer again next visit. */ }
  }, [weekKey]);

  const today = useMemo(() => (rhythm ? dayKeyNow(rhythm.timeZone) : null), [rhythm]);
  const week = useMemo(() => (rhythm ? buildWeek(rhythm, today) : []), [rhythm, today]);
  const ribbon = useMemo(() => (rhythm ? buildRibbon(rhythm) : []), [rhythm]);
  const paths = useMemo(() => (rhythm ? buildPaths(rhythm) : []), [rhythm]);

  if (state.status === 'error') {
    if (compact) return null;
    return (
      <>
        <section className="rc rc--note" aria-label="Your study days">
          <p role="alert">Your study days could not be loaded. Your saved sessions are still in Review.</p>
          <button type="button" className="pr-link" onClick={() => { setState({ status: 'loading', rhythm: null, cheered: true, pick: null }); setAttempt((n) => n + 1); }}>Try again</button>
        </section>
        {between}
      </>
    );
  }
  if (state.status !== 'ready' || !rhythm) {
    const wait = <section className={`rc${compact ? ' rc--compact' : ''} rc--wait`} aria-label="Your study days" aria-busy="true"><span className="rc__skeleton" aria-hidden="true" /></section>;
    return compact ? wait : <>{wait}{between}</>;
  }

  const armed = inView || reduced;
  const todayIndex = week.findIndex((d) => d.isToday);
  const shownIndex = picked != null ? picked : todayIndex;
  const met = rhythm.metThisWeek;
  const pick = state.pick;
  // A returning week: Mobi's hello and the card's own sentence become one line, so "Welcome back" is said once.
  const hello = pick?.kind === 'hello' && pick.line;
  const status = hello ? `${pick.line} One counted study day starts your week.` : quietMet && met ? '' : weekStatus(rhythm);
  const streak = rhythm.weeksMetStreak;

  const card = (
    <section ref={ref} className={`rc${compact ? ' rc--compact' : ''}`} aria-label="Your study days" data-met={met ? 'true' : 'false'}>
      <header className="rc__head">
        <div>
          <h2 className="rc__title">{compact ? 'This week' : 'Your study days'}</h2>
          {status ? <p className="rc__status" role={hello ? 'status' : undefined}>{status}</p> : null}
          {pick?.kind === 'sleep' ? (wakeLine ? <p className="rc__status" role="status">{wakeLine}</p> : null) : pick?.line && !hello ? <p className="rc__status" role="status">{pick.line}</p> : null}
        </div>
        {/* Today already holds Mobi in its plan card, so its slim weekly card keeps him out: once per screen. */}
        {pick && !compact ? <MobiReact act={pick.act} size={76} mood={pick.mood} interactive label={pick.kind === 'sleep' ? 'Mobi, asleep. Tap to wake him.' : undefined} onTap={(a) => { if (a === 'wake') setWakeLine(pick.wakeLine); }} onDone={pick.kind === 'proud' && !cheered ? markCheered : undefined} /> : null}
      </header>

      <div className="rc__top">
        <WeekRing rhythm={rhythm} armed={armed} size={compact ? 92 : 132} />
        <div className="rc__week">
          <DayBubbles week={week} armed={armed} picked={picked} onPick={setPicked} />
          <DayCaption week={week} index={shownIndex} />
          {!compact && streak > 0 ? <p className="rc__streak"><b>{streak}</b> {streak === 1 ? 'week' : 'weeks'} met in a row{rhythm.bestRun > streak ? <>, best run {rhythm.bestRun}</> : null}</p> : null}
        </div>
      </div>

      {compact ? <Link className="rc__more" href="/progress">See your weeks and milestones</Link> : null}
    </section>
  );
  if (compact) return card;
  const moreArmed = moreInView || reduced;
  return (
    <>
      {card}
      {between}
      <section ref={moreRef} className="rc rc--more" aria-label="Your weeks and milestones">
        <Ribbon ribbon={ribbon} armed={moreArmed} />
        <Paths paths={paths} armed={moreArmed} />
        <p className="rc__foot">A study day is a day with a scored session of at least 5 answers or a finished Mistake Repair. <Link href="/profile#goal" className="rc__foot-link">Change your study days</Link> in Account or in the app.</p>
      </section>
    </>
  );
}
