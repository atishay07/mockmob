"use client";

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { useResumableTest } from '@/components/VisitorSync';
import { FIRST_CHECK_HREF, PRACTICE_HREF } from '@/../data/visitor_state.mjs';

// The signed-in side of the mobile dock (shown through <html data-visitor>, like the rest of the
// page, so the server HTML is the same for everyone). The line beside the button only appears when
// there is a test to pick up; otherwise the one action takes the whole width.
export default function MemberDockAction() {
  const resume = useResumableTest();
  return (
    <>
      {resume ? <p className="mm-dock__note vs-member-only">Pick up where you left off.</p> : null}
      {resume ? (
        <Link href={resume.href} className="mm-btn mm-btn--primary vs-member-only">
          Resume your test
          <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
        </Link>
      ) : (
        <>
          <Link href={PRACTICE_HREF} className="mm-btn mm-btn--primary vs-member-only vs-hide-first vs-solo">
            Continue practice
            <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
          </Link>
          <Link href={FIRST_CHECK_HREF} className="mm-btn mm-btn--primary vs-member-only vs-first-only vs-solo">
            Start your first check
            <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
          </Link>
        </>
      )}
    </>
  );
}
