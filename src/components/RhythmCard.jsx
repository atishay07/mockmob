"use client";

// Your weekly study rhythm, from the real record (/api/me/rhythm) and nothing else.
// Full form (Progress, 19 Nov 2026): this week as the streak's seven bubbles beside the streak's Mobi and the goal, with the
// next step; the finished weeks are FinishedWeeks (one row of week marks) in the page's left column. The badges and the personal
// bests are their own section of Progress now (StudyBadges, BADGES-REFINE-1018); the week read is handed up to the
// page through `onLoad`, so the page reads it once.
// Compact form (Today): the ring, the seven days and one line.
// Nothing shows, and Mobi does not react, until the server has answered. A day is "counted" only
// when the server listed it; a week is "met" only when the server said so.
// Mobi is the app's week Mobi (lib/mobiMoments.js weekMobi, the same rules as the app's
// rhythm/logic/week_mobi.dart): paused rests, a met week gets proud once, late at night he is
// asleep (a tap wakes him), a welcome-back is a hello once a day, a week that can no longer reach
// the goal gets encouragement, and an on-track week gets nobody. The compact card (Today) has no
// Mobi: that screen already has one.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { useCountUp } from '@/lib/motion/useCountUp';
import { recallNumber } from '@/lib/motion/numberMemory';
import { useInView } from '@/lib/motion/useInView';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { weekMobi } from '@/lib/mobiMoments';
import { helloToday, speakOnce } from '@/lib/mobiRation';
import { buildRibbon, buildWeek, dayKeyNow, shortDate, weekStatus } from '@/lib/rhythmView';
import { Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { DayMark, StreakMobi } from '@/components/streak/Streak';
import { openStreakSheet, useStreak } from '@/components/streak/useStreak';
import StreakLine from '@/components/streak/StreakLine';
import { MadeLines } from '@/components/streak/StreakUseful';
import { streakDays, todayProgress } from '@/lib/streak/streakCopy.mjs';
import { finishedWeeks, weekGoal, weekMarks } from '@/components/recovery/progressWeek.mjs';

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

// The ring's count shares one number memory between Today and Progress (MOTION.md 1.1): the first view ever climbs
// from 0 on the countUp token (420 ms); after that it rolls from the figure last shown, and an unchanged week does not
// roll. It starts once the ring is in view; until then it holds the remembered figure (or 0), so nothing jumps.
const RING_KEY = 'rc-week-days';
function RingCount({ value }) {
  return useCountUp(value, { from: 0, memoryKey: RING_KEY });
}

function WeekRing({ rhythm, armed, size }) {
  const goal = rhythm.daysGoal;
  const paths = useMemo(() => arcs(goal), [goal]);
  const held = recallNumber(RING_KEY);
  const shown = armed ? <RingCount value={rhythm.studyDays} /> : (Number.isFinite(Number(held)) ? held : 0);
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
        {/* The compact Today ring (about 80px) has no room for "study days" inside the stroke. */}
        <small>{size >= 110 ? `of ${goal} study days` : `of ${goal} days`}</small>
      </span>
    </div>
  );
}

// What a day says about itself. Today always says so, counted or not ("Today, Thu 15, counted").
const dayWords = (d) => (d.isToday && !d.chip.startsWith('Today') ? `Today, ${d.chip}` : d.chip);

// `fresh`: a study day was counted since this device last saw the week. Today's dot, now done, takes one more breath
// (data-breathe, drawn by student-pages.css) once it is on screen: the change answers the session that earned it.
function DayBubbles({ week, armed, picked, onPick, fresh = false }) {
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
            data-breathe={armed && fresh && d.isToday && d.state === 'counted' ? 'true' : undefined}
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

// The finished weeks (19 Nov 2026, lane arena-a): one row of week marks, newest right, replacing the grey bars. Each mark is a
// shape and a word, never colour alone: met is a tick, paused a bar, not met the days it had. Tapping, hovering or focusing a
// week says it in words under the row, as before. This week is not here: it is the bubbles at the top of the page.
export function FinishedWeeks({ rhythm }) {
  const ribbon = useMemo(() => (rhythm ? buildRibbon(rhythm) : []), [rhythm]);
  const { title, marks } = useMemo(() => finishedWeeks(ribbon), [ribbon]);
  const [picked, setPicked] = useState(null);
  const pick = useCallback((i) => setPicked(i), []);
  // Newest right: a row longer than the screen opens at its newest end (a phone with many finished weeks).
  const rowRef = useRef(null);
  useEffect(() => { const el = rowRef.current; if (el) el.scrollLeft = el.scrollWidth; }, [marks.length]);
  // While the week loads, the block holds its place (its heading, its row of marks and the rule under it), so the record
  // below does not jump when the weeks arrive (19 Nov review: the weeks left the band's own skeleton).
  if (!rhythm) {
    return (
      <section className="rc rc--more pw-weeks pw-weeks--wait" aria-label="Your finished weeks" aria-busy="true">
        <div className="rc-block" aria-hidden="true">
          <span className="rc__skeleton pw-weeks__sk-h" />
          <span className="rc__skeleton pw-weeks__sk-row" />
        </div>
        <StudyDayRule />
      </section>
    );
  }
  const streak = rhythm.weeksMetStreak;
  const shown = picked != null ? marks[picked] : null;
  return (
    <section className="rc rc--more pw-weeks" aria-labelledby="pw-weeks-h">
      <div className="rc-block">
        <h2 className="rc-h" id="pw-weeks-h">{title}</h2>
        {streak > 0 ? <p className="rc__streak"><b>{streak}</b> {streak === 1 ? 'week' : 'weeks'} met in a row{rhythm.bestRun > streak ? <>, best run {rhythm.bestRun}</> : null}</p> : null}
        {marks.length ? (
          <>
            <ol ref={rowRef} className="pw-marks" aria-label="Finished weeks, oldest first" style={{ '--pw-n': marks.length }}>
              {marks.map((w, i) => (
                <li key={w.key}>
                  <button
                    type="button"
                    className="pw-mark"
                    data-kind={w.kind}
                    data-picked={picked === i ? 'true' : undefined}
                    aria-label={w.words}
                    aria-pressed={picked === i}
                    onClick={() => pick(i)}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') pick(i); }}
                    onFocus={() => pick(i)}
                  >
                    <span className="pw-mark__shape" aria-hidden="true">
                      {w.kind === 'met' ? <Check size={18} strokeWidth={3} /> : w.kind === 'paused' ? <i className="pw-mark__bar" /> : <b>{w.days}</b>}
                    </span>
                  </button>
                  <span className="pw-mark__date" aria-hidden="true">{shortDate(w.key)}</span>
                </li>
              ))}
            </ol>
            <p className="rc-chip pw-weeks__said" role="status" aria-live="polite">{shown ? shown.words : 'A tick is a week at your goal. Tap a week for its days.'}</p>
          </>
        ) : <p className="rc-chip">Finished weeks line up here, one mark a week.</p>}
      </div>
      <StudyDayRule />
    </section>
  );
}

function StudyDayRule() {
  return <p className="rc__foot">A study day is a day with a scored session of at least 5 answers or a finished Mistake Repair. <Link href="/profile#goal" className="rc__foot-link">Change your study days</Link> in Account or in the app.</p>;
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
// `onError`: the page shows the failure itself (Progress's one page-level error), so the card reports it and steps aside.
// `onLoad`: the page wants the week the card read (Progress gives it to the badges, which need the time zone and the goal).
export default function RhythmCard({ compact = false, mobi = !compact, between = null, quietMet = false, onError = null, onLoad = null }) {
  const { reduced } = useMobiPrefs();
  // Mobi's wake line belongs to the compact card's sleeping Mobi; the full form says Mobi's line as words.
  const [wakeLine] = useState('');
  const [state, setState] = useState({ status: 'loading', rhythm: null, cheered: true, pick: null, fresh: false });
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.25 });
  // Progress's week band reads the streak too: its rest-pass and pause days mark the bubbles (the same one read as the top bar).
  const { user } = useAuth();
  const { data: streakBody } = useStreak(compact ? null : user?.id);

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
        setState({ status: 'ready', rhythm, cheered, pick: mobi ? pickMobi(rhythm, { cheered, hello, counted, hour: new Date().getHours() }) : null, fresh: counted });
      })
      .catch(() => { if (alive) setState({ status: 'error', rhythm: null, cheered: true, pick: null }); });
    return () => { alive = false; };
  }, [attempt, mobi]);

  const failed = state.status === 'error';
  useEffect(() => { if (failed && onError) onError(); }, [failed, onError]);
  const loaded = state.status === 'ready' ? state.rhythm : null;
  useEffect(() => { if (loaded && onLoad) onLoad(loaded); }, [loaded, onLoad]);

  const rhythm = state.rhythm;

  const today = useMemo(() => (rhythm ? dayKeyNow(rhythm.timeZone) : null), [rhythm]);
  const week = useMemo(() => (rhythm ? buildWeek(rhythm, today) : []), [rhythm, today]);

  if (state.status === 'error') {
    if (compact || onError) return null;
    return (
      <>
        <section className="rc rc--note" aria-label="Your study days">
          <p role="alert">Your study days could not be loaded. Your saved sessions are still in Your papers.</p>
          <button type="button" className="pr-link" onClick={() => { setState({ status: 'loading', rhythm: null, cheered: true, pick: null }); setAttempt((n) => n + 1); }}>Try again</button>
        </section>
        {between}
      </>
    );
  }
  if (state.status !== 'ready' || !rhythm) {
    // The full card holds its resting height while the week loads (student-pages.css .rc--wait), so the next step under it
    // does not jump when the week arrives (a 0.198 layout shift on a phone, release 6 verification). The skeleton is the
    // card's own anatomy: the head (Mobi, title, status), then the weeks.
    const wait = (
      <section className={`rc${compact ? ' rc--compact' : ''} rc--wait`} aria-label="Your study days" aria-busy="true">
        {compact ? <span className="rc__skeleton" aria-hidden="true" /> : <><span className="rc__skeleton rc__skeleton--head" aria-hidden="true" /><span className="rc__skeleton rc__skeleton--weeks" aria-hidden="true" /></>}
      </section>
    );
    if (compact) return wait;
    // Progress: the band's own anatomy while the week loads (the streak, seven bubbles, the line), the next step beside it.
    return (
      <section className="pw pw--wait" aria-label="Your study days" aria-busy="true">
        <span className="pw__h">Your study days</span>
        <span className="pw-stk pw-stk--wait" aria-hidden="true"><span className="pw-stk__mk" /><span className="pw-stk__sk" /></span>
        <div className="pw__week" aria-hidden="true">
          <span className="rc__skeleton pw__sk-goal" />
          <span className="pw__days">{Array.from({ length: 7 }, (_, i) => <span key={i} className="pw__day"><DayMark look="none" /><span className="pw__name">&nbsp;</span></span>)}</span>
          <span className="rc__skeleton pw__sk-line" />
        </div>
        {between ? <div className="pw__next">{between}</div> : null}
      </section>
    );
  }

  const armed = inView || reduced;
  const todayIndex = week.findIndex((d) => d.isToday);
  const shownIndex = picked != null ? picked : todayIndex;
  const met = rhythm.metThisWeek;
  const pick = state.pick;
  // A returning week: Mobi's hello and the card's own sentence become one line, so "Welcome back" is said once.
  const hello = pick?.kind === 'hello' && pick.line;
  const status = hello ? `${pick.line} One counted study day starts your week.` : quietMet && met ? '' : !compact && rhythm.studyDays > 0 && !met && !rhythm.paused ? `${rhythm.studyDays} of ${rhythm.daysGoal} study days this week. ${weekStatus(rhythm)}` : weekStatus(rhythm);

  if (compact) {
    return (
      <section ref={ref} className="rc rc--compact" aria-label="Your study days" data-met={met ? 'true' : 'false'}>
        <header className="rc__head">
          <div>
            <h2 className="rc__title">This week</h2>
            {status ? <p className="rc__status" role={hello ? 'status' : undefined}>{status}</p> : null}
            {pick?.kind === 'sleep' ? (wakeLine ? <p className="rc__status" role="status">{wakeLine}</p> : null) : pick?.line && !hello ? <p className="rc__status" role="status">{pick.line}</p> : null}
          </div>
        </header>
        <div className="rc__top">
          <WeekRing rhythm={rhythm} armed={armed} size={92} />
          <div className="rc__week">
            <DayBubbles week={week} armed={armed} picked={picked} onPick={setPicked} fresh={state.fresh} />
            <DayCaption week={week} index={shownIndex} />
          </div>
        </div>
        <Link className="rc__more" href="/progress">See your weeks and milestones</Link>
      </section>
    );
  }
  // Progress (19 Nov 2026, lane arena-a): the week you are in, first. The streak's Mobi and number at its left (they open the
  // streak sheet, as everywhere), this week's seven days as the streak's own bubbles, the goal in one line, and the next step
  // (the page's one volt key) beside them on a wide screen, under them on a phone. Mobi's line for the week stays as words.
  const goal = weekGoal(rhythm);
  const said = hello ? `${pick.line} One counted study day starts your week.` : weekStatus(rhythm);
  const mobiLine = pick?.kind === 'sleep' ? '' : pick?.line && !hello ? pick.line : '';
  return (
    <section ref={ref} className="pw" aria-labelledby="pw-h" data-met={met ? 'true' : 'false'}>
      <h2 className="pw__h" id="pw-h">Your study days</h2>
      <WeekStreak />
      <div className="pw__week">
        <p className="pw__goal"><b>{goal.figure}</b><span>{goal.words}</span></p>
        <ol className="pw__days" aria-label="This week, day by day">
          {weekMarks(week, streakBody).map((d, i) => (
            <li key={d.key} className="pw__day" data-ahead={d.ahead || undefined} data-today={d.today || undefined} style={{ '--i': i }}>
              <DayMark look={d.look} />
              <span className="pw__name" aria-hidden="true">{d.name}</span>
              <span className="sr-only">{d.said}</span>
            </li>
          ))}
        </ol>
        <p className="pw__said" role={hello || mobiLine ? 'status' : undefined}>{said}{mobiLine ? ` ${mobiLine}` : ''}</p>
      </div>
      {between ? <div className="pw__next">{between}</div> : null}
    </section>
  );
}

/**
 * The streak, as the band's first row (19 Nov 2026, one unbroken line to exam day): its Mobi and number (they open the streak
 * sheet), then the line of the last 14 days (7 when the row is narrower than 14 day cells; measured from the row itself, never
 * the window) and what the line has made. The weekly goal under it keeps its own ticked bubbles: a different count.
 */
const LONG_LINE_MIN = 14 * 40;
function WeekStreak() {
  const { user } = useAuth();
  const { status, data: body, reload } = useStreak(user?.id);
  const lineRef = useRef(null);
  const [long, setLong] = useState(false);
  const loaded = Boolean(body);
  useEffect(() => {
    const el = lineRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => { const w = entries[0]?.contentRect?.width || 0; setLong(w >= LONG_LINE_MIN); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);
  // A failed read says so in one short row with Try again (never a guessed number, never a skeleton left standing).
  if (!body && status === 'error') return <p className="pw-stk pw-stk--failed" role="status">Your streak did not load. <button type="button" className="stk-inline" onClick={reload}>Try again</button></p>;
  if (!body) return <span className="pw-stk pw-stk--wait" aria-hidden="true"><span className="pw-stk__mk" /><span className="pw-stk__sk" /></span>;
  const lit = Boolean(body.today?.done);
  const days = streakDays(body, long ? 14 : 7);
  return (
    <div className="pw-stk">
      <button type="button" className="pw__streak" onClick={() => openStreakSheet()} aria-label={body.days > 0 ? `${body.days} ${body.days === 1 ? 'day' : 'days'} in a row. Open your streak` : 'Your streak starts with one day. Open your streak'}>
        <StreakMobi lit={lit} size={56} className="pw__mobi" />
        {body.days > 0 ? (
          <span className="pw__count" aria-hidden="true"><b>{body.days}</b><span>{body.days === 1 ? 'day in a row' : 'days in a row'}</span></span>
        ) : <span className="pw__count pw__count--zero" aria-hidden="true"><span>Your streak starts with one day</span></span>}
      </button>
      <div className="pw-stk__body" ref={lineRef}>
        <StreakLine days={days} progress={todayProgress(body)} names={long ? 'initial' : 'short'} size="lg" label={`Your last ${days.length} days`} />
        <MadeLines body={body} userId={user?.id} />
      </div>
    </div>
  );
}
