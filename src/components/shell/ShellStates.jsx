"use client";

import React, { useState } from 'react';
import './shell.css';

// What the signed-in shell shows in the page area before the page itself can render.

// The first sign-in check is still running. Same rough shape as a page (a heading, a summary, the
// work), so nothing jumps when the page arrives. No wording beyond the screen-reader status.
export function ShellPageSkeleton({ label = 'Loading your page' }) {
  return (
    <div className="shell-skel" role="status" aria-busy="true">
      <span className="shell-sr">{label}</span>
      <span className="shell-skel__bar shell-skel__bar--title" aria-hidden="true" />
      <span className="shell-skel__bar shell-skel__bar--line" aria-hidden="true" />
      <span className="shell-skel__block" aria-hidden="true" />
      <span className="shell-skel__block shell-skel__block--short" aria-hidden="true" />
    </div>
  );
}

// MockMob could not be reached (state S7). A member (by the stored hint) is told they are still
// signed in, the menus still work, and Try again re-runs the check. Anyone else gets the same screen
// without any claim about their sign-in (`signedIn` false).
export function ShellUnavailable({ onRetry, signedIn = true }) {
  const [trying, setTrying] = useState(false);
  async function retry() {
    if (trying) return;
    setTrying(true);
    try { await onRetry?.(); } finally { setTrying(false); }
  }
  return (
    <section className="shell-unavail" role="alert" aria-labelledby="shell-unavail-title">
      <h1 id="shell-unavail-title">Can&apos;t reach MockMob</h1>
      <p>{signedIn ? 'You are still signed in. We could not load your account just now.' : 'We could not check your sign-in just now.'} Check your connection, then try again.</p>
      <button type="button" className="shell-btn" onClick={retry} disabled={trying} aria-busy={trying || undefined}>
        {trying ? 'Trying again' : 'Try again'}
      </button>
    </section>
  );
}
