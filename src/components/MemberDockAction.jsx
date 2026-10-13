"use client";

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { useResumableTest } from '@/components/VisitorSync';
import { ARENA_HREF } from '@/../data/visitor_state.mjs';

// The signed-in side of the mobile dock (shown through <html data-visitor>, like the rest of the
// page, so the server HTML is the same for everyone). The line beside the button only appears when
// there is a test to pick up; otherwise the one action takes the whole width.
export default function MemberDockAction() {
  const resume = useResumableTest();
  return (
    <>
      {resume ? <p className="mm-dock__note vs-member-only">Pick up where you left off.</p> : null}
      <Link href={resume ? resume.href : ARENA_HREF} className={`mm-btn mm-btn--primary vs-member-only${resume ? '' : ' vs-solo'}`}>
        {resume ? 'Resume your test' : 'Enter the Arena'}
        <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
      </Link>
    </>
  );
}
