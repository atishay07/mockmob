"use client";

// Shares what a page already knows about the student (mocks taken, weakest chapter, balance, credits spent) with the
// Upgrade sheet, so its benefit lines can be personal (D81). Renders nothing; unknown facts are left out, never guessed.
import { useEffect } from 'react';
import { mergeFacts, practiceSpentWeek } from '@/lib/proNudge.mjs';
import { shareProFacts } from './proNudgeStore';

// `history` (Account > Credits lines) adds the practice credits spent in the last 7 days, worked out after render.
export default function ProFacts({ facts = {}, history = null }) {
  const key = JSON.stringify(mergeFacts(facts));
  useEffect(() => {
    shareProFacts(mergeFacts(JSON.parse(key), history ? { spentWeek: practiceSpentWeek(history, Date.now()) } : null));
  }, [key, history]);
  return null;
}
