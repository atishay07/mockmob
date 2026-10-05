"use client";
import { Check, ArrowRight } from 'lucide-react';
import './key-review.css';

const letter = index => 'ABCDEFGH'[index] || 'Unavailable';
export default function AnswerCorrectionNotice({ review, next = null }) {
  const confirmed = review.state === 'corrected';
  return <section className="kr kr--correction" role="status" aria-label={confirmed ? 'Answer key corrected' : 'Answer change awaiting verification'}>
    <header className="kr-head"><Check size={20} aria-hidden="true" /><div>
      <h4 className="kr-title">{confirmed ? 'We got the answer key wrong. We’re sorry.' : 'The answer changed. We’re checking the correction.'}</h4>
      <p className="kr-lede">{confirmed ? 'The key used to mark your session was wrong. This was our mistake, not yours.' : 'We’re sorry for the conflicting answers. We will not call the new key correct until its evidence is checked.'}</p>
    </div></header>
    <dl className="kr-correction-keys"><div><dt>Key used in your session</dt><dd>{letter(review.originalIndex)}</dd></div><div><dt>{confirmed ? 'Correct answer' : 'Current bank key · unverified'}</dt><dd>{letter(review.currentIndex)}</dd></div></dl>
    {confirmed ? <>
      <p className="kr-correction-explanation">{review.explanation || 'A checked explanation is not available yet. The corrected key is shown above.'}</p>
      {review.source ? <a className="kr-source" href={review.source.url} target="_blank" rel="noreferrer">Read the supporting source <ArrowRight size={14} aria-hidden="true" /></a> : null}
      <p className="kr-note">{review.chosenIndex === null ? 'You left this question blank, so it remains 0 marks.' : review.chosenIndex === review.currentIndex ? `Your pick ${letter(review.chosenIndex)} is correct under the corrected key.` : `Your pick ${letter(review.chosenIndex)} still differs from the correct answer ${letter(review.currentIndex)}.`} Correction adjustment: {review.adjustment > 0 ? '+' : ''}{review.adjustment} marks.</p>
    </> : null}
    <p className="kr-note">No AI credit is charged for this notice. Your original result is preserved; any adjustment here is a separate calculation and has not changed your leaderboard or account record.</p>
    {next ? <footer className="kr-foot">{next}</footer> : null}
  </section>;
}
