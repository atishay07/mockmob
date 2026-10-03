// The Arena page header, shared so every signed-in page opens the way Practice does:
// a dot eyebrow, one display headline, a short lede and an optional side panel.
export default function ArenaHead({ eyebrow, title, lede, aside = null }) {
  return (
    <header className={aside ? 'pr-head' : 'pr-head pr-head--solo'}>
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
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
