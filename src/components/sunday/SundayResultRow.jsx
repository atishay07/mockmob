"use client";
// After a Sunday Mock paper, one quiet row on the result in the place a Mob paper's row takes (MobResultRow).
//   held   (before 10:00 PM) the student's other subjects still open today, when there are any: a link to the Sunday Mock page
//   open   (after the close) "N students sat this paper." and the next Sunday. Never a rank, a percentile or a place.
// The share under each question is drawn by the result's Answer by answer rows (useSundayStats there).
import { useEffect } from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { addDays, satLine, sundayWeekOf, timeLabel, windowLine } from '@/lib/sundayMock.mjs';
import { forgetSunday, useSunday } from './useSunday';
import ClassResultLine from '@/components/class/ClassResultLine';
import './sunday.css';

export function SundayResultRow({ attempt, stats = null }) {
  const week = sundayWeekOf(attempt);
  const held = Boolean(attempt?.mobHold);
  // A paper was just sent: Today's card and Practice's chip read the week again rather than say "Resume".
  useEffect(() => { if (week) forgetSunday(); }, [week]);
  const sunday = useSunday(held);
  if (!week) return null;
  if (held) {
    // Held means it is that Sunday before 10:00 PM, so the status read now is the same week's.
    const open = sunday.status === 'ready' && sunday.data?.phase === 'open' ? (sunday.data.subjects || []).filter((s) => s.state === 'open' || s.state === 'started') : [];
    if (!open.length) return null;
    return (
      <section className="sun-res" aria-label="Sunday Mock">
        <span className="sun-mark" aria-hidden="true"><CalendarClock size={22} strokeWidth={1.6} /></span>
        <span className="sun-res__text">
          <b>{open.length === 1 ? `${open[0].name} is still open today` : 'Your other subjects are still open today'}</b>
          <span>{`One sitting a subject, until ${timeLabel(Date.parse(sunday.data.closesAt))}.`}</span>
        </span>
        <Link className="sun-key" href="/sunday">{open.length > 1 ? 'Choose a subject' : open[0].state === 'started' ? 'Resume' : 'Sit it'}</Link>
      </section>
    );
  }
  const sat = stats && Number.isInteger(stats.sat) ? satLine(stats.sat) : '';
  return (
    <>
    <section className="sun-res" aria-label="Sunday Mock">
      <span className="sun-mark" aria-hidden="true"><CalendarClock size={22} strokeWidth={1.6} /></span>
      <span className="sun-res__text">
        <b>{sat || 'Sunday Mock'}</b>
        <span>{`The next one: ${windowLine(addDays(week, 7))}.`}</span>
      </span>
      <Link className="sun-link" href="/sunday">Sunday Mock</Link>
    </section>
    {/* Class leagues (16 Nov 2026): the class's line once the answers are open; nothing while CLASS_LEAGUES_ENABLED is off. */}
    <ClassResultLine week={week} subject={attempt?.subject || null} />
    </>
  );
}
