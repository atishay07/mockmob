"use client";

import React, { useMemo } from 'react';
import { encodeQr } from '@/lib/qr/encode';

const QUIET = 4; // modules of light border the QR specification asks for

/**
 * A QR code drawn as one SVG path. Always dark modules on a light tile, in either theme,
 * because scanners expect that polarity. The pixel size is an integer multiple (scale, at least 3) of the module span, so every module lands on whole pixels and stays scannable off a monitor. Renders nothing when the text is too long to encode.
 */
export default function HandoffQr({ value, label, scale = 3 }) {
  const qr = useMemo(() => encodeQr(value), [value]);
  if (!qr) return null;
  const span = qr.size + QUIET * 2;
  let d = '';
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.modules[y][x]) { x++; continue; }
      let run = 1;
      while (x + run < qr.size && qr.modules[y][x + run]) run++;
      d += `M${x + QUIET} ${y + QUIET}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return (
    <svg className="rp-handoff__qr" width={span * scale} height={span * scale} viewBox={`0 0 ${span} ${span}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={span} height={span} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
