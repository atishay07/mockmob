"use client";
// Review, Mistakes view (docs/design-decisions/pass-1017/LEARN-REVIEW-1017.md 5.2 to 5.6): the one next move, a receipt of
// what is found, repaired and still open, then every mistake on record grouped by chapter across papers and priced in
// marks. Each mistake names its paper and the time it was attempted (F17); a repaired one says it opens free. The numbers
// and the move come from data/review_mistakes.mjs; this file only lays them out. No boxes inside boxes: the panel is the
// one raised surface, everything else is hairline rows whose whole row is the control.
import { useId, useState } from 'react';
import Link from 'next/link';
import { SubjectObject } from '@/components/brand/SubjectObject';
import MistakeLessonLink from '@/components/study/MistakeLessonLink';
import { REVIEW_RULES, chapterSource, receiptLine } from '@/../data/review_mistakes.mjs';
import { attemptedWhen } from '@/../data/repair_paper.mjs';
import './review-1017.css';

const PILL = {
  open: { label: 'Repair', tone: 'open' },
  repaired: { label: 'Repaired, opens free', tone: 'done' },
  blank: { label: 'Try it again, free', tone: 'blank' },
};

/** The next-move panel: title, why, the one volt key, what a repair gives, its price, and the alternative. */
export function ReviewNextMove({ move }) {
  if (!move) return null;
  return (
    <section className="rv2-next" aria-labelledby="rv2-next-title" data-kind={move.kind}>
      <p className="rv2-next__label">Do this next</p>
      <h2 id="rv2-next-title" className="rv2-next__title">{move.title}</h2>
      <p className="rv2-next__why">{move.why}</p>
      <Link className="btn-volt rv2-next__key mk-press" data-page-primary="" href={move.href}>{move.label}</Link>
      {move.value ? <p className="rv2-next__value">{move.value}</p> : null}
      {move.cost ? <p className="rv2-next__cost">{move.cost}</p> : null}
      {move.alt ? <Link className="rv2-next__alt" href={move.alt.href}>{move.alt.label}</Link> : null}
    </section>
  );
}

/** Four numbers with their labels, hairline-divided, and the one line under them. */
export function ReviewReceipt({ receipt }) {
  const items = [
    { label: 'Found', value: receipt.found, note: 'wrong answers on record' },
    { label: 'Repaired', value: receipt.repaired, note: receipt.found ? `of ${receipt.found}` : 'none yet' },
    { label: 'Still open', value: receipt.open, note: receipt.open ? 'to repair' : 'nothing open' },
    { label: 'Left blank', value: receipt.blank, note: receipt.blank ? `${receipt.blank * 5} marks not earned` : 'none' },
  ];
  return (
    <section className="rv2-receipt" aria-label="Your mistakes so far">
      <dl className="rv2-receipt__nums">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}<small>{item.note}</small></dd>
          </div>
        ))}
      </dl>
      <p className="rv2-receipt__line">{receiptLine(receipt)}</p>
    </section>
  );
}

function ItemRow({ item, now }) {
  const pill = PILL[item.state] || PILL.open;
  const when = attemptedWhen(item.at, now);
  return (
    <li>
      <Link className="rv2-item" href={`/result/${encodeURIComponent(item.attemptId)}#q-${item.n}`} data-state={item.state}>
        <span className="rv2-item__n" aria-hidden="true">{item.n}</span>
        <span className="rv2-item__main">
          <b>{item.stem || `Question ${item.n}`}</b>
          <span className="rv2-item__meta"><span className="sr-only">Question {item.n}. </span>{[item.source, when].filter(Boolean).join(', ')}{item.pick ? `. You picked ${item.pick}` : ''}</span>
          <span className="rv2-pill" data-tone={pill.tone}>{pill.label}</span>
        </span>
      </Link>
    </li>
  );
}

function ChapterRow({ chapter, subjectName, open, onToggle, now }) {
  const panelId = useId();
  const [more, setMore] = useState(false);
  const wrong = chapter.open + chapter.repaired;
  const shown = more ? chapter.items : chapter.items.slice(0, REVIEW_RULES.itemsShown);
  const rest = chapter.items.length - shown.length;
  return (
    <li className="rv2-ch" data-open={open || undefined}>
      <button type="button" className="rv2-ch__head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="rv2-ch__art" aria-hidden="true"><SubjectObject id={chapter.subject} size={56} framed={false} /></span>
        <span className="rv2-ch__main">
          <b>{chapter.chapter}</b>
          <span className="rv2-ch__src">{chapterSource(chapter, subjectName)}</span>
          {wrong ? (
            <span className="rv2-ch__prog">
              <i aria-hidden="true"><em style={{ transform: `scaleX(${chapter.repaired / wrong})` }} /></i>
              {chapter.repaired} of {wrong} repaired
            </span>
          ) : null}
        </span>
        <span className="rv2-ch__marks"><b>−{chapter.marks}</b><small>marks</small></span>
        <svg className="rv2-ch__chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className="rv2-ch__panel" id={panelId} hidden={!open}>
        {open ? (
          <>
            <ul className="rv2-items">{shown.map((item) => <ItemRow key={`${item.attemptId}:${item.qid}`} item={item} now={now} />)}</ul>
            {rest > 0 ? <button type="button" className="rv2-textbtn" onClick={() => setMore(true)}>Show {rest} more</button> : null}
            <MistakeLessonLink subject={chapter.subject} chapter={chapter.chapter} chapters={[{ chapter: chapter.chapter, count: chapter.open }]} />
          </>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The chapters, costliest first: the head with the marks they cost, the first four, then "See all".
 * `subjectName(id)` names a subject.
 */
export function ReviewChapters({ chapters, receipt, subjectName, papers }) {
  const [openKey, setOpenKey] = useState(() => chapters[0]?.key || null);
  const [all, setAll] = useState(false);
  const [now] = useState(() => Date.now());
  if (!chapters.length) {
    return (
      <section className="rv2-chs" aria-labelledby="rv2-chs-h">
        <div className="rv2-chs__head"><h2 id="rv2-chs-h">No open mistakes</h2></div>
        <p className="rv2-chs__sub">Every wrong answer on your record has a saved repair, and nothing is left blank. Each repair opens free from its paper.</p>
      </section>
    );
  }
  const marks = chapters.reduce((s, c) => s + c.marks, 0);
  const shown = all ? chapters : chapters.slice(0, REVIEW_RULES.chaptersShown);
  const rest = chapters.length - shown.length;
  return (
    <section className="rv2-chs" aria-labelledby="rv2-chs-h">
      <div className="rv2-chs__head">
        <h2 id="rv2-chs-h">{receipt.open} open {receipt.open === 1 ? 'mistake' : 'mistakes'}</h2>
        <span>Costliest first</span>
      </div>
      <p className="rv2-chs__sub">
        {receipt.blank ? `With ${receipt.blank} left blank, they` : 'They'} cost you {marks} marks across {papers} {papers === 1 ? 'paper' : 'papers'}. A wrong answer costs 6 marks, a blank 5.
      </p>
      <ul className="rv2-chs__list">
        {shown.map((c) => <ChapterRow key={c.key} chapter={c} subjectName={subjectName(c.subject)} now={now} open={openKey === c.key} onToggle={() => setOpenKey((k) => (k === c.key ? null : c.key))} />)}
      </ul>
      {rest > 0 ? (
        <button type="button" className="rv2-textbtn rv2-chs__all" onClick={() => setAll(true)}>
          See all {chapters.length} chapters
          <small>{chapters.slice(REVIEW_RULES.chaptersShown, REVIEW_RULES.chaptersShown + 2).map((c) => `${c.chapter} −${c.marks}`).join(', ')}{rest > 2 ? ` and ${rest - 2} more` : ''}</small>
        </button>
      ) : null}
    </section>
  );
}
