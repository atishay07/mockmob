import { handleClass } from '@/lib/classLeague/http';
import { classDeps } from '@/lib/classLeague/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { code }: join a class by its code.
export const POST = (request) => handleClass(classDeps(), 'join', request);
