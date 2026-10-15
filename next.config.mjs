import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextRedirects, nextRewrites } from './data/route_moves.mjs';

const appRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production builds clean their output. Keep the live preview's chunks separate.
  distDir: process.env.MOCKMOB_STAGING_APP === '1' ? '.next-staging' : (process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'),
  // The default bottom-left dev button intercepts the phone's Today dock link.
  devIndicators: false,
  experimental: {
    // Avoid restoring the stale Turbopack graph that crashed the local preview.
    turbopackFileSystemCacheForDev: false,
  },
  poweredByHeader: false,
  compress: true,
  // Evidence gates load these versioned records at runtime, including in serverless feeds.
  outputFileTracingIncludes: {
    '/*': ['./data/source_registry.json', './data/calibration_manifest.json', './data/question_factory_scope.json'],
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
      // Where pages moved in the website restructure (data/route_moves.mjs, plan 2.4): 308s that keep
      // the query string (/features, /coming-soon, /pricing/prepos, /my-uploads, /progress). /recovery
      // stays a page-level redirect, because it opens again once the old recovery episodes are released.
      ...nextRedirects(),
    ];
  },
  async rewrites() {
    return [
      { source: '/.well-known/assetlinks.json', destination: '/api/assetlinks' },
      // New paths served by existing pages; the address bar keeps the new path. /practice is Practice
      // (/dashboard), /ask is Ask Mobi (/mentor?tab=ask), /start opens the Start sheet over Today.
      ...nextRewrites(),
    ];
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
