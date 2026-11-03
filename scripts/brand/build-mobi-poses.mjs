// Builds Mobi's static seat poses for the home page (LK73, 4 Nov 2026, decision 10): ONE finish for every seat, the
// rigged vector Mobi the app paints, in place of the baked photo-real poses. Each pose is the same MobiFigure the live
// Mobi draws (src/components/brand/MobiFigure.jsx) laid out by poseRig(...) for the act's still pose, as plain SVG.
//
//   node scripts/brand/build-mobi-poses.mjs
//
// The output, src/components/brand/mobiPoses.generated.js, holds each pose as a <symbol> with its own id prefix, so the
// server renders them ONCE as a sprite (MobiPoseSprite.jsx) and every seat is a small <svg><use/></svg>: the page carries
// each pose a single time however many seats show it, and no pose string ever ships in a client chunk. Numbers are
// rounded to two decimals (the rig's own are 15-digit floats), which is invisible at seat size. Run it again whenever
// the rig or the figure changes.
//
// JSX and the '@/...' alias are handled by a small module hook using the SWC that ships with Next; CSS imports are
// empty and JSON imports are plain default exports. Nothing here runs in the app.

import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = pathToFileURL(path.join(ROOT, 'src') + path.sep).href;
const OUT = path.join(ROOT, 'src', 'components', 'brand', 'mobiPoses.generated.js');

const hooks = `
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(${JSON.stringify(pathToFileURL(path.join(ROOT, 'package.json')).href)});
const swc = require('next/dist/build/swc');
let ready = null;
const SRC = ${JSON.stringify(SRC)};
const EXT = ['', '.js', '.jsx', '.mjs', '/index.js'];
export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith('@/')) spec = new URL(spec.slice(2), SRC).href;
  if ((spec.startsWith('.') || spec.startsWith('file:')) && context.parentURL?.startsWith('file:')) {
    const base = new URL(spec, context.parentURL);
    for (const ext of EXT) {
      const url = new URL(base.href + ext);
      if (existsSync(fileURLToPath(url)) && !fileURLToPath(url).endsWith('\\\\') ) {
        try { if (require('node:fs').statSync(fileURLToPath(url)).isFile()) return next(url.href, context); } catch {}
      }
    }
  }
  return next(spec, context);
}
export async function load(url, context, next) {
  if (url.endsWith('.css')) return { format: 'module', source: 'export default {};', shortCircuit: true };
  if (url.endsWith('.json')) return { format: 'module', source: 'export default ' + readFileSync(fileURLToPath(url), 'utf8') + ';', shortCircuit: true };
  if (url.endsWith('.jsx')) {
    ready ||= Promise.resolve(swc.loadBindings?.());
    await ready;
    const out = await swc.transform(readFileSync(fileURLToPath(url), 'utf8'), { jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' } });
    return { format: 'module', source: out.code, shortCircuit: true };
  }
  if (url.startsWith('file:') && url.endsWith('.js') && url.startsWith(SRC)) return { format: 'module', source: readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true };
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`, import.meta.url);

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { default: MobiFigure } = await import(new URL('components/brand/MobiFigure.jsx', SRC).href);
const { poseRig } = await import(new URL('components/brand/mobiPose.js', SRC).href);
const { book, moves } = await import(new URL('components/brand/mobiBook.js', SRC).href);

// act, mood and options per pose. The names are the rig's acts; Mascot.jsx maps the seat names (greeting, thinking...) onto them.
const POSES = [
  ['wave', 'happy', {}], // open eyes: the greeting (never the closed-eye `hello` squint, decision 2)
  ['listen', 'calm', {}], // attentive, for the pricing seat
  ['think', 'calm', {}], // the Mistake Lab seat
  ['point', 'calm', { pointSide: 1 }], // the Compass and DU seats
  ['cheer', 'happy', {}], // the close band
  ['encourage', 'calm', {}], // Score Recovery, and a wrong sample answer
  ['read', 'calm', {}], // holds the answer sheet: the exam section and the tour
  ['idle', 'calm', {}], // standing at ease
];
const round = (svg) => svg.replace(/-?\d+\.\d{3,}/g, (n) => String(Math.round(Number(n) * 100) / 100));
// A still pose never shows the parts the live rig turns on (rings, pieces, sparks, speech marks: display="none"), and the
// rig's own hooks (data-m) have nothing to drive here, so both go: about a third of the bytes.
function stripHidden(svg) {
  const open = /<(\w+)\b[^>]*\sdisplay="none"[^>]*>/;
  for (let m = open.exec(svg); m; m = open.exec(svg)) {
    const tag = m[1];
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    re.lastIndex = m.index + m[0].length;
    let depth = 1;
    let end = -1;
    for (let t = re.exec(svg); t; t = re.exec(svg)) {
      depth += t[1] ? -1 : t[0].endsWith('/>') ? 0 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    if (end < 0) throw new Error(`unbalanced <${tag}> while stripping hidden parts`);
    svg = svg.slice(0, m.index) + svg.slice(end);
  }
  return svg.replace(/ data-[a-z-]+="[^"]*"/g, '');
}
const out = {};
let total = 0;
for (const [act, mood, opts] of POSES) {
  const initial = poseRig(moves, book, act, mood, { live: false, ...opts });
  let svg = renderToStaticMarkup(createElement(MobiFigure, { initial, px: 1 }));
  const used = svg.match(/id="(mb[^"-]*-)/)?.[1];
  if (!used) throw new Error(`no gradient prefix found in the ${act} figure`);
  svg = round(stripHidden(svg.split(used).join(`mbp-${act}-`)));
  // The figure's own outer <svg class="mb-svg" ...> becomes a <symbol>, so one sprite holds every pose.
  svg = svg.replace(/^<svg class="mb-svg" viewBox="([^"]+)"[^>]*>/, `<symbol id="mbp-${act}" viewBox="$1" overflow="visible">`).replace(/<\/svg>$/, '</symbol>');
  if (!svg.startsWith('<symbol')) throw new Error(`the ${act} figure did not start with the expected <svg class="mb-svg">`);
  out[act] = svg;
  total += Buffer.byteLength(svg);
}
writeFileSync(OUT, `// GENERATED by scripts/brand/build-mobi-poses.mjs. Do not edit by hand; run the script again.\n// Mobi's seat poses as SVG <symbol>s (${POSES.map(([a]) => a).join(', ')}): ${total} bytes in all.\nexport const MOBI_POSE_VIEWBOX = '0 0 140 168';\nexport const MOBI_POSES = ${JSON.stringify(out, null, 1)};\n`);
console.log(`wrote ${path.relative(ROOT, OUT)}: ${POSES.length} poses, ${total} bytes of SVG`);
