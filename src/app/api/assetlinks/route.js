// Digital Asset Links for Android App Links (served at /.well-known/assetlinks.json via a rewrite).
export const dynamic = 'force-dynamic';

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
  const body = fingerprints.length
    ? [{
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: 'in.mockmob.app', sha256_cert_fingerprints: fingerprints },
      }]
    : [];
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
