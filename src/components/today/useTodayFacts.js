"use client";

// Loads what Today needs, in parallel, and says plainly which state it is in:
//   loading   nothing yet: the page shows the same boxes as skeletons, so nothing shifts when facts arrive
//   ready     the plan answered (moveFacts is there); goal, wallet and subjects are optional extras
//   error     the plan did not answer, or answered without facts: Today says so and offers Practice
// Only the plan is required. A missing goal, wallet or subject list leaves that one line out; it never
// blocks the hero. Nothing is guessed: an unreadable balance is null, never 0.
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/fetcher';
import { walletFromResponse } from '@/services/credits/aiWalletState';

const EMPTY = { userId: null, status: 'loading', plan: null, goal: null, wallet: null, practiceBalance: null, supported: null };

async function readCredits() {
  const res = await fetch('/api/ai/credits', { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  return { wallet: walletFromResponse(body, { ok: res.ok }), practiceBalance: Number.isFinite(body?.practiceCredits?.balance) ? body.practiceCredits.balance : null };
}

export function useTodayFacts(userId) {
  const [state, setState] = useState(EMPTY);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    Promise.allSettled([apiGet('/api/learning/plan'), apiGet('/api/me/goal'), readCredits(), apiGet('/api/subjects')]).then(([plan, goal, credits, subjects]) => {
      if (!alive) return;
      const facts = plan.status === 'fulfilled' ? plan.value?.moveFacts : null;
      if (!facts || typeof facts !== 'object') { setState({ ...EMPTY, userId, status: 'error' }); return; }
      const supported = subjects.status === 'fulfilled' && Array.isArray(subjects.value)
        ? new Set(subjects.value.filter((s) => s?.practice === 'supported').map((s) => s.id)) : null;
      setState({
        userId,
        status: 'ready',
        plan: plan.value,
        goal: goal.status === 'fulfilled' ? goal.value : null,
        wallet: credits.status === 'fulfilled' && credits.value.wallet?.known ? credits.value.wallet : null,
        practiceBalance: credits.status === 'fulfilled' ? credits.value.practiceBalance : null,
        supported,
      });
    });
    return () => { alive = false; };
  }, [userId, round]);

  const retry = useCallback(() => { setState(EMPTY); setRound((n) => n + 1); }, []);
  // Never show another account's facts while this account's read is in flight.
  const mine = state.userId === userId ? state : { ...EMPTY, userId };
  return { ...mine, facts: mine.plan?.moveFacts || null, retry };
}
