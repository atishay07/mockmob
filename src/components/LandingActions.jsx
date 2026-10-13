import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { recoveryReleased } from '@/../data/capabilities';
import { ARENA_HREF } from '@/../data/visitor_state.mjs';

// Every variant is rendered; <html data-visitor> (set before first paint) shows the right one.
// That keeps the first paint correct for signed-in students without waiting for the auth check.
//   new         Try five questions, then Start free practice
//   returning   Sign in first, then the sample
//   member      Enter the Arena
export function LandingActions({ mode = 'hero' }) {
  const startHref = recoveryReleased() ? '/signup?next=%2Frecovery' : '/signup';
  const startText = recoveryReleased() ? 'Find my first gap' : 'Start free practice';
  const arrow = <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />;

  if (mode === 'primary') {
    return (
      <div className="mm-actions">
        <Link href={startHref} className="mm-btn mm-btn--primary vs-guest-only">{startText}{arrow}</Link>
        <Link href={ARENA_HREF} className="mm-btn mm-btn--primary vs-member-only">Enter the Arena{arrow}</Link>
      </div>
    );
  }

  return (
    <div className="mm-actions vs-guest-only">
      <Link href="/#try-practice" className="mm-btn mm-btn--primary vs-new-only">Try five questions{arrow}</Link>
      <Link href={startHref} className="mm-btn mm-btn--secondary vs-new-only">{startText}</Link>
      <Link href="/login" className="mm-btn mm-btn--primary vs-returning-only">Sign in{arrow}</Link>
      <Link href="/#try-practice" className="mm-btn mm-btn--secondary vs-returning-only">Try five questions</Link>
    </div>
  );
}
