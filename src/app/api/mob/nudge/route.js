import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST: the one preset 'Sit it with me' note a week. { sent: true, to: n }, a count only.
export const POST = (request) => handleMob(mobDeps(), 'nudge', request);
