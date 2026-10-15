// Logo B icons (the "mo" tile: the m, then Mobi). Built from mockmob-next/tmp/logo/final-B, the same
// geometry as the app launcher. "any" icons are rounded tiles; the maskable one keeps "mo" inside the
// 40 percent safe circle, so launchers can crop it to any shape.
export default function manifest() {
  return {
    id: '/',
    name: 'MockMob: CUET practice',
    short_name: 'MockMob',
    description: 'CUET practice, saved sessions and your next step.',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    background_color: '#0b100e',
    theme_color: '#0b100e',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
