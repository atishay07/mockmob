import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Mob v3 (MOB-BUILD-SPEC-V3 3.2), behind MOB_V3_ENABLED.
// PATCH { mob, showPodium?, nameKey? }: the Mob's podium switch and name (owner only). The Mob view.
export const PATCH = (request) => handleMob(mobDeps(), 'settings', request);
