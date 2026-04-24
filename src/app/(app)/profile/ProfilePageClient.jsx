"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icons';
import { SkeletonCard, ErrorState } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { apiGet, apiPatch } from '@/lib/fetcher';

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
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2">{'// Identity'}</div>
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
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="flex flex-col gap-6 view">
      <div>
        <div className="eyebrow mb-2">{'// Identity'}</div>
        <h1 className="display-md">Your <span className="text-volt italic">profile</span></h1>
        <p className="text-sm text-zinc-500 mt-2">Keep your public identity polished while the backend handles the serious stuff.</p>
      </div>

      {saveState.message && (
        <div
          className={`glass p-4 text-sm ${saveState.type === 'error' ? '' : 'volt-soft'}`}
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
                  <p className="text-sm text-zinc-400">Avatar upload is queued for a future pass. Your initials are used as the fallback today.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap border-t border-white/5 pt-4">
            <div className="text-sm text-zinc-500">Changes sync instantly across the dashboard and navbar.</div>
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
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="glass p-6 volt-soft">
            <div className="mono-label mb-2">Credit balance</div>
            <div className="display-md text-volt">{user?.creditBalance || 0}</div>
            <p className="text-sm text-zinc-400 mt-2">Use credits to generate premium mocks. Earn more by contributing quality questions.</p>
          </div>

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
              <div className="mono-label mb-2">Subjects</div>
              <div className="display-md">{user?.subjects?.length || 0}</div>
            </div>
            <div className="glass p-5">
              <div className="mono-label mb-2">Streak</div>
              <div className="display-md">Soon</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
