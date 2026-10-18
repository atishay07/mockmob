"use client";
// Review's one next move (LEARN-REVIEW-1017 5.3). It only renders what reviewMove() returns from the shared nextMove():
// no rule lives here. Five parts: the title with its number, the key, one line of value, the cost, the alternative.
// Review's only wording change: a key that names the chapter in the title above says "this chapter" instead.
import Link from 'next/link';

const lead = /^(Your costliest chapter: \d+ marks lost)(.*)$/;

function Line({ text }) {
  const m = lead.exec(text || '');
  if (!m) return <span>{text}</span>;
  return <span><b>{m[1]}</b>{m[2]}</span>;
}

export default function ReviewNextMove({ move, onOpen }) {
  const title = move.panel?.title || '';
  const chapter = move.target?.chapter || null;
  const here = (label) => (chapter && title === chapter ? String(label).replace(` on ${chapter}`, ' on this chapter') : label);
  const key = here(move.label);
  const opens = move.kind === 'repair' || move.kind === 'check';
  const alt = move.note ? null : move.alt;
  const altEl = (() => {
    if (!alt) return null;
    const label = here(alt.label);
    if (alt.kind === 'repair') return <button type="button" className="rvw-alt mk-press" onClick={() => onOpen(alt.target, { repair: true })}>{label}</button>;
    const href = alt.kind === 'credits' ? '/wallet' : alt.target?.href || '/dashboard?mode=full';
    return <Link className="rvw-alt mk-press" href={href}>{label}</Link>;
  })();
  return (
    <section className="rvw-next" aria-labelledby="rvw-next-h">
      <h2 id="rvw-next-h" className="rvw-next__title">{title}<Line text={move.panel?.line || move.why} /></h2>
      {opens ? (
        <button type="button" className="btn-volt rvw-next__key mk-press" data-page-primary="" onClick={() => onOpen(move.target, { repair: move.kind === 'repair' })}>{key}</button>
      ) : (
        <Link className="btn-volt rvw-next__key mk-press" data-page-primary="" href={move.target?.href || '/dashboard'}>{key}</Link>
      )}
      {move.value ? <p className="rvw-next__value">{move.value}</p> : null}
      {move.late ? <p className="rvw-next__value">{move.late}</p> : null}
      {move.cost ? <p className="rvw-next__cost">{move.cost}</p> : null}
      {move.note ? <p className="rvw-next__cost">{move.note}</p> : null}
      {altEl}
    </section>
  );
}
