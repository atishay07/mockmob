"use client";
// /join/<code>: the public invite page (SOCIAL-SPEC section 7). It says what a Mob is and what it asks, never who is in
// it (P1, P3). Signed out: sign in to join, with the code kept for an hour on this device so it survives sign-in
// (T004), or try a sample question first (T003). Signed in: your name (prefilled, editable, T001) and colour, then Join.
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/AuthProvider';
import { loginPathFor } from '@/lib/auth-redirect';
import { ERRORS, COLOUR_COUNT, checkName, cleanName, inviteExpiryLine, normalizeCode } from '@/lib/mob/model.mjs';
import { mobFetch } from './useMob';
import './mob.css';

export const PENDING_KEY = 'mockmob_mob_join';
const HOUR = 3_600_000;
export function rememberJoin(code) {
  try { window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* the sign-in return path still carries it */ }
}
export function pendingJoin() {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) || 'null');
    return v && normalizeCode(v.code) && Date.now() - Number(v.at) < HOUR ? normalizeCode(v.code) : null;
  } catch { return null; }
}
const forgetJoin = () => { try { window.sessionStorage.removeItem(PENDING_KEY); } catch { /* nothing kept */ } };

const COLOUR_NAMES = ['Teal', 'Sky', 'Violet', 'Rose', 'Amber', 'Green', 'Coral', 'Slate'];

export default function JoinMob({ code: rawCode }) {
  const code = normalizeCode(rawCode);
  const router = useRouter();
  const { user, status: authStatus } = useAuth();
  const [invite, setInvite] = useState({ status: code ? 'loading' : 'invalid', data: null, message: null });
  const [name, setName] = useState('');
  const [colour, setColour] = useState(0);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const nameId = useId();

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    mobFetch(`/api/mob/join/${code}`).then((r) => {
      if (!alive) return;
      if (r.ok) setInvite({ status: 'valid', data: r.data, message: null });
      else if (r.code === 'INVITE_INVALID' || r.code === 'INVITE_EXPIRED') setInvite({ status: 'invalid', data: null, message: null });
      else setInvite({ status: 'error', data: null, message: r.message });
    });
    return () => { alive = false; };
  }, [code]);

  useEffect(() => {
    if (!user?.name) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setName((n) => n || cleanName(user.name).split(' ')[0].slice(0, 18)); });
    return () => { cancelled = true; };
  }, [user?.name]);

  // The sign-in page can take a moment to open; the key says so and takes no second tap until the route changes.
  const [opening, setOpening] = useState(false);
  const signIn = () => {
    if (opening) return;
    setOpening(true);
    rememberJoin(code);
    router.push(loginPathFor(`/join/${code}`));
  };
  const join = async () => {
    setError(null);
    const checked = checkName(name);
    if (!checked.ok) { setError(ERRORS.NAME_INVALID[1]); return; }
    setJoining(true);
    const r = await mobFetch('/api/mob/join', { method: 'POST', body: { code, name: checked.name, colour } });
    setJoining(false);
    if (r.ok) { forgetJoin(); router.replace('/mob'); return; }
    if (r.code === 'INVITE_INVALID' || r.code === 'INVITE_EXPIRED') { forgetJoin(); setInvite({ status: 'invalid', data: null, message: null }); return; }
    setError(r.code === 'ALREADY_IN_MOB' ? 'already' : r.message);
  };

  const signedIn = authStatus === 'authenticated' && Boolean(user?.id);
  const info = invite.data;
  return (
    <main className="mob-join">
      <div className="mob-join__inner">
        <Logo className="mob-join__logo" height={28} />
        {invite.status === 'loading' ? <p className="mob-note" aria-busy="true">Checking the invite.</p> : null}
        {invite.status === 'invalid' ? (
          <section className="glass mob-card">
            <h1 className="mob-join__h1">This invite can&apos;t be used.</h1>
            <p className="mob-note">Ask your friend for a new link.</p>
            <Link className="mob-key" href="/">Go to MockMob</Link>
          </section>
        ) : null}
        {invite.status === 'error' ? (
          <section className="glass mob-card" role="alert">
            <p className="mob-note">{invite.message}</p>
            <button type="button" className="mob-key" onClick={() => window.location.reload()}>Try again</button>
          </section>
        ) : null}
        {invite.status === 'valid' && info ? (
          <>
            <h1 className="mob-join__h1">You&apos;re invited to a Mob.</h1>
            <p className="mob-note">A small group sitting one 10-question {info.subjectName} paper each week. {info.size} of 5 seats taken.</p>
            <ul className="mob-join__facts">
              <li>Same 10 questions for everyone, about 12 minutes.</li>
              <li>You see who sat, never who didn&apos;t. Scores stay private unless you choose.</li>
            </ul>
            {!signedIn ? (
              <div className="mob-actions">
                <button type="button" className="mob-volt" onClick={signIn} disabled={authStatus === 'loading'} aria-busy={opening || undefined} aria-disabled={opening || undefined}>{opening ? 'Opening sign-in' : 'Sign in to join'}</button>
                <Link className="mob-link" href="/#try-practice">Try a sample question first</Link>
              </div>
            ) : (
              <section className="glass mob-card mob-form" aria-labelledby="mob-join-h">
                <h2 id="mob-join-h" className="mob-h2">Join as</h2>
                <div className="mob-field">
                  <label className="mob-label" htmlFor={nameId}>Your name in the Mob</label>
                  <input id={nameId} className="mob-input" value={name} maxLength={18} onChange={(e) => setName(e.target.value)} aria-describedby={`${nameId}-hint`} aria-invalid={error && error !== 'already' ? true : undefined} />
                  <p id={`${nameId}-hint`} className="mob-hint">Only your Mob sees it. 2 to 18 letters.</p>
                </div>
                <fieldset className="mob-colours">
                  <legend className="mob-label">Colour</legend>
                  <div className="mob-colours__row">
                    {Array.from({ length: COLOUR_COUNT }, (_, i) => (
                      <label key={i} className="mob-colour" title={COLOUR_NAMES[i]}>
                        <input type="radio" name="mob-join-colour" value={i} checked={colour === i} onChange={() => setColour(i)} />
                        <span className="mob-disc mob-disc--pick" data-colour={i} aria-hidden="true" />
                        <span className="sr-only">{COLOUR_NAMES[i]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button type="button" className="mob-volt" onClick={join} disabled={joining}>{joining ? 'Joining' : 'Join'}</button>
                {error === 'already' ? (
                  <p className="mob-notice" role="status">You are already in a Mob. <Link className="mob-link" href="/mob">Open your Mob</Link></p>
                ) : <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>}
              </section>
            )}
            <p className="mob-hint">MockMob never asks for your contacts. You can leave any time. {inviteExpiryLine(info.expiresAt)}.</p>
          </>
        ) : null}
      </div>
    </main>
  );
}
