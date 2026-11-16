import { handleStreak } from '@/lib/server/streak';
import { streakDeps } from '@/lib/server/streakDeps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// Exam pause days for the daily streak (17 Nov 2026, S8): POST { days } sets them ahead, DELETE { days } clears future ones.
export const POST = (request) => handleStreak(streakDeps(), 'pauseSet', request);
export const DELETE = (request) => handleStreak(streakDeps(), 'pauseClear', request);
