"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, Printer } from 'lucide-react';
import { LOCK_IN_MINUTES, nameKey, parseFrom } from '@/../data/study/lesson_map.mjs';
import { useReview } from '@/lib/reviewRead';
import { BLOCK_LABEL, STATUS, friendlyError, practiceHref, subjectName, whenDue } from './studyCopy';
import './concepts.css';

const newKey = () => crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '');
const LETTERS = 'ABCDEFGH';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (text) => (/^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text);
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

// What the lesson's Learn step holds, from the blocks it really has (never a count it does not have).
function learnText(blocks = []) {
  const kinds = blocks.reduce((m, b) => m.set(b.kind, (m.get(b.kind) || 0) + 1), new Map());
  const parts = [
    kinds.has('explanation') ? 'a short explanation' : null,
    kinds.get('word_set') ? 'the new words' : null,
    kinds.get('worked_example') ? plural(kinds.get('worked_example'), 'worked example') : null,
    kinds.has('mistake') ? 'the common mistake' : null,
    kinds.has('knowledge_check') ? 'quick checks with feedback' : null,
  ].filter(Boolean);
  if (!parts.length) return 'A short lesson with quick checks and feedback.';
  const last = parts.length > 1 ? `then ${parts.pop()}` : parts.pop();
  const text = [...parts, last].join(', ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

// Where the student came from (5.10): a neutral hairline block, red only on the pick. `q` reads the attempt for the pick and the
// answer; it says only what the attempt says, and if the attempt cannot be read it says where the student came from and no more.
function FromBlock({ from, unit, api }) {
  const [attempt, setAttempt] = useState(from?.kind === 'q' ? undefined : null);
  const review = useReview({ enabled: from?.kind === 'chapter' || from?.kind === 'today', get: api.get });
  useEffect(() => {
    if (from?.kind !== 'q') return undefined;
    let live = true;
    api.get(`/api/attempts/${encodeURIComponent(from.attemptId)}`).then((a) => { if (live) setAttempt(a); }).catch(() => { if (live) setAttempt(null); });
    return () => { live = false; };
  }, [from?.kind, from?.attemptId, api]);
  if (!from) return null;
  const objective = unit.objectives?.[0] ? lowerFirst(unit.objectives[0]) : null;
  if (from.kind === 'q') {
    if (attempt === undefined) return <div className="cx-from cx-from--wait" aria-busy="true" aria-label="Loading where you came from"><i /><i /></div>;
    const q = attempt?.questionsSnapshot?.[from.number - 1];
    const given = attempt?.details?.[from.number - 1]?.givenIndex;
    const key = Number.isInteger(q?.correctIndex) ? q.correctIndex : null;
    const paper = attempt?.paper?.source;
    const pick = Number.isInteger(given) ? LETTERS[given] : null;
    return <div className="cx-from"><b>You are here from Question {from.number}{paper ? `, ${paper}` : ''}</b>
      <span>{pick && key !== null ? <>You picked <em>{pick}</em>; the answer is {LETTERS[key]}. </> : pick ? <>You picked <em>{pick}</em>. </> : null}{objective ? `This lesson covers the idea behind it: ${sentence(objective)}` : 'This lesson covers the idea behind it.'}</span></div>;
  }
  if (from.kind === 'chapter') {
    const row = review?.state === 'ready' ? review.chapters.find((c) => nameKey(c.name) === nameKey(from.chapter)) : null;
    const open = Number(row?.openWrong) || 0;
    if (!open) return null;
    return <div className="cx-from"><b>{plural(open, 'open mistake')} in this chapter</b><span>{objective ? `This lesson covers the idea behind them: ${sentence(objective)}` : 'This lesson covers the idea behind them.'}</span></div>;
  }
  const row = review?.state === 'ready' ? review.chapters.find((c) => nameKey(c.name) === nameKey(unit.chapter)) : null;
  const open = Number(row?.openWrong) || 0;
  return <div className="cx-from"><b>Today put this lesson first</b><span>{open ? `${plural(open, 'open mistake')} ${open === 1 ? 'is' : 'are'} in its chapter, ${unit.chapter}.` : `It is the next lesson in ${unit.chapter}.`}</span></div>;
}

export default function LessonOverview({ unit, api, onOpenRun, onBack, from: fromText = null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const keys = useRef({});
  const from = parseFrom(fromText);
  const p = unit.progress || {}, memory = p.memory || {}, recall = unit.recall || {};
  const start = async mode => {
    setBusy(true); setError(null); keys.current[mode] ||= newKey();
    try { onOpenRun(await api.post('/api/study/runs', { mode, unitId: unit.id, requestKey: keys.current[mode] })); }
    catch (e) { keys.current[mode] = null; setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const status = p.status || 'new';
  const cards = memory.cards || unit.cardCount || 0;
  // One key, and it names the time it covers: Learn plus Lock it in. Apply keeps its own time and is separate.
  const minutes = unit.estimatedMinutes !== null && Number.isFinite(Number(unit.estimatedMinutes)) ? Number(unit.estimatedMinutes) + (cards ? LOCK_IN_MINUTES : 0) : null;
  const primary = status === 'in_progress' ? { label: `Resume the lesson, step ${p.inProgress.step} of ${p.inProgress.total}`, run: 'learn' }
    : status === 'new' ? { label: `Start the lesson${minutes ? `, ${plural(minutes, 'minute')}` : ''}`, run: 'learn' }
    : recall.available ? { label: `Lock it in, ${plural(recall.available, 'card')}`, run: 'recall' }
    : { label: `Practise ${unit.chapter}`, href: practiceHref(unit.subject, unit.chapter) };
  const learnState = p.read ? 'Done' : status === 'in_progress' ? `Step ${p.inProgress.step} of ${p.inProgress.total}` : null;
  const lockState = !memory.cards ? null : memory.reviewed === memory.cards ? (memory.nextDue ? `All in Revise, next ${whenDue(memory.nextDue)}` : 'All in Revise') : memory.reviewed ? `${memory.reviewed} of ${memory.cards} started` : p.read ? 'Ready' : null;
  const applyText = from?.kind === 'q' ? `Back to Question ${from.number}: repair it, or practise 10 on this chapter with marks.` : `Exam-style ${unit.chapter} questions with marks. Your result shows what to fix next.`;
  const steps = [
    { name: 'Learn', time: unit.estimatedMinutes ? `${unit.estimatedMinutes} min` : null, text: learnText(unit.blocks), state: learnState, done: p.read },
    ...(cards ? [{ name: 'Lock it in', time: `${LOCK_IN_MINUTES} min`, text: `${plural(cards, 'card')} from memory. After that ${cards === 1 ? 'it comes' : 'they come'} back in Revise with your mistakes.`, state: lockState }] : []),
    { name: 'Apply', time: 'about 10 min, separate', text: applyText, state: null },
  ];
  // Back goes where the student came from: the page before this one when it is ours (it keeps its scroll and its opened row),
  // else the result for a question, else Concepts.
  const backLabel = from?.kind === 'q' ? `Back to Question ${from.number}` : from ? 'Back' : 'Concepts';
  const backHref = from?.kind === 'q' ? `/result/${encodeURIComponent(from.attemptId)}` : `/learn?subject=${unit.subject}`;
  const goBack = (event) => {
    if (onBack) { event.preventDefault(); onBack(); return; }
    if (from && typeof window !== 'undefined' && window.history.length > 1) {
      try { if (document.referrer && new URL(document.referrer).origin === window.location.origin) { event.preventDefault(); router.back(); } } catch { /* the link works */ }
    }
  };
  return <div className="sx sx-overview cx-lesson-page">
    <Link className="sx-back" href={backHref} onClick={goBack}><ChevronLeft size={16} aria-hidden="true" />{backLabel}</Link>
    <h1>{unit.title}</h1>
    <p className="cx-lmeta">{subjectName(unit.subject)}, {unit.chapter}.{unit.estimatedMinutes ? ` A ${unit.estimatedMinutes}-minute lesson${cards ? ` and ${plural(cards, 'card')}` : ''}.` : ''}{status !== 'new' ? ` ${STATUS[status]?.label}${memory.due ? `, ${memory.due} due now` : ''}.` : ''}</p>
    <FromBlock from={from} unit={unit} api={api} />
    {error ? <div className="sx-alert" role="alert"><p>{error.text}</p></div> : null}
    {primary.href ? <Link className="btn-volt cx-key" href={primary.href} data-page-primary="">{primary.label}</Link>
      : <button className="btn-volt cx-key" type="button" onClick={() => start(primary.run)} disabled={busy} data-page-primary="">{primary.label}</button>}
    <div className="sx-actions">
      {p.read && primary.run !== 'learn' ? <button className="sx-secondary" type="button" onClick={() => start('learn')} disabled={busy}>Read the lesson again</button> : null}
      {primary.run === 'recall' || primary.run === 'learn' ? <Link className="sx-quiet" href={practiceHref(unit.subject, unit.chapter)}>Practise this chapter</Link> : null}
    </div>
    {unit.active && unit.active.unitId !== unit.id && unit.active.mode === 'learn' ? <p className="sx-small">Starting this lesson sets aside your unfinished lesson “{unit.active.title}”. Its saved steps stay in your record.</p> : null}

    <h2 className="cx-sr">The steps</h2>
    <ol className="cx-steps">{steps.map((s, i) => <li key={s.name} data-done={s.done || undefined}><i aria-hidden="true">{s.done ? <Check size={16} /> : i + 1}</i><div><b>{s.name}{s.time ? <small>{s.time}</small> : null}</b><p>{s.text}</p>{s.state ? <p className="cx-steps__state">{s.state}</p> : null}</div></li>)}</ol>

    <section className="sx-section" aria-labelledby="sx-learn-points"><h2 id="sx-learn-points" className="sx-h3">You’ll be able to</h2><ul className="sx-ticks">{unit.objectives?.map(o => <li key={o}><Check size={16} aria-hidden="true" />{o}</li>)}</ul>
      {unit.examLink ? <p className="sx-examlink"><b>How CUET asks this:</b> {unit.examLink}</p> : null}</section>

    <details className="sx-sources"><summary>Inside the lesson</summary>
      <ol className="sx-outline">{unit.blocks.map(b => <li key={b.id}><span>{b.title}</span><small>{BLOCK_LABEL[b.kind]?.replace(' · not scored', '') || ''}</small></li>)}</ol></details>

    {unit.siblings?.length ? <section className="sx-section"><h2 className="sx-h3">More in {unit.chapter}</h2><ul className="sx-links">{unit.siblings.map(s => <li key={s.id}><Link href={`/learn/${s.id}`}>{s.title}<small>{STATUS[s.status]?.label}</small></Link></li>)}</ul></section> : null}

    <details className="sx-sources"><summary>Sources and version</summary>
      <p>Version {unit.version}. A self-study companion to your textbook and coaching; it does not replace them.</p>
      {unit.sourceRefs?.map(s => <div key={s.id}><a className="sx-link" href={s.url} target="_blank" rel="noreferrer">{s.label}</a><p className="sx-small">{s.permission}</p>{s.license ? <pre>{s.license}</pre> : null}</div>)}
    </details>
    <button type="button" className="sx-quiet sx-print" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print a summary</button>
    <section className="sx-print-only"><h2>{unit.title}</h2>{unit.objectives?.map(o => <p key={o}>• {o}</p>)}{unit.blocks.filter(b => b.type === 'reading').map(b => <div key={b.id}><h3>{b.title}</h3>{b.body ? <p>{b.body}</p> : null}{b.formula ? <p>{b.formula}</p> : null}{b.steps ? <ol>{b.steps.map(s => <li key={s}>{s}</li>)}</ol> : null}{b.words ? b.words.map(w => <p key={w.word}><b>{w.word}</b>: {w.meaning}{w.example ? ` — “${w.example}”` : ''}</p>) : null}{b.rows ? <table><tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table> : null}</div>)}</section>
  </div>;
}
