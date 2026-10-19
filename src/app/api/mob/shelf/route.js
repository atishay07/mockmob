import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Mob v3 (MOB-BUILD-SPEC-V3 3.2), behind MOB_V3_ENABLED.
// GET: your shelf: owned and locked Folds with real counts, finishes and each Mob's den items.
export const GET = (request) => handleMob(mobDeps(), 'shelf', request);
