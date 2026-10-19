import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Mob v3 (MOB-BUILD-SPEC-V3 3.2), behind MOB_V3_ENABLED.
// GET: your daily chain.
export const GET = (request) => handleMob(mobDeps(), 'chainGet', request);
// PATCH { hidden }: Hide my chain.
export const PATCH = (request) => handleMob(mobDeps(), 'chainPatch', request);
