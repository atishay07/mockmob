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
import { mobFetch } from './useMob';

/**
 * The chapters of the Mob's subject the bank can make a paper from, each with the longest paper it can really build
 * (GET /api/mob/extra, probed with the paper's own selector). Loaded only when the dialog opens. A failed read leaves the
 * whole subject, which always works.
 */
function useChapters(mobId, open) {
  const [state, setState] = useState({ status: 'idle', chapters: [] });
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    mobFetch(`/api/mob/extra${mobId ? `?mob=${encodeURIComponent(mobId)}` : ''}`).then((r) => {
      if (!alive) return;
      setState(r.ok ? { status: 'ready', chapters: r.data.chapters || [] } : { status: 'error', chapters: [] });
    });
    return () => { alive = false; };
  }, [open, mobId]);
  return state;
}

export function ExtraDialog({ open, onClose, data, run, busy }) {
  const [chapter, setChapter] = useState('');
  const [count, setCount] = useState(10);
  const [error, setError] = useState(null);
  const [suggest, setSuggest] = useState(null);
  const list = useChapters(data.id, open);
  const selectId = useId();
  const picked = list.chapters.find((c) => c.chapter === chapter) || null;
  const longest = picked ? picked.longest : null;
  const choose = (value) => {
    setChapter(value);
    setError(null);
    setSuggest(null);
    const c = list.chapters.find((x) => x.chapter === value);
    if (c && count > c.longest) setCount(c.longest);
  };
  const make = async (over = null) => {
    const body = over || { ...(chapter ? { chapter } : {}), count };
    setError(null);
    setSuggest(null);
    const r = await run('/api/mob/extra', body, { name: 'extra' });
    if (!r.ok) {
      setError(r.message);
      if (r.code === 'BANK_THIN' && r.detail?.suggest) setSuggest(r.detail.suggest);
      return;
    }
    onClose();
  };
  const useSuggestion = () => {
    if (!suggest) return;
    setChapter(suggest.chapter || '');
    setCount(suggest.count);
    make({ ...(suggest.chapter ? { chapter: suggest.chapter } : {}), count: suggest.count });
  };
  return (
    <MobDialog open={open} onClose={onClose} title="Make an extra paper" labelId="mob-extra-h">
      <div className="mob-form mob-form--plain">
        <div className="mob-field">
          <label className="mob-label" htmlFor={selectId}>Chapter of {data.subjectName}</label>
          <select id={selectId} className="mob-input mob-select" value={chapter} onChange={(e) => choose(e.target.value)} disabled={list.status === 'idle'} aria-describedby={`${selectId}-hint`}>
            <option value="">Whole subject</option>
            {list.chapters.map((c) => <option key={c.chapter} value={c.chapter}>{c.chapter}, up to {c.longest} questions</option>)}
          </select>
          <p id={`${selectId}-hint`} className="mob-hint">
            {list.status === 'idle' ? 'Checking which chapters have questions ready.'
              : list.status === 'error' ? 'Chapters did not load. The whole subject still works.'
                : picked ? `Enough questions are ready in this chapter for a paper of up to ${picked.longest}.`
                  : list.chapters.length ? 'Only chapters with enough questions ready for a paper are listed.' : 'No single chapter has enough questions ready yet. The whole subject does.'}
          </p>
        </div>
        <fieldset className="mob-subjects">
          <legend className="mob-label">Length</legend>
          <div className="mob-chips">
            {EXTRA_LENGTHS.map((n) => {
              const off = longest !== null && n > longest;
              return (
                <label key={n} className="mob-chip" data-on={count === n || undefined} data-off={off || undefined}>
                  <input type="radio" name="mob-extra-count" value={n} checked={count === n} disabled={off} onChange={() => { setCount(n); setError(null); setSuggest(null); }} />
                  <span>{n} questions</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <p className="mob-hint">Free of credits. Anyone in your Mob can sit it for 7 days. Your Mob can have {EXTRA_MAX_PER_WEEK} extra papers a week.</p>
        <button type="button" className="btn-volt md" onClick={() => make()} disabled={busy === 'extra'} aria-busy={busy === 'extra' || undefined}>{busy === 'extra' ? 'Making the paper' : 'Make the paper'}</button>
        <div className="mob-notice-wrap" role="status" aria-live="polite">
          {error ? <p className="mob-notice">{error}</p> : null}
          {suggest ? (
            <button type="button" className="mob-key" onClick={useSuggestion} disabled={busy === 'extra'}>
              {suggest.chapter ? `Make a ${suggest.count}-question paper on ${suggest.chapter}` : `Make a ${suggest.count}-question paper on the whole subject`}
            </button>
          ) : null}
        </div>
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
        {x.youSat && x.yourResultId ? <Link className="mob-key" href={resultHref(x.yourResultId)}>{x.answersOpen ? 'See your answers' : 'See your marks'}</Link> : null}
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
      {/* Owner decision pending (D-S2): extra papers are open to every member of the Mob, on any plan, apart from the one weekly Mob paper Free includes. Say so, so the two never read as a contradiction. */}
      {!data.plan.canMakeExtra && extras.length ? <p className="mob-hint">Extra papers are open to every member of the Mob, on any plan. Pro members make them.</p> : null}
      {data.plan.canMakeExtra ? (
        <button type="button" className="mob-key mob-invite-row" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" />Make an extra paper</button>
      ) : null}
      {open ? <ExtraDialog open={open} onClose={() => setOpen(false)} data={data} run={run} busy={busy} /> : null}
    </section>
  );
}
