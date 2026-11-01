'use client';
// The student's own cards under the search field (R2 ruling 1, LK27): one line of text keys, "9 due · 6 missed · 26 in Revise".
// A count that is 0 is never drawn; with nothing in any of them there is no line at all (no "Nothing in Revise yet"). A key opens
// that set in place; the set that is open shows its key pressed.
import { shelfKeys } from './homeModel.mjs';

/** The line's place before the numbers land, at its final height, so nothing moves. */
export function ShelfKeysSkeleton() {
  return <div className="lh-skeys lh-skeys--skel" aria-hidden="true"><span className="skeleton lh-skey--skel" /></div>;
}

export default function ShelfKeys({ shelves, subjectName, selected, onSelect }) {
  const keys = shelfKeys(shelves, subjectName);
  if (!keys.length) return null;
  return (
    <div className="lh-skeys" role="group" aria-label="Your cards">
      {keys.map((k) => (
        <button key={k.id} type="button" className="lh-skey" data-skey={k.id}
          aria-pressed={selected === k.id} aria-label={k.name}
          onClick={() => onSelect(selected === k.id ? null : k.id)}>
          <b className="lh-skey__n">{k.count.toLocaleString('en-IN')}</b>
          <span className="lh-skey__l">{k.label}</span>
        </button>
      ))}
    </div>
  );
}
