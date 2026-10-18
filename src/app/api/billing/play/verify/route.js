import { handlePlayVerify } from '@/lib/server/playBillingHttp';
import { playVerifyDeps } from '@/lib/server/playBillingDeps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST { productId, purchaseToken, orderId?, obfuscatedExternalAccountId? }: verifies a Google Play purchase with Google,
// grants it once (the same entitlement the web grants), then acknowledges or consumes it. Signed-in students only; the app
// sends its bearer token. Off (404 for every method) unless PLAY_BILLING_ENABLED is exactly 'true'.
const handle = (request) => handlePlayVerify(playVerifyDeps(request), request);
export const POST = handle;
export const GET = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
