import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Mob v3 live rooms (MOB-BUILD-SPEC-V3 3.2 and 4), behind MOB_V3_ENABLED and MOB_LIVE_ENABLED (else 409 LIVE_OFF).
// POST {}: the host starts the room; the countdown lands on startsAt (serverNow + 4 s).
export const POST = async (request, { params }) => handleMob(mobDeps(), 'roomStart', request, { id: (await params).id });
