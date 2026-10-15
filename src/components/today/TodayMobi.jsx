"use client";

// Today's one Mobi, beside the hero and never over its text. His entrance follows the app's rules
// (src/lib/mobiRation.js): a wave the first time today, asleep late at night, otherwise he is simply there.
// On a student's first visit he introduces himself once, in one line; after that he says nothing here.
// Both gates are asked once, after mount, never during render.
import MobiReact from '@/components/brand/MobiReact';
import { useMobiGate } from '@/lib/mobiHooks';
import { greeting } from '@/lib/mobiRation';
import './today.css';

const INTRO_KEY = 'mm:mobi-intro:v1';
export const INTRO_LINE = "I'm Mobi. I'll read every mock with you.";

/** True the first time on this device (then remembered). Storage blocked: true once per page run. */
let introducedThisRun = false;
function introduceOnce() {
  try {
    if (window.localStorage.getItem(INTRO_KEY) === '1') return false;
    window.localStorage.setItem(INTRO_KEY, '1');
    return true;
  } catch {
    if (introducedThisRun) return false;
    introducedThisRun = true;
    return true;
  }
}

export default function TodayMobi({ first = false }) {
  const act = useMobiGate(() => greeting('today', 'idle'), 'idle');
  const intro = useMobiGate(() => (first ? introduceOnce() : false), false);
  return (
    <div className="tm__mobi">
      <MobiReact act={act} size={96} interactive label="Mobi" />
      {intro ? <p className="tm__say" role="status">{INTRO_LINE}</p> : null}
    </div>
  );
}
