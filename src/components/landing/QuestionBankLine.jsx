"use client";

import { useEffect, useState } from 'react';
import { SUBJECT_CLAIM } from '../../../data/subject_claim.js';

// One calm paragraph for the hero. It carries two facts: the subject claim (15 subjects, 19 of every 20 CUET papers),
// and that every mock is built fresh from one live bank, so there is no fixed set to run out of. It names Pro, so Free
// (credits) is not read as unlimited. The count is the real stored inventory from /api/stats; without it the
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
      {SUBJECT_CLAIM.long}.{' '}
      {bank ? (
        <>
          Every mock is drawn fresh from one live bank of{' '}
          <b className="lp-bank__n">{bank.questions.toLocaleString('en-IN')} questions</b>
          , so there is no fixed set to run out of, and Pro covers as many as you take.
        </>
      ) : (
        <>Every mock is drawn fresh from one live question bank, so there is no fixed set to run out of, and Pro covers as many as you take.</>
      )}
    </p>
  );
}
