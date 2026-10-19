// Digital Asset Links for Android App Links (served at /.well-known/assetlinks.json via a rewrite).
// The owner pastes the Play app-signing SHA-256 into ANDROID_CERT_SHA256 (src/lib/server/assetLinks.js).
import { assetLinksBody } from '@/lib/server/assetLinks';

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(JSON.stringify(assetLinksBody(process.env.ANDROID_CERT_SHA256)), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
