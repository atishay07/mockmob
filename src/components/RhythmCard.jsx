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
import { buildPaths, buildRibbon, buildWeek, dayKeyNow, weekStatus } from '@/lib/rhythmView';

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

function DayBubbles({ week, armed, picked, onPick }) {
  return (
    <ul className="rc-days" aria-label="This week, day by day">
      {week.map((d, i) => (
        <li key={d.key}>
          <button
            type="button"
            className="rc-day"
            data-state={d.state}
            data-picked={picked === i ? 'true' : 'false'}
            data-armed={armed ? 'true' : 'false'}
            style={{ '--rc-i': i }}
            aria-label={d.chip}
            onClick={() => onPick(i)}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') onPick(i); }}
            onFocus={() => onPick(i)}
          >
            <span className="rc-day__dot" aria-hidden="true">
              {d.state === 'counted' ? (
                <svg viewBox="0 0 24 24" focusable="false"><path d="M6 12.5l4 4 8-9" pathLength="1" /></svg>
              ) : null}
            </span>
            <span className="rc-day__name" aria-hidden="true">{d.name[0]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Ribbon({ ribbon, armed }) {
  const [picked, setPicked] = useState(null);
  const shown = picked != null ? ribbon[picked] : null;
  const pick = useCallback((i) => setPicked(i), []);
  return (
    <div className="rc-block">
      <h3 className="rc-h">The last 12 weeks</h3>
      <ol className="rc-ribbon" aria-label="Weeks, oldest first">
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
          </li>
        ))}
      </ol>
      <p className="rc-chip" role="status" aria-live="polite">{shown ? shown.words : 'Volt weeks met the goal. Tap a week to read it.'}</p>
    </div>
  );
}

function Paths({ paths, armed }) {
  return (
    <div className="rc-block">
      <h3 className="rc-h">Three paths</h3>
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

export default function RhythmCard({ compact = false, mobi = !compact }) {
  const { reduced } = useMobiPrefs();
  const [wakeLine, setWakeLine] = useState('');
  const [state, setState] = useState({ status: 'loading', rhythm: null, cheered: true, pick: null });
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.25 });

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
      <section className="rc rc--note" aria-label="Your weekly rhythm">
        <p role="alert">Your weekly rhythm could not be loaded. Your saved sessions are still in Review.</p>
        <button type="button" className="pr-link" onClick={() => { setState({ status: 'loading', rhythm: null, cheered: true, pick: null }); setAttempt((n) => n + 1); }}>Try again</button>
      </section>
    );
  }
  if (state.status !== 'ready' || !rhythm) {
    return <section className={`rc${compact ? ' rc--compact' : ''} rc--wait`} aria-label="Your weekly rhythm" aria-busy="true"><span className="rc__skeleton" aria-hidden="true" /></section>;
  }

  const armed = inView || reduced;
  const todayIndex = week.findIndex((d) => d.isToday);
  const shownIndex = picked != null ? picked : todayIndex;
  const chip = shownIndex >= 0 ? week[shownIndex].chip : '';
  const met = rhythm.metThisWeek;
  const pick = state.pick;
  const status = weekStatus(rhythm);
  const streak = rhythm.weeksMetStreak;

  return (
    <section ref={ref} className={`rc${compact ? ' rc--compact' : ''}`} aria-label="Your weekly rhythm" data-met={met ? 'true' : 'false'}>
      <header className="rc__head">
        <div>
          <h2 className="rc__title">{compact ? 'This week' : 'Your weekly rhythm'}</h2>
          <p className="rc__status">{status}</p>
          {pick?.kind === 'sleep' ? (wakeLine ? <p className="rc__status" role="status">{wakeLine}</p> : null) : pick?.line ? <p className="rc__status" role="status">{pick.line}</p> : null}
        </div>
        {pick ? <MobiReact act={pick.act} size={compact ? 56 : 76} mood={pick.mood} interactive={!compact} label={pick.kind === 'sleep' ? 'Mobi, asleep. Tap to wake him.' : undefined} onTap={(a) => { if (a === 'wake') setWakeLine(pick.wakeLine); }} onDone={pick.kind === 'proud' && !cheered ? markCheered : undefined} /> : null}
      </header>

      <div className="rc__top">
        <WeekRing rhythm={rhythm} armed={armed} size={compact ? 92 : 132} />
        <div className="rc__week">
          <DayBubbles week={week} armed={armed} picked={picked} onPick={setPicked} />
          <p className="rc-chip" role="status" aria-live="polite">{chip}</p>
          {!compact && streak > 0 ? <p className="rc__streak"><b>{streak}</b> {streak === 1 ? 'week' : 'weeks'} met in a row{rhythm.bestRun > streak ? <> · best run {rhythm.bestRun}</> : null}</p> : null}
        </div>
      </div>

      {compact ? (
        <Link className="rc__more" href="/progress">See your weeks and milestones</Link>
      ) : (
        <>
          <Ribbon ribbon={ribbon} armed={armed} />
          <Paths paths={paths} armed={armed} />
          <p className="rc__foot">A study day is a day with a scored session of at least 5 answers or a finished Mistake Repair. Change your days in the app.</p>
        </>
      )}
    </section>
  );
}
