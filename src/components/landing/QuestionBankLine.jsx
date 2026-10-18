"use client";

import { useEffect, useState } from 'react';
import { SUBJECT_CLAIM } from '../../../data/subject_claim.js';

// One sentence of proof under the hero's lead (bolder copy, M-006; tightened for the phone hero, D38, 18 Oct). It carries
// every fact the longer line did: the subject claim (15 subjects, 19 of every 20 CUET papers), that every mock is built
// fresh from one live bank of N questions, so there is no fixed set to run out of, and that Pro has no cap (named, so
// Free, on credits, is not read as unlimited). The count is the real stored inventory from /api/stats; without it the
// sentence still holds, just without the number (never a made-up figure).
export function QuestionBankLine({ className = '', ...rest }) {
  const [bank, setBank] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/stats', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || data.state !== 'available' || !Number.isFinite(data.bankSize) || data.bankSize <= 0) return;
        setBank({ questions: data.bankSize });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

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
