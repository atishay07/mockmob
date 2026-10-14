"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { apiGet } from '@/lib/fetcher';
import {
  VISITOR_KEY, findResumableTest, nextHint, serializeHint, readStarted, shouldCheckStarted, visitorState,
} from '@/../data/visitor_state.mjs';
import './visitor-stage.css';

// Evaluated once per full page load, before any in-app navigation: the page this load opened on.
// The home page uses it to tell "opened the site" apart from "followed the logo from the app".
const landedPath = typeof window === 'undefined' ? null : window.location.pathname;
let startRedirected = false;
export const landedOnHome = () => landedPath === '/';
export const startRedirectDone = () => startRedirected;
export const markStartRedirect = () => { startRedirected = true; };
/** @deprecated Old names, kept for files outside the member-entry package. */
export const arenaRedirectDone = startRedirectDone;
export const markArenaRedirect = markStartRedirect;

/** How this page load began: 'navigate', 'reload' or 'back_forward' (Navigation Timing). */
export function navigationType() {
  try { return performance.getEntriesByType('navigation')[0]?.type || 'navigate'; } catch { return 'navigate'; }
}

export function readHint() {
  try { return window.localStorage.getItem(VISITOR_KEY); } catch { return null; }
}

function writeHint(next) {
  try { window.localStorage.setItem(VISITOR_KEY, serializeHint(next)); } catch { /* storage is optional */ }
}

// Mirrors a visitor state on <html>. The inline boot script sets the same attributes before first paint.
function applyAttributes({ kind, plan, stage }) {
  const { dataset } = document.documentElement;
  dataset.visitor = kind;
  dataset.visitorPlan = plan === 'pro' ? 'pro' : 'free';
  if (kind === 'member' && stage === 'first') dataset.visitorStage = 'first';
  else delete dataset.visitorStage;
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

// Keeps what this browser remembers about the visitor current (signed in, plan, signed in before,
// has a scored session yet) and mirrors it on <html data-visitor>, <html data-visitor-plan> and
// <html data-visitor-stage>, which the pages style against.
export default function VisitorSync() {
  const { status, user } = useAuth();
  const pathname = usePathname() || '';
  const isPremium = Boolean(user?.isPremium);
  const signedIn = status === 'authenticated';
  const check = useRef({ lastAt: 0, inFlight: false, previousPath: '' });
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    const current = readHint();
    const next = nextHint({ status, user: signedIn ? { isPremium } : null, current });
    if (next) writeHint(next);
    // Judged by what was remembered before this change: signing out turns a member into a returning
    // visitor, and a visitor who never signed in stays new. The stage reads the newest hint.
    const { kind, plan } = visitorState({ status, user: signedIn ? { isPremium } : null, hint: current });
    const { stage } = visitorState({ status, user: null, hint: next ? serializeHint(next) : current });
    applyAttributes({ kind, plan, stage });
  }, [status, signedIn, isPremium]); // user is reduced to the fields above

  // Day one or not: one small read of the attempts list until the first scored session exists.
  // A failed read changes nothing, so an unknown stage stays "active member".
  useEffect(() => {
    const state = check.current;
    const previousPath = state.previousPath;
    state.previousPath = pathname;
    if (!shouldCheckStarted({ status, hint: readHint(), pathname, previousPath, lastCheckAt: state.lastAt, inFlight: state.inFlight })) return;
    state.inFlight = true;
    state.lastAt = Date.now();
    // The peek skips finalisation, so an expired session that was never scored would look like day
    // one. An empty peek is therefore confirmed by one ordinary read before it is believed.
    readStarted(() => apiGet('/api/attempts/summary?limit=1&finalise=0'), () => apiGet('/api/attempts/summary?limit=1'))
      .then((started) => {
        // Signed out while the read was in flight: the answer belongs to nobody now.
        if (started === undefined || statusRef.current !== 'authenticated') return;
        const current = readHint();
        const next = nextHint({ status: 'authenticated', user: { isPremium }, current, started });
        if (!next) return;
        writeHint(next);
        applyAttributes(visitorState({ status: 'authenticated', user: { isPremium }, hint: serializeHint(next) }));
      })
      .catch(() => { /* unknown stays unknown */ })
      .finally(() => { state.inFlight = false; });
  }, [status, pathname, isPremium]);

  return null;
}
