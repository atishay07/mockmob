"use client";
// Key Review: shown when our own checks could not reproduce the answer key. The platform owns the
// possible mistake: it says so plainly, shows who picked what, and states what changes (and what does not).
import Link from 'next/link';
import { ShieldAlert, Check, X } from 'lucide-react';
import { keyReviewEvidence } from '@/../data/repair_presentation.mjs';
import './key-review.css';

const idx = (letter) => 'ABCDEFGH'.indexOf(letter);

export default function KeyReviewNotice({ chosenLetter, keyLetter, dispute, reviewState = null, next = null, practiceHref = null }) {
  const rows = keyReviewEvidence({ chosenIndex: idx(chosenLetter), keyIndex: idx(keyLetter), dispute });
  return (
    <section className="kr" role="status" aria-label="Answer key under review">
      <header className="kr-head">
        <span className="kr-icon" aria-hidden="true"><ShieldAlert size={20} strokeWidth={2.3} /></span>
        <div>
          <b className="kr-title">We may have got this one wrong</b>
          <p className="kr-lede">We’re sorry for the uncertainty. {reviewState === 'withdrawn' ? 'This question has been withdrawn, so we are not using its old answer to teach you.' : reviewState === 'content_changed' ? 'The question changed after your session. Its old answer cannot be compared reliably with the edited version.' : reviewState ? 'This question is being re-checked. We will show a corrected answer only when its evidence is confirmed.' : 'Our checks could not reproduce the answer key, so we stopped instead of giving you an unreliable explanation.'}</p>
        </div>
      </header>
      {rows.length ? (
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
        <li>{reviewState === 'content_changed' ? 'We have withheld the old explanation; it may no longer fit the question.' : reviewState === 'withdrawn' ? 'This question is no longer available in practice.' : 'The question is out of practice until it is re-checked.'}</li>
        <li>You were not charged a credit.</li>
        <li>{reviewState ? 'A changed or withheld question is not proof of a corrected answer.' : 'Two automated checks disagreeing with a key is a warning, not proof.'} Your recorded marks stay as they are for now.</li>
      </ul>
      <footer className="kr-foot">
        {next}
        {practiceHref ? <Link className="mr-practice mr-practice--quiet" href={practiceHref}>Practise 5 on this chapter</Link> : null}
      </footer>
    </section>
  );
}
