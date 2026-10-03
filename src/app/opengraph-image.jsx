import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const alt = 'MockMob. One mock tonight. A clearer next step tomorrow. CUET UG 2027 Commerce practice and source-backed DU tools.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const pip = await readFile(path.join(process.cwd(), 'public/brand/mascot/og-pointing.png'));
  return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%', padding: 64, background: '#0b0d07', color: '#f4f5e9', fontFamily: 'sans-serif', position: 'relative' }}>
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 780 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><div style={{ display: 'flex', background: '#d2f000', color: '#0b0d07', width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 12, fontSize: 34, fontWeight: 900 }}>M</div><span style={{ fontSize: 38, fontWeight: 800 }}>MockMob.</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><span style={{ fontSize: 24, color: '#b9bca9' }}>CUET UG 2027 · Commerce</span><span style={{ fontSize: 72, lineHeight: 1.08, letterSpacing: -2, fontWeight: 900 }}>One mock tonight.</span><span style={{ fontSize: 62, lineHeight: 1.08, letterSpacing: -2, fontWeight: 900, color: '#d2f000' }}>A clearer next step.</span></div>
      <div style={{ display: 'flex', gap: 24, fontSize: 22, color: '#d4d6c7' }}><span>Practice</span><span>Mistake review</span><span>DU subject rules</span></div>
    </div>
    {/* PNG delivery for Satori; the original transparent mascot is unchanged. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`data:image/png;base64,${pip.toString('base64')}`} width="235" height="280" alt="" style={{ position: 'absolute', right: 45, bottom: 92, objectFit: 'contain' }} />
  </div>, size);
}
