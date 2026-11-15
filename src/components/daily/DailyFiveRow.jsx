"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DAILY_FIVE_PATH, DAILY_FIVE_STORE, formatClock, readRecord, resultOn, shortDate, streakOf, todayDaily } from '@/lib/dailyFive.mjs';
import './daily-row.css';

// The doors to the Daily Five (15 Nov 2026, lane F-A): one quiet row, the whole row the link to /daily, never volt (each screen
// keeps its own one volt key).
//   where="home"   on the home page, right under the sample card (inside the desk, in the card's column)
//   where="today"  on Today for a signed-in student, under the lead card's rows, drawn as Today's Ask Mobi row (today.css .tmask)
// It reads this device's Daily Five record (localStorage, nothing sent): not played today, or today's score and time, and the run
// of days. The first paint has no date and no record (the server has neither), so the row holds its place and fills in once.

const readToday = () => {
  const today = todayDaily(Date.now());
  let record = null;
  try { record = readRecord(window.localStorage.getItem(DAILY_FIVE_STORE)); } catch { record = readRecord(null); }
  const result = resultOn(record, today.date);
  const streak = streakOf(record.played, today.date);
  return { date: today.date, result, streak: streak.count };
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
  const [now, setNow] = useState(null);
  useEffect(() => {
    const t = window.setTimeout(() => setNow(readToday()), 0);
    return () => window.clearTimeout(t);
  }, []);
  const result = now?.result || null;
  const run = now && now.streak >= 2 ? ` Day ${now.streak} in a row.` : '';

  if (where === 'today') {
    const line = !now ? ' ' : result
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
        <span>{!now ? ' ' : result ? `You scored ${result.score}/5 in ${formatClock(result.ms)}. A new five opens at 12:00 am.` : 'Five questions, the same for everyone today. No sign-up.'}</span>
      </span>
      <ChevronRight className="dfr__go" size={18} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
