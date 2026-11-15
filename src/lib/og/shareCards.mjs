// The share cards (link previews): the home card (src/app/opengraph-image.jsx) and the 15 CUET subject cards
// (src/app/cuet/[subject]/opengraph-image.jsx). The pictures are drawn here, with createElement and relative imports, so
// the routes and data/tests/share_cards_1115.test.mjs render the same card.
//
// Weight (P8, 15 Nov 2026): WhatsApp is widely reported to drop a preview image over about 300 KB. Satori draws PNG, and the
// app's photo-real subject objects are what make a PNG heavy: the home card was 329,831 bytes and 12 of the 15 subject
// cards were 302 to 521 KB. The same picture is now sent as a JPEG (quality 85, full colour resolution so the volt line stays
// sharp): about 85 KB for the home card. Same composition, same pixels before encoding. sharp ships with Next.js (its
// optional dependency, installed on Vercel's Linux build); if it ever cannot load, the card is sent as the PNG, as before.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createElement as h } from 'react';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from '../../components/brand/logoB.js';

export const CARD_SIZE = Object.freeze({ width: 1200, height: 630 });
export const CARD_TYPE = 'image/jpeg';
/** The ceiling every card must stay under (bytes), with room under the ~300 KB preview limit. */
export const SHARE_CARD_MAX_BYTES = 300_000;
export const JPEG_OPTIONS = Object.freeze({ quality: 85, mozjpeg: true, chromaSubsampling: '4:4:4' });

const CHARCOAL = '#12110E';
const WARM_WHITE = '#F3EFE4';
const VOLT = '#D2F000';

const pub = (root, ...parts) => path.join(root, 'public', ...parts);
const dataUri = (buf, type) => `data:${type};base64,${buf.toString('base64')}`;

/** Logo B on a dark ground (warm-white letters, Mobi as the second o); `dot` adds the site's volt dot (the home card). */
export function logoSvg({ dot = false } = {}) {
  const [x, y, w, hgt] = LOGO_B_VIEWBOX.split(' ').map(Number);
  const mobi = LOGO_B_MOBI.small;
  const r = 90;
  const width = dot ? w + 58 + r * 2 : w;
  const circle = dot ? `<circle cx="${x + w + 58 + r}" cy="${-r}" r="${r}" fill="${VOLT}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${hgt}"><path fill="${WARM_WHITE}" d="${LOGO_B_LETTERS}"/><path fill="${VOLT}" d="${mobi.body}"/><path fill="${CHARCOAL}" d="${mobi.visor}"/><path fill="${WARM_WHITE}" fill-rule="evenodd" d="${mobi.eyes}"/>${circle}</svg>`;
}

/** The card's one face (Bricolage, semibold). */
export async function cardFonts(root) {
  const data = await readFile(pub(root, 'brand', 'fonts', 'BricolageHeadline-SemiBold.ttf'));
  return [{ name: 'Bricolage', data, weight: 600, style: 'normal' }];
}

// ------------------------------------------------------------------------------------------------ the home card
export const HOME_ALT = 'mockmob. One mock tonight. A clearer next step. For CUET UG 2027: unlimited mocks on Pro, each built fresh from one central question bank. An accountancy calculator, a business case and an economics scale under a desk lamp.';

// The three Commerce objects, the app's own lamp-lit renders (PNG for Satori), with their feet (fractions of each image) so
// the contact shadows sit under the objects.
const STILL_LIFE = [
  { name: 'economics', w: 220, x: 130, bottom: 150, footX: 0.5, footW: 0.88, ground: 0.96, ratio: 480 / 378 },
  { name: 'accountancy', w: 250, x: 0, bottom: 74, footX: 0.54, footW: 0.8, ground: 0.92, ratio: 312 / 480 },
  { name: 'business', w: 168, x: 262, bottom: 62, footX: 0.5, footW: 0.88, ground: 0.955, ratio: 480 / 428 },
];

export async function homeCardAssets(root) {
  return Promise.all(STILL_LIFE.map((o) => readFile(pub(root, 'art', 'subjects', 'og', `obj-${o.name}.png`))));
}

/** The home card: the logo, "One mock tonight. A clearer next step.", the USP line, three objects on a lamp-lit desk. */
export function homeCard(objects) {
  const logo = dataUri(Buffer.from(logoSvg({ dot: true })), 'image/svg+xml');
  return h('div', { style: { display: 'flex', width: '100%', height: '100%', position: 'relative', background: CHARCOAL, color: WARM_WHITE, fontFamily: 'Bricolage' } },
    // The lamp: a warm pool of light over the desk on the right, a faint volt bloom low on the left.
    h('div', { style: { position: 'absolute', right: -120, top: -60, width: 760, height: 760, display: 'flex', backgroundImage: 'radial-gradient(rgba(255, 206, 140, 0.30) 0%, rgba(255, 180, 96, 0.10) 38%, rgba(18, 17, 14, 0) 70%)' } }),
    h('div', { style: { position: 'absolute', left: -220, bottom: -320, width: 720, height: 560, display: 'flex', backgroundImage: 'radial-gradient(rgba(210, 240, 0, 0.10) 0%, rgba(18, 17, 14, 0) 70%)' } }),
    h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 720, padding: '60px 0 58px 68px', position: 'relative' } },
      h('img', { src: logo, width: 336, height: 50, alt: '', style: { width: 336, height: 50 } }),
      h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('span', { style: { fontSize: 24, color: '#B9B4A6', marginBottom: 18 } }, 'For CUET UG 2027'),
        h('span', { style: { fontSize: 76, lineHeight: 1.02, letterSpacing: -2 } }, 'One mock tonight.'),
        h('span', { style: { fontSize: 76, lineHeight: 1.02, letterSpacing: -2, color: VOLT } }, 'A clearer next step.')),
      // One plain line, not a row of pills (W-076): the USP, said as the pricing page says it.
      h('span', { style: { display: 'flex', fontSize: 26, lineHeight: 1.3, color: '#D6D1C2' } }, 'Unlimited mocks on Pro, from one central question bank.')),
    // The still life: three subject objects on a lit desk, each on its own contact shadow.
    h('div', { style: { position: 'absolute', right: 56, bottom: 0, width: 440, height: 630, display: 'flex' } },
      ...STILL_LIFE.flatMap((o, i) => {
        const hgt = Math.round(o.w * o.ratio);
        const footW = o.w * o.footW;
        const footLeft = o.x + o.w * o.footX - footW / 2;
        const groundY = o.bottom + hgt * (1 - o.ground);
        return [
          h('div', { key: `${o.name}-shadow`, style: { position: 'absolute', left: footLeft, bottom: groundY - 9, width: footW, height: 22, display: 'flex', backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.22) 42%, rgba(0, 0, 0, 0) 70%)' } }),
          h('img', { key: o.name, src: dataUri(objects[i], 'image/png'), width: o.w, height: hgt, alt: '', style: { position: 'absolute', left: o.x, bottom: o.bottom, width: o.w, height: hgt } }),
        ];
      })));
}

// ------------------------------------------------------------------------------------------------ a subject card
export const SUBJECT_ALT = 'MockMob CUET subject practice: the subject’s object under a desk lamp.';

/**
 * A subject hub's card: the subject's own lamp-lit object (a 480 px PNG, Satori reads no WebP) on its contact shadow, its
 * paper code, its name and three true facts. `art` is subjectArt(hub.slug) or null; `firstFree` the free first mock rule.
 */
export function subjectCard({ name = 'CUET subject', code = null, art = null, picture = null, firstFree = false }) {
  const logo = dataUri(Buffer.from(logoSvg()), 'image/svg+xml');
  // The share picture's three facts: true for every subject page, and the free first mock only while the rule is on.
  const chips = ['Fresh full mocks', 'Marked +5 / −1', firstFree ? 'First mock free' : 'Every miss explained'];
  // The object is contained in a 470 x 470 stage on the right and stands on its foot (shares of its own file).
  const stage = 470;
  const drawnW = art ? Math.round(Math.min(stage, (stage * art.width) / art.height)) : 0;
  const drawnH = art ? Math.round((drawnW * art.height) / art.width) : 0;
  const stageLeft = 1200 - 64 - stage;
  const left = stageLeft + Math.round((stage - drawnW) / 2);
  const bottom = 92;
  const footW = art ? drawnW * art.footWidth : 0;
  const footLeft = art ? left + drawnW * art.footX - footW / 2 : 0;
  const groundY = art ? bottom + drawnH * (1 - art.ground) : 0;
  return h('div', { style: { display: 'flex', width: '100%', height: '100%', position: 'relative', background: CHARCOAL, color: WARM_WHITE, fontFamily: 'Bricolage' } },
    h('div', { style: { position: 'absolute', right: -140, top: -80, width: 800, height: 800, display: 'flex', backgroundImage: 'radial-gradient(rgba(255, 206, 140, 0.30) 0%, rgba(255, 180, 96, 0.10) 38%, rgba(18, 17, 14, 0) 70%)' } }),
    h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 700, padding: '60px 0 58px 68px', position: 'relative' } },
      h('img', { src: logo, width: 300, height: Math.round(300 * 0.156), alt: '', style: { width: 300 } }),
      h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('span', { style: { fontSize: 24, color: '#B9B4A6', marginBottom: 18 } }, code ? `CUET UG 2027, paper ${code}` : 'CUET UG 2027'),
        h('span', { style: { fontSize: name.length > 14 ? 84 : 104, lineHeight: 1, letterSpacing: -2 } }, name),
        h('span', { style: { fontSize: 46, lineHeight: 1.1, letterSpacing: -1, color: VOLT, marginTop: 10 } }, 'Mock tests and practice')),
      h('div', { style: { display: 'flex', gap: 14, fontSize: 22, color: '#D6D1C2' } },
        ...chips.map((label) => h('span', { key: label, style: { display: 'flex', padding: '10px 18px', borderRadius: 999, border: '1.5px solid rgba(243, 239, 228, 0.18)' } }, label)))),
    art && picture ? h('div', { style: { position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex' } },
      h('div', { style: { position: 'absolute', left: footLeft - footW * 0.1, bottom: groundY - 12, width: footW * 1.2, height: 30, display: 'flex', backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.22) 42%, rgba(0, 0, 0, 0) 70%)' } }),
      h('img', { src: dataUri(picture, 'image/png'), width: drawnW, height: drawnH, alt: '', style: { position: 'absolute', left, bottom, width: drawnW, height: drawnH } })) : null);
}

export async function subjectPicture(root, art) {
  return art ? readFile(pub(root, 'art', 'subjects', 'og', `obj-${art.name}.png`)) : null;
}

// ------------------------------------------------------------------------------------------------ encoding
/** The PNG Satori drew, as a JPEG (JPEG_OPTIONS). Null when sharp cannot load or fails. */
export async function pngToJpeg(png) {
  try {
    const { default: sharp } = await import('sharp');
    return await sharp(png).jpeg(JPEG_OPTIONS).toBuffer();
  } catch {
    return null;
  }
}

/**
 * Draw `element` with the given ImageResponse class (next/og in a route, the same class in a test) and answer with the
 * JPEG, keeping the ImageResponse's own headers (its cache rules). If sharp cannot load, the PNG goes out unchanged.
 */
export async function cardResponse(ImageResponse, element, fonts) {
  const drawn = new ImageResponse(element, { ...CARD_SIZE, fonts });
  const png = Buffer.from(await drawn.arrayBuffer());
  const jpeg = await pngToJpeg(png);
  const headers = new Headers(drawn.headers);
  headers.delete('content-length');
  headers.set('content-type', jpeg ? CARD_TYPE : 'image/png');
  return new Response(jpeg || png, { status: 200, headers });
}
