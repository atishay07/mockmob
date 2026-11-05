'use client';
// R7 W (LK62, LK48): Learn's own sets on Learn home, under the Find field, at every width. The website has tools the app does not (Find's
// sets of Key cards, the Must-know lines), and a phone student never saw three of them: they opened only from Find with nothing typed
// (/learn/find), a page no button led to. Each set is a key that opens it in place (the same view as Find's: its cards and its Study key);
// a set with no cards is not drawn, and the row is not drawn at all when there are none. Counts are the home read's shelves, nothing
// made up. The due cards are a set here and a move in Up next: the set lists them, the move starts them.
// R4 (LK139, "the search functionality is cluttered"): one row of chips ("Due today 8"), the Cards view's own chip, not boxed keys; the
// full words (the minutes, the chapters) stay in each chip's spoken name.
import { plural, shelfKeys } from './homeModel.mjs';

export default function CardSets({ shelves, onShelf }) {
  const sets = shelfKeys(shelves);
  const must = Number(shelves?.must?.count) || 0;
  const items = [
    ...sets.map((k) => ({ id: k.id, title: k.title, value: k.count, name: k.id === 'due' && shelves?.due?.minutes ? k.name.replace(/\. Show them$/, `, about ${shelves.due.minutes} min. Show them`) : k.name })),
    ...(must > 0 ? [{ id: 'must', title: 'Must-know', value: must, name: `Must-know lines: ${plural(must, 'card')} in ${plural(Number(shelves?.must?.chapters) || 1, 'chapter')}. Show them` }] : []),
  ];
  if (!items.length) return null;
  return (
    <div className="lh-sets" role="group" aria-label="Your cards" data-n={items.length}>
      {items.map((it) => (
        <button key={it.id} type="button" className="lh-set" data-skey={it.id} data-set={it.id} aria-label={it.name} onClick={() => onShelf(it.id)}>
          <span className="lh-set__t">{it.title}</span>
          <span className="lh-set__v">{it.value}</span>
        </button>
      ))}
    </div>
  );
}
