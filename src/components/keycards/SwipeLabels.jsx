'use client';
// The words a swiped card shows while it is dragged (LK137): one pill at the card's head says what letting go there does. Which
// one shows, and how strongly, is the card's own data-swipe-intent and --swipe-p (useRateSwipe.js), so a drag never re-renders.
// Hidden from assistive tech: the rating keys are the named way to rate.
import { Check, CheckCheck, RotateCcw } from 'lucide-react';
import { SWIPE_WORDS } from './rateSwipe.mjs';

export default function SwipeLabels() {
  return (
    <span className="kc-swipe" aria-hidden="true">
      <span className="kc-swipe__l" data-dir="right"><Check size={16} strokeWidth={2.8} />{SWIPE_WORDS.right}</span>
      <span className="kc-swipe__l" data-dir="left"><RotateCcw size={15} strokeWidth={2.4} />{SWIPE_WORDS.left}</span>
      <span className="kc-swipe__l" data-dir="down"><CheckCheck size={16} strokeWidth={2.8} />{SWIPE_WORDS.down}</span>
    </span>
  );
}
