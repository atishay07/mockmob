// The picture a student can send a friend from a badge's own sheet (lane "badges", 16 Nov 2026): 1080 x 1080, drawn here in the
// browser on a canvas (never a server image route; see ShareResult.jsx for why), with the very marks the page draws
// (lib/badgeArt.js). It says the badge's name, the day it was earned and what it was for, and the address. Nothing the record
// cannot back: no rank, no percentile, no marks of anyone else. Kept under 300 KB (a PNG of flat colour is far smaller; a
// JPEG is used only if it is not).
import { artFor, textSize } from '@/lib/badgeArt';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from '@/components/brand/logoB';

export const CARD = 1080;
export const MAX_BYTES = 300 * 1024;

const PALETTES = {
  light: { bg: '#f3efe6', ink: '#17150f', ink2: '#454036', ink3: '#655f53', line: '#d8d1c2', dot: '#9db400', fill: '#17150f', fill2: '#38342b', rule: 'rgba(243, 239, 230, 0.34)', sign: '#d2f000' },
  dark: { bg: '#12110e', ink: '#f4f0e6', ink2: '#bdb6a6', ink3: '#a09989', line: '#312e27', dot: '#d2f000', fill: '#2a2822', fill2: '#36332b', rule: 'rgba(210, 240, 0, 0.46)', sign: '#d2f000' },
};
export const paletteOf = (theme) => PALETTES[theme === 'light' ? 'light' : 'dark'];

const [VB_X, VB_Y, VB_W, VB_H] = LOGO_B_VIEWBOX.split(' ').map(Number);

function drawLogo(ctx, x, y, height, pal) {
  const s = height / VB_H;
  ctx.save();
  ctx.translate(x - VB_X * s, y - VB_Y * s);
  ctx.scale(s, s);
  ctx.fillStyle = pal.ink;
  ctx.fill(new Path2D(LOGO_B_LETTERS));
  const mobi = LOGO_B_MOBI.full;
  ctx.fillStyle = '#D2F000';
  ctx.fill(new Path2D(mobi.body));
  ctx.fillStyle = '#12110E';
  ctx.fill(new Path2D(mobi.visor));
  if (mobi.eyes) { ctx.fillStyle = '#F3EFE4'; ctx.fill(new Path2D(mobi.eyes), 'evenodd'); }
  ctx.fillStyle = pal.dot;
  ctx.beginPath();
  ctx.arc(VB_X + VB_W + 58 + 90, -90, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** One earned mark, `size` px wide, centred on (cx, cy), turned `tilt` degrees, the way BadgeStamp draws it. */
export function drawStamp(ctx, id, cx, cy, size, pal, faces, tilt = 0) {
  const art = artFor(id);
  if (!art) return;
  const { shape } = art;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.scale(size / 64, size / 64);
  ctx.translate(-32, -32);
  if (shape.rotate) { ctx.translate(32, 32); ctx.rotate((shape.rotate * Math.PI) / 180); ctx.translate(-32, -32); }
  ctx.fillStyle = pal.fill;
  ctx.fill(new Path2D(shape.outline));
  ctx.fillStyle = pal.fill2;
  for (const d of shape.extras) ctx.fill(new Path2D(d));
  ctx.strokeStyle = pal.rule;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.stroke(new Path2D(shape.rule));
  const { x, y, scale } = shape.glyph;
  ctx.fillStyle = pal.sign;
  ctx.strokeStyle = pal.sign;
  if (art.text) {
    const fs = textSize(art.text) * scale;
    ctx.font = `800 ${fs}px ${faces.display}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(-0.045 * fs).toFixed(2)}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(art.text, x, y + 0.36 * fs);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  } else {
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.1;
    for (const d of art.glyph.stroke) ctx.stroke(new Path2D(d));
    ctx.lineWidth = 1.6;
    for (const d of art.glyph.thin) ctx.stroke(new Path2D(d));
    for (const d of art.glyph.fill) ctx.fill(new Path2D(d));
  }
  ctx.restore();
}

/** Words cut into lines no wider than `width`, at most `max` lines (the last one ends with an ellipsis if cut). */
export function wrap(text, width, measure, max = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (measure(tryLine) <= width || !line) line = tryLine;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = `${kept[max - 1].replace(/[.,;:]?$/, '')}…`;
  return kept;
}

/**
 * The card: the logo and the day at the top, the mark in the middle, the badge's name and what it was for under it, the address
 * at the foot. `card` = { id, name, fact, date }.
 */
export function drawBadgeCard(canvas, card, theme, faces) {
  const ctx = canvas.getContext('2d');
  const pal = paletteOf(theme);
  const P = 84;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, CARD, CARD);
  drawLogo(ctx, P, P, 50, pal);
  ctx.textBaseline = 'alphabetic';
  if (card.date) {
    ctx.font = `600 30px ${faces.body}`;
    ctx.fillStyle = pal.ink3;
    ctx.textAlign = 'right';
    ctx.fillText(card.date, CARD - P, P + 40);
  }
  drawStamp(ctx, card.id, CARD / 2, 452, 400, pal, faces, -3);
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.ink;
  ctx.font = `800 76px ${faces.display}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-2px';
  let y = 780;
  for (const line of wrap(card.name, CARD - P * 2, (t) => ctx.measureText(t).width, 2)) { ctx.fillText(line, CARD / 2, y); y += 84; }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.font = `600 36px ${faces.body}`;
  ctx.fillStyle = pal.ink2;
  y += 4;
  for (const line of wrap(card.fact, CARD - P * 2, (t) => ctx.measureText(t).width, 2)) { ctx.fillText(line, CARD / 2, y); y += 50; }
  ctx.fillStyle = pal.line;
  ctx.fillRect(P, CARD - P - 64, CARD - P * 2, 2);
  ctx.fillStyle = pal.ink;
  ctx.font = `700 36px ${faces.display}`;
  ctx.textAlign = 'center';
  ctx.fillText('mockmob.in', CARD / 2, CARD - P);
}

/** The page's own loaded faces (the display and the body font stacks), once loaded. */
export async function pageFaces() {
  const root = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const display = (root?.getPropertyValue('--font-display') || '').trim() || 'system-ui, sans-serif';
  const body = (root?.getPropertyValue('--font-body') || '').trim() || 'system-ui, sans-serif';
  try {
    if (document.fonts?.load) await Promise.all([document.fonts.load(`800 76px ${display}`), document.fonts.load(`600 36px ${body}`)]);
    await document.fonts?.ready;
  } catch { /* drawn with whatever the browser has */ }
  return { display, body };
}

const blobOf = (canvas, type, quality) => new Promise((resolve) => { try { canvas.toBlob((b) => resolve(b), type, quality); } catch { resolve(null); } });

/** Draws the card and returns its image as a Blob (PNG, or JPEG if the PNG would pass 300 KB), or null if it cannot be drawn. */
export async function badgeCardBlob(card, theme) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CARD;
  canvas.height = CARD;
  const faces = await pageFaces();
  drawBadgeCard(canvas, card, theme, faces);
  const png = await blobOf(canvas, 'image/png');
  if (png && png.size <= MAX_BYTES) return png;
  const jpg = await blobOf(canvas, 'image/jpeg', 0.86);
  return jpg && jpg.size <= MAX_BYTES ? jpg : null;
}
