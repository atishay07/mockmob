"use client";
// /class/<code>: the page a classmate opens from the class group. One job: from a WhatsApp link to a seat in the class in one
// tap after sign-up. It shows the class's name (its only public fact), how it runs every week in three plain lines, and one
// volt key: "Join this class" signed in, "Sign up free to join" signed out (the code waits for the new account: the sign-up
// return path, and this tab's own note for after the first setup, as a Mob invite waits). Never a member count or a name.
// Not an invite (unknown or closed code), off, or did not load: each says what is true and offers one way on.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/AuthProvider';
import { loginPathFor, signupPathFor } from '@/lib/auth-redirect';
import { CLASS_COPY, JOIN_LINES, classPath, displayClassCode, normalizeClassCode } from '@/lib/classLeague/model.mjs';
import { School } from 'lucide-react';
import { CodeForm } from './ClassParts';
import { classWrite, forgetClassCode, rememberClassCode, useClassLookup } from './useClassLeague';
import './class.css';

function Shell({ children }) {
  return (
    <main className="cls-public">
      <div className="cls-public__inner">
        <Logo className="cls-public__logo" height={28} />
        {children}
      </div>
    </main>
  );
}

function Register({ title, lede = null, meta = null, children }) {
  return (
    <section className="cls" aria-labelledby="cls-join-h">
      <header className="cls-band">
        <p className="cls-stamp"><School size={18} strokeWidth={2} aria-hidden="true" />{CLASS_COPY.name}</p>
        <h1 id="cls-join-h">{title}</h1>
        {meta}
        {lede ? <p className="cls-band__lede">{lede}</p> : null}
      </header>
      <div className="cls-body">{children}</div>
    </section>
  );
}

function Steps() {
  return (
    <div className="cls-row">
      <ol className="cls-steps">
        {JOIN_LINES.map(([b, line]) => <li key={b}><b>{b}</b><span>{line}</span></li>)}
      </ol>
    </div>
  );
}

export default function ClassJoin({ code: raw }) {
  const code = normalizeClassCode(raw);
  const router = useRouter();
  const { user, status: authStatus } = useAuth();
  const signedIn = authStatus === 'authenticated' && Boolean(user?.id);
  const lookup = useClassLookup(code, signedIn);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const r = await classWrite('/api/class/join', { code });
    if (r.ok) { forgetClassCode(); router.replace('/sunday#class'); return; }
    setBusy(false);
    setError(r.code === 'ALREADY_IN_CLASS' && r.detail?.className ? `You are in ${r.detail.className}. Leave it first from its Class settings, then open this link again.` : r.message);
  };
  const signUp = () => {
    if (opening) return;
    setOpening(true);
    rememberClassCode(code);
    router.push(signupPathFor(classPath(code)));
  };

  if (lookup.status === 'loading' || authStatus === 'loading') {
    return (
      <Shell>
        <section className="cls cls--wait" aria-busy="true" aria-label="Checking the class code">
          <div className="cls-band"><i /><i /></div>
          <div className="cls-body"><i /><i /></div>
        </section>
      </Shell>
    );
  }
  if (lookup.status === 'missing' || lookup.status === 'off') {
    return (
      <Shell>
        <Register title="This class code does not work" lede="The class may have closed, or a letter is off. Check the code with whoever shared it, or type it here.">
          <div className="cls-row">
            <CodeForm onJoin={(c) => router.push(classPath(c))} />
          </div>
          <div className="cls-row"><div className="cls-keys"><Link className="cls-link" href="/">Go to MockMob</Link></div></div>
        </Register>
      </Shell>
    );
  }
  if (lookup.status === 'error') {
    return (
      <Shell>
        <Register title="The class did not load" lede={lookup.message || 'Check your connection and try again.'}>
          <div className="cls-row" role="alert"><div className="cls-keys"><button type="button" className="cls-key cls-key--volt" onClick={lookup.retry}>{CLASS_COPY.tryAgain}</button></div></div>
        </Register>
      </Shell>
    );
  }
  const info = lookup.data;
  const meta = (
    <p className="cls-band__meta">
      <span>{info.subjects.join(', ')}</span>
      <span>Code <b>{displayClassCode(info.code)}</b></span>
    </p>
  );
  return (
    <Shell>
      <Register title={info.name} meta={meta} lede="Your class is on MockMob. Join to sit the free Sunday Mock with them and see the class average each Monday.">
        <Steps />
        <div className="cls-row">
          {!signedIn ? (
            <>
              <button type="button" className="cls-key cls-key--volt cls-key--wide" onClick={signUp} aria-busy={opening || undefined} data-page-primary="">
                {opening ? 'Opening sign-up' : CLASS_COPY.signUp}
              </button>
              <p className="cls-public__alt">{CLASS_COPY.haveAccount} <Link className="cls-link" href={loginPathFor(classPath(code))} onClick={() => rememberClassCode(code)}>{CLASS_COPY.signIn}</Link></p>
            </>
          ) : info.you === 'member' ? (
            <>
              <p className="cls-note">You are in this class.</p>
              <Link className="cls-key cls-key--volt cls-key--wide" href="/sunday#class" data-page-primary="">See your class</Link>
            </>
          ) : (
            <>
              <button type="button" className="cls-key cls-key--volt cls-key--wide" onClick={join} disabled={busy} aria-busy={busy || undefined} data-page-primary="">
                {busy ? CLASS_COPY.joining : CLASS_COPY.joinThis}
              </button>
              {info.you === 'other' ? <p className="cls-small">You are in another class. Joining needs you to leave it first.</p> : null}
            </>
          )}
          <p className="cls-msg" role="status" aria-live="polite">{error}</p>
          <p className="cls-public__fine">Free. MockMob never asks for your contacts, and nobody in the class sees who joined.</p>
        </div>
      </Register>
    </Shell>
  );
}
