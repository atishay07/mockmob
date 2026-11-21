"use client";
// Today's daily streak (17 Nov 2026, LK296 S1; 19 Nov 2026: one unbroken line to exam day). In one look: Mobi from the logo and
// the number (they open the streak sheet), the last 7 days as the streak's line (StreakLine: one volt band under every run of
// kept days, today's tip reaching in by today's answers), what the line has made and what it makes by CUET, the one line that
// matters today, and, while today does not count yet, the one key that keeps the line: today's Daily Five while it is still to
// play, else today's practice set (both count by the server's rule). Then the rest passes and the way into the sheet.
// The day's one small moment, the first time this device sees today counted: today's piece of the band swipes in, Mobi lights
// as it lands and the number rolls up one. Once a day; never under Celebrations Off or Reduce motion (then it is simply shown).
// A milestone reached in the last two days shows once on this device as a calm line with its real work (S6), never confetti.
// A failed read keeps a short block with Try again, so the week below does not jump.
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { useMedia } from '@/lib/useMedia';
import {
  STREAK_NAME, countedKey, daysWord, milestoneMoment, momentKey, ruleLine, statusLine, streakWeek, todayProgress, todayShort,
} from '@/lib/streak/streakCopy.mjs';
import { PassSlots, StreakMobi, StreakTick } from './Streak';
import { hasStreakChip, PHONE_STREAK_MEDIA } from './StreakChip';
import StreakLine from './StreakLine';
import { openStreakSheet, useStreak, useStreakGrow } from './useStreak';
import { FinishLine, KeepKey, MadeLines } from './StreakUseful';
import './streak.css';
import './streak-line.css';

// Today keeps its status near the greeting when the phone header carries the count.
// Without the header count, the pill is also a shortcut to the streak sheet.
function TodayHeadPill({ userId, body, status, hold, headerHasCount }) {
  const ready = Boolean(body) && !hold;
  const from = useStreakGrow(userId, body, ready && !headerHasCount);
  if (!ready) {
    const failed = !hold && (status === 'error' || status === 'ready');
    if (failed) {
      return (
        <button type="button" className="tsk-pill" onClick={() => openStreakSheet()} aria-label={`${STREAK_NAME}. Opens your streak.`}>
          <StreakMobi size={26} className="tsk-pill__mobi" />
          <span className="tsk-pill__lead">{STREAK_NAME}</span>
          <ChevronRight className="tsk-pill__chev" size={16} aria-hidden="true" />
        </button>
      );
    }
    return <span className="tsk-pill tsk-pill--wait" aria-hidden="true" />;
  }
  const counted = Boolean(body.today?.done);
  const short = todayShort(body);
  if (headerHasCount) {
    return <p className="tsk-summary"><b>{STREAK_NAME}</b>{short ? <span>{short}</span> : null}</p>;
  }
  const lead = body.days > 0 ? `${daysWord(body.days)} in a row` : 'Your streak starts with one day';
  return (
    <button type="button" className="tsk-pill" onClick={() => openStreakSheet()} data-grow={from !== null || undefined} data-done={counted || undefined}
      aria-label={`${STREAK_NAME}: ${lead}${short ? `. ${short}` : ''}. Opens your streak.`}>
      <StreakMobi lit={counted} size={26} className="tsk-pill__mobi" />
      <span className="tsk-pill__lead" aria-hidden="true">
        {body.days > 0 ? <><StreakTick days={body.days} from={from} className="tsk-pill__n" /><span>{body.days === 1 ? 'day' : 'days'}</span></> : <span>Start your streak</span>}
      </span>
      {short ? <span className="tsk-pill__today" aria-hidden="true">{short}</span> : null}
      <ChevronRight className="tsk-pill__chev" size={16} aria-hidden="true" />
    </button>
  );
}

const seenMoment = (at) => { try { return window.localStorage.getItem(momentKey(at)) === '1'; } catch { return true; } };
const keepMoment = (at) => { try { window.localStorage.setItem(momentKey(at), '1'); } catch { /* shows again on this device */ } };

export default function TodayStreak({ userId, hold = false }) {
  const { status, data: body, reload } = useStreak(userId);
  const phone = useMedia(PHONE_STREAK_MEDIA);
  const headerHasCount = phone && hasStreakChip(body);
  const prefs = useMobiPrefs();
  const [moment, setMoment] = useState(null);
  const [fresh, setFresh] = useState(false);
  const [landed, setLanded] = useState(true);
  const todayKey = body?.week?.[body.week.length - 1]?.day || null;
  const counted = Boolean(body?.today?.done);
  useEffect(() => {
    if (!counted || !todayKey || hold) return undefined;
    let seen = true;
    try { seen = window.localStorage.getItem(countedKey(todayKey)) === '1'; window.localStorage.setItem(countedKey(todayKey), '1'); } catch { /* shown still */ }
    if (seen || prefs.celebrations === 'off' || prefs.reduced) return undefined;
    // Today's piece swipes in (520 ms); Mobi lights as it lands, then the number rolls up one.
    const on = window.setTimeout(() => { setFresh(true); setLanded(false); }, 0);
    const lit = window.setTimeout(() => setLanded(true), 470);
    const off = window.setTimeout(() => setFresh(false), 1800);
    return () => { window.clearTimeout(on); window.clearTimeout(lit); window.clearTimeout(off); };
  }, [counted, todayKey, hold, prefs.celebrations, prefs.reduced]);
  const reached = body?.milestone && body.days - body.milestone.at <= 2 ? body.milestone : null;
  useEffect(() => {
    if (!reached || hold || prefs.celebrations === 'off') return undefined;
    const t = window.setTimeout(() => {
      if (seenMoment(reached.at)) return;
      keepMoment(reached.at);
      setMoment({ ...milestoneMoment(reached, body?.days), at: reached.at, play: prefs.celebrations === 'full' && !prefs.reduced });
    }, 0);
    return () => window.clearTimeout(t);
  }, [reached, body?.days, hold, prefs.celebrations, prefs.reduced]);

  const pill = <TodayHeadPill userId={userId} body={body} status={status} hold={hold} headerHasCount={headerHasCount} />;
  if (status === 'error' || (status === 'ready' && !body)) {
    // A failed read keeps a short block (17 Nov review): the week below does not jump, and the student can ask again.
    return (
      <>{pill}<section className="tsk tsk--failed" aria-labelledby="tsk-h">
        <header className="tsk__head"><h2 id="tsk-h" className="tsk__h">{STREAK_NAME}</h2></header>
        <p className="tsk__fail" role="status">Your streak did not load. <button type="button" className="tsk__open" onClick={reload}>Try again</button></p>
      </section></>
    );
  }
  if (!body || hold) {
    return (
      <>{pill}<section className="tsk tsk--wait" aria-busy="true" aria-labelledby="tsk-h">
        <header className="tsk__head"><h2 id="tsk-h" className="tsk__h">{STREAK_NAME}</h2></header>
        <div className="tsk__panel"><span /><span /><span /><span /></div>
        <p className="tsk__rule" aria-hidden="true">&nbsp;</p>
      </section></>
    );
  }
  const line = statusLine(body);
  const progress = todayProgress(body);
  const roll = fresh && body.days > 1;
  return (
    <>{pill}<section className="tsk" id="streak" aria-labelledby="tsk-h" data-fresh={fresh || undefined}>
      <header className="tsk__head">
        <h2 id="tsk-h" className="tsk__h">{STREAK_NAME}</h2>
      </header>
      {moment ? (
        <div className="tsk__moment" data-play={moment.play || undefined} role="status">
          <span className="tsk__stamp" aria-hidden="true">{moment.at}</span>
          <p><b>{moment.title}</b><span>{moment.text}</span></p>
        </div>
      ) : null}
      <div className="tsk__panel">
        {!headerHasCount ? (
          <button type="button" className="tsk__head-btn" onClick={() => openStreakSheet()}
            aria-label={body.days > 0 ? `${body.days === 1 ? '1 day' : `${body.days} days`} in a row${counted ? ', today counted' : ''}. Opens your streak.` : 'Your streak starts with one day. Opens your streak.'}>
            <StreakMobi lit={counted && landed} className="tsk__mobi" />
            {body.days > 0 ? (
              <span className="tsk__count" aria-hidden="true">
                <b className="tsk__n" data-roll={roll ? 'true' : undefined}>{roll ? <><span>{body.days - 1}</span><span>{body.days}</span></> : body.days}</b>
                <span className="tsk__unit">{body.days === 1 ? 'day in a row' : 'days in a row'}</span>
              </span>
            ) : <span className="tsk__count" aria-hidden="true"><span className="tsk__unit">Your streak starts with one day</span></span>}
          </button>
        ) : null}
        <StreakLine days={streakWeek(body)} progress={progress} fresh={fresh} label="Your last 7 days" />
        {/* 21 Nov 2026: the finish line with the week (the days to CUET); the pace line moved into the sheet's "What n days made". */}
        <FinishLine body={body} userId={userId} />
        {/* With a milestone's moment above, its own line already says the run's questions. */}
        <MadeLines body={body} userId={userId} run={!moment} pace={false} />
        <div className="tsk__keep">
          <p className="tsk__status" data-tone={line?.tone}>{line?.text}{line?.sub ? <span className="tsk__sub">{line.sub}</span> : null}</p>
          <KeepKey body={body} />
        </div>
        <PassSlots passes={body.passes} compact />
        <button type="button" className="tsk__foot tsk__foot-btn" onClick={() => openStreakSheet()} aria-describedby="tsk-rule">
          <span>Your month, passes and pause days</span><ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="tsk__rule" id="tsk-rule">{ruleLine(body.rule?.answers ?? body.today?.needed)}</p>
    </section></>
  );
}
