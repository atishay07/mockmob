'use client';
// "Show answers" (LK139, 5 Nov 2026: "Show Answer: this toggle is broken. It is very weird."). It was a switch whose on state was a
// white pill with a dark knob and a stray tick, and whose off state read as an empty grey blob, so it was hard to tell what it did or
// whether it had. Now it is a plain key that says what it will do: "Show answers" with an eye, then "Hide answers" with the eye
// shut, and while answers are shown it sits filled. One tap opens every card's NCERT line in the list below; a row's own Show
// still opens one line.
import { Eye, EyeOff } from 'lucide-react';

export default function AnswersKey({ on, onChange, controls }) {
  return (
    <button type="button" className="l2c-answers" data-on={on || undefined} aria-controls={controls} onClick={() => onChange(!on)}>
      {on ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
      <span>{on ? 'Hide answers' : 'Show answers'}</span>
    </button>
  );
}
