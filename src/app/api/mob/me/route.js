import { handleMob } from '@/lib/server/mob/http';
import { mobDeps } from '@/lib/server/mob/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// PATCH any of { name, colour, showScore, nudgesMuted, share_study_time } (the last: Mob hours, v3, off by default).
export const PATCH = (request) => handleMob(mobDeps(), 'patchMe', request);
