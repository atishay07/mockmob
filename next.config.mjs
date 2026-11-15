import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(fileURLToPath(import.meta.url));

// The home page's joined stylesheet (src/app/home-sheets.css, built from its 23 sheets by src/lib/homeCss.mjs): under
// `next dev` it follows the sheets as they are edited, so a change shows at once. Builds never run this; they read the
// committed file, which the tests keep current (css_split.test.mjs).
if (process.env.NODE_ENV === 'development') {
  const { watchHomeCss } = await import('./src/lib/homeCss.mjs');
  watchHomeCss({ log: (line) => console.log(`[home-sheets] ${line}`) });
}

// A3 (15 Nov): security headers on every route (production builds, like the cache headers below).
//  - Framing: only our own pages may frame ours (X-Frame-Options for older browsers, frame-ancestors for current ones).
//    Nothing frames MockMob pages; the app opens them in a WebView, which is not a frame.
//  - Permissions-Policy turns off what the product never uses. Payment stays (Razorpay); fullscreen stays for our pages
//    (the NTA-style test runner and the hero film) and for the Instagram embeds, which already ask for it (CreatorReels).
//  - The full content policy is report-only until a clean walk (landing, Google sign-in, email code, Razorpay checkout,
//    Mob live, Instagram reels) shows no violation. Inline scripts are needed (the root layout has some; nonces would make
//    every page dynamic). upgrade-insecure-requests is left out here: browsers ignore it in a report-only policy and warn.
//  - HSTS stays as Vercel sends it (includeSubDomains is the owner's call).
const supabaseOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin; } catch { return 'https://isrxrxzjocewrdureyhp.supabase.co'; }
})();
const CONTENT_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, 'wss:')} https://api.razorpay.com https://lumberjack.razorpay.com https://accounts.google.com/gsi/`,
  'frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.instagram.com https://accounts.google.com',
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), fullscreen=(self "https://www.instagram.com")' },
  { key: 'Content-Security-Policy-Report-Only', value: CONTENT_POLICY_REPORT_ONLY },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production builds clean their output. Keep the live preview's chunks separate.
  distDir: process.env.MOCKMOB_STAGING_APP === '1' ? '.next-staging' : (process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'),
  // The default bottom-left dev button intercepts the phone's Today dock link.
  devIndicators: false,
  // Dev only: the owner reviews the dev server from this PC's LAN address and from 127.0.0.1, and without the origin
  // allowed the dev client never connects, so the page is not interactive there. Ignored by builds.
  allowedDevOrigins: ['192.168.1.8', '192.168.1.15', '127.0.0.1'],
  experimental: {
    // Avoid restoring the stale Turbopack graph that crashed the local preview.
    turbopackFileSystemCacheForDev: false,
    // React <ViewTransition> on route navigations: the arena's page transitions (AppLayoutClient,
    // src/lib/motion/placeTransition.js, src/instrumentation-client.js). Documented for Next 16.2.4 in
    // node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/viewTransition.md.
    viewTransition: true,
  },
  // The free first full mock's kill switch (data/first_full_mock.js, C-dec 1, release 11 verifier L4): ON when unset, "false"
  // turns it off. Passed into every bundle at build time, so the server's grant and every client line that says "free" read the
  // same value; a change takes a redeploy. Documented for Next 16.2.4 in
  // node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/env.md.
  env: {
    FIRST_FULL_MOCK_ENABLED: process.env.FIRST_FULL_MOCK_ENABLED ?? '',
  },
  poweredByHeader: false,
  compress: true,
  // Evidence gates load these versioned records at runtime, including in serverless feeds.
  outputFileTracingIncludes: {
    '/*': ['./data/source_registry.json', './data/calibration_manifest.json', './data/question_factory_scope.json'],
    // "Where you stand" and Ask Mobi's context read the DU Round 1 closing marks on the server (src/lib/server/duOfferings.js).
    '/api/mobi/standing': ['./public/du/2026/offerings/*.json'],
    '/api/ai/mentor/chat': ['./public/du/2026/offerings/*.json', './data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json'],
    // Key cards: the bundled decks, their manifest and the question links (src/lib/server/keycards.js loadDecks).
    '/api/keycards': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json', './data/keycards/links/*.json'],
    '/api/keycards/*': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json', './data/keycards/links/*.json'],
    // The public Key card pages and the subject pages' Key cards block rebuild hourly from the bundled decks.
    '/key-cards': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json'],
    '/key-cards/**': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json'],
    '/cuet/*': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json'],
    '/api/me/chapters': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json'],
    '/api/me/subject-options': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json'],
    '/api/me/revise': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json'],
    '/api/me/review': ['./data/keycards/manifest.json', './data/keycards/tiers.json', './data/keycards/decks/*.json'],
  },
  trailingSlash: false,
  turbopack: {
    root: appRoot,
  },
  async redirects() {
    return [
      // Do not add a www -> apex redirect here while Vercel's domain setting redirects apex -> www:
      // together they loop (production outage, 4 Oct 2026). Choose the canonical host in Vercel first.
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [{ source: '/.well-known/assetlinks.json', destination: '/api/assetlinks' }];
  },
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [];
    }
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // P14 (15 Nov): the hero film files carry their version in the name (hero-v5-720.mp4), so they are cached like the
      // other fingerprinted assets. The older unversioned names keep the default revalidation.
      {
        source: '/video/:file(hero-v\\d+-[^/]+\\.mp4)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
