"use client";

import React, { useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

const RESULT_COPY = {
  ok: 'Done. Other browsers and phones are signed out and need to sign in again. You are still signed in here.',
  offline: 'Could not reach MockMob. Check your connection, then try again. Nothing changed.',
  signed_out: 'Your session here has ended. Sign in again, then try this.',
  failed: 'That did not work. Try again in a minute.',
};

// "Sign out of other devices" (the heading and the key say the same words): the second row of the account page's Account actions group (owner G29, 19 Oct), under the
// plain Sign out and above Delete account. It uses the group's row styles (src/components/profile/account.css, .acct-act).
export function SignOutOtherDevicesSection() {
  const { signOutOtherDevices } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const busyRef = useRef(false);

  async function run() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setResult(null);
    try {
      const outcome = await signOutOtherDevices();
      setResult(outcome.ok ? 'ok' : outcome.code || 'failed');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="acct-act" role="group" aria-labelledby="other-devices-title">
      <div className="acct-act__text">
        <h3 id="other-devices-title">Sign out of other devices</h3>
        <p>Signed in on a shared or lost phone? This ends MockMob on every other browser and phone, the app included. You stay signed in here.</p>
      </div>
      <div className="acct-act__keys">
        <button type="button" className="acct-key" disabled={busy} aria-busy={busy || undefined} onClick={run}>
          {busy ? 'Signing out of other devices' : 'Sign out of other devices'}
        </button>
      </div>
      {/* The message line is always mounted (an empty live region until there is news), so what it says is announced. */}
      <p className="acct-note" data-tone={result ? (result === 'ok' ? 'ok' : 'err') : undefined} role="status" aria-live="polite">
        {result ? RESULT_COPY[result] || RESULT_COPY.failed : ''}
      </p>
    </div>
  );
}
