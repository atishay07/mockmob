// The Arena page header, shared so every signed-in page opens the way Practice does:
// one display headline, a short lede and an optional side panel. The heading carries the hierarchy: no dot or kicker
// above it (owner's slop list), so `eyebrow` is accepted for old callers and deliberately not drawn.
export default function ArenaHead({ eyebrow, title, lede, aside = null }) {
  return (
    <header className={aside ? 'pr-head' : 'pr-head pr-head--solo'}>
      <div>
        <h1 className="display-md">{title}</h1>
        {lede ? <p>{lede}</p> : null}
      </div>
      {aside}
    </header>
  );
}

/** A ruled stat strip, the same one Practice uses. `items` = [{ icon, label, value }]. */
export function ArenaStats({ items, label = 'Summary' }) {
  return (
    <dl className="pr-stats" aria-label={label}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.icon}{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
