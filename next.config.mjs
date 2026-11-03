import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const appRoot = dirname(fileURLToPath(import.meta.url));
const capsulePath = new URL('./data/cuet_v713_runtime_binding.json', import.meta.url);
const v713TracedFiles = existsSync(capsulePath) ? Object.keys(JSON.parse(readFileSync(capsulePath, 'utf8')).files).map(path => `./${path}`) : [];

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
    '/*': [
      './data/source_registry.json', './data/calibration_manifest.json', './data/question_factory_scope.json',
      './data/cuet_v713_runtime_binding.json', ...v713TracedFiles,
      './scripts/pipeline/lib/factoryEvidenceV7.mjs',
      './scripts/pipeline/lib/verifyV7.mjs',
      './scripts/pipeline/lib/contractV7.mjs',
      './scripts/pipeline/lib/contractV73.mjs',
      './scripts/pipeline/lib/factoryEvidenceV73.mjs',
      './scripts/pipeline/lib/verifyV73.mjs',
      './scripts/pipeline/lib/cuetExemplarPolicyVNext.mjs',
      './scripts/pipeline/lib/releaseEvidenceV73.mjs',
      './scripts/pipeline/lib/contractV74.mjs',
      './scripts/pipeline/lib/factoryEvidenceV74.mjs',
      './scripts/pipeline/lib/verifyV74.mjs',
      './scripts/pipeline/lib/releaseEvidenceV74.mjs',
      './scripts/pipeline/lib/originalAuthorPolicyV74.mjs',
      './scripts/pipeline/lib/releaseEvidenceV7.mjs',
      './scripts/pipeline/lib/currentCuetCalibrationGateVNext.mjs',
      './scripts/pipeline/lib/cuetFit.mjs',
      './scripts/pipeline/lib/authorIntegrityV7.mjs',
      './scripts/pipeline/lib/factoryCore.mjs',
      './scripts/pipeline/lib/factoryEvidence.mjs',
      './scripts/pipeline/lib/evidencePipeline.mjs',
      './scripts/pipeline/lib/focusedCoverage.mjs',
      './scripts/pipeline/lib/focusedSources.mjs',
      './data/cuet_fit_rubric.mjs',
      './data/cuet_fit_evidence.mjs',
      './data/v73_runtime_evidence.mjs',
      './data/factory_current_validation.mjs',
      './data/v73_runtime_contract.mjs',
      './data/cuet_v73_runtime_binding.json',
      './data/v74_runtime_contract.mjs',
      './data/cuet_v74_runtime_binding.json',
      './data/factory_runtime_evidence.mjs',
      './data/content_evidence.js',
      './data/question_factory_policy.mjs',
      './data/question_presentation.mjs',
      './data/canonical_json.mjs',
    ],
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
