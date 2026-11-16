"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronRight } from 'lucide-react';
import {
  DAILY_FIVE_PATH, DAILY_FIVE_STORE, formatClock, istDateKey, msUntilNextDay, nextIndex, readRecord, resultFor, streakOf, todayDaily, untilShort,
} from '@/lib/dailyFive.mjs';
import { DAILY_FIVE_ME_ROUTE, acceptAccount, runDays } from '@/lib/dailyFiveAccount.mjs';
import { Icon } from '@/components/ui/Icons';
import { useOnScreen } from './DailyParts';
import { dailyRow, railLabel, sundayRow, weekRail } from './dailyStripCopy.mjs';
import './daily-row.css';

// The doors to the Daily Five.
//   where="home"   the home page's block, low on the page under the exam screen (16 Nov 2026, 10:25 pm; the owner, of the two
//                  short rows before it: "a very small subsection, not something important ... the visual hierarchy is not
//                  here"). One composition in about one phone screen: the week as seven calendar leaves (today's in ink, a tick
//                  on each day this device has finished its five, the Sunday carrying the Mock), then the Daily Five's card
//                  (the lead) and the Sunday Mock's, each with its state and time largest, the name and one sentence, three
//                  figures and one key. The words are dailyStripCopy.mjs's. The Daily Five reads this device's record only
//                  (localStorage, nothing sent): not played, begun (the question the student is on) or played (the score and
//                  the run). The block carries one volt key: the Sunday Mock's while its paper is open, else the Daily Five's.
//                  No number of the day: "No. 2" told a reader nothing (owner, same evening).
//   where="today"  on Today for a signed-in student, under the lead card's rows, drawn as Today's Ask Mobi row (today.css
//                  .tmask). It reads the account (GET /api/daily/me): today's score and the run of days are the account's, so a
//                  five played on another phone shows here too; while the account has not answered (or cannot), the device's
//                  record stands in.
// The first paint has no date and no record (the server has neither): every part holds its size and fills in once.

const readDevice = () => {
  let record = null;
  try { record = readRecord(window.localStorage.getItem(DAILY_FIVE_STORE)); } catch { record = readRecord(null); }
  return record;
};

/** This device's record, read after the first paint and again when the tab or the page comes back (a five just played). */
function useDeviceRecord() {
  const [record, setRecord] = useState(null);
  const read = useCallback(() => setRecord(readDevice()), []);
  useEffect(() => {
    const t = window.setTimeout(read, 0);
    const back = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('pageshow', read);
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', back); window.removeEventListener('pageshow', read); };
  }, [read]);
  return record;
}

/** Five small squares: hollow until today is played, then the day's own row (filled for right). */
function Mark({ marks }) {
  return (
    <span className="dfr__mark" aria-hidden="true">
      {(marks || [false, false, false, false, false]).map((right, i) => <i key={i} data-right={marks && right ? 'true' : 'false'} />)}
    </span>
  );
}

/** The clock, read once after the first paint and then twice a minute while the strip is near the screen. */
function useMinuteNow(active) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    const back = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', back);
    return () => { window.clearTimeout(t); window.clearInterval(id); document.removeEventListener('visibilitychange', back); };
  }, [active]);
  return now;
}

/** The week rail: Monday to Sunday as seven calendar leaves. A picture with real data (one sentence for a screen reader). */
function WeekRail({ days }) {
  const leaves = days || Array.from({ length: 7 }, (_, i) => ({ date: `blank-${i}`, blank: true }));
  return (
    <div className="dwk-rail" role="img" aria-label={days ? railLabel(days) : 'This week'}>
      {leaves.map((d) => (
        <span key={d.date} className="dwk-leaf" data-today={d.today ? 'true' : undefined} data-played={d.played ? 'true' : undefined}
          data-sunday={d.carries === 'Mock' ? 'true' : undefined} aria-hidden="true">
          <span className="dwk-leaf__wd">{d.blank ? '\u00a0' : d.short}</span>
          <b className="dwk-leaf__day">{d.blank ? '\u00a0' : d.day}</b>
          <span className="dwk-leaf__foot">
            {d.played ? <span className="dwk-leaf__tick"><Icon name="check" /></span> : null}
            {d.blank ? '\u00a0' : d.carries}
          </span>
        </span>
      ))}
    </div>
  );
}

/** One of the two cards: the state and its time on the calendar's ink top, then the name, one sentence, three figures, one key. */
function RhythmCard({ id, kind, name, row, mark, ink, lead }) {
  return (
    <article className="dwk-card" data-kind={kind} data-state={row.state || row.phase} aria-labelledby={id}>
      <p className="dwk-band" data-ink={ink ? 'true' : 'false'}>
        <i className="dwk-mark" data-mark={mark} aria-hidden="true">
          {mark === 'done' ? <Icon name="check" /> : mark === 'soon' ? <CalendarClock size={16} strokeWidth={2} /> : null}
        </i>
        <span className="dwk-band__words">
          <span className="dwk-status">{row.status || '\u00a0'}</span>
          <span className="dwk-when">{row.when || '\u00a0'}</span>
        </span>
      </p>
      <div className="dwk-body">
        <h3 className="dwk-name" id={id}>{name}</h3>
        <p className="dwk-line">{row.line}</p>
        <ul className="dwk-figs">
          {row.figures.map((f) => <li key={f.figure + f.unit}><b>{f.figure}</b>{f.unit ? <span>{f.unit}</span> : null}</li>)}
        </ul>
        <Link href={row.href} className="dwk-key" data-lead={lead ? 'true' : 'false'}>{row.go}</Link>
      </div>
    </article>
  );
}

function HomeBlock() {
  const ref = useRef(null);
  const record = useDeviceRecord();
  const on = useOnScreen(ref, '400px 0px');
  const now = useMinuteNow(on);
  const today = now === null ? null : todayDaily(now);
  const ready = Boolean(today && record);
  const result = ready ? resultFor(record, today.date, null) : null;
  const run = ready && !result && record.run && record.run.date === today.date ? record.run : null;
  const begun = Boolean(run && run.picks.some((p) => p !== null));
  const streak = ready ? streakOf(record.played, today.date).count : 0;
  const daily = dailyRow({
    result: result ? { score: result.score, clock: formatClock(result.ms) } : null,
    begun, at: begun ? nextIndex(run.picks) + 1 : null, streak, waitMs: now === null ? null : msUntilNextDay(now),
  });
  const sunday = sundayRow({ now });
  const days = today ? weekRail(ready ? record.played : [], istDateKey(now)) : null;
  // One volt key in the block: the Sunday Mock's while a paper can be started (12 hours a week), else the Daily Five's.
  return (
    <div className="dwk" ref={ref}>
      <WeekRail days={days} />
      <div className="dwk-cards">
        <RhythmCard id="dwk-daily" kind="daily" name="Daily Five" row={daily} ink lead={!sunday.open}
          mark={daily.state === 'played' ? 'done' : today ? 'open' : 'none'} />
        <RhythmCard id="dwk-sunday" kind="sunday" name="Sunday Mock" row={sunday} ink={sunday.open} lead={sunday.open}
          mark={sunday.open ? 'open' : sunday.phase === 'unknown' ? 'none' : 'soon'} />
      </div>
    </div>
  );
}

function TodayRow() {
  const record = useDeviceRecord();
  const [account, setAccount] = useState(null);
  const [now, setNow] = useState(null);
  useEffect(() => {
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => { window.clearTimeout(t); window.clearInterval(id); };
  }, []);
  const today = now === null ? null : todayDaily(now);
  const date = today?.date || null;
  useEffect(() => {
    if (!date) return undefined;
    let alive = true;
    fetch(DAILY_FIVE_ME_ROUTE, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { const acc = acceptAccount(body); if (alive && acc && acc.date === date) setAccount(acc); })
      .catch(() => {});
    return () => { alive = false; };
  }, [date]);

  const ready = Boolean(today && record);
  const fromAccount = ready && account && account.date === today.date;
  const result = !ready ? null : fromAccount ? account.record : resultFor(record, today.date, null);
  const streak = !ready ? 0 : fromAccount
    ? streakOf(runDays(account.played, today.date, Boolean(result)), today.date).count
    : streakOf(record.played, today.date).count;
  const wait = now === null ? '' : untilShort(msUntilNextDay(now));
  const line = !ready ? ' ' : result
    ? `Played today: ${result.score}/5 in ${formatClock(result.ms)}.${streak >= 2 ? ` Day ${streak} in a row.` : ''} Next five in ${wait}.`
    : `${streak >= 2 ? `${streak} days in a row so far.` : streak === 1 ? 'You played yesterday.' : 'Five questions, the same for everyone.'} Today’s five closes in ${wait}.`;
  return (
    <Link href={DAILY_FIVE_PATH} className="tmask dfr dfr--today" data-played={result ? 'true' : 'false'}>
      <Mark marks={result?.marks} />
      <span className="tmask__text"><b>Daily Five</b><span>{line}</span></span>
      <ChevronRight className="tmask__go" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

export default function DailyFiveRow({ where = 'home' }) {
  return where === 'today' ? <TodayRow /> : <HomeBlock />;
}
