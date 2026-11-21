"use client";
// The streak sheet opens from the first door of the signed-in account capsule. On phones, Today puts the count here
// and keeps a separate summary of today's status. The other streak pages lead with their own count.
import { useMedia } from '@/lib/useMedia';
import { chipLabel } from '@/lib/streak/streakCopy.mjs';
import { openStreakSheet, useStreak, useStreakGrow } from './useStreak';
import { StreakMobi, StreakTick } from './Streak';
import './streak.css';

export const PHONE_STREAK_MEDIA = '(max-width: 639px)';
export const PAGES_WITH_STREAK = ['/today', '/profile', '/mob', '/progress'];
export const chipHiddenOn = (path, phone) => PAGES_WITH_STREAK.some(
  (page) => !(phone && page === '/today') && (path === page || path?.startsWith(`${page}/`)),
);
export const hasStreakChip = (body) => Boolean(body && !body.hidden && body.days > 0);

export default function StreakChip({ userId, path }) {
  const phone = useMedia(PHONE_STREAK_MEDIA);
  const off = chipHiddenOn(path, phone);
  const { status, data: body } = useStreak(off ? null : userId, path);
  // The moment it grows (21 Nov 2026): the number steps up once and Mobi lights, when it rose since this device last saw it.
  const from = useStreakGrow(userId, body, !off && Boolean(body) && !body?.hidden);
  if (off || !userId) return null;
  if (!body) return status === 'loading' ? <><span className="stk-chip stk-chip--wait" aria-hidden="true" /><span className="arena-acct__rule" aria-hidden="true" /></> : null;
  // "Hide my streak" (W-063) hides the chip too: Today and You still show it to the student.
  if (!hasStreakChip(body)) return null;
  const done = Boolean(body.today?.done);
  return (
    <>
      <button type="button" className="stk-chip arena-acct__streak" aria-label={chipLabel(body.days, done)} onClick={() => openStreakSheet()} data-tour="streak-chip" data-grow={from !== null || undefined}>
        {/* The streak's mark (18 Nov 2026): Mobi asleep until today counts, lit once it does; then the number. */}
        <StreakMobi lit={done} size={24} className="stk-chip__mobi" />
        <span aria-hidden="true"><StreakTick days={body.days} from={from} className="stk-chip__days" /></span>
        <span className="stk-chip__unit" aria-hidden="true">{body.days === 1 ? 'day' : 'days'}</span>
      </button>
      <span className="arena-acct__rule" aria-hidden="true" />
    </>
  );
}
