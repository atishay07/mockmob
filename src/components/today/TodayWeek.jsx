"use client";
// This week on Today (TODAY-1018 section 6.3, R3's block made tappable). "3 of 4 study days", seven day buttons and one
// readout under them that swaps in place: a tapped day says what was saved that day (the papers and repairs the page
// already read) or what is planned; today says what is up next, live with the lead card. One indicator slides between
// the days (240 ms, the N5 lesson), not seven boxes switching. The caption ties the week to tonight; its "Your weeks"
// opens Progress. The week-goal Mobi cheer (once per week on this device, only when no other Mobi is on screen) and the
// weekly repair receipt stay from R3.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MobiReact from '@/components/brand/MobiReact';
import { weekCheerKey, weekGoalAct, mobCheerKey, mobRingAct } from '@/lib/mobiScreens';
import { clockIn, dayReadout, weekCaption, weekMarks, todayKeyIn, weekReceipt } from '@/lib/today/week.mjs';
import { keepTogether } from '@/lib/today/move.mjs';

const read = (key) => { try { return window.localStorage.getItem(key) === '1'; } catch { return false; } };
const remember = (key) => { try { window.localStorage.setItem(key, '1'); } catch { /* it may cheer again on this device */ } };
const SAY = { counted: 'study day', planned: 'planned', missed: 'planned, nothing saved', open: 'nothing saved', rest: 'rest day', before: 'before your first session' };
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
 * Mobi is on screen. `mob`: the Mob state. `papers`, `repairs`: what was saved, for the day readout. `lead`: the move on
 * the card now (today's readout follows it). `failed`: the move did not load.
 */
export default function TodayWeek({ rhythm, goal, everSessions = null, mobiFree = true, mob = null, repairs = null, papers = null, lead = null, failed = false, subjectName = (id) => id, onRetry, hold = false }) {
  const r = rhythm.data;
  const tz = r?.timeZone || 'Asia/Kolkata';
  const today = useMemo(() => (r ? todayKeyIn(tz) : null), [r, tz]);
  const firstDay = useMemo(() => {
    const at = r?.milestones?.find?.((m) => m.id === 'first_scored_session')?.achievedAt;
    return at && r ? todayKeyIn(tz, Date.parse(at)) : today;
  }, [r, today, tz]);
  const marks = useMemo(() => (r ? weekMarks({ rhythm: r, today, weekdays: goal.data?.weekdays || null, firstDay }) : []).map((m) => ({ ...m, look: m.state === 'planned' && m.key < today ? 'missed' : m.state })), [r, today, goal.data, firstDay]);
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
    subjectName, move: lead, failed, goal: r?.daysGoal || null, today,
  }) : null;

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
        <p className="tg__fig"><b>{r.studyDays}</b><span className="tg__of">of {r.daysGoal}</span><span>study days</span></p>
      </header>
      <div className="tw__track" style={{ '--sel': sel }}>
        <span className="tw__sel" aria-hidden="true" />
        <ol className="tw__days" aria-label="Days of this week">
          {marks.map((m, i) => <Day key={m.key} m={m} i={i} selected={i === sel} onSelect={select} />)}
        </ol>
      </div>
      {readout ? (
        <div className="tw__readout" key={swapKey} data-swap={swapKey > 0 || undefined} aria-live="polite">
          <h3>{readout.title}</h3>
          {readout.lines.length ? <ul>{readout.lines.map((l) => <li key={`${l.text}${l.at}`}><span>{l.text}</span><time>{l.at}</time></li>)}</ul> : null}
          {readout.note ? <p>{readout.note}</p> : null}
        </div>
      ) : null}
      <div className="tw__foot">
        {moment ? <span className="tw__mobi" aria-hidden="true"><MobiReact key={moment.key} act={moment.act} size={52} /></span> : null}
        <p className="tw__caption">
          {moment?.mob ? <>{moment.mob} </> : null}{caption.text} <b>{caption.strong}</b> <Link className="tm__inline tw__weeks" href="/progress">Your weeks</Link>
        </p>
      </div>
      {receipt ? <p className="tw__receipt">{receipt.text} <b>{keepTogether(receipt.strong)}</b></p> : null}
    </section>
  );
}
