"use client";

import { useEffect, useState } from 'react';

// One quiet sentence for the hero: every mock comes out of one shared bank, so
// there is no fixed pack of 10 or 30 mocks to use up. The counts are the real
// stored inventory from /api/stats; without them the sentence still holds,
// just without the numbers (never a made-up figure).
export function QuestionBankLine({ className = '', ...rest }) {
  const [bank, setBank] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/stats', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || data.state !== 'available' || !Number.isFinite(data.bankSize) || data.bankSize <= 0) return;
        const subjects = Object.values(data.subjectCounts || {}).filter((n) => Number(n) > 0).length;
        setBank({ questions: data.bankSize, subjects });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <p className={className} {...rest}>
      {bank ? (
        <>
          Every mock is drawn fresh from one bank of{' '}
          <b className="lp-bank__n">{bank.questions.toLocaleString('en-IN')} questions</b>
          {bank.subjects > 1 ? <> across {bank.subjects} subjects</> : null}, so you never run out at 10 or 30 mocks.
        </>
      ) : (
        <>Every mock is drawn fresh from one central question bank, so you never run out at 10 or 30 mocks.</>
      )}
    </p>
  );
}
