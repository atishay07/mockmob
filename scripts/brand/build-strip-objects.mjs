// The hero features strip's desk objects (round 5, owner 6 Nov 2026, LK160: the drawn line icons were "a regression ...
// rather than the 3D-generated icons"; go back to the 3D objects, improved). No generation: every object is cut from art
// the brand already owns, the R7 desk-object sheets (docs/brain/learn-1031/r7/icons-src/sheet-a.webp and sheet-b.webp,
// 1536 x 1024, the source of public/art/icons/*) and Mobi's own greeting render (public/brand/mascot/greeting.webp).
//
//   node scripts/brand/build-strip-objects.mjs
//
// What it makes, per object: public/art/icons/strip/<name>-<w>.webp at 96, 144 and 192 px wide, one 12:11 box (the strip draws
// it at 48 x 44 css px on phones, 56 x 51 from 960 px: hero-scene.css .lp-strip__obj), so 2x and 3x screens get a file cut
// for them straight from the source, never an upscale. In every file:
//   - the object is trimmed to its own pixels (the old 192 px squares kept 4 to 38 px of air in different places, so the
//     objects drew at different sizes and heights);
//   - one visual weight: each is scaled to the same opaque area (AREA, css px squared), held inside the box (the tall
//     compass and Mobi meet its height first), times its optical factor `k` (a wide flat object, dark brass or Mobi's loud
//     lime reads larger than its area, so it is drawn a little smaller);
//   - one baseline: every object stands on the same line (BASE, css px from the top), centred on its own mass;
//   - a soft contact shadow under its foot, baked in (two blurred ellipses, warm black, light from the upper left as the
//     sheets are lit), so it sits on the page like an object on a desk; no tile, no glow, nothing behind it but the shadow.
// The sharpen is the mild unsharp mask a small photo-real render needs after a 3x to 8x reduction (L channel only).
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'public/art/icons/strip';
const SHEETS = 'docs/brain/learn-1031/r7/icons-src';

// The box in css px (phones) and the files' widths. The height follows the box (12:11).
const BOX = { width: 48, height: 44 };
const WIDTHS = [96, 144, 192];
const BASE = 40.5; // the line every object stands on, css px from the box's top
const TOP = 1; // the highest an object may reach
const SIDE = 0.5; // the side margin an object keeps
const AREA = 900; // the opaque area of every object, css px squared, before its optical factor

// Each object: its source and the rectangle around it on the sheet (the object's own pixels plus 10 px), its optical factor.
const OBJECTS = [
  // Unlimited mocks: an answer sheet with filled bubbles and a pencil, the page's picture of a mock (the tour's Practice slide).
  { name: 'questions', src: `${SHEETS}/sheet-a.webp`, rect: [521, 63, 974, 487], k: 1 },
  // Mistake Lab: a paper strip torn and mended with lime tape (the Mistake Lab's section stamp).
  { name: 'mistakes', src: `${SHEETS}/sheet-a.webp`, rect: [1010, 114, 1520, 438], k: 0.93 },
  // Score Recovery: index cards held tight by a lime band, "check it holds" (the Score Recovery Lab's section stamp).
  { name: 'revise', src: `${SHEETS}/sheet-a.webp`, rect: [1021, 579, 1519, 922], k: 0.95 },
  // DU Compass: a brass pocket compass with a lime needle (the Compass section's stamp). Dark brass reads heavier.
  { name: 'compass', src: `${SHEETS}/sheet-b.webp`, rect: [1191, 47, 1524, 516], k: 0.96 },
  // Ask Mobi: Mobi himself, the 3D figure the app's own Ask entry points use (greeting). His lime is the page's loudest colour.
  { name: 'mobi', src: 'public/brand/mascot/greeting.webp', rect: null, k: 0.93 },
  // Key cards: a short stack of index cards with a lime felt tab (the Key cards section's stamp).
  { name: 'keycards', src: `${SHEETS}/sheet-a.webp`, rect: [21, 109, 501, 480], k: 0.95 },
  // Exam-day screen (round 11, 10 Nov 2026): a question paper on a brass clipboard, the brand's own `papers` object (its
  // BrandIcon, public/art/icons/papers-*), cut the same way. Its left edge stops 6 px short of the book beside it on the sheet.
  { name: 'papers', src: `${SHEETS}/sheet-b.webp`, rect: [782, 54, 1158, 499], k: 0.95 },
];
// `node scripts/brand/build-strip-objects.mjs papers` builds only the named objects; with no names, all of them.
const ONLY = process.argv.slice(2);

/** The object's pixels, cleaned: the sheet's webp noise (alpha up to 14) dropped, its near-opaque 253 lifted to 255. */
async function cut({ src, rect }) {
  let img = sharp(src).ensureAlpha();
  if (rect) img = img.extract({ left: rect[0], top: rect[1], width: rect[2] - rect[0], height: rect[3] - rect[1] });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i] < 16 ? 0 : Math.min(255, Math.round((data[i] * 255) / 253));
    data[i] = a;
    if (!a) { data[i - 3] = 0; data[i - 2] = 0; data[i - 1] = 0; continue; }
    const p = (i - 3) / 4, x = p % width, y = (p - x) / width;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  // Its mass (opaque area and centre) and its foot (the extent of the bottom tenth, where the shadow goes).
  let area = 0, mx = 0, fx0 = w, fx1 = -1;
  const footFrom = y1 - Math.max(2, Math.round(h * 0.1));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const a = data[(y * width + x) * 4 + 3] / 255;
      area += a;
      mx += a * (x - x0);
      if (y >= footFrom && a > 0.5) { if (x - x0 < fx0) fx0 = x - x0; if (x - x0 > fx1) fx1 = x - x0; }
    }
  }
  const trimmed = await sharp(data, { raw: { width, height, channels: 4 } }).extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer();
  return { trimmed, w, h, area, cx: mx / area, foot: [fx0, fx1] };
}

/** One file: the object at its weight on the baseline, its contact shadow under it. */
async function draw(obj, cutout, outWidth) {
  const f = outWidth / BOX.width;
  const W = outWidth, H = Math.round(BOX.height * f);
  const fit = Math.min(Math.sqrt(AREA / cutout.area), (BOX.width - 2 * SIDE) / cutout.w, (BASE - TOP) / cutout.h);
  const s = fit * obj.k * f; // source px to output px
  const ow = Math.max(1, Math.round(cutout.w * s)), oh = Math.max(1, Math.round(cutout.h * s));
  const left = Math.min(W - ow, Math.max(0, Math.round((BOX.width / 2) * f - cutout.cx * s)));
  const top = Math.round(BASE * f) - oh;
  // The shadow: a tight dark core where the object meets the page and a wider, softer penumbra, nudged right (lamp upper left).
  const footL = left + cutout.foot[0] * s, footR = left + cutout.foot[1] * s;
  const cx = (footL + footR) / 2 + 0.03 * ow, rx = Math.max(6 * f, (footR - footL) / 2);
  const cy = Math.round(BASE * f) - 0.25 * f;
  const shadow = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <filter id="core" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="${(0.7 * f).toFixed(2)}"/></filter>
      <filter id="soft" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="${(1.7 * f).toFixed(2)}"/></filter>
    </defs>
    <ellipse cx="${cx.toFixed(2)}" cy="${(cy + 0.6 * f).toFixed(2)}" rx="${(rx * 1.08).toFixed(2)}" ry="${(1.9 * f).toFixed(2)}" fill="rgb(28,22,12)" fill-opacity="0.16" filter="url(#soft)"/>
    <ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${(rx * 0.86).toFixed(2)}" ry="${(0.9 * f).toFixed(2)}" fill="rgb(28,22,12)" fill-opacity="0.3" filter="url(#core)"/>
  </svg>`;
  const object = await sharp(cutout.trimmed).resize(ow, oh, { kernel: 'lanczos3' }).sharpen({ sigma: 0.6, m1: 0.6, m2: 1.2 }).png().toBuffer();
  const file = join(OUT, `${obj.name}-${outWidth}.webp`);
  await sharp(Buffer.from(shadow)).composite([{ input: object, left, top }]).webp({ quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(file);
  return { file, width: W, height: H, bytes: statSync(file).size, object: { left, top, width: ow, height: oh } };
}

mkdirSync(OUT, { recursive: true });
for (const obj of OBJECTS) {
  if (ONLY.length && !ONLY.includes(obj.name)) continue;
  const cutout = await cut(obj);
  const made = [];
  for (const w of WIDTHS) made.push(await draw(obj, cutout, w));
  const css = made[0].object;
  console.log(`${obj.name.padEnd(9)} source ${cutout.w}x${cutout.h} area ${Math.round(cutout.area)} -> ${(css.width / 2).toFixed(1)}x${(css.height / 2).toFixed(1)} css px; ${made.map((m) => `${m.width}x${m.height} ${m.bytes} B`).join(', ')}`);
}
