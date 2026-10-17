import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// GET ?mob=: past weekly papers of your Mob (Pro). 402 PRO_REQUIRED otherwise.
export const GET = (request) => handleMob(mobDeps(), 'history', request);
