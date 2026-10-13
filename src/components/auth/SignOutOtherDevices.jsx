"use client";

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/AuthProvider';

const RESULT_COPY = {
  ok: 'Done. Other browsers and phones are signed out and need to sign in again. You are still signed in here.',
  offline: 'Could not reach MockMob. Check your connection, then try again. Nothing changed.',
  signed_out: 'Your session here has ended. Sign in again, then try this.',
  failed: 'That did not work. Try again in a minute.',
};

// "Sign out of other devices" for the account page. Uses the profile page's privacy-block styles.
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
    <section className="glass p-6 privacy-block" aria-labelledby="other-devices-title">
      <div>
        <div className="mono-label mb-2">Sign-in</div>
        <h2 id="other-devices-title">Sign out of other devices</h2>
      </div>
      <p>Signed in on a shared or lost phone? This ends MockMob on every other browser and phone, the app included. You stay signed in here.</p>
      <div>
        <Button variant="outline" size="md" disabled={busy} onClick={run}>
          {busy ? 'Signing out other devices' : 'Sign out other devices'}
        </Button>
      </div>
      {result && (
        <p className={`privacy-note ${result === 'ok' ? 'privacy-note--ok' : 'privacy-note--err'}`} role={result === 'ok' ? 'status' : 'alert'}>
          {RESULT_COPY[result] || RESULT_COPY.failed}
        </p>
      )}
    </section>
  );
}
