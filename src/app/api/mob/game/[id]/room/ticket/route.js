import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Mob v3 live rooms (MOB-BUILD-SPEC-V3 3.2 and 4), behind MOB_V3_ENABLED and MOB_LIVE_ENABLED (else 409 LIVE_OFF).
// POST {}: a ticket to the room's private Realtime channel (topic, memberId, expiresAt, room, serverNow). Any member.
export const POST = async (request, { params }) => handleMob(mobDeps(), 'roomTicket', request, { id: (await params).id });
