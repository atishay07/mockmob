"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, RotateCcw } from 'lucide-react';
import { MINE_COPY } from '@/lib/dailyFiveMine.mjs';
import { readSeen, seenKey, streakWeek, todayProgress, writeSeen } from '@/lib/streak/streakCopy.mjs';
import { StreakMobi, StreakTick } from '@/components/streak/Streak';
import StreakLine from '@/components/streak/StreakLine';
import { useStreak } from '@/components/streak/useStreak';
import { useOnScreen } from './DailyParts';
import { didLines, nextStep } from './dailyMineUi.mjs';
import './daily-mine.css';

// The day's end of a student's own five (owner LK365, 21 Nov 2026; spec tmp/1121-stories/DAILY-SPEC.md, "The page"), in the
// result card under the score, in this order:
//   1. The streak moment: Mobi (lit once today counts), the day number and this week's line with today filled, from the one
//      streak read every page shares (useStreak, GET /api/me/streak; the parts are src/components/streak's own). A whole five is
//      a streak day (src/lib/server/streakDays.js), so right after the fifth answer the number usually rises: the page read the
//      streak when the five began (DailyFive.jsx), this part reads it once more, and when the day number went up it steps from
//      the old figure to the new one once (StreakTick, about 400 ms) while today's piece of the line swipes in (StreakLine
//      `fresh`). A second visit shows the figures still. Reduced motion: the new figure, no swipe (the parts' own CSS).
//   2. "What today's five did": the honest counts from the checks' `fed` (dailyMineUi.mjs didLines; the contract: count only
//      what `fed` holds).
//   3. ONE next-step key: Revise while something is still open, else ten more on the weak chapter (dailyMineUi.mjs nextStep).
// Every block holds its height from the first paint (the streak's place is drawn empty while it is read), so nothing below
// moves when the streak arrives.
// The step waits until the block is on screen, then a beat (the old figure is read first), so the eye is on it when it moves.
const STEP_MS = 1100;
const STEP_DELAY_MS = 450;

function useStreakStep(userId, live, visible) {
  const { status, data, reload } = useStreak(userId);
  const first = useRef(undefined);
  const asked = useRef(false);
  const played = useRef(null);
  const [from, setFrom] = useState(null);
  const [grew, setGrew] = useState(false);
  const [base, setBase] = useState(null);
  // The body the part first sees: the read from when the five began (or this part's own first read). If today did not count
  // in it, read once more: the five just made it count. (Every guard is a ref set when the thing happens, never when it is
  // only scheduled, so React's development double run of effects cannot lose the read or the step.)
  useEffect(() => {
    if (!data) return undefined;
    if (first.current === undefined) first.current = data;
    const held = first.current;
    const keep = held !== base ? window.setTimeout(() => setBase(held), 0) : 0;
    if (!live || asked.current || held.today?.done) return () => window.clearTimeout(keep);
    // After this render: the store's first read is still settling while its subscribers draw (useStreak.js), and a read asked
    // inside that would be handed the same answer back.
    const t = window.setTimeout(() => { asked.current = true; reload(); }, 0);
    return () => { window.clearTimeout(t); window.clearTimeout(keep); };
  }, [data, live, reload, base]);
  // The number went up since that first body: step once from the old figure, and tell this device it has seen the new one
  // (the pill on Today and the top bar's chip step up from what this device last saw; this moment is that step).
  useEffect(() => {
    const before = first.current;
    if (!visible || !data || !before || data === before || before.today?.done || !(data.days > before.days)) return undefined;
    const key = `${before.days}>${data.days}`;
    if (played.current === key) return undefined;
    try {
      const seen = readSeen(window.localStorage.getItem(seenKey(userId)));
      if (!seen || seen.d < data.days || !seen.t) window.localStorage.setItem(seenKey(userId), writeSeen(data.days, Boolean(data.today?.done)));
    } catch { /* this visit only */ }
    const on = window.setTimeout(() => { played.current = key; setGrew(true); setFrom(before.days); }, STEP_DELAY_MS);
    const off = window.setTimeout(() => setFrom(null), STEP_DELAY_MS + STEP_MS);
    return () => { window.clearTimeout(on); window.clearTimeout(off); setFrom(null); };
  }, [data, userId, visible]);
  // Until the step plays, the block keeps showing the figures it first showed (the old number, today not counted yet), so the
  // number never jumps ahead of its own step.
  const rising = Boolean(data && base && data !== base && !base.today?.done && data.days > base.days);
  return { status, data: rising && !grew ? base : data, reload, from, grew };
}

function StreakMoment({ userId, live }) {
  const ref = useRef(null);
  const visible = useOnScreen(ref, '0px 0px -20% 0px');
  const { status, data: body, reload, from, grew } = useStreakStep(userId, live, visible);
  if (!body) {
    const failed = status === 'error' || status === 'ready';
    return (
      <div className="dly-end__streak" ref={ref} data-state={failed ? 'failed' : 'wait'} aria-busy={failed ? undefined : 'true'}>
        {failed ? (
          <p className="dly-end__fail" role="status">Your streak did not load. <button type="button" className="dly-end__again" onClick={reload}>Try again</button></p>
        ) : <span className="dly-end__wait" aria-hidden="true" />}
      </div>
    );
  }
  const counted = Boolean(body.today?.done);
  const stepping = from !== null;
  const days = Math.max(0, Number(body.days) || 0);
  return (
    <div className="dly-end__streak" ref={ref} data-state="ready" data-step={stepping || undefined}>
      <div className="dly-end__head">
        <StreakMobi lit={counted} size={56} className="dly-end__mobi" />
        <div className="dly-end__count">
          <p className="dly-end__n" aria-label={`${days === 1 ? '1 day' : `${days} days`} in a row${counted ? ', today counted' : ''}`}>
            <StreakTick days={days} from={from} className="dly-end__tick" />
            <span aria-hidden="true">{days === 1 ? 'day in a row' : 'days in a row'}</span>
          </p>
          <p className="dly-end__line">{counted ? (grew ? 'Today counts. One more day in a row.' : 'Today counts.') : 'Your five are saved.'}</p>
        </div>
      </div>
      <StreakLine days={streakWeek(body)} progress={todayProgress(body)} fresh={stepping} label="Your last 7 days" />
    </div>
  );
}

/**
 * userId: the signed-in student. live: the five were just finished on this page (the streak is read again, the step can play).
 * mark: this device's note for today (dailyMineUi.mjs). marks: the five right or wrong. questions: the personal five (acceptMine).
 */
export default function DailyEnd({ userId, live = false, mark, marks, questions, headingId }) {
  const did = didLines(mark);
  const step = nextStep({ counts: did.counts, marks, questions });
  return (
    <section className="dly-end" aria-labelledby={headingId}>
      <StreakMoment userId={userId} live={live} />
      <div className="dly-end__did">
        <h2 className="dly-end__title" id={headingId}>{MINE_COPY.doneHead}</h2>
        {did.lines.length ? (
          <ul className="dly-end__lines">
            {did.lines.map((line) => {
              const kind = /fixed/.test(line) ? 'fixed' : /sent back/.test(line) ? 'sent' : 'none';
              return (
                <li key={line} className="dly-end__did-line" data-kind={kind}>
                  <span className="dly-end__did-icon" aria-hidden="true">{kind === 'sent' ? <RotateCcw size={16} strokeWidth={2.5} /> : <Check size={16} strokeWidth={3} />}</span>
                  <span>{line}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="dly-end__none">Your answers are saved to your account.</p>}
      </div>
      <div className="dly-end__next">
        <Link href={step.href} className="mm-btn mm-btn--primary dly-end__key" data-kind={step.kind}>{step.label}</Link>
        {step.note ? <p className="dly-end__note">{step.note}</p> : null}
      </div>
    </section>
  );
}
