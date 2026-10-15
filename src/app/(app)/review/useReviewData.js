"use client";

// Loads what the Review hub needs, in parallel, and says which state each part is in. Nothing here
// blocks anything else: the plan, the past results, the repair record and the wallet are four
// independent reads, and tonight's paper is read as soon as the plan names it.
//
//   plan           /api/learning/plan  moveFacts.repair names tonight's paper (the same one Today and the Start sheet use)
//   summary        /api/attempts/summary  past results, slim, newest first (one page of SUMMARY_LIMIT)
//   repairRows     /api/me/repair-record  the mistakes already repaired
//   attempt        /api/attempts/:id  the paper itself, only for tonight's paper, for the chapters
//   wallet         /api/ai/credits  the AI credit balance for the cost line (optional)
//
// A read that fails is `null` here with its own flag; the page then says so in that section only.
// An unreadable balance is null, never 0.
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/fetcher';
import { walletFromResponse } from '@/services/credits/aiWalletState';
import { reviewChanges } from '@/components/recovery/reviewChanges';
import { SUMMARY_LIMIT, REPAIR_RECORD_LIMIT } from './reviewModel.mjs';

const EMPTY = { userId: null, status: 'loading', offline: false, moveFacts: null, planFailed: false, summary: null, summaryFailed: false, complete: true,
  repairRows: null, repairFailed: false, attempt: null, attemptFailed: false, aiBalance: null, fresh: new Set() };

async function readAiBalance() {
  const res = await fetch('/api/ai/credits', { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  const wallet = walletFromResponse(body, { ok: res.ok });
  return wallet?.known ? wallet.total : null;
}

const isOffline = (error) => error?.kind === 'network' || (typeof navigator !== 'undefined' && navigator.onLine === false);

export function useReviewData(userId) {
  const [state, setState] = useState(EMPTY);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    (async () => {
      const [plan, summary, repair, balance] = await Promise.allSettled([
        apiGet('/api/learning/plan'),
        apiGet(`/api/attempts/summary?limit=${SUMMARY_LIMIT}`),
        apiGet(`/api/me/repair-record?limit=${REPAIR_RECORD_LIMIT}`),
        readAiBalance(),
      ]);
      if (!alive) return;
      const moveFacts = plan.status === 'fulfilled' && plan.value?.moveFacts && typeof plan.value.moveFacts === 'object' ? plan.value.moveFacts : null;
      const items = summary.status === 'fulfilled' && Array.isArray(summary.value?.items) ? summary.value.items : null;
      const rows = repair.status === 'fulfilled' && Array.isArray(repair.value?.repairs) ? repair.value.repairs : null;
      const failures = [plan, summary, repair].filter((r) => r.status === 'rejected');
      const offline = failures.length > 0 && failures.every((r) => isOffline(r.reason)) && failures.length === 3;
      // Tonight's paper: only when the plan names one with open mistakes. Its chapters come from the paper itself.
      const tonight = moveFacts?.repair?.attemptId && Number(moveFacts.repair.open) > 0 ? moveFacts.repair.attemptId : null;
      let attempt = null;
      let attemptFailed = false;
      if (tonight) {
        try { attempt = await apiGet(`/api/attempts/${encodeURIComponent(tonight)}`); } catch { attemptFailed = true; }
        if (!alive) return;
      }
      // "New since your last look": recorded once per load (storage can be missing, so it is wrapped).
      let fresh = new Set();
      if (items) {
        let storage = null;
        try { storage = window.localStorage; } catch { storage = null; }
        try { fresh = reviewChanges(items.map((a) => ({ id: a.id, mistakes: a.wrong })), storage).fresh; } catch { fresh = new Set(); }
      }
      setState({
        userId,
        status: 'ready',
        offline,
        moveFacts,
        planFailed: moveFacts === null,
        summary: items,
        summaryFailed: items === null,
        complete: items !== null && !summary.value?.nextCursor,
        repairRows: rows,
        repairFailed: rows === null,
        attempt: attempt && attempt.id ? attempt : null,
        attemptFailed: attemptFailed || (Boolean(tonight) && !(attempt && attempt.id)),
        aiBalance: balance.status === 'fulfilled' ? balance.value : null,
        fresh,
      });
    })();
    return () => { alive = false; };
  }, [userId, round]);

  const retry = useCallback(() => { setState(EMPTY); setRound((n) => n + 1); }, []);
  // Never show another account's record while this account's read is in flight.
  const mine = state.userId === userId ? state : { ...EMPTY, userId };
  return { ...mine, retry };
}
