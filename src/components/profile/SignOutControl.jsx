"use client";

// Account > Sign out of this browser. It never signs out on the first tap: the button opens a short
// confirm with "Stay signed in" first and focused. Signing out clears this browser's study drafts
// (AuthProvider.signOut), then the student lands on the public home page, as the top bar's sign out
// does. Signing out other devices is its own section on this page.
import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import './account.css';

const COPY = {
  title: 'Sign out of this browser',
  plain: 'You will need to sign in again to use MockMob here. Your history stays with your account.',
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
    <div className="acct-signout" onKeyDown={onKeyDown}>
      <div className="acct-signout__text">
        <h3 id="acct-signout-h">{COPY.title}</h3>
        <p>{open ? COPY.ask : COPY.plain}</p>
      </div>
      {open ? (
        <div className="acct-signout__keys" role="group" aria-labelledby="acct-signout-h">
          <button ref={stay} type="button" className="acct-key" disabled={phase === 'working'} onClick={() => setPhase('idle')}>{COPY.stay}</button>
          <button type="button" className="acct-key acct-key--danger" disabled={phase === 'working'} onClick={confirm}>{phase === 'working' ? COPY.working : COPY.go}</button>
        </div>
      ) : (
        <div className="acct-signout__keys">
          <button ref={trigger} type="button" className="acct-key" onClick={() => { setError(''); setPhase('confirm'); }}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />{COPY.go}
          </button>
        </div>
      )}
      <p className="acct-note" role={error && error !== COPY.preview ? 'alert' : 'status'} data-tone={error && error !== COPY.preview ? 'err' : undefined}>{error}</p>
    </div>
  );
}
