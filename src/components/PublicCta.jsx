"use client";

import React from 'react';
import Link from 'next/link';
import { useResumableTest } from '@/components/VisitorSync';
import { buttonClass } from '@/components/ui/Button';
import { audienceClass, memberDockActions } from '@/lib/navigation';

// The signed-in action on a public page (web redesign W2.2). Guests keep the page's own actions;
// a signed-in student sees the one action the header and the mobile dock already show for them:
// Resume your test while a saved test exists, else Start your 10-question check before the first
// scored session, else Continue practice. All variants are rendered and <html data-visitor> picks
// one before first paint (src/app/visitor.css), so the server HTML is the same for everyone and a
// crawler reads the guest page. No trailing arrow.
export function MemberAction({ variant = 'primary', size = 'lg', className = '' }) {
  const resume = useResumableTest();
  return memberDockActions(resume).map((action) => (
    <Link
      key={action.id}
      href={action.href}
      className={`${buttonClass({ variant, size, className })} ${audienceClass(action.show)}`.trim()}
    >
      {action.label}
    </Link>
  ));
}
