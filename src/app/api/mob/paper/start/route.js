import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { startReceipt? }: start or resume this week's Mob paper; the same response as a practice start on /api/sessions.
export const POST = (request) => handleMob(mobDeps(), 'paperStart', request);
