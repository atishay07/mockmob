// A side column that stays in view on a desktop (desk lane, 16 Nov 2026): the result's summary card, Progress's week and
// record, the Wallet's balance. CSS sticks the column at
//   top: min(<below the top bar>, calc(100dvh - var(--side-h) - <gap>))
// so a column that fits the window stays put below the top bar, and a column taller than the window scrolls with the page
// until its foot is in view, then stays: nothing in it is ever out of reach. This ref callback only measures the column
// and writes its height into --side-h. Pass it as a ref (`ref={observeSideHeight}`): React calls it with the element and
// runs the returned cleanup when the element goes. Below the breakpoint the column is `display: contents` (no box, so
// the height reads 0) and the variable is not used.

export const SIDE_HEIGHT_VAR = '--side-h';

/** Writes the element's layout height (transforms ignored) into --side-h, now and whenever it changes. */
export function observeSideHeight(el) {
  if (!el || typeof ResizeObserver === 'undefined') return undefined;
  const write = () => el.style.setProperty(SIDE_HEIGHT_VAR, `${Math.ceil(el.offsetHeight || 0)}px`);
  const observer = new ResizeObserver(write);
  observer.observe(el);
  write();
  return () => observer.disconnect();
}
