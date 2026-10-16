import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// GET, public: what the join page may say about an invite. Never a name (P1, P3).
export const GET = async (request, { params }) => handleMob(mobDeps(), 'lookup', request, { code: (await params).code });
