import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from '@/components/brand/logoB';
import { subjectArt } from '@/../data/subject_art.mjs';
import { SUBJECT_HUBS, getSubjectHub } from '@/lib/subjectHubs';
import { FIRST_FULL_FREE, paperCode } from '@/lib/subjectPages.mjs';

// The share picture for a CUET subject hub: the subject's own lamp-lit object (the app's render, a 480 px PNG
// because Satori does not read WebP) standing on its contact shadow under the desk lamp. No model call.

export const runtime = 'nodejs';
export const alt = 'MockMob CUET subject practice: the subject’s object under a desk lamp.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return SUBJECT_HUBS.map((hub) => ({ subject: hub.slug }));
}

const CHARCOAL = '#12110E';
const WARM_WHITE = '#F3EFE4';
const VOLT = '#D2F000';

const pub = (...parts) => path.join(process.cwd(), 'public', ...parts);
const dataUri = (buf, type) => `data:${type};base64,${buf.toString('base64')}`;

// Logo B, warm-white letters with Mobi as the second o, as on the home share picture.
function logoSvg() {
  const [x, y, w, h] = LOGO_B_VIEWBOX.split(' ').map(Number);
  const mobi = LOGO_B_MOBI.small;
  const viewBox = `${x} ${y} ${w} ${h}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="${WARM_WHITE}" d="${LOGO_B_LETTERS}"/><path fill="${VOLT}" d="${mobi.body}"/><path fill="${CHARCOAL}" d="${mobi.visor}"/><path fill="${WARM_WHITE}" fill-rule="evenodd" d="${mobi.eyes}"/></svg>`;
}

export default async function OpengraphImage({ params }) {
  const { subject } = await params;
  const hub = getSubjectHub(subject);
  const art = hub ? subjectArt(hub.slug) : null;
  const font = await readFile(pub('brand', 'fonts', 'BricolageHeadline-SemiBold.ttf'));
  const picture = art ? await readFile(pub('art', 'subjects', 'og', `obj-${art.name}.png`)) : null;
  const logo = dataUri(Buffer.from(logoSvg()), 'image/svg+xml');
  const name = hub?.name || 'CUET subject';
  const code = hub ? paperCode(hub) : null;
  // The share picture's three facts: true for every subject page, and the free first mock only while the rule is on.
  const chips = ['Fresh full mocks', 'Marked +5 / −1', FIRST_FULL_FREE ? 'First mock free' : 'Every miss explained'];

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

  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', background: CHARCOAL, color: WARM_WHITE, fontFamily: 'Bricolage' }}>
      <div style={{ position: 'absolute', right: -140, top: -80, width: 800, height: 800, display: 'flex', backgroundImage: 'radial-gradient(rgba(255, 206, 140, 0.30) 0%, rgba(255, 180, 96, 0.10) 38%, rgba(18, 17, 14, 0) 70%)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 700, padding: '60px 0 58px 68px', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={300} height={Math.round(300 * 0.156)} alt="" style={{ width: 300 }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 24, color: '#B9B4A6', marginBottom: 18 }}>{code ? `CUET UG 2027, paper ${code}` : 'CUET UG 2027'}</span>
          <span style={{ fontSize: name.length > 14 ? 84 : 104, lineHeight: 1, letterSpacing: -2 }}>{name}</span>
          <span style={{ fontSize: 46, lineHeight: 1.1, letterSpacing: -1, color: VOLT, marginTop: 10 }}>Mock tests and practice</span>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 22, color: '#D6D1C2' }}>
          {chips.map((label) => (
            <span key={label} style={{ display: 'flex', padding: '10px 18px', borderRadius: 999, border: '1.5px solid rgba(243, 239, 228, 0.18)' }}>{label}</span>
          ))}
        </div>
      </div>
      {art ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex' }}>
          <div style={{ position: 'absolute', left: footLeft - footW * 0.1, bottom: groundY - 12, width: footW * 1.2, height: 30, display: 'flex', backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.22) 42%, rgba(0, 0, 0, 0) 70%)' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri(picture, 'image/png')} width={drawnW} height={drawnH} alt="" style={{ position: 'absolute', left, bottom, width: drawnW, height: drawnH }} />
        </div>
      ) : null}
    </div>,
    { ...size, fonts: [{ name: 'Bricolage', data: font, weight: 600, style: 'normal' }] },
  );
}
