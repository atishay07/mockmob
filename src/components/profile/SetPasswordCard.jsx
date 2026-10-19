"use client";

// Account > Password (20 Oct, owner: the reviewer account signed up with an email code and the web had no way to add a
// password; the app has You > Account > Password). One field with Show, the rule beside it, "Save password" with a working
// state, and "Password saved" only after the server said yes (POST /api/me/password, which makes the same updateUser call the
// app makes, with this browser's own session). The page checks the rule first; the server decides.
//
// Honest states: saving, saved (a drawn check, the line names the email to sign in with and where), or the problem with its
// next step. The password is never stored by the page: it lives in this field and is cleared the moment it is saved.
import { useRef, useState } from 'react';
import { DrawnCheck } from '@/components/ui/DrawnCheck';
import { Button } from '@/components/ui/Button';
import { PASSWORD_COPY, PASSWORD_RULE, checkPassword, passwordProblem } from '@/lib/passwordRules.mjs';
import './account.css';

async function postPassword(password) {
  let res;
  try {
    res = await fetch('/api/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ password }),
    });
  } catch {
    return { ok: false, code: 'offline' };
  }
  const body = await res.json().catch(() => null);
  if (res.ok && body?.ok === true) return { ok: true };
  return { ok: false, code: typeof body?.error === 'string' ? body.error : res.status === 401 ? 'signed_out' : 'unknown' };
}

export default function SetPasswordCard({ email = '' }) {
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState(false);
  const busyRef = useRef(false);

  const ruleMet = checkPassword(password).ok;

  function edit(value) {
    setPassword(value);
    setSaved(false);
    if (problem) setProblem('');
  }

  async function save(event) {
    event.preventDefault();
    if (busyRef.current) return;
    const rule = checkPassword(password);
    setTried(true);
    if (!rule.ok) { setProblem(passwordProblem(rule.code)); return; }
    busyRef.current = true;
    setBusy(true);
    setProblem('');
    setSaved(false);
    try {
      const result = await postPassword(password);
      if (result.ok) {
        setPassword('');
        setShown(false);
        setTried(false);
        setSaved(true);
      } else {
        setProblem(passwordProblem(result.code));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const tone = problem ? 'err' : saved ? 'ok' : undefined;

  return (
    <section className="glass acct-card" id="password" aria-labelledby="acct-password-h">
      <h2 className="acct-h2" id="acct-password-h">{PASSWORD_COPY.title}</h2>
      <p className="acct-lead">{PASSWORD_COPY.lead}</p>
      <form className="acct-pw" onSubmit={save} noValidate aria-busy={busy || undefined}>
        {/* The account this password is for, so the browser's password manager files it under the right email. */}
        <input className="acct-pw__user" type="text" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" />
        <label className="acct-field">
          <span>{PASSWORD_COPY.label}</span>
          <span className="acct-pw__box">
            <input
              className="input"
              type={shown ? 'text' : 'password'}
              name="new-password"
              value={password}
              onChange={(e) => edit(e.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              aria-invalid={problem ? 'true' : undefined}
              aria-describedby="acct-pw-rule acct-pw-note"
            />
            <button type="button" className="acct-pw__show" aria-pressed={shown} onClick={() => setShown((s) => !s)} disabled={busy}>
              {shown ? PASSWORD_COPY.hide : PASSWORD_COPY.show}
            </button>
          </span>
        </label>
        <p id="acct-pw-rule" className="acct-pw__rule" data-met={ruleMet || undefined} data-tried={(tried && !ruleMet) || undefined}>
          {ruleMet ? <DrawnCheck size={14} /> : <span className="acct-pw__dot" aria-hidden="true" />}
          {PASSWORD_RULE}
        </p>
        <div className="acct-card__keys">
          <p id="acct-pw-note" className="acct-note acct-pw__note" data-tone={tone} role={problem ? 'alert' : 'status'} aria-live="polite">
            {problem
              ? problem
              : saved
                ? <><DrawnCheck size={16} /><span>{PASSWORD_COPY.savedFor(email)} {PASSWORD_COPY.othersLead} <a className="acct-link acct-link--inline" href="#sign-in">{PASSWORD_COPY.othersLink}</a>.</span></>
                : busy ? PASSWORD_COPY.saving : PASSWORD_COPY.idle}
          </p>
          <Button type="submit" variant={ruleMet ? 'volt' : 'outline'} size="md" disabled={busy || !password}>
            {busy ? PASSWORD_COPY.saving : PASSWORD_COPY.save}
          </Button>
        </div>
      </form>
    </section>
  );
}
