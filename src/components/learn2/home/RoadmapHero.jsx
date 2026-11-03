'use client';
// Learn home's "Up next" (R7 W, LK59; was the start offer of R2 ruling 1, LK27): ONE module that says what to do next, with Today's
// anatomy (TodayMove), so the product recommends in one voice. The card holds one move at a time: its headline, one line saying why,
// the length (only the offer's own, LK37), and the page's one volt key. Under a hairline, the other moves (the server's Or rows, at
// most two) are short cells; a tap makes that one the move on the card, and the server's pick waits in the footer marked "Suggested".
// Nothing starts on a tap of a cell: only the key starts. Every word comes from the server's `roadmap` (data/learn/roadmap.js) through
// upNextMoves (homeModel.mjs); no zero is ever drawn. Free after the day's session keeps the feed refusal's block: See Pro on the key.
// R3 ruling R2 stays: the progress bar under the line, no row of ring dots. The pick lives in this tab only, never on the server.
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Repeat2 } from 'lucide-react';
import { openUpgrade } from '@/components/pro';
import { LengthControl, OwnSheet } from '../LengthPicker';
import { otherMoves, upNextMoves } from './homeModel.mjs';

/** A server action ({ run } | { href, go }) as a link for where the student is (the preview keeps its own views). */
export function actionHref(action, links) {
  if (!action) return null;
  if (action.run) {
    const r = action.run;
    const href = links.run({ chapterKey: r.chapterKey, minutes: r.minutes, kind: r.kind, leaveOut: r.leaveOut || [], cardIds: r.cardIds || [] });
    return r.resume ? `${href}${href.includes('?') ? '&' : '?'}resume=${encodeURIComponent(r.resume)}` : href;
  }
  if (action.go === 'explore') return links.explore();
  return typeof links.resolve === 'function' ? links.resolve(action.href) : action.href;
}

function Track({ progress }) {
  const pct = Math.round((progress.done / progress.of) * 1000) / 10;
  return (
    <span className="lh-track lh-hero__track" role="img" aria-label={`${progress.done} of ${progress.of} done`}>
      <span className="lh-track__fill" style={{ '--p': `${pct}%` }} />
    </span>
  );
}

/** The module's place before the data, at its final height (title, line, key), so nothing moves when it lands. */
export function HeroSkeleton() {
  return (
    <div className="lh-hero lh-hero--skel" aria-hidden="true">
      <span className="skeleton lh-sk lh-sk--t" />
      <span className="skeleton lh-sk lh-sk--l" />
      <span className="skeleton lh-sk lh-sk--key" />
    </div>
  );
}

/**
 * LK37: the offer's length is the student's to change in place, as on the chapter page: 5 | 10 | 20 | Other ("Other" opens the own-length
 * sheet). It shows the length the student chose; the headline, the due cards and the key follow from the server's answer for it. Only
 * a new offer has a length (a run to pick up carries its own minutes), and on Free the server's one line says the 10-minute cap.
 */
function OfferLength({ chosen, onChange, capped }) {
  const labelId = useId();
  const wrap = useRef(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const closeOwn = useCallback(() => {
    setOwnOpen(false);
    requestAnimationFrame(() => wrap.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }));
  }, []);
  const choose = (m) => { closeOwn(); if (m !== chosen) onChange(m); };
  return (
    <div className="lh-hero__len">
      <span className="lh-sr" id={labelId}>How long have you got?</span>
      <LengthControl minutes={chosen} onChange={choose} onOwn={() => setOwnOpen(true)} labelledBy={labelId} wrapRef={wrap} />
      <OwnSheet key={ownOpen ? 'open' : 'shut'} open={ownOpen} minutes={chosen} onChoose={choose} onClose={closeOwn} anchorRef={wrap} />
      {capped?.text ? <p className="lh-hero__cap">{capped.text}</p> : null}
    </div>
  );
}

export default function RoadmapHero({ roadmap, links, minutes = null, onMinutes = null, pending: waiting = false }) {
  const titleId = useId().replace(/:/g, '');
  const [onCard, setOnCard] = useState('lead');
  const [arrived, setArrived] = useState(null); // the cell that just came back to the footer crossfades in
  const moves = useMemo(() => upNextMoves(roadmap), [roadmap]);
  if (!roadmap) return null;
  const { mode, capped } = roadmap;
  // R2 R3: at most two other moves, in the server's order (upNextMoves keeps the same rule).
  const or = (roadmap.or || []).slice(0, 2);
  const move = moves.find((m) => m.id === onCard) || moves[0];
  const others = otherMoves(moves, move.id).filter((m) => m.id === 'lead' || or.some((o) => o.kind === m.id));
  const isLead = move.id === 'lead';
  const adjustable = isLead && typeof onMinutes === 'function' && (mode === 'today' || mode === 'new') && Number(roadmap.minutes) > 0;
  const key = move.key;
  const keyHref = key?.go === 'pro' ? null : actionHref(key, links);
  const quietHref = isLead ? actionHref(move.quiet, links) : null;
  const pending = isLead && waiting; // only the offer's own key waits for the server's answer for the chosen length
  const pick = (id) => { setArrived(move.id); setOnCard(id); };
  return (
    <section className="lh-hero lh-up" data-mode={mode} data-move={move.kind} data-picked={!isLead || undefined} aria-labelledby={titleId}>
      <div className="lh-up__move" key={move.id} aria-live="polite">
        <h2 className="lh-hero__title" id={titleId}>{move.headline}</h2>
        {move.why ? <p className="lh-hero__line">{move.why}</p> : null}
        {move.progress ? <Track progress={move.progress} /> : null}
        {move.sub ? <p className="lh-hero__sub">{move.sub}</p> : null}
        {adjustable ? <OfferLength chosen={minutes || Number(roadmap.asked) || Number(roadmap.minutes)} onChange={onMinutes} capped={capped} /> : null}
        <div className="lh-hero__keys">
          {key?.go === 'pro'
            ? <button type="button" className="lh-key lh-key--volt lh-hero__key" data-page-primary="" onClick={(e) => openUpgrade({ trigger: 'learn_home', opener: e.currentTarget })}>{key.label}</button>
            : keyHref ? <Link className="lh-key lh-key--volt lh-hero__key" data-page-primary="" href={keyHref} aria-disabled={pending || undefined} onClick={(e) => { if (pending) e.preventDefault(); }}>{key.label}</Link> : null}
          {move.quiet && quietHref ? <Link className="lh-hero__quiet" href={quietHref}>{move.quiet.label}</Link> : null}
        </div>
      </div>
      {others.length ? (
        <div className="lh-up__or" role="group" aria-labelledby={`${titleId}-or`} data-n={others.length}>
          <p className="lh-up__or-h" id={`${titleId}-or`}>Or make one of these your move</p>
          {others.map((m) => (
            <button key={m.id} type="button" className="lh-up__cell" data-kind={m.kind} data-arrived={arrived === m.id || undefined} onClick={() => pick(m.id)}
              aria-label={`${m.suggested ? 'Suggested. ' : ''}${m.cell.title}${m.cell.value ? `, ${m.cell.value}` : ''}. Make it your move.`}>
              <Repeat2 className="lh-up__cell-i" size={16} strokeWidth={1.75} aria-hidden="true" />
              {m.suggested ? <span className="lh-up__cell-s">Suggested</span> : null}
              <span className="lh-up__cell-t">{m.cell.title}</span>
              {m.cell.value ? <span className="lh-up__cell-v">{m.cell.value}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
