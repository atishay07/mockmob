"use client";
// This week on Today (TODAY-1018 section 6.3, R3's block made tappable). "3 of 4 study days", seven day buttons and one
// readout under them that swaps in place: a tapped day says what was saved that day (the papers and repairs the page
// already read) or what is planned; today says what it holds. One indicator slides between
// the days (240 ms, the N5 lesson), not seven boxes switching. The caption ties the week to tonight; its "Your weeks"
// opens Progress. Today's readout says what the day holds, never the lead again (release 10, D15); once today is counted it
// carries the week's one line itself ("Counted at 7:41 PM. 1 more study day meets your 4."). The week-goal Mobi cheer (once per week on this device, only when no other Mobi is on screen) and the
// weekly repair receipt stay from R3.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MobiReact from '@/components/brand/MobiReact';
import { weekCheerKey, weekGoalAct, mobCheerKey, mobRingAct } from '@/lib/mobiScreens';
import { clockIn, dayReadout, weekCaption, weekDays, weekMarks, todayKeyIn, weekReceipt } from '@/lib/today/week.mjs';
import { keepTogether } from '@/lib/today/move.mjs';

const read = (key) => { try { return window.localStorage.getItem(key) === '1'; } catch { return false; } };
const remember = (key) => { try { window.localStorage.setItem(key, '1'); } catch { /* it may cheer again on this device */ } };
const SAY = { counted: 'study day', planned: 'planned', missed: 'planned, nothing saved', open: 'nothing saved', rest: 'rest day', before: 'before your first session' };
// The strip's marks explained in one quiet line for the first 3 visits that show one (release 10, N1 #7: nothing to decode).
const LEGEND_KEY = 'mm:today-week-legend:v1';
const LEGEND = { missed: 'Dashed: a planned day that passed.', rest: 'Dot: a rest day.', before: 'Dash: before your first session.' };
export const legendFor = (marks) => ['missed', 'rest', 'before'].filter((k) => marks.some((m) => m.look === k)).map((k) => LEGEND[k]).join(' ');
const LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function Day({ m, i, selected, onSelect }) {
  return (
    <li>
      <button type="button" className="tw__day" data-state={m.look} data-today={m.today || undefined} aria-pressed={selected} style={{ '--i': i }} onClick={() => onSelect(i)} aria-label={`${m.today ? 'Today, ' : ''}${LONG[i]}: ${SAY[m.look]}`}>
        <span className="tw__dot" aria-hidden="true">
          {m.look === 'counted' ? <svg viewBox="0 0 24 24" focusable="false"><path d="M6.5 12.5l3.6 3.6 7.4-8.2" pathLength="1" /></svg> : null}
        </span>
        <span className="tw__name" aria-hidden="true">{m.today ? 'Today' : m.name}</span>
      </button>
    </li>
  );
}

/**
 * `rhythm`, `goal`: the reads ({ status, data }). `everSessions`: saved sessions (0 = day one). `mobiFree`: no other
 * Mobi is on screen. `mob`: the Mob state. `papers`, `repairs`: what was saved, for the day readout. `failed`: the move did not load.
 */
export default function TodayWeek({ rhythm, goal, everSessions = null, mobiFree = true, mob = null, repairs = null, papers = null, failed = false, subjectName = (id) => id, onRetry, hold = false }) {
  const r = rhythm.data;
  const tz = r?.timeZone || 'Asia/Kolkata';
  const today = useMemo(() => (r ? todayKeyIn(tz) : null), [r, tz]);
  const firstDay = useMemo(() => {
    const at = r?.milestones?.find?.((m) => m.id === 'first_scored_session')?.achievedAt;
    return at && r ? todayKeyIn(tz, Date.parse(at)) : today;
  }, [r, today, tz]);
  const marks = useMemo(() => (r ? weekMarks({ rhythm: r, today, weekdays: goal.data?.weekdays || null, firstDay }) : []).map((m) => ({ ...m, look: m.state === 'planned' && m.key < today ? 'missed' : m.state })), [r, today, goal.data, firstDay]);
  const count = weekDays(r);
  const caption = r ? weekCaption({ rhythm: r, marks, today, everSessions, pausedUntil: goal.data?.pausedUntil || null }) : null;
  const receipt = useMemo(() => (r ? weekReceipt({ repairs, weekStart: r.weekStart, dayKey: (at) => todayKeyIn(tz, Date.parse(at)) }) : null), [r, repairs, tz]);
  const todayIndex = Math.max(0, marks.findIndex((m) => m.today));
  const [picked, setPicked] = useState(null);
  const sel = picked ?? todayIndex;
  const [swapKey, setSwapKey] = useState(0);
  const select = (i) => { setPicked(i); setSwapKey((k) => k + 1); };
  const dayKey = useMemo(() => (at) => todayKeyIn(tz, typeof at === 'number' ? at : Date.parse(at)), [tz]);
  const readout = marks[sel] ? dayReadout({
    mark: marks[sel], index: sel, papers: papers?.status === 'ready' ? papers.data : [], repairs: repairs || [], dayKey, clockOf: (at) => clockIn(at, tz),
    subjectName, failed, goal: r?.daysGoal || null, done: Number.isInteger(r?.studyDays) ? r.studyDays : null, met: Boolean(r?.metThisWeek), today,
  }) : null;

  const legend = legendFor(marks);
  const [showLegend, setShowLegend] = useState(false);
  useEffect(() => {
    if (!legend || hold) return undefined;
    const t = window.setTimeout(() => {
      try {
        const n = Number(window.localStorage.getItem(LEGEND_KEY)) || 0;
        if (n < 3) { window.localStorage.setItem(LEGEND_KEY, String(n + 1)); setShowLegend(true); }
      } catch { /* no storage: the strip stays as it is */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, [legend, hold]);

  // The cheer: decided once when the week arrives, remembered once it has been shown.
  const [moment, setMoment] = useState(null);
  const week = r?.weekStart;
  const met = Boolean(r?.metThisWeek);
  const mobWeek = mob?.status === 'ready' ? mob.mob?.week : null;
  useEffect(() => {
    if (!week || !mobiFree) return undefined;
    const t = window.setTimeout(() => {
      const goalAct = weekGoalAct({ met, cheered: read(weekCheerKey(week)) });
      if (goalAct) { remember(weekCheerKey(week)); setMoment({ act: goalAct, key: `w${week}` }); return; }
      if (mobWeek?.start) {
        const ringAct = mobRingAct({ size: mobWeek.size, sat: mobWeek.sat, cheered: read(mobCheerKey(mobWeek.start)) });
        if (ringAct) { remember(mobCheerKey(mobWeek.start)); setMoment({ act: ringAct, key: `m${mobWeek.start}`, mob: `Your Mob all sat this week: ${mobWeek.sat} of ${mobWeek.size}.` }); }
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [week, met, mobiFree, mobWeek?.start, mobWeek?.size, mobWeek?.sat]);

  if (rhythm.status === 'error') {
    return (
      <section className="tw" id="week" aria-labelledby="tw-h">
        <header className="tg__row"><h2 id="tw-h" className="tg__h">This week</h2></header>
        <p className="tw__empty" role="status">Your study days did not load. <button type="button" className="tm__inline" onClick={onRetry}>Try again</button></p>
      </section>
    );
  }
  // `hold`: the move is still on its way, so the week waits with it and the two land together (W-042).
  if (!r || hold) {
    return (
      <section className="tw tw--wait" id="week" aria-labelledby="tw-h" aria-busy="true">
        <header className="tg__row"><h2 id="tw-h" className="tg__h">This week</h2><span className="tw__fig--wait" /></header>
        <ol className="tw__days" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n) => <li key={n}><span className="tw__day" data-state="wait"><span className="tw__dot" /><span className="tw__name">{n}</span></span></li>)}</ol>
        <div className="tw__readout tw__readout--wait"><span /><span /></div>
      </section>
    );
  }
  return (
    <section className="tw" id="week" aria-labelledby="tw-h">
      <header className="tg__row">
        <h2 id="tw-h" className="tg__h">This week</h2>
        {/* The one count of the week's study days; Road to CUET's This week prints the same figure and words (weekDays). */}
        {count ? <p className="tg__fig"><b>{count.done}</b><span className="tg__of">of {count.total}</span><span>study {count.total === 1 ? 'day' : 'days'}</span></p> : null}
      </header>
      <div className="tw__track" style={{ '--sel': sel }}>
        <span className="tw__sel" aria-hidden="true" />
        <ol className="tw__days" aria-label="Days of this week">
          {marks.map((m, i) => <Day key={m.key} m={m} i={i} selected={i === sel} onSelect={select} />)}
        </ol>
      </div>
      {showLegend && legend ? <p className="tw__legend">{legend}</p> : null}
      {readout ? (
        <div className="tw__readout" key={swapKey} data-swap={swapKey > 0 || undefined} aria-live="polite">
          <h3>{readout.title}</h3>
          {readout.lines.length ? <ul>{readout.lines.map((l) => <li key={`${l.text}${l.at}`}><span>{l.text}</span><time>{l.at}</time></li>)}</ul> : null}
          {/* With no caption (today counted, the goal not met yet), the readout carries the week's one line and "Your weeks" at its end. */}
          {readout.note || !caption ? <p>{readout.note}{caption ? null : <>{readout.note ? ' ' : ''}<Link className="tm__inline tw__weeks" href="/progress">Your weeks</Link></>}</p> : null}
        </div>
      ) : null}
      {caption || moment ? (
        <div className="tw__foot">
          {moment ? <span className="tw__mobi" aria-hidden="true"><MobiReact key={moment.key} act={moment.act} size={52} /></span> : null}
          <p className="tw__caption">
            {moment?.mob ? <>{moment.mob} </> : null}{caption ? <>{caption.text} <b>{caption.strong}</b> <Link className="tm__inline tw__weeks" href="/progress">Your weeks</Link></> : null}
          </p>
        </div>
      ) : null}
      {receipt ? <p className="tw__receipt">{receipt.text} <b>{keepTogether(receipt.strong)}</b></p> : null}
    </section>
  );
}
