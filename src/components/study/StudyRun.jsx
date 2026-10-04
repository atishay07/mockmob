"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, X, BookOpenText, Target, RotateCcw } from 'lucide-react';
import { ReadingBlock, AnswerForm, Feedback, HearButton, usePronounce, Passage } from './StudyBlocks';
import { BLOCK_LABEL, RATINGS, friendlyError, itemLabel, practiceHref, subjectName, whenDue } from './studyCopy';

const newKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');

export default function StudyRun({ run: initial, api, onOpenRun, onExit }) {
  const [run, setRun] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(null), [saved, setSaved] = useState('');
  const pending = useRef(null), heading = useRef(null);
  const { speak, notice, cancel } = usePronounce();
  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRun(initial); }, [initial]);
  const item = run.item, isLesson = run.mode === 'learn', unit = run.units?.[0];

  const send = async event => {
    if (busy) return;
    const input = pending.current || { ...event, itemId: item.id, expectedRevision: run.revision, requestKey: newKey() };
    pending.current = input; setBusy(true); setError(null);
    try {
      const next = await api.post(`/api/study/runs/${run.id}/events`, input);
      pending.current = null;
      if (next.cursor !== run.cursor || next.state !== run.state) {
        // After a card is finished, say when it returns: the scheduling is the point of review.
        setSaved(!isLesson && next.lastReview?.cardId === run.item.id ? `Saved. “${run.item.word || run.item.title || 'That card'}” comes back ${whenDue(next.lastReview.due) || 'later'}.` : '');
        requestAnimationFrame(() => heading.current?.focus());
      }
      setRun(next);
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const reload = async () => {
    pending.current = null; setBusy(true); setError(null);
    try { setRun(await api.get(`/api/study/runs/${run.id}`)); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };

  const total = run.total, step = Math.min(run.cursor + 1, total);
  const back = <Link className="sx-back" href={unit && isLesson ? `/learn/${unit.id}` : '/learn'} onClick={onExit ? e => { e.preventDefault(); onExit(); } : undefined}><ArrowLeft size={16} aria-hidden="true" />{isLesson ? 'Lesson overview' : 'Learn'}</Link>;
  const errorBox = error ? <div className="sx-alert" role="alert"><p>{error.text}</p><div className="sx-actions">
    {pending.current && error.retry ? <button type="button" className="sx-secondary" onClick={() => send(pending.current)} disabled={busy}><RotateCcw size={16} aria-hidden="true" />Try again</button> : null}
    {error.reload || error.retry ? <button type="button" className="sx-quiet" onClick={reload} disabled={busy}>Reload saved step</button> : null}
    {error.updated && unit ? <Link className="sx-secondary" href={`/learn/${unit.id}`}>Open the current lesson</Link> : null}
    {error.signIn ? <Link className="sx-secondary" href="/login">Sign in</Link> : null}
  </div></div> : null;

  if (run.state === 'complete') return <div className="sx sx-run">{back}<div ref={heading} tabIndex={-1} className="sx-focus">{isLesson ? <LessonDone run={run} api={api} onOpenRun={onOpenRun} /> : <ReviewDone run={run} />}</div></div>;
  if (run.state !== 'active') return <div className="sx sx-run">{back}<div className="sx-alert" role="alert"><p>{run.state === 'invalidated' ? 'This lesson was corrected after you started. Your earlier answers are kept, but this session can’t continue.' : 'You left this session to start another one. Everything you did here is saved.'}</p>
    <div className="sx-actions">{unit ? <Link className="btn-volt md" href={`/learn/${unit.id}`}>Open the lesson</Link> : null}<Link className="sx-quiet" href="/learn">Back to Learn</Link></div></div></div>;

  const label = isLesson ? (item.kind === 'knowledge_check' ? BLOCK_LABEL.knowledge_check : BLOCK_LABEL[item.kind] || 'Lesson') : itemLabel(item);
  return <div className="sx sx-run">
    {back}
    <header className="sx-run__head">
      <p className="sx-run__title">{isLesson ? 'Lesson' : 'Recall'} · {run.title}</p>
      <p className="sx-run__count" aria-live="polite">{isLesson ? `Step ${step} of ${total}` : `Card ${step} of ${total}`}</p>
    </header>
    <ol className="sx-pips" aria-label={`${isLesson ? 'Step' : 'Card'} ${step} of ${total}`}>{Array.from({ length: total }, (_, i) => <li key={i} className={i < run.cursor ? 'done' : i === run.cursor ? 'now' : ''} />)}</ol>
    {saved ? <p className="sx-saved" role="status"><Check size={16} aria-hidden="true" />{saved}</p> : null}
    {errorBox}
    <section className="sx-stage" aria-busy={busy}>
      <p className="sx-stage__label">{label}</p>
      <h1 ref={heading} tabIndex={-1} className="sx-focus">{item.title && (isLesson || item.type === 'reading') ? item.title : item.prompt}</h1>
      {item.type === 'reading' ? <>
        <ReadingBlock block={item} speak={speak} />
        <div className="sx-actions sx-actions--sticky"><button className="btn-volt md" type="button" onClick={() => send({ type: 'continue' })} disabled={busy}>{step === total ? 'Finish lesson' : 'Continue'}<ArrowRight size={16} aria-hidden="true" /></button></div>
      </> : <>
        {item.context ? (item.context.length > 160 ? <Passage passage={{ label: 'Read this', sentences: item.context.split(/(?<=[.!?])\s+/) }} /> : <blockquote className="sx-context">{item.context}</blockquote>) : null}
        {item.title && item.prompt && (isLesson || item.type === 'reading') ? <p className="sx-prompt">{item.prompt}</p> : null}
        {item.word && run.revealed ? <HearButton word={item.word} speak={speak} /> : null}
        {run.revealed ? <>
          <Feedback feedback={run.feedback} item={item} />
          {!isLesson && item.type === 'reveal' ? <fieldset className="sx-ratings"><legend>How well did you remember it?</legend>
            {RATINGS.map(r => <button key={r.value} type="button" onClick={() => send({ type: 'rate', rating: r.value })} disabled={busy}><b>{r.label}</b><small>{r.hint}</small></button>)}
          </fieldset> : <div className="sx-actions sx-actions--sticky"><button className="btn-volt md" type="button" onClick={() => send({ type: 'continue' })} disabled={busy}>{step === total ? (isLesson ? 'Finish lesson' : 'Finish review') : 'Next'}<ArrowRight size={16} aria-hidden="true" /></button></div>}
          {!isLesson && unit && item.unitId ? <p className="sx-small"><Link className="sx-link" href={`/learn/${item.unitId}`}>Reread the lesson for this card</Link></p> : null}
        </> : item.type === 'reveal' ? <>
          <p className="sx-hint">Say or write your answer first, then check it.</p>
          <div className="sx-actions sx-actions--sticky"><button className="btn-volt md" type="button" onClick={() => send({ type: 'reveal' })} disabled={busy}>Show the answer</button></div>
        </> : <AnswerForm key={`${item.id}-${run.revision}`} item={item} busy={busy} locked={!!pending.current} assistedToggle={!isLesson}
          onSubmit={(value, assisted) => send({ type: 'answer', value: item.type === 'choice' ? value : String(value), assisted })} onSkip={(value, assisted) => send({ type: 'answer', value, assisted })} />}
      </>}
      {notice ? <p className="sx-small" role="status">{notice}</p> : null}
    </section>
    {run.lastReview?.lessonRecommended ? <p className="sx-alert">You’ve missed this card a few times. <Link className="sx-link" href={`/learn/${run.lastReview.unitId}`}>Reread its lesson</Link> before the next review.</p> : null}
    <p className="sx-small sx-autosave">{busy ? 'Saving…' : 'Every answer is saved as you go. You can leave and continue later from Learn or Today.'}</p>
  </div>;
}

function LessonDone({ run, api, onOpenRun }) {
  const unit = run.units[0];
  const [info, setInfo] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const key = useRef(null);
  useEffect(() => { let live = true; api.get(`/api/study/units/${encodeURIComponent(unit.id)}`).then(d => { if (live) setInfo(d); }).catch(() => { if (live) setInfo({ failed: true }); }); return () => { live = false; }; }, [api, unit.id]);
  const checks = run.checks || [];
  const right = checks.filter(c => c.correct).length;
  const lockIn = async () => {
    setBusy(true); setError(null); key.current ||= newKey();
    try { const next = await api.post('/api/study/runs', { mode: 'recall', unitId: unit.id, requestKey: key.current }); onOpenRun(next); }
    catch (e) { key.current = null; setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const available = info?.recall?.available || 0;
  return <section className="sx-done">
    <p className="sx-done__badge"><Check size={22} aria-hidden="true" />Lesson complete</p>
    <h1>{run.title}</h1>
    {checks.length ? <p className="sx-lede">You got {right} of {checks.length} quick {checks.length === 1 ? 'check' : 'checks'} right on the first try{right < checks.length ? ' — the recall cards will bring those ideas back.' : '.'}</p> : null}
    {info?.objectives?.length ? <><h2 className="sx-h3">This lesson covered</h2><ul className="sx-ticks">{info.objectives.map(o => <li key={o}><Check size={16} aria-hidden="true" />{o}</li>)}</ul></> : null}
    <div className="sx-next">
      <h2 className="sx-h3">Next: lock it in</h2>
      {!info ? <p className="sx-small" role="status">Checking your review cards…</p>
        : available ? <><p>Answer {available} {available === 1 ? 'card' : 'cards'} from this lesson from memory — about {Math.max(2, Math.ceil(available * 0.6))} minutes. Each answer sets when you’ll see that card again, so the idea is still there on exam day.</p>
          <button className="btn-volt md" type="button" onClick={lockIn} disabled={busy}>Lock it in · {available} {available === 1 ? 'card' : 'cards'}<ArrowRight size={16} aria-hidden="true" /></button></>
        : info.recall?.unseen ? <p>You’ve started today’s {info.recall.newCardsPerDay} new cards. This lesson’s {info.recall.unseen} cards will be ready tomorrow, and Today will remind you.</p>
        : <p>All of this lesson’s cards are already in your reviews. They’ll come back when they’re due.</p>}
      {error ? <p className="sx-alert" role="alert">{error.text}</p> : null}
    </div>
    <div className="sx-next sx-next--quiet">
      <h2 className="sx-h3">Then: apply it</h2>
      <p>Practise exam-style {unit.chapter} questions with marks. You’ll see the access and cost before anything starts.</p>
      <Link className="sx-secondary" href={practiceHref(unit.subject, unit.chapter)}><Target size={16} aria-hidden="true" />Practise {unit.chapter}</Link>
    </div>
    <p className="sx-small">This lesson is study progress. Your marks come from practice and mocks, which are recorded separately.</p>
    <div className="sx-actions"><Link className="sx-quiet" href="/learn">Back to Learn</Link><Link className="sx-quiet" href="/today">Today</Link></div>
  </section>;
}

function ReviewDone({ run }) {
  const reviewed = run.reviewed || [];
  const forgot = reviewed.filter(r => r.rating === 1);
  const focus = run.focus?.chapter ? run.focus : null;
  const units = run.units || [];
  return <section className="sx-done">
    <p className="sx-done__badge"><Check size={22} aria-hidden="true" />Review complete</p>
    <h1>{reviewed.length ? `${reviewed.length - forgot.length} of ${reviewed.length} remembered` : 'Review saved'}</h1>
    <p className="sx-lede">Each card now has its next review date. Cards you found hard come back sooner; easy ones wait longer.</p>
    {reviewed.length ? <ul className="sx-reviewed">{reviewed.map((r, i) => <li key={`${r.cardId}-${i}`} className={r.rating === 1 ? 'is-wrong' : 'is-right'}>{r.rating === 1 ? <X size={16} aria-label="Forgot" /> : <Check size={16} aria-label="Remembered" />}<span>{r.title}</span><small>Next {whenDue(r.due)}</small></li>)}</ul> : null}
    {forgot.length ? <div className="sx-next"><h2 className="sx-h3">Revisit what slipped</h2><p>{forgot.length === 1 ? 'One card' : `${forgot.length} cards`} didn’t come back. Rereading the lesson before the next review usually helps.</p>
      <div className="sx-actions">{[...new Set(forgot.map(f => f.unitId))].map(id => { const u = units.find(x => x.id === id); return <Link key={id} className="sx-secondary" href={`/learn/${id}`}><BookOpenText size={16} aria-hidden="true" />{u ? u.title : 'Open the lesson'}</Link>; })}</div></div> : null}
    {focus ? <div className="sx-next"><h2 className="sx-h3">Next: apply it</h2><p>Use it on exam-style {focus.chapter} questions with marks. Access and cost are shown before you start.</p><Link className="btn-volt md" href={practiceHref(focus.subject, focus.chapter)}>Practise {focus.chapter}<ArrowRight size={16} aria-hidden="true" /></Link></div>
      : <div className="sx-next"><h2 className="sx-h3">Next</h2><p>Continue with today’s plan, or learn a new concept.</p><div className="sx-actions"><Link className="btn-volt md" href="/today">Back to Today<ArrowRight size={16} aria-hidden="true" /></Link><Link className="sx-secondary" href="/learn">Learn something new</Link></div></div>}
    <p className="sx-small">Ratings schedule reviews; they don’t measure exam marks. {units.length === 1 ? `${subjectName(units[0].subject)} practice and mocks give your marks.` : 'Practice and mocks give your marks.'}</p>
  </section>;
}
