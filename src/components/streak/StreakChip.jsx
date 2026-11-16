"use client";
// The daily streak in the signed-in top bar (17 Nov 2026, LK296 S1): the account capsule's first door (the bar is full on a
// 360 px phone, so it joins the capsule rather than adding a pill), one bubble and the number, opening the streak sheet. Filled volt once today counts, a ring until then (a real state, never a pulse). It steps aside where the page itself shows
// the streak (Today and You, and the Mob den with its own chip), so the number is never on one screen twice, and while the
// streak is 0 (Today says how it starts). A failed read draws nothing.
import { chipLabel } from '@/lib/streak/streakCopy.mjs';
import { openStreakSheet, useStreak } from './useStreak';
import './streak.css';

/** Where the page shows the streak itself (the chip would repeat it). */
export const PAGES_WITH_STREAK = ['/today', '/profile', '/mob'];
export const chipHiddenOn = (path) => PAGES_WITH_STREAK.some((p) => path === p || String(path || '').startsWith(`${p}/`));

export default function StreakChip({ userId, path }) {
  const { data: body } = useStreak(userId, path);
  if (!body || chipHiddenOn(path) || !(body.days > 0)) return null;
  const done = Boolean(body.today?.done);
  return (
    <>
      <button type="button" className="stk-chip arena-acct__streak" aria-label={chipLabel(body.days, done)} onClick={() => openStreakSheet()} data-tour="streak-chip">
        {/* The OMR bubble holds the number: volt once today counts, an ink ring until then. */}
        <b className="stk-chip__n" data-done={done || undefined} data-wide={body.days > 99 || undefined} aria-hidden="true">{body.days}</b>
        <span className="stk-chip__unit" aria-hidden="true">{body.days === 1 ? 'day' : 'days'}</span>
      </button>
      <span className="arena-acct__rule" aria-hidden="true" />
    </>
  );
}
