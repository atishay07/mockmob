// The brand layer (owner, 15 Oct 2026): logo B is the only mark, the Bricolage display face and the app's
// photo-real subject objects are on. Run: node --test data/tests/brand_assets.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BRAND_FLAGS, brandFlags } from '../brand_flags.mjs';
import { SUBJECT_ART_BY_ID, SUBJECT_RENDERS, artBox, subjectArt, subjectArtSrc, subjectArtSrcSet } from '../subject_art.mjs';
import { CUET_PUBLIC_ALLOWED_SUBJECTS, CUET_ALLOWED_SUBJECTS } from '../cuet_controls.js';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_RATIO, LOGO_B_VIEWBOX } from '../../src/components/brand/logoB.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel));
const text = (rel) => read(rel).toString('utf8');

// Intrinsic size of a WebP (VP8X, VP8 or VP8L) or PNG file, read from its header.
function imageSize(buf) {
  if (buf.toString('ascii', 1, 4) === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  throw new Error(`unknown WebP chunk ${chunk}`);
}

test('brand flags ship on and ignore junk overrides', () => {
  assert.equal(BRAND_FLAGS.displayFont, 'bricolage');
  assert.equal(BRAND_FLAGS.subjectArt, true);
  assert.deepEqual(brandFlags({ displayFont: 'comic', subjectArt: 'yes', nope: 1 }), BRAND_FLAGS);
  assert.equal(brandFlags({ subjectArt: false }).subjectArt, false);
});

test('every subject object exists at every srcset width, at the size the data says', () => {
  const names = Object.keys(SUBJECT_RENDERS);
  assert.equal(names.length, 29);
  for (const art of Object.values(SUBJECT_RENDERS)) {
    const full = imageSize(read(`public${art.src}`));
    assert.deepEqual(full, { width: art.width, height: art.height }, art.name);
    assert.equal(art.widths.at(-1), art.width, `${art.name}: the largest srcset entry is the full file`);
    for (const w of art.widths) {
      const file = `public${subjectArtSrc(art, w)}`;
      assert.ok(existsSync(path.join(ROOT, file)), file);
      assert.equal(imageSize(read(file)).width, w, file);
    }
    assert.match(subjectArtSrcSet(art), new RegExp(`obj-${art.name}-256\\.webp 256w`));
    assert.ok(art.footX > 0 && art.footX < 1 && art.footWidth > 0 && art.footWidth <= 1 && art.ground > 0.8 && art.ground <= 1, art.name);
    assert.ok(art.object.length > 3 && !/[!—]/.test(art.object), `${art.name}: plain alt text`);
  }
  // No stray files: every object file in the folder belongs to a render.
  const known = new Set(Object.values(SUBJECT_RENDERS).flatMap((a) => a.widths.map((w) => path.basename(subjectArtSrc(a, w)))));
  for (const f of readdirSync(path.join(ROOT, 'public/art/subjects')).filter((f) => f.endsWith('.webp'))) assert.ok(known.has(f), f);
});

test('every website subject id has its object, and unknown ids keep the line icon', () => {
  const ids = [...CUET_PUBLIC_ALLOWED_SUBJECTS, ...CUET_ALLOWED_SUBJECTS, ...Object.keys(SUBJECT_ART_BY_ID)];
  for (const id of ids) assert.ok(subjectArt(id), id);
  const subjectsJs = text('data/subjects.js');
  for (const [, id] of subjectsJs.matchAll(/id: *'([a-z_]+)'/g)) assert.ok(subjectArt(id), `data/subjects.js ${id}`);
  assert.equal(subjectArt('Business-Studies').name, 'business');
  assert.equal(subjectArt('hindi').name, 'language');
  assert.equal(subjectArt('astrology'), null);
  assert.equal(subjectArt(''), null);
});

test('the object sits wholly inside its tile, with the shadow under its foot', () => {
  for (const art of Object.values(SUBJECT_RENDERS)) {
    for (const framed of [true, false]) {
      const b = artBox(art, 100, { framed });
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 100.0001 && b.y + b.height <= 100.0001, art.name);
      assert.ok(b.shadow.x >= b.x - 0.001 && b.shadow.x + b.shadow.width <= b.x + b.width + 0.001, `${art.name} shadow inside the object`);
      assert.ok(b.shadow.y > b.y + b.height * 0.8 && b.shadow.y <= 100, `${art.name} shadow at the foot`);
      assert.ok(Math.abs(b.width / b.height - art.width / art.height) < 0.001, `${art.name} never stretched`);
    }
  }
  assert.equal(artBox(null, 100), null);
});

test('logo B: three detail masters from one geometry, and no bolt anywhere', () => {
  assert.equal(LOGO_B_VIEWBOX, '40 -670 4504.35 702.11');
  assert.ok(Math.abs(LOGO_B_RATIO - 4504.35 / 702.11) < 0.001);
  assert.ok(LOGO_B_LETTERS.startsWith('M820 0H640'));
  for (const level of ['full', 'small', 'micro']) assert.ok(LOGO_B_MOBI[level].body && LOGO_B_MOBI[level].visor, level);
  assert.equal(LOGO_B_MOBI.micro.eyes, null);
  assert.ok(LOGO_B_MOBI.full.eyes && LOGO_B_MOBI.small.eyes);
  const logo = text('src/components/Logo.jsx');
  assert.doesNotMatch(logo, /zap|bolt/i);
  assert.match(logo, /logo-b__dot/);
  const globals = text('src/app/globals.css');
  assert.doesNotMatch(globals, /\.logo \.bolt|logoBoltWake/);
  assert.match(globals, /--font-display: var\(--font-display-face/);
  // The logo CSS width ratio matches the drawn viewBox (word plus dot: 4504.35 + 58 + 180 units).
  assert.match(text('src/app/brand.css'), new RegExp(`\\* ${((4504.35 + 58 + 180) / 702.11).toFixed(4)}\\)`));
});

test('icons, manifest and the share image use logo B files that exist', () => {
  const icon = text('src/app/icon.svg');
  assert.match(icon, /mockmob app icon/);
  assert.doesNotMatch(icon, /M12 47V17h9l11 14/); // the old bolt-era M mark
  assert.deepEqual(imageSize(read('src/app/apple-icon.png')), { width: 180, height: 180 });
  const manifest = text('src/app/manifest.js');
  for (const [, src, size] of manifest.matchAll(/src: '([^']+)', sizes: '(\d+)x\d+'/g)) {
    const dim = imageSize(read(`public${src}`));
    assert.equal(dim.width, Number(size), src);
  }
  assert.match(manifest, /purpose: 'maskable'/);
  assert.doesNotMatch(manifest, /—/);
  const og = text('src/app/opengraph-image.jsx');
  assert.match(og, /LOGO_B_LETTERS/);
  for (const [, name] of og.matchAll(/name: '([a-z]+)'/g)) assert.ok(existsSync(path.join(ROOT, `public/art/subjects/og/obj-${name}.png`)), name);
  assert.ok(existsSync(path.join(ROOT, 'public/brand/fonts/BricolageHeadline-SemiBold.ttf')));
  assert.ok(existsSync(path.join(ROOT, 'public/brand/fonts/BricolageGrotesque-OFL.txt')));
  assert.match(text('public/sw.js'), /mockmob-public-fallback-v2/);
});
