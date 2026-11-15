"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import {
  DAILY_FIVE_PATH, DAILY_FIVE_STORE, dayLabel, formatClock, leafOf, msUntilNextDay, readRecord, resultFor, streakOf, todayDaily, untilShort,
} from '@/lib/dailyFive.mjs';
import { DAILY_FIVE_ME_ROUTE, acceptAccount, runDays } from '@/lib/dailyFiveAccount.mjs';
import { DailyBoard, DailyClock, boardLabel, useDailyNow, useOnScreen } from './DailyParts';
import './daily-row.css';

// The doors to the Daily Five.
//   where="home"   the home page's block, under the sample card (16 Nov 2026; the owner: "It's not placed correctly as a
//                  proper clock. How do other websites do it?"). A daily puzzle's own entry, as the daily games draw it: the
//                  day on an ink page of a tear-off desk calendar (open or done, the date large, a real clock counting down to
//                  12:00 am IST), then the name and number, the board of five tiles and one full-width key (owner, 16 Nov,
//                  second note: bolder, its own identity, more room). The whole block is the link to /daily.
//                  It reads this device's record only (localStorage, nothing sent): not played (the clock reads "Closes in"),
//                  begun (the tiles answered so far, "Continue"), played (the day's tiles, the score, "Next five in").
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

function HomeBlock() {
  const ref = useRef(null);
  const record = useDeviceRecord();
  const on = useOnScreen(ref);
  const now = useDailyNow(on);
  const today = now === null ? null : todayDaily(now);
  const ready = Boolean(today && record);
  const result = ready ? resultFor(record, today.date, null) : null;
  const run = ready && !result && record.run && record.run.date === today.date ? record.run : null;
  const begun = Boolean(run && run.picks.some((p) => p !== null));
  const streak = ready ? streakOf(record.played, today.date).count : 0;
  const marks = result ? result.marks : run ? run.checks.map((c) => (c ? c.right : null)) : null;
  const state = result ? 'played' : begun ? 'begun' : 'open';

  const line = result
    ? `You scored ${result.score}/5 in ${formatClock(result.ms)}.${streak >= 2 ? ` Day ${streak} in a row.` : ''} A new five opens at 12:00 am.`
    : begun
      ? 'You’ve started today’s five. Your answers are kept; the clock is still running.'
      : streak >= 1
        ? `${streak === 1 ? 'You played yesterday.' : `You’re on a ${streak}-day run.`} Play today’s five to keep it going.`
        : 'Five CUET questions, the same for everyone today. Free, no sign-up.';
  const key = result ? 'See today’s result' : begun ? 'Continue today’s five' : 'Play today’s five';
  const leaf = today ? leafOf(today.date) : null;

  return (
    <>
    <Link
      href={DAILY_FIVE_PATH}
      className="dfh"
      data-state={state}
      ref={ref}
      aria-label={today ? `Daily Five, ${dayLabel(today.date)}, number ${today.day}. ${line} ${key}.` : 'Daily Five. Play today’s five.'}
    >
      {/* The day: an ink page of a tear-off desk calendar. Whether today's five is open, the date large, the clock. */}
      <div className="dfh__day" aria-hidden="true">
        <p className="dfh__live" data-on={result ? 'false' : 'true'}><i />{result ? 'Done for today' : begun ? 'In progress' : 'Open now'}</p>
        <div className="dfh__date">
          <b>{leaf ? leaf.day : '\u00a0'}</b>
          <span><em>{leaf ? leaf.month : '\u00a0'}</em><small>{today ? dayLabel(today.date).split(',')[0] : '\u00a0'}</small></span>
        </div>
        <DailyClock ms={now === null ? null : msUntilNextDay(now)} label={result ? 'Next five in' : 'Closes in'} size="l" />
      </div>
      {/* The five: the name and number, what it is, the board, the one key. */}
      <div className="dfh__body" aria-hidden="true">
        <div className="dfh__head">
          <p className="dfh__name">Daily Five</p>
          <span className="dfh__no">{today ? `No. ${today.day}` : '\u00a0'}</span>
        </div>
        <p className="dfh__line">{line}</p>
        <ul className="dfh__chips">
          <li>A new five every day at 12:00 am</li>
          <li>English and General Test</li>
          <li>Every answer explained</li>
        </ul>
        <DailyBoard marks={marks} size="l" label={boardLabel(marks)} />
        <span className="dfh__key" data-quiet={result ? 'true' : 'false'}>{key}</span>
      </div>
    </Link>
    {/* The week's other fixed date, said once and plainly: the daily five, and the Sunday Mock. */}
    <p className="dfh__also">
      Every Sunday, 10:00 am to 10:00 pm: one full CUET paper in each of your subjects, free with an account.{' '}
      <Link href="/sunday-mock">See the Sunday Mock</Link>
    </p>
    </>
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
      <span className="tmask__text"><b>Daily Five{today ? <span className="dfr__no"> · No. {today.day}</span> : null}</b><span>{line}</span></span>
      <ChevronRight className="tmask__go" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

export default function DailyFiveRow({ where = 'home' }) {
  return where === 'today' ? <TodayRow /> : <HomeBlock />;
}
