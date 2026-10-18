import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { mob, chapter?, count }: an extra paper on a chosen chapter and length (Pro). 201 with the Mob view and extraId.
export const POST = (request) => handleMob(mobDeps(), 'extra', request);
// GET ?mob=: the chapters of the Mob's subject with how many questions are ready, so the chooser offers papers the bank
// can build (Pro).
export const GET = (request) => handleMob(mobDeps(), 'chapters', request);
