"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DAILY_FIVE_PATH, DAILY_FIVE_STORE, formatClock, readRecord, resultFor, shortDate, streakOf, todayDaily } from '@/lib/dailyFive.mjs';
import { DAILY_FIVE_ME_ROUTE, acceptAccount, runDays } from '@/lib/dailyFiveAccount.mjs';
import './daily-row.css';

// The doors to the Daily Five (15 Nov 2026, lane F-A): one quiet row, the whole row the link to /daily, never volt (each screen
// keeps its own one volt key).
//   where="home"   on the home page, right under the sample card (inside the desk, in the card's column)
//   where="today"  on Today for a signed-in student, under the lead card's rows, drawn as Today's Ask Mobi row (today.css .tmask)
// Home reads this device's Daily Five record (localStorage, nothing sent). Today reads the account (GET /api/daily/me, lane
// daily): today's score and the run of days are the account's, so a five played on another phone shows here too; while the
// account has not answered (or cannot), the device's record stands in. The first paint has no date and no record (the server
// has neither), so the row holds its place and fills in once.

const readDevice = () => {
  const today = todayDaily(Date.now());
  let record = null;
  try { record = readRecord(window.localStorage.getItem(DAILY_FIVE_STORE)); } catch { record = readRecord(null); }
  return { date: today.date, day: today.day, record };
};

/** Five small squares: hollow until today is played, then the day's own row (filled for right). */
function Mark({ marks }) {
  return (
    <span className="dfr__mark" aria-hidden="true">
      {(marks || [false, false, false, false, false]).map((right, i) => <i key={i} data-right={marks && right ? 'true' : 'false'} />)}
    </span>
  );
}

export default function DailyFiveRow({ where = 'home' }) {
  const [device, setDevice] = useState(null);
  const [account, setAccount] = useState(null);
  useEffect(() => {
    const t = window.setTimeout(() => setDevice(readDevice()), 0);
    return () => window.clearTimeout(t);
  }, []);
  const date = device?.date || null;
  useEffect(() => {
    if (where !== 'today' || !date) return undefined;
    let alive = true;
    fetch(DAILY_FIVE_ME_ROUTE, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { const acc = acceptAccount(body); if (alive && acc && acc.date === date) setAccount(acc); })
      .catch(() => {});
    return () => { alive = false; };
  }, [where, date]);

  const now = device ? (() => {
    if (account) {
      const result = account.record;
      return { date: device.date, result, streak: streakOf(runDays(account.played, device.date, Boolean(result)), device.date).count };
    }
    const result = resultFor(device.record, device.date, null);
    return { date: device.date, result, streak: streakOf(device.record.played, device.date).count };
  })() : null;
  const result = now?.result || null;
  const run = now && now.streak >= 2 ? ` Day ${now.streak} in a row.` : '';

  if (where === 'today') {
    const line = !now ? ' ' : result
      ? `Played today: ${result.score}/5 in ${formatClock(result.ms)}.${run}`
      : `Not played today. Five questions, the same for everyone.${now.streak ? ` ${now.streak === 1 ? 'You played yesterday.' : `${now.streak} days in a row so far.`}` : ''}`;
    return (
      <Link href={DAILY_FIVE_PATH} className="tmask dfr dfr--today" data-played={result ? 'true' : 'false'}>
        <Mark marks={result?.marks} />
        <span className="tmask__text"><b>Daily Five</b><span>{line}</span></span>
        <ChevronRight className="tmask__go" size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Link href={DAILY_FIVE_PATH} className="dfr dfr--home" data-played={result ? 'true' : 'false'}>
      <Mark marks={result?.marks} />
      <span className="dfr__text">
        <b>Today’s Daily Five{now ? <span className="dfr__date"> · {shortDate(now.date)}</span> : null}</b>
        <span>{!now ? ' ' : result ? `You scored ${result.score}/5 in ${formatClock(result.ms)}. A new five opens at 12:00 am.` : 'Five questions, the same for everyone today. No sign-up.'}</span>
      </span>
      <ChevronRight className="dfr__go" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
