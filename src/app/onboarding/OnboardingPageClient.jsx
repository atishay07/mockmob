"use client";

// The first run, in three steps: which subjects, how many study days a week, then the colleges you are aiming for
// (optional, saved to My colleges as you pick; firstRun.js). Subjects hold the app's version 13 parity: an optional DU course
// search that shows the subjects the course takes (CourseFinder), a subject search with the CUET papers MockMob cannot practise
// listed and never hidden, and a sixth pick answered with the reason and one tap to swap (subjectPick.mjs).
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
import CollegePicker from '@/components/colleges/CollegePicker';
import DailyMinutes from '@/components/goal/DailyMinutes';
import { goalMinutesFromResponse, pickMinutes } from '@/lib/goalMinutes.mjs';
import { mirrorToPlan, readDeviceMinutes, writeDeviceMinutes } from '@/lib/goalMinutesStore';
import { Search } from 'lucide-react';
import { loadIndex } from '@/lib/du/client';
import { neededByEvery, toDuSubjectId } from '@/lib/du/courseRule.mjs';
import { useAboveKeyboard } from '@/lib/du/useAboveKeyboard';
import CourseFinder from './CourseFinder';
import { PRESET_BASE, PRESET_KEY, PRESET_LEAD, PRESET_OWN, PRESET_TITLE, SETS_LABEL, applySet, presetAddLabel, presetAdds, presetAvailable, setMatches, setsFor } from './commonSets.mjs';
import {
  LANGUAGE_PAPERS, NOT_YET_NOTE, NOT_YET_TITLE, OTHER_PAPERS, SEARCH_HINT, capCopy, noSubjectMatch, notYetSubjects, pickableSubjects, shortSubjectName, subjectCountLine, swapLast,
} from './subjectPick.mjs';
import { useAuth } from '@/components/AuthProvider';
import { noteOnboardedNow } from '@/components/pro/proNudgeStore';
import { ErrorState, PageSpinner } from '@/components/ui/Skeleton';
import MobiReact from '@/components/brand/MobiReact';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { mobiAct, useMobiScope } from '@/components/brand/pipEvents';
import { useCountUp } from '@/lib/motion';
import { getMobiPrefs } from '@/lib/mobiPrefs';
import { SUBJECT_RULE_NOTE } from '@/lib/cuetRules.mjs';
import { ONBOARDING_STEPS, bankCount, tileCount } from '@/lib/paperCopy.mjs';
import {
  DAY_OPTIONS, DEFAULT_DAYS, DONE_PATH, GOAL_PATH, SIGNUP_PATH, STUDY_DAY_RULE, SUBJECT_CAP,
  cleanDays, dayRhythm, daysLine, goalBody, mobiForDays, onboardingEntry, pickedLine, pickedSlots, resolveStep, ringArcs, stepFromQuery, thumbIndex,
} from './firstRun';
import '@/app/(app)/arena.css';
import '@/app/(app)/arena-support.css';
import './onboarding.css';

const SCOPE = 'onboarding';
const reducedMotion = () => getMobiPrefs().reduced;
// A failed save keeps the student's choices on screen and names the way forward.
// The course a student looked up stays for this visit (the colleges step opens on it); never kept beyond the tab.
const COURSE_KEY = 'mm:ob:course:v1';
const readCourse = () => { try { return window.sessionStorage.getItem(COURSE_KEY) || null; } catch { return null; } };
const writeCourse = (id) => { try { if (id) window.sessionStorage.setItem(COURSE_KEY, id); else window.sessionStorage.removeItem(COURSE_KEY); } catch { /* private window: the choice lasts this page only */ } };
const SUBJECTS_FAILED = 'Your subjects did not save. Your choices are still selected. Try again.';
const DAYS_FAILED = 'Your days did not save. Try again, or skip for now.';

// Each step's headline and lead live in paperCopy (ONBOARDING_STEPS), so the copy tests read the same words.
const COPY = ONBOARDING_STEPS;

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

// Pages that send a student to Edit subjects and want them back after the save (the Mob needs a subject to start).
const BACK_PATHS = ['/mob'];

export default function OnboardingPageClient({ preview = false }) {
  const router = useRouter();
  const query = useSearchParams();
  const edit = query?.get('edit') === 'true';
  // Edit subjects can return to the page that asked for them. Only known pages: never a path from the address bar.
  const back = edit && BACK_PATHS.includes(query?.get('back')) ? query.get('back') : null;
  const { user, status, refreshSession } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // The sixth subject a student asked for (its id), while the reason and the swap are on screen.
  const [capAsk, setCapAsk] = useState(null);
  const [subjectQuery, setSubjectQuery] = useState('');
  // The first screen offers Commerce ticked (W4); "Pick my own" puts it away for this visit.
  const [ownPick, setOwnPick] = useState(false);
  const [rules, setRules] = useState(null);
  const [rulesFailed, setRulesFailed] = useState(false);
  const [rulesTry, setRulesTry] = useState(0);
  const [courseId, setCourseId] = useState(null);
  const [shaking, setShaking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // ?step=days or ?step=colleges reopens that step after a reload (the subjects are saved by then).
  const [arrivedForDays] = useState(() => stepFromQuery(query?.get('step')) !== null);
  const [wanted, setWanted] = useState(() => stepFromQuery(query?.get('step')) || 'subjects');
  const [dir, setDir] = useState('in');
  const [savedThisVisit, setSavedThisVisit] = useState(false);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const seededUser = useRef(null);
  const saveLock = useRef(false);
  const refreshing = useRef(null);
  const touchedDays = useRef(false);
  // The daily time is optional: nothing is chosen until the student chooses (or already holds one from before).
  const [minutes, setMinutes] = useState(null);
  const touchedMinutes = useRef(false);
  const goalRead = useRef(null);
  const pausedUntil = useRef(null);
  const headingRef = useRef(null);
  const gridRef = useRef(null);
  const presetSeeded = useRef(false);
  const firstPaint = useRef(true);
  const mobi = useMobiScope(SCOPE, 'hello');
  // A search field is never left under the on-screen keyboard (the colleges step's course and college searches too).
  useAboveKeyboard();
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

  // The DU course list, for the course search, its subject rule and the colleges step (cached by the DU client).
  useEffect(() => {
    let alive = true;
    loadIndex().then((data) => { if (alive) { setRules(data); setRulesFailed(false); } }).catch(() => { if (alive) setRulesFailed(true); });
    return () => { alive = false; };
  }, [rulesTry]);
  useEffect(() => {
    const id = window.setTimeout(() => setCourseId(readCourse()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const chooseCourse = (id) => { setCourseId(id); writeCourse(id); };

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
        if (!touchedMinutes.current) setMinutes(pickMinutes(goal.dailyMinutes, readDeviceMinutes()).minutes);
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
      setCapAsk(null);
    } else if (selected.length < SUBJECT_CAP) {
      const next = selected.length + 1;
      setSelected([...selected, id]);
      setCapAsk(null);
      if (next === 1) mobiAct(SCOPE, 'nod');
      else if (next === 3) mobiAct(SCOPE, 'read', { hold: 1800 });
    } else {
      // A sixth pick is answered with the reason and one tap to swap, beside the Next key where the student is looking.
      setCapAsk(id);
      setShaking(true);
      mobiAct(SCOPE, 'oops');
    }
  };

  // A common set, one tap: it replaces the picks; the same tap again puts it away.
  const tapSet = (set) => {
    if (saveLock.current) return;
    const next = applySet(set, selected);
    setSelected(next);
    setCapAsk(null);
    setNotice(null);
    if (next.length) mobiAct(SCOPE, 'nod');
  };

  // "Pick my own": the full grid with nothing ticked. Focus moves to the grid so a keyboard or screen reader lands on it.
  const pickOwn = () => {
    if (saveLock.current) return;
    setOwnPick(true);
    setSelected([]);
    setCapAsk(null);
    setNotice(null);
    window.setTimeout(() => gridRef.current?.focus({ preventScroll: true }), 0);
  };

  // Swap: the most recent pick makes room for the one asked for. Nothing else moves.
  const swapForCap = () => {
    if (saveLock.current || !capAsk) return;
    setSelected(swapLast(selected, capAsk));
    setCapAsk(null);
    mobiAct(SCOPE, 'nod');
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
    // The first run is done: the first usage session starts now (D81). Editing subjects later never starts one.
    if (!edit && !preview) noteOnboardedNow(user?.id);
    try { await refreshing.current; } catch { /* the next page checks the session itself */ }
    window.setTimeout(() => { if (!preview) router.push(back || DONE_PATH); }, reducedMotion() ? 0 : 700);
  }, [preview, router, back, edit, user?.id]);

  const saveSubjects = async (list) => {
    const picks = Array.isArray(list) ? list : selected;
    if (picks.length === 0 || !user?.id || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    mobiAct(SCOPE, 'loading');
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: picks }),
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
      setCapAsk(null);
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
    if (preview) { setNotice('Preview only: your days were checked here. No account was changed.'); toColleges('nod'); return; }
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
        body: JSON.stringify({ ...goalBody(days, pausedUntil.current), ...(minutes ? { dailyMinutes: minutes } : {}) }),
      });
      if (!response.ok) throw new Error(DAYS_FAILED);
      // The days are saved. The daily time goes with them when the server holds it; otherwise it stays on this device and the
      // plan is pointed at the longest length the server accepts. Neither can hold up the first run.
      if (minutes) {
        const body = await response.json().catch(() => null);
        writeDeviceMinutes(minutes);
        if (goalMinutesFromResponse(body, minutes) !== 'account') mirrorToPlan(minutes);
      }
      toColleges('cheer');
    } catch {
      setError(DAYS_FAILED);
      mobiAct(SCOPE, 'oops');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  // The colleges step comes after the days, saved or skipped. Its picks save one by one as they are made.
  const toColleges = (act = 'nod') => {
    setError(null);
    setNotice(null);
    setDir('fwd');
    setWanted('colleges');
    mobiAct(SCOPE, act);
    setUrl('/onboarding?step=colleges');
  };

  const skipDays = () => {
    if (saveLock.current) return;
    toColleges('nod');
  };

  const backToDays = () => {
    if (saveLock.current) return;
    setError(null);
    setNotice(null);
    setDir('back');
    setWanted('days');
    setUrl('/onboarding?step=days');
  };

  const finishColleges = () => {
    if (saveLock.current) return;
    if (preview) { setNotice('Preview only: the first run ends here and Practice opens.'); mobiAct(SCOPE, 'cheer'); return; }
    finish('cheer');
  };

  const backToSubjects = () => {
    if (saveLock.current) return;
    setError(null);
    setNotice(null);
    setDir('back');
    setWanted('subjects');
    setUrl('/onboarding');
  };

  // A student with no stored choice sees Commerce ticked and one key to accept it. A stored choice (editing, or coming back from
  // the days step) sees the grid as before, and so does a catalog that cannot practise all four.
  const available = subjects.filter((x) => x.practice === 'supported').map((x) => x.id);
  const presetMode = !edit && !ownPick && !savedThisVisit && savedSubjects === 0 && step === 'subjects' && catalogState === 'ready' && presetAvailable(available);
  const presetNow = presetMode && entry === 'stay';
  useEffect(() => {
    if (!presetNow || presetSeeded.current) return undefined;
    presetSeeded.current = true;
    // After the seed above has run, so a student's stored picks (none, here) are never overwritten.
    const id = window.setTimeout(() => setSelected((now) => (now.length ? now : [...PRESET_BASE])), 0);
    return () => { window.clearTimeout(id); presetSeeded.current = false; };
  }, [presetNow]);

  if (entry !== 'stay' || (catalogState === 'loading' && step === 'subjects')) {
    return <div className="app-shell onboarding-shell"><PageSpinner label={entry === 'stay' ? 'Loading your subject choices…' : 'Checking your account…'} /></div>;
  }
  if (catalogState === 'error' && step === 'subjects') {
    return <div className="app-shell onboarding-shell p-5"><ErrorState scene="unreachable" message="Subject choices did not load. Check your connection and try again." onRetry={() => setRetry((count) => count + 1)} /></div>;
  }

  const busy = saving || finishing;
  const find = (id) => subjects.find((s) => s.id === id);
  const supported = pickableSubjects(subjects, subjectQuery);
  const notYet = notYetSubjects(subjects, subjectQuery);
  const searching = subjectQuery.trim().length > 0;
  const group = courseId ? (rules?.groups || []).find((g) => g.id === courseId) || null : null;
  const needed = new Set(group ? neededByEvery(group) : []);
  const sets = !edit ? setsFor({ group, rules, available: subjects.filter((x) => x.practice === 'supported').map((x) => x.id) }) : [];
  const capShown = step === 'subjects' && capAsk && !selected.includes(capAsk) && selected.length >= SUBJECT_CAP;
  const cap = capShown ? capCopy({ wantedName: shortSubjectName(find(capAsk)), lastName: shortSubjectName(find(selected[selected.length - 1])) }) : null;
  // Saved choices MockMob cannot launch stay visible so they can be removed; never offered as new picks.
  const stale = selected.filter((id) => find(id)?.practice !== 'supported');
  const stepIndex = step === 'colleges' ? 3 : step === 'days' ? 2 : 1;
  // The Commerce four show from the first frame; the seed above puts them in `selected` a moment later.
  const presetPicks = selected.length ? selected : [...PRESET_BASE];
  const rhythm = dayRhythm(days);

  return (
    <div className="app-shell onboarding-shell ob" data-step={step} data-cap={capShown || undefined} data-preset={presetMode || undefined}>
      <header className="ob-top">
        <Logo />
        {!edit && (
          <div className="ob-progress" role="img" aria-label={`Step ${stepIndex} of 3`}>
            <span className="ob-progress__text" aria-hidden="true">Step {stepIndex} of 3</span>
            <span className="ob-progress__bar" aria-hidden="true">
              <span><i data-on="" /></span>
              <span><i data-on={stepIndex >= 2 ? '' : undefined} /></span>
              <span><i data-on={stepIndex >= 3 ? '' : undefined} /></span>
            </span>
          </div>
        )}
        <ThemeToggle />
      </header>

      <main id="main-content" className="ob-main">
        <div className="ob-head">
          <div className="ob-step" data-dir={dir} key={`head-${step}`}>
            {step !== 'subjects' && (
              <button type="button" className="ob-back" onClick={step === 'colleges' ? backToDays : backToSubjects} disabled={busy}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
                {step === 'colleges' ? 'Back to study days' : 'Back to subjects'}
              </button>
            )}
            <h1 ref={headingRef} tabIndex={-1} className="ob-title">{copy.title}</h1>
            {/* On the preset, the key comes straight after the title; the lead and the five-paper note follow the card. */}
            {presetMode ? null : <p className="ob-lead">{copy.lead}</p>}
            {step === 'subjects' && !presetMode ? <p className="ob-rule">{SUBJECT_RULE_NOTE}</p> : null}
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

              {presetMode ? (
                <section className="ob-preset" aria-labelledby="ob-preset-h">
                  <h2 id="ob-preset-h" className="ob-preset__title">{PRESET_TITLE}</h2>
                  {presetAdds(available).length > 0 ? <p className="ob-preset__lead">{PRESET_LEAD}</p> : null}
                  <ul className="ob-preset__chips" aria-label="Your subjects">
                    {presetPicks.map((id) => (
                      <li key={id} className="ob-preset__chip"><Tick on />{shortSubjectName(find(id))}</li>
                    ))}
                  </ul>
                  {presetAdds(available).length > 0 ? (
                    <div className="ob-preset__adds" role="group" aria-label="Add a paper">
                      {presetAdds(available).map((id) => (
                        <button key={id} type="button" className="ob-preset__add mk-press" disabled={busy} onClick={() => toggleSubject(id)}>
                          {presetAddLabel(shortSubjectName(find(id)), presetPicks.includes(id))}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <Button variant="volt" size="lg" className="ob-primary ob-preset__key" disabled={busy} onClick={() => saveSubjects(presetPicks)}>
                    {saving ? 'Saving subjects…' : finishing ? 'Saved' : PRESET_KEY}
                  </Button>
                  <button type="button" className="ob-quiet ob-preset__own" disabled={busy} onClick={pickOwn}>{PRESET_OWN}</button>
                </section>
              ) : null}
              {presetMode ? (
                <div className="ob-preset__after">
                  <p className="ob-lead">{copy.lead}</p>
                  <p className="ob-rule">{SUBJECT_RULE_NOTE}</p>
                </div>
              ) : null}

              {/* The DU course, optional, with the subjects it takes (the app's course search). Not in edit mode: that is only the papers. */}
              {!edit && !presetMode ? (
                <CourseFinder rules={rules} failed={rulesFailed} onRetry={() => setRulesTry((n) => n + 1)} courseId={courseId} onCourse={chooseCourse} picked={selected} disabled={busy} />
              ) : null}

              {sets.length > 0 && !searching && !presetMode ? (
                <section className="ob-sets" aria-labelledby="ob-sets-h">
                  <h2 id="ob-sets-h">{SETS_LABEL}</h2>
                  <div className="ob-sets__list">
                    {sets.map((set) => {
                      const on = setMatches(set, selected);
                      return (
                        <button key={set.id} type="button" className="ob-set mk-press" aria-pressed={on} data-on={on || undefined} disabled={busy} onClick={() => tapSet(set)}>
                          <b>{set.title}</b>
                          <span>{set.subjects.map((id) => shortSubjectName(find(id))).join(', ')}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {!presetMode ? (<>
              <label className="ob-search">
                <span className="sr-only">Search subjects</span>
                <Search size={18} aria-hidden="true" />
                <input type="search" value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} placeholder={SEARCH_HINT} autoComplete="off" spellCheck={false} enterKeyHint="search" data-du-search="" />
              </label>
              <p className="sr-only" role="status">{searching ? (supported.length + notYet.total ? subjectCountLine(supported.length + notYet.total) : noSubjectMatch(subjectQuery.trim())) : ''}</p>

              {subjects.filter((s) => s.practice === 'supported').length === 0 && (
                <p className="ob-empty" role="status">No subjects are open for practice right now. Check again in a little while.</p>
              )}
              {searching && supported.length === 0 && notYet.total === 0 ? <p className="ob-empty" role="status">{noSubjectMatch(subjectQuery.trim())}</p> : null}
              <div className="ob-grid" role="group" aria-label="Subjects" tabIndex={-1} ref={gridRef}>
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
                        {needed.has(toDuSubjectId(s.id)) && group ? <span className="ob-tile__need">Needed for {group.name}</span> : null}
                        {s.officialCode ? <span>CUET code {s.officialCode}</span> : null}
                        {Array.isArray(s.chapters) && s.chapters.length > 0 ? <span>{s.chapters.length} chapters</span> : null}
                        {tileCount(bankCount(stats, s.internalId, s.id)) ? <span>{tileCount(bankCount(stats, s.internalId, s.id))}</span> : null}
                      </span>
                      <Tick on={isSelected} />
                    </button>
                  );
                })}
              </div>

              {/* The CUET papers MockMob cannot practise yet: listed so a student knows they exist, never hidden, never pickable. */}
              {notYet.total > 0 ? (
                <section className="ob-notyet" aria-labelledby="ob-notyet-h">
                  <h2 id="ob-notyet-h">{NOT_YET_TITLE}</h2>
                  <p>{NOT_YET_NOTE}</p>
                  {[[OTHER_PAPERS, notYet.papers], [LANGUAGE_PAPERS, notYet.languages]].map(([label, list]) => (list.length ? (
                    <div key={label} className="ob-notyet__block">
                      <h3>{label}</h3>
                      <ul aria-label={`${label}, no practice here yet`}>{list.map((x) => <li key={x.id}>{x.name}</li>)}</ul>
                    </div>
                  ) : null))}
                </section>
              ) : null}
              </>) : null}
            </>
          ) : step === 'colleges' ? (
            <section className="ob-colleges" aria-label="Your target colleges">
              <CollegePicker userId={user?.id} initialCourseId={courseId} />
            </section>
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

              <div className="ob-time">
                <p className="ob-time__q" id="ob-time-q">How long each day? <span>Optional</span></p>
                <DailyMinutes value={minutes} onChange={(n) => { touchedMinutes.current = true; setMinutes(n); }} labelledBy="ob-time-q" busy={busy} idPrefix="ob-gm" />
              </div>
            </section>
          )}
        </div>
      </main>

      {presetMode && !capShown ? null : (
      <footer className="ob-bar" data-preset={presetMode || undefined}>
        <div className="ob-bar__inner">
          {capShown ? (
            <div className="ob-capnote" role="status" key={capAsk}>
              <p className="ob-capnote__title">{cap.title}</p>
              <p className="ob-capnote__body">{cap.body}</p>
              <div className="ob-capnote__keys">
                <button type="button" className="ob-capnote__swap mk-press" onClick={swapForCap} disabled={busy}>{cap.swap}</button>
                <button type="button" className="ob-quiet" onClick={() => setCapAsk(null)}>{cap.keep}</button>
              </div>
            </div>
          ) : null}
          {presetMode ? null : step === 'subjects' ? (
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
              </span>
            </div>
          ) : step === 'colleges' ? (
            <div className="ob-bar__status">
              <span className="ob-bar__text">
                <b>Optional</b>
                <span className="ob-bar__sub">Each college saves as you choose it</span>
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
          {presetMode ? null : (
          <div className="ob-bar__actions">
            {step === 'days' && (
              <button type="button" className="ob-quiet" onClick={skipDays} disabled={busy}>Skip for now</button>
            )}
            {step === 'colleges' ? (
              <Button variant="volt" size="lg" className="ob-primary" disabled={busy} onClick={finishColleges}>
                {finishing ? 'Saved' : 'Finish'}
              </Button>
            ) : step === 'subjects' ? (
              <Button variant="volt" size="lg" className="ob-primary" disabled={selected.length === 0 || busy} onClick={saveSubjects}>
                {saving ? 'Saving subjects…' : finishing ? 'Saved' : edit ? 'Save subjects' : 'Next'}
              </Button>
            ) : (
              <Button variant="volt" size="lg" className="ob-primary" disabled={busy} onClick={saveDays}>
                {saving ? 'Saving…' : finishing ? 'Saved' : 'Save and continue'}
              </Button>
            )}
          </div>
          )}
        </div>
      </footer>
      )}
    </div>
  );
}
