// R7 packet I (LK60): branded desk-object icons replace the vague line icons that stood in for a MockMob meaning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BRAND_ICONS, BRAND_ICON_NAMES, BRAND_ICON_SIZES, brandIconSrc, brandIconSrcSet } from '../brand_icons.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

// A webp's canvas size from its header (VP8X, VP8L or VP8), so the test needs no image library.
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), alpha: Boolean(b[20] & 0x10) };
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff), alpha: Boolean((v >> 28) & 1) }; }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, alpha: false };
}

test('every brand icon ships as a square transparent webp in both sizes, small enough for a list row', () => {
  assert.equal(BRAND_ICON_NAMES.length, 13);
  for (const name of BRAND_ICON_NAMES) {
    for (const px of BRAND_ICON_SIZES) {
      const file = path.join(root, 'public/art/icons', `${name}-${px}.webp`);
      assert.ok(existsSync(file), `${name}-${px}.webp exists`);
      const { w, h, alpha } = webpSize(file);
      assert.equal(w, px, `${name}-${px} width`);
      assert.equal(h, px, `${name}-${px} height`);
      assert.ok(alpha, `${name}-${px} keeps its alpha`);
      assert.ok(statSync(file).size < 24 * 1024, `${name}-${px} stays under 24 KB`);
    }
  }
});

test('the file picker and srcset name real files and refuse unknown names', () => {
  assert.equal(brandIconSrc('keycards', 40), '/art/icons/keycards-96.webp');
  assert.equal(brandIconSrc('keycards', 72), '/art/icons/keycards-192.webp');
  assert.equal(brandIconSrc('nope'), null);
  assert.equal(brandIconSrcSet('mob'), '/art/icons/mob-96.webp 96w, /art/icons/mob-192.webp 192w');
  assert.ok(Object.values(BRAND_ICONS).every((i) => typeof i.meaning === 'string' && i.meaning.length > 0));
});

test('BrandIcon keeps the 32 px floor and a fixed box, decorative unless labelled', () => {
  const src = read('src/components/brand/BrandIcon.jsx');
  assert.match(src, /const MIN_OBJECT_PX = 32;/);
  assert.match(src, /size < MIN_OBJECT_PX/);
  assert.match(src, /aria-hidden=\{label \? undefined : true\}/);
  assert.match(src, /width=\{size\} height=\{size\}/);
});

test('the swapped places draw the desk objects, not the vague glyphs', () => {
  const chapter = read('src/components/learn2/chapter/ChapterPage.jsx');
  assert.match(chapter, /SHELF_ICON = \{ cards: 'keycards', questions: 'questions', lesson: 'lesson', mistakes: 'mistakes', print: 'print' \}/);
  assert.doesNotMatch(chapter, /Printer/, 'the print sheet row ends with the chevron, no printer glyph');
  const hero = read('src/components/learn2/home/RoadmapHero.jsx');
  assert.match(hero, /OR_ICON = \{ revise: 'revise', fix: 'mistakes'/);
  assert.match(hero, /<BrandIcon name=\{OR_ICON\[o\.kind\]\} size=\{36\}/);
  const repairs = read('src/app/(app)/dashboard/PracticeRepairs.jsx');
  assert.doesNotMatch(repairs, /Wrench|MessageCircle/);
  assert.match(repairs, /<BrandIcon name="mistakes" size=\{32\}/);
  assert.match(repairs, /<MobiMark size=\{20\} \/>/);
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /<BrandIcon name="papers" size=\{44\}/);
  assert.doesNotMatch(practice, /pr-door__ico/, 'no icon tile on Your papers');
});

test('the showcase is a development preview view only', () => {
  const preview = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(preview, /view === 'icons' \? <IconShowcase \/>/);
  const routes = ['src/app/(app)', 'src/app/(marketing)'].filter((p) => existsSync(path.join(root, p)));
  for (const r of routes) assert.ok(!existsSync(path.join(root, r, 'icons')), 'no public icons route');
});
