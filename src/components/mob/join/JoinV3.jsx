"use client";
// /join/<code> on Mob v3: the page a friend's link opens. One job: get a first-time student from a link in WhatsApp to a seat
// in a Mob, with nothing about who is in it. R2, what does a first-time student think this screen wants? "A friend saved me a
// seat. Sign up, pick a character, sit down." Signed out: sign up (the invite waits for the account, even through Google).
// Signed in: pick a Fold, check the name, join. The states that are not an invite (invalid, expired, full, paused, did not
// load) each say what is true and offer one way on. Sharing is said before anyone joins (rule 14).
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { STARTER_FOLDS, pickableFolds } from '@/lib/mob/v3/denModel.mjs';
import { inviteExpiryLine } from '@/lib/mob/model.mjs';
import { JoinCopy, seatPlan, takenSeats, codeFromParam } from '@/lib/mob/v3/joinModel.mjs';
import { loginPathFor } from '@/lib/auth-redirect';
import { mobFetch } from '../useMob';
import { FoldPick } from '../den/DenSheets';
import { JoinStage } from './JoinStage';

/** The Folds this student can sit as: the four starters, plus any they have earned (a failed read leaves the starters). */
function useSeatFolds(enabled) {
  const [folds, setFolds] = useState(() => [...STARTER_FOLDS]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    mobFetch('/api/mob/shelf').then((r) => { if (alive && r.ok && Array.isArray(r.data?.folds)) setFolds(pickableFolds(r.data)); });
    return () => { alive = false; };
  }, [enabled]);
  return folds;
}

/** A valid invite, signed out: the room, the two steps, and the sign-up key. */
export function InviteOut({ info, opening, onSignUp, signInHref }) {
  const taken = takenSeats(info);
  const slots = seatPlan({ taken, signedIn: false });
  return (
    <div className="join-grid">
      <JoinStage name={info.name} subline={JoinCopy.seatsLine(info.subjectName, taken)} slots={slots} label={`${info.name}, ${JoinCopy.seatsLine(info.subjectName, taken)}`} />
      <div className="join-copy">
        <h1 className="join-h1">{JoinCopy.outTitle(info.name)}</h1>
        <p className="join-lede">{JoinCopy.lede}</p>
        <ul className="join-steps">
          <li><b>{JoinCopy.stepFirst}</b><span>{JoinCopy.stepFirstLine}</span></li>
          <li><b>{JoinCopy.stepThen}</b><span>{JoinCopy.stepThenLine}</span></li>
        </ul>
        <div className="join-actions">
          <button type="button" className="mob-volt join-key" onClick={onSignUp} aria-busy={opening || undefined} aria-disabled={opening || undefined} data-page-primary="">
            {opening ? JoinCopy.opening : JoinCopy.signUpKey(info.name)}
          </button>
          <p className="join-alt">{JoinCopy.haveAccount} <Link className="mob-link" href={signInHref}>{JoinCopy.signIn}</Link></p>
          <p className="join-alt"><Link className="mob-link" href="/#try-practice">{JoinCopy.tryFirst}</Link></p>
        </div>
        <p className="mob-hint">{JoinCopy.fineOut} {inviteExpiryLine(info.expiresAt)}.</p>
      </div>
    </div>
  );
}

/** A valid invite, signed in: the room with your Fold in your seat, the pick, the name and the join key. */
export function InviteIn({ info, user, fold, setFold, name, setName, nameError, error, errorCode, joining, onJoin }) {
  const taken = takenSeats(info);
  const slots = seatPlan({ taken, signedIn: true });
  const folds = useSeatFolds(true);
  const [swap, setSwap] = useState(false);
  const pick = (k) => { setSwap(true); setFold(k); };
  const nameId = useId();
  return (
    <div className="join-grid">
      <JoinStage name={info.name} subline={JoinCopy.seatsLine(info.subjectName, taken)} slots={slots} fold={fold} swap={swap} yourName={name || user?.name || ''} label={`${info.name}, ${JoinCopy.seatsLine(info.subjectName, taken)}. You sit as ${fold}.`} />
      <div className="join-copy">
        <h1 className="join-h1">{JoinCopy.inTitle(info.name, info.inviter)}</h1>
        <p className="join-lede">{JoinCopy.lede}</p>
        <section className="join-block" aria-labelledby="join-pick">
          <h2 id="join-pick" className="join-h2">{JoinCopy.pickWho}</h2>
          <FoldPick folds={folds} value={fold} onChange={pick} name="join-fold" compact />
        </section>
        <div className="mob-field join-block">
          <label className="mob-label" htmlFor={nameId}>{JoinCopy.nameLabel}</label>
          <input id={nameId} className="mob-input" value={name} maxLength={18} autoComplete="given-name" placeholder={JoinCopy.nameHint}
            onChange={(e) => setName(e.target.value)} aria-invalid={nameError ? true : undefined} aria-describedby={`${nameId}-hint`} />
          <p id={`${nameId}-hint`} className={nameError ? 'mob-hint mob-hint--bad' : 'mob-hint'}>{nameError || JoinCopy.nameNote}</p>
        </div>
        <div className="join-actions">
          <button type="button" className="mob-volt join-key" onClick={onJoin} disabled={joining} aria-busy={joining || undefined} data-page-primary="">
            {joining ? JoinCopy.joining : JoinCopy.joinKey(info.name)}
          </button>
          {errorCode === 'MOB_CEILING' || errorCode === 'ALREADY_IN_MOB' ? (
            <p className="mob-notice" role="status">{error} <Link className="mob-link" href="/mob">{JoinCopy.openMobs}</Link></p>
          ) : <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>}
        </div>
        <p className="mob-hint">{JoinCopy.fineIn} {inviteExpiryLine(info.expiresAt)}.</p>
      </div>
    </div>
  );
}

/** Type another code: for an invite that did not look right or has run out. Goes to that code's own page. */
function CodeForm({ onCode }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [bad, setBad] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    const code = codeFromParam(value);
    if (!code) { setBad(true); return; }
    setBad(false);
    onCode(code);
  };
  return (
    <form className="join-codeform" onSubmit={submit} noValidate>
      <label className="mob-label" htmlFor={id}>{JoinCopy.codeLabel}</label>
      <div className="join-codeform__row">
        <input id={id} className="mob-input join-codeform__input" value={value} onChange={(e) => { setValue(e.target.value); setBad(false); }} maxLength={64}
          autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-invalid={bad || undefined} aria-describedby={bad ? `${id}-bad` : undefined} />
        <button type="submit" className="mob-key">{JoinCopy.codeCheck}</button>
      </div>
      <p id={`${id}-bad`} className="mob-notice" role="status" aria-live="polite">{bad ? JoinCopy.codeBad : ''}</p>
    </form>
  );
}

const NOTICES = {
  invalid: { title: JoinCopy.invalidTitle, line: JoinCopy.invalidLine, mode: 'empty', code: true, own: true },
  expired: { title: JoinCopy.expiredTitle, line: JoinCopy.expiredLine, mode: 'empty', code: true, own: true },
  full: { title: JoinCopy.fullTitle, line: JoinCopy.fullLine, mode: 'full', own: true },
  paused: { title: JoinCopy.pausedTitle, line: JoinCopy.pausedLine, mode: 'empty' },
};

/** The states that are not an invite: invalid, expired, full, paused. Each says what is true and offers one way on. */
export function InviteNotice({ kind, signedIn, onCode }) {
  const n = NOTICES[kind];
  return (
    <div className="join-grid join-grid--notice">
      <JoinStage slots={seatPlan({ mode: n.mode })} label={kind === 'full' ? 'Five seats, all taken' : undefined} />
      <div className="join-copy">
        <h1 className="join-h1">{n.title}</h1>
        <p className="join-lede">{n.line}</p>
        {n.code ? <CodeForm onCode={onCode} /> : null}
        <div className="join-actions join-actions--row">
          {n.own ? <Link className={n.code ? 'mob-key' : 'mob-volt join-key'} href={signedIn ? '/mob' : loginPathFor('/mob')}>{JoinCopy.startOwn}</Link> : null}
          <Link className={n.own ? 'mob-link' : 'mob-key'} href="/">{JoinCopy.home}</Link>
        </div>
      </div>
    </div>
  );
}

/** The invite did not load: a network or server failure, never a claim about the invite itself. */
export function InviteError({ message, onRetry }) {
  return (
    <div className="join-grid join-grid--notice">
      <JoinStage slots={[]} />
      <div className="join-copy" role="alert">
        <h1 className="join-h1">{JoinCopy.errorTitle}</h1>
        <p className="join-lede">{message}</p>
        <div className="join-actions join-actions--row">
          <button type="button" className="mob-volt join-key" onClick={onRetry}>{JoinCopy.tryAgain}</button>
          <Link className="mob-link" href="/">{JoinCopy.home}</Link>
        </div>
      </div>
    </div>
  );
}

/** While the invite is being read: the room and its lamp with a pulsing paper block, and two lines. */
export function InviteLoading() {
  return (
    <div className="join-grid" aria-busy="true" aria-label={JoinCopy.checking}>
      <JoinStage skeleton slots={[]} />
      <div className="join-copy">
        <span className="mob-skel mob-skel--line" style={{ width: '78%', height: 36 }} />
        <span className="mob-skel mob-skel--line" style={{ width: '56%' }} />
        <span className="mob-skel mob-skel--line" style={{ width: '90%', height: 64 }} />
      </div>
    </div>
  );
}
