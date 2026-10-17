"use client";
// The Mob on Today (W-062: the social loop on the main surfaces). One slim row under This week, only when the student is
// in a Mob and the Mob is on (MOB_ENABLED): how many sat this week's paper and when it closes, opening the Mob. No card,
// no ring and no Mobi here: the ring and the members live on /mob and Progress, and the ring-complete cheer is the
// week's one Mobi moment (TodayWeek). A failed or empty read draws nothing; /mob says why and retries.
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const closesOn = (iso) => {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  try { return new Date(t).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' }); } catch { return ''; }
};

/** `mob`: the page's useMob state (read once for this row and the week's Mobi moment). */
export default function TodayMob({ enabled, mob }) {
  const data = mob?.status === 'ready' ? mob.mob : null;
  if (!enabled || !data?.week || !(data.week.size > 0)) return null;
  const { week } = data;
  const name = (data.mobs || []).length > 1 && data.subjectName ? `Your ${data.subjectName} Mob` : 'Your Mob';
  const day = closesOn(week.closesAt);
  const sat = `${week.sat} of ${week.size} sat this week's paper`;
  const tail = week.closed ? 'This week is closed; a new paper opens Monday.'
    : week.youSat ? 'You sat yours.'
      : day ? `Yours closes ${day}.` : 'Yours is still open.';
  return (
    <section className="tmob" aria-label={name}>
      <Link className="tmob__row" href="/mob" aria-label={`${name}: ${sat}. ${tail} Open your Mob.`}>
        <span className="tmob__ring" aria-hidden="true">
          {Array.from({ length: Math.min(week.size, 5) }, (_, i) => <i key={i} data-on={i < week.sat || undefined} />)}
        </span>
        <span className="tmob__text" aria-hidden="true">
          <b>{name}</b>
          <span>{sat}. {tail}</span>
        </span>
        <ChevronRight className="tr__chev" size={20} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </section>
  );
}
