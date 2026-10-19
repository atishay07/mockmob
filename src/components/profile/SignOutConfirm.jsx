"use client";

// The one Sign out confirm (owner G29; release 11 walk, 19 Oct: the top bar and the phone's You sheet signed out on the
// first tap while the Account page asked first). Every Sign out key in the signed-in site is this button: the Account
// actions row, the line under the Account title, the top bar and the phone's You sheet. A tap never signs out by itself:
// it opens a small modal (native <dialog>: the page behind is inert, Escape and a press outside close it) that asks
// "Sign out here?" with "Stay signed in" first and focused. Signing out clears this browser's study drafts
// (AuthProvider.signOut), then the student lands on the public home page. The message line is mounted with the dialog,
// so a failure or the preview note is announced when it appears (verifier L9).
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import './signout-confirm.css';

export const SIGN_OUT_COPY = Object.freeze({
  title: 'Sign out',
  plain: 'Sign out of MockMob in this browser. Your history stays with your account, ready when you sign in again.',
  ask: 'Sign out here?',
  askDetail: 'A practice or mock you have open in this browser is cleared from it. Your history stays with your account.',
  stay: 'Stay signed in',
  go: 'Sign out',
  working: 'Signing out',
  failed: 'We could not sign you out. Try again.',
  preview: 'Preview only: you stay signed in here.',
});

const inPreview = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/');

/**
 * A Sign out key that confirms first. Its face is `children` (the caller's icon and words) and `className` (the caller's
 * key style), so it looks like the key it replaces wherever it sits.
 */
export function SignOutButton({ className = '', children, onOpen, ...rest }) {
  const { signOut } = useAuth();
  const dialog = useRef(null);
  const trigger = useRef(null);
  const stay = useRef(null);
  const titleId = useId();
  const textId = useId();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState({ text: '', tone: null });

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      try { el.showModal(); } catch { el.setAttribute('open', ''); }
      stay.current?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // A native close (Escape, the Stay key, a press outside) puts focus back on the key that opened it.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    const onClose = () => {
      setOpen(false);
      setWorking(false);
      trigger.current?.focus({ preventScroll: true });
    };
    el.addEventListener('close', onClose);
    return () => el.removeEventListener('close', onClose);
  }, []);

  const show = () => { setNote({ text: '', tone: null }); setOpen(true); onOpen?.(); };
  const hide = () => { if (!working) dialog.current?.close(); };

  async function confirm() {
    if (working) return;
    if (inPreview()) { setNote({ text: SIGN_OUT_COPY.preview, tone: null }); return; }
    setNote({ text: '', tone: null });
    setWorking(true);
    try {
      await signOut();
      window.location.assign('/');
    } catch {
      setWorking(false);
      setNote({ text: SIGN_OUT_COPY.failed, tone: 'err' });
    }
  }

  // A press on the backdrop lands on the <dialog> itself, outside its box.
  const onDialogClick = (event) => {
    if (event.target !== dialog.current) return;
    const box = dialog.current.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) hide();
  };

  return (
    <>
      <button ref={trigger} type="button" className={className} aria-haspopup="dialog" onClick={show} {...rest}>{children}</button>
      <dialog ref={dialog} className="so-dialog" aria-labelledby={titleId} aria-describedby={textId} onClick={onDialogClick}
        onCancel={(event) => { if (working) event.preventDefault(); }}>
        <div className="so-dialog__body">
          <h2 id={titleId} className="so-dialog__title">{SIGN_OUT_COPY.ask}</h2>
          <p id={textId} className="so-dialog__text">{SIGN_OUT_COPY.askDetail}</p>
          <div className="so-dialog__keys">
            <button ref={stay} type="button" className="so-key" disabled={working} onClick={hide}>{SIGN_OUT_COPY.stay}</button>
            <button type="button" className="so-key so-key--danger" disabled={working} aria-busy={working || undefined} onClick={confirm}>
              {working ? SIGN_OUT_COPY.working : SIGN_OUT_COPY.go}
            </button>
          </div>
          <p className="so-dialog__note" role="status" aria-live="polite" data-tone={note.tone || undefined}>{note.text}</p>
        </div>
      </dialog>
    </>
  );
}

export default SignOutButton;
