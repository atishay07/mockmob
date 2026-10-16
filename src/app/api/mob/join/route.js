import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { code, name, colour }: join from an invite. A block reads like a bad code (P10).
export const POST = (request) => handleMob(mobDeps(), 'join', request);
