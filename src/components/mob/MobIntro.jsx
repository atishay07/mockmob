"use client";
// The Mob's first impression, shared by the no-Mob page (/mob) and the invite page (/join/<code>). Calm and real: every
// number is a rule of the Mob (10 questions, 10 minutes, no credits, closes Sunday 11:59 PM IST, 5 seats), never a count
// of other people. Design notes (AGENT_RULES): one primary action per screen (rule 7); value before the account wall
// (T003); the seat picture shows your own Mob-to-be, or the seats an invite really has, never invented members (rule 5,
// P1, P3: no names on the public page); sharing is said plainly before anyone joins (rule 14). Motion: the seats ink once
// on mount (220 ms, 60 ms step, --mm-ease-out), static under reduced motion.
import { CLOSES_LINE, MAX_MEMBERS, PAPER_COUNT, PAPER_SECONDS } from '@/lib/mob/model.mjs';

const R = 50;
const C = 60;
const GAP = 9;
const polar = (deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + R * Math.cos(a), C + R * Math.sin(a)];
};
const arc = (start, end) => {
  const [x1, y1] = polar(start);
  const [x2, y2] = polar(end);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${end - start > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/**
 * Five seats around a circle. `taken` seats are filled (no names), `you` (optional: { initial, colour }) sits in the
 * first open seat in your colour. The centre says what the picture means in two words.
 */
export function MobSeats({ taken = 0, you = null, label, size = 'lg' }) {
  const step = 360 / MAX_MEMBERS;
  const filled = Math.max(0, Math.min(MAX_MEMBERS, taken));
  const mine = you && filled < MAX_MEMBERS ? filled : -1;
  const open = MAX_MEMBERS - filled - (mine >= 0 ? 1 : 0);
  return (
    <figure className={`mob-seats mob-seats--${size}`}>
      <svg viewBox="0 0 120 120" className="mob-seats__svg" role="img" aria-label={label}>
        {Array.from({ length: MAX_MEMBERS }, (_, i) => {
          const d = arc(i * step + GAP / 2, (i + 1) * step - GAP / 2);
          const state = i < filled ? 'taken' : i === mine ? 'you' : 'open';
          return (
            <path key={i} d={d} pathLength="1" className={`mob-seats__seat mob-seats__seat--${state}`}
              data-colour={state === 'you' ? you.colour : undefined} style={{ '--mob-ink-delay': `${i * 60}ms` }} />
          );
        })}
      </svg>
      <div className="mob-seats__centre" aria-hidden="true">
        {you ? <span className="mob-disc mob-seats__disc" data-colour={you.colour}>{you.initial}</span> : <b>{filled} of {MAX_MEMBERS}</b>}
        <span>{you ? (open === 1 ? '1 seat for a friend' : `${open} seats for friends`) : 'seats taken'}</span>
      </div>
    </figure>
  );
}

/** The paper in four numbers. Each is a rule of the Mob, the same for every member. */
export function PaperFacts({ className = '' }) {
  const facts = [
    { value: String(PAPER_COUNT), label: 'questions, the same for everyone' },
    { value: `${PAPER_SECONDS / 60} min`, label: 'on the clock' },
    { value: '0', label: 'credits, on any plan' },
    { value: 'Sun 11:59 PM', label: 'the week\'s paper closes' },
  ];
  return (
    <dl className={`mob-facts ${className}`.trim()} aria-label={`The weekly paper: ${PAPER_COUNT} questions, ${PAPER_SECONDS / 60} minutes, no credits. ${CLOSES_LINE}.`}>
      {facts.map((f) => (
        <div key={f.label} className="mob-facts__item">
          <dt className="mob-facts__label">{f.label}</dt>
          <dd className="mob-facts__value">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The three promises, in plain words. Sharing is said as it is: on inside the Mob, one switch to turn it off. */
export const PROMISES = [
  ['A fresh paper every Monday', 'Drawn from the same bank as your mocks, so it never runs out.'],
  ['You see who sat, never who didn\'t', 'The ring fills as friends sit. Never ranked.'],
  ['Shared inside your Mob only', 'Members see each other\'s answers and scores. One switch turns yours off.'],
];

export function Promises({ items = PROMISES }) {
  return (
    <ul className="mob-promise-list">
      {items.map(([title, line]) => (
        <li key={title}><b>{title}</b><span>{line}</span></li>
      ))}
    </ul>
  );
}
