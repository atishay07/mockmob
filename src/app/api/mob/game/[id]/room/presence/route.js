import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Mob live rooms, presence through the API (L-55), behind MOB_V3_ENABLED and MOB_LIVE_ENABLED (else 409 LIVE_OFF).
// POST { st: "here" | "ready" | "left" }: the server broadcasts presence { m, st } and answers { ok, roster, serverNow }.
export const POST = async (request, { params }) => handleMob(mobDeps(), 'roomPresence', request, { id: (await params).id });
