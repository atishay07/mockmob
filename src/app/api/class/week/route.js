import { handleClass } from '@/lib/classLeague/http';
import { classDeps } from '@/lib/classLeague/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// GET ?week=&subject=: your class's figure for one closed Sunday in one subject (a Sunday paper's result).
export const GET = (request) => handleClass(classDeps(), 'week', request);
