import { X } from 'lucide-react';
import { DAILY_FIVE_SIZE } from '@/lib/dailyFive.mjs';
import { DAILY_HOW, DAILY_HOW_LABEL } from './dailyStripCopy.mjs';
import './daily-how.css';

// How the Daily Five works, shown (owner LK427, 23 Nov 2026: "fixing the UI and explanation"; a newcomer should get it in
// about three seconds). Three small pictures in the product's own marks, each with a few words (dailyStripCopy.mjs
// DAILY_HOW): an answer bubble crossed out, the five bubbles with that one back in the first place, the week's squares with
// today's filled. A server component with no script: nothing here moves. The demo in the card below plays the same story.

const WEEK = 7;
const PICTURES = {
  miss: (
    <span className="dhow-bubble dhow-bubble--wrong"><X size={15} strokeWidth={3.2} /></span>
  ),
  back: (
    <span className="dhow-five">
      {Array.from({ length: DAILY_FIVE_SIZE }, (_, i) => (
        <span key={i} className={`dhow-bubble${i === 0 ? ' dhow-bubble--back' : ''}`}>{i === 0 ? <X size={11} strokeWidth={3.4} /> : null}</span>
      ))}
    </span>
  ),
  streak: (
    <span className="dhow-week">
      {Array.from({ length: WEEK }, (_, i) => <span key={i} className={i === WEEK - 1 ? 'is-today' : undefined} />)}
    </span>
  ),
};

export default function DailyHow() {
  return (
    <ol className="dhow" aria-label={DAILY_HOW_LABEL}>
      {DAILY_HOW.map((step) => (
        <li key={step.id} className="dhow__step" data-step={step.id}>
          <span className="dhow__pic" aria-hidden="true">{PICTURES[step.id]}</span>
          <b className="dhow__title">{step.title}</b>
          <span className="dhow__line">{step.line}</span>
        </li>
      ))}
    </ol>
  );
}
