import React from 'react';
import Link from 'next/link';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from './brand/logoB';

// The wordmark: logo B, lowercase "mockmob" with Mobi as the second o (the owner's final logo, 13 Oct),
// followed by the small volt dot the site has always carried (kept at the owner's request, 15 Oct).
// The letters take the text colour, so one drawing serves Night and Day. Mobi keeps his volt body,
// charcoal visor and warm-white eyes on every ground. The dot uses the `.dot` colour rules the shells
// already set (volt on Night, the darker volt edge on Day, where plain volt would vanish).
//
// `height` is the wordmark's CSS height in px; without it the surrounding CSS decides (--logo-h).
// The detail master follows the final-B README: micro below 14 px, full from 64 px (a 2x screen then
// draws Mobi taller than 96 physical px), small in between.

// The dot sits on the baseline after the b, the width of Cabinet Grotesk Black's own period (180 units),
// with a little more air than the font's 20 unit side bearing so a round dot reads as a dot.
const [VB_X, VB_Y, VB_W, VB_H] = LOGO_B_VIEWBOX.split(' ').map(Number);
const DOT_R = 90;
const DOT_GAP = 58;
const DOT_CX = VB_X + VB_W + DOT_GAP + DOT_R;
const DOT_CY = -DOT_R;
const VIEWBOX = `${VB_X} ${VB_Y} ${VB_W + DOT_GAP + DOT_R * 2} ${VB_H}`;

/** Which detail master a wordmark this many CSS px tall should draw. */
export function logoDetail(height) {
  if (!(height > 0)) return 'small';
  if (height < 14) return 'micro';
  if (height >= 64) return 'full';
  return 'small';
}

/** Logo B as an inline SVG, no link. For lock-ups (auth cards, the release hold, previews). */
export function LogoMark({ height, className = '', detail, title }) {
  const level = detail || logoDetail(height);
  const mobi = LOGO_B_MOBI[level] || LOGO_B_MOBI.small;
  const style = height > 0 ? { '--logo-h': `${height}px` } : undefined;
  return (
    <svg
      className={`logo-b logo-b--${level} ${className}`.trim()}
      viewBox={VIEWBOX}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <path className="logo-b__letters" fill="currentColor" d={LOGO_B_LETTERS} />
      <g className="logo-b__mobi">
        <path fill="#D2F000" d={mobi.body} />
        <path fill="#12110E" d={mobi.visor} />
        {mobi.eyes ? <path className="logo-b__eyes" fill="#F3EFE4" fillRule="evenodd" d={mobi.eyes} /> : null}
      </g>
      <circle className="dot logo-b__dot" cx={DOT_CX} cy={DOT_CY} r={DOT_R} fill="currentColor" />
    </svg>
  );
}

export function Logo({ className = '', href = '/', height, detail }) {
  return (
    <Link href={href} className={`logo ${className}`.trim()} aria-label="MockMob home">
      <LogoMark height={height} detail={detail} />
    </Link>
  );
}
