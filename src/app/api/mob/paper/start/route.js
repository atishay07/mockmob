import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { mob?, extra?, game?, startReceipt? }: start or resume this week's Mob paper, an extra paper, or a Mob full mock
// (game: Full mock together, mode full); the same response as a practice start on /api/sessions.
export const POST = (request) => handleMob(mobDeps(), 'paperStart', request);
