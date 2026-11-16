import { handleClass } from '@/lib/classLeague/http';
import { classDeps } from '@/lib/classLeague/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST: leave your class (the student who started it closes it instead).
export const POST = (request) => handleClass(classDeps(), 'leave', request);
