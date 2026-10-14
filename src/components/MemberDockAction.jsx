"use client";

import React from 'react';
import Link from 'next/link';
import { useResumableTest } from '@/components/VisitorSync';
import { FIRST_CHECK_HREF, PRACTICE_HREF } from '@/lib/navigation';

// The signed-in side of the mobile dock (shown through <html data-visitor>, like the rest of the
// page, so the server HTML is the same for everyone). One action: Resume your test while a saved
// test exists, else Start your first check for a member with no session yet, else Continue
// practice. The line beside the button only appears when there is a test to pick up.
export default function MemberDockAction() {
  const resume = useResumableTest();
  if (resume) {
    return (
      <>
        <p className="mm-dock__note vs-member-only">Pick up where you left off.</p>
        <Link href={resume.href} className="mm-btn mm-btn--primary vs-member-only">Resume your test</Link>
      </>
    );
  }
  return (
    <>
      <Link href={FIRST_CHECK_HREF} className="mm-btn mm-btn--primary vs-member-only vs-first-only vs-solo">Start your first check</Link>
      <Link href={PRACTICE_HREF} className="mm-btn mm-btn--primary vs-member-only vs-started-only vs-solo">Continue practice</Link>
    </>
  );
}
