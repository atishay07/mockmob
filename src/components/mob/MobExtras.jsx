"use client";
// Extra Mob papers (SOCIAL-SPEC section 15, Pro): a paper on a chosen chapter and length, beyond the weekly one. Pro makes
// them; any member of the Mob sits them. They close 7 days after they were made, cost no credits, and count nothing
// toward the ring (the ring is the weekly paper). Every rule is on the server; this file draws the answer it was given.
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { EXTRA_LENGTHS, EXTRA_MAX_PER_WEEK, paperHref, resultHref } from '@/lib/mob/model.mjs';
import { MobDialog } from './MobDialog';
import { closesAtLine, countLabel } from './mobFormat';

/** Chapters of the Mob's subject, loaded only when the dialog opens (the syllabus is a large table). */
function useChapters(subject, open) {
  const [chapters, setChapters] = useState(null);
  useEffect(() => {
    if (!open || !subject) return undefined;
    let alive = true;
    import('@/../data/canonical_syllabus').then((m) => {
      if (alive) setChapters(m.isTopSubject(subject) ? m.getCanonicalChapters(subject) : []);
    }).catch(() => { if (alive) setChapters([]); });
    return () => { alive = false; };
  }, [open, subject]);
  return chapters;
}

export function ExtraDialog({ open, onClose, data, run, busy }) {
  const [chapter, setChapter] = useState('');
  const [count, setCount] = useState(10);
  const [error, setError] = useState(null);
  const chapters = useChapters(data.subject, open);
  const selectId = useId();
  const make = async () => {
    setError(null);
    const r = await run('/api/mob/extra', { ...(chapter ? { chapter } : {}), count }, { name: 'extra' });
    if (!r.ok) { setError(r.message); return; }
    onClose();
  };
  return (
    <MobDialog open={open} onClose={onClose} title="Make an extra paper" labelId="mob-extra-h">
      <div className="mob-form mob-form--plain">
        <div className="mob-field">
          <label className="mob-label" htmlFor={selectId}>Chapter of {data.subjectName}</label>
          <select id={selectId} className="mob-input mob-select" value={chapter} onChange={(e) => setChapter(e.target.value)} disabled={chapters === null}>
            <option value="">Whole subject</option>
            {(chapters || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <fieldset className="mob-subjects">
          <legend className="mob-label">Length</legend>
          <div className="mob-chips">
            {EXTRA_LENGTHS.map((n) => (
              <label key={n} className="mob-chip" data-on={count === n || undefined}>
                <input type="radio" name="mob-extra-count" value={n} checked={count === n} onChange={() => setCount(n)} />
                <span>{n} questions</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mob-hint">Free of credits. Anyone in your Mob can sit it for 7 days. Your Mob can have {EXTRA_MAX_PER_WEEK} extra papers a week.</p>
        <button type="button" className="btn-volt md" onClick={make} disabled={busy === 'extra'} aria-busy={busy === 'extra' || undefined}>{busy === 'extra' ? 'Making the paper' : 'Make the paper'}</button>
        <p className="mob-notice" role="status" aria-live="polite">{error || ''}</p>
      </div>
    </MobDialog>
  );
}

function ExtraRow({ x, data, onCompare, comparing }) {
  const title = `${x.chapter || 'Whole subject'}, ${x.count} questions`;
  const cmp = x.compare;
  return (
    <li className="mob-extra">
      <div className="mob-extra__text">
        <b>{title}</b>
        <span>{x.closed ? 'Closed.' : `${closesAtLine(x.closesAt)}.`} {x.sat} of {data.week.size} sat.</span>
        {cmp?.teaser ? <span>{cmp.teaser.text}</span> : null}
      </div>
      <div className="mob-extra__actions">
        {!x.youSat && !x.closed ? <Link className="mob-key" href={paperHref(data, x)}>Sit it</Link> : null}
        {x.youSat && x.yourResultId ? <Link className="mob-key" href={resultHref(x.yourResultId)}>See your answers</Link> : null}
        {x.youSat && cmp && cmp.access !== 'locked' && cmp.available ? (
          <button type="button" className="mob-key" onClick={() => onCompare(x)} disabled={comparing === x.id} aria-busy={comparing === x.id || undefined}>{comparing === x.id ? 'Opening' : 'Side by side'}</button>
        ) : null}
      </div>
    </li>
  );
}

/** Pro makes extra papers; any member sits what is there. Nothing is drawn for a free student when there are none. */
export function ExtrasCard({ data, run, busy, onCompare, comparing }) {
  const [open, setOpen] = useState(false);
  const extras = data.extras || [];
  if (!data.plan.canMakeExtra && !extras.length) return null;
  return (
    <section className="glass mob-card" aria-labelledby="mob-extras-h">
      <header className="mob-head">
        <h2 id="mob-extras-h" className="mob-h2">Extra papers</h2>
        {extras.length ? <span className="mob-count">{countLabel(extras.length, 'paper')}</span> : null}
      </header>
      {extras.length ? (
        <ul className="mob-extras">
          {extras.map((x) => <ExtraRow key={x.id} x={x} data={data} onCompare={onCompare} comparing={comparing} />)}
        </ul>
      ) : <p className="mob-note">No extra papers this week. Make one on a chapter you want to drill, and your Mob can sit it too.</p>}
      {data.plan.canMakeExtra ? (
        <button type="button" className="mob-key mob-invite-row" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" />Make an extra paper</button>
      ) : null}
      {open ? <ExtraDialog open={open} onClose={() => setOpen(false)} data={data} run={run} busy={busy} /> : null}
    </section>
  );
}
