import React from 'react';
import Link from 'next/link';
import { ARENA_HREF } from '@/../data/visitor_state.mjs';
import { Icon } from '@/components/ui/Icons';

// Thumb-zone action bar. Mobile only: on desktop the nav CTA carries this job, so the bar is
// display:none rather than duplicated. A signed-in student always gets the way into the Arena
// (shown through <html data-visitor>, so there is no flash while the sign-in check runs).
export function MobileDock({ note = 'Free to start. No card.', label, href }) {
  const arrow = <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />;
  return (
    <>
      <div className="mm-dockpad" aria-hidden="true" />
      <div className="mm-dock">
        <p className="mm-dock__note vs-guest-only">{note}</p>
        <p className="mm-dock__note vs-member-only">Pick up where you left off.</p>
        <Link href={href || '/signup'} className="mm-btn mm-btn--primary vs-guest-only">{label || 'Start free'}{arrow}</Link>
        <Link href={ARENA_HREF} className="mm-btn mm-btn--primary vs-member-only">Enter the Arena{arrow}</Link>
      </div>
    </>
  );
}
