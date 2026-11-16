import { handleClass } from '@/lib/classLeague/http';
import { classDeps } from '@/lib/classLeague/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { reason, code? }: report a class to MockMob support (one email with the class's name and code).
export const POST = (request) => handleClass(classDeps(), 'report', request);
