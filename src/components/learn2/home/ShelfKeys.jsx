'use client';
// The three shelf keys in Learn home's find band (A3 3.2.3): "9 due today", "6 missed lately", "26 in Revise". The student's own
// cards were a feature behind a focus; now they are one line of keys under (or beside) the search field. A key opens that set in
// place; the set that is open shows its key pressed. Zero is a true value: it is drawn, quiet, and says so in its name.
import { shelfKeys } from './homeModel.mjs';

/** The keys' place before the numbers land: three at the final height, so nothing moves. */
export function ShelfKeysSkeleton() {
  return (
    <div className="lh-skeys" aria-hidden="true">
      {[0, 1, 2].map((i) => <span key={i} className="skeleton lh-skey lh-skey--skel" />)}
    </div>
  );
}

export default function ShelfKeys({ shelves, subjectName, selected, onSelect }) {
  const keys = shelfKeys(shelves, subjectName);
  if (!keys.length) return null;
  if (keys.every((k) => k.zero)) return <p className="lh-skeys-line">Nothing in Revise yet. Cards you study land here.</p>;
  return (
    <div className="lh-skeys" role="group" aria-label="Your cards">
      {keys.map((k) => (
        <button key={k.id} type="button" className="lh-skey" data-skey={k.id} data-zero={k.zero || undefined}
          aria-pressed={k.zero ? undefined : selected === k.id} aria-disabled={k.zero || undefined} aria-label={k.name}
          onClick={() => { if (!k.zero) onSelect(selected === k.id ? null : k.id); }}>
          <b className="lh-skey__n">{k.count}</b>
          <span className="lh-skey__l">{k.label}</span>
        </button>
      ))}
    </div>
  );
}
