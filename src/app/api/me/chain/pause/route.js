import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Mob v3 (MOB-BUILD-SPEC-V3 3.2), behind MOB_V3_ENABLED.
// POST { days }: exam pause days.
export const POST = (request) => handleMob(mobDeps(), 'pauseSet', request);
// DELETE { days }: clear future pause days.
export const DELETE = (request) => handleMob(mobDeps(), 'pauseClear', request);
