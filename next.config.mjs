import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    // The landing's first paint waited on 14 render-blocking stylesheets (about 84 KB gzip) that competed for
    // connections: the last one to arrive set the Largest Contentful Paint. Inlined in the head, the styles
    // arrive with the HTML and the first paint no longer waits on a stylesheet request.
    inlineCss: true,
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
