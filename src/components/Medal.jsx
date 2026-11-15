"use client";

// A badge's mark (lane "badges", 16 Nov 2026): one family of marks pressed onto the desk paper, drawn from lib/badgeArt.js.
// Each path has its own silhouette (a sheet, a strip of tape, a calendar page, a seal), so the four are told apart by shape.
// Three states that never look alike:
//   earned  inked: the silhouette solid in the dark of the page's ink, a fine inner rule, the sign in volt (Day: ink and volt;
//           Night: a charcoal mark with a thin lime rule and a lime sign, never a slab of lime, D7)
//   next    drawn in ink over the blind mark; where the server has an exact count, its share runs round the silhouette
//   later   a blind emboss: the shape pressed into the paper, no ink at all (a light edge above, a shadow edge below)
// One `size` ladder: md 40 (a row), row 48, lg 56 (a strip), hero 112 (the earned moment), xl 152 (a badge on its own).
// `land` plays the stamp coming down once (BadgeMoment); `fraction` is the exact count's share for `next` (else none is drawn).
// `Medal` stays the name other files import.
import { artFor, drawnState, textSize } from '@/lib/badgeArt';

const SIZES = { sm: 40, md: 40, row: 48, lg: 56, hero: 112, xl: 152 };
const SHADE = 'translate(0.9 1.1)';
const LIT = 'translate(-0.7 -0.9)';

function Sign({ art, tone, shift }) {
  const { x, y, scale } = art.shape.glyph;
  if (art.text) {
    return (
      <text className="sb-s__num" data-tone={tone} transform={shift} x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={textSize(art.text) * scale}>{art.text}</text>
    );
  }
  const g = art.glyph;
  return (
    <g className="sb-s__glyph" data-tone={tone} transform={`${shift ? `${shift} ` : ''}translate(${x} ${y}) scale(${scale})`}>
      {g.stroke.map((d) => <path key={d} className="sb-s__gs" d={d} />)}
      {g.thin.map((d) => <path key={d} className="sb-s__gt" d={d} />)}
      {g.fill.map((d) => <path key={d} className="sb-s__gf" d={d} />)}
    </g>
  );
}

export function BadgeStamp({ id, status, size = 'md', fraction = null, land = false, className = '' }) {
  const art = artFor(id);
  const state = drawnState(status);
  // Named sizes come from the stylesheet (so a context such as the popover can set its own); a number is drawn as given.
  const named = typeof size === 'string' && SIZES[size] ? size : null;
  const style = named ? undefined : { '--sb-px': `${Number.isFinite(size) ? size : SIZES.md}px` };
  if (!art) return <span className={`sb-stamp ${className}`.trim()} data-size={named || undefined} style={style} aria-hidden="true" />;
  const { shape } = art;
  const parts = [shape.outline, ...shape.extras];
  const share = state === 'next' && Number.isFinite(fraction) && fraction > 0 ? Math.min(1, fraction) : null;
  return (
    <span
      className={`sb-stamp ${className}`.trim()}
      data-status={state}
      data-path={art.path}
      data-size={named || undefined}
      data-land={land ? 'true' : undefined}
      style={style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" focusable="false">
        <g transform={shape.rotate ? `rotate(${shape.rotate} 32 32)` : undefined}>
          {state === 'earned' ? (
            <>
              <path className="sb-s__body" d={shape.outline} />
              {shape.extras.map((d) => <path key={d} className="sb-s__extra" d={d} />)}
              <path className="sb-s__rule" d={shape.rule} />
              <Sign art={art} tone="ink" />
            </>
          ) : (
            <>
              {parts.map((d) => <path key={`p${d}`} className="sb-s__press" d={d} />)}
              {parts.map((d) => <path key={`s${d}`} className="sb-s__shade" d={d} transform={SHADE} />)}
              {parts.map((d) => <path key={`l${d}`} className="sb-s__lit" d={d} transform={LIT} />)}
              {state === 'next' ? <path className="sb-s__line" d={shape.outline} /> : null}
              {share != null ? <path className="sb-s__prog" d={shape.outline} pathLength="1" style={{ '--sb-share': share }} /> : null}
              {state === 'next' ? <Sign art={art} tone="pencil" /> : (
                <>
                  <Sign art={art} tone="shade" shift={SHADE} />
                  <Sign art={art} tone="lit" shift={LIT} />
                  <Sign art={art} tone="blind" />
                </>
              )}
            </>
          )}
        </g>
      </svg>
    </span>
  );
}

/** The older name: { id, status: 'earned' | 'next' | 'later', size }. */
export function Medal({ id, status, size = 'md', fraction = null, land = false }) {
  return <BadgeStamp id={id} status={status} size={size} fraction={fraction} land={land} />;
}
