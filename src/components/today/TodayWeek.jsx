"use client";
// This week on Today (TODAY-1017 4.3): "3 of 4 study days", seven marks and one caption that ties the week to
// tonight. The whole row opens the week on Progress (its ring, the weeks ribbon and the milestones stay there).
// The goal met is the one Mobi moment here: a cheer beside the caption, once per week on this device (the same key
// the Progress card uses), and only when the move card is not already showing Mobi.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MobiReact from '@/components/brand/MobiReact';
import { weekCheerKey, weekGoalAct, mobCheerKey, mobRingAct } from '@/lib/mobiScreens';
import { weekCaption, weekMarks, marksWords, todayKeyIn, weekReceipt } from '@/lib/today/week.mjs';
import { keepTogether } from '@/lib/today/move.mjs';

const read = (key) => { try { return window.localStorage.getItem(key) === '1'; } catch { return false; } };
const remember = (key) => { try { window.localStorage.setItem(key, '1'); } catch { /* it may cheer again on this device */ } };

function Mark({ m, i }) {
  return (
    <li className="tw__day" data-state={m.state} data-today={m.today || undefined} style={{ '--i': i }}>
      <span className="tw__dot" aria-hidden="true">
        {m.state === 'counted' ? <svg viewBox="0 0 24 24" focusable="false"><path d="M6.5 12.5l3.6 3.6 7.4-8.2" pathLength="1" /></svg> : null}
      </span>
      <span className="tw__name" aria-hidden="true">{m.name}</span>
    </li>
  );
}

/**
 * `rhythm`, `goal`: the reads ({ status, data }). `everSessions`: saved sessions (0 = day one). `mobiFree`: no other
 * Mobi is on screen (the move card is not showing one). `mob`: the Mob state, for the ring-complete moment.
 */
export default function TodayWeek({ rhythm, goal, everSessions = null, mobiFree = true, mob = null, repairs = null, onRetry, hold = false }) {
  const r = rhythm.data;
  const today = useMemo(() => (r ? todayKeyIn(r.timeZone) : null), [r]);
  const firstDay = useMemo(() => {
    const at = r?.milestones?.find?.((m) => m.id === 'first_scored_session')?.achievedAt;
    return at && r ? todayKeyIn(r.timeZone, Date.parse(at)) : today;
  }, [r, today]);
  const marks = useMemo(() => (r ? weekMarks({ rhythm: r, today, weekdays: goal.data?.weekdays || null, firstDay }) : []), [r, today, goal.data, firstDay]);
  const caption = r ? weekCaption({ rhythm: r, marks, today, everSessions, pausedUntil: goal.data?.pausedUntil || null }) : null;
  // The weekly receipt: only repairs the record holds for this week; absent when there are none (FEATURE-ADOPTION 5).
  const receipt = useMemo(() => (r ? weekReceipt({ repairs, weekStart: r.weekStart, dayKey: (at) => todayKeyIn(r.timeZone, Date.parse(at)) }) : null), [r, repairs]);

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
      <section className="tw" aria-labelledby="tw-h">
        <header className="tw__head"><h2 id="tw-h" className="tg__h">This week</h2></header>
        <p className="tw__caption" role="status">Study days did not load. <button type="button" className="tm__inline" onClick={onRetry}>Try again</button></p>
      </section>
    );
  }
  // `hold`: the move is still on its way, so the week waits with it and the two land together (W-042).
  if (!r || hold) {
    return (
      <section className="tw tw--wait" aria-labelledby="tw-h" aria-busy="true">
        <header className="tw__head"><h2 id="tw-h" className="tg__h">This week</h2><span className="tw__fig tw__fig--wait" /></header>
        <ol className="tw__days" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n, i) => <li key={n} className="tw__day" data-state="wait" style={{ '--i': i }}><span className="tw__dot" /><span className="tw__name">{n}</span></li>)}</ol>
        <p className="tw__caption tw__caption--wait"><span /></p>
      </section>
    );
  }
  const label = `This week, ${r.studyDays} of ${r.daysGoal} study days. ${marksWords(marks)}.`;
  return (
    <section className="tw" aria-labelledby="tw-h">
      <Link className="tw__link" href="/progress" aria-label={`${label} ${caption.text} ${caption.strong}${receipt ? ` ${receipt.text} ${receipt.strong}` : ''} Open your weeks.`}>
        <header className="tw__head">
          <h2 id="tw-h" className="tg__h">This week</h2>
          <p className="tw__fig" aria-hidden="true"><b>{r.studyDays}</b><span className="tw__of">of {r.daysGoal}</span><span className="tw__unit">study days</span></p>
        </header>
        <ol className="tw__days" aria-hidden="true">{marks.map((m, i) => <Mark key={m.key} m={m} i={i} />)}</ol>
        <div className="tw__foot">
          {moment ? <span className="tw__mobi" aria-hidden="true"><MobiReact key={moment.key} act={moment.act} size={52} /></span> : null}
          <p className="tw__caption" aria-hidden="true">
            {moment?.mob ? <>{moment.mob} </> : null}{caption.text} <b>{caption.strong}</b>
          </p>
        </div>
        {receipt ? <p className="tw__receipt" aria-hidden="true">{receipt.text} <b>{keepTogether(receipt.strong)}</b></p> : null}
      </Link>
    </section>
  );
}
