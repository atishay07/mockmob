"use client";

// The first run, steps 4 and 5 (web IA plan section 3): which subjects, then how many days a week.
// One primary per screen. Subjects save on Next (the server confirms before the page moves on), the
// landing sample is imported once in the background, and the days step saves the weekly goal. Then
// the student lands on Today (or the page they were sent from, such as pricing).
//
// /onboarding?edit=true is You > Your sheet: subjects only, then back where they came from.
import { SubjectIcon } from '@/components/ui/Glyph';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/AuthProvider';
import { ErrorState, PageSpinner } from '@/components/ui/Skeleton';
import MobiReact from '@/components/brand/MobiReact';
import { mobiAct, useMobiScope } from '@/components/brand/mobiEvents';
import { useCountUp } from '@/lib/motion';
import { getMobiPrefs } from '@/lib/mobiPrefs';
import { loginPathFor, postSignInPath, safeNextPath } from '@/lib/auth-redirect';
import { brandFlags } from '@/../data/brand_flags.mjs';
import { subjectArt } from '@/../data/subject_art.mjs';
import {
  DAY_OPTIONS, DEFAULT_DAYS, GOAL_PATH, SUBJECT_CAP, cleanDays, daysLine, onboardingEntry, pickedLine, rememberMember, resolveStep, runSampleImport,
} from './firstRun';
import '@/app/(app)/arena.css';
import '@/app/(app)/arena-support.css';
import './onboarding.css';

const SCOPE = 'onboarding';
const reducedMotion = () => getMobiPrefs().reduced;
// A failed save keeps the student's choices on screen and names the way forward.
const SUBJECTS_FAILED = 'Your subjects did not save. Your choices are still selected. Try again.';
const DAYS_FAILED = 'Your days did not save. Try again, or skip for now.';
// Where an edit returns when no ?next is given: Practice, where "Edit subjects" lives.
const EDIT_RETURN = '/dashboard';

const COPY = {
  subjects: {
    title: 'Which subjects are you taking?',
    lead: 'Pick up to 5. Your mocks and practice use these, and you can change them any time.',
  },
  edit: {
    title: 'Your subjects',
    lead: 'Pick up to 5. Practice and Today use these.',
  },
  days: {
    title: 'How many days a week can you study?',
    lead: 'Today plans your week around it. Skip keeps 4 days, and you can change it any time.',
  },
};

/** The 3D object for a subject (brand flag), never cropped, with its contact shadow. */
function SubjectObject({ id }) {
  const art = subjectArt(id);
  if (!art) return <span className="ob-tile__glyph" aria-hidden="true"><SubjectIcon id={id} size={22} /></span>;
  return (
    <span className="ob-tile__art" aria-hidden="true" style={{ '--foot-x': `${art.footX * 100}%`, '--foot-w': `${art.footWidth * 100}%` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.src} alt="" width={art.width} height={art.height} loading="lazy" decoding="async" />
    </span>
  );
}

export default function OnboardingPageClient({ preview = false, initialStep = null, edit = false, nextPath = null, brand = null, onFinish = null }) {
  const router = useRouter();
  const { user, status, refreshSession } = useAuth();
  const flags = brandFlags(brand);
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [capHit, setCapHit] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [wanted, setWanted] = useState(initialStep === 'days' ? 'days' : 'subjects');
  const [subjectsSaved, setSubjectsSaved] = useState(false);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const seededUser = useRef(null);
  const saveLock = useRef(false);
  const refreshing = useRef(null);
  const headingRef = useRef(null);
  const firstPaint = useRef(true);
  const mobi = useMobiScope(SCOPE, 'hello');
  const shownCount = useCountUp(selected.length, { duration: 420 });

  const hasSubjects = subjectsSaved || (user?.subjects?.length || 0) > 0;
  const step = resolveStep({ step: wanted, edit, hasSubjects });
  const entry = preview ? (status === 'authenticated' ? 'stay' : 'wait') : onboardingEntry({ status, hasSubjects, edit, step: wanted });
  const copy = edit ? COPY.edit : COPY[step];

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

  // Signed out, or a member who already finished the first run: leave without showing a step.
  useEffect(() => {
    if (entry === 'signup') router.replace('/signup');
    else if (entry === 'login') router.replace(loginPathFor('/onboarding?edit=true'));
    else if (entry === 'leave') router.replace(postSignInPath({ needsOnboarding: false }));
  }, [entry, router]);

  // The landing sample goes to the new account once, silently. Not a mock; no credits.
  useEffect(() => {
    if (preview || entry !== 'stay' || edit) return;
    runSampleImport();
  }, [preview, entry, edit]);

  // A new step moves focus to its title, so a screen reader hears where it is.
  useEffect(() => {
    if (firstPaint.current) { firstPaint.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'instant' : 'smooth' });
  }, [step]);

  // Mobi answers the student's own picks: a nod on the first, a look at the list on the third, and
  // at the cap a plain line instead of a silent ignore. Removing a subject answers nothing.
  const toggleSubject = (id) => {
    if (saveLock.current) return;
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
      setCapHit(false);
    } else if (selected.length < SUBJECT_CAP) {
      const next = selected.length + 1;
      setSelected([...selected, id]);
      if (next === 1) mobiAct(SCOPE, 'nod');
      else if (next === 3) mobiAct(SCOPE, 'read', { hold: 1800 });
    } else {
      setCapHit(true);
      mobiAct(SCOPE, 'oops');
    }
  };

  const chooseDays = (value) => {
    if (saveLock.current) return;
    setDays(cleanDays(value));
    mobiAct(SCOPE, 'nod');
  };

  // Leaves the first run once every save has been confirmed: the saved page (pricing, a gated
  // link) first, then the student's home. Mobi nods first unless motion is reduced.
  const finish = useCallback(async (destination) => {
    setFinishing(true);
    mobiAct(SCOPE, 'nod');
    try { await refreshing.current; } catch { /* the next page checks the session itself */ }
    if (!preview) rememberMember({ pro: Boolean(user?.isPremium), started: edit ? null : false });
    const go = () => {
      if (onFinish) { onFinish(destination); return; }
      if (!preview) router.replace(destination || postSignInPath({ needsOnboarding: false }));
    };
    window.setTimeout(go, reducedMotion() ? 0 : 450);
  }, [edit, onFinish, preview, router, user?.isPremium]);

  const saveSubjects = async () => {
    if (selected.length === 0 || !user?.id || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    mobiAct(SCOPE, 'loading');
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: selected }),
      });
      if (!response.ok) throw new Error(SUBJECTS_FAILED);
      refreshing.current = Promise.resolve(refreshSession()).catch(() => null);
      if (edit) {
        await finish(safeNextPath(nextPath) || EDIT_RETURN);
        return;
      }
      setSubjectsSaved(true);
      setWanted('days');
      mobiAct(SCOPE, 'nod');
      // A reload keeps the student on the days step (the subjects are saved by now).
      if (!preview) { try { window.history.replaceState(null, '', '/onboarding?step=days'); } catch { /* history blocked */ } }
    } catch {
      setError(SUBJECTS_FAILED);
      mobiAct(SCOPE, 'oops');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const saveDays = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    mobiAct(SCOPE, 'loading');
    try {
      const response = await fetch(GOAL_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysPerWeek: cleanDays(days) }),
      });
      if (!response.ok) throw new Error(DAYS_FAILED);
      await finish(null);
    } catch {
      setError(DAYS_FAILED);
      mobiAct(SCOPE, 'oops');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const skipDays = () => {
    if (saveLock.current) return;
    setError(null);
    finish(null);
  };

  if (entry !== 'stay' || (catalogState === 'loading' && step === 'subjects')) {
    return <div className="app-shell onboarding-shell"><PageSpinner label={entry === 'stay' ? 'Loading your subject choices…' : 'Checking your account…'} /></div>;
  }
  if (catalogState === 'error' && step === 'subjects') {
    return <div className="app-shell onboarding-shell p-5"><ErrorState message="Subject choices did not load. Check your connection and try again." onRetry={() => setRetry((count) => count + 1)} /></div>;
  }

  const busy = saving || finishing;
  const supported = subjects.filter((s) => s.practice === 'supported');
  // Saved choices MockMob cannot launch stay visible so they can be removed; never offered as new picks.
  const stale = selected.filter((id) => subjects.find((s) => s.id === id)?.practice !== 'supported');
  const stepIndex = step === 'days' ? 2 : 1;

  return (
    <div className="app-shell onboarding-shell ob" data-step={step}>
      <header className="ob-top">
        <Logo />
        {!edit && (
          <div className="ob-progress">
            <span className="ob-progress__text">Step {stepIndex} of 2</span>
            <span className="ob-progress__bar" aria-hidden="true"><span data-on={stepIndex >= 1 || undefined} /><span data-on={stepIndex >= 2 || undefined} /></span>
          </div>
        )}
        <ThemeToggle />
      </header>

      <main id="main-content" className="ob-main">
        <div className="ob-head">
          <div className="ob-step" key={`head-${step}`}>
            <h1 ref={headingRef} tabIndex={-1} className="ob-title">{copy.title}</h1>
            <p className="ob-lead">{copy.lead}</p>
          </div>
          {/* One Mobi on the screen, beside the title (never over it); he stays put between steps. */}
          <div className="ob-mobi" aria-hidden="true"><MobiReact key={mobi.n} act={mobi.act} size={72} onDone={mobi.onDone} /></div>
        </div>

        <div className="ob-step ob-body" key={`body-${step}`}>
          {error && <p className="ob-error" role="alert">{error}</p>}

          {step === 'subjects' ? (
            <>
              {stale.length > 0 && (
                <section className="ob-stale" aria-labelledby="ob-stale-title">
                  <h2 id="ob-stale-title">Saved subjects without practice yet</h2>
                  <p>They stay on your sheet until you remove them, but they cannot start a practice.</p>
                  <div className="ob-stale__list">
                    {stale.map((id) => {
                      const s = subjects.find((entryRow) => entryRow.id === id);
                      return (
                        <button key={id} type="button" disabled={busy} className="ob-chip mk-press" onClick={() => toggleSubject(id)}>
                          Remove {s?.name || id}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {supported.length === 0 && (
                <p className="ob-empty" role="status">No subjects are open for practice right now. Check again in a little while.</p>
              )}
              <div className={`ob-grid ${flags.subjectArt ? 'ob-grid--art' : ''}`} role="group" aria-label="Subjects">
                {supported.map((s, index) => {
                  const isSelected = selected.includes(s.id);
                  const atCap = !isSelected && selected.length >= SUBJECT_CAP;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      className="ob-tile mk-press"
                      data-selected={isSelected || undefined}
                      style={{ '--i': Math.min(index, 11) }}
                      onClick={() => toggleSubject(s.id)}
                      aria-pressed={isSelected}
                      aria-disabled={atCap || undefined}
                      disabled={busy}
                    >
                      {flags.subjectArt ? <SubjectObject id={s.internalId || s.id} /> : <span className="ob-tile__glyph" aria-hidden="true"><SubjectIcon id={s.internalId || s.id} size={22} /></span>}
                      <span className="ob-tile__name">{s.name}</span>
                      {s.officialCode ? <span className="ob-tile__meta">CUET code {s.officialCode}</span> : null}
                      <span className={`ob-tick ${isSelected ? 'ob-tick--on' : ''}`} aria-hidden="true">
                        {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path className="mk-draw" pathLength="1" d="M5.5 12.5 L10 17 L18.5 7.5" style={{ '--mk-draw-ms': '320ms', '--mk-draw-delay': '110ms' }} /></svg>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <fieldset className="ob-days" disabled={busy}>
              <legend className="sr-only">Days a week</legend>
              <div className="ob-days__row">
                {DAY_OPTIONS.map((n) => (
                  <label key={n} className="ob-day mk-press" data-on={days === n || undefined}>
                    <input type="radio" name="days" value={n} checked={days === n} onChange={() => chooseDays(n)} />
                    <span className="ob-day__n">{n}</span>
                    <span className="sr-only">{n === 1 ? 'day' : 'days'} a week</span>
                  </label>
                ))}
              </div>
              <div className="ob-week" aria-hidden="true">
                {DAY_OPTIONS.map((n) => <span key={n} className="ob-week__pip" data-on={n <= days || undefined} style={{ '--i': n - 1 }} />)}
              </div>
              <p className="ob-week__line" aria-live="polite">{daysLine(days)}</p>
            </fieldset>
          )}
        </div>
      </main>

      <footer className="ob-bar">
        <div className="ob-bar__inner">
          {step === 'subjects' ? (
            <p className="ob-bar__status">
              {selected.length === 0
                ? <span>Pick at least 1 subject</span>
                : <><span aria-hidden="true"><b className="ob-count">{shownCount}</b> of {SUBJECT_CAP} picked</span><span className="sr-only">{pickedLine(selected.length)}</span></>}
              <span className="ob-cap" role="status">{capHit && selected.length >= SUBJECT_CAP ? "That's five. Remove one to swap." : ''}</span>
            </p>
          ) : (
            <p className="ob-bar__status">Saved when you continue</p>
          )}
          <div className="ob-bar__actions">
            {step === 'days' && (
              <button type="button" className="ob-quiet" onClick={skipDays} disabled={busy}>Skip for now</button>
            )}
            {edit && (
              <button type="button" className="ob-quiet" onClick={() => (onFinish ? onFinish(null) : router.replace(safeNextPath(nextPath) || EDIT_RETURN))} disabled={busy}>Cancel</button>
            )}
            {step === 'subjects' ? (
              <Button variant="volt" size="lg" className="ob-primary" disabled={selected.length === 0 || busy} onClick={saveSubjects}>
                {saving ? 'Saving subjects…' : finishing ? 'Saved' : edit ? 'Save subjects' : 'Next'}
              </Button>
            ) : (
              <Button variant="volt" size="lg" className="ob-primary" disabled={busy} onClick={saveDays}>
                {saving ? 'Saving…' : finishing ? 'Saved' : 'Save and continue'}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
