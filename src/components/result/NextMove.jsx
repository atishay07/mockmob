"use client";
// Layer 2 of the result (RESULT-1017 4.3, 4.4): the one next move. The only volt key in view (it carries
// data-page-primary, so the dock's Start steps back while it shows), one line on why, and for a repair one line on what
// the student gets before paying, with the cost and the balance under it. The alternative is a quiet text action.
// The move itself is chosen by data/result_next_move.mjs; this file only lays it out.
import Link from 'next/link';

function Action({ action, onAct, className, primary = false }) {
  const props = primary ? { 'data-page-primary': '' } : {};
  if (action.href) return <Link href={action.href} className={className} {...props}>{action.label}</Link>;
  return <button type="button" className={className} onClick={() => onAct(action)} {...props}>{action.label}</button>;
}

/**
 * move     nextMove(...) from data/result_next_move.mjs
 * onAct    ({ kind, target }) for in-page actions: open and start a repair, open a check, take another paper
 * lesson   an optional tertiary link (the chapter lesson) for a practise move
 * paperHref the "Take another fresh paper" link for the harder move's alternative
 * flat     drawn inside the result's summary card (N12): no panel of its own, so no card sits in a card
 */
export default function NextMove({ move, onAct, lesson = null, paperHref = null, arrive = false, flat = false }) {
  if (!move) return null;
  const key = { kind: move.kind, target: move.target, label: move.label, href: move.kind === 'practise' || move.kind === 'harder' ? move.target?.href : null };
  const alt = move.alt ? {
    kind: move.alt.kind, target: move.alt.target, label: move.alt.label,
    href: move.alt.kind === 'practise' ? move.alt.target?.href : move.alt.kind === 'credits' ? move.alt.target?.href : move.alt.kind === 'paper' ? paperHref : null,
  } : null;
  return (
    <section className="rx-next" aria-labelledby="rx-next-title" data-kind={move.kind} data-arrive={arrive || undefined} data-flat={flat || undefined}>
      <h2 id="rx-next-title" className="rx-next__label">Do this next</h2>
      <Action action={key} onAct={onAct} className="btn-volt rx-next__key" primary />
      <p className="rx-next__why">{move.why}</p>
      {move.value || move.cost || move.late || move.note ? (
        <div className="rx-next__terms">
          {move.value ? <p className="rx-next__value">{move.value}</p> : null}
          {move.cost ? <p className="rx-next__cost">{move.cost}</p> : null}
          {move.late ? <p className="rx-next__cost">{move.late}</p> : null}
          {move.note ? <p className="rx-next__cost">{move.note}</p> : null}
        </div>
      ) : null}
      {alt || lesson ? (
        <div className="rx-next__alt">
          {alt ? <Action action={alt} onAct={onAct} className="rx-link rx-next__altlink" /> : null}
          {lesson}
        </div>
      ) : null}
    </section>
  );
}
