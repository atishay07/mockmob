// Builds the website's painted scenes (public/art/scenes/*.v2.{avif,webp}) from the app's full-size
// masters. Not part of the app bundle: run it by hand when the masters change.
//
//   node src/components/scenes/tools/build-scene-files.mjs [masters folder]
//
// Default masters: ../mockmob-next/tmp/feature-wave-1015/masters/I1 (written by the app's
// flutter_app/tool/build_scenes.py). It reads:
//   processed/scene-empty-*.png, processed/scene-milestone-*.png   1536 x 1024 RGBA, already feathered
//   processed/scene-welcome-hero-night.png, scene-plan-seal-night.png   1296 wide, grain and ground done
//   welcome-room.png (1122 x 1402), plan-seal.png (1024 x 1536)   the generator's natives
//
// What it writes (names are versioned, so the one-year immutable cache is safe):
//   vignettes and milestone bands at 768, 1280 and 1536 px wide (1536 is the native width);
//   the two tall rooms at 1080 and 1296 px wide. 1296 is the app's own processed file; 1080 is made
//   the app's way from the native (tall_room() in build_scenes.py: LANCZOS once, 2 percent grain,
//   then blended into the ground from 0.93 welcome, 0.95 seal). Nothing goes past 1296, because
//   1440 would upscale a 1122 or 1024 px native.
// Every size is AVIF and WebP. Prints each file's size.

import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MASTERS = path.resolve(process.argv[2] || path.join(ROOT, '..', 'mockmob-next', 'tmp', 'feature-wave-1015', 'masters', 'I1'));
const OUT = path.join(ROOT, 'public', 'art', 'scenes');
const VERSION = 'v2';

const WIDE = [
  'scene-empty-allclear-night', 'scene-empty-allclear-day',
  'scene-empty-offline-night', 'scene-empty-offline-day',
  'scene-empty-nothing-night', 'scene-empty-nothing-day',
  'scene-empty-saved-night', 'scene-empty-saved-day',
  'scene-empty-noresults-night', 'scene-empty-noresults-day',
  'scene-empty-unreachable-night', 'scene-empty-unreachable-day',
  'scene-milestone-check-night', 'scene-milestone-check-day',
];
const WIDE_WIDTHS = [768, 1280, 1536];

const NIGHT_GROUND = [0x12, 0x11, 0x0e];
const TALL = [
  { name: 'scene-welcome-hero-night', native: 'welcome-room.png', size: [1296, 1620], blendFrom: 0.93, ground: NIGHT_GROUND },
  { name: 'scene-plan-seal-night', native: 'plan-seal.png', size: [1296, 1944], blendFrom: 0.95, ground: NIGHT_GROUND },
];
const TALL_WIDTHS = [1080, 1296];

const WEBP = { quality: 86, alphaQuality: 90, effort: 6, smartSubsample: true };
const AVIF = { quality: 60, effort: 6, chromaSubsampling: '4:4:4' };

const smooth = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// A small seeded generator, so a rebuild makes the same grain.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// tall_room(): the native resized once (LANCZOS), the house 2 percent grain given back (one value per
// pixel on all three channels), then the foot blended into the ground with a smoothstep.
async function tallRoom(src, width, height, blendFrom, ground) {
  const { data, info } = await sharp(src).removeAlpha().resize(width, height, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const rand = mulberry32(7);
  const sd = 0.02 * 255;
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < info.height; y += 1) {
    const t = smooth((y / (info.height - 1) - blendFrom) / (1 - blendFrom));
    for (let x = 0; x < info.width; x += 1) {
      const u = Math.max(rand(), 1e-12);
      const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()) * sd;
      const i = (y * info.width + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        const grained = Math.min(255, Math.max(0, Math.trunc(data[i + c] + n)));
        out[i + c] = Math.min(255, Math.max(0, Math.round(grained * (1 - t) + ground[c] * t)));
      }
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } });
}

const kb = (file) => `${Math.round(statSync(file).size / 1000)} KB`;

async function write(image, base, width) {
  const files = [];
  const avif = path.join(OUT, `${base}-${width}.${VERSION}.avif`);
  const webp = path.join(OUT, `${base}-${width}.${VERSION}.webp`);
  await image.clone().avif(AVIF).toFile(avif);
  await image.clone().webp(WEBP).toFile(webp);
  files.push(avif, webp);
  console.log(`${base} ${width}w  avif ${kb(avif)}  webp ${kb(webp)}`);
  return files;
}

async function main() {
  if (!existsSync(MASTERS)) throw new Error(`No masters at ${MASTERS}`);
  mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const name of WIDE) {
    const src = path.join(MASTERS, 'processed', `${name}.png`);
    const meta = await sharp(src).metadata();
    if (meta.width !== 1536 || meta.height !== 1024 || !meta.hasAlpha) throw new Error(`${src} is ${meta.width} x ${meta.height}, alpha ${meta.hasAlpha}; want the feathered 1536 x 1024 RGBA`);
    for (const width of WIDE_WIDTHS) {
      const image = width === 1536 ? sharp(src) : sharp(src).resize(width, Math.round((width * 1024) / 1536), { kernel: 'lanczos3', fit: 'fill' });
      for (const file of await write(image, name, width)) total += statSync(file).size;
    }
  }
  for (const room of TALL) {
    const processed = path.join(MASTERS, 'processed', `${room.name}.png`);
    const native = path.join(MASTERS, room.native);
    for (const width of TALL_WIDTHS) {
      const height = Math.round((width * room.size[1]) / room.size[0]);
      const image = width === room.size[0] ? sharp(processed).removeAlpha() : await tallRoom(native, width, height, room.blendFrom, room.ground);
      for (const file of await write(image, room.name, width)) total += statSync(file).size;
    }
  }
  console.log(`total ${(total / 1e6).toFixed(2)} MB in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
