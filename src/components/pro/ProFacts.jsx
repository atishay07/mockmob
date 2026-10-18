"use client";

// Shares what a page already knows about the student (mocks taken, weakest chapter, balance, credits spent) with the
// Upgrade sheet, so its benefit lines can be personal (D81). Renders nothing; unknown facts are left out, never guessed.
import { useEffect } from 'react';
import { mergeFacts, practiceSpentWeek } from '@/lib/proNudge.mjs';
import { shareProFacts } from './proNudgeStore';

// `history` (Account > Credits lines) adds the credits spent on practice in the last 7 days, worked out after render.
// `oneBalance` (D78: the history serves one credits balance): a practice set can then be paid from this month's free
// credits, whose lines sit in the 'ai' pool, so counting the 'practice' pool would undercount. The figure is left out
// (the plain line stands in) until the history names practice spends whatever part paid for them.
export default function ProFacts({ facts = {}, history = null, oneBalance = false }) {
  const key = JSON.stringify(mergeFacts(facts));
  useEffect(() => {
    shareProFacts(mergeFacts(JSON.parse(key), history && !oneBalance ? { spentWeek: practiceSpentWeek(history, Date.now()) } : null));
  }, [key, history, oneBalance]);
  return null;
}
