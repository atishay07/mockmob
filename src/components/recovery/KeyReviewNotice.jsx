"use client";
// Key Review: shown when our own checks could not reproduce the answer key. The platform owns the
// possible mistake: it says so plainly, shows who picked what, and states what changes (and what does not).
import Link from 'next/link';
import { ShieldAlert, Check, X } from 'lucide-react';
import { keyReviewEvidence } from '@/../data/repair_presentation.mjs';
import './key-review.css';

const idx = (letter) => 'ABCDEFGH'.indexOf(letter);

export default function KeyReviewNotice({ chosenLetter, keyLetter, dispute, next = null, practiceHref = null }) {
  const rows = keyReviewEvidence({ chosenIndex: idx(chosenLetter), keyIndex: idx(keyLetter), dispute });
  return (
    <section className="kr" role="status" aria-label="Answer key under review">
      <header className="kr-head">
        <span className="kr-icon" aria-hidden="true"><ShieldAlert size={20} strokeWidth={2.3} /></span>
        <div>
          <b className="kr-title">We may have got this one wrong</b>
          <p className="kr-lede">Our own checks could not reproduce the answer key for this question, so we stopped instead of explaining it.</p>
        </div>
      </header>
      {rows.length > 2 ? (
        <ol className="kr-rows" aria-label="Who picked what">
          {rows.map((r, i) => (
            <li key={r.id} className="kr-row" data-agree={r.agree === undefined ? undefined : String(r.agree)} style={{ '--i': i }}>
              <span className="kr-row__label">{r.label}</span>
              <span className="kr-row__letter">{r.letter}</span>
              {r.agree === undefined ? null : <span className="kr-row__verdict">{r.agree ? <><Check size={13} aria-hidden="true" />matches key</> : <><X size={13} aria-hidden="true" />differs from key</>}</span>}
            </li>
          ))}
        </ol>
      ) : null}
      <ul className="kr-facts">
        <li>The question is out of practice until it is re-checked.</li>
        <li>You were not charged a credit.</li>
        <li>Two automated checks disagreeing with a key is a warning, not proof. Your recorded marks stay as they are for now.</li>
      </ul>
      <footer className="kr-foot">
        {next}
        {practiceHref ? <Link className="mr-practice mr-practice--quiet" href={practiceHref}>Practise 5 on this chapter</Link> : null}
      </footer>
    </section>
  );
}
