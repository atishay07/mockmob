'use client';
// The end of a study session, one form for the feed and the run (R2 ruling 5, LK31, R3-SPEC L5; the numbers rules are
// endModel.mjs):
//   <EndScreen chapter headline mobi pile numbers progress free main quiet close titleRef loading error onRetry retryKeys />
//     close      the X, the only other way out (a node: a Link or a button)
//     chapter    the chapter's name, a quiet line (15 px, one line)
//     headline   "18 done in 12 min" / "5 of 20 done" (34 px display); mobi: an act for the 64 px Mobi beside it, or null
//     pile       null | [card] the real card faces sent to Revise, fanned at 72 percent above the numbers
//     numbers    [{ value, n, label }] one row of up to 3, every zero already dropped; they count up 0 to n (300 ms, 60 ms apart)
//     progress   null | { from, to, label } the chapter's bar, growing from `from` to `to` (600 ms, ease-out)
//     free       null | { line } Free's one quiet line, directly above the keys (ruling F)
//     main       the one main key (a node); quiet the one quiet text link (a node), or null
//   Phones: the content group (chapter, headline with Mobi, fan, numbers, bar) is centred in the space between the X and the
//   key group; the key group (the Free line, the main key, the quiet link) is pinned to the foot, padding-bottom
//   max(24px, safe area). From 768 px: one column of at most 560 px, centred both ways. Reduced motion: final state.
//   <KeptFan cards open /> is exported for a screen that wants the fan alone (the checkpoint).
import { useEffect, useState } from 'react';
import MobiReact from '@/components/brand/MobiReact';
import { cardFace } from '@/components/keycards/kinds';
import { miniFront, pileFrontSize } from './endModel.mjs';

const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'; } catch { return false; } };

export function KeptFan({ cards = [], open = true, small = false }) {
  const shown = cards.slice(0, 4);
  const mid = (shown.length - 1) / 2;
  return (
    <div className="st-pile__fan" data-open={open || undefined} data-small={small || undefined} aria-hidden="true">
      {shown.map((c, i) => {
        // R4 owner-eye#14: a whole-word cut (about 3 lines of 18 characters on a small mini), never mid-word.
        const front = miniFront(cardFace(c).front || c.front || '', small ? 54 : 72);
        return (
          <span key={c.id || i} className="st-pile__card" style={{ '--r': `${(i - mid) * 7}deg`, '--x': `${(i - mid) * 26}px`, '--d': `${i * 40}ms`, zIndex: i }}>
            {i === shown.length - 1 ? (
              <>
                <span className="st-pile__k">{cardFace(c).label}</span>
                <span className="st-pile__f" lang="en" style={small ? undefined : { fontSize: pileFrontSize(front) }}>{front}</span>
              </>
            ) : <span className="st-pile__lines"><i /><i /><i /></span>}
          </span>
        );
      })}
    </div>
  );
}

/** The leading figure counts up from 0 (300 ms, ease-out, after `delay`); the rest of the value ("of 2") stays put. */
function CountUp({ n, value, delay = 0 }) {
  const [shown, setShown] = useState(() => (typeof window === 'undefined' ? n : 0));
  useEffect(() => {
    let raf = 0;
    const still = reduced() || !n;
    const t0 = performance.now() + delay;
    const tick = (t) => {
      const p = still ? 1 : Math.min(1, Math.max(0, (t - t0) / 300));
      setShown(Math.round(n * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, delay]);
  const rest = String(value).replace(/^\d+/, '');
  return <><span className="st-endx__fig">{shown}</span>{rest}</>;
}

function EndSkeleton() {
  return (
    <div className="st-endx st-endx--skel" role="status" aria-label="Adding it up">
      <span className="skeleton" style={{ width: '50%', height: 16 }} />
      <span className="skeleton" style={{ width: '70%', height: 36 }} />
      <span className="skeleton" style={{ width: '100%', height: 64 }} />
      <span className="skeleton" style={{ width: '100%', height: 6 }} />
      <span className="skeleton" style={{ width: '100%', height: 56 }} />
    </div>
  );
}

export function EndScreen({ close = null, chapter = null, headline = null, mobi = null, pile = null, numbers = [], progress = null, free = null, main = null, quiet = null, titleRef, loading = false, error = null, onRetry, retryKeys = null }) {
  // The fan opens and the bar grows once the end is drawn (one frame later, so they travel).
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (loading || error) return undefined;
    const f = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => cancelAnimationFrame(f);
  }, [loading, error]);
  if (loading) return <div className="st-endx-wrap">{close ? <div className="st-endx__top">{close}</div> : null}<EndSkeleton /></div>;
  if (error) {
    return (
      <div className="st-endx-wrap">
        {close ? <div className="st-endx__top">{close}</div> : null}
        <section className="st-endx" role="alert">
          <h1 className="st-endx__h" ref={titleRef} tabIndex={-1}>{error.title}</h1>
          <p className="st-endx__ch st-endx__ch--wrap">{error.line}</p>
          <div className="st-endx__keys">
            <button type="button" className="kc-btn kc-btn--volt st-endx__main" onClick={onRetry}>Try again</button>
            {retryKeys}
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="st-endx-wrap">
      {close ? <div className="st-endx__top">{close}</div> : null}
      <section className="st-endx" aria-labelledby="st-endx-h">
        <div className="st-endx__body">
          {chapter ? <p className="st-endx__ch">{chapter}</p> : null}
          <div className="st-endx__head">
            <h1 className="st-endx__h" id="st-endx-h" ref={titleRef} tabIndex={-1}>{headline || chapter}</h1>
            {mobi ? <span className="st-endx__mobi" aria-hidden="true"><MobiReact act={mobi} size={64} interactive /></span> : null}
          </div>
          {pile && pile.length ? <div className="st-endx__pile"><KeptFan cards={pile} open={open} small /></div> : null}
          {numbers.length ? (
            <dl className="st-endx__nums" data-n={numbers.length}>
              {numbers.map((x, i) => (
                <div key={x.label} style={{ '--i': i }}>
                  <dt><CountUp n={x.n} value={x.value} delay={i * 60} /></dt>
                  <dd>{x.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {progress ? (
            <div className="st-endx__prog">
              <div className="st-endx__bar" role="img" aria-label={progress.label}>
                <i style={{ '--from': progress.from, '--to': progress.to }} data-grow={open || undefined} />
              </div>
              <p className="st-endx__plabel">{progress.label}</p>
            </div>
          ) : null}
        </div>
        <div className="st-endx__keys">
          {free?.line ? <p className="st-endx__free">{free.line}</p> : null}
          {main}
          {quiet}
        </div>
      </section>
    </div>
  );
}

/** The main key with an optional second line inside it ("Next chapter, 10 min" / the chapter's name). */
export function EndKey({ children, sub = null, as: As = 'button', className = '', ...rest }) {
  return (
    <As className={`kc-btn kc-btn--volt st-endx__main ${className}`.trim()} data-page-primary="" {...rest}>
      <span className="st-endx__mainl">{children}</span>
      {sub ? <small className="st-endx__sub">{sub}</small> : null}
    </As>
  );
}

// The older name, for any importer that still asks for it.
export const EndForm = EndScreen;
