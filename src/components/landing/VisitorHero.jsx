"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';
import { readHint, landedOnHome, navigationType, startRedirectDone, markStartRedirect, useResumableTest } from '@/components/VisitorSync';
import { PRACTICE_HREF, START_ON_KEY, START_ON_OPTIONS, memberCopy, parseStartOn, startRedirectPlan, visitorState } from '@/../data/visitor_state.mjs';

// The signed-in side of the home page. Each export is shown only to signed-in students (the
// vs-member-only class is toggled by <html data-visitor>), so signed-out visitors and search
// engines get the marketing page untouched. Day-one members (no scored session yet) and active
// members each get their own version, picked by <html data-visitor-stage> before first paint.

function useMember() {
  const { status, user } = useAuth();
  // Read after mount so the server and first client render agree.
  const resume = useResumableTest();
  const [hint, setHint] = useState(null);
  useEffect(() => {
    let alive = true;
    // Deferred a tick so the effect itself sets no state (the same pattern the result page uses).
    queueMicrotask(() => { if (alive) setHint(readHint()); });
    return () => { alive = false; };
  }, [status, user?.id]);
  const state = useMemo(() => visitorState({ status, user, hint }), [status, user, hint]);
  // Both versions are built so CSS can pick one without waiting for the attempts check.
  const active = useMemo(() => memberCopy({ ...state, stage: null }, user, resume), [state, user, resume]);
  const first = useMemo(() => memberCopy({ ...state, stage: 'first' }, user, resume), [state, user, resume]);
  return { status, state, active, first, resume };
}

function readStartOnPreference() {
  try { return window.localStorage.getItem(START_ON_KEY); } catch { return null; }
}

// Decision D2: a confirmed member who opens mockmob.in fresh goes straight to their start page
// (Practice unless they chose otherwise in Account). Returns the start page for the note below.
function useStartPage(state) {
  const router = useRouter();
  const [startOn, setStartOn] = useState(null);
  useEffect(() => {
    const preference = readStartOnPreference();
    let alive = true;
    queueMicrotask(() => { if (alive) setStartOn(parseStartOn(preference)); });
    // Every confirmed decision latches for the life of this document, "stay on home" included, so
    // a later click on the logo (the external referrer never changes in the app) stays home.
    const { latch, destination } = startRedirectPlan({
      latched: startRedirectDone(), preference, state, landedOnHome: landedOnHome(), referrer: document.referrer,
      origin: window.location.origin, search: window.location.search, navigationType: navigationType(),
    });
    if (latch) markStartRedirect();
    if (destination) {
      router.replace(destination);
    } else if (!latch && !startRedirectDone() && state.kind === 'member' && landedOnHome() && parseStartOn(preference) !== 'home') {
      // While the session check runs, warm the likely destination so the move is quick.
      try { router.prefetch(START_ON_OPTIONS.find((o) => o.id === parseStartOn(preference))?.href || PRACTICE_HREF); } catch { /* prefetch is a hint */ }
    }
    return () => { alive = false; };
  }, [state, router]);
  return startOn;
}

// Shown when the session check could not reach MockMob. The student is still signed in.
function UnreachableNote() {
  const { refreshSession } = useAuth();
  const [trying, setTrying] = useState(false);
  return (
    <p className="vs-offline vs-member-only" role="status">
      <span>Can’t reach MockMob right now. You’re still signed in.</span>
      <button
        type="button"
        disabled={trying}
        onClick={async () => {
          setTrying(true);
          try { await refreshSession({ silent: true }); } finally { setTrying(false); }
        }}
      >
        {trying ? 'Trying again…' : 'Try again'}
      </button>
    </p>
  );
}

function HeroVersion({ copy, planKind, className }) {
  return (
    <div className={className}>
      <div className="lp-title vs-title" role="heading" aria-level={1}>
        <span className="lp-title__line">{copy.greeting}.</span>
        <span className="lp-title__line lp-title__morph">{copy.title}</span>
      </div>
      <p className="lp-lead">{copy.line}</p>
      <p className="vs-plan">
        <i aria-hidden="true" data-plan={planKind} />
        <span>{copy.plan}</span>
        {copy.planDetail ? <span>{copy.planDetail}</span> : null}
      </p>
      <div className="lp-cta">
        <div className={copy.secondary ? 'mm-actions' : 'mm-actions vs-single'}>
          <Link href={copy.primary.href} className="mm-btn mm-btn--primary">{copy.primary.label}</Link>
          {copy.secondary ? <Link href={copy.secondary.href} className="mm-btn mm-btn--secondary">{copy.secondary.label}</Link> : null}
        </div>
      </div>
    </div>
  );
}

export function MemberHeroCopy() {
  const { status, state, active, first } = useMember();
  const startOn = useStartPage(state);
  const startLabel = START_ON_OPTIONS.find((option) => option.id === startOn)?.label;
  const planKind = state.plan || 'free';
  return (
    <>
      {/* display: contents keeps the hero grid exactly as before; each wrapper is only a switch. */}
      <HeroVersion copy={active} planKind={planKind} className="vs-member-only vs-hide-first vs-contents" />
      <HeroVersion copy={first} planKind={planKind} className="vs-member-only vs-first-only vs-contents" />
      {status === 'unavailable' ? <UnreachableNote /> : null}
      {state.confirmed && startLabel ? (
        <p className="vs-start-note vs-member-only">
          <span>{startOn === 'home' ? 'Visits to mockmob.in open this page.' : `Visits to mockmob.in open ${startLabel}.`}</span>
          <Link href="/profile#start-on">Change start page</Link>
        </p>
      ) : null}
    </>
  );
}

const SHORTCUTS = [
  { href: PRACTICE_HREF, title: 'Practice', note: 'Drills and full mocks on the exam clock' },
  { href: '/review', title: 'Review your mistakes', note: 'Replay a session and see where marks went' },
  { href: '/analytics', title: 'Weak chapters', note: 'The chapter to fix first' },
];

// Day one: nothing to review yet, so the card points at what is useful before a first session.
const FIRST_SHORTCUTS = [
  { href: PRACTICE_HREF, title: 'Practice', note: 'Choose any subject, length and mode' },
  { href: '/cuet-cutoff-calculator', title: 'DU cutoffs and eligibility', note: 'See which courses your subjects open' },
];

function ShortcutList({ items }) {
  return (
    <ul className="vs-card__list">
      {items.map((item) => (
        <li key={item.href}><Link href={item.href}><span><b>{item.title}</b><small>{item.note}</small></span><Icon name="chevR" aria-hidden="true" /></Link></li>
      ))}
    </ul>
  );
}

export function MemberCard() {
  const { active, resume } = useMember();
  return (
    <aside className="vs-card vs-member-only" aria-label={resume ? 'Pick up where you stopped' : 'Where to next'}>
      <p className="vs-card__head">{resume ? 'Pick up where you stopped' : 'Where to next'}</p>
      {resume ? (
        <ul className="vs-card__list">
          <li><Link href={resume.href}><span><b>{active.primary.label}</b><small>{resume.minutesLeft} min left. Answers are saved on this device.</small></span><Icon name="chevR" aria-hidden="true" /></Link></li>
        </ul>
      ) : null}
      <div className="vs-hide-first vs-contents"><ShortcutList items={SHORTCUTS} /></div>
      <div className="vs-first-only vs-contents"><ShortcutList items={FIRST_SHORTCUTS} /></div>
    </aside>
  );
}

// Signed out, been here before: a reason to log in, above the usual hero.
export function ReturningNote() {
  return (
    <p className="vs-welcome vs-returning-only">
      <b>Welcome back.</b> Log in to pick up your mistakes, your weak chapters and tonight’s next step.
    </p>
  );
}
