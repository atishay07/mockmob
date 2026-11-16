"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import {
  DAILY_FIVE_PATH, DAILY_FIVE_STORE, dayLabel, formatClock, leafOf, msUntilNextDay, readRecord, resultFor, streakOf, todayDaily, untilShort,
} from '@/lib/dailyFive.mjs';
import { DAILY_FIVE_ME_ROUTE, acceptAccount, runDays } from '@/lib/dailyFiveAccount.mjs';
import { sundayState, sundayWindow } from '@/lib/sundayMock.mjs';
import { useOnScreen } from './DailyParts';
import { dailyRow, sundayRow } from './dailyStripCopy.mjs';
import './daily-row.css';

// The doors to the Daily Five.
//   where="home"   the home page's strip (16 Nov 2026, evening; the owner, after seeing the two full calendar pages live on his
//                  phone: "consuming too much vertical space", "it should not be at the top"). Two short rows low on the page,
//                  under the exam screen: the day on a small ink leaf, the name, one sentence that says what it is, when it
//                  closes or opens, and where the tap goes. The Daily Five's row reads this device's record only (localStorage,
//                  nothing sent): not played, begun (the five small squares so far) or played (the score, the next five).
//                  The Sunday Mock's row carries the coming Sunday's date. Each whole row is its link. No number of the day:
//                  "No. 2" told a reader nothing (owner, same note).
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

/** The day on a small ink leaf: the number, the month in volt, the weekday. Holds its size before the date is known. */
function Leaf({ date }) {
  const leaf = date ? leafOf(date) : null;
  return (
    <span className="dfs__leaf" aria-hidden="true">
      <b>{leaf ? leaf.day : '\u00a0'}</b>
      <em>{leaf ? leaf.month : '\u00a0'}</em>
      <small>{leaf ? leaf.weekday : '\u00a0'}</small>
    </span>
  );
}

function HomeStrip() {
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
  const marks = result ? result.marks : begun ? run.checks.map((c) => (c ? c.right : null)) : null;
  const daily = dailyRow({ result: result ? { score: result.score, clock: formatClock(result.ms) } : null, begun, streak, waitMs: now === null ? null : msUntilNextDay(now) });

  const state = now === null ? null : sundayState(now);
  const open = state?.phase === 'open';
  const sunDate = !state ? null : state.phase === 'closed' ? state.next : state.week;
  const sunday = sundayRow({ open, waitMs: !state || open ? null : sundayWindow(sunDate).opensAt - now, known: Boolean(state) });

  return (
    <div className="dfs" ref={ref}>
      <Link href={DAILY_FIVE_PATH} className="dfs__row" data-state={daily.state} aria-label={`Daily Five${today ? `, ${dayLabel(today.date)}` : ''}. ${daily.line} ${daily.when}. ${daily.go}.`}>
        <Leaf date={today?.date} />
        <span className="dfs__body" aria-hidden="true">
          <span className="dfs__top"><b className="dfs__name">Daily Five</b>{marks ? <Mark marks={marks} /> : null}</span>
          <span className="dfs__line">{daily.line}</span>
          <span className="dfs__foot"><span className="dfs__when">{daily.when || '\u00a0'}</span><span className="dfs__go">{daily.go}</span></span>
        </span>
      </Link>
      <Link href="/sunday-mock" className="dfs__row" data-page="sunday" aria-label={`Sunday Mock${sunDate ? `, ${dayLabel(sunDate)}` : ''}. ${sunday.line} ${sunday.when}. ${sunday.go}.`}>
        <Leaf date={sunDate} />
        <span className="dfs__body" aria-hidden="true">
          <span className="dfs__top"><b className="dfs__name">Sunday Mock</b></span>
          <span className="dfs__line">{sunday.line}</span>
          <span className="dfs__foot"><span className="dfs__when">{sunday.when || '\u00a0'}</span><span className="dfs__go">{sunday.go}</span></span>
        </span>
      </Link>
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
  return where === 'today' ? <TodayRow /> : <HomeStrip />;
}
