"use client";

import { SubjectIcon } from '@/components/ui/Glyph';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/AuthProvider';
import { ErrorState, PageSpinner } from '@/components/ui/Skeleton';
import MobiReact from '@/components/brand/MobiReact';
import { mobiAct, useMobiScope } from '@/components/brand/pipEvents';
import { useCountUp } from '@/lib/motion';
import { getMobiPrefs } from '@/lib/mobiPrefs';
import '@/app/(app)/arena.css';
import '@/app/(app)/arena-support.css';
import './onboarding.css';

const CAP = 5;
const SCOPE = 'onboarding';

export default function OnboardingPageClient({ preview = false }) {
  const router = useRouter();
  const { user, status, refreshSession } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const seededUser = useRef(null);
  const saveLock = useRef(false);
  const [capHit, setCapHit] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const mobi = useMobiScope(SCOPE, 'hello');
  const shownCount = useCountUp(selected.length, { duration: 420 });

  useEffect(() => {
    if (user?.id && seededUser.current !== user.id) {
      const id = window.setTimeout(() => { seededUser.current = user.id; setSelected(user.subjects || []); }, 0);
      return () => window.clearTimeout(id);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/subjects', { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok || !Array.isArray(data)) throw new Error('catalog_unavailable'); setSubjects(data); setCatalogState('ready'); })
      .catch((failure) => { if (failure.name !== 'AbortError') setCatalogState('error'); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (preview) return;
    if (status === 'unauthenticated') {
      router.push('/signup');
    } else if (status === 'authenticated') {
      const isEdit = typeof window !== 'undefined' && window.location.search.includes('edit=true');
      // If user already has subjects, go to dashboard
      if (user?.subjects?.length > 0 && !isEdit) {
        router.push('/dashboard');
      }
    }
  }, [status, user, router, preview]);

  // Mobi answers the student's own picks: a nod on the first, a look at the list on the third, and
  // at the cap a plain line instead of a silent ignore. Removing a subject answers nothing.
  const toggleSubject = (id) => {
    if (saveLock.current) return;
    if (selected.includes(id)) {
      setSelected(selected.filter(x => x !== id));
      setCapHit(false);
    } else if (selected.length < CAP) {
      const next = selected.length + 1;
      setSelected([...selected, id]);
      if (next === 1) mobiAct(SCOPE, 'nod');
      else if (next === 3) mobiAct(SCOPE, 'read', { hold: 1800 });
    } else {
      setCapHit(true);
      mobiAct(SCOPE, 'oops');
    }
  };

  // After the server has confirmed the save, Mobi nods and then the page moves on.
  const goOn = () => { if (!preview) router.push('/dashboard'); };

  const handleContinue = async () => {
    if (selected.length === 0 || !user?.id || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    mobiAct(SCOPE, 'loading');
    
    // Save to user profile
    try { const response = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjects: selected })
    });
    if (!response.ok) throw new Error('Your subjects did not save. Your choices are still selected. Try again.');
    await refreshSession();
    if (preview) { setError('Preview only: choices checked locally. No account was changed.'); mobiAct(SCOPE, 'nod'); }
    else { mobiAct(SCOPE, 'nod'); setFinishing(true); window.setTimeout(goOn, getMobiPrefs().reduced ? 0 : 700); }
    } catch (failure) { setError(failure.message || 'Your subjects did not save. Try again.'); mobiAct(SCOPE, 'oops'); }
    finally { saveLock.current = false; setSaving(false); }
  };

  if (status === 'loading' || catalogState === 'loading') return <div className="app-shell onboarding-shell"><PageSpinner label="Loading your subject choices…" /></div>;
  if (catalogState === 'error') return <div className="app-shell onboarding-shell p-5"><ErrorState message="Subject choices did not load. Check your connection and try again." onRetry={() => setRetry((count) => count + 1)} /></div>;

  return (
    <div className="app-shell onboarding-shell">
      <nav className="p-5 flex justify-between items-center border-b border-white/5">
        <Logo />
        <ThemeToggle />
      </nav>

      <div className="container-narrow px-5 pt-12 pb-40 text-center">
        <div className="onboarding-pip" aria-hidden="true"><MobiReact key={mobi.n} act={mobi.act} size={84} onDone={mobi.onDone} /></div>
        <div className="eyebrow mb-3">Your practice subjects</div>
        <h1 className="display-md mb-3">What’s on your CUET list?</h1>
        <p className="text-zinc-400 mb-10 max-w-md mx-auto">Select up to 5 CUET UG subjects you want to practise. Only subjects with available practice are listed.</p>
        {error && <p className="con-error mb-5" role="alert">{error}</p>}

        {(() => {
          // Saved choices MockMob cannot launch stay visible so they can be removed; they are never offered as new picks.
          const stale = selected.filter((id) => subjects.find((s) => s.id === id)?.practice !== 'supported');
          if (!stale.length) return null;
          return (
            <div className="glass p-4 mb-6 text-left max-w-3xl mx-auto" role="status">
              <div className="font-display font-bold mb-1">Saved subjects without practice yet</div>
              <p className="text-sm text-zinc-400 mb-3">These stay on your profile until you remove them, but they cannot start a session.</p>
              <div className="flex flex-wrap gap-2">
                {stale.map((id) => {
                  const s = subjects.find((entry) => entry.id === id);
                  return (
                    <button key={id} type="button" disabled={saving} className="btn-outline sm" onClick={() => toggleSubject(id)} aria-label={`Remove ${s?.name || id}`}>
                      {s?.name || id}{s?.officialCode ? ` (${s.officialCode})` : ''} · Remove
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10 text-left max-w-3xl mx-auto mk-stagger">
          {subjects.filter((s) => s.practice === 'supported').map((s, index) => {
            const isSelected = selected.includes(s.id);
            return (
              <button
                type="button"
                key={s.id} 
                className={`subject-card mk-press ${isSelected ? 'selected' : ''}`}
                style={{ '--i': Math.min(index, 11) }}
                onClick={() => toggleSubject(s.id)}
                aria-pressed={isSelected}
                aria-disabled={!isSelected && selected.length >= CAP ? true : undefined}
                disabled={saving}
              >
                <div className="flex justify-between items-start">
                  <div className="glyph"><SubjectIcon id={s.internalId || s.id} size={22} /></div>
                  <span className={`ob-tick ${isSelected ? 'ob-tick--on' : ''}`} aria-hidden="true">
                    {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path className="mk-draw" pathLength="1" d="M5.5 12.5 L10 17 L18.5 7.5" style={{ '--mk-draw-ms': '320ms', '--mk-draw-delay': '110ms' }} /></svg>}
                  </span>
                </div>
                <div className="font-display font-bold text-lg mb-1">{s.name}</div>
                <div className="text-xs text-zinc-500">{s.officialCode ? `CUET code ${s.officialCode} · ` : ''}{Array.isArray(s.chapters) ? `${s.chapters.length} chapters` : 'Chapter list unavailable'}</div>
              </button>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-5 bg-ink/90 backdrop-blur-md border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 z-50">
          <div className="text-sm text-zinc-400">
            Selected <span className="text-white font-bold ob-count" aria-hidden="true">{shownCount}</span><span className="sr-only">{selected.length}</span> / {CAP} subjects
            <span className="ob-cap" role="status">{capHit && selected.length >= CAP ? "That's five. Remove one to swap." : ''}</span>
          </div>
          <Button 
            variant="volt" 
            size="lg" 
            disabled={selected.length === 0 || saving || finishing} 
            onClick={handleContinue}
            className="w-full md:w-auto"
          >
            {saving ? 'Saving subjects…' : 'Save subjects and start'} <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
