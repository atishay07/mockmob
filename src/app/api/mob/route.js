import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// The Mob (SOCIAL-SPEC section 6). GET: your Mob or { mob: null }. POST { subject, name, colour }: start one (201).
export const GET = (request) => handleMob(mobDeps(), 'get', request);
export const POST = (request) => handleMob(mobDeps(), 'create', request);
