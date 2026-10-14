"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Input';
import { PageHead } from '@/components/ui/PageHead';
import { useAuth } from '@/components/AuthProvider';
import { PlanCard } from '@/components/billing/PlanCard';
import { SignOutOtherDevicesSection } from '@/components/auth/SignOutOtherDevices';
import { api, apiGet, apiPost } from '@/lib/fetcher';
import { AccountSection, AccountNote } from './AccountSection';
import NameSetting from './NameSetting';
import SubjectsSetting from './SubjectsSetting';
import AppearanceSetting from './AppearanceSetting';
import StartOnSetting from './StartOnSetting';
import './account.css';

// Account (W2.3). Painted at once from the confirmed session: nothing here waits on the practice
// record (that lives in Progress and Review). Groups: Profile, Subjects, Plan and credits,
// Appearance, Start page, Usage data, Sign-in, Delete account.

const putJson = (path, data) => api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };

function UsageDataSection() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [ageBand, setAgeBand] = useState('unknown');
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ type: null, message: '' });
  const [retry, setRetry] = useState(0);
  const busyRef = useRef(false);
  const toggleRef = useRef(null);

  useEffect(() => {
    let alive = true;
    apiGet('/api/me/consent')
      .then((c) => { if (!alive) return; setAgeBand(c.ageBand); setAllowed(c.analyticsAllowed === true); setLoaded(true); setLoadError(''); })
      .catch(() => { if (alive) setLoadError('Your usage-data choice did not load. Usage data stays off until it does.'); });
    return () => { alive = false; };
  }, [retry]);

  // Local state changes only after the server confirms.
  async function save(nextBand, nextAllowed, { refocus = false } = {}) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNote({ type: null, message: '' });
    try {
      const res = await putJson('/api/me/consent', { ageBand: nextBand, analyticsAllowed: nextAllowed });
      setAgeBand(res.ageBand);
      setAllowed(res.analyticsAllowed === true);
      const n = res.deletedEvents || 0;
      const message = res.analyticsAllowed
        ? 'Saved. Usage data is on.'
        : `Saved. Usage data is off. ${n} collected ${n === 1 ? 'record was' : 'records were'} deleted.`;
      setNote({ type: 'ok', message });
      if (refocus) setTimeout(() => toggleRef.current?.focus(), 0);
    } catch {
      setNote({ type: 'err', message: 'We could not save your choice. Nothing was changed. Try again.' });
    } finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <AccountSection id="usage-data" title="Usage data" lead="Which screens and steps people use, so we can make MockMob better. Off unless you turn it on.">
      <div className="acct-row acct-prose">
        <p>We count steps such as starting a session or opening a result, along with the app version. We never collect your answers, marks, free text or contacts.</p>
        <ul>
          <li>First-party only. No third-party tracking and no advertising.</li>
          <li>Kept for 180 days.</li>
          <li>You can withdraw at any time, and withdrawing deletes what was collected.</li>
          <li>Only for people who confirm they are 18 or older. If you are under 18, or have not said, it stays off.</li>
        </ul>
      </div>
      {loadError ? (
        <div className="acct-row">
          <p className="acct-help acct-help--bad" role="alert">{loadError}</p>
          <div><Button variant="secondary" size="sm" onClick={() => { setLoadError(''); setRetry((count) => count + 1); }}>Try again</Button></div>
        </div>
      ) : !loaded ? (
        <div className="acct-row" role="status" aria-live="polite">
          <span className="sr-only">Loading your usage-data choice</span>
          <div className="acct-choice__opts" aria-hidden="true"><span className="ui-skeleton acct-opt-ghost" /><span className="ui-skeleton acct-opt-ghost" /></div>
        </div>
      ) : (
        <div className="acct-row">
          <fieldset className="acct-choice" aria-busy={busy}>
            <legend className="acct-choice__legend">Your age</legend>
            <div className="acct-choice__opts">
              <label className="acct-opt">
                <input type="radio" name="age-band" checked={ageBand === 'adult'} onChange={() => save('adult', allowed)} />
                <span className="acct-opt__bubble" aria-hidden="true" />
                <span className="acct-opt__text"><b>I am 18 or older</b></span>
              </label>
              <label className="acct-opt">
                <input type="radio" name="age-band" checked={ageBand === 'minor'} onChange={() => save('minor', false)} />
                <span className="acct-opt__bubble" aria-hidden="true" />
                <span className="acct-opt__text"><b>I am under 18</b></span>
              </label>
            </div>
          </fieldset>
          <label className="acct-switch">
            <input ref={toggleRef} type="checkbox" role="switch" checked={allowed} disabled={ageBand !== 'adult'} onChange={(e) => save('adult', e.target.checked)} />
            <span className="acct-switch__track" aria-hidden="true"><span className="acct-switch__thumb" /></span>
            <span className="acct-switch__label">Allow usage data to improve MockMob</span>
          </label>
          {ageBand !== 'adult' ? <p className="acct-help">Confirm you are 18 or older to turn this on.</p> : null}
          {allowed ? (
            <div><Button variant="secondary" size="sm" aria-disabled={busy || undefined} onClick={() => save('adult', false, { refocus: true })}>Withdraw and delete my usage data</Button></div>
          ) : null}
        </div>
      )}
      <AccountNote tone={note.type === 'ok' ? 'ok' : note.type === 'err' ? 'bad' : null}>{note.message}</AccountNote>
    </AccountSection>
  );
}

function SignInSection() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function signOutHere() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      router.push('/');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountSection id="sign-in" title="Sign-in" lead="Where your account is signed in.">
      <div className="acct-row">
        <SignOutOtherDevicesSection />
      </div>
      <div className="acct-row acct-row--split">
        <div>
          <p className="acct-row__title">Sign out of this browser</p>
          <p className="acct-help">Your practice stays with your account. Sign in again any time.</p>
        </div>
        <Button variant="secondary" size="sm" loading={busy} onClick={signOutHere}>{busy ? 'Signing out' : 'Sign out'}</Button>
      </div>
    </AccountSection>
  );
}

function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);

  async function confirmDelete() {
    setBusy(true);
    setError('');
    try {
      const res = await apiPost('/api/me/delete', { source: 'web' });
      setPending(res.requestedAt || new Date().toISOString());
    } catch (e) {
      setError(e.message === 'unavailable' ? 'Deletion is unavailable right now. Please try again shortly, or email support@mockmob.in.' : 'We could not send your request. Nothing was requested. Try again.');
    } finally { setBusy(false); }
  }

  return (
    <AccountSection id="delete-account" title="Delete account" tone="danger" lead="We delete your account and study records within 30 days. Payment records required by law are kept.">
      <div className="acct-row">
        {pending ? (
          <p className="acct-note acct-note--ok" role="status">Deletion pending. You asked on {fmtDate(pending)} and we complete it within 30 days. To cancel, email support@mockmob.in.</p>
        ) : !open ? (
          <div><Button variant="secondary" size="sm" className="acct-danger" onClick={() => setOpen(true)}>Delete account</Button></div>
        ) : (
          <div className="acct-confirm">
            <p className="acct-help">Your account is not deleted the moment you confirm. We record your request first.</p>
            <Field label="Type DELETE to confirm" hint={typed && typed !== 'DELETE' ? 'Type DELETE in capitals to enable the button.' : undefined}>
              <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} />
            </Field>
            <div className="acct-actions">
              <Button variant="secondary" className="acct-danger" loading={busy} disabled={typed !== 'DELETE'} onClick={confirmDelete}>{busy ? 'Sending request' : 'Request deletion'}</Button>
              <Button variant="quiet" disabled={busy} onClick={() => { setOpen(false); setTyped(''); setError(''); }}>Keep my account</Button>
            </div>
            {error ? <p className="acct-note acct-note--bad" role="alert">{error}</p> : null}
          </div>
        )}
      </div>
    </AccountSection>
  );
}

function AccountSkeleton() {
  return (
    <div className="acct-skeleton" role="status" aria-live="polite">
      <span className="sr-only">Loading your account</span>
      {[0, 1, 2].map((key) => (
        <div key={key} className="acct-sec" aria-hidden="true">
          <div className="acct-sec__head"><span className="ui-skeleton acct-ghost acct-ghost--title" /></div>
          <div className="acct-sec__body"><span className="ui-skeleton acct-ghost" /><span className="ui-skeleton acct-ghost acct-ghost--short" /></div>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePageClient() {
  const { user, refreshSession } = useAuth();

  return (
    <div className="student-page acct view">
      <PageHead title="Account" lead="Your name, subjects and plan, and how MockMob looks on this device." />

      {!user?.id ? <AccountSkeleton /> : (
        <div className="acct-groups">
          <AccountSection id="profile" title="Profile" lead="How you appear in MockMob.">
            <NameSetting user={user} refreshSession={refreshSession} />
            <div className="acct-row acct-row--split">
              <div>
                <p className="acct-row__title">Email</p>
                <p className="acct-row__value">{user.email}</p>
                <p className="acct-help">You sign in with this address. It cannot be changed here.</p>
              </div>
            </div>
          </AccountSection>

          <SubjectsSetting user={user} refreshSession={refreshSession} />

          <AccountSection id="plan" title="Plan and credits" lead="What your account includes right now, as our server reports it.">
            <div className="acct-row"><PlanCard /></div>
          </AccountSection>

          <AppearanceSetting />
          <StartOnSetting />
          <UsageDataSection />
          <SignInSection />
          <DeleteAccountSection />
        </div>
      )}
    </div>
  );
}
