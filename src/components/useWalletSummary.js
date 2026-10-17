"use client";
// Reads the AI credits wallet once per signed-in account for the app shell. The cache is keyed
// by account and marked stale, so a switch of accounts never shows the previous balance.
import { useEffect, useState } from 'react';
import { walletFromResponse } from '@/services/credits/aiWalletState';

const KEY = 'mm:wallet:v1';
const MAX_AGE_MS = 5 * 60 * 1000;

function readCache(userId) {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(KEY) || 'null');
    if (raw && raw.userId === userId && Date.now() - raw.at < MAX_AGE_MS) return raw.wallet;
  } catch { /* storage unavailable */ }
  return null;
}

const EVENT = 'mm:wallet';

// A server response that carries the balance it just read (a repair's charge, a refusal for 0 credits) publishes it here,
// so every line on the page that shows the balance moves with it, not only the line that made the call.
export function publishWalletTotal(userId, total) {
  if (!userId || !Number.isFinite(total)) return;
  try {
    let base = null;
    try { base = JSON.parse(window.sessionStorage.getItem(KEY) || 'null'); } catch { /* storage unavailable */ }
    const prior = base && base.userId === userId && base.wallet ? base.wallet : {};
    const state = prior.state === 'paused' ? 'paused' : total > 0 ? 'available' : 'empty';
    const wallet = { ...prior, known: true, total, state, spendable: state === 'available', message: state === 'empty' ? 'You have no AI credits left this month.' : prior.message ?? null };
    try { window.sessionStorage.setItem(KEY, JSON.stringify({ userId, at: Date.now(), wallet })); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { userId, wallet } }));
  } catch { /* no window */ }
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
    const onPublish = (event) => { if (alive && event.detail?.userId === userId) setState({ userId, wallet: event.detail.wallet, status: 'fresh' }); };
    window.addEventListener(EVENT, onPublish);
    return () => { alive = false; window.clearTimeout(timer); window.removeEventListener(EVENT, onPublish); };
  }, [userId, reuseFresh]);
  // Never expose another account's wallet while this account's read is in flight.
  return state.userId === userId ? state : { userId, wallet: null, status: 'idle' };
}
