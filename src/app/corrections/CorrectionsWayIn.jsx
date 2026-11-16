'use client';
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { REPORT } from './correctionsCopy.mjs';

// The way in under "Found a mistake?" on /corrections. A report is made from a student's own result, so a guest's next step
// is an account: the page's one volt key, "Sign up free", with "Log in" beside it. A signed-in student already has the way
// in and gets a quiet key to Practice, where their papers are. While the session is still being read the guest pair shows
// (as the footer's does), and both states are one row of 54 px keys, so nothing below moves when it settles.
export default function CorrectionsWayIn() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return (
      <div className="cx-way">
        <p className="cx-way__line">{REPORT.student}</p>
        <div className="mm-actions">
          <Link href="/dashboard" className="mm-btn mm-btn--secondary">Go to Practice</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="cx-way">
      <p className="cx-way__line">{REPORT.guest}</p>
      <div className="mm-actions">
        <Link href="/signup" className="mm-btn mm-btn--primary">Sign up free</Link>
        <Link href="/login" className="mm-btn mm-btn--secondary">Log in</Link>
      </div>
    </div>
  );
}
