"use client";
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpenText, Brain, Target, Timer, ChevronRight } from 'lucide-react';
import { SubjectIcon } from '@/components/ui/Glyph';
import { SUBJECTS, STATUS, friendlyError, practiceHref, subjectName, whenDue } from './studyCopy';

const newKey = () => crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '');

export default function StudyLibrary({ catalog, api, onOpenRun, onOpenUnit, initialSubject, prefsSlot }) {
  const firstSubject = SUBJECTS.some(s => s[0] === initialSubject) ? initialSubject : (catalog.nextUnit?.subject || catalog.preferences?.subjects?.[0] || 'english');
  const [subject, setSubject] = useState(firstSubject), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const [reviewKey, setReviewKey] = useState(newKey);
  const q = catalog.queue;
  const startReview = async () => {
    setBusy(true); setError(null);
    try { onOpenRun(await api.post('/api/study/runs', { mode: 'recall', requestKey: reviewKey })); }
    catch (e) { setReviewKey(newKey()); setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const open = (e, id) => { if (onOpenUnit) { e.preventDefault(); onOpenUnit(id); } };
  const bySubject = useMemo(() => Object.fromEntries(SUBJECTS.map(([id]) => [id, catalog.units.filter(u => u.subject === id)])), [catalog.units]);

  // One clear next action: unfinished work, then due reviews, then the recommended lesson.
  const active = catalog.active;
  const next = catalog.nextUnit && catalog.units.find(u => u.id === catalog.nextUnit.id);
  const hero = active ? { title: active.mode === 'learn' ? `Finish “${active.title}”` : 'Finish your review', text: `You stopped at ${active.mode === 'learn' ? 'step' : 'card'} ${active.step} of ${active.total}. Everything before it is saved.`, cta: 'Continue', href: `/study/${active.id}`, icon: BookOpenText }
    : q.dueCount ? { title: `${q.dueCount} ${q.dueCount === 1 ? 'card is' : 'cards are'} due for review`, text: `About ${Math.max(2, Math.ceil(Math.min(q.dueCount, 10) * 0.5))} minutes. Reviewing on time is what keeps lessons from fading before the exam.`, cta: 'Start review', action: startReview, icon: Brain }
    : next ? { title: catalog.progress.lessonsRead ? `Next lesson: ${next.title}` : `Start here: ${next.title}`, text: `${catalog.nextUnit.reason} · ${next.estimatedMinutes} min`, cta: 'Open lesson', href: `/learn/${next.id}`, unitId: next.id, icon: BookOpenText }
    : q.availableCount ? { title: `Lock in ${q.newCount} new ${q.newCount === 1 ? 'card' : 'cards'}`, text: 'From lessons you have already read.', cta: 'Start', action: startReview, icon: Brain }
    : { title: 'You’re up to date', text: 'Every published lesson is read and nothing is due. Practise a chapter or take a mock to find what to study next.', cta: 'Practise questions', href: '/dashboard', icon: Target };

  const units = bySubject[subject] || [];
  const syllabus = catalog.subjects.find(s => s.subject === subject);
  const taught = syllabus?.chapters.filter(c => units.some(u => u.chapter === c.title)) || [];
  const untaught = syllabus?.chapters.filter(c => !units.some(u => u.chapter === c.title)) || [];
  return <div className="sx sx-library">
    <header className="sx-library__head">
      <h1>Learn</h1>
      <p className="sx-lede">Short lessons on CUET chapters. Learn one concept, lock it in from memory, then prove it on exam-style questions.</p>
    </header>
    <section className="sx-hero" aria-labelledby="sx-hero-title">
      <hero.icon size={22} aria-hidden="true" className="sx-hero__icon" />
      <div className="sx-hero__body"><h2 id="sx-hero-title">{hero.title}</h2><p>{hero.text}</p></div>
      {hero.action ? <button className="btn-volt md" type="button" onClick={hero.action} disabled={busy || !catalog.recallEnabled}>{hero.cta}<ArrowRight size={16} aria-hidden="true" /></button>
        : <Link className="btn-volt md" href={hero.href} onClick={hero.unitId ? e => open(e, hero.unitId) : undefined}>{hero.cta}<ArrowRight size={16} aria-hidden="true" /></Link>}
    </section>
    <ol className="sx-flow" aria-label="How each concept works">
      <li><BookOpenText size={18} aria-hidden="true" /><div><b>Learn</b><small>5–7 min · worked examples and quick checks</small></div></li>
      <li><Brain size={18} aria-hidden="true" /><div><b>Lock it in</b><small>2–3 min · answer from memory; reviews are scheduled for you</small></div></li>
      <li><Target size={18} aria-hidden="true" /><div><b>Apply</b><small>Practice questions with marks, then mocks</small></div></li>
    </ol>

    {active && q.dueCount ? <p className="sx-small">Also: {q.dueCount} {q.dueCount === 1 ? 'card is' : 'cards are'} due. <button type="button" className="sx-link" onClick={startReview} disabled={busy}>Review them</button></p> : null}
    {error ? <div className="sx-alert" role="alert"><p>{error.text}</p></div> : null}

    <div className="sx-tabs" role="tablist" aria-label="Subject">{SUBJECTS.map(([id, title]) => <button key={id} role="tab" id={`sx-tab-${id}`} aria-controls="sx-subject-panel" aria-selected={id === subject} tabIndex={id === subject ? 0 : -1} type="button" onClick={() => setSubject(id)}
      onKeyDown={e => { const i = SUBJECTS.findIndex(s => s[0] === id); const to = e.key === 'ArrowRight' ? (i + 1) % 4 : e.key === 'ArrowLeft' ? (i + 3) % 4 : null; if (to !== null) { e.preventDefault(); setSubject(SUBJECTS[to][0]); document.getElementById(`sx-tab-${SUBJECTS[to][0]}`)?.focus(); } }}>
      <SubjectIcon id={id} size={18} /><span>{title}</span><small>{bySubject[id].length}</small></button>)}</div>

    <section id="sx-subject-panel" role="tabpanel" aria-labelledby={`sx-tab-${subject}`} className="sx-subject">
      <p className="sx-small">{units.length ? `${units.length} ${units.length === 1 ? 'lesson' : 'lessons'} across ${taught.length} of ${syllabus?.chapters.length || 0} chapters in ${subjectName(subject)}. More are added as each one passes its source checks.` : `${subjectName(subject)} lessons are still being prepared. Practice questions are available now.`}</p>
      {taught.map(chapter => <div key={chapter.id} className="sx-chapter">
        <div className="sx-chapter__head"><h2>{chapter.title}</h2><Link className="sx-link" href={practiceHref(subject, chapter.title)}>Practise</Link></div>
        <Link className="sx-link sx-small" href={`/learn/summary?${new URLSearchParams({subject,chapter:chapter.title})}`}>Read or print the chapter summary</Link>
        <ul className="sx-units">{units.filter(u => u.chapter === chapter.title).map(u => <li key={u.id}>
          <Link href={`/learn/${u.id}`} onClick={e => open(e, u.id)} className="sx-unit">
            <span className="sx-unit__main"><b>{u.title}</b><span className="sx-unit__summary">{u.summary}</span>
              <span className="sx-unit__meta"><Timer size={14} aria-hidden="true" />{u.estimatedMinutes} min{u.skill ? ` · ${u.skill}` : ''} · {u.cardCount} recall {u.cardCount === 1 ? 'card' : 'cards'}</span></span>
            {u.status !== 'new' ? <span className="sx-unit__status" data-status={u.status}>{u.status === 'in_progress' ? `Step ${u.inProgress.step}/${u.inProgress.total}` : u.status === 'due' ? `${u.memory.due} due` : u.status === 'learned' && u.memory.nextDue ? `Review ${whenDue(u.memory.nextDue)}` : STATUS[u.status]?.label}</span> : null}
            <ChevronRight size={18} aria-hidden="true" />
          </Link></li>)}</ul>
      </div>)}
      {untaught.length ? <details className="sx-untaught"><summary>{untaught.length} more {untaught.length === 1 ? 'chapter' : 'chapters'} · practice available, lessons later</summary>
        <ul>{untaught.map(c => <li key={c.id}><span>{c.title}</span><Link className="sx-link" href={practiceHref(subject, c.title)}>Practise</Link></li>)}</ul>
        <p className="sx-small">Chapter list from the CUET UG 2026 syllabus; the 2027 syllabus is provisional until NTA publishes it.</p></details> : null}
    </section>

    <section className="sx-record" aria-label="Your study record">
      <p><b>{catalog.progress.lessonsRead}</b> of {catalog.progress.lessonsAvailable} lessons read</p>
      <p><b>{catalog.progress.cardsStarted}</b> cards in review</p>
      <p><b>{catalog.progress.recallReviews}</b> recall answers</p>
      <Link className="sx-link" href="/progress">See your marks in Progress</Link>
    </section>
    <Link className="sx-mock" href="/dashboard?mode=full"><span><b>Ready to test yourself?</b><small>A full mock shows which chapters are costing you marks. Access and cost are shown first.</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
    {prefsSlot}
  </div>;
}
