import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { mob, chapter?, count }: an extra paper on a chosen chapter and length (Pro). 201 with the Mob view and extraId.
export const POST = (request) => handleMob(mobDeps(), 'extra', request);
