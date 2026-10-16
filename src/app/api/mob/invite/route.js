import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST: a new invite link (revokes the previous one). { code, url, expiresAt, usesLeft }
export const POST = (request) => handleMob(mobDeps(), 'invite', request);
