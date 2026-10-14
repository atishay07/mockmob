import React from 'react';
import Link from 'next/link';
import MemberDockAction from '@/components/MemberDockAction';

// Thumb-zone action bar. Mobile only: on desktop the header action carries this job, so the bar is
// display:none rather than duplicated. A visitor gets the page's own action (Start free by default);
// a signed-in student gets their one action instead (Resume your test, Start your 10-question check or
// Continue practice), chosen through <html data-visitor> so there is no flash while the sign-in
// check runs.
export function MobileDock({ note = 'Free to start. No card.', label, href }) {
  return (
    <>
      <div className="mm-dockpad" aria-hidden="true" />
      <div className="mm-dock">
        <p className="mm-dock__note vs-guest-only">{note}</p>
        <Link href={href || '/signup'} className="mm-btn mm-btn--primary vs-guest-only">{label || 'Start free'}</Link>
        <MemberDockAction />
      </div>
    </>
  );
}
