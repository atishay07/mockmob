"use client";
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import { SmoothDetails } from '@/components/ui/controls/SmoothDetails';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { conceptsPick, lessonRow, loseMarks, allChapters, searchConcepts, recordLine } from '@/../data/study/concepts_pick.mjs';
import { lessonHref } from '@/../data/study/lesson_map.mjs';
import { invalidateReview, useReview } from '@/lib/reviewRead';
import UnitRing from './UnitRing';
import { SUBJECTS, friendlyError, practiceHref, subjectName } from './studyCopy';
import './concepts.css';

const newKey = () => crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '');
const MINUS = '−';
const LOSE_ROWS = 4;
// The switch lists the four subjects by name, so the order does not move with the student's data.
const SWITCH = [...SUBJECTS].sort((a, b) => a[1].localeCompare(b[1]));

const Lost = ({ marks }) => <span className="cx-lost">{MINUS}{marks}<span className="cx-sr"> marks lost</span></span>;
const fromText = (from) => (from ? `chapter:${from.subject}:${from.chapter}` : null);
const fromChapter = (unit) => ({ kind: 'chapter', subject: unit.subject, chapter: unit.chapter });

// One lesson in a list: its ring, title, one line of what is true about it, and its time (or Read). `from` says which moment it was
// opened from, so the lesson page can say why the student is there (5.10).
function Lesson({ unit, from = null, sub = null, onOpen }) {
  const row = lessonRow(unit);
  return <li><Link className="cx-lesson" href={lessonHref({ href: `/learn/${encodeURIComponent(unit.id)}` }, from)} onClick={(e) => onOpen(e, unit.id, fromText(from))}>
    <UnitRing unit={unit} /><span className="cx-lesson__main"><b>{row.title}</b><span>{sub || row.line}</span></span>{row.trailing ? <em>{row.trailing}</em> : null}
  </Link></li>;
}

// Concepts, the lesson library (LEARN-REVIEW-1017 5.9). Lessons come to the student: the one lesson to read next is chosen from
// where marks are being lost (data/study/concepts_pick.mjs, from GET /api/me/review), then the chapters that cost marks with
// their lessons, then every chapter of the subject. Due recall cards are Revise's now, so they are a quiet row here, never the key.
export default function StudyLibrary({ catalog, api, onOpenRun, onOpenUnit, initialSubject, prefsSlot }) {
  const review = useReview({ get: api.get });
  const [chosen, setChosen] = useState(SUBJECTS.some((s) => s[0] === initialSubject) ? initialSubject : null);
  const [busy, setBusy] = useState(null), [error, setError] = useState(null), [query, setQuery] = useState('');
  const keys = useRef({});
  const loading = review === undefined;
  const pick = loading ? null : conceptsPick({ catalog, review });
  const firstSubject = catalog.nextUnit?.subject || catalog.preferences?.subjects?.[0] || 'english';
  // The subject follows the lesson on the panel until the student picks one themselves, so the two never disagree.
  const subject = chosen || pick?.unit?.subject || firstSubject;
  const units = catalog.units;
  const syllabus = catalog.subjects.find((s) => s.subject === subject);
  const rec = recordLine(catalog);
  const q = catalog.queue;
  const active = catalog.active;

  const open = (event, id, from) => { if (onOpenUnit) { event.preventDefault(); onOpenUnit(id, from); } };
  const run = async (name, body, key) => {
    setBusy(name); setError(null); keys.current[key] ||= newKey();
    try { onOpenRun(await api.post('/api/study/runs', { ...body, requestKey: keys.current[key] })); }
    catch (e) { keys.current[key] = null; setError(friendlyError(e)); } finally { setBusy(null); }
  };
  const startLesson = () => run('lesson', { mode: 'learn', unitId: pick.run.unitId }, `learn:${pick.run.unitId}`);
  const startRecall = () => run('recall', { mode: 'recall' }, 'recall');

  const results = useMemo(() => searchConcepts(query, { units, subjects: catalog.subjects }), [query, units, catalog.subjects]);
  const lose = useMemo(() => (loading ? [] : loseMarks({ review, units, subject })), [loading, review, units, subject]);
  const all = useMemo(() => allChapters({ subject, syllabus, units, review: loading ? null : review }), [subject, syllabus, units, review, loading]);

  const dueCards = q?.dueCount || 0;
  const recallMinutes = Math.max(2, Math.ceil(Math.min(dueCards, 10) * 0.5));

  return <div className="sx sx-library cx">
    <header className="cx-head">
      <h1>Concepts</h1>
      <p className="cx-lede">Short lessons on the ideas behind your mistakes.</p>
    </header>
    <div className="cx-board">
      <div className="cx-main">
        {loading ? <section className="cx-next cx-next--wait" aria-busy="true" aria-label="Finding your next lesson"><i /><i /><i /></section> : <section className="cx-next" aria-labelledby="cx-next-title" data-kind={pick.kind}>
          <h2 id="cx-next-title" className="cx-next__title">{pick.title}</h2>
          <p className="cx-next__line">{pick.lead ? <b>{pick.lead} </b> : null}{pick.reason}</p>
          {pick.run
            ? <button className="btn-volt cx-next__key" type="button" onClick={startLesson} disabled={Boolean(busy)} data-page-primary="">{pick.key}</button>
            : <Link className="btn-volt cx-next__key" href={pick.href} data-page-primary="">{pick.key}</Link>}
          {pick.cost ? <p className="cx-next__cost">{pick.cost}</p> : null}
        </section>}
        {error ? <div className="sx-alert" role="alert"><p>{error.text}</p></div> : null}

        {active && active.mode === 'recall' ? <Link className="cx-row" href={`/study/${active.id}`}><b>Finish your Revise session</b><span>You stopped at card {active.step} of {active.total}. Everything before it is saved.</span><ChevronRight size={18} aria-hidden="true" /></Link> : null}
        {dueCards && catalog.recallEnabled && !(active && active.mode === 'recall') ? <button className="cx-row" type="button" onClick={startRecall} disabled={Boolean(busy)}><b>Revise {dueCards} concept {dueCards === 1 ? 'card' : 'cards'}</b><span>From lessons you have read. About {recallMinutes} minutes, free.</span><ChevronRight size={18} aria-hidden="true" /></button> : null}

        <label className="cx-search"><Search size={18} aria-hidden="true" /><span className="cx-sr">Search chapters and lessons</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chapters and lessons" autoComplete="off" enterKeyHint="search" /></label>

        {results ? <section className="cx-sec" aria-labelledby="cx-results" aria-live="polite">
          <div className="cx-sec__head"><h2 id="cx-results">Results</h2><p>{results.lessons.length + results.chapters.length ? `${results.lessons.length} ${results.lessons.length === 1 ? 'lesson' : 'lessons'}${results.chapters.length ? `, ${results.chapters.length} ${results.chapters.length === 1 ? 'chapter' : 'chapters'} without one` : ''}` : ''}</p></div>
          {results.lessons.length || results.chapters.length ? <>
            {results.lessons.length ? <ul className="cx-lessons">{results.lessons.map((u) => <Lesson key={u.id} onOpen={open} unit={u} from={fromChapter(u)} sub={`${subjectName(u.subject)}, ${u.chapter}`} />)}</ul> : null}
            {results.chapters.length ? <ul className="cx-chapters">{results.chapters.map((c) => <li key={`${c.subject}:${c.id}`}><Link className="cx-row" href={practiceHref(c.subject, c.name)}><b>{c.name}</b><span>{subjectName(c.subject)}. No lesson yet. Practise the chapter</span><ChevronRight size={18} aria-hidden="true" /></Link></li>)}</ul> : null}
          </> : <p className="cx-empty">Nothing matches that. Try a chapter name or a topic.</p>}
        </section> : <>
          <div className="cx-subjects" role="tablist" aria-label="Subject">{SWITCH.map(([id, title]) => <button key={id} role="tab" id={`cx-tab-${id}`} aria-controls="cx-subject-panel" aria-selected={id === subject} tabIndex={id === subject ? 0 : -1} type="button" onClick={() => setChosen(id)}
            onKeyDown={(e) => { const i = SWITCH.findIndex((s) => s[0] === id); const to = e.key === 'ArrowRight' ? (i + 1) % 4 : e.key === 'ArrowLeft' ? (i + 3) % 4 : null; if (to !== null) { e.preventDefault(); setChosen(SWITCH[to][0]); document.getElementById(`cx-tab-${SWITCH[to][0]}`)?.focus(); } }}>
            <SubjectObject id={id} size={36} framed={false} life={false} /><span>{title}</span></button>)}</div>

          <div id="cx-subject-panel" role="tabpanel" aria-labelledby={`cx-tab-${subject}`} key={subject} className="cx-switch">
            {loading ? <div className="cx-skel" aria-hidden="true"><i /><i /><i /></div> : <>
              {review?.state === 'unavailable' ? <div className="cx-note" role="status"><p>Your mistakes did not load, so lessons are not ordered by marks yet.</p><button type="button" className="cx-text" onClick={invalidateReview}>Try again</button></div> : null}
              {lose.length ? <section className="cx-sec" aria-labelledby="cx-lose">
                <div className="cx-sec__head"><h2 id="cx-lose">Where you lose marks</h2><p>From your papers</p></div>
                {lose.slice(0, LOSE_ROWS).map((row) => <div className="cx-lose" key={row.id}>
                  {row.lessons.length ? <div className="cx-chhead"><b>{row.name}</b><Lost marks={row.marks} /><span className="cx-chmeta">{row.meta}</span></div>
                    : <Link className="cx-row cx-row--lose" href={practiceHref(subject, row.name)}><b>{row.name}<Lost marks={row.marks} /></b><span>{row.meta}</span><ChevronRight size={18} aria-hidden="true" /></Link>}
                  {row.lessons.length ? <ul className="cx-lessons">{row.lessons.map((u) => <Lesson key={u.id} onOpen={open} unit={u} from={fromChapter(u)} />)}</ul> : null}
                </div>)}
              </section> : null}

              <section className="cx-sec" aria-labelledby="cx-all">
                <div className="cx-sec__head"><h2 id="cx-all">All {subjectName(subject)} chapters</h2><p>{all.lessonCount ? all.head : 'Lessons are still being prepared'}</p></div>
                {all.chapters.length ? <ul className="cx-chapters">{all.chapters.map((c) => <li key={c.id}>
                  <SmoothDetails className="cx-ch" chevron summary={<span className="cx-ch__sum"><b>{c.name}</b>{c.marks ? <Lost marks={c.marks} /> : null}<span className="cx-chmeta">{c.meta}</span></span>}>
                    <div className="cx-ch__body">
                      {c.lessons.length ? <ul className="cx-lessons">{c.lessons.map((u) => <Lesson key={u.id} onOpen={open} unit={u} from={c.marks ? fromChapter(u) : null} />)}</ul> : null}
                      <div className="cx-ch__links">
                        <Link className="cx-text" href={practiceHref(subject, c.name)}>Practise this chapter</Link>
                        {c.lessons.length ? <Link className="cx-text" href={`/learn/summary?${new URLSearchParams({ subject, chapter: c.name })}`}>Read or print the chapter summary</Link> : null}
                      </div>
                    </div>
                  </SmoothDetails></li>)}</ul> : <p className="cx-empty">{subjectName(subject)} lessons are still being prepared. Practice questions are available now.</p>}
                {all.chapters.length ? <p className="cx-foot">Chapter list from the CUET UG 2026 syllabus; the 2027 syllabus is provisional until NTA publishes it.</p> : null}
              </section>
            </>}
          </div>
        </>}
      </div>

      <aside className="cx-side" aria-label="Your study record">
        <div className="cx-record">
          <span><b>{rec.read}</b> of {rec.of} lessons read</span>
          <span><b>{rec.cards}</b> {rec.cards === 1 ? 'card' : 'cards'} in Revise</span>
          <span><b>{rec.recalled}</b> {rec.recalled === 1 ? 'card' : 'cards'} recalled</span>
        </div>
        <Link className="cx-text" href="/progress">See your marks in Progress</Link>
        {prefsSlot}
        <Link className="cx-row" href="/dashboard?mode=full"><b>Test it in a full mock</b><span>50 questions, 60 minutes. Shows which chapters still cost marks. Access and cost are shown first.</span><ChevronRight size={18} aria-hidden="true" /></Link>
      </aside>
    </div>
  </div>;
}
