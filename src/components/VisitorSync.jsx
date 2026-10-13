"use client";

import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { VISITOR_KEY, nextHint, serializeHint, visitorState } from '@/../data/visitor_state.mjs';

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

// Keeps what this browser remembers about the visitor current (signed in, plan, been here
// before) and mirrors it on <html data-visitor>, which the home page styles against. The
// inline boot script in the layout sets the same attribute before first paint.
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
    // Judged by what was remembered before this visit, so a first visit stays "new" until the next one.
    const { kind } = visitorState({ status, user: signedIn ? { isPremium } : null, hint: current });
    document.documentElement.dataset.visitor = kind;
  }, [status, signedIn, isPremium]); // user is reduced to the fields above
  return null;
}
