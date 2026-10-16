import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { memberId, reason: 'name'|'nudge'|'safety', alsoLeave?, block? }.
export const POST = (request) => handleMob(mobDeps(), 'report', request);
