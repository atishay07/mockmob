"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { api as fetchApi, apiGet, apiPost } from '@/lib/fetcher';
import StudyLibrary from './StudyLibrary';
import LessonOverview from './LessonOverview';
import StudyRun from './StudyRun';
import { SUBJECTS, friendlyError } from './studyCopy';
import { Listbox } from '@/components/ui/controls/Listbox';
import { SegmentedControl } from '@/components/ui/controls/SegmentedControl';
import { SmoothDetails } from '@/components/ui/controls/SmoothDetails';
import './study.css';

// Routes: /learn (Concepts, the library), /learn/[id] (lesson overview), /study/[id] (a saved lesson or recall session).
// A lesson opened from a moment carries ?from= (q:{attempt}:{n}, chapter:{subject}:{chapter}, today): the overview says why the student is there.
export default function StudyWorkspace({ unitId = null, runId = null, preview = null, autoRecall = false, subject = null }) {
  const router = useRouter();
  const urlFrom = useSearchParams()?.get('from') || null;
  const transport = preview?.transport;
  const api = useMemo(() => ({
    get: path => transport ? transport('GET', path) : apiGet(path),
    post: (path, input) => transport ? transport('POST', path, input) : apiPost(path, input),
    put: (path, input) => transport ? transport('PUT', path, input) : fetchApi(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  }), [transport]);
  // Preview keeps navigation in memory; the real app uses URLs so reload and back always work.
  const [view, setView] = useState({ runId, unitId, from: unitId ? urlFrom : null });
  const [loaded, setLoaded] = useState(null), [startError, setStartError] = useState(null), [attempt, setAttempt] = useState(0);
  const autoStarted = useRef(false);
  const current = transport ? view : { runId, unitId, from: urlFrom };
  const viewKey = current.runId ? `run:${current.runId}` : current.unitId ? `unit:${current.unitId}` : 'library';
  const loadKey = `${viewKey}#${attempt}`;
  const path = current.runId ? `/api/study/runs/${encodeURIComponent(current.runId)}` : current.unitId ? `/api/study/units/${encodeURIComponent(current.unitId)}` : '/api/study/catalog';
  // Results are bound to the view they were loaded for, so a view change never renders stale data.
  const data = loaded?.key === loadKey ? loaded.value : null;
  const error = startError || (loaded?.key === loadKey ? loaded.error : null);
  const setError = setStartError;
  useEffect(() => {
    let alive = true;
    api.get(path).then(value => { if (alive) setLoaded({ key: loadKey, value }); }).catch(e => { if (alive) setLoaded({ key: loadKey, error: friendlyError(e) }); });
    return () => { alive = false; };
  }, [api, path, loadKey]);
  const openRun = run => { if (transport) { setLoaded({ key: `run:${run.id}#${attempt}`, value: run }); setView({ runId: run.id }); } else router.push(`/study/${run.id}`); };
  const openUnit = transport ? (id, from = null) => setView({ unitId: id, from }) : null;
  const back = transport ? () => setView({}) : null;

  // Today's "Review due cards" link lands here with ?recall=due and starts the review directly.
  useEffect(() => {
    if (!autoRecall || autoStarted.current || current.runId || current.unitId || !data?.queue?.availableCount || !data.recallEnabled) return;
    autoStarted.current = true;
    api.post('/api/study/runs', { mode: 'recall', requestKey: crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '') }).then(openRun).catch(e => setError(friendlyError(e)));
  }, [autoRecall, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // The library says what did not load, and that the student's own record is safe (LEARN-REVIEW-1017 5.14); a lesson or a run keeps its own wording.
  const libraryFailed = !current.runId && !current.unitId;
  if (error) return <div className={libraryFailed ? 'sx sx-library cx' : 'sx'}>{libraryFailed ? <header className="cx-head"><h1>Learn</h1><p className="cx-lede">Short lessons on the ideas behind your mistakes.</p></header> : null}<div className="sx-alert cx-fail" role="alert">{libraryFailed ? <p><b>Concepts did not load.</b> {/could not be saved/.test(error.text) ? 'Your saved lessons and progress are safe.' : error.text}</p> : <p>{error.text}</p>}<div className="sx-actions">
    <button type="button" className="sx-secondary" onClick={() => { setStartError(null); setAttempt(n => n + 1); }}>Try again</button>
    {error.signIn ? <Link className="sx-secondary" href="/login">Sign in</Link> : null}
    {libraryFailed ? null : <Link className="sx-quiet" href="/learn" onClick={back ? e => { e.preventDefault(); back(); } : undefined}>Back to Concepts</Link>}<Link className="sx-quiet" href="/dashboard">Practise questions</Link></div></div></div>;
  if (!data && libraryFailed) return <div className="sx sx-library cx cx-loading" role="status" aria-label="Loading Learn">
    <header className="cx-head"><h1>Learn</h1><p className="cx-lede">Short lessons on the ideas behind your mistakes.</p></header>
    <div className="cx-board"><div className="cx-main"><section className="cx-next cx-next--wait" aria-hidden="true"><i /><i /><i /></section><div className="cx-skel" aria-hidden="true"><i /><i /><i /><i /></div></div></div></div>;
  if (!data) return <div className="sx" role="status" aria-label="Loading"><div className="sx-skeleton"><i /><i /><i /></div></div>;
  if (current.runId) return <StudyRun key={data.id} run={data} api={api} onOpenRun={openRun} onExit={back} />;
  if (current.unitId) return <LessonOverview unit={data} api={api} onOpenRun={openRun} onBack={back} from={current.from} />;
  if (data.state === 'disabled') return <div className="sx"><h1>Learn</h1><p className="sx-lede">Lessons are switched off right now. Your saved progress is kept. You can still practise questions and take mocks.</p><Link className="btn-volt md" href="/dashboard">Practise questions</Link></div>;
  return <StudyLibrary catalog={data} api={api} onOpenRun={openRun} onOpenUnit={openUnit} initialSubject={subject}
    prefsSlot={data.preferences ? <StudyPreferences prefs={data.preferences} units={data.units} api={api} onOpenRun={openRun} /> : null} />;
}

const STUDY_MINUTES = [10, 20, 30].map((n) => ({ value: n, label: `${n} minutes` }));
const WEEK_MINUTES = [10, 20, 30].map((n) => ({ value: n, label: `${n} min` }));
const WEEK_SUBJECTS = SUBJECTS.map(([id, title]) => ({ value: id, label: title }));

function StudyPreferences({ prefs: initial, units, api, onOpenRun }) {
  const [prefs, setPrefs] = useState(initial);
  const [subjects, setSubjects] = useState(initial.subjects), [minutes, setMinutes] = useState(initial.minutes), [saving, setSaving] = useState(false), [message, setMessage] = useState(null);
  const [weekly, setWeekly] = useState(initial.weeklyPlan || Array.from({ length: 7 }, (_, i) => ({ subject: initial.subjects[i % initial.subjects.length], minutes: initial.minutes })));
  const reviewableUnits=units.filter(u=>u.read || u.memory?.reviewed);
  const [mixedUnits, setMixedUnits] = useState(reviewableUnits.slice(0,20).map(u => u.id));
  const save = async (plan = false) => {
    setSaving(true); setMessage(null);
    try { const next = await api.put('/api/study/preferences', { subjects, minutes, expectedRevision: prefs.revision, ...(plan ? { weeklyPlan: weekly } : {}) }); setPrefs(next); setMessage({ ok: true, text: 'Saved. Today will plan around these choices.' }); }
    catch (e) { setMessage({ ok: false, text: friendlyError(e).text }); } finally { setSaving(false); }
  };
  const mixed = async () => {
    setSaving(true); setMessage(null);
    try { onOpenRun(await api.post('/api/study/runs', { mode: 'recall', mixed: true, unitIds: mixedUnits, requestKey: crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '') })); }
    catch (e) { setMessage({ ok: false, text: friendlyError(e).text }); } finally { setSaving(false); }
  };
  return <SmoothDetails className="sx-prefs" chevron summary={<span className="sx-prefs__title">Study preferences{prefs.premium ? ' and weekly plan' : ''}</span>}>
    <fieldset><legend>Subjects to plan for</legend>{SUBJECTS.map(([id, title]) => <label className="sx-check" key={id}><input type="checkbox" checked={subjects.includes(id)} onChange={e => setSubjects(e.target.checked ? [...subjects, id] : subjects.filter(s => s !== id))} /><span className="sx-check__mark" aria-hidden="true"><Check size={16} /></span><span>{title}</span></label>)}</fieldset>
    <div className="sx-field"><span id="sx-usual-time">Usual study time</span><SegmentedControl labelledBy="sx-usual-time" value={minutes} onChange={setMinutes} options={STUDY_MINUTES} /></div>
    <div className="sx-actions"><button className="sx-secondary" type="button" disabled={saving || !subjects.length} onClick={() => save()}>Save preferences</button></div>
    <h3 className="sx-h3">Weekly plan and mixed revision</h3>
    {prefs.premium ? <>
      <div className="sx-week">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => <div key={day}><span>{day}</span>
        <Listbox aria-label={`${day} subject`} sheetTitle={`${day} subject`} size="sm" value={weekly[i].subject} options={WEEK_SUBJECTS} onChange={(value) => setWeekly(weekly.map((d, j) => j === i ? { ...d, subject: value } : d))} />
        <Listbox aria-label={`${day} minutes`} sheetTitle={`${day} minutes`} size="sm" value={weekly[i].minutes} options={WEEK_MINUTES} onChange={(value) => setWeekly(weekly.map((d, j) => j === i ? { ...d, minutes: value } : d))} /></div>)}</div>
      <div className="sx-actions"><button type="button" className="sx-secondary" disabled={saving || !subjects.length} onClick={() => save(true)}>Save weekly plan</button></div>
      <p className="sx-small">Review concepts you have already learned. New cards appear after you finish their lesson.</p>
      {!reviewableUnits.length ? <p className="sx-small">Finish a lesson first, then choose it here for mixed revision.</p> : null}
      <fieldset><legend>Concepts to mix in one revision session, up to 20</legend>{reviewableUnits.map(u => <label className="sx-check" key={u.id}><input type="checkbox" checked={mixedUnits.includes(u.id)} disabled={!mixedUnits.includes(u.id) && mixedUnits.length>=20} onChange={e => setMixedUnits(e.target.checked ? [...mixedUnits, u.id] : mixedUnits.filter(id => id !== u.id))} /><span className="sx-check__mark" aria-hidden="true"><Check size={16} /></span><span>{u.title}</span></label>)}</fieldset>
      <div className="sx-actions"><button type="button" className="sx-secondary" disabled={saving || !mixedUnits.length} onClick={mixed}>Start mixed revision</button></div>
    </> : <p className="sx-small">A saved day-by-day plan and custom mixed revision come with Pro. Lessons, reviews and Today’s plan are free. <Link className="sx-link" href="/pricing">See plans</Link></p>}
    {message ? <p className={message.ok ? 'sx-small' : 'sx-alert'} role={message.ok ? 'status' : 'alert'}>{message.text}</p> : null}
  </SmoothDetails>;
}
