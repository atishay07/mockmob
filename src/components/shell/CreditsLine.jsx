"use client";

// The desktop sidebar's credit lines (plan 2.1): "40 practice credits", "9 AI credits". Every
// number is labelled; a number that is not known yet is not shown (never a 0 that means unknown).
// The block keeps its height while the wallet loads, so nothing below it moves.
import Link from 'next/link';
import { creditLineParts } from './shellModel.mjs';

export default function CreditsLine({ practiceBalance = null, aiRemaining = null, pro = false, href = '/profile#plan' }) {
  const lines = creditLineParts({ practiceBalance, aiRemaining, pro });
  return (
    <Link href={href} className="sh-credits" aria-label={lines.length ? `Plan and credits: ${lines.map((l) => l.label).join(', ')}` : 'Plan and credits'}>
      {lines.length ? lines.map((line) => (
        <span key={line.id} className="sh-credits__line" data-kind={line.id}>
          {line.count !== null ? <b>{line.count}</b> : null} {line.words}
        </span>
      )) : <span className="sh-credits__line sh-credits__line--quiet">Plan and credits</span>}
    </Link>
  );
}
