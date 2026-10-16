// The small drawn effects around Mobi, as part of the same SVG he is drawn in: confetti and the
// landing's shockwaves, proud glints, the right answer's bubble with its tick inking itself, the
// glint across the visor and the sleepy z's. These are the rig's effect fields (burst, sparkle,
// bubble, glint, zzz): the rig table says when each runs, mobiPaint.js turns the progress into
// numbers, and this file is the markup and the one function that writes the numbers on it. Colours
// are CSS variables (mobi-figure.css), so Night and Day cost nothing at run time.
//
// Each effect is a fixed pool of elements (8 confetti pieces, 2 rings, 4 glints, 2 z's) that is
// hidden when the effect is off; nothing is created or removed while he moves.

import { BUBBLE } from './mobiPaint';

const stop = (o, c, a = 1) => <stop offset={o} style={{ stopColor: c, stopOpacity: a }} />;

/** Gradients the effects use; `p` is the instance prefix. */
export function MarksDefs({ p }) {
  return (
    <>
      <radialGradient id={`${p}piece`} cx="0.35" cy="0.35" r="0.8">{stop(0, '#EFFF7A')}{stop(0.5, '#D2F000')}{stop(1, 'var(--mb-piece-edge)')}</radialGradient>
      <radialGradient id={`${p}bubble`} gradientUnits="userSpaceOnUse" cx={-BUBBLE.r * 0.3} cy={-BUBBLE.r * 0.35} r={BUBBLE.r * 1.7}>{stop(0, '#E2FA2E')}{stop(0.45, '#D2F000')}{stop(1, '#D2F000')}</radialGradient>
      <linearGradient id={`${p}glint`} x1="0" y1="0" x2="1" y2="0">{stop(0, '#fff', 0)}{stop(0.5, '#fff', 1)}{stop(1, '#fff', 0)}</linearGradient>
    </>
  );
}

/** Behind the body, on the ground and in the air: landing rings and confetti (world coordinates). */
export function GroundMarks({ p, A }) {
  return (
    <g className="mb-marks mb-marks--ground" aria-hidden="true">
      {[0, 1].map((i) => (
        <g key={i} {...A(`ring${i}`)}>
          <ellipse {...A(`ring${i}d`)} className="mb-d" fill="none" style={{ stroke: 'var(--mb-ring-edge)' }} />
          <ellipse {...A(`ring${i}n`)} fill="none" style={{ stroke: 'var(--mb-ring)' }} />
        </g>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i} {...A(`piece${i}`)}>
          <g {...A(`piece${i}b`)}>
            <circle {...A(`piece${i}f`)} fill={`url(#${p}piece)`} />
            <circle {...A(`piece${i}e`)} fill="none" style={{ stroke: 'var(--mb-piece-rim)', strokeWidth: 'var(--mb-piece-rim-w)' }} />
            <circle {...A(`piece${i}h`)} fill="#fff" fillOpacity="0.75" />
          </g>
          <g {...A(`piece${i}r`)}>
            <circle {...A(`piece${i}rd`)} className="mb-d" fill="none" style={{ stroke: 'var(--mb-ring-edge)' }} />
            <circle {...A(`piece${i}rn`)} fill="none" style={{ stroke: 'var(--mb-ring)' }} />
          </g>
        </g>
      ))}
    </g>
  );
}

/** In front of the body (body coordinates): glints round the head and the answer bubble. */
export function HeadMarks({ p, A }) {
  return (
    <g className="mb-marks mb-marks--head" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <g key={i} {...A(`spark${i}`)}>
          <path {...A(`spark${i}p`)} className="mb-spark" />
        </g>
      ))}
      <g {...A('bubble')}>
        <g {...A('bubbleg')}>
          <path d={BUBBLE.tail} className="mb-bubble-edge" />
          <circle r={BUBBLE.r} className="mb-bubble-edge" />
          <path d={BUBBLE.tail} fill={`url(#${p}bubble)`} />
          <circle r={BUBBLE.r} fill={`url(#${p}bubble)`} />
          <circle cx={-BUBBLE.r * 0.4} cy={-BUBBLE.r * 0.42} r={BUBBLE.r * 0.18} fill="#fff" fillOpacity="0.7" />
          <path {...A('tick')} fill="none" stroke="#17150F" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </g>
  );
}

/** The visor glint sits under the eyes: a reflection on the glass, never across them. */
export function GlintMark({ p, A }) {
  return (
    <g {...A('glint')} aria-hidden="true">
      <path {...A('glint0')} fill={`url(#${p}glint)`} />
      <path {...A('glint1')} fill={`url(#${p}glint)`} />
    </g>
  );
}

/** The sleepy z's, in world coordinates (they drift up and left of the head). */
export function ZzzMarks({ A }) {
  return (
    <g aria-hidden="true">
      {[0, 1].map((i) => <path key={i} {...A(`zzz${i}`)} fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--mb-zzz)' }} />)}
    </g>
  );
}
