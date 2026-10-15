"use client";

// Account (You > Settings): your name, plan and sign-in, then appearance, Start on, privacy and
// delete account. Every setting that was on this page is still here, and the anchors the You hub
// links to (#plan, #appearance, #start-on, #privacy, #delete) land on their sections. The page paints
// at once: only the line about your mocks waits for the server, and a failure there never hides a setting.
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DrawnCheck } from '@/components/ui/DrawnCheck';
import MobiReact from '@/components/brand/MobiReact';
import { mobiMoment } from '@/lib/mobiMoments';
import { WAIT_LONG_MS, greeting, oopsRun } from '@/lib/mobiRation';
import LookAndFeelCard from './LookAndFeelCard';
import { lookMobiActive, lookMobiServer, subscribeLookMobi } from '@/components/profile/lookMobiStore';
import StartOnSetting from '@/components/profile/StartOnSetting';
import SignOutControl from '@/components/profile/SignOutControl';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { PlanCard } from '@/components/billing/PlanCard';
import { SignOutOtherDevicesSection } from '@/components/auth/SignOutOtherDevices';
import { api, apiGet, apiPatch, apiPost } from '@/lib/fetcher';
import { SUBJECTS_EDIT_HREF, YOU_HREF } from '@/lib/navigation';
import './profile-privacy.css';
import '@/components/profile/you.css';

const putJson = (path, data) => api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };

function UsageDataSection() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [ageBand, setAgeBand] = useState('unknown');
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ type: null, message: '' });
  const busyRef = useRef(false);
  const toggleRef = useRef(null);

  useEffect(() => {
    let alive = true;
    apiGet('/api/me/consent')
      .then((c) => { if (!alive) return; setAgeBand(c.ageBand); setAllowed(c.analyticsAllowed === true); setLoaded(true); })
      .catch((e) => { if (alive) setLoadError(e.message || 'Could not load your choice.'); });
    return () => { alive = false; };
  }, []);

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
    } catch (e) {
      setNote({ type: 'err', message: e.message || 'Could not save your choice. Please try again.' });
    } finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <section className="privacy-block" id="privacy" aria-labelledby="usage-data-title">
      <h2 id="usage-data-title">Privacy and usage data</h2>
      <p>Usage data shows us which screens and steps people use, such as starting a session or opening a result, along with the app version. We never collect your answers, marks, free text or contacts.</p>
      <ul>
        <li>First-party only. No third-party tracking and no advertising.</li>
        <li>Kept for 180 days.</li>
        <li>You can withdraw at any time, and withdrawing deletes what was collected.</li>
        <li>Only available to people who confirm they are 18 or older. If you are under 18, or have not said, it stays off.</li>
      </ul>
      {loadError ? <p className="privacy-note privacy-note--err" role="alert">{loadError}</p> : !loaded ? <p className="privacy-note">Loading your choice.</p> : (
        <>
          <fieldset className="privacy-choice" aria-busy={busy}>
            <legend className="privacy-label">Your age</legend>
            <label><input type="radio" name="age-band" checked={ageBand === 'adult'} onChange={() => save('adult', allowed)} />I am 18 or older</label>
            <label><input type="radio" name="age-band" checked={ageBand === 'minor'} onChange={() => save('minor', false)} />I am under 18</label>
          </fieldset>
          <label className="privacy-toggle">
            <input ref={toggleRef} type="checkbox" checked={allowed} disabled={ageBand !== 'adult'} onChange={(e) => save('adult', e.target.checked)} />
            Allow usage data to improve MockMob
          </label>
          {ageBand !== 'adult' && <p className="privacy-note">Confirm you are 18 or older to turn this on.</p>}
          {allowed && (
            <div><Button variant="outline" size="md" aria-disabled={busy || undefined} onClick={() => save('adult', false, { refocus: true })}>Withdraw and delete my usage data</Button></div>
          )}
          <p className={`privacy-note ${note.type === 'ok' ? 'privacy-note--ok' : note.type === 'err' ? 'privacy-note--err' : ''}`} role="status" aria-live="polite">{note.message}</p>
        </>
      )}
    </section>
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
      setError(e.message === 'unavailable' ? 'Deletion is unavailable right now. Please try again shortly, or email support@mockmob.in.' : e.message || 'Could not send your request. Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <section className="privacy-block" id="delete" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title">Delete account</h2>
      <p>We delete your account and study records within 30 days. Payment records required by law are kept.</p>
      {pending ? (
        <p className="privacy-note privacy-note--ok" role="status">Deletion pending. You asked on {fmtDate(pending)} and we complete it within 30 days. To cancel, email support@mockmob.in.</p>
      ) : !open ? (
        <div><Button variant="outline" size="md" className="privacy-danger" onClick={() => setOpen(true)}>Delete account</Button></div>
      ) : (
        <div className="privacy-confirm">
          <label className="block">
            <span className="privacy-label">Type DELETE to confirm</span>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          </label>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" size="md" className="privacy-danger" disabled={busy || typed !== 'DELETE'} onClick={confirmDelete}>{busy ? 'Sending request' : 'Request deletion'}</Button>
            <Button variant="ghost" size="md" disabled={busy} onClick={() => { setOpen(false); setTyped(''); setError(''); }}>Cancel</Button>
          </div>
          {error && <p className="privacy-note privacy-note--err" role="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

export default function ProfilePageClient() {
  const { user, status, refreshSession } = useAuth();
  const toast = useToast();
  const [attempts, setAttempts] = useState([]);
  const [mocks, setMocks] = useState('loading'); // loading | ready | error: only the line about your mocks waits
  const [draftName, setDraftName] = useState(null);
  const [saveState, setSaveState] = useState({ type: null, message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [mobi, setMobi] = useState({ act: 'idle', n: 0 });
  const greeted = useRef(false);
  const waitTimer = useRef(0);
  const lookMobi = useSyncExternalStore(subscribeLookMobi, lookMobiActive, lookMobiServer);

  useEffect(() => {
    if (status === 'loading') return undefined;
    if (!user?.id) return undefined;

    let alive = true;
    apiGet(`/api/attempts?userId=${user.id}`)
      .then((data) => { if (!alive) return; setAttempts(Array.isArray(data) ? data : []); setMocks('ready'); })
      .catch(() => { if (alive) setMocks('error'); });
    return () => { alive = false; };
  }, [status, user]);

  // A link to /profile#privacy (and the rest) lands on its section.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return undefined;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Mobi says hello the first time you open Account each day, and is simply there after that.
  useEffect(() => {
    if (!user?.id) return undefined;
    const id = window.setTimeout(() => {
      if (greeted.current) return;
      greeted.current = true;
      // A hello the first time each day; asleep or sleepy late at night (a tap wakes him); the
      // rest of the time he is simply there. The gates are Mobi's ration (lib/mobiRation.js).
      const act = greeting('profile');
      if (act !== 'idle') setMobi((m) => ({ act, n: m.n + 1 }));
    }, 450);
    return () => window.clearTimeout(id);
  }, [user?.id]);

  const averageScore = useMemo(() => {
    if (attempts.length === 0) return null;
    const total = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
    return Math.round(total / attempts.length);
  }, [attempts]);
  const currentName = draftName ?? (user?.name || '');
  const trimmed = currentName.trim();
  const dirty = trimmed.length > 0 && trimmed !== (user?.name || '');
  const hi = firstName(user?.name);
  const subjectCount = user?.subjects?.length || 0;

  async function saveName() {
    setIsSaving(true);
    setSaveState({ type: null, message: '' });
    // A save is quick: he only shows he is waiting when it goes on past two seconds.
    window.clearTimeout(waitTimer.current);
    waitTimer.current = window.setTimeout(() => setMobi((m) => ({ act: mobiMoment('waitLong'), n: m.n + 1 })), WAIT_LONG_MS);
    try {
      await apiPatch(`/api/users/${user.id}`, { name: trimmed });
      await refreshSession({ silent: true });
      setDraftName(null);
      setSaveState({ type: 'success', message: 'Saved. Your name is updated.' });
      toast.success('Saved. Your name is updated.');
      setMobi((m) => ({ act: mobiMoment('saveConfirmed'), n: m.n + 1 }));
    } catch (e) {
      const message = e.message || 'Your name did not save. Try again.';
      setSaveState({ type: 'error', message });
      toast.error(message);
      setMobi((m) => ({ act: oopsRun('profile') ? mobiMoment('saveFailed') : 'idle', n: m.n + 1 }));
    } finally {
      window.clearTimeout(waitTimer.current);
      setIsSaving(false);
    }
  }

  const glance = mocks === 'loading' ? 'Loading your mocks.'
    : mocks === 'error' ? 'Your mocks did not load.'
      : attempts.length === 0 ? 'No mocks yet'
        : `${attempts.length} ${attempts.length === 1 ? 'mock' : 'mocks'} taken, average score ${averageScore}%`;

  return (
    <div className="student-page student-page--profile you view">
      <header className="you__head">
        <div className="you__head-text">
          <h1 className="you__title">Account</h1>
          <p className="you__lede">Your name, plan and sign-in, then appearance, Start on and privacy.</p>
        </div>
        <Link className="you-key" href={YOU_HREF}>Back to You</Link>
      </header>

      <div className="you-acct">
        <div className="you-acct__col">
          <section className="you-card" id="account" aria-labelledby="profile-identity">
            <div className="profile-identity">
              <span className="profile-identity__mobi" style={{ visibility: lookMobi ? 'hidden' : 'visible' }}><MobiReact key={mobi.n} act={mobi.act} size={72} interactive={!lookMobi} onDone={() => setMobi((m) => (m.act === 'idle' ? m : { act: 'idle', n: m.n }))} /></span>
              <div className="profile-identity__text">
                <h2 id="profile-identity">{hi ? `Hi, ${hi}.` : 'Hi.'}</h2>
                <p>{user?.email}</p>
              </div>
              <Avatar name={user?.name || user?.email} size="lg" className="profile-identity__avatar" />
            </div>

            <label className="you-field">
              <span>Display name</span>
              <input
                className="input"
                value={currentName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Enter your display name"
                autoComplete="name"
                aria-describedby="profile-name-help"
              />
              <span id="profile-name-help" className="you-field__help">Your initials are your avatar. They update when you save your name.</span>
            </label>

            <label className="you-field">
              <span>Email</span>
              <input className="input" value={user?.email || ''} disabled />
              <span className="you-field__help">You sign in with this address. It cannot be changed here.</span>
            </label>

            <div className="you-card__keys">
              <div className="profile-save-note" role={saveState.type === 'error' ? 'alert' : 'status'} data-tone={saveState.type || undefined}>
                {saveState.type === 'success' ? <><DrawnCheck size={16} />{saveState.message}</> : saveState.type === 'error' ? saveState.message : isSaving ? 'Saving' : 'Save your name to update it everywhere.'}
              </div>
              <Button variant={dirty ? 'volt' : 'outline'} size="md" disabled={isSaving || !dirty} onClick={saveName}>
                {isSaving ? 'Saving' : 'Save name'}
              </Button>
            </div>

            <div className="you-glance">
              <p>{subjectCount} {subjectCount === 1 ? 'subject' : 'subjects'} picked</p>
              <Link href={SUBJECTS_EDIT_HREF} className="you-link account-edit">Edit subjects</Link>
            </div>
            <div className="you-glance">
              <p>{glance}</p>
              <Link href="/today" className="you-link account-edit profile-open">Open Today<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></Link>
            </div>
          </section>

          <section id="plan" aria-label="Plan and credits">
            <PlanCard />
          </section>

          <section className="you-acct__col" id="sign-in" aria-label="Sign-in">
            <SignOutControl layout="card" />
            <SignOutOtherDevicesSection />
          </section>
        </div>

        <div className="you-acct__col">
          <div id="appearance"><LookAndFeelCard /></div>
          <StartOnSetting />
          <UsageDataSection />
          <DeleteAccountSection />
        </div>
      </div>
    </div>
  );
}
