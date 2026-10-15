"use client";

// Sign out of this browser. It never signs out on the first tap: the row opens a short confirm with
// "Stay signed in" first. Signing out clears this device's study drafts (AuthProvider.signOut) and
// leaves a returning hint, so the next visit offers Log in first. After it, the student lands on the
// public home page. Sign out of other devices is a separate control on Account.
import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { rememberSignedOut } from '@/components/shell/shellSignals';
import './you.css';

const COPY = {
  label: 'Sign out',
  ask: 'Sign out of MockMob on this browser? A practice or mock you have open here is cleared from this browser.',
  plain: 'You will need to sign in again to use MockMob on this browser.',
  stay: 'Stay signed in',
  go: 'Sign out',
  working: 'Signing out',
  failed: 'We could not sign you out. Try again.',
  preview: 'Preview only: you stay signed in here.',
};

const inPreview = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/');

/** layout 'row' sits in the You hub's list; 'card' is the Sign-in card on Account. */
export default function SignOutControl({ layout = 'row' }) {
  const { signOut } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | confirm | working
  const [error, setError] = useState('');
  const trigger = useRef(null);
  const stay = useRef(null);
  const wasOpen = useRef(false);

  // Focus moves to the safe choice when the confirm opens, and back to the row when it closes.
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
      rememberSignedOut();
      await signOut();
      window.location.assign('/');
    } catch {
      setError(COPY.failed);
      setPhase('confirm');
    }
  }

  const onEscape = (event) => { if (event.key === 'Escape' && phase === 'confirm') { event.stopPropagation(); setPhase('idle'); } };

  const keys = (
    <div className="you-confirm__keys">
      <button ref={stay} type="button" className="you-key" disabled={phase === 'working'} onClick={() => setPhase('idle')}>{COPY.stay}</button>
      <button type="button" className="you-key you-key--danger" disabled={phase === 'working'} onClick={confirm}>{phase === 'working' ? COPY.working : COPY.go}</button>
    </div>
  );

  if (layout === 'card') {
    return (
      <div className="you-card" id="sign-out" onKeyDown={onEscape}>
        <h2>Sign out</h2>
        <p>{phase === 'confirm' || phase === 'working' ? COPY.ask : COPY.plain}</p>
        {phase === 'idle' ? (
          <div><button ref={trigger} type="button" className="you-key" onClick={() => { setError(''); setPhase('confirm'); }}>{COPY.label}</button></div>
        ) : keys}
        <p className="you-note" role={error === COPY.preview ? 'status' : 'alert'} data-tone={error && error !== COPY.preview ? 'err' : undefined}>{error}</p>
      </div>
    );
  }

  return (
    <div onKeyDown={onEscape}>
      <button ref={trigger} type="button" className="you-row you-row--danger" hidden={phase !== 'idle'} onClick={() => { setError(''); setPhase('confirm'); }}>
        <span className="you-row__icon"><LogOut size={20} strokeWidth={1.75} aria-hidden="true" /></span>
        <span className="you-row__text"><span className="you-row__label">{COPY.label}</span></span>
        <span />
      </button>
      {phase !== 'idle' ? (
        <div className="you-confirm" role="group" aria-label="Confirm sign out">
          <p>{COPY.ask}</p>
          {keys}
          <p className="you-note you-confirm__err" role="alert">{error}</p>
        </div>
      ) : null}
      {phase === 'idle' && error ? <p className="you-note" role="status" style={{ padding: '0 6px 12px' }}>{error}</p> : null}
    </div>
  );
}
