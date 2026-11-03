import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MockMob — CUET 2027 mock tests, Radar analytics, and DU Admission Compass';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const VOLT = '#d2f000';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#0b0d07',
          backgroundImage:
            'radial-gradient(rgba(210,240,0,0.16) 2px, transparent 2px), radial-gradient(circle at 85% 20%, rgba(210,240,0,0.14), transparent 45%)',
          backgroundSize: '44px 44px, 100% 100%',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: VOLT,
              color: '#0b0d07',
              fontSize: 40,
              fontWeight: 900,
            }}
          >
            M
          </div>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#ffffff' }}>
            MockMob
            <span style={{ color: VOLT }}>.</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.08,
              color: '#ffffff',
              letterSpacing: -1.5,
            }}
          >
            CUET 2027 mocks that tell you
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 84,
              fontWeight: 900,
              lineHeight: 1.05,
              color: VOLT,
              letterSpacing: -2,
            }}
          >
            exactly what to fix.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['Peer-verified mocks', 'AI weakness Radar', 'DU Admission Compass'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                padding: '12px 22px',
                borderRadius: 999,
                border: '2px solid rgba(210,240,0,0.45)',
                color: '#e8e9df',
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
