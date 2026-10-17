"use client";
// Reads the AI credits wallet once per signed-in account for the app shell. The cache is keyed
// by account and marked stale, so a switch of accounts never shows the previous balance.
// One balance everywhere (W-060): any screen that reads a fresh wallet after spending (Ask Mobi after a reply, a repair)
// calls announceWallet, and every mounted reader (the top bar chip, Account's strip) takes the new balance at once.
import { useEffect, useState } from 'react';
import { walletFromResponse } from '@/services/credits/aiWalletState';

const KEY = 'mm:wallet:v1';
const MAX_AGE_MS = 5 * 60 * 1000;
const EVENT = 'mm:wallet';

function readCache(userId) {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(KEY) || 'null');
    if (raw && raw.userId === userId && Date.now() - raw.at < MAX_AGE_MS) return raw.wallet;
  } catch { /* storage unavailable */ }
  return null;
}

/** The last balance this tab read for this account in the last five minutes, or null. A screen paints it at once. */
export function cachedWallet(userId) {
  if (!userId || typeof window === 'undefined') return null;
  return readCache(userId);
}

/**
 * A fresh wallet read somewhere else (it must be the server's own answer, never a guess). Stores it for this tab and
 * tells every reader. `wallet` is walletFromResponse's shape; an unknown wallet is not announced.
 */
export function announceWallet(userId, wallet) {
  if (!userId || !wallet?.known || typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ userId, at: Date.now(), wallet })); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { userId, wallet } })); } catch { /* old browser: next read catches up */ }
}

// reuseFresh: a screen that only reads the balance (a repair's cost line, a lesson's help line) takes a balance read in
// the last five minutes as it is and does not ask the server again; the app shell's own read keeps refreshing.
export function useWalletSummary(userId, { reuseFresh = false } = {}) {
  const [state, setState] = useState({ userId: null, wallet: null, status: 'idle' });
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    const cached = readCache(userId);
    const timer = window.setTimeout(() => {
      if (cached) setState({ userId, wallet: cached, status: 'cached' });
      if (cached && reuseFresh) return;
      fetch('/api/ai/credits', { cache: 'no-store' })
        .then(async (res) => {
          const body = await res.json().catch(() => null);
          if (!alive) return;
          const wallet = walletFromResponse(body, { ok: res.ok });
          setState({ userId, wallet, status: wallet.known ? 'fresh' : 'unavailable' });
          if (wallet.known) {
            try { window.sessionStorage.setItem(KEY, JSON.stringify({ userId, at: Date.now(), wallet })); } catch { /* ignore */ }
          }
        })
        .catch(() => { if (alive) setState((prev) => ({ userId, wallet: prev.userId === userId ? prev.wallet : null, status: 'unavailable' })); });
    }, 0);
    const onAnnounce = (event) => {
      if (event.detail?.userId === userId && event.detail.wallet?.known) setState({ userId, wallet: event.detail.wallet, status: 'fresh' });
    };
    window.addEventListener(EVENT, onAnnounce);
    return () => { alive = false; window.clearTimeout(timer); window.removeEventListener(EVENT, onAnnounce); };
  }, [userId, reuseFresh]);
  // Never expose another account's wallet while this account's read is in flight.
  return state.userId === userId ? state : { userId, wallet: null, status: 'idle' };
}
