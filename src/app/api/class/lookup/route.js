import { handleClass } from '@/lib/classLeague/http';
import { classDeps } from '@/lib/classLeague/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// GET ?code=: public. The class's name and subjects for its join page; never a member count or a name of anyone.
export const GET = (request) => handleClass(classDeps(), 'lookup', request);
