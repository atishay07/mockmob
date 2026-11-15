import { handleSunday } from '@/lib/server/sunday/http';
import { sundayDeps } from '@/lib/server/sunday/deps';
import { OPTIONS } from '@/lib/server/mobileCors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { OPTIONS };
// POST { subject, startReceipt? }: start or resume this week's Sunday paper in one of the student's subjects; the same response
// as a practice start on /api/sessions (src/lib/server/sunday/service.js start).
export const POST = (request) => handleSunday(sundayDeps(), 'start', request);
