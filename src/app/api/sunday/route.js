import { handleSunday } from '@/lib/server/sunday/http';
import { sundayDeps } from '@/lib/server/sunday/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// GET: this week's Sunday Mock for the signed-in student (src/lib/server/sunday/service.js status).
export const GET = (request) => handleSunday(sundayDeps(), 'status', request);
