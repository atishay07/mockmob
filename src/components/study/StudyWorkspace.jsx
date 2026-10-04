"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { api as fetchApi, apiGet, apiPost } from '@/lib/fetcher';
import StudyLibrary from './StudyLibrary';
import LessonOverview from './LessonOverview';
import StudyRun from './StudyRun';
import { SUBJECTS, friendlyError } from './studyCopy';
import './study.css';

// Routes: /learn (library), /learn/[id] (lesson overview), /study/[id] (a saved lesson or review session).
export default function StudyWorkspace({ unitId = null, runId = null, preview = null, autoRecall = false, subject = null }) {
  const router = useRouter();
  const transport = preview?.transport;
  const api = useMemo(() => ({
    get: path => transport ? transport('GET', path) : apiGet(path),
    post: (path, input) => transport ? transport('POST', path, input) : apiPost(path, input),
    put: (path, input) => transport ? transport('PUT', path, input) : fetchApi(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  }), [transport]);
  // Preview keeps navigation in memory; the real app uses URLs so reload and back always work.
  const [view, setView] = useState({ runId, unitId });
  const [loaded, setLoaded] = useState(null), [startError, setStartError] = useState(null), [attempt, setAttempt] = useState(0);
  const autoStarted = useRef(false);
  const current = transport ? view : { runId, unitId };
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
  const openUnit = transport ? id => setView({ unitId: id }) : null;
  const back = transport ? () => setView({}) : null;

  // Today's "Review due cards" link lands here with ?recall=due and starts the review directly.
  useEffect(() => {
    if (!autoRecall || autoStarted.current || current.runId || current.unitId || !data?.queue?.availableCount || !data.recallEnabled) return;
    autoStarted.current = true;
    api.post('/api/study/runs', { mode: 'recall', requestKey: crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '') }).then(openRun).catch(e => setError(friendlyError(e)));
  }, [autoRecall, data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="sx"><div className="sx-alert" role="alert"><p>{error.text}</p><div className="sx-actions">
    <button type="button" className="sx-secondary" onClick={() => { setStartError(null); setAttempt(n => n + 1); }}>Try again</button>
    {error.signIn ? <Link className="sx-secondary" href="/login">Sign in</Link> : null}
    <Link className="sx-quiet" href="/learn" onClick={back ? e => { e.preventDefault(); back(); } : undefined}>Back to Learn</Link><Link className="sx-quiet" href="/dashboard">Practise questions</Link></div></div></div>;
  if (!data) return <div className="sx" role="status" aria-label="Loading"><div className="sx-skeleton"><i /><i /><i /></div></div>;
  if (current.runId) return <StudyRun key={data.id} run={data} api={api} onOpenRun={openRun} onExit={back} />;
  if (current.unitId) return <LessonOverview unit={data} api={api} onOpenRun={openRun} onBack={back} />;
  if (data.state === 'disabled') return <div className="sx"><h1>Learn</h1><p className="sx-lede">Lessons are switched off right now. Your saved progress is kept. You can still practise questions and take mocks.</p><Link className="btn-volt md" href="/dashboard">Practise questions</Link></div>;
  return <StudyLibrary catalog={data} api={api} onOpenRun={openRun} onOpenUnit={openUnit} initialSubject={subject}
    prefsSlot={data.preferences ? <StudyPreferences prefs={data.preferences} units={data.units} api={api} onOpenRun={openRun} /> : null} />;
}

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
  return <details className="sx-prefs"><summary>Study preferences{prefs.premium ? ' and weekly plan' : ''}</summary>
    <fieldset><legend>Subjects to plan for</legend>{SUBJECTS.map(([id, title]) => <label className="sx-check" key={id}><input type="checkbox" checked={subjects.includes(id)} onChange={e => setSubjects(e.target.checked ? [...subjects, id] : subjects.filter(s => s !== id))} /><span className="sx-check__mark" aria-hidden="true"><Check size={16} /></span><span>{title}</span></label>)}</fieldset>
    <label className="sx-field"><span>Usual study time</span><select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[10, 20, 30].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
    <div className="sx-actions"><button className="sx-secondary" type="button" disabled={saving || !subjects.length} onClick={() => save()}>Save preferences</button></div>
    <h3 className="sx-h3">Weekly plan and mixed revision</h3>
    {prefs.premium ? <>
      <div className="sx-week">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => <div key={day}><span>{day}</span>
        <label><span className="sr-only">{day} subject</span><select value={weekly[i].subject} onChange={e => setWeekly(weekly.map((d, j) => j === i ? { ...d, subject: e.target.value } : d))}>{SUBJECTS.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label><span className="sr-only">{day} minutes</span><select value={weekly[i].minutes} onChange={e => setWeekly(weekly.map((d, j) => j === i ? { ...d, minutes: Number(e.target.value) } : d))}>{[10, 20, 30].map(n => <option key={n} value={n}>{n} min</option>)}</select></label></div>)}</div>
      <div className="sx-actions"><button type="button" className="sx-secondary" disabled={saving || !subjects.length} onClick={() => save(true)}>Save weekly plan</button></div>
      <p className="sx-small">Review concepts you have already learned. New cards appear after you finish their lesson.</p>
      {!reviewableUnits.length ? <p className="sx-small">Finish a lesson first, then choose it here for mixed revision.</p> : null}
      <fieldset><legend>Concepts to mix in one revision session · up to 20</legend>{reviewableUnits.map(u => <label className="sx-check" key={u.id}><input type="checkbox" checked={mixedUnits.includes(u.id)} disabled={!mixedUnits.includes(u.id) && mixedUnits.length>=20} onChange={e => setMixedUnits(e.target.checked ? [...mixedUnits, u.id] : mixedUnits.filter(id => id !== u.id))} /><span className="sx-check__mark" aria-hidden="true"><Check size={16} /></span><span>{u.title}</span></label>)}</fieldset>
      <div className="sx-actions"><button type="button" className="sx-secondary" disabled={saving || !mixedUnits.length} onClick={mixed}>Start mixed revision</button></div>
    </> : <p className="sx-small">A saved day-by-day plan and custom mixed revision come with Pro. Lessons, reviews and Today’s plan are free. <Link className="sx-link" href="/pricing">See plans</Link></p>}
    {message ? <p className={message.ok ? 'sx-small' : 'sx-alert'} role={message.ok ? 'status' : 'alert'}>{message.text}</p> : null}
  </details>;
}
