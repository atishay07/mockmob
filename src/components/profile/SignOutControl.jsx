"use client";

// Account > Account actions > Sign out (owner G29, 19 Oct: "I seriously don't see sign out of this browser"). It is the
// first row of the Account actions group, above "Sign out of other devices" and "Delete account", and it is labelled in
// words wherever it appears (this page, the top bar, the phone's More sheet). It never signs out on the first tap: the
// button opens a short confirm with "Stay signed in" first and focused. Signing out clears this browser's study drafts
// (AuthProvider.signOut), then the student lands on the public home page, as the top bar's sign out does.
import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import './account.css';

const COPY = {
  title: 'Sign out',
  plain: 'Sign out of MockMob in this browser. Your history stays with your account, ready when you sign in again.',
  ask: 'Sign out here? A practice or mock you have open in this browser is cleared from it.',
  stay: 'Stay signed in',
  go: 'Sign out',
  working: 'Signing out',
  failed: 'We could not sign you out. Try again.',
  preview: 'Preview only: you stay signed in here.',
};

const inPreview = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/');

export default function SignOutControl() {
  const { signOut } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | confirm | working
  const [error, setError] = useState('');
  const trigger = useRef(null);
  const stay = useRef(null);
  const wasOpen = useRef(false);

  // Focus moves to the safe choice when the confirm opens, and back to the button when it closes.
  useEffect(() => {
    if (phase === 'confirm') { stay.current?.focus(); wasOpen.current = true; }
    else if (phase === 'idle' && wasOpen.current) { wasOpen.current = false; trigger.current?.focus(); }
  }, [phase]);

  async function confirm() {
    if (phase === 'working') return;
    setError('');
    if (inPreview()) { setError(COPY.preview); setPhase('idle'); return; }
    setPhase('working');
    try {
      await signOut();
      window.location.assign('/');
    } catch {
      setError(COPY.failed);
      setPhase('confirm');
    }
  }

  const onKeyDown = (event) => { if (event.key === 'Escape' && phase === 'confirm') { event.stopPropagation(); setPhase('idle'); } };
  const open = phase !== 'idle';

  return (
    <div className="acct-act acct-signout" onKeyDown={onKeyDown} data-open={open || undefined}>
      <div className="acct-act__text">
        <h3 id="acct-signout-h">{COPY.title}</h3>
        <p>{open ? COPY.ask : COPY.plain}</p>
      </div>
      {open ? (
        <div className="acct-act__keys" role="group" aria-labelledby="acct-signout-h">
          <button ref={stay} type="button" className="acct-key" disabled={phase === 'working'} onClick={() => setPhase('idle')}>{COPY.stay}</button>
          <button type="button" className="acct-key acct-key--danger" disabled={phase === 'working'} onClick={confirm}>{phase === 'working' ? COPY.working : COPY.go}</button>
        </div>
      ) : (
        <div className="acct-act__keys">
          <button ref={trigger} type="button" className="acct-key" onClick={() => { setError(''); setPhase('confirm'); }}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />{COPY.go}
          </button>
        </div>
      )}
      {error ? <p className="acct-note" role={error !== COPY.preview ? 'alert' : 'status'} data-tone={error !== COPY.preview ? 'err' : undefined}>{error}</p> : null}
    </div>
  );
}
