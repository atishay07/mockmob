"use client";

// One read of GET /api/referrals per page view, shared by every invite card on the page (the Wallet, You, the Mob invite).
// { status: 'loading' | 'off' | 'failed' | 'ready', body } . 'off' covers the switch being off (live:false), a signed-out
// visitor and an older server without the route: nothing is shown then, never a guess.
import { useCallback, useEffect, useState } from 'react';

const URL = '/api/referrals';
const FRESH_MS = 30_000;
let cached = null; // { at, value }
let inflight = null;

async function readStatus() {
  try {
    const res = await fetch(URL, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (res.status === 401 || res.status === 404) return { status: 'off', body: null };
    if (!res.ok) return { status: 'failed', body: null };
    const body = await res.json().catch(() => null);
    if (!body || body.ok !== true) return { status: 'failed', body: null };
    return body.live === true ? { status: 'ready', body } : { status: 'off', body: null };
  } catch {
    return { status: 'failed', body: null };
  }
}

function load(force = false) {
  if (!force && cached && Date.now() - cached.at < FRESH_MS) return Promise.resolve(cached.value);
  if (!inflight) {
    inflight = readStatus().then((value) => {
      if (value.status !== 'failed') cached = { at: Date.now(), value };
      inflight = null;
      return value;
    });
  }
  return inflight;
}

export function useReferralStatus() {
  const [state, setState] = useState(() => (cached ? cached.value : { status: 'loading', body: null }));
  useEffect(() => {
    let live = true;
    load().then((value) => { if (live) setState(value); });
    return () => { live = false; };
  }, []);
  const retry = useCallback(() => {
    setState({ status: 'loading', body: null });
    load(true).then(setState);
  }, []);
  return { ...state, retry };
}
