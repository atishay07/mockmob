"use client";
// The MockMob mark on a printed sheet (owner, 31 Oct 2026: "it should have our watermark all over the place so that no one can
// copy it"). Used by every sheet a student can print: the Key cards chapter sheet, a lesson's "Print a summary" and the chapter
// summary. Put <PrintMark /> inside the sheet's own print-only block (the sheet's print CSS keeps that block and hides the rest
// of the page), and <PrintHead /> above the sheet's title.
//
//   PrintMark  print only. One layer fixed to every printed page, tiled with the lowercase "mockmob" wordmark (logo B, the real
//              outlines from brand/logoB.js), tilted -28 degrees, 150 mm apart across and 70 mm down, at 7 % black, over the
//              whole page: faint enough that the text under it stays fully readable, present enough that a copy shows it.
//              And a footer on every page: "Printed for Asha from mockmob.in on 31 Oct 2026." (8.5 pt grey; without a known
//              first name, "Printed from mockmob.in on 31 Oct 2026.").
//   PrintHead  print only. The wordmark at 14 pt, at the left of the sheet's first page.
// On screen both render nothing visible (display: none, printSheet.css); nothing about the screen changes.
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { LOGO_B_COLORS, LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from '@/components/brand/logoB';
import { MARK, printedLine } from './printLine';
import './printSheet.css';

const [VB_X, VB_Y, VB_W, VB_H] = LOGO_B_VIEWBOX.split(' ').map(Number);
const MARK_H = (MARK.width * VB_H) / VB_W;

// One tile of the mark, as an SVG image in millimetres: two rows of the grid (MARK.stepY each), the second shifted half a step
// so the marks sit staggered, every mark tilted MARK.angle about its own middle. A mark of the second row that crosses the
// tile's edge is drawn at both edges, so the tiles join without a seam. The page layer repeats this one image
// (background-image on a fixed box: a fixed SVG with transforms is not drawn right by Chrome's print-to-PDF, a background is).
function tileSvg() {
  const mobi = LOGO_B_MOBI.small;
  const w = MARK.stepX;
  const h = MARK.stepY * 2;
  const at = (cx, cy) => `<use href="#m" x="${(cx - MARK.width / 2).toFixed(2)}" y="${(cy - MARK_H / 2).toFixed(2)}" width="${MARK.width}" height="${MARK_H.toFixed(3)}" transform="rotate(${MARK.angle} ${cx} ${cy})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><defs>`
    + `<symbol id="m" viewBox="${VB_X} ${VB_Y} ${VB_W} ${VB_H}" overflow="visible"><path fill="#000" d="${LOGO_B_LETTERS}"/><path fill="#000" d="${mobi.body}"/><path fill="#000" d="${mobi.visor}"/><path fill="#fff" fill-rule="evenodd" d="${mobi.eyes}"/></symbol></defs>`
    + `${at(w / 2, MARK.stepY / 2)}${at(0, MARK.stepY * 1.5)}${at(w, MARK.stepY * 1.5)}</svg>`;
}
const TILE_URL = `url("data:image/svg+xml,${encodeURIComponent(tileSvg())}")`;

export function PrintMark() {
  const { user } = useAuth() || {};
  const [now, setNow] = useState(null);
  // The date of the print itself: read when the page draws and again just before the browser prints it.
  useEffect(() => {
    const read = () => setNow(new Date());
    queueMicrotask(read);
    window.addEventListener('beforeprint', read);
    return () => window.removeEventListener('beforeprint', read);
  }, []);
  return (
    <div className="pm" aria-hidden="true">
      <div className="pm__tiles" style={{ backgroundImage: TILE_URL, backgroundSize: `${MARK.stepX}mm ${MARK.stepY * 2}mm`, opacity: MARK.opacity }} />
      <p className="pm__foot">{now ? printedLine({ name: user?.name, email: user?.email, date: now }) : null}</p>
    </div>
  );
}

// The wordmark for the sheet's first page, drawn still (the site's LogoMark wakes Mobi with an animation that a printed page
// would catch at its first frame): ink letters and dot, Mobi in his own colours. 14 pt tall.
const DOT_R = 90;
const DOT_CX = VB_X + VB_W + 58 + DOT_R;
export function PrintHead() {
  const mobi = LOGO_B_MOBI.small;
  return (
    <div className="pm-head" aria-hidden="true">
      <svg viewBox={`${VB_X} ${VB_Y} ${VB_W + 58 + DOT_R * 2} ${VB_H}`} focusable="false">
        <path fill="#111" d={LOGO_B_LETTERS} />
        <path fill={LOGO_B_COLORS.volt} d={mobi.body} />
        <path fill={LOGO_B_COLORS.charcoal} d={mobi.visor} />
        <path fill={LOGO_B_COLORS.warmWhite} fillRule="evenodd" d={mobi.eyes} />
        <circle fill="#111" cx={DOT_CX} cy={-DOT_R} r={DOT_R} />
      </svg>
    </div>
  );
}

export default PrintMark;
