// The Arena page header, shared so every signed-in page opens the same way: one display headline,
// a short lede and an optional side panel. Nothing sits above the headline: the header bar already
// names the page, so an `eyebrow` prop from older callers is ignored, never drawn as a kicker.
export default function ArenaHead({ title, lede, aside = null }) {
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
