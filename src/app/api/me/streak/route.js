import { handleStreak } from '@/lib/server/streak';
import { streakDeps } from '@/lib/server/streakDeps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// The daily streak for every signed-in student, Mob or not (17 Nov 2026). The body and the contract: src/lib/server/streak.js.
export const GET = (request) => handleStreak(streakDeps(), 'get', request);
