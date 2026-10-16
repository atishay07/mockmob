"use client";
// "How others answered" inside an opened answer (spec tmp/mistake-lab-v4/SPEC.md 4.3): the line above the options and,
// per option, a right-aligned count with a 2 px bar under the option text. The line and the counts come finished
// from the server (data/mistake_lab.js othersFor): other students' first answers, mapped by option text in this
// paper's own order, right against today's key, the student's own answer left out, and nothing under 10 students.
// From slice 5 the server may add `lines`: how long the students who got it right took, how many changed their answer and how
// many crossed out the key, each present only once its gate passed (30, 20 and 20 students).
import { Users } from 'lucide-react';
import './marks-ledger.css';

/** The small label and the server's line. Nothing when the question has no cohort read. */
export default function OthersAnswered({ others, title = 'How others answered' }) {
  if (!others?.line) return null;
  return (
    <div className="ml-others">
      <p className="ml-others__label"><Users size={14} strokeWidth={2.2} aria-hidden="true" />{title}</p>
      <p className="ml-others__line">{others.line}</p>
      {/* Time, changes and strike-outs from the nightly table, each line only once its gate passed (server-built). */}
      {Array.isArray(others.lines) ? others.lines.map((line) => <p key={line} className="ml-others__line">{line}</p>) : null}
    </div>
  );
}

/**
 * The count and the 2 px bar for option `index` (this paper's served order), as grid items of the option row, plus
 * the accessible line ("Option C: chosen by 8 of 31 other students."). `tone` is 'key' for today's key, 'mine' for
 * the student's own wrong pick, else neutral. Nothing when there is no cohort read.
 */
export function OptionShare({ others, index, tone = null }) {
  if (!others || !Number.isInteger(others.n) || others.n <= 0) return null;
  const count = Number(others.counts?.[index]) || 0;
  const share = Math.max(0, Math.min(100, (count / others.n) * 100));
  return (
    <>
      <span className="ml-share__count" data-tone={tone || undefined} aria-hidden="true">{count}</span>
      <span className="ml-share" data-tone={tone || undefined} aria-hidden="true"><i style={{ '--p': `${share}%` }} /></span>
      {others.optionLabels?.[index] ? <span className="sr-only">{others.optionLabels[index]}</span> : null}
    </>
  );
}

/** The share tone of option `index`: today's key, the student's own wrong pick, or neutral. */
export function shareTone(others, index, givenIndex) {
  if (!others) return null;
  if (Number.isInteger(others.keyIndex) && others.keyIndex === index) return 'key';
  if (Number.isInteger(givenIndex) && givenIndex === index) return 'mine';
  return null;
}
