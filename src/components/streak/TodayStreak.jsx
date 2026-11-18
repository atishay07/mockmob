"use client";
// Today's daily streak (17 Nov 2026, LK296 S1), right above This week's goal: the number, the one line that matters today (a day
// still open, a pause day, a covered day, today counted or what today needs), the rest passes and the rule, as one outlined
// surface that opens the streak sheet (the whole surface is the button, F5). A milestone reached in the last two days shows once
// on this device as a calm line with its real work (S6), never confetti; Celebrations Off leaves the moment out, Quiet keeps
// it still. A failed read keeps a short block with Try again, so the week below does not jump.
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { STREAK_NAME, countedKey, milestoneMoment, momentKey, ruleLine, statusLine, todayProgress } from '@/lib/streak/streakCopy.mjs';
import { PassSlots, StreakMobi, WeekStrip } from './Streak';
import { openStreakSheet, useStreak } from './useStreak';
import './streak.css';

const seenMoment = (at) => { try { return window.localStorage.getItem(momentKey(at)) === '1'; } catch { return true; } };
const keepMoment = (at) => { try { window.localStorage.setItem(momentKey(at), '1'); } catch { /* shows again on this device */ } };

export default function TodayStreak({ userId, hold = false }) {
  const { status, data: body, reload } = useStreak(userId);
  const prefs = useMobiPrefs();
  const [moment, setMoment] = useState(null);
  // The day's one small moment (18 Nov 2026): the first time this device sees today counted, Mobi wakes, the number rolls up
  // and today's bubble lands. Once a day; never under Celebrations Off or Reduce motion (then it is simply shown).
  const [fresh, setFresh] = useState(false);
  const todayKey = body?.week?.[body.week.length - 1]?.day || null;
  const counted = Boolean(body?.today?.done);
  useEffect(() => {
    if (!counted || !todayKey || hold) return undefined;
    let seen = true;
    try { seen = window.localStorage.getItem(countedKey(todayKey)) === '1'; window.localStorage.setItem(countedKey(todayKey), '1'); } catch { /* shown still */ }
    if (seen || prefs.celebrations === 'off' || prefs.reduced) return undefined;
    const on = window.setTimeout(() => setFresh(true), 0);
    const off = window.setTimeout(() => setFresh(false), 1800);
    return () => { window.clearTimeout(on); window.clearTimeout(off); };
  }, [counted, todayKey, hold, prefs.celebrations, prefs.reduced]);
  const reached = body?.milestone && body.days - body.milestone.at <= 2 ? body.milestone : null;
  useEffect(() => {
    if (!reached || hold || prefs.celebrations === 'off') return undefined;
    const t = window.setTimeout(() => {
      if (seenMoment(reached.at)) return;
      keepMoment(reached.at);
      setMoment({ ...milestoneMoment(reached), at: reached.at, play: prefs.celebrations === 'full' && !prefs.reduced });
    }, 0);
    return () => window.clearTimeout(t);
  }, [reached, hold, prefs.celebrations, prefs.reduced]);

  if (status === 'error' || (status === 'ready' && !body)) {
    // A failed read keeps a short block (17 Nov review): the week below does not jump, and the student can ask again.
    return (
      <section className="tsk tsk--failed" aria-labelledby="tsk-h">
        <header className="tsk__head"><h2 id="tsk-h" className="tsk__h">{STREAK_NAME}</h2></header>
        <p className="tsk__fail" role="status">Your streak did not load. <button type="button" className="tsk__open" onClick={reload}>Try again</button></p>
      </section>
    );
  }
  if (!body || hold) {
    return (
      <section className="tsk tsk--wait" aria-busy="true" aria-labelledby="tsk-h">
        <header className="tsk__head"><h2 id="tsk-h" className="tsk__h">{STREAK_NAME}</h2></header>
        <div className="tsk__panel"><span /><span /><span /><span /></div>
        <p className="tsk__rule" aria-hidden="true">&nbsp;</p>
      </section>
    );
  }
  const line = statusLine(body);
  const progress = todayProgress(body);
  return (
    <section className="tsk" id="streak" aria-labelledby="tsk-h" data-fresh={fresh || undefined}>
      <header className="tsk__head">
        <h2 id="tsk-h" className="tsk__h">{STREAK_NAME}</h2>
      </header>
      {moment ? (
        <div className="tsk__moment" data-play={moment.play || undefined} role="status">
          <span className="tsk__stamp" aria-hidden="true">{moment.at}</span>
          <p><b>{moment.title}</b><span>{moment.text}</span></p>
        </div>
      ) : null}
      <button type="button" className="tsk__panel tsk__surface" onClick={() => openStreakSheet()} aria-describedby="tsk-rule">
        {/* Mobi, the number, then the week: what a student reads in one look (18 Nov 2026, LK309). Never a zero lead (R3 Z):
            with no run yet he sleeps beside the line that says how it starts. */}
        <span className="tsk__top">
          <StreakMobi lit={counted} className="tsk__mobi" />
          {body.days > 0 ? (
            <span className="tsk__count">
              <b className="tsk__n" data-roll={fresh && body.days > 1 ? 'true' : undefined}>{fresh && body.days > 1 ? <><span aria-hidden="true">{body.days - 1}</span><span>{body.days}</span></> : body.days}</b>
              <span className="tsk__unit">{body.days === 1 ? 'day in a row' : 'days in a row'}</span>
            </span>
          ) : null}
        </span>
        <WeekStrip body={body} />
        <span className="tsk__status" data-tone={line?.tone}>
          {progress ? (
            <span className="tsk__bar" role="img" aria-label={`${progress.answered} of ${progress.needed} answered today`} style={{ '--n': progress.needed }}>
              {Array.from({ length: progress.needed }, (_, i) => <i key={i} data-on={i < progress.answered || undefined} />)}
            </span>
          ) : null}
          {line?.text}{line?.sub ? <span className="tsk__sub">{line.sub}</span> : null}
        </span>
        <PassSlots passes={body.passes} compact />
        <span className="tsk__foot"><span>Your week, passes and pause days</span><ChevronRight size={18} aria-hidden="true" /></span>
      </button>
      <p className="tsk__rule" id="tsk-rule">{ruleLine(body.rule?.answers ?? body.today?.needed)}</p>
    </section>
  );
}
