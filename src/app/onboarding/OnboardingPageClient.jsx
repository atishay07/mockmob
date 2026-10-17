"use client";

// The first run, in two steps: which subjects, then how many study days a week (firstRun.js).
// One primary per screen. Subjects save on Next and the server confirms before the page moves on;
// the days step saves the weekly goal Today's week ring is drawn from. Then the student lands on
// Practice, as before. /onboarding?edit=true (Edit subjects on Practice and You) is subjects only.
// The auth and redirect rules are the live ones (firstRun.js onboardingEntry).
//
// Motion answers the student: a picked subject inks its tick and drops into the bar's five slots,
// a sixth pick shakes the slots, the step slides in the way the student is going, the volt thumb
// slides to the chosen day and the week ring redraws with one arc per day. Mobi is here once,
// beside the title, never over it. Reduced motion (device or MockMob setting) drops all of it.
import { SubjectIcon } from '@/components/ui/Glyph';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/AuthProvider';
import { ErrorState, PageSpinner } from '@/components/ui/Skeleton';
import MobiReact from '@/components/brand/MobiReact';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { mobiAct, useMobiScope } from '@/components/brand/pipEvents';
import { useCountUp } from '@/lib/motion';
import { getMobiPrefs } from '@/lib/mobiPrefs';
import { SUBJECT_RULE_NOTE } from '@/lib/cuetRules.mjs';
import { ONBOARDING_LEAD, bankCount, tileCount } from '@/lib/paperCopy.mjs';
import {
  DAY_OPTIONS, DEFAULT_DAYS, DONE_PATH, GOAL_PATH, SIGNUP_PATH, STUDY_DAY_RULE, SUBJECT_CAP,
  cleanDays, dayRhythm, daysLine, goalBody, mobiForDays, onboardingEntry, pickedLine, pickedSlots, resolveStep, ringArcs, thumbIndex,
} from './firstRun';
import '@/app/(app)/arena.css';
import '@/app/(app)/arena-support.css';
import './onboarding.css';

const SCOPE = 'onboarding';
const reducedMotion = () => getMobiPrefs().reduced;
// A failed save keeps the student's choices on screen and names the way forward.
const SUBJECTS_FAILED = 'Your subjects did not save. Your choices are still selected. Try again.';
const DAYS_FAILED = 'Your days did not save. Try again, or skip for now.';

const COPY = {
  subjects: {
    title: 'Which subjects are you taking?',
    lead: ONBOARDING_LEAD,
  },
  edit: {
    title: 'Your subjects',
    lead: 'Pick up to 5. Practice and your mocks use these.',
  },
  days: {
    title: 'How many days a week can you study?',
    lead: 'Today shows your week as seven days, with a mark on each study day. Skip keeps 4.',
  },
};

function Tick({ on }) {
  return (
    <span className={`ob-tick ${on ? 'ob-tick--on' : ''}`} aria-hidden="true">
      {on && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path className="mk-draw" pathLength="1" d="M5.5 12.5 L10 17 L18.5 7.5" style={{ '--mk-draw-ms': '320ms', '--mk-draw-delay': '110ms' }} /></svg>}
    </span>
  );
}

/** The week ring as Today draws it, on a lamp-lit dial: one arc per study day, redrawn on change. */
function WeekDial({ days }) {
  const shown = useCountUp(days, { duration: 360 });
  const arcs = ringArcs(days);
  return (
    <div className="ob-dial" role="img" aria-label={`Your week ring on Today: ${daysLine(days)}`}>
      <span className="ob-dial__plate" aria-hidden="true" />
      <svg className="ob-dial__ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="ob-dial__base" cx="60" cy="60" r="46" />
        <g key={days} className="ob-dial__arcs">
          {arcs.map((d, i) => <path key={i} d={d} pathLength="1" className="ob-dial__arc" style={{ '--i': i }} />)}
        </g>
      </svg>
      <span className="ob-dial__count" aria-hidden="true">
        <b>{shown}</b>
        <small>{days === 1 ? 'day' : 'days'} a week</small>
      </span>
    </div>
  );
}

export default function OnboardingPageClient({ preview = false }) {
  const router = useRouter();
  const query = useSearchParams();
  const edit = query?.get('edit') === 'true';
  const { user, status, refreshSession } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [capHit, setCapHit] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // ?step=days reopens the second step after a reload (the subjects are saved by then).
  const [arrivedForDays] = useState(() => query?.get('step') === 'days');
  const [wanted, setWanted] = useState(() => (arrivedForDays ? 'days' : 'subjects'));
  const [dir, setDir] = useState('in');
  const [savedThisVisit, setSavedThisVisit] = useState(false);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const seededUser = useRef(null);
  const saveLock = useRef(false);
  const refreshing = useRef(null);
  const touchedDays = useRef(false);
  const goalRead = useRef(null);
  const pausedUntil = useRef(null);
  const headingRef = useRef(null);
  const firstPaint = useRef(true);
  const mobi = useMobiScope(SCOPE, 'hello');
  const shownCount = useCountUp(selected.length, { duration: 420 });

  const savedSubjects = user?.subjects?.length || 0;
  const step = resolveStep({ wanted, edit, hasSubjects: savedThisVisit || savedSubjects > 0 });
  const entry = preview
    ? (status === 'authenticated' ? 'stay' : 'wait')
    : onboardingEntry({ status, savedSubjects, edit, inFlow: savedThisVisit || arrivedForDays });
  const copy = edit ? COPY.edit : COPY[step];

  useEffect(() => {
    if (user?.id && seededUser.current !== user.id) {
      const id = window.setTimeout(() => { seededUser.current = user.id; setSelected(user.subjects || []); }, 0);
      return () => window.clearTimeout(id);
    }
  }, [user]);

  // Each subject's bank size on its tile, from the stored daily counts. A failed read only leaves the count off.
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/stats', { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (response.ok) setStats(data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/subjects', { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok || !Array.isArray(data)) throw new Error('catalog_unavailable'); setSubjects(data); setCatalogState('ready'); })
      .catch((failure) => { if (failure.name !== 'AbortError') setCatalogState('error'); });
    return () => controller.abort();
  }, [retry]);

  // The live rules: signed out goes to sign-up; a member who already has subjects goes to Practice.
  useEffect(() => {
    if (preview) return;
    if (entry === 'signup') router.push(SIGNUP_PATH);
    else if (entry === 'leave') router.push(DONE_PATH);
  }, [entry, preview, router]);

  // On the days step, a member who set days before sees their own number (a new account reads 4),
  // and a pause set in the app is kept for the save (the route clears a pause it is not sent).
  const onDays = step === 'days' && entry === 'stay';
  useEffect(() => {
    if (!onDays) return undefined;
    const controller = new AbortController();
    goalRead.current = fetch(GOAL_PATH, { signal: controller.signal, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((goal) => {
        if (!goal) return;
        pausedUntil.current = goal.pausedUntil ?? null;
        if (!touchedDays.current && DAY_OPTIONS.includes(goal.daysPerWeek)) setDays(goal.daysPerWeek);
      })
      .catch(() => { /* the default stays; saving still works */ });
    return () => controller.abort();
  }, [onDays]);

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
    setNotice(null);
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
      setShaking(true);
      mobiAct(SCOPE, 'oops');
    }
  };

  const chooseDays = (value) => {
    if (saveLock.current) return;
    const n = cleanDays(value);
    touchedDays.current = true;
    setNotice(null);
    setError(null);
    if (n === days) return;
    setDays(n);
    mobiAct(SCOPE, mobiForDays(n));
  };

  const setUrl = (path) => {
    if (preview) return;
    try { window.history.replaceState(null, '', path); } catch { /* history blocked; the step still shows */ }
  };

  // Leaves once every save has been confirmed. Mobi answers first unless motion is reduced.
  const finish = useCallback(async (act) => {
    setFinishing(true);
    mobiAct(SCOPE, act);
    try { await refreshing.current; } catch { /* the next page checks the session itself */ }
    window.setTimeout(() => { if (!preview) router.push(DONE_PATH); }, reducedMotion() ? 0 : 700);
  }, [preview, router]);

  const saveSubjects = async () => {
    if (selected.length === 0 || !user?.id || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    mobiAct(SCOPE, 'loading');
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: selected }),
      });
      if (!response.ok) throw new Error(SUBJECTS_FAILED);
      if (edit) {
        await refreshSession();
        if (preview) { setNotice('Preview only: choices checked locally. No account was changed.'); mobiAct(SCOPE, 'nod'); }
        else await finish('nod');
        return;
      }
      // Marked before the session refresh, so the refreshed subjects never send the student away.
      setSavedThisVisit(true);
      setDir('fwd');
      setWanted('days');
      setCapHit(false);
      mobiAct(SCOPE, 'nod');
      refreshing.current = Promise.resolve(refreshSession()).catch(() => null);
      setUrl('/onboarding?step=days');
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
    if (preview) { setNotice('Preview only: your days were checked here. No account was changed.'); mobiAct(SCOPE, 'nod'); return; }
    saveLock.current = true;
    setSaving(true);
    setError(null);
    mobiAct(SCOPE, 'loading');
    try {
      // The goal read carries any pause; wait for it briefly, never for long.
      await Promise.race([goalRead.current, new Promise((resolve) => { window.setTimeout(resolve, 2500); })]);
      const response = await fetch(GOAL_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalBody(days, pausedUntil.current)),
      });
      if (!response.ok) throw new Error(DAYS_FAILED);
      await finish('cheer');
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
    if (preview) { setNotice('Preview only: skipping keeps 4 days. No account was changed.'); return; }
    finish('nod');
  };

  const backToSubjects = () => {
    if (saveLock.current) return;
    setError(null);
    setNotice(null);
    setDir('back');
    setWanted('subjects');
    setUrl('/onboarding');
  };

  if (entry !== 'stay' || (catalogState === 'loading' && step === 'subjects')) {
    return <div className="app-shell onboarding-shell"><PageSpinner label={entry === 'stay' ? 'Loading your subject choices…' : 'Checking your account…'} /></div>;
  }
  if (catalogState === 'error' && step === 'subjects') {
    return <div className="app-shell onboarding-shell p-5"><ErrorState scene="unreachable" message="Subject choices did not load. Check your connection and try again." onRetry={() => setRetry((count) => count + 1)} /></div>;
  }

  const busy = saving || finishing;
  const find = (id) => subjects.find((s) => s.id === id);
  const supported = subjects.filter((s) => s.practice === 'supported');
  // Saved choices MockMob cannot launch stay visible so they can be removed; never offered as new picks.
  const stale = selected.filter((id) => find(id)?.practice !== 'supported');
  const stepIndex = step === 'days' ? 2 : 1;
  const rhythm = dayRhythm(days);

  return (
    <div className="app-shell onboarding-shell ob" data-step={step}>
      <header className="ob-top">
        <Logo />
        {!edit && (
          <div className="ob-progress" role="img" aria-label={`Step ${stepIndex} of 2`}>
            <span className="ob-progress__text" aria-hidden="true">Step {stepIndex} of 2</span>
            <span className="ob-progress__bar" aria-hidden="true">
              <span><i data-on="" /></span>
              <span><i data-on={stepIndex >= 2 ? '' : undefined} /></span>
            </span>
          </div>
        )}
        <ThemeToggle />
      </header>

      <main id="main-content" className="ob-main">
        <div className="ob-head">
          <div className="ob-step" data-dir={dir} key={`head-${step}`}>
            {step === 'days' && (
              <button type="button" className="ob-back" onClick={backToSubjects} disabled={busy}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
                Back to subjects
              </button>
            )}
            <h1 ref={headingRef} tabIndex={-1} className="ob-title">{copy.title}</h1>
            <p className="ob-lead">{copy.lead}</p>
            {step === 'subjects' ? <p className="ob-rule">{SUBJECT_RULE_NOTE}</p> : null}
          </div>
          {/* One Mobi on the screen, beside the title (never over it); he stays put between steps. */}
          <div className="ob-mobi" aria-hidden="true"><MobiReact key={mobi.n} act={mobi.act} size={88} onDone={mobi.onDone} /></div>
        </div>

        <div className="ob-step ob-body" data-dir={dir} key={`body-${step}`}>
          {error && <p className="ob-error" role="alert">{error}</p>}
          {notice && <p className="ob-notice" role="status">{notice}</p>}

          {step === 'subjects' ? (
            <>
              {stale.length > 0 && (
                <section className="ob-stale" aria-labelledby="ob-stale-title">
                  <h2 id="ob-stale-title">Saved subjects without practice yet</h2>
                  <p>They stay on your profile until you remove them, but they cannot start a session.</p>
                  <div className="ob-stale__list">
                    {stale.map((id) => {
                      const s = find(id);
                      return (
                        <button key={id} type="button" disabled={busy} className="ob-chip mk-press" onClick={() => toggleSubject(id)}>
                          Remove {s?.name || id}{s?.officialCode ? ` (${s.officialCode})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {supported.length === 0 && (
                <p className="ob-empty" role="status">No subjects are open for practice right now. Check again in a little while.</p>
              )}
              <div className="ob-grid" role="group" aria-label="Subjects">
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
                      {/* The subject's lamp-lit object; its lamp turns on when the subject is picked. */}
                      <span className="ob-tile__art" aria-hidden="true"><SubjectObject id={s.internalId || s.id} size={76} lit priority={index < 6} /></span>
                      <span className="ob-tile__name">{s.name}</span>
                      <span className="ob-tile__meta">
                        {s.officialCode ? <span>CUET code {s.officialCode}</span> : null}
                        {Array.isArray(s.chapters) && s.chapters.length > 0 ? <span>{s.chapters.length} chapters</span> : null}
                        {tileCount(bankCount(stats, s.internalId, s.id)) ? <span>{tileCount(bankCount(stats, s.internalId, s.id))}</span> : null}
                      </span>
                      <Tick on={isSelected} />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <section className="ob-days" aria-labelledby="ob-days-title">
              <div className="ob-track" role="radiogroup" aria-label="Study days a week" aria-disabled={busy || undefined} style={{ '--ob-pick': thumbIndex(days) }}>
                <span className="ob-track__thumb" aria-hidden="true" />
                {DAY_OPTIONS.map((n) => (
                  <label key={n} className="ob-track__opt" data-on={days === n || undefined}>
                    <input type="radio" name="ob-days" value={n} checked={days === n} disabled={busy} onChange={() => chooseDays(n)} />
                    <span className="ob-track__n" aria-hidden="true">{n}</span>
                    <span className="sr-only">{daysLine(n)}</span>
                  </label>
                ))}
              </div>
              <div className="ob-track__ends" aria-hidden="true"><span>Light</span><span>Every day</span></div>

              <div className="ob-stage">
                <figure className="ob-stage__dial">
                  <WeekDial days={days} />
                  <figcaption>Your week ring on Today</figcaption>
                </figure>
                <div className="ob-stage__copy">
                  <div aria-live="polite">
                    <div className="ob-stage__swap" key={days}>
                      <h2 id="ob-days-title" className="ob-stage__name">{rhythm.name}</h2>
                      <p className="ob-stage__line">{rhythm.line}</p>
                    </div>
                  </div>
                  <p className="ob-stage__rule">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>
                    <span>{STUDY_DAY_RULE}</span>
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="ob-bar">
        <div className="ob-bar__inner">
          {step === 'subjects' ? (
            <div className="ob-bar__status">
              <span
                className={`ob-slots ${shaking ? 'mk-shake' : ''}`}
                aria-hidden="true"
                onAnimationEnd={(event) => { if (event.target === event.currentTarget) setShaking(false); }}
              >
                {pickedSlots(selected).map((id, i) => (
                  <span key={id || `empty-${i}`} className="ob-slot" data-on={id ? '' : undefined}>
                    {id ? <SubjectIcon id={find(id)?.internalId || id} size={14} /> : null}
                  </span>
                ))}
              </span>
              <span className="ob-bar__text">
                {selected.length === 0
                  ? <span>Pick at least 1 subject</span>
                  : <><span aria-hidden="true"><b className="ob-count">{shownCount}</b> of {SUBJECT_CAP} picked</span><span className="sr-only">{pickedLine(selected.length)}</span></>}
                <span className="ob-cap" role="status">{capHit && selected.length >= SUBJECT_CAP ? "That's five, the most CUET allows. Remove one to swap." : ''}</span>
              </span>
            </div>
          ) : (
            <div className="ob-bar__status">
              <span className="ob-bar__text">
                <b>{daysLine(days)}</b>
                <span className="ob-bar__sub">Saved when you continue</span>
              </span>
            </div>
          )}
          <div className="ob-bar__actions">
            {step === 'days' && (
              <button type="button" className="ob-quiet" onClick={skipDays} disabled={busy}>Skip for now</button>
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
