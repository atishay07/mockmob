import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production builds clean their output. Keep the live preview's chunks separate.
  distDir: process.env.MOCKMOB_STAGING_APP === '1' ? '.next-staging' : (process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'),
  // The default bottom-left dev button intercepts the phone's Today dock link.
  devIndicators: false,
  // Dev only: the owner reviews the dev server from this PC's LAN address and from 127.0.0.1, and without the origin
  // allowed the dev client never connects, so the page is not interactive there. Ignored by builds.
  allowedDevOrigins: ['192.168.1.8', '127.0.0.1'],
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
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
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
