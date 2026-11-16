"use client";
// Today's daily streak (17 Nov 2026, LK296 S1), right above This week's goal: the number, the one line that matters today (a day
// still open, a pause day, a covered day, today counted or what today needs), the rest passes and the rule, as one outlined
// surface that opens the streak sheet (the whole surface is the button, F5). A milestone reached in the last two days shows once
// on this device as a calm line with its real work (S6), never confetti; Celebrations Off leaves the moment out, Quiet keeps
// it still. A failed read leaves the block out: the week below still says what was done.
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { STREAK_NAME, milestoneMoment, momentKey, ruleLine, statusLine } from '@/lib/streak/streakCopy.mjs';
import { PassSlots } from './Streak';
import { openStreakSheet, useStreak } from './useStreak';
import './streak.css';

const seenMoment = (at) => { try { return window.localStorage.getItem(momentKey(at)) === '1'; } catch { return true; } };
const keepMoment = (at) => { try { window.localStorage.setItem(momentKey(at), '1'); } catch { /* shows again on this device */ } };

export default function TodayStreak({ userId, hold = false }) {
  const { status, data: body } = useStreak(userId);
  const prefs = useMobiPrefs();
  const [moment, setMoment] = useState(null);
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

  if (status === 'error' || (status === 'ready' && !body)) return null;
  if (!body || hold) {
    return (
      <section className="tsk tsk--wait" aria-busy="true" aria-labelledby="tsk-h">
        <header className="tsk__head"><h2 id="tsk-h" className="tsk__h">{STREAK_NAME}</h2></header>
        <div className="tsk__panel"><span /><span /></div>
      </section>
    );
  }
  const line = statusLine(body);
  return (
    <section className="tsk" id="streak" aria-labelledby="tsk-h">
      <header className="tsk__head">
        <h2 id="tsk-h" className="tsk__h">{STREAK_NAME}</h2>
        {/* Never a zero lead (R3 Z): with no run yet the line below says how it starts. */}
        {body.days > 0 ? <p className="tsk__fig"><b>{body.days}</b><span>{body.days === 1 ? 'day in a row' : 'days in a row'}</span></p> : null}
      </header>
      {moment ? (
        <div className="tsk__moment" data-play={moment.play || undefined} role="status">
          <span className="tsk__stamp" aria-hidden="true">{moment.at}</span>
          <p><b>{moment.title}</b><span>{moment.text}</span></p>
        </div>
      ) : null}
      <button type="button" className="tsk__panel tsk__surface" onClick={() => openStreakSheet()} aria-describedby="tsk-rule">
        <span className="tsk__status" data-tone={line?.tone}>{line?.text}{line?.sub ? <span className="tsk__sub">{line.sub}</span> : null}</span>
        <PassSlots passes={body.passes} compact />
        <span className="tsk__foot"><span>Your week, passes and pause days</span><ChevronRight size={18} aria-hidden="true" /></span>
      </button>
      <p className="tsk__rule" id="tsk-rule">{ruleLine(body.rule?.answers ?? body.today?.needed)}</p>
    </section>
  );
}
