import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { block?: memberId }: leave, optionally blocking one member so you never share a Mob again.
export const POST = (request) => handleMob(mobDeps(), 'leave', request);
