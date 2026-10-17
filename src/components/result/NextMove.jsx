"use client";
// Layer 2 of the result (RESULT-1017 4.3, 4.4): the one next move. The only volt key in the page content (data-page-primary;
// the dock's Start key keeps its fixed look by NAV-1017 6.8 and the owner's A1 choice), one line on why, and one terms
// sentence: for a repair what the student gets and its price with the balance, before paying (W-026). The alternative is
// a quiet text action.
// The move itself is chosen by data/result_next_move.mjs; this file only lays it out.
import Link from 'next/link';
import StartSet, { setFromHref } from './StartSet';

function Action({ action, onAct, className, primary = false, isPremium = false }) {
  const props = primary ? { 'data-page-primary': '' } : {};
  // A chapter set starts in one tap, its price on the key (W-029); anything else keeps its link.
  if (action.href && setFromHref(action.href)) return <StartSet href={action.href} label={action.label} className={className} primary={primary} isPremium={isPremium} />;
  if (action.href) return <Link href={action.href} className={className} {...props}>{action.label}</Link>;
  return <button type="button" className={className} onClick={() => onAct(action)} {...props}>{action.label}</button>;
}

/**
 * move     nextMove(...) from data/result_next_move.mjs
 * onAct    ({ kind, target }) for in-page actions: open and start a repair, open a check, take another paper
 * lesson   an optional tertiary link (the chapter lesson) for a practise move
 * paperHref the "Take another fresh paper" link for the harder move's alternative
 */
export default function NextMove({ move, onAct, lesson = null, paperHref = null, arrive = false, isPremium = false, findingChapter = null }) {
  if (!move) return null;
  // The finding above already names the chapter that cost most; a repair inside it does not say the chapter twice.
  const lead = move.kind === 'repair' && move.target?.chapter && move.target.chapter === findingChapter ? `${move.target.chapter}. ` : null;
  const why = lead && move.why.startsWith(lead) ? move.why.slice(lead.length) : move.why;
  const terms = move.terms || move.cost || null;
  const key = { kind: move.kind, target: move.target, label: move.label, href: move.kind === 'practise' || move.kind === 'harder' ? move.target?.href : null };
  const alt = move.alt ? {
    kind: move.alt.kind, target: move.alt.target, label: move.alt.label,
    href: move.alt.kind === 'practise' ? move.alt.target?.href : move.alt.kind === 'credits' ? move.alt.target?.href : move.alt.kind === 'paper' ? paperHref : null,
  } : null;
  return (
    <section className="rx-next" aria-labelledby="rx-next-title" data-kind={move.kind} data-arrive={arrive || undefined}>
      <h2 id="rx-next-title" className="rx-next__label">Do this next</h2>
      <Action action={key} onAct={onAct} className="btn-volt rx-next__key" primary isPremium={isPremium} />
      <p className="rx-next__why">{why}</p>
      {/* One terms sentence under the key (W-026): what a repair gives and its price with the balance, or a set's price.
          The repair time ("All 4 repairs take about 15 minutes") sits with the mistakes list; the late-night line follows. */}
      {terms || move.late ? <p className="rx-next__terms">{[terms, move.late].filter(Boolean).join(' ')}</p> : null}
      {alt || lesson ? (
        <div className="rx-next__alt">
          {alt ? <Action action={alt} onAct={onAct} className="rx-link rx-next__altlink" isPremium={isPremium} /> : null}
          {lesson}
        </div>
      ) : null}
    </section>
  );
}
