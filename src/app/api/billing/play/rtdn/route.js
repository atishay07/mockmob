import { handlePlayRtdn } from '@/lib/server/playBillingHttp';
import { playRtdnDeps } from '@/lib/server/playBillingDeps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Google Play Real-time Developer Notifications, delivered by a Pub/Sub push subscription to
// /api/billing/play/rtdn?token=<PLAY_RTDN_TOKEN>. A voided purchase (refund, chargeback) takes back what it granted; a test
// notification is logged. Off (404 for every method) unless PLAY_BILLING_ENABLED is exactly 'true'.
const handle = (request) => handlePlayRtdn(playRtdnDeps(), request);
export const POST = handle;
export const GET = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
