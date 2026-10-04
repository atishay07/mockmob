"use client";
import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Printer, Clock } from 'lucide-react';
import { SubjectIcon } from '@/components/ui/Glyph';
import { BLOCK_LABEL, STATUS, friendlyError, practiceHref, subjectName, whenDue } from './studyCopy';

const newKey = () => crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '');

export default function LessonOverview({ unit, api, onOpenRun, onBack }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const keys = useRef({});
  const p = unit.progress || {}, memory = p.memory || {}, recall = unit.recall || {};
  const start = async mode => {
    setBusy(true); setError(null); keys.current[mode] ||= newKey();
    try { onOpenRun(await api.post('/api/study/runs', { mode, unitId: unit.id, requestKey: keys.current[mode] })); }
    catch (e) { keys.current[mode] = null; setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const status = p.status || 'new';
  const primary = status === 'in_progress' ? { label: `Resume lesson · step ${p.inProgress.step} of ${p.inProgress.total}`, run: 'learn' }
    : status === 'new' ? { label: `Start lesson · ${unit.estimatedMinutes} min`, run: 'learn' }
    : recall.available ? { label: `Lock it in · ${recall.available} ${recall.available === 1 ? 'card' : 'cards'}`, run: 'recall' }
    : { label: `Practise ${unit.chapter}`, href: practiceHref(unit.subject, unit.chapter) };
  const steps = [
    { name: 'Learn', time: `${unit.estimatedMinutes} min`, text: 'Short explanation, worked example, the common mistake, then quick checks with feedback.', state: p.read ? 'Done' : status === 'in_progress' ? `Step ${p.inProgress.step} of ${p.inProgress.total}` : 'Start here' },
    { name: 'Lock it in', time: '2–3 min', text: `Answer ${memory.cards || ''} recall cards from memory. Each answer schedules the next review so the idea stays for exam day.`, state: !memory.cards ? '—' : memory.reviewed === memory.cards ? (memory.nextDue ? `All in review · next ${whenDue(memory.nextDue)}` : 'All in review') : memory.reviewed ? `${memory.reviewed} of ${memory.cards} started` : p.read ? 'Ready' : 'After the lesson' },
    { name: 'Apply', time: 'about 10 min', text: `Exam-style ${unit.chapter} questions with marks. Your result shows what to fix next.`, state: 'Any time' },
  ];
  return <div className="sx sx-overview">
    <Link className="sx-back" href={`/learn?subject=${unit.subject}`} onClick={onBack ? e => { e.preventDefault(); onBack(); } : undefined}><ArrowLeft size={16} aria-hidden="true" />{subjectName(unit.subject)} lessons</Link>
    <p className="sx-meta"><SubjectIcon id={unit.subject} size={16} /><span>{unit.chapter}</span>{unit.skill ? <span className="sx-meta__chip">{unit.skill}</span> : null}<span className="sx-meta__chip"><Clock size={14} aria-hidden="true" />{unit.estimatedMinutes} min</span></p>
    <h1>{unit.title}</h1>
    <p className="sx-lede">{unit.summary}</p>
    {status !== 'new' ? <p className="sx-status" data-status={status}>{STATUS[status]?.label}{memory.due ? ` · ${memory.due} due now` : ''}</p> : null}
    {error ? <div className="sx-alert" role="alert"><p>{error.text}</p></div> : null}
    <div className="sx-actions">
      {primary.href ? <Link className="btn-volt md" href={primary.href}>{primary.label}<ArrowRight size={16} aria-hidden="true" /></Link>
        : <button className="btn-volt md" type="button" onClick={() => start(primary.run)} disabled={busy}>{primary.label}<ArrowRight size={16} aria-hidden="true" /></button>}
      {p.read && primary.run !== 'learn' ? <button className="sx-secondary" type="button" onClick={() => start('learn')} disabled={busy}>Read the lesson again</button> : null}
      {primary.run === 'recall' || primary.run === 'learn' ? <Link className="sx-quiet" href={practiceHref(unit.subject, unit.chapter)}>Practise this chapter</Link> : null}
    </div>
    {unit.active && unit.active.unitId !== unit.id && unit.active.mode === 'learn' ? <p className="sx-small">Starting this lesson sets aside your unfinished lesson “{unit.active.title}”. Its saved steps stay in your record.</p> : null}

    <section className="sx-section" aria-labelledby="sx-learn-points"><h2 id="sx-learn-points" className="sx-h3">You’ll be able to</h2><ul className="sx-ticks">{unit.objectives?.map(o => <li key={o}><Check size={16} aria-hidden="true" />{o}</li>)}</ul>
      {unit.examLink ? <p className="sx-examlink"><b>How CUET asks this:</b> {unit.examLink}</p> : null}</section>

    <section className="sx-section" aria-labelledby="sx-loop"><h2 id="sx-loop" className="sx-h3">Three steps to get this into your marks</h2>
      <ol className="sx-loop">{steps.map((s, i) => <li key={s.name} data-done={s.state === 'Done' || undefined}><span className="sx-loop__n" aria-hidden="true">{s.state === 'Done' ? <Check size={16} /> : i + 1}</span><div><p className="sx-loop__name"><b>{s.name}</b><small>{s.time}</small></p><p>{s.text}</p><p className="sx-loop__state">{s.state}</p></div></li>)}</ol>
    </section>

    <section className="sx-section" aria-labelledby="sx-inside"><h2 id="sx-inside" className="sx-h3">Inside the lesson</h2>
      <ol className="sx-outline">{unit.blocks.map(b => <li key={b.id}><span>{b.title}</span><small>{BLOCK_LABEL[b.kind]?.replace(' · not scored', '') || ''}</small></li>)}</ol></section>

    {unit.siblings?.length ? <section className="sx-section"><h2 className="sx-h3">More in {unit.chapter}</h2><ul className="sx-links">{unit.siblings.map(s => <li key={s.id}><Link href={`/learn/${s.id}`}>{s.title}<small>{STATUS[s.status]?.label}</small></Link></li>)}</ul></section> : null}

    <details className="sx-sources"><summary>Sources and version</summary>
      <p>Version {unit.version}. A self-study companion to your textbook and coaching; it does not replace them.</p>
      {unit.sourceRefs?.map(s => <div key={s.id}><a className="sx-link" href={s.url} target="_blank" rel="noreferrer">{s.label}</a><p className="sx-small">{s.permission}</p>{s.license ? <pre>{s.license}</pre> : null}</div>)}
    </details>
    <button type="button" className="sx-quiet sx-print" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print a summary</button>
    <section className="sx-print-only"><h2>{unit.title}</h2>{unit.objectives?.map(o => <p key={o}>• {o}</p>)}{unit.blocks.filter(b => b.type === 'reading').map(b => <div key={b.id}><h3>{b.title}</h3>{b.body ? <p>{b.body}</p> : null}{b.formula ? <p>{b.formula}</p> : null}{b.steps ? <ol>{b.steps.map(s => <li key={s}>{s}</li>)}</ol> : null}{b.words ? b.words.map(w => <p key={w.word}><b>{w.word}</b>: {w.meaning}{w.example ? ` — “${w.example}”` : ''}</p>) : null}{b.rows ? <table><tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table> : null}</div>)}</section>
  </div>;
}
