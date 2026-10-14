import React from 'react';
import Link from 'next/link';
import { recoveryReleased } from '@/../data/capabilities';
import { FIRST_CHECK_HREF, PRACTICE_HREF } from '@/../data/visitor_state.mjs';

// Every variant is rendered; <html data-visitor> and <html data-visitor-stage> (set before first
// paint) show the right one. That keeps the first paint correct for signed-in students without
// waiting for the auth check.
//   new         Try five questions, then Start free practice
//   returning   Log in first, then the sample
//   member      Continue practice, or on day one Start your 10-question check
export function LandingActions({ mode = 'hero' }) {
  const startHref = recoveryReleased() ? '/signup?next=%2Frecovery' : '/signup';
  const startText = recoveryReleased() ? 'Find my first gap' : 'Start free practice';
  if (mode === 'primary') {
    return (
      <div className="mm-actions">
        <Link href={startHref} className="mm-btn mm-btn--primary vs-guest-only">{startText}</Link>
        <Link href={PRACTICE_HREF} className="mm-btn mm-btn--primary vs-member-only vs-hide-first">Continue practice</Link>
        <Link href={FIRST_CHECK_HREF} className="mm-btn mm-btn--primary vs-member-only vs-first-only">Start your 10-question check</Link>
      </div>
    );
  }

  return (
    <div className="mm-actions vs-guest-only">
      <Link href="/#try-practice" className="mm-btn mm-btn--primary vs-new-only">Try five questions</Link>
      <Link href={startHref} className="mm-btn mm-btn--secondary vs-new-only">{startText}</Link>
      <Link href="/login" className="mm-btn mm-btn--primary vs-returning-only">Log in</Link>
      <Link href="/#try-practice" className="mm-btn mm-btn--secondary vs-returning-only">Try five questions</Link>
    </div>
  );
}
