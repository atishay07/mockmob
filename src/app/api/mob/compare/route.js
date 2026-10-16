import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// GET ?mob=&week= or ?extra=: the side-by-side (Pro, or your one free sample). 402 PRO_REQUIRED otherwise.
export const GET = (request) => handleMob(mobDeps(), 'compare', request);
