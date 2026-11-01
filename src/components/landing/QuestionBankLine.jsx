"use client";

import { useEffect, useState } from 'react';
import { SUBJECT_CLAIM } from '../../../data/subject_claim.js';
import { loadBankSize } from './bankStats';
import { heroBankLine } from './heroTaps.mjs';

// One sentence of proof (bolder copy, M-006; tightened for the phone hero, D38, 18 Oct). It carries every fact the
// longer line did: the subject claim (15 subjects, 19 of every 20 CUET papers), that every mock is built fresh from
// one live bank of N questions, so there is no fixed set to run out of, and that Pro has no cap (named, so Free, on
// credits, is not read as unlimited). The count is the real stored inventory from /api/stats; without it the
// sentence still holds, just without the number (never a made-up figure).
//
// variant="short" (the home hero since LK32, 1 Nov): one quiet line, "One bank of N questions. No cap on Pro."
// (heroTaps.mjs heroBankLine); the subject claim stays in the shelf note and the FAQ.
export function QuestionBankLine({ className = '', variant = 'long', ...rest }) {
  const [bank, setBank] = useState(null);

  useEffect(() => {
    let live = true;
    loadBankSize().then((size) => { if (live && size) setBank({ questions: size }); });
    return () => { live = false; };
  }, []);

  if (variant === 'short') return <p className={className} {...rest}>{heroBankLine(bank?.questions ?? null)}</p>;

  return (
    <p className={className} {...rest}>
      {SUBJECT_CLAIM.long},{' '}
      {bank ? (
        <>
          each built fresh from one live bank of{' '}
          <b className="lp-bank__n">{bank.questions.toLocaleString('en-IN')} questions</b>
          : no fixed set to run out of, no cap on Pro.
        </>
      ) : (
        <>each built fresh from one live question bank: no fixed set to run out of, no cap on Pro.</>
      )}
    </p>
  );
}
