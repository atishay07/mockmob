"use client";

import React from 'react';
import Link from 'next/link';
import { useResumableTest } from '@/components/VisitorSync';
import { audienceClass, memberDockActions } from '@/lib/navigation';

// The signed-in side of the mobile dock (shown through <html data-visitor>, like the rest of the
// page, so the server HTML is the same for everyone). One action, from the navigation source:
// Resume your test while a saved test exists, else Start your first check for a member with no
// session yet, else Continue practice. The line beside the button only appears when there is a
// test to pick up.
export default function MemberDockAction() {
  const resume = useResumableTest();
  return (
    <>
      {resume ? <p className="mm-dock__note vs-member-only">Pick up where you left off.</p> : null}
      {memberDockActions(resume).map((action) => (
        <Link key={action.id} href={action.href} className={`mm-btn mm-btn--primary ${audienceClass(action.show)}${resume ? '' : ' vs-solo'}`}>
          {action.label}
        </Link>
      ))}
    </>
  );
}
