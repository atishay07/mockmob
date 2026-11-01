'use client';
// Find with nothing typed (screens.md item 14): Find has a face of its own, not the Learn home under a field. The student's own
// sets as rows (each drawn only when it holds cards: Due today, Missed lately, In Revise), and the Must-know lines of the subject;
// a student with nothing yet gets one line and four words from the book to start a search with.
import { ChevronRight } from 'lucide-react';
import { findHintLine, findHints, plural, shelfKeys } from './homeModel.mjs';

export default function FindHome({ subject, shelves, onShelf, onSearch }) {
  const sets = shelfKeys(shelves);
  const must = Number(shelves?.must?.count) || 0;
  const hints = findHints(subject);
  const rows = [
    ...sets.map((k) => ({ id: k.id, title: k.title, line: k.id === 'due' && shelves?.due?.minutes ? `${plural(k.count, 'card')} · about ${shelves.due.minutes} min` : plural(k.count, 'card') })),
    ...(must > 0 ? [{ id: 'must', title: 'Must-know lines', line: `${plural(must, 'card')} in ${plural(Number(shelves?.must?.chapters) || 1, 'chapter')}` }] : []),
  ];
  return (
    <div className="lh-findhome">
      {!sets.length ? (
        <div className="lh-findhome__start">
          <p className="lh-findhome__line">{findHintLine(subject)}</p>
          {hints.length ? (
            <div className="lh-chips" role="group" aria-label="Try a word">
              {hints.map((w) => <button key={w} type="button" className="lh-chip" onClick={() => onSearch(w)}>{w}</button>)}
            </div>
          ) : null}
        </div>
      ) : null}
      {rows.length ? (
        <section aria-labelledby="lh-findhome-h">
          <h2 className="lh-h2 lh-findhome__h" id="lh-findhome-h">Your cards</h2>
          <ul className="lh-or lh-findhome__rows">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" className="lh-or__row" data-skey={r.id} onClick={() => onShelf(r.id)}>
                  <span className="lh-or__text"><b>{r.title}</b><span>{r.line}</span></span>
                  <ChevronRight className="lh-or__chev" size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
