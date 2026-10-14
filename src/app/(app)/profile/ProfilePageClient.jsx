"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icons';
import { SkeletonCard, ErrorState } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { PlanCard } from '@/components/billing/PlanCard';
import { SignOutOtherDevicesSection } from '@/components/auth/SignOutOtherDevices';
import { api, apiGet, apiPatch, apiPost } from '@/lib/fetcher';
import './profile-privacy.css';
import ArenaHead from '@/components/arena/ArenaHead';
import StartOnSetting from './StartOnSetting';

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
    <section className="glass p-6 privacy-block" aria-labelledby="usage-data-title">
      <div>
        <div className="mono-label mb-2">Privacy</div>
        <h2 id="usage-data-title">Usage data</h2>
      </div>
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
            <legend className="text-sm text-zinc-400">Your age</legend>
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
    <section className="glass p-6 privacy-block" aria-labelledby="delete-account-title">
      <div>
        <div className="mono-label mb-2">Account</div>
        <h2 id="delete-account-title">Delete account</h2>
      </div>
      <p>We delete your account and study records within 30 days. Payment records required by law are kept.</p>
      {pending ? (
        <p className="privacy-note privacy-note--ok" role="status">Deletion pending. You asked on {fmtDate(pending)} and we complete it within 30 days. To cancel, email support@mockmob.in.</p>
      ) : !open ? (
        <div><Button variant="outline" size="md" className="privacy-danger" onClick={() => setOpen(true)}>Delete account</Button></div>
      ) : (
        <div className="privacy-confirm">
          <label className="block">
            <span className="text-sm text-zinc-400 mb-2 block">Type DELETE to confirm</span>
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

export default function ProfilePageClient() {
  const { user, status, refreshSession } = useAuth();
  const toast = useToast();
  const [attempts, setAttempts] = useState([]);
  const [pageStatus, setPageStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [draftName, setDraftName] = useState(null);
  const [saveState, setSaveState] = useState({ type: null, message: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!user?.id) return;

    let alive = true;
    async function load() {
      try {
        setPageStatus('loading');
        const data = await apiGet(`/api/attempts?userId=${user.id}`);
        if (!alive) return;
        setAttempts(Array.isArray(data) ? data : []);
        setPageStatus('ready');
      } catch (e) {
        if (!alive) return;
        setError(e.message);
        setPageStatus('error');
      }
    }

    load();
    return () => { alive = false; };
  }, [status, user]);

  const averageScore = useMemo(() => {
    if (attempts.length === 0) return '—';
    const total = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
    return `${Math.round(total / attempts.length)}%`;
  }, [attempts]);
  const currentName = draftName ?? (user?.name || '');

  if (pageStatus === 'loading') {
    return (
      <div className="student-page student-page--profile flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2">{'Identity'}</div>
          <div className="h-10 w-64 skeleton mb-2" />
          <div className="h-4 w-56 skeleton" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  if (pageStatus === 'error') {
    return <div className="student-page student-page--profile"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>;
  }

  return (
    <div className="student-page student-page--profile flex flex-col gap-6 view">
      <ArenaHead eyebrow="Account" title="Your account." lede="Update your name, subjects and plan. Your practice history stays with your account." />

      {saveState.message && (
        <div
          className={`glass p-4 text-sm ${saveState.type === 'error' ? '' : 'volt-soft'}`}
          role={saveState.type === 'error' ? 'alert' : 'status'}
          style={saveState.type === 'error' ? { borderColor: 'rgba(248,113,113,0.25)', color: '#fca5a5' } : { color: '#d2f000' }}
        >
          <div className="flex items-center gap-2">
            <Icon name={saveState.type === 'error' ? 'alert' : 'check'} style={{ width: '16px', height: '16px' }} />
            {saveState.message}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <section className="glass p-6">
          <div className="flex items-start gap-4 flex-col sm:flex-row">
            <Avatar name={user?.name || user?.email} size="xl" />
            <div className="flex-1">
              <div className="mono-label mb-2">Account overview</div>
              <div className="grid gap-4">
                <label className="block">
                  <span className="text-sm text-zinc-400 mb-2 block">Display name</span>
                  <input
                    className="input"
                    value={currentName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Enter your display name"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-zinc-400 mb-2 block">Email</span>
                  <input className="input" value={user?.email || ''} disabled />
                </label>

                <div className="glass p-4 volt-soft">
                  <div className="mono-label mb-2">Avatar</div>
                  <p className="text-sm text-zinc-400">Your initials are your avatar. Change your display name to update them.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap border-t border-white/5 pt-4">
            <div className="text-sm text-zinc-500">Save your name to update it across MockMob.</div>
            <Button
              variant="volt"
              size="md"
              disabled={isSaving || !currentName.trim() || currentName.trim() === (user?.name || '')}
              onClick={async () => {
                setIsSaving(true);
                setSaveState({ type: null, message: '' });
                try {
                  await apiPatch(`/api/users/${user.id}`, { name: currentName.trim() });
                  await refreshSession({ silent: true });
                  setDraftName(null);
                  setSaveState({ type: 'success', message: 'Profile updated successfully.' });
                  toast.success('Profile updated successfully.');
                } catch (e) {
                  const message = e.message || 'Failed to update profile.';
                  setSaveState({ type: 'error', message });
                  toast.error(message);
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? 'Saving…' : 'Save name'}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <PlanCard />

          <div className="grid grid-cols-2 gap-3">
            <div className="glass p-5">
              <div className="mono-label mb-2">Mocks taken</div>
              <div className="display-md">{attempts.length}</div>
            </div>
            <div className="glass p-5">
              <div className="mono-label mb-2">Avg score</div>
              <div className="display-md">{averageScore}</div>
            </div>
            <div className="glass p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="mono-label">Subjects</div>
                <Link href="/onboarding?edit=true" className="account-edit text-volt text-xs font-semibold hover:underline">Edit subjects</Link>
              </div>
              <div className="display-md">{user?.subjects?.length || 0}</div>
            </div>
            <div className="glass p-5">
              <div className="mono-label mb-2">Next session</div>
              <Link href="/today" className="account-edit">Open Today ↗</Link>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StartOnSetting />
        <UsageDataSection />
        <SignOutOtherDevicesSection />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
