"use client";
// The streak on You's card (19 Nov 2026, lane arena-b): the streak's own Mobi (asleep until today counts, lit once it does) with the
// days, opening the streak sheet as the top bar chip and Today do. The one shared read (useStreak), so the number is the same
// everywhere. Hidden when the student chose Hide my streak, and nothing when the read failed; then `fallback` (the greeting Mobi)
// keeps the card's corner, so there is only ever one Mobi on the card.
import { StreakMobi } from '@/components/streak/Streak';
import { openStreakSheet, useStreak } from '@/components/streak/useStreak';
import { cardStreak } from './youModel.mjs';

export default function YouStreak({ userId, fallback = null }) {
  const { status, data } = useStreak(userId);
  const shown = cardStreak(status, data);
  if (shown === 'wait') return <span className="you-streak you-streak--wait skeleton" aria-hidden="true" />;
  if (!shown) return fallback;
  return (
    <button type="button" className="you-streak" data-lit={shown.lit || undefined} aria-label={shown.label} onClick={() => openStreakSheet()}>
      <StreakMobi lit={shown.lit} size={40} className="you-streak__mobi" />
      {shown.days > 0 ? (
        <span className="you-streak__text" aria-hidden="true"><b>{shown.days}</b><span>{shown.word}</span></span>
      ) : (
        <span className="you-streak__text you-streak__text--name" aria-hidden="true"><span>{shown.word}</span></span>
      )}
    </button>
  );
}
