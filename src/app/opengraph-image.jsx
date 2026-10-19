import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from '@/components/brand/logoB';

export const runtime = 'nodejs';
export const alt = 'mockmob. One mock tonight. A clearer next step. For CUET UG 2027: unlimited mocks on Pro, each built fresh from one central question bank. An accountancy calculator, a business case and an economics scale under a desk lamp.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CHARCOAL = '#12110E';
const WARM_WHITE = '#F3EFE4';
const VOLT = '#D2F000';

// Logo B on a dark ground (warm-white letters), the small detail master, plus the site's volt dot.
function logoSvg() {
  const [x, y, w, h] = LOGO_B_VIEWBOX.split(' ').map(Number);
  const mobi = LOGO_B_MOBI.small;
  const r = 90;
  const cx = x + w + 58 + r;
  const viewBox = `${x} ${y} ${w + 58 + r * 2} ${h}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="${WARM_WHITE}" d="${LOGO_B_LETTERS}"/><path fill="${VOLT}" d="${mobi.body}"/><path fill="${CHARCOAL}" d="${mobi.visor}"/><path fill="${WARM_WHITE}" fill-rule="evenodd" d="${mobi.eyes}"/><circle cx="${cx}" cy="${-r}" r="${r}" fill="${VOLT}"/></svg>`;
}

const pub = (...parts) => path.join(process.cwd(), 'public', ...parts);
const dataUri = (buf, type) => `data:${type};base64,${buf.toString('base64')}`;

// The three Commerce objects, the app's own lamp-lit renders (PNG for Satori), with their feet (fractions of
// each image) so the contact shadows sit under the objects.
const STILL_LIFE = [
  { name: 'economics', w: 220, x: 130, bottom: 150, footX: 0.5, footW: 0.88, ground: 0.96, ratio: 480 / 378 },
  { name: 'accountancy', w: 250, x: 0, bottom: 74, footX: 0.54, footW: 0.8, ground: 0.92, ratio: 312 / 480 },
  { name: 'business', w: 168, x: 262, bottom: 62, footX: 0.5, footW: 0.88, ground: 0.955, ratio: 480 / 428 },
];

export default async function OpengraphImage() {
  const [font, ...objects] = await Promise.all([
    readFile(pub('brand', 'fonts', 'BricolageHeadline-SemiBold.ttf')),
    ...STILL_LIFE.map((o) => readFile(pub('art', 'subjects', 'og', `obj-${o.name}.png`))),
  ]);
  const logo = dataUri(Buffer.from(logoSvg()), 'image/svg+xml');

  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', background: CHARCOAL, color: WARM_WHITE, fontFamily: 'Bricolage' }}>
      {/* The lamp: a warm pool of light over the desk on the right, a faint volt bloom low on the left. */}
      <div style={{ position: 'absolute', right: -120, top: -60, width: 760, height: 760, display: 'flex', backgroundImage: 'radial-gradient(rgba(255, 206, 140, 0.30) 0%, rgba(255, 180, 96, 0.10) 38%, rgba(18, 17, 14, 0) 70%)' }} />
      <div style={{ position: 'absolute', left: -220, bottom: -320, width: 720, height: 560, display: 'flex', backgroundImage: 'radial-gradient(rgba(210, 240, 0, 0.10) 0%, rgba(18, 17, 14, 0) 70%)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 720, padding: '60px 0 58px 68px', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={336} height={50} alt="" style={{ width: 336, height: 50 }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 24, color: '#B9B4A6', marginBottom: 18 }}>For CUET UG 2027</span>
          <span style={{ fontSize: 76, lineHeight: 1.02, letterSpacing: -2 }}>One mock tonight.</span>
          <span style={{ fontSize: 76, lineHeight: 1.02, letterSpacing: -2, color: VOLT }}>A clearer next step.</span>
        </div>
        {/* One plain line, not a row of pills (W-076): the USP, said as the pricing page says it (unlimited on Pro, one
            central bank). The kicker no longer says Commerce: the site covers the 15 subjects behind most CUET papers. */}
        <span style={{ display: 'flex', fontSize: 26, lineHeight: 1.3, color: '#D6D1C2' }}>Unlimited mocks on Pro, from one central question bank.</span>
      </div>

      {/* The still life: three subject objects on a lit desk, each on its own contact shadow. */}
      <div style={{ position: 'absolute', right: 56, bottom: 0, width: 440, height: 630, display: 'flex' }}>
        {STILL_LIFE.map((o, i) => {
          const h = Math.round(o.w * o.ratio);
          const footW = o.w * o.footW;
          const footLeft = o.x + o.w * o.footX - footW / 2;
          const groundY = o.bottom + h * (1 - o.ground);
          return [
            <div key={`${o.name}-shadow`} style={{ position: 'absolute', left: footLeft, bottom: groundY - 9, width: footW, height: 22, display: 'flex', backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.22) 42%, rgba(0, 0, 0, 0) 70%)' }} />,
            // eslint-disable-next-line @next/next/no-img-element
            <img key={o.name} src={dataUri(objects[i], 'image/png')} width={o.w} height={h} alt="" style={{ position: 'absolute', left: o.x, bottom: o.bottom, width: o.w, height: h }} />,
          ];
        })}
      </div>
    </div>,
    { ...size, fonts: [{ name: 'Bricolage', data: font, weight: 600, style: 'normal' }] },
  );
}
