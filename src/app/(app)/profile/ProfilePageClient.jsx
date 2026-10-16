"use client";

// Account: the live page, with the restructure's You page brought inside it. Your sheet first (who you
// are, the exam, your subjects as the app's objects, your mocks), then your name and sign-in. Beside
// them: plan and credits, appearance (the Night, Daylight and Match device switch) and your weekly goal. On a wide screen the
// columns are sheet, name and appearance | plan, credits and goal, which keeps them level once the credits history is open;
// on a phone the order is sheet, name, plan, credits, appearance, goal (account.css).
// Below: community and help, then privacy, other devices and delete account.
// Every setting that was on this page is still here. The page paints at once: only the mock counts wait
// for the server, and a failure there never hides a setting. Links to /profile#plan, #appearance, #goal,
// #privacy, #delete and the rest land on their section. One Mobi on screen (lookMobiStore.js).
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { DrawnCheck } from '@/components/ui/DrawnCheck';
import MobiReact from '@/components/brand/MobiReact';
import { mobiMoment } from '@/lib/mobiMoments';
import { WAIT_LONG_MS, greeting, oopsRun } from '@/lib/mobiRation';
import LookAndFeelCard from './LookAndFeelCard';
import { lookMobiActive, lookMobiServer, subscribeLookMobi } from '@/components/profile/lookMobiStore';
import YourSheet from '@/components/profile/YourSheet';
import { AccountColleges } from '@/components/colleges/MyColleges';
import PlanCredits from '@/components/profile/PlanCredits';
import CreditsSection from '@/components/profile/CreditsSection';
import GoalControl from '@/components/profile/GoalControl';
import AccountLinks from '@/components/profile/AccountLinks';
import SignOutControl from '@/components/profile/SignOutControl';
import { anchorFromHash, mocksSummary } from '@/components/profile/accountModel.mjs';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { SignOutOtherDevicesSection } from '@/components/auth/SignOutOtherDevices';
import { api, apiGet, apiPatch, apiPost } from '@/lib/fetcher';
import ArenaHead from '@/components/arena/ArenaHead';
import InstallPractice from '@/components/InstallPractice';
import TodayCompass from '@/components/du/TodayCompass';
import './profile-privacy.css';
import '@/components/profile/account.css';

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
    <section className="glass p-6 privacy-block" id="privacy" aria-labelledby="usage-data-title">
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
    <section className="glass p-6 privacy-block" id="delete" aria-labelledby="delete-account-title">
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
  const [mocks, setMocks] = useState({ status: 'loading', count: 0, average: null });
  const [mocksTry, setMocksTry] = useState(0);
  const [draftName, setDraftName] = useState(null);
  const [saveState, setSaveState] = useState({ type: null, message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [mobi, setMobi] = useState({ act: 'idle', n: 0 });
  const greeted = useRef(false);
  const waitTimer = useRef(0);
  const lookMobi = useSyncExternalStore(subscribeLookMobi, lookMobiActive, lookMobiServer);

  // Only the counts on your sheet wait for this: the rest of the page is already usable.
  useEffect(() => {
    if (status === 'loading' || !user?.id) return undefined;
    let alive = true;
    apiGet(`/api/attempts?userId=${user.id}`)
      .then((data) => { if (alive) setMocks({ status: 'ready', ...mocksSummary(data) }); })
      .catch(() => { if (alive) setMocks((m) => ({ ...m, status: 'error' })); });
    return () => { alive = false; };
  }, [status, user?.id, mocksTry]);

  // A link to /profile#goal (and the rest) lands on its section, after the first paint.
  useEffect(() => {
    const id = anchorFromHash(window.location.hash);
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

  const currentName = draftName ?? (user?.name || '');
  const trimmed = currentName.trim();
  const dirty = trimmed.length > 0 && trimmed !== (user?.name || '');
  const hi = firstName(user?.name);

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

  // While the Appearance card is on screen its Mobi is the one; this one steps aside and keeps his space.
  const sheetMobi = (
    <span style={{ visibility: lookMobi ? 'hidden' : 'visible' }}>
      <MobiReact key={mobi.n} act={mobi.act} size={72} interactive={!lookMobi} onDone={() => setMobi((m) => (m.act === 'idle' ? m : { act: 'idle', n: m.n }))} />
    </span>
  );

  return (
    <div className="student-page student-page--profile acct view">
      <ArenaHead title="Your corner of the Arena." lede="Your CUET plan, your access and how MockMob looks and feels. Your practice history stays with your account." />

      <div className="acct-grid">
        <div className="acct-col">
          <YourSheet
            user={user}
            greeting={hi ? `Hi, ${hi}.` : 'Hi.'}
            mobi={sheetMobi}
            plan={user?.isPremium ? 'Pro' : 'Free'}
            mocks={mocks}
            onRetry={() => { setMocks((m) => ({ ...m, status: 'loading' })); setMocksTry((n) => n + 1); }}
          />

          {/* The Compass line (the DU programmes your subjects open, one key to Compass) moved here from Today, above
              the colleges it names (TODAY-1017 section 7). */}
          <TodayCompass />
          <AccountColleges userId={user?.id} />
          {/* Add to home screen moved here from the foot of Today (TODAY-1017 section 7); it shows only when the browser offers it. */}
          <InstallPractice />

          <section className="glass acct-card" id="name" aria-labelledby="acct-name-h">
            <h2 className="acct-h2" id="acct-name-h">Your name and sign-in</h2>
            <label className="acct-field">
              <span>Display name</span>
              <input
                className="input"
                value={currentName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Enter your display name"
                autoComplete="name"
                aria-describedby="profile-name-help"
              />
              <span id="profile-name-help" className="acct-field__help">Your initials are your avatar. They update when you save your name.</span>
            </label>
            <label className="acct-field">
              <span>Email</span>
              <input className="input" value={user?.email || ''} disabled aria-describedby="profile-email-help" />
              <span id="profile-email-help" className="acct-field__help">You sign in with this address. It cannot be changed here.</span>
            </label>
            <div className="acct-card__keys">
              <div className="profile-save-note" role={saveState.type === 'error' ? 'alert' : 'status'} data-tone={saveState.type || undefined}>
                {saveState.type === 'success' ? <><DrawnCheck size={16} />{saveState.message}</> : saveState.type === 'error' ? saveState.message : isSaving ? 'Saving' : 'Save your name to update it across the Arena.'}
              </div>
              <Button variant={dirty ? 'volt' : 'outline'} size="md" disabled={isSaving || !dirty} onClick={saveName}>
                {isSaving ? 'Saving' : 'Save name'}
              </Button>
            </div>
            <SignOutControl />
          </section>

          <div id="appearance" className="acct-anchor"><LookAndFeelCard /></div>
        </div>

        <div className="acct-col">
          <PlanCredits userId={user?.id} />
          <CreditsSection userId={user?.id} />
          <section className="glass acct-card" id="goal" aria-labelledby="acct-goal-h">
            <h2 className="acct-h2" id="acct-goal-h">Weekly goal</h2>
            <GoalControl />
          </section>
        </div>
      </div>

      <div className="acct-grid acct-grid--even">
        <AccountLinks />
        <UsageDataSection />
        <div id="sign-in" className="acct-anchor"><SignOutOtherDevicesSection /></div>
        <DeleteAccountSection />
      </div>
    </div>
  );
}
