"use client";
// /join/<code>: the public invite page (SOCIAL-SPEC section 7). It says what a Mob is and what it asks, never who is in
// it (P1, P3): the seats picture shows how many seats are taken, with no names. Signed out: sign in to join, with the
// code kept for an hour on this device so it survives sign-in (T004), or try 5 sample questions first (T003, the
// landing's guest sample). Signed in: who invited you, your name (prefilled, editable, T001) and colour, then Join.
// States: checking, valid, full (MOB_FULL, its own words), paused (MOB_INVITES_ENABLED=false), invalid or expired, error.
// Sharing inside the Mob is on by default; the page says so before anyone joins (rule 14).
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/AuthProvider';
import { loginPathFor } from '@/lib/auth-redirect';
import { ERRORS, COLOUR_COUNT, checkName, cleanName, initialOf, suggestName, inviteExpiryLine, normalizeCode } from '@/lib/mob/model.mjs';
import { mobFetch } from './useMob';
import { MobSeats, PaperFacts, Promises } from './MobIntro';
import { errorDetail } from './mobFormat';
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
// The landing's guest sample: 5 CUET questions, no account, answers carried into the account after sign-up.
export const SAMPLE_COUNT = 5;
const JOIN_PROMISES = [
  ['One paper a week, the same for all of you', 'A fresh 10-question paper every Monday. Sit it any time before Sunday night.'],
  ['You see who sat, never who didn\'t', 'Never ranked, and you can leave any time.'],
  ['Shared inside the Mob only', 'Members see each other\'s answers and scores. One switch turns yours off.'],
];

/** The states that are not an invite: each with its own words and one way forward. */
function StateCard({ title, line, signedIn, startOwn = false }) {
  return (
    <section className="glass mob-card mob-join__state">
      <h1 className="mob-join__h1">{title}</h1>
      <p className="mob-join__lede">{line}</p>
      <div className="mob-join__actions">
        {startOwn ? <Link className="mob-volt" href={signedIn ? '/mob' : loginPathFor('/mob')}>Start your own Mob</Link> : null}
        <Link className={startOwn ? 'mob-link' : 'mob-key'} href="/">Go to MockMob</Link>
      </div>
    </section>
  );
}

export default function JoinMob({ code: rawCode }) {
  const code = normalizeCode(rawCode);
  const router = useRouter();
  const { user, status: authStatus } = useAuth();
  const [invite, setInvite] = useState({ status: code ? 'loading' : 'invalid', data: null, message: null });
  const [name, setName] = useState('');
  const [colour, setColour] = useState(0);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [editing, setEditing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [retry, setRetry] = useState(0);
  const nameId = useId();

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    mobFetch(`/api/mob/join/${code}`).then((r) => {
      if (!alive) return;
      if (r.ok) setInvite({ status: 'valid', data: r.data, message: null });
      else if (r.code === 'INVITE_INVALID' || r.code === 'INVITE_EXPIRED') setInvite({ status: 'invalid', data: null, message: null });
      else if (r.code === 'MOB_FULL') setInvite({ status: 'full', data: null, message: null });
      else if (r.code === 'JOIN_PAUSED') setInvite({ status: 'paused', data: null, message: r.message });
      else setInvite({ status: 'error', data: null, message: r.message });
    });
    return () => { alive = false; };
  }, [code, retry, authStatus]);

  useEffect(() => {
    if (!user?.name) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setName((n) => n || suggestName(user.name, user.email)); });
    return () => { cancelled = true; };
  }, [user?.name, user?.email]);

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
    setErrorCode(null);
    const checked = checkName(name);
    if (!checked.ok) { setEditing(true); setError(ERRORS.NAME_INVALID[1]); setErrorCode('NAME_INVALID'); return; }
    setJoining(true);
    const r = await mobFetch('/api/mob/join', { method: 'POST', body: { code, name: checked.name, colour } });
    setJoining(false);
    if (r.ok) { forgetJoin(); router.replace('/mob'); return; }
    if (r.code === 'INVITE_INVALID' || r.code === 'INVITE_EXPIRED') { forgetJoin(); setInvite({ status: 'invalid', data: null, message: null }); return; }
    if (r.code === 'MOB_FULL') { forgetJoin(); setInvite({ status: 'full', data: null, message: null }); return; }
    if (r.code === 'JOIN_PAUSED') { setInvite({ status: 'paused', data: null, message: r.message }); return; }
    setErrorCode(r.code);
    if (r.code?.startsWith('NAME')) setEditing(true);
    setError(r.message);
  };

  const signedIn = authStatus === 'authenticated' && Boolean(user?.id);
  const info = invite.data;
  const wide = invite.status === 'valid' || invite.status === 'loading';
  // An email-code account has no name to offer (suggestName gives ''), so the editor starts open: the Join key never fails on its first tap.
  const showEditor = editing || (signedIn && !cleanName(name));
  return (
    <main className="mob-join">
      <div className={wide ? 'mob-join__inner mob-join__inner--wide' : 'mob-join__inner'}>
        <Logo className="mob-join__logo" height={28} />
        {invite.status === 'loading' ? (
          <div className="mob-join__skel" aria-busy="true" aria-label="Checking the invite">
            <span className="mob-skel mob-skel--line" style={{ width: '70%', height: 36 }} />
            <span className="mob-skel mob-skel--line" style={{ width: '50%' }} />
            <span className="mob-skel mob-skel--ring" />
          </div>
        ) : null}
        {invite.status === 'invalid' ? (
          <StateCard title="This invite can't be used." line="The link has expired or a newer one replaced it. Ask your friend to send a new link." signedIn={signedIn} startOwn />
        ) : null}
        {invite.status === 'full' ? (
          <StateCard title="This Mob is full." line="It has 5 members, the most a Mob can have. Ask your friend to tell you if a seat opens, or start a Mob of your own and invite your friends to it." signedIn={signedIn} startOwn />
        ) : null}
        {invite.status === 'paused' ? (
          <StateCard title="Joining is paused for now." line="New members cannot join a Mob by link just now. Keep the link and try it again later." signedIn={signedIn} />
        ) : null}
        {invite.status === 'error' ? (
          <section className="glass mob-card mob-join__state" role="alert">
            <h1 className="mob-join__h1">The invite did not load.</h1>
            <p className="mob-join__lede">{errorDetail(invite.message, 'The invite did not load')}</p>
            <button type="button" className="mob-key" onClick={() => { setInvite({ status: 'loading', data: null, message: null }); setRetry((n) => n + 1); }}>Try again</button>
          </section>
        ) : null}
        {invite.status === 'valid' && info ? (
          <div className="mob-join__grid">
            <div className="mob-join__visual">
              <MobSeats taken={info.size} label={`${info.size} of 5 seats taken in this Mob`} />
              <PaperFacts />
            </div>
            <div className="mob-join__copy">
              <h1 className="mob-join__h1">{signedIn && info.inviter ? `${info.inviter} invited you to this week's ${info.subjectName} paper.` : "You're invited to a Mob."}</h1>
              <p className="mob-join__lede">A small private group that sits one 10-question {info.subjectName} paper each week. {info.size} of 5 seats taken.</p>
              <Promises items={JOIN_PROMISES} />
              {!signedIn ? (
                <div className="mob-join__actions">
                  <button type="button" className="mob-volt" onClick={signIn} disabled={authStatus === 'loading'} aria-busy={opening || undefined} aria-disabled={opening || undefined}>{opening ? 'Opening sign-in' : 'Sign in to join'}</button>
                  <Link className="mob-link" href="/#try-practice">Try {SAMPLE_COUNT} CUET questions first</Link>
                </div>
              ) : (
                <section className="glass mob-card mob-form" aria-labelledby="mob-join-h">
                  <h2 id="mob-join-h" className="mob-h2">Join as</h2>
                  <div className="mob-joinas">
                    <span className="mob-disc" data-colour={colour} aria-hidden="true">{initialOf(name || '?')}</span>
                    <b className="mob-joinas__name">{cleanName(name) || 'Choose a name'}</b>
                    <button type="button" className="mob-link" onClick={() => setEditing((v) => !v)} aria-expanded={showEditor}>{showEditor ? 'Done' : 'Change name or colour'}</button>
                  </div>
                  {showEditor ? (
                    <>
                      <div className="mob-field">
                        <label className="mob-label" htmlFor={nameId}>Your name in the Mob</label>
                        <input id={nameId} className="mob-input" value={name} maxLength={18} autoComplete="given-name" onChange={(e) => setName(e.target.value)} aria-describedby={`${nameId}-hint`} aria-invalid={errorCode?.startsWith('NAME') ? true : undefined} />
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
                    </>
                  ) : null}
                  <div className="mob-actions">
                    <button type="button" className="mob-volt" onClick={join} disabled={joining} aria-busy={joining || undefined}>{joining ? 'Joining' : 'Join'}</button>
                  </div>
                  {errorCode === 'MOB_CEILING' || errorCode === 'ALREADY_IN_MOB' ? (
                    <p className="mob-notice" role="status">{error} <Link className="mob-link" href="/mob">Open your Mobs</Link></p>
                  ) : <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>}
                </section>
              )}
              <p className="mob-hint">MockMob never asks for your contacts. {inviteExpiryLine(info.expiresAt)}.</p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
