import React from 'react';
import Link from 'next/link';
import MemberDockAction from '@/components/MemberDockAction';
import { Icon } from '@/components/ui/Icons';

// Thumb-zone action bar. Mobile only: on desktop the nav CTA carries this job, so the bar is
// display:none rather than duplicated. A signed-in student always gets the way into the Arena, or
// back into a test they left (shown through <html data-visitor>, so there is no flash while the
// sign-in check runs).
export function MobileDock({ note = 'Free to start. No card.', label, href }) {
  return (
    <>
      <div className="mm-dockpad" aria-hidden="true" />
      <div className="mm-dock">
        <p className="mm-dock__note vs-guest-only">{note}</p>
        <Link href={href || '/signup'} className="mm-btn mm-btn--primary vs-guest-only">{label || 'Start free'}<Icon name="arrow" className="mm-btn__icon" aria-hidden="true" /></Link>
        <MemberDockAction />
      </div>
    </>
  );
}
