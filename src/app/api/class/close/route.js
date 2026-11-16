import { handleClass } from '@/lib/classLeague/http';
import { classDeps } from '@/lib/classLeague/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST: the student who started the class closes it for everyone.
export const POST = (request) => handleClass(classDeps(), 'close', request);
