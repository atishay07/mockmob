"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpenText, Brain, Target } from 'lucide-react';
import { SubjectIcon } from '@/components/ui/Glyph';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { useInView } from '@/lib/motion';
import { SUBJECTS, STATUS, friendlyError, practiceHref, subjectName, whenDue } from './studyCopy';

const newKey = () => crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '');

// What a lesson row's ring shows, from the real status: New (empty ring), In progress (an arc of the
// steps already done), Read (a full arc, recall still to do), Review due (a badge), Done (a tick).
function ringShape(u) {
  if (u.status === 'in_progress' && u.inProgress?.total) return { k: 'arc', f: Math.max(0, Math.min(1, (u.inProgress.step - 1) / u.inProgress.total)) };
  if (u.status === 'lock_in') return { k: 'read', f: 1 };
  if (u.status === 'due') return { k: 'due', f: 1, n: u.memory?.due || 0 };
  if (u.status === 'learned') return { k: 'done', f: 1 };
  return { k: 'new', f: 0 };
}

// The ring remembers what it showed last time in this browser, so it only plays its move when
// the lesson really changed since (after a run), and stays still otherwise.
const RING_KEY = 'mm:unit-ring:v1';
function readRing(id) {
  try { const map = JSON.parse(window.localStorage.getItem(RING_KEY) || '{}'); return map[id] || null; } catch { return null; }
}
function writeRing(id, shape) {
  try {
    const map = JSON.parse(window.localStorage.getItem(RING_KEY) || '{}');
    map[id] = { k: shape.k, f: shape.f };
    window.localStorage.setItem(RING_KEY, JSON.stringify(map));
  } catch { /* Without storage the ring just does not animate. */ }
}

function UnitRing({ unit }) {
  const shape = ringShape(unit);
  const [prev] = useState(() => (typeof window === 'undefined' ? null : readRing(unit.id)));
  const [ref, seen] = useInView({ threshold: 0.6 });
  const changed = Boolean(prev) && (prev.k !== shape.k || Math.abs((prev.f || 0) - shape.f) > 0.001);
  useEffect(() => { if (seen) writeRing(unit.id, shape); }, [seen, unit.id, shape.k, shape.f]); // eslint-disable-line react-hooks/exhaustive-deps
  const from = changed ? (prev.k === 'new' ? 0 : prev.f || 0) : shape.f;
  return <span ref={ref} className="sx-ring" data-k={shape.k} data-changed={changed && seen ? 'true' : undefined} role={shape.k === 'new' ? 'img' : undefined} aria-label={shape.k === 'new' ? 'Not started' : undefined} aria-hidden={shape.k === 'new' ? undefined : true}>
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
      <circle className="sx-ring__track" cx="18" cy="18" r="14" />
      {shape.k !== 'new' && shape.k !== 'done' ? <circle className="sx-ring__arc" cx="18" cy="18" r="14" pathLength="1" transform="rotate(-90 18 18)" style={{ '--to': shape.f, '--from': from }} /> : null}
      {shape.k === 'done' ? <><circle className="sx-ring__arc" cx="18" cy="18" r="14" pathLength="1" transform="rotate(-90 18 18)" style={{ '--to': 1, '--from': changed ? 0 : 1 }} /><path className="sx-ring__tick" d="M11.5 18.5l4.4 4.4 8.6-9.4" pathLength="1" /></> : null}
    </svg>
    {shape.k === 'due' && shape.n ? <i className="sx-ring__badge">{shape.n > 9 ? '9+' : shape.n}</i> : null}
  </span>;
}

// A small stack of recall cards beside the review call to action. It breathes while it waits and
// the top card slides off when the review starts.
function CardStack({ count, leaving }) {
  const depth = Math.max(1, Math.min(3, count || 1));
  return <span className="sx-stack" data-leaving={leaving ? 'true' : undefined} aria-hidden="true">
    {Array.from({ length: depth }, (_, i) => <i key={i} style={{ '--d': i }} />).reverse()}
  </span>;
}

export default function StudyLibrary({ catalog, api, onOpenRun, onOpenUnit, initialSubject, prefsSlot }) {
  const firstSubject = SUBJECTS.some(s => s[0] === initialSubject) ? initialSubject : (catalog.nextUnit?.subject || catalog.preferences?.subjects?.[0] || 'english');
  const [subject, setSubject] = useState(firstSubject), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const [reviewKey, setReviewKey] = useState(newKey), [leaving, setLeaving] = useState(false);
  // Find a chapter or a lesson in the chosen subject (LEARN-REVIEW-1017 5.9): one field, matched on chapter and lesson titles.
  const [query, setQuery] = useState('');
  const q = catalog.queue;
  const startReview = async () => {
    setBusy(true); setError(null); setLeaving(true);
    try { onOpenRun(await api.post('/api/study/runs', { mode: 'recall', requestKey: reviewKey })); }
    catch (e) { setReviewKey(newKey()); setError(friendlyError(e)); setLeaving(false); } finally { setBusy(false); }
  };
  const open = (e, id) => { if (onOpenUnit) { e.preventDefault(); onOpenUnit(id); } };
  const bySubject = useMemo(() => Object.fromEntries(SUBJECTS.map(([id]) => [id, catalog.units.filter(u => u.subject === id)])), [catalog.units]);

  // One clear next action: unfinished work, then due reviews, then the recommended lesson.
  const active = catalog.active;
  const next = catalog.nextUnit && catalog.units.find(u => u.id === catalog.nextUnit.id);
  const hero = active ? { title: active.mode === 'learn' ? `Finish “${active.title}”` : 'Finish your review', text: `You stopped at ${active.mode === 'learn' ? 'step' : 'card'} ${active.step} of ${active.total}. Everything before it is saved.`, cta: 'Continue', href: `/study/${active.id}`, icon: BookOpenText }
    : q.dueCount ? { title: `${q.dueCount} recall ${q.dueCount === 1 ? 'card is' : 'cards are'} due`, text: `About ${Math.max(2, Math.ceil(Math.min(q.dueCount, 10) * 0.5))} minutes, free. Recalling on time is what keeps a lesson from fading before the exam.`, cta: 'Start recall', action: startReview, icon: Brain }
    : next ? { title: catalog.progress.lessonsRead ? `Next lesson: ${next.title}` : `Start here: ${next.title}`, text: `${catalog.nextUnit.reason}, ${next.estimatedMinutes} min`, cta: 'Open lesson', href: `/learn/${next.id}`, unitId: next.id, icon: BookOpenText }
    : q.availableCount ? { title: `Lock in ${q.newCount} new ${q.newCount === 1 ? 'card' : 'cards'}`, text: 'From lessons you have already read.', cta: 'Start', action: startReview, icon: Brain }
    : { title: 'You’re up to date', text: 'Every published lesson is read and nothing is due. Practise a chapter or take a mock to find what to study next.', cta: 'Practise questions', href: '/dashboard', icon: Target };

  const units = bySubject[subject] || [];
  const syllabus = catalog.subjects.find(s => s.subject === subject);
  const taughtAll = syllabus?.chapters.filter(c => units.some(u => u.chapter === c.title)) || [];
  const untaughtAll = syllabus?.chapters.filter(c => !units.some(u => u.chapter === c.title)) || [];
  const needle = query.trim().toLowerCase();
  const hit = (text) => String(text || '').toLowerCase().includes(needle);
  const taught = needle ? taughtAll.filter(c => hit(c.title) || units.some(u => u.chapter === c.title && (hit(u.title) || hit(u.summary)))) : taughtAll;
  const untaught = needle ? untaughtAll.filter(c => hit(c.title)) : untaughtAll;
  const unitsIn = (chapter) => units.filter(u => u.chapter === chapter.title && (!needle || hit(chapter.title) || hit(u.title) || hit(u.summary)));
  return <div className="sx sx-library">
    <header className="sx-library__head">
      <h1>Concepts</h1>
      <p className="sx-lede">Short lessons on the ideas behind your mistakes, about 7 minutes each, then a 2-minute recall from memory.</p>
    </header>
    <section className="sx-hero" aria-labelledby="sx-hero-title">
      {hero.action ? <CardStack count={q.dueCount || q.newCount} leaving={leaving} /> : <hero.icon size={22} aria-hidden="true" className="sx-hero__icon" />}
      <div className="sx-hero__body"><h2 id="sx-hero-title">{hero.title}</h2><p>{hero.text}</p></div>
      {/* The page's one volt key (data-page-primary): the sidebar's Start key steps back to its outline while Learn is open,
          as on Practice, Today and a result, so two lime keys never stand side by side (W-040). */}
      {hero.action ? <button className="btn-volt md" type="button" data-page-primary="" onClick={hero.action} disabled={busy || !catalog.recallEnabled}>{hero.cta}</button>
        : <Link className="btn-volt md" data-page-primary="" href={hero.href} onClick={hero.unitId ? e => open(e, hero.unitId) : undefined}>{hero.cta}</Link>}
    </section>
    {/* The three steps, folded: it explains the system, so it is there for whoever asks, not in the way of the next step. */}
    <details className="sx-how"><summary>How a lesson works</summary>
      <p className="sx-flow">Each concept takes three steps. <b>Learn</b> it in 5 to 7 minutes with worked examples and quick checks. <b>Lock it in</b> from memory in 2 to 3 minutes; the recall is scheduled for you. <b>Apply</b> it on practice questions with marks, then in mocks.</p>
    </details>

    {active && q.dueCount ? <p className="sx-small">Also: {q.dueCount} recall {q.dueCount === 1 ? 'card is' : 'cards are'} due. <button type="button" className="sx-link" onClick={startReview} disabled={busy}>Recall them</button></p> : null}
    {error ? <div className="sx-alert" role="alert"><p>{error.text}</p></div> : null}

    <div className="sx-tabs" role="tablist" aria-label="Subject">{SUBJECTS.map(([id, title]) => <button key={id} role="tab" id={`sx-tab-${id}`} aria-controls="sx-subject-panel" aria-selected={id === subject} tabIndex={id === subject ? 0 : -1} type="button" onClick={() => setSubject(id)}
      onKeyDown={e => { const i = SUBJECTS.findIndex(s => s[0] === id); const to = e.key === 'ArrowRight' ? (i + 1) % 4 : e.key === 'ArrowLeft' ? (i + 3) % 4 : null; if (to !== null) { e.preventDefault(); setSubject(SUBJECTS[to][0]); document.getElementById(`sx-tab-${SUBJECTS[to][0]}`)?.focus(); } }}>
      <SubjectIcon id={id} size={18} /><span>{title}</span><small>{bySubject[id].length}</small></button>)}</div>

    <label className="sx-search">
      <span className="sr-only">Find a chapter or lesson in {subjectName(subject)}</span>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Find a chapter or lesson in ${subjectName(subject)}`} autoComplete="off" enterKeyHint="search" />
    </label>
    <section id="sx-subject-panel" role="tabpanel" aria-labelledby={`sx-tab-${subject}`} className="sx-subject">
      <div className="sx-subject__head">
        <span key={subject} className="sx-subject__obj mk-pop" aria-hidden="true"><SubjectObject id={subject} size={112} framed={false} lit /></span>
        <p className="sx-small">{units.length ? `${units.length} ${units.length === 1 ? 'lesson' : 'lessons'} across ${taught.length} of ${syllabus?.chapters.length || 0} chapters in ${subjectName(subject)}. More are added as each one passes its source checks.` : `${subjectName(subject)} lessons are still being prepared. Practice questions are available now.`}</p>
      </div>
      {needle && !taught.length && !untaught.length ? <p className="sx-small sx-nomatch" role="status">No chapter or lesson in {subjectName(subject)} matches &ldquo;{query.trim()}&rdquo;. <button type="button" className="sx-link" onClick={() => setQuery('')}>Show every chapter</button></p> : null}
      {taught.map(chapter => <div key={chapter.id} className="sx-chapter">
        <div className="sx-chapter__head"><h2>{chapter.title}</h2><Link className="sx-link" href={practiceHref(subject, chapter.title)}>Practise</Link></div>
        <Link className="sx-link sx-small" href={`/learn/summary?${new URLSearchParams({subject,chapter:chapter.title})}`}>Read or print the chapter summary</Link>
        <ul className="sx-units">{unitsIn(chapter).map(u => <li key={u.id}>
          <Link href={`/learn/${u.id}`} onClick={e => open(e, u.id)} className="sx-unit">
            <UnitRing unit={u} />
            <span className="sx-unit__main"><b>{u.title}</b><span className="sx-unit__summary">{String(u.summary || '').replaceAll(' · ', ', ')}</span>
              <span className="sx-unit__meta">{u.estimatedMinutes} min{u.skill ? `, ${u.skill}` : ''}, {u.cardCount} recall {u.cardCount === 1 ? 'card' : 'cards'}</span></span>
            {u.status !== 'new' ? <span className="sx-unit__status" data-status={u.status}>{u.status === 'in_progress' ? `Step ${u.inProgress.step}/${u.inProgress.total}` : u.status === 'due' ? `${u.memory.due} due` : u.status === 'learned' && u.memory.nextDue ? `Review ${whenDue(u.memory.nextDue)}` : STATUS[u.status]?.label}</span> : null}
          </Link></li>)}</ul>
      </div>)}
      {untaught.length ? <details className="sx-untaught" open={needle ? true : undefined}><summary>{untaught.length} more {untaught.length === 1 ? 'chapter' : 'chapters'}, practice available, lessons later</summary>
        <ul>{untaught.map(c => <li key={c.id}><span>{c.title}</span><Link className="sx-link" href={practiceHref(subject, c.title)}>Practise</Link></li>)}</ul>
        <p className="sx-small">Chapter list from the CUET UG 2026 syllabus; the 2027 syllabus is provisional until NTA publishes it.</p></details> : null}
    </section>

    <section className="sx-record" aria-label="Your study record">
      <p><b>{catalog.progress.lessonsRead}</b> of {catalog.progress.lessonsAvailable} lessons read</p>
      <p><b>{catalog.progress.cardsStarted}</b> cards in recall</p>
      <p><b>{catalog.progress.recallReviews}</b> recall answers</p>
      <Link className="sx-link" href="/progress">See your marks in Progress</Link>
    </section>
    <Link className="sx-mock" href="/dashboard?mode=full"><span><b>Test it in a full mock</b><small>A full mock shows which chapters are costing you marks. Access and cost are shown before it starts.</small></span></Link>
    {prefsSlot}
  </div>;
}
