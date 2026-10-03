import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production builds clean their output. Keep the live preview's chunks separate.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  // The default bottom-left dev button intercepts the phone's Today dock link.
  devIndicators: false,
  experimental: {
    // Avoid restoring the stale Turbopack graph that crashed the local preview.
    turbopackFileSystemCacheForDev: false,
  },
  poweredByHeader: false,
  compress: true,
  trailingSlash: false,
  turbopack: {
    root: appRoot,
  },
  async redirects() {
    return [
      // Consolidate on the apex host: canonicals and the sitemap already point
      // to mockmob.in, so www must redirect there or Google splits link equity.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.mockmob.in' }],
        destination: 'https://mockmob.in/:path*',
        permanent: true,
      },
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
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
