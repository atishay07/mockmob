"use client";
// The daily streak on You (17 Nov 2026, LK296 S1 and S8): its cell in Your progress (the number in a bubble, ringed volt once today
// counts, and the best), opening the streak sheet; and in Your goal, the exam pause offered in words, opening the sheet at its
// pause days. Both read the one shared streak (useStreak); a failed read leaves them out.
import { PAUSE_TITLE, daysWord, pauseLine, pauseSetLine } from '@/lib/streak/streakCopy.mjs';
import { openStreakSheet, useStreak } from './useStreak';
import './streak.css';

export function StreakGlanceCell({ userId }) {
  const { status, data: body } = useStreak(userId);
  if (status === 'error') return null;
  if (!body) return <span className="acct-sk acct-sk--glance skeleton" aria-hidden="true" />;
  const done = Boolean(body.today?.done);
  const sub = body.best > body.days ? `Best: ${daysWord(body.best)}` : done ? 'Today counts' : body.days > 0 ? `Today: ${body.today?.answered ?? 0} of ${body.today?.needed ?? body.rule?.answers} answered` : 'Starts with one day';
  return (
    <button type="button" className="acct-streak" data-today={done || undefined} onClick={() => openStreakSheet()}
      aria-label={`Daily streak, ${daysWord(body.days)}. ${sub}. Opens your streak.`}>
      <b className="acct-streak__n" aria-hidden="true">{body.days}</b>
      <span className="acct-glance__text" aria-hidden="true"><b>{body.days === 1 ? '1 day in a row' : `${body.days} days in a row`}</b><span>{sub}</span></span>
    </button>
  );
}

export function StreakPauseOffer({ userId }) {
  const { data: body } = useStreak(userId);
  if (!body) return null;
  const today = body.week?.[body.week.length - 1]?.day || null;
  const set = pauseSetLine(body.pause, today);
  return (
    <div className="stk-goal" id="exam-pause">
      <h3>{PAUSE_TITLE}</h3>
      <p className="acct-note">{pauseLine(body.pause)}</p>
      {set ? <p className="acct-note">{set}</p> : null}
      <div><button type="button" className="acct-key" onClick={() => openStreakSheet('pause')}>{set ? 'Change pause days' : 'Choose pause days'}</button></div>
    </div>
  );
}
