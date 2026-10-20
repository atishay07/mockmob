"use client";

// A friend's invite code typed on the sign-up page (owner D165). Closed behind one text key unless an invite is already kept,
// so the form stays one decision. Saving only keeps the code (POST /api/referrals/pending): whether it counts is decided
// after sign-in, for a new account, so this never says a code is valid or whose it is.
import { useState } from 'react';
import { REFERRAL_COPY, codeFromInput, displayReferralCode } from '@/lib/referrals/friendInvite.mjs';

export default function InviteCodeField({ pending = null }) {
  const [open, setOpen] = useState(Boolean(pending));
  const [value, setValue] = useState(pending ? displayReferralCode(pending) : '');
  const [state, setState] = useState(pending ? { kind: 'saved', message: REFERRAL_COPY.signupSaved } : { kind: 'idle', message: REFERRAL_COPY.signupHint });

  if (!open) {
    return (
      <p className="auth-invite">
        <button type="button" className="auth-card__textbtn" onClick={() => setOpen(true)} aria-expanded="false">Have an invite code?</button>
      </p>
    );
  }

  const save = async (event) => {
    event.preventDefault();
    if (!codeFromInput(value)) { setState({ kind: 'error', message: REFERRAL_COPY.signupBad }); return; }
    setState({ kind: 'working', message: 'Saving' });
    try {
      const res = await fetch('/api/referrals/pending', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: value }) });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) setState({ kind: 'saved', message: REFERRAL_COPY.signupSaved });
      else setState({ kind: 'error', message: body?.message || 'The code could not be saved. Try again.' });
    } catch {
      setState({ kind: 'error', message: 'The code could not be saved. Check your connection and try again.' });
    }
  };

  return (
    <form className="auth-invite auth-card__form" onSubmit={save} noValidate>
      <label className="auth-field">
        <span>{REFERRAL_COPY.signupField}</span>
        <input
          className="input"
          value={value}
          onChange={(e) => { setValue(e.target.value); if (state.kind !== 'working') setState({ kind: 'idle', message: REFERRAL_COPY.signupHint }); }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={60}
          aria-describedby="auth-invite-note"
          aria-invalid={state.kind === 'error' || undefined}
        />
        <small id="auth-invite-note" role={state.kind === 'error' ? 'alert' : 'status'}>{state.message}</small>
      </label>
      <button type="submit" className="mm-btn mm-btn--secondary" disabled={state.kind === 'working' || !value.trim()}>Save code</button>
    </form>
  );
}
