import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Mob v3 (MOB-BUILD-SPEC-V3 3.2), behind MOB_V3_ENABLED.
// POST { q, pick }: lock in one answer; only your own right or wrong comes back.
export const POST = async (request, { params }) => handleMob(mobDeps(), 'answer', request, { id: (await params).id });
