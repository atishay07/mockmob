"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { VISITOR_KEY, findResumableTest, nextHint, serializeHint, visitorState } from '@/../data/visitor_state.mjs';

// Evaluated once per full page load, before any in-app navigation: the page this load opened on.
// The home page uses it to tell "opened the site" apart from "followed the logo from the app".
const landedPath = typeof window === 'undefined' ? null : window.location.pathname;
let arenaRedirected = false;
export const landedOnHome = () => landedPath === '/';
export const arenaRedirectDone = () => arenaRedirected;
export const markArenaRedirect = () => { arenaRedirected = true; };

export function readHint() {
  try { return window.localStorage.getItem(VISITOR_KEY); } catch { return null; }
}

// The newest unfinished test this signed-in student has saved on this device, or null. Read after
// mount (storage does not exist on the server), so the server and first client render agree.
export function useResumableTest() {
  const { status, user } = useAuth();
  const [resume, setResume] = useState(null);
  useEffect(() => {
    let alive = true;
    // Deferred a tick so the effect itself sets no state (the same pattern the result page uses).
    queueMicrotask(() => {
      if (!alive) return;
      if (status !== 'authenticated' || !user?.id) { setResume(null); return; }
      try { setResume(findResumableTest(window.localStorage, user.id)); } catch { setResume(null); }
    });
    return () => { alive = false; };
  }, [status, user?.id]);
  return resume;
}

// Keeps what this browser remembers about the visitor current (signed in, plan, signed in before)
// and mirrors it on <html data-visitor> and <html data-visitor-plan>, which the pages style
// against. The inline boot script in the layout sets the same attributes before first paint.
export default function VisitorSync() {
  const { status, user } = useAuth();
  const isPremium = Boolean(user?.isPremium);
  const signedIn = status === 'authenticated';
  useEffect(() => {
    const current = readHint();
    const next = nextHint({ status, user: signedIn ? { isPremium } : null, current });
    if (next) {
      try { window.localStorage.setItem(VISITOR_KEY, serializeHint(next)); } catch { /* storage is optional */ }
    }
    // Judged by what was remembered before this change: signing out turns a member into a returning
    // visitor, and a visitor who never signed in stays new.
    const { kind, plan } = visitorState({ status, user: signedIn ? { isPremium } : null, hint: current });
    document.documentElement.dataset.visitor = kind;
    document.documentElement.dataset.visitorPlan = plan === 'pro' ? 'pro' : 'free';
  }, [status, signedIn, isPremium]); // user is reduced to the fields above
  return null;
}
