'use client';

// The one frame of /home-next with the rows that advance it (sections 3 and 5 share it, spec: "the same frame is reused in
// section 5"). Rows beside the frame from 960 px, four (or three) chips above it on a phone. The rows are a tab list and the
// frame its panel (arrow keys, Home and End move between rows); every row is a real button. The rows advance by themselves
// under the rules of autoplay.mjs (useAutoplay.js), a thin line filling on the active row; a tap or click holds the chosen
// row. On a phone the chips carry one word, so the chosen row's title and line sit over the frame as its caption.
import { useAutoplay } from './useAutoplay';
import { Window } from './Window';
import { holdFor } from './autoplay.mjs';

export default function AutoFrame({ id, label, items, path, tag = null, mark, screen, className = '', after = null, capTitle = true }) {
  const { index, cycle, ready, reduced, seen, playing, hold, region, tab, lineEnd } = useAutoplay(items.length);
  const item = items[index];
  const still = !ready || reduced;
  const panel = `${id}-panel`;
  return (
    <div className={`hn-auto ${className}`.trim()} {...region} data-play={playing ? 'true' : 'false'} data-hold={hold ?? undefined} data-still={still ? 'true' : 'false'}>
      <div className="hn-tabs" role="tablist" aria-label={label} style={{ '--hn-count': items.length }}>
        {items.map((it, i) => {
          const on = i === index;
          return (
            <button key={it.id} type="button" role="tab" id={`${id}-tab-${it.id}`} aria-selected={on} aria-controls={panel}
              tabIndex={on ? 0 : -1} className="hn-tab" data-on={on ? 'true' : 'false'} {...tab(i)}>
              <span className="hn-tab__mark">{mark(it, i)}</span>
              <span className="hn-tab__text">
                <span className="hn-tab__verb">{it.verb}</span>
                <span className="hn-tab__title">{it.title}</span>
                <span className="hn-tab__line">{it.line}</span>
              </span>
              <span className="hn-tab__meter" aria-hidden="true">
                {on && !still ? <i key={cycle} className="hn-tab__fill" style={{ '--hn-ms': `${holdFor(it)}ms` }} onAnimationEnd={lineEnd} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="hn-panel" role="tabpanel" id={panel} aria-labelledby={`${id}-tab-${item.id}`}>
        {/* `capTitle` false: the line already says it all (the Lab's beats), so the caption is the line alone. */}
        <p className="hn-panel__cap">{capTitle ? <><b>{item.title}.</b> </> : null}{item.line}</p>
        <Window path={typeof path === 'function' ? path(item) : path} tag={tag}>
          {items.map((it, i) => {
            const on = i === index;
            return (
              <div key={it.id} className="hn-screen" data-screen={it.id} data-show={on ? 'true' : 'false'} data-on={on && (seen || still) ? 'true' : 'false'}
                aria-hidden={on ? undefined : 'true'} inert={on ? undefined : true}>
                {screen(it, i)}
              </div>
            );
          })}
        </Window>
      </div>
      {after}
    </div>
  );
}
