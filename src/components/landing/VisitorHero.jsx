"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';
import { readHint, landedOnHome, arenaRedirectDone, markArenaRedirect } from '@/components/VisitorSync';
import { ARENA_FIRST_KEY, ARENA_HREF, findResumableTest, memberCopy, shouldEnterArena, visitorState } from '@/../data/visitor_state.mjs';

// The signed-in side of the home page. Each export is shown only to signed-in students (the
// vs-member-only class is toggled by <html data-visitor>), so signed-out visitors and search
// engines get the marketing page untouched.

function useMember() {
  const { status, user } = useAuth();
  // Read after mount so the server and first client render agree.
  const [resume, setResume] = useState(null);
  const [hint, setHint] = useState(null);
  useEffect(() => {
    setHint(readHint());
    if (status !== 'authenticated' || !user?.id) { setResume(null); return; }
    try { setResume(findResumableTest(window.localStorage, user.id)); } catch { setResume(null); }
  }, [status, user?.id]);
  const state = useMemo(() => visitorState({ status, user, hint }), [status, user, hint]);
  const copy = useMemo(() => memberCopy(state, user, resume), [state, user, resume]);
  return { state, copy, resume };
}

// Opens the Arena straight away for students who chose that, on a fresh visit to "/" only.
function useArenaFirst(state) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let pref = null;
    try { pref = window.localStorage.getItem(ARENA_FIRST_KEY); } catch { /* storage is optional */ }
    setEnabled(pref === '1');
    if (arenaRedirectDone()) return;
    if (shouldEnterArena({ preference: pref, state, landedOnHome: landedOnHome(), referrer: document.referrer, origin: window.location.origin, search: window.location.search })) {
      markArenaRedirect();
      router.replace(ARENA_HREF);
    }
  }, [state, router]);
  const toggle = (on) => {
    setEnabled(on);
    try { if (on) window.localStorage.setItem(ARENA_FIRST_KEY, '1'); else window.localStorage.removeItem(ARENA_FIRST_KEY); } catch { /* storage is optional */ }
  };
  return [enabled, toggle];
}

export function MemberHeroCopy() {
  const { state, copy } = useMember();
  const [arenaFirst, setArenaFirst] = useArenaFirst(state);
  return (
    <>
      <div className="lp-title vs-title vs-member-only" role="heading" aria-level={1}>
        <span className="lp-title__line">{copy.eyebrow}.</span>
        <span className="lp-title__line lp-title__morph">{copy.title}</span>
      </div>
      <p className="lp-lead vs-member-only">{copy.line}</p>
      <p className="vs-plan vs-member-only">
        <i aria-hidden="true" data-plan={state.plan || 'free'} />
        <span>{copy.plan}</span>
        {copy.unlimited ? <span>{copy.unlimited}</span> : null}
      </p>
      <div className="lp-cta vs-member-only">
        <div className="mm-actions">
          <Link href={copy.primary.href} className="mm-btn mm-btn--primary">{copy.primary.label}<Icon name="arrow" className="mm-btn__icon" aria-hidden="true" /></Link>
          <Link href={copy.secondary.href} className="mm-btn mm-btn--secondary">{copy.secondary.label}</Link>
        </div>
      </div>
      <label className="vs-pref vs-member-only">
        <input type="checkbox" checked={arenaFirst} onChange={(event) => setArenaFirst(event.target.checked)} />
        <span>Open the Arena first when I visit mockmob.in</span>
      </label>
    </>
  );
}

const SHORTCUTS = [
  { href: ARENA_HREF, title: 'Practice', note: 'Drills and full mocks on the exam clock' },
  { href: '/review', title: 'Review your mistakes', note: 'Replay a session and see where marks went' },
  { href: '/analytics', title: 'Radar', note: 'The chapter to fix first' },
];

export function MemberCard() {
  const { copy, resume } = useMember();
  return (
    <aside className="vs-card vs-member-only" aria-label="Where to next">
      <p className="vs-card__head">{resume ? 'Pick up where you stopped' : 'Where to next'}</p>
      <ul className="vs-card__list">
        {resume ? (
          <li><Link href={resume.href}><span><b>{copy.primary.label}</b><small>{resume.minutesLeft} min left. Answers are saved on this device.</small></span><Icon name="chevR" aria-hidden="true" /></Link></li>
        ) : null}
        {SHORTCUTS.map((item) => (
          <li key={item.href}><Link href={item.href}><span><b>{item.title}</b><small>{item.note}</small></span><Icon name="chevR" aria-hidden="true" /></Link></li>
        ))}
      </ul>
    </aside>
  );
}

// Signed out, been here before: a reason to sign in, above the usual hero.
export function ReturningNote() {
  return (
    <p className="vs-welcome vs-returning-only">
      <b>Welcome back.</b> Sign in to pick up your mistakes, your Radar and tonight’s next step.
    </p>
  );
}
