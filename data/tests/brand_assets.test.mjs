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
    assert.match(subjectArtSrcSet(art), new RegExp(`obj-${art.name}\\.v2-256\\.webp 256w`));
    assert.ok(art.footX > 0 && art.footX < 1 && art.footWidth > 0 && art.footWidth <= 1 && art.ground > 0.8 && art.ground <= 1, art.name);
    assert.ok(art.object.length > 3 && !/[!—]/.test(art.object), `${art.name}: plain alt text`);
  }
  // Every file is versioned (next.config serves images with a one-year immutable cache). The app's own full file
  // (800 to 1024 px, byte for byte, so a large object on a 3x screen stays sharp) is under 200 KB and only loads for
  // objects drawn wider than about 340 px; the 512 and 256 files that tiles and cards load stay under 120 KB.
  for (const art of Object.values(SUBJECT_RENDERS)) {
    for (const w of art.widths) {
      const file = `public${subjectArtSrc(art, w)}`;
      assert.match(file, /\.v2(-\d+)?\.webp$/, file);
      const cap = w === art.widths[art.widths.length - 1] ? 200_000 : 120_000;
      assert.ok(read(file).length < cap, `${file} is under ${cap / 1000} KB`);
    }
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

// ---------- Object life (M2): the app's ObjectLife numbers on the website ----------
const life = await import('../../src/components/brand/ObjectLifeModel.mjs');

test('object life: the float, the phases and the subject lights are the app’s', () => {
  const { LIFE, liftAt } = life;
  assert.equal(LIFE.minSize, 96);
  assert.equal(LIFE.floatPeriodMs, 7200);
  assert.equal(LIFE.perspectivePx, 909);
  assert.equal(liftAt(0, 0), 0);
  assert.ok(Math.abs(liftAt(3600, 0) - 1) < 1e-9);
  const phases = {
    accountancy: 0, business: 0.137, economics: 0.274, english: 0.411, generaltest: 0.548, mathematics: 0.685, physics: 0.822,
    chemistry: 0.959, biology: 0.096, history: 0.233, politicalscience: 0.37, geography: 0.507, psychology: 0.644, sociology: 0.781,
    computerscience: 0.918, language: 0.055, environmentalstudies: 0.03, massmedia: 0.11, homescience: 0.19, physicaleducation: 0.255,
    legalstudies: 0.35, knowledgetradition: 0.43, anthropology: 0.57, finearts: 0.61, performingarts: 0.7, engineeringgraphics: 0.75,
    entrepreneurship: 0.84, agriculture: 0.89, teachingaptitude: 0.99,
  };
  for (const art of Object.values(SUBJECT_RENDERS)) {
    assert.equal(art.phase, phases[art.name], `${art.name} phase`);
    assert.match(art.light.night, /^#[0-9A-F]{6}$/, `${art.name} night light`);
    assert.match(art.light.day, /^#[0-9A-F]{6}$/, `${art.name} day light`);
  }
  assert.deepEqual(SUBJECT_RENDERS.business.light, { night: '#14213F', day: '#DCE3F7' });
  assert.deepEqual(SUBJECT_RENDERS.agriculture.light, SUBJECT_RENDERS.language.light);
});

test('object life: the tap spring and twist match the app’s samples', () => {
  const { tapScale, tapTurnDeg, tapKeyframes, LIFE } = life;
  const a = LIFE.tapAmplitude;
  assert.ok(Math.abs(tapScale(0.22, a) - 0.976) < 1e-6);
  assert.ok(Math.abs(tapScale(0.58, a) - 1.016) < 1e-6);
  assert.equal(tapScale(1, a), 1);
  const expected = [0, 0.495, 0.6, 0.354, 0, -0.212, -0.2, -0.071, 0];
  expected.forEach((deg, i) => assert.ok(Math.abs(tapTurnDeg(i / 8, a) - deg) < 0.001, `t=${i / 8}`));
  const frames = tapKeyframes(a);
  assert.equal(frames[0].offset, 0);
  assert.equal(frames.at(-1).offset, 1);
  assert.equal(frames.at(-1).transform, 'rotate(0deg) scale(1)');
});

test('object life: springs settle like Flutter’s, and the tilt presses the touched side away', () => {
  const { SPRINGS, stepSpring, objectTilt, tiltTransform, sheenAt, leanToward, aimAt } = life;
  const run = (spring) => {
    const s = { x: 0, v: 0 };
    let peak = 0, t = 0;
    while (!stepSpring(s, spring, 1, 16) && t < 3000) { t += 16; peak = Math.max(peak, s.x); }
    return { peak, t };
  };
  const smooth = run(SPRINGS.smooth);
  assert.ok(Math.abs(smooth.peak - 1.003) < 0.001, `smooth peak ${smooth.peak}`);
  assert.ok(smooth.t < 1000, `smooth settles (${smooth.t} ms)`);
  const snappy = run(SPRINGS.snappy);
  assert.ok(snappy.peak <= 1.0001, `snappy does not overshoot (${snappy.peak})`);
  // CSS perspective brings +z toward the eye, the app's sends it away: the signs are mirrored so it looks the same.
  assert.equal(tiltTransform({ x: 0, y: 0 }), '');
  assert.equal(tiltTransform({ x: 0, y: -1 }), 'perspective(909px) rotateX(5deg) rotateY(0deg)');
  assert.equal(tiltTransform({ x: 1, y: 0 }), 'perspective(909px) rotateX(0deg) rotateY(5deg)');
  assert.deepEqual(objectTilt({ x: 0.5, y: 0 }, 1), { x: 0.5, y: -0.7 });
  assert.deepEqual(objectTilt({ x: 3, y: -3 }, 0), { x: 1, y: -1 });
  assert.equal(leanToward(0, 56), 0.5);
  assert.deepEqual(aimAt(150, 50, { left: 0, top: 0, width: 100, height: 100 }), { x: 1, y: 0 });
  assert.deepEqual(sheenAt({ x: 0, y: 0 }), { along: 0.5, strength: 0 });
  const lit = sheenAt({ x: 1, y: -1 });
  assert.equal(lit.along, 1);
  assert.equal(lit.strength, 1);
});

test('object life: the sparkle, the shadow and the parallax', () => {
  const { bloomAt, glintsAt, sparkleColours, objectStage, parallaxOffset } = life;
  assert.deepEqual(bloomAt(0), { radius: 0, alpha: 0 });
  assert.ok(Math.abs(bloomAt(0.25).alpha - 0.55) < 1e-6);
  assert.equal(glintsAt(0.5).length, 4);
  assert.equal(sparkleColours(SUBJECT_RENDERS.accountancy.light, false).glint, '#FFF4DA');
  assert.equal(sparkleColours(SUBJECT_RENDERS.accountancy.light, true).glow.toLowerCase(), '#f8edd9');
  for (const art of Object.values(SUBJECT_RENDERS)) {
    const s = objectStage(art, { framed: true });
    const w = s.box.width * art.footWidth;
    assert.ok(Math.abs(s.occlusion.rx - 0.64 * w) < 1e-9 && Math.abs(s.contact.ry - 0.055 * w) < 1e-9, art.name);
    assert.ok(s.foot.y > s.box.y + s.box.height * 0.8, `${art.name} foot near the bottom`);
    assert.ok(s.lightStop > 6 && s.lightStop < 30, `${art.name} light stops above the foot`);
  }
  assert.equal(parallaxOffset(0.05, 200, 400, 800), -5);
  assert.equal(parallaxOffset(0.05, 200, 0, 800), 0);
});

test('object life: the component wires it, and the brand layer no longer styles the object', () => {
  const component = text('src/components/brand/SubjectObject.jsx');
  assert.match(component, /import '\.\/subject-object\.css'/);
  assert.match(component, /life \?\? size >= LIFE\.minSize/);
  assert.match(component, /name=\{`subj-\$\{art\.name\}`\} share="subj-flight"/);
  const css = text('src/components/brand/subject-object.css');
  assert.match(css, /animation: subj-obj-float 7\.2s infinite both/);
  assert.match(css, /translateY\(-3%\) rotate\(-1\.2deg\)/);
  assert.match(css, /scale\(0\.86\);\s*opacity: 0\.65/);
  assert.match(css, /::view-transition-group\(\.subj-flight\) \{\s*animation-duration: 420ms/);
  assert.match(css, /:root\[data-motion='reduced'\]/);
  assert.doesNotMatch(text('src/app/brand.css'), /\.subj-obj\b/);
  const island = text('src/components/brand/ObjectLife.jsx');
  assert.match(island, /^'use client';/);
  assert.doesNotMatch(island, /\.preventDefault\(/);
});
